import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getDb } from '../utils/mongo.js';

const router = Router();

// Accept either videoId as ObjectId or filenameHash as md5 32hex string
router.post('/', async (req, res) => {
  const { videoId } = req.body;
  if (!videoId) {
    return res.status(400).json({ error: 'Missing videoId.' });
  }

  // Determine identifier
  let query = null;
  if (/^[a-fA-F0-9]{24}$/.test(videoId)) {
    try {
      query = { _id: new ObjectId(videoId) };
    } catch {
      return res.status(400).json({ error: 'Invalid ObjectId format.' });
    }
  } else if (/^[a-fA-F0-9]{32}$/.test(videoId)) {
    query = { filenameHash: videoId.toLowerCase() };
  } else {
    return res.status(400).json({ error: 'Invalid videoId format.' });
  }

  try {
    const db = await getDb();
    // Step 1: Atomically increment likes
    const result = await db.collection('videos').updateOne(
      query,
      { $inc: { likes: 1 } }
    );
    // Step 2: Check if update was successful (matched a doc)
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Video not found.' });
    }
    // Step 3: Fetch the updated document to get the new likes count
    const updated = await db.collection('videos').findOne(query);
    if (!updated || typeof updated.likes !== 'number') {
      return res.status(500).json({ error: 'Database error updating likes.' });
    }
    res.json({ likes: updated.likes });
  } catch (err) {
    console.error('Error in POST /api/likes:', err);
    res.status(500).json({ error: 'Unexpected database error.' });
  }
});

export default router;

