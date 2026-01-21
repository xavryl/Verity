import os
import pandas as pd
import numpy as np
import random
from datetime import datetime, timedelta
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

# 1. CONFIGURATION
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Define the "Pulse" of Cebu Traffic (Synthetic Pattern)
# These routes act as your "sensors" for the whole city
ROUTES = [
    {"name": "IT Park to Ayala", "base_time": 900},   # 15 mins base
    {"name": "Mactan Bridge", "base_time": 1200},     # 20 mins base
    {"name": "Osmena Blvd", "base_time": 600}         # 10 mins base
]

def generate_congestion(day, hour):
    """Returns a multiplier (e.g., 1.5x slower) based on Cebu rush hours."""
    is_weekend = day >= 5
    base = 1.0
    
    if is_weekend:
        # Weekends: Mid-day traffic, lighter overall
        if 10 <= hour <= 18: base = random.uniform(1.1, 1.4)
    else:
        # Weekdays: Heavy Morning & Evening Rush
        if 7 <= hour <= 9: base = random.uniform(1.6, 2.2)   # Morning Rush
        elif 16 <= hour <= 19: base = random.uniform(1.8, 2.5) # Evening Rush (Worst)
        elif 11 <= hour <= 13: base = random.uniform(1.2, 1.5) # Lunch Rush
        elif 0 <= hour <= 5: base = 1.0 # Late night free flow
        else: base = random.uniform(1.1, 1.3) # Normal flow

    # Add random noise (accidents, rain, etc.)
    if random.random() < 0.05: base += 0.5 
    
    return round(base, 2)

print("🌱 Seeding Traffic History (Dec 1, 2023 - Today)...")

data_rows = []
start_date = datetime(2023, 12, 1)
end_date = datetime.now()
current = start_date

while current <= end_date:
    for hour in range(24):
        factor = generate_congestion(current.weekday(), hour)
        
        for route in ROUTES:
            data_rows.append({
                "created_at": current.replace(hour=hour, minute=0).isoformat(),
                "day_of_week": current.weekday(),
                "hour_of_day": hour,
                "route_name": route["name"],
                "base_duration": route["base_time"],
                "current_duration": int(route["base_time"] * factor),
                "congestion_factor": factor
            })
    current += timedelta(days=1)

# Upload in batches to avoid timeouts
BATCH_SIZE = 1000
for i in range(0, len(data_rows), BATCH_SIZE):
    batch = data_rows[i : i + BATCH_SIZE]
    try:
        supabase.table('traffic_logs').insert(batch).execute()
        print(f"✅ Uploaded batch {i} to {i+len(batch)}")
    except Exception as e:
        print(f"❌ Error: {e}")

print("🎉 Database seeded! Your AI now has 'memory'.")