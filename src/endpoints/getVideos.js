import { Router } from "express";
import { findAllVideos } from "../utils/mongo.js";
import { ObjectId } from "mongodb";
import { getDb } from "../utils/mongo.js";

const router = Router();

// List uploaded videos (GET /api/videos)
router.get("/", async (req, res) => {
  try {
    const videos = await findAllVideos();
    // Ensure likes field is present in all videos (default to 0 for legacy)
    const videosWithLikes = videos.map(v => ({
      ...v,
      likes: typeof v.likes === 'number' ? v.likes : 0
    }));
    res.json(videosWithLikes);
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
    // Step 1: Find video
    const video = await db.collection('videos').findOne(query);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    // Step 2: Update viewCount (increment by 1)
    await db.collection('videos').updateOne(query, { $inc: { viewCount: 1 } });
    // Return original video shape, but incremented viewCount in response
    const { s3Key, ...videoExport } = video;
    // Defensive: add 1 to viewCount if it's a number, otherwise default to 1
    let newViewCount = 1;
    if (typeof video.viewCount === 'number') {
      newViewCount = video.viewCount + 1;
    }
    videoExport.viewCount = newViewCount;
    videoExport.likes = typeof video.likes === 'number' ? video.likes : 0;
    res.json(videoExport);
  } catch (err) {
    console.error("Error in GET /api/videos/:id:", err);
    res.status(500).json({ error: 'Database error fetching video.' });
  }
});
export default router;





