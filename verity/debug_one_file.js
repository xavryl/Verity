import fs from 'fs';

const INPUT_FOLDER = '515.csv';

async function debugOneFile() {
    try {
        const files = fs.readdirSync(INPUT_FOLDER);
        
        // Grab the first file that isn't a hidden system file
        const sampleFile = files.find(f => !f.startsWith('.'));

        if (!sampleFile) {
            console.log("❌ No files found in the folder.");
            return;
        }

        console.log("\n🔎 RAW FILENAME (DATA):");
        console.log(sampleFile);
        console.log("\n📊 COLUMN BREAKDOWN:");
        
        const cols = sampleFile.split(',');
        cols.forEach((val, index) => {
            console.log(`   [${index}] ${val}`);
        });

        console.log("\n👉 Check Index [2] (MNC). This is the Provider Code.");
        console.log("👉 Check Index [6] & [7] (Lon/Lat). These must be coordinates.\n");

    } catch (err) {
        console.error("❌ Error:", err.message);
    }
}

debugOneFile();