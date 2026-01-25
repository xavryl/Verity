import os
import pandas as pd
import numpy as np
import joblib
import asyncio
import uuid
import datetime
import requests
from contextlib import asynccontextmanager
from supabase import create_client
from sklearn.neighbors import BallTree
from sklearn.ensemble import RandomForestRegressor
from geopy.distance import geodesic
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import tracery
from tracery.modifiers import base_english

load_dotenv()

# --- 1. CONFIGURATION ---
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
TOMTOM_KEY = os.environ.get("TOMTOM_KEY") 
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Shared memory
JOB_QUEUE = asyncio.Queue()
JOB_STATUS = {}

# Global AI "Brains"
AMENITY_BRAIN = None
PROPERTY_BRAIN = pd.DataFrame()
TRAFFIC_MODEL = None 

# --- CATEGORIES ---
CATEGORIES = {
    'safety': ['police', 'fire station', 'barangay hall', 'station', 'outpost'],
    'health': ['hospital', 'clinic', 'pharmacy', 'drugstore', 'dental', 'diagnostic', 'laboratory', 'bloodbank', 'vet', 'medical'],
    'education': ['school', 'college', 'university', 'k-12', 'library', 'education', 'academy'],
    'lifestyle': ['gym', 'fitness', 'crossfit', 'yoga', 'mall', 'supermarket', 'market', 'public market', 'convenience store', 'grocery', 'restaurant', 'cafe', 'bank', 'atm', 'hardware', 'laundry', 'laundryshop', 'water refilling', 'gas station', 'church', 'chapel']
}

# --- SMART MAPPING: Specific keywords to boost for specific personas ---
PERSONA_BOOSTS = {
    'fitness': ['gym', 'fitness', 'crossfit', 'yoga', 'sports'],
    'pets': ['vet', 'animal', 'pet'],
    'student': ['university', 'college', 'library'],
    'family': ['school', 'k-12', 'park'],
    'safety': ['police', 'barangay'],
    'convenience': ['mall', 'supermarket', 'grocery']
}

grammar_source = {
    "opener": ["Forget the traffic.", "The smart move.", "Living made easy."],
    "distance_adj": ["steps away", "just around the corner", "nearby"],
    "default_headline": "Prime Location",
    "default_body": "Ideally situated with {name} #distance_adj#."
}

REFERENCE_ROUTES = [
    {"name": "IT Park to Ayala", "start": "10.3296,123.9056", "end": "10.3175,123.9066"},
    {"name": "Banilad to Talamban Tintay", "start": "10.3404,123.9103", "end": "10.3700,123.9150"},
    {"name": "Osmena Blvd", "start": "10.3168,123.8931", "end": "10.2974,123.9015"},
    {"name": "SRP (South Road Properties)", "start": "10.2797,123.8804", "end": "10.2520,123.8640"},
    {"name": "Mabolo to Ayala via MJ Cuenco", "start": "10.3230,123.9150", "end": "10.3175,123.9066"},
    {"name": "Pit-os to Talamban (North Hub)", "start": "10.3952,123.9218", "end": "10.3700,123.9150"},
    {"name": "Apas (Camp Lapu-Lapu) to IT Park", "start": "10.3400,123.9080", "end": "10.3296,123.9056"},
    {"name": "Lahug to Plaza Housing", "start": "10.3340,123.8980", "end": "10.3540,123.8910"},
    {"name": "Bulacao to Pardo Proper", "start": "10.2715,123.8565", "end": "10.2880,123.8650"},
    {"name": "Inayawan to Colon (South Link)", "start": "10.2701,123.8563", "end": "10.2965,123.9017"},
    {"name": "Labangon to Ayala (Route 12L)", "start": "10.3023,123.8821", "end": "10.3175,123.9066"},
    {"name": "Guadalupe to Capitol (Route 06)", "start": "10.3210,123.8710", "end": "10.3168,123.8931"},
    {"name": "Banawa to Jones Avenue", "start": "10.3110,123.8800", "end": "10.3100,123.8950"},
    {"name": "Pier 1 to Colon (Port Area)", "start": "10.2925,123.9089", "end": "10.2965,123.9017"},
    {"name": "Magallanes to Cebu Cathedral", "start": "10.2940,123.9020", "end": "10.2955,123.9050"},
    {"name": "Colon to SM Seaside (MYBus Link)", "start": "10.2965,123.9017", "end": "10.2818,123.8837"},
    {"name": "Mactan Bridge (Mandaue Side)", "start": "10.3239,123.9372", "end": "10.3117,123.9784"},
    {"name": "Parkmall to MEPZ 1", "start": "10.3255,123.9340", "end": "10.3160,123.9650"},
    {"name": "Tamiya (MEPZ 2) to Cordova", "start": "10.3010,123.9450", "end": "10.2506,123.9493"},
    {"name": "Airport to SM City Cebu", "start": "10.3075,123.9800", "end": "10.3111,123.9181"},
    {"name": "Mandaue Public Market to Banilad", "start": "10.3283,123.9416", "end": "10.3395,123.9110"}
]

