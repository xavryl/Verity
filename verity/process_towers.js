import fs from 'fs';
import path from 'path';

// CONFIGURATION
const INPUT_FOLDER = '515.csv'; 
const OUTPUT_FILE = 'src/data/cebu_towers.json';

// CEBU CITY BOUNDING BOX
const BOUNDS = {
    minLat: 10.2800, 
    maxLat: 10.3800,
    minLng: 123.8500, 
    maxLng: 123.9500
};

// 🟢 THE TRANSLATOR: CODES -> NAMES
const getProvider = (code) => {
    // Convert to string and remove any whitespace
    const c = String(code).trim();
    
    // SMART / SUN / PLDT (Codes: 3, 03, 5, 05, 24)
    if (['3', '03', '4', '04', '5', '05', '24'].includes(c)) return 'Smart';
    
    // GLOBE TELECOM (Codes: 2, 02, 1, 01, 11)
    if (['2', '02', '1', '01', '11', '88'].includes(c)) return 'Globe';
    
    // DITO TELECOMMUNITY (Codes: 66)
    if (['66', '51566'].includes(c)) return 'DITO';

    return 'Unknown'; 
};

async function processFilenames() {
    console.log(`🚀 Scanning folder: ${INPUT_FOLDER}...`);
    
    if (!fs.existsSync('src/data')){
        fs.mkdirSync('src/data', { recursive: true });
    }

    const towers = [];
    
    try {
        const files = fs.readdirSync(INPUT_FOLDER);
        console.log(`📂 Found ${files.length} items. Translating codes...`);

        for (const fileName of files) {
            const cols = fileName.split(',');

            if (cols.length < 8) continue;

            const lng = parseFloat(cols[6]);
            const lat = parseFloat(cols[7]);

            if (isNaN(lat) || isNaN(lng)) continue;

            // FILTER: Is it in Cebu?
            if (lat >= BOUNDS.minLat && lat <= BOUNDS.maxLat &&
                lng >= BOUNDS.minLng && lng <= BOUNDS.maxLng) {
                
                const radio = cols[0];
                const mnc = cols[2]; // This is the code (e.g. "2")
                
                towers.push({
                    id: `t-${towers.length}`,
                    lat,
                    lng,
                    radio: radio === 'LTE' ? '4G' : radio,
                    provider: getProvider(mnc) // 👈 Translate "2" -> "Globe"
                });
            }
        }

        console.log(`✅ COMPLETE! Found ${towers.length} towers in Cebu.`);
        
        // Debug: Show us the counts to prove it worked
        const counts = {};
        towers.forEach(t => { counts[t.provider] = (counts[t.provider] || 0) + 1; });
        console.log("📊 Provider Count:", counts);

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(towers, null, 2));
        console.log(`💾 Data saved to: ${OUTPUT_FILE}`);

    } catch (err) {
        console.error("❌ Error:", err.message);
    }
}

processFilenames();