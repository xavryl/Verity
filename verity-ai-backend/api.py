import os
import pandas as pd
import numpy as np
from supabase import create_client
from geopy.distance import geodesic
from sklearn.neighbors import NearestNeighbors
import joblib
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# 1. SETUP
load_dotenv()
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
supabase = create_client(url, key)

# 2. CONFIGURATION
CATEGORIES = {
    'safety': ['police', 'fire', 'barangay', 'station'],
    'health': ['hospital', 'clinic', 'pharmacy', 'vet', 'dental', 'health'],
    'education': ['school', 'college', 'university', 'k-12', 'campus'],
    'lifestyle': ['gym', 'mall', 'market', 'park', 'cafe', 'shop', 'store']
}

ai_brain = {}

def load_model():
    global ai_brain
    try:
        if os.path.exists('verity_model.pkl'):
            ai_brain = joblib.load('verity_model.pkl')
            print("✅ Brain loaded.")
        else:
            print("⚠️ No brain found. Auto-training now...")
            train_brain()
    except Exception as e:
        print(f"❌ Error loading brain: {e}")

# --- IMPROVED TRAINER ---
def train_brain():
    global ai_brain
    print("\n🔄 RETRAINING STARTED...")
    
    # 1. Fetch Data
    try:
        props = supabase.table('properties').select("*").execute()
        amens = supabase.table('amenities').select("*").execute()
    except Exception as e:
        print(f"❌ Supabase Connection Error: {e}")
        return False

    properties = pd.DataFrame(props.data)
    amenities = pd.DataFrame(amens.data)

    if properties.empty:
        print("❌ No properties found in database.")
        return False
    
    print(f"   > Loaded {len(properties)} properties and {len(amenities)} amenities.")
    
    # DEBUG: Check columns
    print(f"   > Amenity Columns found: {list(amenities.columns)}")

    # 2. Calculate Vectors (RAW SCORES)
    def calculate_vector(prop_row):
        scores = {cat: 0.0 for cat in CATEGORIES.keys()}
        
        for _, amen in amenities.iterrows():
            try:
                # Validate coordinates
                if pd.isna(prop_row.get('lat')) or pd.isna(amen.get('lat')): continue
                
                prop_loc = (prop_row['lat'], prop_row['lng'])
                amen_loc = (amen['lat'], amen['lng'])
                dist = geodesic(prop_loc, amen_loc).km
                
                # RADIUS: 5km
                if dist > 5.0: continue
                
                # SCORING: Closer = Higher
                # 0.1km = 1.6 points | 5.0km = 0.18 points
                impact = 1 / (dist + 0.5)
                
                # TEXT MATCHING (Robust)
                # We combine all useful text columns to ensure we catch the keyword
                text_parts = [
                    str(amen.get('sub_category', '')),
                    str(amen.get('type', '')),
                    str(amen.get('name', ''))
                ]
                text = " ".join(text_parts).lower()
                
                for cat, keywords in CATEGORIES.items():
                    if any(k in text for k in keywords):
                        scores[cat] += impact
            except Exception as e:
                continue
        
        return pd.Series(scores)

    feature_matrix = properties.apply(calculate_vector, axis=1)

    # DEBUG: Show non-zero scores to prove it worked
    print("\n   > Sample Scores (Top 3):")
    print(feature_matrix.head(3))

    # 3. Train Model (NO SCALER - We use raw scores now)
    # This prevents the "fake 100%" issue
    model = NearestNeighbors(n_neighbors=1, algorithm='brute', metric='euclidean')
    model.fit(feature_matrix)

    new_brain = {
        'model': model,
        'property_ids': properties['id'].values,
        'property_names': properties['name'].values,
        'feature_data': feature_matrix # Save raw scores
    }
    
    joblib.dump(new_brain, 'verity_model.pkl')
    ai_brain = new_brain
    print("✅ RETRAINING COMPLETE.\n")
    return True

@app.on_event("startup")
async def startup_event():
    load_model()

@app.get("/")
def home():
    return {"status": "Online", "brain_loaded": bool(ai_brain)}

@app.post("/retrain")
def trigger_retrain(background_tasks: BackgroundTasks):
    background_tasks.add_task(train_brain)
    return {"message": "Training started. Check terminal logs for DEBUG info."}

class UserPreference(BaseModel):
    safety_priority: float
    health_priority: float
    education_priority: float
    lifestyle_priority: float

@app.post("/recommend")
def recommend(pref: UserPreference):
    if not ai_brain:
        raise HTTPException(status_code=503, detail="AI is training")

    # User wants this vector (High numbers since we removed scaler)
    # We multiply by 5.0 to match the raw score magnitude
    user_vector = np.array([[
        pref.safety_priority * 5.0,
        pref.health_priority * 5.0,
        pref.education_priority * 5.0,
        pref.lifestyle_priority * 5.0
    ]])
    
    distances, indices = ai_brain['model'].kneighbors(user_vector, n_neighbors=1)
    
    idx = indices[0][0]
    best_id = ai_brain['property_ids'][idx]
    best_name = ai_brain['property_names'][idx]
    
    # Generate Explanation & Percentage
    scores = ai_brain['feature_data'].iloc[idx]
    
    # Calculate True Match % based on the requested category
    # If user asked for Safety, we check Safety score.
    max_requested = max(pref.safety_priority, pref.health_priority, pref.education_priority, pref.lifestyle_priority)
    relevant_score = 0.0
    
    reasons = []
    if pref.safety_priority > 0: 
        relevant_score += scores['safety']
        if scores['safety'] > 0.5: reasons.append("Safety")
    if pref.lifestyle_priority > 0: 
        relevant_score += scores['lifestyle']
        if scores['lifestyle'] > 0.5: reasons.append("Lifestyle")
    if pref.education_priority > 0: 
        relevant_score += scores['education']
        if scores['education'] > 0.5: reasons.append("Education")
    if pref.health_priority > 0: 
        relevant_score += scores['health']
        if scores['health'] > 0.5: reasons.append("Healthcare")

    # Logic: If Score > 2.0 (approx 2 amenities nearby), it's a 100% match
    match_percentage = min(relevant_score / 2.0, 1.0)
    
    if len(reasons) == 0:
        explanation = "Best available match, though amenities are distant."
    else:
        explanation = f"Great match for {', '.join(reasons)}."

    return {
        "property_id": best_id,
        "property_name": best_name,
        "match_score": match_percentage, # Returns 0.0 to 1.0
        "ai_explanation": explanation
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)