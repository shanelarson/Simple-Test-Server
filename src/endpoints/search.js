import { Router } from "express";
import { searchVideos } from "../utils/mongo.js";

const router = Router();

// GET /api/search?query=search string
router.get('/', async (req, res) => {
  let queryString = req.query.query || '';
  if (typeof queryString !== 'string' || !queryString.trim()) {
    return res.json([]); // No search terms: just return empty array
  }
  try {
    const videos = await searchVideos(queryString);
    res.json(videos);
  } catch (err) {
    console.error("/api/search error: ", err);
    res.status(500).json({ error: "Unexpected error performing search." });
  }
});

export default router;
