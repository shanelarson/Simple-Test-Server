// MongoDB utility connection and helpers
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DBNAME = process.env.MONGODB_DBNAME || undefined;
let client;
let db;

async function getMongoClient() {
  if (!MONGODB_URI) throw new Error('MONGODB_URI env variable is required');
  if (!client) {
    client = new MongoClient(MONGODB_URI, {
      // You can add any important options here
    });
    await client.connect();
  }
  return client;
}
export async function getVideosCollection() {
  await getMongoClient();
  if (!db) {
    db = client.db(MONGODB_DBNAME); // If no db name is set, uses the one in MONGODB_URI
  }
  return db.collection('videos');
}

export async function getDb() {
  await getMongoClient();
  if (!db) {
    db = client.db(MONGODB_DBNAME);
  }
  return db;
}
export async function insertVideo(doc) {
  const col = await getVideosCollection();
  // Ensure the viewCount is initialized to 0 if not set in doc
  if (typeof doc.viewCount !== 'number') doc.viewCount = 0;
  const result = await col.insertOne(doc);
  // Return the inserted document with its _id
  return { ...doc, _id: result.insertedId };
}

export async function findAllVideos() {
  const col = await getVideosCollection();
  // Always include viewCount in the returned results (default to 0 if missing for legacy)
  const rawVideos = await col.find({}).sort({ uploaded: -1 }).toArray();
  return rawVideos.map(v => ({ ...v, viewCount: (typeof v.viewCount === 'number') ? v.viewCount : 0 }));
}

// Utility: Find a single video by filenameHash (for debugging/demo)
export async function findVideoByFilenameHash(hash) {
  const col = await getVideosCollection();
  return await col.findOne({ filenameHash: hash });
}



