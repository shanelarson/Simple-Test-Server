// Utility script to list all video filenameHash values in your database
// Usage: node tools/dumpAllVideoHashes.js

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

// Load env vars
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DBNAME = process.env.MONGODB_DBNAME || undefined;

if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI environment variable');
  process.exit(1);
}

(async function() {
  let client;
  try {
    client = new MongoClient(MONGODB_URI, {});
    await client.connect();
    const db = client.db(MONGODB_DBNAME);
    const col = db.collection('videos');
    const videos = await col.find({}).toArray();
    console.log(`Found ${videos.length} videos in collection.`);
    if (videos.length) {
      console.log('\nfilenameHash               | _id                     | title');
      console.log('--------------------------------------------------------------');
      for (const v of videos) {
        console.log(
          `${(v.filenameHash || '').padEnd(32)} | ${(v._id || '').toString().padEnd(24)} | ${(v.title || '').substring(0, 40)}`
        );
      }
    } else {
      console.log('No videos found.');
    }
    process.exit(0);
  } catch (err) {
    console.error('DB ERROR:', err.message || err);
    process.exit(2);
  } finally {
    if (client) await client.close();
  }
})();
