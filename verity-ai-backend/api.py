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

# Shared memory for background tasks
JOB_QUEUE = asyncio.Queue()
JOB_STATUS = {}

# Global AI "Brains"
AMENITY_BRAIN = None
PROPERTY_BRAIN = pd.DataFrame()
TRAFFIC_MODEL = None 

# --- UPDATED CATEGORIES MAPPING ---
# I have mapped your specific list into the 4 core pillars used by the scoring engine.
CATEGORIES = {
    'safety': [
        'police', 'fire station', 'barangay hall', 'station'
    ],
    'health': [
        'hospital', 'clinic', 'pharmacy', 'drugstore', 'dental', 'diagnostic', 
        'laboratory', 'bloodbank', 'vet', 'gym' 
    ],
    'education': [
        'school', 'college', 'university', 'k-12', 'library', 'education'
    ],
    'lifestyle': [
        'mall', 'supermarket', 'market', 'convenience store', 'grocery', 
        'restaurant', 'cafe', 'bank', 'atm', 'hardware', 'laundry', 
        'water refilling', 'gas station', 'church', 'chapel'
    ]
}

grammar_source = {
    "opener": ["Forget the traffic.", "The smart move.", "Living made easy."],
    "distance_adj": ["steps away", "just around the corner", "nearby"],
    "default_headline": "Prime Location",
    "default_body": "Ideally situated with {name} #distance_adj#."
}

# Traffic Sensors (Representative Cebu Arteries)
REFERENCE_ROUTES = [
    {"name": "IT Park to Ayala", "start": "10.3296,123.9056", "end": "10.3175,123.9066"},
    {"name": "Mactan Bridge", "start": "10.3239,123.9372", "end": "10.3117,123.9784"},
    {"name": "Osmena Blvd", "start": "10.3168,123.8931", "end": "10.2974,123.9015"}
]

# --- 2. CLOUD BACKUP & SNAPSHOTS ---

def save_backup_to_cloud(filename, data):
    """Saves to disk and syncs to Supabase Storage."""
    try:
        joblib.dump(data, filename)
        with open(filename, 'rb') as f:
            supabase.storage.from_('ai_models').upload(
                path=filename, 
                file=f, 
                file_options={"cache-control": "3600", "upsert": "true"}
            )
        print(f"☁️ [Backup] Uploaded {filename} to Supabase.")
    except Exception as e:
        print(f"⚠️ [Backup] Upload Failed: {e}")

def load_backup_from_cloud(filename):
    """Retrieves trained models from cloud if local is missing."""
    try:
        print(f"☁️ [Backup] Downloading {filename}...")
        data = supabase.storage.from_('ai_models').download(filename)
        with open(filename, 'wb') as f:
            f.write(data)
        return joblib.load(filename)
    except Exception as e:
        print(f"❌ [Backup] Cloud Download Failed: {e}")
        return None

# --- 3. TRAFFIC AI ENGINE ---

def train_traffic_model():
    """Converts traffic_logs into a RandomForest brain."""
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
            print("✅ [Traffic AI] Retrained & Saved.")
        else:
            print("❌ [Traffic AI] Training failed: Table is empty.")
    except Exception as e:
        print(f"❌ [Traffic AI] Error: {e}")

async def traffic_spy_worker():
    """Sips TomTom data every 30 mins to update historical patterns."""
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
            train_traffic_model()
        except Exception as e:
            print(f"⚠️ [Traffic Spy] Error: {e}")
        await asyncio.sleep(1800)

# --- 4. LIFESTYLE BACKGROUND WORKER ---

async def queue_worker():
    """Processes property training jobs from the queue"""
    print("👷 [Worker] Online. Waiting for jobs...")
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
        except Exception as e:
            print(f"❌ [Worker] Job {job_id} failed: {e}")
            JOB_STATUS[job_id] = "failed"
        finally:
            JOB_QUEUE.task_done()

# --- 5. SERVER LIFESPAN (Startup/Shutdown) ---

@asynccontextmanager
async def lifespan(app: FastAPI):
    global AMENITY_BRAIN, PROPERTY_BRAIN, TRAFFIC_MODEL
    print("🚀 Server starting up...")

    # Load Lifestyle Data
    if os.path.exists('amenities.pkl'):
        AMENITY_BRAIN = joblib.load('amenities.pkl')
    else:
        cloud_amenities = load_backup_from_cloud('amenities.pkl')
        if cloud_amenities: AMENITY_BRAIN = cloud_amenities

    try:
        resp = supabase.table('properties').select("*").execute()
        PROPERTY_BRAIN = pd.DataFrame(resp.data)
        save_backup_to_cloud('properties.pkl', PROPERTY_BRAIN)
    except:
        cloud_props = load_backup_from_cloud('properties.pkl')
        if cloud_props is not None: PROPERTY_BRAIN = cloud_props

    # Load Traffic Brain
    print("🚦 [Traffic AI] Loading...")
    cloud_traffic = load_backup_from_cloud('traffic_ai.pkl')
    if cloud_traffic:
        TRAFFIC_MODEL = cloud_traffic
        print("✅ [Traffic AI] Loaded.")
    else:
        train_traffic_model()

    # Start Workers
    asyncio.create_task(queue_worker())
    asyncio.create_task(traffic_spy_worker())
    yield

