import os
import time
import requests
import pandas as pd
from datetime import datetime, timedelta
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

# --- CONFIGURATION ---
TOMTOM_KEY = os.environ.get("TOMTOM_KEY") # Add this to your .env file!
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

if not TOMTOM_KEY or "YOUR_KEY" in TOMTOM_KEY:
    print("❌ Error: Missing TOMTOM_KEY in .env file")
    exit()

# Major Arteries in Cebu (The "Pulse" of the city)
# Updated Major Arteries in Cebu based on the Route Index
ROUTES = [
    # --- PRIMARY BUSINESS ARTERIES ---
    {"name": "IT Park to Ayala", "start": "10.3296,123.9056", "end": "10.3175,123.9066"},
    {"name": "Banilad to Talamban Tintay", "start": "10.3404,123.9103", "end": "10.3700,123.9150"},
    {"name": "Osmena Blvd (Capitol to Colon)", "start": "10.3168,123.8931", "end": "10.2974,123.9015"},
    {"name": "SRP (South Road Properties)", "start": "10.2797,123.8804", "end": "10.2520,123.8640"},
    {"name": "Mabolo to Ayala via MJ Cuenco", "start": "10.3230,123.9150", "end": "10.3175,123.9066"},

    # --- NORTHERN COMMUTER FLOWS ---
    {"name": "Pit-os to Talamban (North Hub)", "start": "10.3952,123.9218", "end": "10.3700,123.9150"},
    {"name": "Apas (Camp Lapu-Lapu) to IT Park", "start": "10.3400,123.9080", "end": "10.3296,123.9056"},
    {"name": "Lahug to Plaza Housing", "start": "10.3340,123.8980", "end": "10.3540,123.8910"},

    # --- SOUTHERN COMMUTER FLOWS ---
    {"name": "Bulacao to Pardo Proper", "start": "10.2715,123.8565", "end": "10.2880,123.8650"},
    {"name": "Inayawan to Colon (South Link)", "start": "10.2701,123.8563", "end": "10.2965,123.9017"},
    {"name": "Labangon to Ayala (Route 12L)", "start": "10.3023,123.8821", "end": "10.3175,123.9066"},
    {"name": "Guadalupe to Capitol (Route 06)", "start": "10.3210,123.8710", "end": "10.3168,123.8931"},
    {"name": "Banawa to Jones Avenue", "start": "10.3110,123.8800", "end": "10.3100,123.8950"},

    # --- DOWNTOWN & PORT CONVERGENCE ---
    {"name": "Pier 1 to Colon (Port Area)", "start": "10.2925,123.9089", "end": "10.2965,123.9017"},
    {"name": "Magallanes to Cebu Cathedral", "start": "10.2940,123.9020", "end": "10.2955,123.9050"},
    {"name": "Colon to SM Seaside (MYBus Link)", "start": "10.2965,123.9017", "end": "10.2818,123.8837"},

    # --- MACTAN-MANDAUE INTERCONNECTS ---
    {"name": "Mactan Bridge (Mandaue Side)", "start": "10.3239,123.9372", "end": "10.3117,123.9784"},
    {"name": "Parkmall to MEPZ 1", "start": "10.3255,123.9340", "end": "10.3160,123.9650"},
    {"name": "Tamiya (MEPZ 2) to Cordova", "start": "10.3010,123.9450", "end": "10.2506,123.9493"},
    {"name": "Airport to SM City Cebu", "start": "10.3075,123.9800", "end": "10.3111,123.9181"},
    {"name": "Mandaue Public Market to Banilad", "start": "10.3283,123.9416", "end": "10.3395,123.9110"}
]


def get_next_weekday(startdate, weekday):
    """Finds the date of the next specific weekday (0=Mon, 6=Sun)"""
    days_ahead = weekday - startdate.weekday()
    if days_ahead <= 0: 
        days_ahead += 7
    return startdate + timedelta(days=days_ahead)

print("🚦 Starting TomTom Historical Harvest...")
print("   (We are querying 'Next Week' to capture typical traffic patterns)")

data_rows = []
today = datetime.now()

# Loop through every day of the week (Mon-Sun)
for day_idx in range(7):
    # Calculate the date for "Next Monday", "Next Tuesday", etc.
    target_date = get_next_weekday(today, day_idx)
    date_str = target_date.strftime('%Y-%m-%d')
    print(f"\n📅 Harvesting Data for: {target_date.strftime('%A')} ({date_str})")

    # Loop through every hour (00:00 to 23:00)
    for hour in range(24):
        # TomTom requires ISO format: YYYY-MM-DDTHH:MM:SS
        depart_at = f"{date_str}T{hour:02}:00:00"
        
        for route in ROUTES:
            try:
                # We ask: "How long is this drive at this specific future time?"
                # TomTom answers based on its historical database.
                url = f"https://api.tomtom.com/routing/1/calculateRoute/{route['start']}:{route['end']}/json?key={TOMTOM_KEY}&traffic=true&departAt={depart_at}&computeTravelTimeFor=all"
                
                res = requests.get(url).json()
                
                if 'routes' in res:
                    summary = res['routes'][0]['summary']
                    base_time = summary['noTrafficTravelTimeInSeconds']
                    curr_time = summary['travelTimeInSeconds']
                    factor = round(curr_time / base_time, 2)

                    row = {
                        "day_of_week": day_idx,
                        "hour_of_day": hour,
                        "route_name": route['name'],
                        "base_duration": base_time,
                        "current_duration": curr_time,
                        "congestion_factor": factor
                    }
                    data_rows.append(row)
                    print(f"   Shape: {route['name'][:10]}... | {hour:02}:00 | Factor: {factor}x", end="\r")
                
                # Sleep briefly to be nice to the API (5 calls/sec limit)
                time.sleep(0.15)

            except Exception as e:
                print(f"   ⚠️ Error: {e}")

# Bulk Insert to Supabase
print(f"\n\n📦 Uploading {len(data_rows)} historical data points to Supabase...")
BATCH_SIZE = 500
for i in range(0, len(data_rows), BATCH_SIZE):
    batch = data_rows[i : i + BATCH_SIZE]
    supabase.table('traffic_logs').insert(batch).execute()
    print(f"   ✅ Batch {i} uploaded.")

print("🎉 DONE! Your database now has real TomTom historical patterns.")