import { Router } from 'express';
import multer from 'multer';
import { uploadVideoToS3 } from '../functions/s3Upload.js';
import { insertVideoDocument } from '../functions/videosMongo.js';

const router = Router();

// Multer config for file upload (100MB limit, memory storage for upload pipe-through)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

// POST /api/upload - Upload a video to S3, then save metadata to MongoDB
router.post('/', upload.single('video'), async (req, res) => {
  try {
    const { title, description } = req.body;
    const videoFile = req.file;
    if (!title || !videoFile) {
      return res.status(400).json({ error: 'Missing required fields or file.' });
    }
    // S3 Upload
    let s3Url, s3Key;
    try {
      const s3Result = await uploadVideoToS3({
        buffer: videoFile.buffer,
        originalname: videoFile.originalname,
        mimetype: videoFile.mimetype,
        size: videoFile.size
      });
      s3Url = s3Result.url;
      s3Key = s3Result.key;
    } catch (err) {
      return res.status(500).json({ error: 'Failed to upload to S3.' });
    }
    // Insert document in MongoDB
    try {
      const doc = {
        title,
        description: description || "",
        url: s3Url,
        uploaded: new Date(),
        size: videoFile.size,
        contentType: videoFile.mimetype,
        s3Key // internal use for cleanup if needed
      };
      const inserted = await insertVideoDocument(doc);
      res.status(201).json(inserted);
    } catch (mongoError) {
      // Clean up the just-uploaded S3 object if DB error
      try {
        const { deleteS3Object } = await import('../functions/s3Upload.js');
        await deleteS3Object(s3Key);
      } catch {}
      res.status(500).json({ error: 'Video upload succeeded but database insertion failed.' });
    }
  } catch (e) {
    res.status(500).json({ error: 'Unexpected server error.' });
  }
});

export default router;

