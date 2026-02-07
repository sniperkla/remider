const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');

const uri = "mongodb://admin:AaBb1234!@mongo1.eaqdragon.com:27017,mongo2.eaqdragon.com:27017,mongo3.eaqdragon.com:27017/qdragon?replicaSet=rs0&authSource=admin"

const dbName = "qdragon";
const jsonDir = path.join(__dirname, 'db');

function transform(obj) {
    if (Array.isArray(obj)) {
        return obj.map(transform);
    } else if (obj !== null && typeof obj === 'object') {
        // Handle MongoDB Extended JSON formats
        if (obj.hasOwnProperty('$oid')) return new ObjectId(obj.$oid);
        if (obj.hasOwnProperty('$date')) {
            // Some dates might be numbers or strings
            const dateVal = typeof obj.$date === 'object' && obj.$date.hasOwnProperty('$numberLong') 
                ? parseInt(obj.$date.$numberLong) 
                : obj.$date;
            return new Date(dateVal);
        }
        if (obj.hasOwnProperty('$numberInt')) return parseInt(obj.$numberInt);
        if (obj.hasOwnProperty('$numberLong')) return parseInt(obj.$numberLong);
        if (obj.hasOwnProperty('$numberDouble')) return parseFloat(obj.$numberDouble);
        if (obj.hasOwnProperty('$numberDecimal')) return parseFloat(obj.$numberDecimal);
        
        const newObj = {};
        for (const key in obj) {
            newObj[key] = transform(obj[key]);
        }
        return newObj;
    }
    return obj;
}

async function migrate() {
    const client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 10000, // 10 seconds timeout
    });

    try {
        console.log("Connecting to MongoDB...");
        await client.connect();
        console.log("Successfully connected to MongoDB replica set");
        
        const db = client.db(dbName);

        // Files to ignore or handle specially
        const ignoredFiles = ['.DS_Store', 'backupsummary.json'];
        
        const files = fs.readdirSync(jsonDir)
            .filter(f => f.endsWith('.json') && !ignoredFiles.includes(f));

        for (const file of files) {
            const collectionName = file.replace('.json', '');
            const filePath = path.join(jsonDir, file);
            
            console.log(`Reading ${file}...`);
            const rawData = fs.readFileSync(filePath, 'utf8');
            if (!rawData || rawData.trim() === '') {
                console.log(`Skipping empty file: ${file}`);
                continue;
            }

            let data;
            try {
                data = JSON.parse(rawData);
            } catch (e) {
                console.error(`Error parsing JSON from ${file}:`, e.message);
                continue;
            }

            if (!Array.isArray(data)) {
                console.log(`File ${file} does not contain an array, wrapping in array...`);
                data = [data];
            }

            if (data.length === 0) {
                console.log(`Collection ${collectionName} has no data, skipping insert.`);
                continue;
            }

            // Transform data to handle $oid, $date, $numberLong etc.
            const transformedData = data.map(item => transform(item));

            console.log(`Migrating ${transformedData.length} documents to collection: ${collectionName}`);
            
            // Recreate collection (clear old data)
            try {
                await db.collection(collectionName).drop().catch(e => {
                    if (e.codeName !== 'NamespaceNotFound') throw e;
                });
            } catch (e) {
                console.log(`Notice: Could not drop collection ${collectionName} (might not exist)`);
            }
            
            // Bulk insert
            const result = await db.collection(collectionName).insertMany(transformedData);
            console.log(`Inserted ${result.insertedCount} documents into ${collectionName}`);
        }

        console.log("\x1b[32m%s\x1b[0m", "✓ Migration complete successfully!");
    } catch (err) {
        console.error("\x1b[31m%s\x1b[0m", "Migration failed:");
        console.error(err);
    } finally {
        await client.close();
        process.exit();
    }
}

migrate();
