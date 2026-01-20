import os
import pandas as pd
import numpy as np
import joblib
import asyncio
import uuid
from contextlib import asynccontextmanager
from supabase import create_client
from sklearn.neighbors import BallTree
from geopy.distance import geodesic
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import tracery
from tracery.modifiers import base_english

load_dotenv()

# --- 1. GLOBAL STATE & QUEUE ---
JOB_QUEUE = asyncio.Queue()       # The Waiting Line
JOB_STATUS = {}                   # Tracks tickets

AMENITY_BRAIN = None              # Static Data (Hospitals, etc.)
PROPERTY_BRAIN = pd.DataFrame()   # Dynamic Data (User Properties)

supabase = create_client(os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_KEY"))

CATEGORIES = {
    'safety': ['police', 'fire', 'barangay', 'station'],
    'health': ['hospital', 'clinic', 'pharmacy', 'vet'],
    'education': ['school', 'college', 'university', 'campus'],
    'lifestyle': ['gym', 'mall', 'market', 'park', 'cafe']
}

grammar_source = {
    "opener": ["Forget the traffic.", "The smart move.", "Living made easy."],
    "distance_adj": ["steps away", "just around the corner", "nearby"],
    "default_headline": "Prime Location",
    "default_body": "Ideally situated with {name} #distance_adj#."
}

# --- 2. THE BACKGROUND WORKER ---
async def queue_worker():
    print("👷 [Worker] Online. Waiting for jobs...")
    while True:
        job = await JOB_QUEUE.get()
        job_id, user_id = job['job_id'], job['user_id']
        
        try:
            JOB_STATUS[job_id] = "processing"
            print(f"⚙️ [Worker] Processing User: {user_id}...")
            
            # A. Fetch ONLY this user's properties
            resp = supabase.table('properties').select("*").eq('user_id', user_id).execute()
            user_props = pd.DataFrame(resp.data)
            
            # B. Atomic Update (The Swap)
            global PROPERTY_BRAIN
            if not user_props.empty:
                new_brain = PROPERTY_BRAIN.copy()
                
                # Remove this user's old data to avoid duplicates
                if not new_brain.empty and 'user_id' in new_brain.columns:
                    new_brain = new_brain[new_brain['user_id'] != user_id]
                
                # Add new data
                new_brain = pd.concat([new_brain, user_props], ignore_index=True)
                
                # SWAP
                PROPERTY_BRAIN = new_brain
                joblib.dump(PROPERTY_BRAIN, 'properties.pkl')
                
            JOB_STATUS[job_id] = "completed"
            print(f"✅ [Worker] Done. Brain Size: {len(PROPERTY_BRAIN)}")
            
        except Exception as e:
            print(f"❌ [Worker] Failed: {e}")
            JOB_STATUS[job_id] = "failed"
        finally:
            JOB_QUEUE.task_done()

# --- 3. LIFESPAN MANAGER ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load Brains on Startup
    global AMENITY_BRAIN, PROPERTY_BRAIN
    if os.path.exists('amenities.pkl'): AMENITY_BRAIN = joblib.load('amenities.pkl')
    if os.path.exists('properties.pkl'): PROPERTY_BRAIN = joblib.load('properties.pkl')
    
    # Start Worker
    asyncio.create_task(queue_worker())
    yield

app = FastAPI(lifespan=lifespan)

# Allow your specific frontend URLs
origins = ["http://localhost:5173", "https://verityph.space", "https://www.verityph.space"]
app.add_middleware(
    CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"]
)

# --- 4. ENDPOINTS ---

@app.post("/train-amenities")
def train_amenities():
    """One-time setup for static amenities."""
    global AMENITY_BRAIN
    resp = supabase.table('amenities').select("*").execute()
    df = pd.DataFrame(resp.data)
    if df.empty: return {"error": "No data"}
    
    df['lat_rad'] = np.radians(df['lat'])
    df['lng_rad'] = np.radians(df['lng'])
    tree = BallTree(df[['lat_rad', 'lng_rad']], metric='haversine')
    
    brain = {"tree": tree, "data": df}
    joblib.dump(brain, 'amenities.pkl')
    AMENITY_BRAIN = brain
    return {"status": "Amenities Retrained"}

class QueueRequest(BaseModel):
    user_id: str

@app.post("/queue-update")
async def queue_update(req: QueueRequest):
    """Adds user to the line."""
    job_id = str(uuid.uuid4())
    await JOB_QUEUE.put({"job_id": job_id, "user_id": req.user_id})
    position = JOB_QUEUE.qsize()
    return {"job_id": job_id, "position": position, "estimated_wait": position * 2}

@app.get("/queue-status/{job_id}")
def check_status(job_id: str):
    status = JOB_STATUS.get(job_id, "unknown")
    if status == "completed": del JOB_STATUS[job_id]
    return {"status": status}

class UserPreference(BaseModel):
    personas: list[str]
    safety_priority: float
    health_priority: float
    education_priority: float
    lifestyle_priority: float

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