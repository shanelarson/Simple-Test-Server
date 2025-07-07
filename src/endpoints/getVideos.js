import { Router } from 'express';

const router = Router();

import { MongoClient } from 'mongodb';

// MongoDB connection URI and database/collection names from env
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || 'videoapp';
const COLLECTION_NAME = process.env.MONGODB_VIDEOS_COLLECTION || 'videos';

// A reusable MongoClient connection (basic singleton for demo)
let mongoClientPromise;
function getMongoClient() {
  if (!mongoClientPromise) {
    mongoClientPromise = MongoClient.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  }
  return mongoClientPromise;
}

// List uploaded videos (GET /api/videos)
router.get('/', async (req, res) => {
  try {
    const client = await getMongoClient();
    const db = client.db(DB_NAME);
    const coll = db.collection(COLLECTION_NAME);
    // Sort newest first
    const videos = await coll.find({}).sort({ uploaded: -1 }).toArray();
    res.json(videos);
  } catch (err) {
    res.status(500).json({ error: 'Database error retrieving videos.' });
  }
});

export default router;

