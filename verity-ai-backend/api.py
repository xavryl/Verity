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

# --- NEW IMPORTS ---
import tracery
from tracery.modifiers import base_english

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
    'safety': ['police', 'fire', 'barangay', 'station', 'security', 'outpost'],
    'health': ['hospital', 'clinic', 'pharmacy', 'vet', 'dental', 'medical'],
    'education': ['school', 'college', 'university', 'k-12', 'campus', 'institute'],
    'lifestyle': ['gym', 'mall', 'market', 'park', 'cafe', 'restaurant', 'shop']
}

ai_brain = {}

# --- TRACERY GRAMMAR (The Sentence Machine) ---
# This defines the "LEGO bricks" the AI uses to build sentences.
grammar_source = {
    # 1. BUILDING BLOCKS
    "opener": [
        "Forget the morning rush.",
        "Ditch the daily commute.",
        "Why waste time in traffic?",
        "The smartest move you can make?",
        "Imagine living this close to everything."
    ],
    "distance_adj": [
        "practically next door",
        "just a stone's throw away",
        "right around the corner",
        "literally steps away",
        "just a quick walk away"
    ],
    "benefit_student": [
        "you can sleep in way longer",
        "you never have to be late again",
        "you save hours every week",
        "more time for studying (or sleeping)"
    ],
    "benefit_fitness": [
        "hitting your goals is effortless",
        "you'll never skip leg day again",
        "wellness becomes part of your routine",
        "it's easier than ever to stay active"
    ],
    "benefit_general": [
        "life just gets easier",
        "you save precious time",
        "everything you need is within reach",
        "daily errands become a breeze"
    ],
    "connector": ["which means", "so", "giving you", "meaning"],
    
    # 2. COMBO TEMPLATES (When 2 items win)
    "combo_headline": ["The Perfect Duo", "Double the Value", "Unmatched Convenience", "Connected Living", "Power Couple"],
    "combo_body": [
        "Enjoy the best of both worlds. You have easy access to {name1} while keeping {name2} #distance_adj#.",
        "Why compromise? This property places you minutes away from both {name1} and {name2}.",
        "Ideally positioned between {name1} and {name2}, #connector# #benefit_general#.",
        "The ultimate balance: {name1} for your needs, and {name2} for your lifestyle."
    ],

    # 3. SPECIFIC PERSONA TEMPLATES
    "student_headline": ["Walk to Class", "Campus Life", "Student Haven", "The Ultimate Hack"],
    "student_body": "#opener# {name} is #distance_adj#, #connector# #benefit_student#.",

    "fitness_headline": ["Active Lifestyle", "Gym-Goer's Dream", "Wellness Central"],
    "fitness_body": "No more excuses. {name} is #distance_adj#, #connector# #benefit_fitness#.",

    "pets_headline": ["Pet-Lover's Haven", "Fur-Baby Approved", "Paws & Play"],
    "pets_body": "Your furry friend will love this. {name} is #distance_adj#, ensuring emergency care is instant.",
    
    "family_headline": ["Family First", "Safe & Secure", "Room to Grow"],
    "family_body": "A perfect environment for your family. {name} is #distance_adj#, keeping your loved ones close.",
    
    # Default Fallback
    "default_headline": "Great Location",
    "default_body": "This property is situated in a prime area, with {name} #distance_adj#."
}

# --- LOGIC & GENERATOR ---

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
                if dist > 8.0: continue
                
                impact = 1 / (dist + 0.5)
                text = " ".join([str(amen.get(c, '')) for c in ['sub_category', 'type', 'name']]).lower()
                
                for cat, keywords in CATEGORIES.items():
                    if any(k in text for k in keywords):
                        scores[cat] += impact
                        current_best = nearest_info[cat]
                        if current_best is None or dist < current_best['dist']:
                            type_name = str(amen.get('sub_category') or amen.get('type') or "Facility").title()
                            specific_name = str(amen.get('name') or "Unnamed").title()
                            nearest_info[cat] = {'type': type_name, 'specific_name': specific_name, 'dist': dist}
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
    personas: list[str]
    safety_priority: float
    health_priority: float
    education_priority: float
    lifestyle_priority: float

# --- THE PERSUASION ENGINE (TRACERY EDITION) ---
def generate_persuasive_copy(personas, data):
    category_map = {
        'student': 'education', 'family': 'education',
        'pets': 'health', 'retirement': 'health',     
        'fitness': 'lifestyle', 'safety': 'safety', 'convenience': 'lifestyle'
    }

    # 1. Initialize Tracery
    grammar = tracery.Grammar(grammar_source)
    grammar.add_modifiers(base_english)

    # 2. Gather Candidates & Distances
    matches = []
    for p in personas:
        cat = category_map.get(p, 'lifestyle')
        if data.get(cat):
            matches.append({
                'persona': p,
                'name': data[cat]['specific_name'],
                'dist': data[cat]['dist']
            })
    
    matches.sort(key=lambda x: x['dist'])
    close_matches = [m for m in matches if m['dist'] <= 1.5]

    # --- LOGIC BRANCH 1: COMBO (2 Winners) ---
    if len(close_matches) >= 2:
        m1 = close_matches[0]
        m2 = close_matches[1]
        
        # Inject the specific names into the text
        headline = grammar.flatten("#combo_headline#")
        body_template = grammar.flatten("#combo_body#")
        
        return headline, body_template.format(name1=m1['name'], name2=m2['name'])

    # --- LOGIC BRANCH 2: SINGLE WINNER ---
    if not matches: return "Great Location", "Prime location."
    
    # Tie-Breaker Logic (Randomly pick if multiple are close)
    min_dist = matches[0]['dist']
    candidates = [m for m in matches if m['dist'] <= min_dist + 0.1]
    best_match = random.choice(candidates)
    
    persona_key = best_match['persona']
    
    # Try to find specific templates like "#student_headline#"
    headline_rule = f"#{persona_key}_headline#"
    body_rule = f"#{persona_key}_body#"
    
    if persona_key + "_headline" not in grammar_source:
        headline_rule = "#default_headline#"
        body_rule = "#default_body#"

    headline = grammar.flatten(headline_rule)
    body_template = grammar.flatten(body_rule)
    
    return headline, body_template.format(name=best_match['name'])

@app.post("/recommend")
def recommend(pref: UserPreference):
    if not ai_brain: raise HTTPException(status_code=503, detail="Training")

    # Math Search (Fixed to silence warnings)
    user_vector = pd.DataFrame([[
        pref.safety_priority * 5.0,
        pref.health_priority * 5.0,
        pref.education_priority * 5.0,
        pref.lifestyle_priority * 5.0
    ]], columns=['safety', 'health', 'education', 'lifestyle'])
    
    distances, indices = ai_brain['model'].kneighbors(user_vector, n_neighbors=1)
    idx = indices[0][0]
    nearest_data = ai_brain['metadata'][idx]
    
    headline, body = generate_persuasive_copy(pref.personas, nearest_data)

    return {
        "property_id": ai_brain['ids'][idx],
        "property_name": ai_brain['names'][idx],
        "ai_headline": headline,
        "ai_body": body,
        "nearest_highlights": build_highlights(nearest_data)
    }

def build_highlights(data):
    items = []
    for cat, info in data.items():
        if info and info['dist'] < 3.0: 
             # FORMAT: "College is close (University of San Carlos) at 0.4km"
             items.append(f"{info['type']} is close ({info['specific_name']}) at {info['dist']:.1f}km")
    return items[:3]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)