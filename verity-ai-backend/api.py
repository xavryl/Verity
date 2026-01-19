import os
import pandas as pd
import numpy as np
from supabase import create_client
from geopy.distance import geodesic
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import MinMaxScaler
import joblib
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# 1. SETUP & CONFIG
load_dotenv()
app = FastAPI()

# Enable CORS for your React App
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database Connection
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
supabase = create_client(url, key)

# Categories Configuration
CATEGORIES = {
    'safety': ['police', 'fire', 'barangay'],
    'health': ['hospital', 'clinic', 'pharmacy', 'vet'],
    'education': ['school', 'college', 'university', 'k-12'],
    'lifestyle': ['gym', 'mall', 'market', 'park', 'cafe']
}

# Global Variable to hold the brain in memory
ai_brain = {}

# --- HELPER: Load Model on Startup ---
def load_model():
    global ai_brain
    try:
        if os.path.exists('verity_model.pkl'):
            ai_brain = joblib.load('verity_model.pkl')
            print("✅ Brain loaded from disk.")
        else:
            print("⚠️ No brain found on disk. Training required.")
            train_brain() # Auto-train if missing
    except Exception as e:
        print(f"❌ Error loading brain: {e}")

# --- CORE LOGIC: The Training Function ---
def train_brain():
    global ai_brain
    print("🔄 STARTING RETRAINING PROCESS...")
    
    # 1. Fetch Data
    props = supabase.table('properties').select("*").execute()
    amens = supabase.table('amenities').select("*").execute()
    
    properties = pd.DataFrame(props.data)
    amenities = pd.DataFrame(amens.data)
    
    if len(properties) == 0:
        print("❌ No properties to train on.")
        return False

    # 2. Calculate Vectors (The Math)
    def calculate_vector(prop_row):
        scores = {cat: 0.0 for cat in CATEGORIES.keys()}
        for _, amen in amenities.iterrows():
            try:
                # Coordinate Check
                if pd.isna(prop_row['lat']) or pd.isna(amen['lat']): continue
                
                prop_loc = (prop_row['lat'], prop_row['lng'])
                amen_loc = (amen['lat'], amen['lng'])
                dist = geodesic(prop_loc, amen_loc).km
                
                if dist > 3.0: continue
                
                impact = 1 / (dist + 0.5)
                text = (str(amen.get('sub_category', '')) + " " + str(amen.get('type', ''))).lower()
                
                for cat, keywords in CATEGORIES.items():
                    if any(k in text for k in keywords):
                        scores[cat] += impact
            except:
                continue
        return pd.Series(scores)

    feature_matrix = properties.apply(calculate_vector, axis=1)

    # 3. Normalize & Fit
    scaler = MinMaxScaler()
    norm_features = scaler.fit_transform(feature_matrix)
    feature_df = pd.DataFrame(norm_features, columns=CATEGORIES.keys())

    model = NearestNeighbors(n_neighbors=1, algorithm='brute', metric='euclidean')
    model.fit(norm_features)

    # 4. Save to Memory & Disk
    new_brain = {
        'model': model,
        'scaler': scaler,
        'property_ids': properties['id'].values,
        'property_names': properties['name'].values,
        'feature_data': feature_df
    }
    
    joblib.dump(new_brain, 'verity_model.pkl')
    ai_brain = new_brain
    print("✅ RETRAINING COMPLETE.")
    return True

# --- API ROUTES ---

@app.on_event("startup")
async def startup_event():
    load_model()

@app.get("/")
def home():
    status = "Online" if ai_brain else "Offline (Needs Training)"
    return {"status": status}

@app.post("/retrain")
def trigger_retrain(background_tasks: BackgroundTasks):
    """
    Call this endpoint whenever you add new properties.
    It runs in the background so your API doesn't freeze.
    """
    background_tasks.add_task(train_brain)
    return {"message": "Training started in background. Check back in 10 seconds."}

class UserPreference(BaseModel):
    safety_priority: float
    health_priority: float
    education_priority: float
    lifestyle_priority: float

@app.post("/recommend")
def recommend(pref: UserPreference):
    if not ai_brain:
        raise HTTPException(status_code=503, detail="AI is training, please wait.")

    user_vector = np.array([[
        pref.safety_priority,
        pref.health_priority,
        pref.education_priority,
        pref.lifestyle_priority
    ]])
    
    # Run Inference
    distances, indices = ai_brain['model'].kneighbors(user_vector, n_neighbors=1)
    
    idx = indices[0][0]
    best_id = ai_brain['property_ids'][idx]
    best_name = ai_brain['property_names'][idx]
    
    # Generate Explanation
    scores = ai_brain['feature_data'].iloc[idx]
    reasons = []
    if scores['safety'] > 0.3: reasons.append("Safety")
    if scores['lifestyle'] > 0.3: reasons.append("Lifestyle")
    if scores['education'] > 0.3: reasons.append("Schools")
    if scores['health'] > 0.3: reasons.append("Healthcare")
    
    explanation = f"Recommended based on high scores in: {', '.join(reasons)}"

    return {
        "property_id": best_id,
        "property_name": best_name,
        "match_score": float(1 / (1 + distances[0][0])),
        "ai_explanation": explanation
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)