import os
import pandas as pd
import numpy as np
from supabase import create_client
from geopy.distance import geodesic
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import MinMaxScaler
import joblib
from dotenv import load_dotenv

# 1. SETUP
load_dotenv()
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")

if not url or not key:
    raise ValueError("❌ ERROR: Supabase credentials missing. Check your .env file.")

print(f"--- 🧠 VERITY AI TRAINER ---")
print(f"Connecting to: {url}")

try:
    supabase = create_client(url, key)
except Exception as e:
    raise ValueError(f"❌ ERROR: Could not connect to Supabase. Check your key. Details: {e}")

# 2. FETCH DATA
print("\n1. Fetching live data from Supabase...")

try:
    # Fetch properties
    props_response = supabase.table('properties').select("*").execute()
    properties = pd.DataFrame(props_response.data)

    # Fetch amenities
    amens_response = supabase.table('amenities').select("*").execute()
    amenities = pd.DataFrame(amens_response.data)

    print(f"   > ✅ Success! Loaded {len(properties)} properties and {len(amenities)} amenities.")

    if len(properties) == 0:
        print("   ⚠️ WARNING: No properties found. The model cannot train without properties.")
        exit()

except Exception as e:
    print(f"❌ ERROR: Failed to fetch data. Is your key correct? Details: {e}")
    exit()

# 3. FEATURE ENGINEERING (The 'Brain' Logic)
# We define what keywords belong to which lifestyle category
CATEGORIES = {
    'safety': ['police', 'fire', 'barangay'],
    'health': ['hospital', 'clinic', 'pharmacy', 'vet'],
    'education': ['school', 'college', 'university', 'k-12'],
    'lifestyle': ['gym', 'mall', 'market', 'park', 'cafe']
}

print("\n2. Calculating Feature Vectors (Distance Decay)...")

def calculate_property_vector(prop_row):
    # Start with 0 score for everything
    scores = {cat: 0.0 for cat in CATEGORIES.keys()}
    
    # Check every amenity against this property
    for _, amen in amenities.iterrows():
        try:
            # Get coordinates
            if pd.isna(prop_row['lat']) or pd.isna(prop_row['lng']) or pd.isna(amen['lat']) or pd.isna(amen['lng']):
                continue

            prop_loc = (prop_row['lat'], prop_row['lng'])
            amen_loc = (amen['lat'], amen['lng'])
            
            # Calculate distance in Kilometers
            dist_km = geodesic(prop_loc, amen_loc).km
            
            if dist_km > 3.0: continue # Ignore amenities > 3km away
            
            # AI MATH: Closer = Exponentially Higher Score
            # 0.1km away = Score 1.6
            # 2.0km away = Score 0.4
            impact = 1 / (dist_km + 0.5)
            
            # Combine all text fields to find keywords
            text = (str(amen.get('sub_category', '')) + " " + str(amen.get('type', '')) + " " + str(amen.get('name', ''))).lower()
            
            # Check if this amenity matches any category
            for cat, keywords in CATEGORIES.items():
                if any(k in text for k in keywords):
                    scores[cat] += impact
        except:
            continue
            
    return pd.Series(scores)

# Apply the math to every property
# This creates a "Vector" for each property: [SafetyScore, HealthScore, EducationScore, LifestyleScore]
feature_matrix = properties.apply(calculate_property_vector, axis=1)

# 4. NORMALIZE & TRAIN
print("\n3. Training Model...")

# Scale numbers to be between 0 and 1 (Easier for AI to compare)
scaler = MinMaxScaler()
normalized_features = scaler.fit_transform(feature_matrix)
feature_df = pd.DataFrame(normalized_features, columns=CATEGORIES.keys())

# Train Nearest Neighbors Model
# This allows us to find the "closest match" in mathematical space
model = NearestNeighbors(n_neighbors=1, algorithm='brute', metric='euclidean')
model.fit(normalized_features)

# 5. SAVE
print("\n4. Saving Brain to Disk...")
model_data = {
    'model': model,
    'scaler': scaler,
    'property_ids': properties['id'].values,
    'property_names': properties['name'].values,
    'feature_data': feature_df
}
joblib.dump(model_data, 'verity_model.pkl')

print("\n✅ TRAINING COMPLETE. 'verity_model.pkl' created successfully.")