# --- 2. BACKUP & CLOUD UTILS ---
def save_backup_to_cloud(filename, data):
    try:
        joblib.dump(data, filename)
        with open(filename, 'rb') as f:
            supabase.storage.from_('ai_models').upload(
                path=filename, file=f, file_options={"cache-control": "3600", "upsert": "true"}
            )
        print(f"☁️ [Backup] Uploaded {filename}.")
    except Exception as e:
        print(f"⚠️ [Backup] Upload Failed: {e}")

def load_backup_from_cloud(filename):
    try:
        print(f"☁️ [Backup] Downloading {filename}...")
        data = supabase.storage.from_('ai_models').download(filename)
        with open(filename, 'wb') as f: f.write(data)
        return joblib.load(filename)
    except Exception as e:
        print(f"❌ [Backup] Cloud Download Failed: {e}")
        return None

# --- 3. TRAFFIC ENGINE ---
def train_traffic_model():
    global TRAFFIC_MODEL
    try:
        resp = supabase.table('traffic_logs').select("day_of_week, hour_of_day, congestion_factor").execute()
        df = pd.DataFrame(resp.data)
        if not df.empty:
            X = df[['day_of_week', 'hour_of_day']]
            y = df['congestion_factor']
            model = RandomForestRegressor(n_estimators=50, random_state=42)
            model.fit(X, y)
            TRAFFIC_MODEL = model
            save_backup_to_cloud('traffic_ai.pkl', model)
            print("✅ [Traffic AI] Retrained.")
        else:
            print("❌ [Traffic AI] No data to train.")
    except Exception as e:
        print(f"❌ [Traffic AI] Error: {e}")

async def traffic_spy_worker():
    print("🕵️ [Traffic Spy] Online.")
    while True:
        try:
            for route in REFERENCE_ROUTES:
                url = f"https://api.tomtom.com/routing/1/calculateRoute/{route['start']}:{route['end']}/json?key={TOMTOM_KEY}&traffic=true"
                res = requests.get(url).json()
                if 'routes' in res:
                    summary = res['routes'][0]['summary']
                    factor = round(summary['travelTimeInSeconds'] / summary['noTrafficTravelTimeInSeconds'], 2)
                    now = datetime.datetime.now()
                    supabase.table('traffic_logs').insert({
                        "day_of_week": now.weekday(),
                        "hour_of_day": now.hour,
                        "route_name": route['name'],
                        "base_duration": summary['noTrafficTravelTimeInSeconds'],
                        "current_duration": summary['travelTimeInSeconds'],
                        "congestion_factor": factor
                    }).execute()
                await asyncio.sleep(0.2)
            train_traffic_model()
        except Exception as e:
            print(f"⚠️ [Traffic Spy] Error: {e}")
        await asyncio.sleep(1800)

async def queue_worker():
    print("👷 [Worker] Online.")
    while True:
        job = await JOB_QUEUE.get()
        job_id, user_id = job['job_id'], job['user_id']
        try:
            JOB_STATUS[job_id] = "processing"
            resp = supabase.table('properties').select("*").eq('user_id', user_id).execute()
            user_props = pd.DataFrame(resp.data)
            global PROPERTY_BRAIN
            if not user_props.empty:
                new_brain = PROPERTY_BRAIN.copy()
                if not new_brain.empty and 'user_id' in new_brain.columns:
                    new_brain = new_brain[new_brain['user_id'] != user_id]
                new_brain = pd.concat([new_brain, user_props], ignore_index=True)
                PROPERTY_BRAIN = new_brain
                save_backup_to_cloud('properties.pkl', PROPERTY_BRAIN)
            JOB_STATUS[job_id] = "completed"
        except:
            JOB_STATUS[job_id] = "failed"
        finally:
            JOB_QUEUE.task_done()

