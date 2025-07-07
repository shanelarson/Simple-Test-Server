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

export async function insertVideo(doc) {
  const col = await getVideosCollection();
  const result = await col.insertOne(doc);
  return result;
}

export async function findAllVideos() {
  const col = await getVideosCollection();
  return col.find({}).sort({ uploaded: -1 }).toArray();
}
