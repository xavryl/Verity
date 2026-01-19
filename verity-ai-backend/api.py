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
    'safety': ['police', 'fire', 'barangay', 'station', 'security', 'outpost'],
    'health': ['hospital', 'clinic', 'pharmacy', 'vet', 'dental', 'medical'],
    'education': ['school', 'college', 'university', 'k-12', 'campus', 'institute'],
    'lifestyle': ['gym', 'mall', 'market', 'park', 'cafe', 'restaurant', 'shop']
}

ai_brain = {}

# --- THE COPYWRITER LIBRARY ---
# This dictionary holds all the possible things the AI can say.
COPY_LIBRARY = {
    'family': {
        'close': [
            ("Walk to School", "Imagine saving hours in traffic. {name} is close enough for a stress-free morning walk, giving you more quality family time."),
            ("Traffic-Free Mornings", "Say goodbye to the school run rush. With {name} just around the corner, your kids can sleep in a little longer."),
            ("Education Hub", "Located in a prime school district, this home puts education first with {name} practically at your doorstep.")
        ],
        'medium': [
            ("Family-Friendly Zone", "A secure, family-oriented neighborhood with reputable schools like {name} just a quick school-bus ride away."),
            ("The Sweet Spot", "Ideally positioned—peaceful enough for focus, but connected enough that {name} is just a short drive away."),
            ("Community Living", "Join a community of growing families. You are minutes away from {name}, balancing privacy with accessibility.")
        ],
        'far': [
            ("Spacious Family Living", "A quiet, safe environment perfect for raising children, far away from the noise and dangers of the crowded city center."),
            ("Suburban Peace", "Trade the city noise for space and safety. Here, your children have room to grow, with schools still accessible by car."),
            ("Private Sanctuary", "Prioritize your family's safety and privacy. A secluded haven where kids can play freely, away from the busy highways.")
        ]
    },
    'pets': {
        'close': [
            ("Pet-Lover's Haven", "Ideal for fur-parents! Emergency care is instant with {name} just a stone's throw away."),
            ("Dog Walker's Dream", "Your pets will love this. Daily walks are a breeze with open spaces and {name} right in the neighborhood."),
            ("Fur-Baby Approved", "Everything your pet needs is here. From morning walks to check-ups at {name}, it's all walkable.")
        ],
        'medium': [
            ("Pet-Friendly Community", "A neighborhood that welcomes pets, with essential services like {name} just a short drive for check-ups."),
            ("Active Pets Life", " plenty of room to run, and professional care at {name} is never too far when you need it."),
            ("Space to Roam", "Give your pets the yard space they deserve, while keeping the vet at {name} within a convenient driving distance.")
        ],
        'far': [
            ("Wide Open Spaces", "This location offers the breathing room your pets need to run and play, far from the cramped congestion of the city."),
            ("Nature Retreat", "Perfect for active dogs who need space. Enjoy long, quiet walks away from the stress of city traffic."),
            ("Quiet & Calm", "An anxiety-free environment for sensitive pets. No loud sirens or city noise—just peace and quiet.")
        ]
    },
    'fitness': {
        'close': [
            ("Active Lifestyle Ready", "No more excuses! {name} is right at your doorstep, making it effortless to stick to your workout routine."),
            ("Gym-Goer's Paradise", "Live where you lift. With {name} this close, you can squeeze in a session before or after work with zero travel time."),
            ("Wellness Central", "Your health comes first here. Jog to {name} and embrace a lifestyle of fitness and vitality.")
        ],
        'medium': [
            ("Balanced Living", "Enjoy a quiet home that's still connected to your fitness goals. {name} is just a quick warm-up drive away."),
            ("Weekend Warrior", "Perfect for those who love weekend gains. {name} is close enough to be convenient, but far enough to keep your home quiet."),
            ("Active Access", "You're in the sweet spot—easy access to {name} for your workouts, without living inside a noisy commercial district.")
        ],
        'far': [
            ("Private Wellness Sanctuary", "Your own private escape. Perfect for setting up a home gym and focusing on wellness without distractions."),
            ("Zen Living", "Focus on mental health and yoga in your own spacious living area, far from the crowded and sweaty city gyms."),
            ("Outdoor Fitness", "Forget the gym membership—this area is perfect for outdoor running, cycling, and calisthenics in fresh air.")
        ]
    },
    'retirement': {
        'close': [
            ("Convenient Retirement", "Enjoy your golden years with total ease. Healthcare at {name} is just a walk away, giving you peace of mind."),
            ("Independent Living", "Maintain your independence longer. You can walk to {name} and other essentials without relying on a driver."),
            ("Connected Senior Living", "Stay active and social. This location keeps you connected to the community and vital services like {name}.")
        ],
        'medium': [
            ("Peace of Mind", "Relax knowing that world-class care at {name} is just a short drive away, while you enjoy a quiet neighborhood."),
            ("The Best of Both", "Retire in style. You get the quiet streets you want, with the security of {name} being nearby for emergencies."),
            ("Comfort & Care", "A comfortable distance from the hustle. You're close enough to {name} for appointments, but far enough to hear the birds sing.")
        ],
        'far': [
            ("Peaceful & Secluded", "Perfect for retirement—tucked away from the noise, pollution, and chaos of the city center."),
            ("Quiet Sanctuary", "Enjoy a slower pace of life. A true retreat where you can garden, read, and relax in absolute silence."),
            ("Country-Style Living", "Retire to fresh air and open skies. Escape the city crowds and enjoy a private, dignified lifestyle.")
        ]
    },
    'safety': {
        'close': [
            ("Maximum Security", "Sleep soundly knowing {name} is practically next door. One of the safest spots in the city."),
            ("Protector's Choice", "Your family's safety is guaranteed. The proximity to {name} provides an unmatched layer of security."),
            ("Safe Zone", "A highly secure location. With {name} this close, emergency response times are virtually instant.")
        ],
        'medium': [
            ("Secure Neighborhood", "A well-guarded community feel. You are within the rapid response radius of {name}."),
            ("Peaceful & Protected", "Enjoy the quiet streets of a safe subdivision, knowing help from {name} is just minutes away."),
            ("Safety First", "Located in a low-risk zone, with the added reassurance that {name} is nearby if ever needed.")
        ],
        'far': [
            ("Private & Gated Feel", "This area relies on privacy as its main security. Ideally suited for a home with its own gate and CCTV system."),
            ("Low-Profile Living", "Stay off the radar. A quiet, unassuming location that naturally deters attention and foot traffic."),
            ("Secluded Safety", "Safety through seclusion. Far from the crimes of opportunity that happen in busy downtown areas.")
        ]
    },
    'convenience': { # Urban/Student
        'close': [
            ("City Slicker's Dream", "The ultimate urban lifestyle. {name} is downstairs, meaning you never have to sit in traffic again."),
            ("Everything Within Reach", "Walk to coffee, dinner, and work. {name} acts as your extended living room."),
            ("The 15-Minute City", "Live the modern dream. {name} and all your daily essentials are just a quick elevator ride or walk away.")
        ],
        'medium': [
            ("Urban Edge", "Just outside the chaos, but close to the action. A short ride takes you straight to {name}."),
            ("Accessible Living", "You can easily access the nightlife and shopping at {name}, but you come home to a quieter street."),
            ("Connected Commuter", "Ideally located for easy transport. {name} is quickly accessible, but you don't hear the honking cars at night.")
        ],
        'far': [
            ("Digital Nomad Hub", "Work from home in peace. Who needs a mall nearby when you have delivery apps and high-speed internet?"),
            ("Escape the Rat Race", "Save money and stress by living further out. You get more square footage here than you would near the mall."),
            ("Suburban Value", "Why pay city premiums? Enjoy a larger home here, and just visit the city centers when you really need to.")
        ]
    }
}