# --- LIFESPAN ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    global AMENITY_BRAIN, PROPERTY_BRAIN, TRAFFIC_MODEL
    print("🚀 Server starting up...")
    
    if os.path.exists('amenities.pkl'): AMENITY_BRAIN = joblib.load('amenities.pkl')
    else:
        cloud = load_backup_from_cloud('amenities.pkl')
        if cloud: AMENITY_BRAIN = cloud

    try:
        resp = supabase.table('properties').select("*").execute()
        PROPERTY_BRAIN = pd.DataFrame(resp.data)
        save_backup_to_cloud('properties.pkl', PROPERTY_BRAIN)
    except:
        cloud = load_backup_from_cloud('properties.pkl')
        if cloud is not None: PROPERTY_BRAIN = cloud

    cloud_traffic = load_backup_from_cloud('traffic_ai.pkl')
    if cloud_traffic: TRAFFIC_MODEL = cloud_traffic
    else: train_traffic_model()

    asyncio.create_task(queue_worker())
    asyncio.create_task(traffic_spy_worker())
    yield

app = FastAPI(lifespan=lifespan)
origins = ["http://localhost:5173", "https://verityph.space", "https://www.verityph.space"]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# --- ENDPOINTS ---
class QueueRequest(BaseModel):
    user_id: str

@app.post("/queue-update")
async def queue_update(req: QueueRequest):
    job_id = str(uuid.uuid4())
    await JOB_QUEUE.put({"job_id": job_id, "user_id": req.user_id})
    return {"job_id": job_id, "position": JOB_QUEUE.qsize()}

@app.get("/queue-status/{job_id}")
def check_status(job_id: str):
    return {"status": JOB_STATUS.get(job_id, "queuing")}

# NEW: Manual refresh endpoint if Supabase data changes
@app.post("/refresh-properties")
def refresh_properties():
    global PROPERTY_BRAIN
    try:
        resp = supabase.table('properties').select("*").execute()
        PROPERTY_BRAIN = pd.DataFrame(resp.data)
        save_backup_to_cloud('properties.pkl', PROPERTY_BRAIN)
        return {"status": "Properties Refreshed", "count": len(PROPERTY_BRAIN)}
    except Exception as e:
        return {"error": str(e)}

@app.post("/train-traffic")
def train_traffic():
    train_traffic_model()
    return {"status": "Retrained"}

class TrafficRequest(BaseModel):
    start_lat: float
    start_lng: float
    end_lat: float
    end_lng: float
    time_context: float = -1.0 

@app.post("/predict-traffic")
def predict_traffic(req: TrafficRequest):
    dist_km = geodesic((req.start_lat, req.start_lng), (req.end_lat, req.end_lng)).km
    base_minutes = (dist_km / 30) * 60 
    congestion = 1.0
    global TRAFFIC_MODEL
    if TRAFFIC_MODEL is None: train_traffic_model()
    if TRAFFIC_MODEL:
        target_day = datetime.datetime.now().weekday()
        target_hour = datetime.datetime.now().hour if req.time_context == -1 else req.time_context
        congestion = TRAFFIC_MODEL.predict(pd.DataFrame([[target_day, target_hour]], columns=['day_of_week', 'hour_of_day']))[0]
    
    predicted_minutes = base_minutes * congestion
    color = "#10b981"
    if congestion > 1.3: color = "#f59e0b"
    if congestion > 1.8: color = "#ef4444"
    return {"distance_km": round(dist_km, 1), "predicted_minutes": int(predicted_minutes), "color": color, "is_ai": (TRAFFIC_MODEL is not None)}

# --- INTELLIGENT MATCHING LOGIC ---

class UserPreference(BaseModel):
    filter_map_id: str | None = None  # <--- UPDATED: To handle filtering by Map ID
    personas: list[str]
    safety_priority: float
    health_priority: float
    education_priority: float
    lifestyle_priority: float