app = FastAPI(lifespan=lifespan)

origins = ["http://localhost:5173", "https://verityph.space", "https://www.verityph.space"]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# --- 6. ENDPOINTS ---

class QueueRequest(BaseModel):
    user_id: str

@app.post("/queue-update")
async def queue_update(req: QueueRequest):
    """Adds a job to the queue for the Smart Update button"""
    job_id = str(uuid.uuid4())
    await JOB_QUEUE.put({"job_id": job_id, "user_id": req.user_id})
    return {
        "job_id": job_id, 
        "position": JOB_QUEUE.qsize(), 
        "estimated_wait": JOB_QUEUE.qsize() * 5
    }

@app.get("/queue-status/{job_id}")
def check_status(job_id: str):
    """Checks the status of a specific job ID"""
    status = JOB_STATUS.get(job_id, "queuing")
    return {"status": status}

@app.post("/train-traffic")
def train_traffic():
    train_traffic_model()
    return {"status": "Traffic AI Retrained"}

class TrafficRequest(BaseModel):
    start_lat: float
    start_lng: float
    end_lat: float
    end_lng: float
    time_context: float = -1.0 

@app.post("/predict-traffic")
def predict_traffic(req: TrafficRequest):
    """Predicts travel time and color using the AI brain."""
    dist_km = geodesic((req.start_lat, req.start_lng), (req.end_lat, req.end_lng)).km
    base_minutes = (dist_km / 30) * 60 
    congestion = 1.0
    
    if TRAFFIC_MODEL:
        target_day = datetime.datetime.now().weekday()
        target_hour = datetime.datetime.now().hour if req.time_context == -1 else req.time_context
        
        # Wrapped in DataFrame to match trained feature names
        input_df = pd.DataFrame([[target_day, target_hour]], columns=['day_of_week', 'hour_of_day'])
        congestion = TRAFFIC_MODEL.predict(input_df)[0]
    
    predicted_minutes = base_minutes * congestion
    color = "#10b981"
    if congestion > 1.3: color = "#f59e0b"
    if congestion > 1.8: color = "#ef4444"

    return {
        "distance_km": round(dist_km, 1),
        "predicted_minutes": int(predicted_minutes),
        "delay_minutes": int(max(0, predicted_minutes - base_minutes)),
        "color": color,
        "is_ai": True
    }

class UserPreference(BaseModel):
    personas: list[str]
    safety_priority: float
    health_priority: float
    education_priority: float
    lifestyle_priority: float

@app.post("/recommend")
def recommend(pref: UserPreference):
    if PROPERTY_BRAIN.empty: return {"matches": []}
    results = []
    for _, row in PROPERTY_BRAIN.iterrows():
        scores, metadata = score_property(row['lat'], row['lng'])
        total = (
            (pref.safety_priority * scores.get('safety', 0)) +
            (pref.health_priority * scores.get('health', 0)) +
            (pref.education_priority * scores.get('education', 0)) +
            (pref.lifestyle_priority * scores.get('lifestyle', 0))
        )
        if total > 0.1:
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

def score_property(prop_lat, prop_lng):
    if not AMENITY_BRAIN: return {}, {}
    radius_rad = 2.0 / 6371.0
    indices = AMENITY_BRAIN["tree"].query_radius([[np.radians(prop_lat), np.radians(prop_lng)]], r=radius_rad)[0]
    if len(indices) == 0: return {}, {}
    nearby = AMENITY_BRAIN["data"].iloc[indices]
    scores = {cat: 0.0 for cat in CATEGORIES.keys()}
    metadata = {}
    for _, amen in nearby.iterrows():
        dist_km = geodesic((prop_lat, prop_lng), (amen['lat'], amen['lng'])).km
        impact = 1 / (dist_km + 0.5)
        text = str(amen['sub_category'] or amen['type'] or amen['name']).lower()
        for cat, keywords in CATEGORIES.items():
            if any(k in text for k in keywords):
                scores[cat] += impact
                if cat not in metadata or dist_km < metadata[cat]['dist']:
                    metadata[cat] = {'name': amen['name'], 'type': amen['sub_category'], 'dist': round(dist_km, 2)}
    return scores, metadata

def generate_copy(personas, metadata):
    grammar = tracery.Grammar(grammar_source)
    grammar.add_modifiers(base_english)
    target = 'lifestyle'
    if 'student' in personas: target = 'education'
    elif 'health' in personas: target = 'health'
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