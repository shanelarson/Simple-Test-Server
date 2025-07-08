import { Router } from "express";
import { findAllVideos } from "../utils/mongo.js";

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

export default router;