@app.post("/recommend")
def recommend(pref: UserPreference):
    if PROPERTY_BRAIN.empty: return {"matches": []}
    
    # --- FILTER BRAIN BY MAP ID ---
    active_brain = PROPERTY_BRAIN
    if pref.filter_map_id:
        if 'map_id' in active_brain.columns:
            active_brain = active_brain[active_brain['map_id'] == pref.filter_map_id]
        else:
            # Fallback for old data without map_id
            print("⚠️ Warning: 'map_id' column not found in Property Brain")
    
    if active_brain.empty: return {"matches": []}

    results = []
    
    # Use 'active_brain' (filtered) instead of global PROPERTY_BRAIN
    for _, row in active_brain.iterrows():
        scores, metadata = score_property(row['lat'], row['lng'], pref.personas)
        
        total = (
            (pref.safety_priority * scores.get('safety', 0)) +
            (pref.health_priority * scores.get('health', 0)) +
            (pref.education_priority * scores.get('education', 0)) +
            (pref.lifestyle_priority * scores.get('lifestyle', 0))
        )
        
        # FIX: Allow matches with score 0 if we are filtering by a specific map
        # This ensures isolated maps (Map 1) still return results for description generation
        if total > 0.1 or pref.filter_map_id:
            headline, body = generate_copy(pref.personas, metadata)
            results.append({
                "id": str(row['id']),
                "name": row['name'],
                "match_score": total,
                "headline": headline,
                "body": body,
                "highlights": [f"{v['type']} ({v['dist']}km)" for k,v in metadata.items()][:3]
            })
            
    results.sort(key=lambda x: x['match_score'], reverse=True)
    return {"matches": results[:10], "matched_ids": [r['id'] for r in results[:10]]}

def score_property(prop_lat, prop_lng, personas=[]):
    if not AMENITY_BRAIN: return {}, {}
    radius_rad = 3.0 / 6371.0 # Search within 3km
    indices = AMENITY_BRAIN["tree"].query_radius([[np.radians(prop_lat), np.radians(prop_lng)]], r=radius_rad)[0]
    
    if len(indices) == 0: return {}, {}
    nearby = AMENITY_BRAIN["data"].iloc[indices]
    
    scores = {cat: 0.0 for cat in CATEGORIES.keys()}
    metadata = {}
    
    for _, amen in nearby.iterrows():
        dist_km = geodesic((prop_lat, prop_lng), (amen['lat'], amen['lng'])).km
        impact = 1 / (dist_km + 0.5) 
        raw_text = str(amen['sub_category'] or amen['type'] or amen['name']).lower()
        
        found_category = None
        for cat, keywords in CATEGORIES.items():
            if any(k in raw_text for k in keywords):
                found_category = cat
                break
        
        if found_category:
            is_priority_match = False
            for p in personas:
                if p in PERSONA_BOOSTS and any(boost in raw_text for boost in PERSONA_BOOSTS[p]):
                    impact *= 3.0 
                    is_priority_match = True
            
            scores[found_category] += impact

            current_meta = metadata.get(found_category)
            should_update = False
            if not current_meta:
                should_update = True
            elif is_priority_match and not current_meta.get('priority'):
                should_update = True 
            elif is_priority_match == current_meta.get('priority', False) and dist_km < current_meta['dist']:
                should_update = True 

            if should_update:
                metadata[found_category] = {
                    'name': amen['name'], 
                    'type': amen['sub_category'] or amen['type'], 
                    'dist': round(dist_km, 2),
                    'priority': is_priority_match
                }

    return scores, metadata

def generate_copy(personas, metadata):
    grammar = tracery.Grammar(grammar_source)
    grammar.add_modifiers(base_english)
    
    # If no metadata (no amenities found), return safe default
    if not metadata:
        return "Great Location", "A perfectly connected home in a peaceful area."

    # Smart Copy Generation
    target = 'lifestyle' # Default
    if 'fitness' in personas and 'lifestyle' in metadata and metadata['lifestyle'].get('priority'): target = 'lifestyle'
    elif 'pets' in personas and 'health' in metadata and metadata['health'].get('priority'): target = 'health'
    elif 'student' in personas and 'education' in metadata: target = 'education'
    elif 'family' in personas and 'education' in metadata: target = 'education'
    elif 'safety' in personas and 'safety' in metadata: target = 'safety'
    elif 'health' in personas and 'health' in metadata: target = 'health'

    if target in metadata:
        info = metadata[target]
        return f"Near {str(info['type']).title()}", grammar.flatten(f"Enjoy easy access to {info['name']} #distance_adj#.")
    
    return "Great Location", "A perfectly connected home."

@app.post("/train-amenities")
def train_amenities():
    global AMENITY_BRAIN
    resp = supabase.table('amenities').select("*").execute()
    df = pd.DataFrame(resp.data)
    if df.empty: return {"error": "No data"}
    df['lat_rad'] = np.radians(df['lat'])
    df['lng_rad'] = np.radians(df['lng'])
    tree = BallTree(df[['lat_rad', 'lng_rad']], metric='haversine')
    brain = {"tree": tree, "data": df}
    AMENITY_BRAIN = brain
    save_backup_to_cloud('amenities.pkl', brain)
    return {"status": "Amenities Retrained"}