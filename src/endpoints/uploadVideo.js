import { Router } from 'express';
import multer from 'multer';
import videosDB from '../functions/videosDB.js';

const router = Router();

// Multer config for file upload (100MB limit, memory storage for mock)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// Upload a video (POST /api/upload)
router.post('/', upload.single('video'), (req, res) => {
  const { title, description } = req.body;
  const videoFile = req.file;
  if (!title || !description || !videoFile) {
    return res.status(400).json({ error: 'Missing required fields or file.' });
  }
  // Mock S3 upload: just create a fake URL
  const now = new Date();
  const dateStr = now.toISOString();
  const fakeUrl = `/mock-uploads/${encodeURIComponent(
    videoFile.originalname
  )}-${Date.now()}`;

  // Save (mock) record
  const record = {
    id: videosDB.length + 1,
    title,
    description,
    uploaded: dateStr,
    url: fakeUrl
  };
  videosDB.push(record);

  res.status(201).json(record);
});

export default router;
