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
import random

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

CATEGORIES = {
    'safety': ['police', 'fire', 'barangay', 'station', 'security'],
    'health': ['hospital', 'clinic', 'pharmacy', 'vet', 'dental'],
    'education': ['school', 'college', 'university', 'k-12'],
    'lifestyle': ['gym', 'mall', 'market', 'park', 'cafe', 'restaurant']
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

def train_brain():
    global ai_brain
    print("\n🔄 RETRAINING STARTED...")
    try:
        props = supabase.table('properties').select("*").execute()
        amens = supabase.table('amenities').select("*").execute()
    except Exception: return False

    properties = pd.DataFrame(props.data)
    amenities = pd.DataFrame(amens.data)
    if properties.empty: return False

    feature_rows = []
    metadata_list = []

    for _, prop_row in properties.iterrows():
        scores = {cat: 0.0 for cat in CATEGORIES.keys()}
        nearest_info = {cat: None for cat in CATEGORIES.keys()} 
        prop_loc = (prop_row['lat'], prop_row['lng'])

        for _, amen in amenities.iterrows():
            try:
                if pd.isna(prop_row.get('lat')) or pd.isna(amen.get('lat')): continue
                amen_loc = (amen['lat'], amen['lng'])
                dist = geodesic(prop_loc, amen_loc).km
                if dist > 8.0: continue # Search wide for context
                
                impact = 1 / (dist + 0.5)
                text = " ".join([str(amen.get(c, '')) for c in ['sub_category', 'type', 'name']]).lower()
                
                for cat, keywords in CATEGORIES.items():
                    if any(k in text for k in keywords):
                        scores[cat] += impact
                        current_best = nearest_info[cat]
                        if current_best is None or dist < current_best['dist']:
                            name = amen.get('name') or amen.get('sub_category') or "Facility"
                            nearest_info[cat] = {'name': name, 'dist': dist}
            except: continue
        
        feature_rows.append(pd.Series(scores))
        metadata_list.append(nearest_info)

    feature_matrix = pd.DataFrame(feature_rows)
    model = NearestNeighbors(n_neighbors=1, algorithm='brute', metric='euclidean')
    model.fit(feature_matrix)

    new_brain = {
        'model': model,
        'ids': properties['id'].values,
        'names': properties['name'].values,
        'features': feature_matrix,
        'metadata': metadata_list
    }
    
    joblib.dump(new_brain, 'verity_model.pkl')
    ai_brain = new_brain
    print("✅ RETRAINING COMPLETE.")
    return True

@app.on_event("startup")
async def startup_event():
    load_model()

@app.post("/retrain")
def trigger_retrain(background_tasks: BackgroundTasks):
    background_tasks.add_task(train_brain)
    return {"message": "Training started."}

class UserPreference(BaseModel):
    persona: str # 'family', 'pets', 'retirement', 'fitness', 'investor'
    # We keep these for vector math, but use persona for text generation
    safety_priority: float
    health_priority: float
    education_priority: float
    lifestyle_priority: float

# --- THE PERSUASION ENGINE ---
def generate_persuasive_copy(persona, data):
    # This function acts like a Copywriter
    headline = "Great Match"
    body = "This property fits your criteria."
    
    # 1. RETIREMENT PERSONA (Values Peace + Health)
    if persona == 'retirement':
        lifestyle_dist = data['lifestyle']['dist'] if data['lifestyle'] else 10.0
        health_dist = data['health']['dist'] if data['health'] else 10.0
        
        if lifestyle_dist > 2.0:
            headline = "Peaceful & Secluded"
            body = "Perfect for retirement—this property is tucked away from the noise and chaos of the city center, offering a quiet, slower pace of life."
        else:
            headline = "Convenient Retirement"
            body = "Enjoy your golden years with total convenience—everything you need is just a short walk away."
            
        if health_dist < 3.0:
            body += f" Plus, for peace of mind, {data['health']['name']} is just a short drive away."

    # 2. FAMILY PERSONA (Values Schools + Safety)
    elif persona == 'family':
        school_dist = data['education']['dist'] if data['education'] else 10.0
        
        if school_dist < 1.0:
            headline = "Walk to School"
            body = f"Imagine saving hours in daily traffic. {data['education']['name']} is close enough for your kids to walk, giving you more quality family time."
        elif school_dist < 3.0:
            headline = "Family-Friendly Zone"
            body = "A secure, family-oriented neighborhood with reputable schools just a quick school-bus ride away."
        else:
            headline = "Spacious Family Living"
            body = "A quiet, safe environment perfect for raising children, away from the crowded downtown areas."

    # 3. PETS PERSONA (Values Vets/Open Space)
    elif persona == 'pets':
        health_dist = data['health']['dist'] if data['health'] else 10.0
        # Assuming 'health' captures Vets based on our keywords
        
        if health_dist < 2.0:
            headline = "Pet-Lover's Haven"
            body = f"Ideal for fur-parents! You have easy access to veterinary care at {data['health']['name']}, ensuring your pets are always safe."
        else:
            headline = "Open Spaces for Pets"
            body = "This location offers the breathing room your pets need to run and play, far from the cramped congestion of the city."

    # 4. FITNESS/LIFESTYLE PERSONA (Values Gyms/Malls)
    elif persona == 'fitness' or persona == 'convenience':
        life_dist = data['lifestyle']['dist'] if data['lifestyle'] else 10.0
        
        if life_dist < 1.0:
            headline = "Active Lifestyle Ready"
            body = f"Stay consistent with your goals! {data['lifestyle']['name']} is right at your doorstep, making it easy to hit the gym or grab a healthy meal."
        else:
            headline = "Private Wellness Sanctuary"
            body = "Your own private escape. Perfect for setting up a home gym and focusing on wellness without the distractions of a busy commercial district."

    return headline, body

@app.post("/recommend")
def recommend(pref: UserPreference):
    if not ai_brain: raise HTTPException(status_code=503, detail="Training")

    # 1. Find Property (Math)
    user_vector = np.array([[
        pref.safety_priority * 5.0,
        pref.health_priority * 5.0,
        pref.education_priority * 5.0,
        pref.lifestyle_priority * 5.0
    ]])
    
    distances, indices = ai_brain['model'].kneighbors(user_vector, n_neighbors=1)
    idx = indices[0][0]
    nearest_data = ai_brain['metadata'][idx]
    
    # 2. Generate Text (Persuasion)
    headline, body = generate_persuasive_copy(pref.persona, nearest_data)

    return {
        "property_id": ai_brain['ids'][idx],
        "property_name": ai_brain['names'][idx],
        "ai_headline": headline,
        "ai_body": body,
        # We still send the nearest items for the list, but no percentages
        "nearest_highlights": build_highlights(nearest_data)
    }

def build_highlights(data):
    # Simplified list
    items = []
    for cat, info in data.items():
        if info and info['dist'] < 3.0: # Only show things that are actually close
             items.append(f"{info['name']} ({info['dist']:.1f}km)")
    return items[:3] # Limit to top 3

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)