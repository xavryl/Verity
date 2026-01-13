// src/lib/constants.js

export const CEBU_CENTER = [10.3157, 123.9055]; // Default Start

// --- NEW: PROPERTY INVENTORY ---
export const PROPERTIES = [
  {
    id: "prop_hq",
    name: "Project Verity HQ",
    position: [10.3157, 123.9055], // Cebu Business Park
    price: "₱250,000 / sqm",
    type: "Commercial Lot",
    desc: "The heart of the business district."
  },
  {
    id: "prop_itpark",
    name: "Skyrise Alpha Condo",
    position: [10.3275, 123.9060], // IT Park Area
    price: "₱180,000 / sqm",
    type: "Residential Condo",
    desc: "High-tech living in the IT capital."
  },
  {
    id: "prop_banilad",
    name: "Maria Luisa Estate",
    position: [10.3450, 123.9120], // Banilad (North)
    price: "₱120,000 / sqm",
    type: "Residential Lot",
    desc: "Exclusive subdivision living."
  },
  {
    id: "prop_srp",
    name: "Seaside City Complex",
    position: [10.2830, 123.8800], // SRP (South)
    price: "₱300,000 / sqm",
    type: "Mixed Use",
    desc: "Future-ready waterfront investment."
  }
];

// ... (KEEP EXISTING AMENITIES & TRANSIT_DATA BELOW) ...
// (I will assume AMENITIES and TRANSIT_DATA are still here as defined before)
export const AMENITIES = {
  safety: [
    { name: "Mabolo Police Station", position: [10.3190, 123.9100], type: "safety" },
    { name: "Brgy. Luz Hall", position: [10.3210, 123.9030], type: "safety" },
    { name: "Cebu Fire Station", position: [10.3050, 123.9000], type: "safety" },
    { name: "Talamban Police", position: [10.3550, 123.9150], type: "safety" }, // Added for North
    { name: "Mambaling Station", position: [10.2850, 123.8750], type: "safety" } // Added for South
  ],
  health: [
    { name: "Perpetual Succour", position: [10.3120, 123.8960], type: "health" },
    { name: "Chong Hua", position: [10.3095, 123.8920], type: "health" },
    { name: "UC Med", position: [10.3250, 123.9300], type: "health" }
  ],
  education: [
    { name: "UP Cebu", position: [10.3225, 123.8980], type: "education" },
    { name: "CIS", position: [10.3650, 123.9050], type: "education" },
    { name: "San Carlos Talamban", position: [10.3520, 123.9120], type: "education" }
  ],
  transit: [
    { name: "Ayala Terminal", position: [10.3175, 123.9045], type: "transit" },
    { name: "SM Seaside Terminal", position: [10.2820, 123.8820], type: "transit" }
  ],
  living: [
    { name: "Ayala Center", position: [10.3180, 123.9050], type: "living" },
    { name: "SM Seaside", position: [10.2840, 123.8810], type: "living" },
    { name: "IT Park Central", position: [10.3280, 123.9050], type: "living" }
  ],
  faith: [
    { name: "Carmelite Monastery", position: [10.3200, 123.9080], type: "faith" },
    { name: "Pedro Calungsod Chapel", position: [10.2810, 123.8830], type: "faith" }
  ]
};

export const TRANSIT_DATA = {
  route17c: [
    [10.3150, 123.9000], [10.3160, 123.9020], [10.3175, 123.9045], 
    [10.3157, 123.9055], [10.3140, 123.9065], [10.3120, 123.9080]
  ],
  stops: [
    { name: "Ayala Terminal", position: [10.3175, 123.9045] },
    { name: "Mindanao Ave", position: [10.3120, 123.9080] }
  ]
};