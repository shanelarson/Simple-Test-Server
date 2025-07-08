import express from 'express';
import { ObjectId } from 'mongodb';
import { getDb } from '../utils/mongo.js';

const router = express.Router();

// Util: Determine if the id is a hash (hex string of md5) or a valid Mongo ObjectId
function isValidHash(id) {
  return typeof id === 'string' && /^[a-f0-9]{32}$/.test(id);
}

// Expose /api/videos/:id to fetch video by hash or ObjectId
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!id || !(isValidHash(id) || ObjectId.isValid(id))) {
    return res.status(400).json({ error: 'Invalid video id' });
  }
  let query;
  if (isValidHash(id)) {
    query = { filenameHash: id };
  } else {
    query = { _id: new ObjectId(id) };
  }
  try {
    const db = await getDb();
    const video = await db.collection('videos').findOne(query);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    // Remove any sensitive/internal fields
    const { s3Key, ...videoExport } = video;
    res.json(videoExport);
  } catch (err) {
    res.status(500).json({ error: 'Database error fetching video.' });
  }
});

export default router;
