import { Router } from 'express';
import videosDB from '../functions/videosDB.js';

const router = Router();

// List uploaded videos (GET /api/videos)
router.get('/', (req, res) => {
  res.json(videosDB);
});

export default router;