# --- TRAINER & LOGIC ---

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
    persona: str 
    safety_priority: float
    health_priority: float
    education_priority: float
    lifestyle_priority: float

# --- THE PERSUASION ENGINE (UPDATED) ---
def generate_persuasive_copy(persona, data):
    # 1. Map Persona to the most relevant Category
    category_map = {
        'family': 'education',
        'pets': 'health',     # Vets usually fall under health keywords like 'clinic'/'vet'
        'fitness': 'lifestyle',
        'retirement': 'health',
        'safety': 'safety',
        'convenience': 'lifestyle'
    }
    
    target_cat = category_map.get(persona, 'lifestyle')
    cat_data = data.get(target_cat)
    
    # 2. Determine Distance Class
    dist_class = 'far'
    amenity_name = "the city center"
    
    if cat_data:
        d = cat_data['dist']
        amenity_name = cat_data['name']
        if d < 1.0: dist_class = 'close'
        elif d < 3.5: dist_class = 'medium'
    
    # 3. Randomly Select Copy from Library
    # Fallback to 'convenience' if persona not found
    script_options = COPY_LIBRARY.get(persona, COPY_LIBRARY['convenience']).get(dist_class)
    
    headline, body_template = random.choice(script_options)
    
    # 4. Fill in the blanks (Template Injection)
    body = body_template.format(name=amenity_name)
    
    return headline, body

@app.post("/recommend")
def recommend(pref: UserPreference):
    if not ai_brain: raise HTTPException(status_code=503, detail="Training")

    # Math Search
    user_vector = np.array([[
        pref.safety_priority * 5.0,
        pref.health_priority * 5.0,
        pref.education_priority * 5.0,
        pref.lifestyle_priority * 5.0
    ]])
    
    distances, indices = ai_brain['model'].kneighbors(user_vector, n_neighbors=1)
    idx = indices[0][0]
    nearest_data = ai_brain['metadata'][idx]
    
    # Persuasion Generation
    headline, body = generate_persuasive_copy(pref.persona, nearest_data)

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
             items.append(f"{info['name']} ({info['dist']:.1f}km)")
    return items[:3]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)