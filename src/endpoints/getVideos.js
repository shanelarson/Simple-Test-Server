import { Router } from "express";
import { findAllVideos } from "../utils/mongo.js";
import { ObjectId } from "mongodb";
import { getDb } from "../utils/mongo.js";

const router = Router();

// List uploaded videos (GET /api/videos)
router.get("/", async (req, res) => {
  try {
    const videos = await findAllVideos();
    res.json(videos);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Database error retrieving videos." });
  }
});

// Util: validate 32 lowercase hex char md5 hash
function isValidHash(id) {
  return typeof id === 'string' && /^[a-f0-9]{32}$/.test(id);
}

// Get single video by id (GET /api/videos/:id)
router.get('/:id', async (req, res) => {
  let { id } = req.params;
  if (!id || !(isValidHash(id) || ObjectId.isValid(id))) {
    return res.status(400).json({ error: 'Invalid video id' });
  }

  // If it's a hash, normalize by extracting only the 32 hex chars (strip any extension)
  let query;
  if (isValidHash(id)) {
    const match = id.match(/^[a-f0-9]{32}/);
    if (!match) {
      return res.status(400).json({ error: 'Invalid video id' });
    }
    id = match[0];
    query = { filenameHash: id };
  } else {
    query = { _id: new ObjectId(id) };
  }

  try {
    const db = await getDb();
    // Increment viewCount atomically and return updated doc
    const video = await db.collection('videos').findOneAndUpdate(
      query,
      { $inc: { viewCount: 1 } },
      { returnDocument: 'after' }
    );
    if (!video.value) {
      return res.status(404).json({ error: 'Video not found' });
    }
    // Remove any sensitive/internal fields
    const { s3Key, ...videoExport } = video.value;
    res.json(videoExport);
  } catch (err) {
    res.status(500).json({ error: 'Database error fetching video.' });
  }
});
export default router;






