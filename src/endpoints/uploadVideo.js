import { Router } from 'express';
import multer from 'multer';
import { uploadToS3 } from '../utils/s3Upload.js';
import { insertVideo } from '../utils/mongo.js';
import crypto from 'crypto';
import { getClientIp } from '../utils/getClientIp.js';
import { canUploadVideo, recordVideoUpload } from '../utils/rateLimitVideos.js';

const router = Router();

// Multer config for file upload (100MB limit, memory storage for upload pipe-through)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});
// POST /api/upload - Upload a video to S3, then save metadata to MongoDB
router.post('/', upload.single('video'), async (req, res) => {
  try {
    let { title, description } = req.body;
    const videoFile = req.file;
    // Tags parsing
    let tagsInput = req.body.tags;
    let tags = [];
    if (typeof tagsInput === "string") {
      tags = tagsInput
        .split(",")
        .map(t => t.trim())
        .filter(t => t.length > 0);
    }

    if (!title || !videoFile) {
      return res.status(400).json({ error: 'Missing required fields or file.' });
    }
    // --- VIDEO RATE LIMIT CHECK ---
    const clientIp = getClientIp(req);
    try {
      const { allowed, retryAfterMs } = await canUploadVideo(clientIp);
      if (!allowed) {
        let retrySecs = Math.ceil((retryAfterMs || 0) / 1000);
        let mins = Math.floor(retrySecs / 60);
        let hrs = Math.floor(mins / 60);
        mins = mins % 60;
        let msg = "You can only upload up to 5 videos per day from your IP address.";
        if (retrySecs > 0) {
          let human = "";
          if (hrs > 0) human += `${hrs}h `;
          if (mins > 0) human += `${mins}m `;
          if (retrySecs % 60 > 0) human += `${retrySecs % 60}s`;
          msg += ` Please try again in ${human.trim()}.`;
        }
        return res.status(429).json({ error: msg, retryAfterSeconds: retrySecs });
      }
    } catch (rlErr) {
      console.error("Video rate limit check failed:", rlErr);
      return res.status(500).json({ error: "Failed to enforce upload rate limit." });
    }
    // Trim and handle values as specified
    title = title.trim();
    description = typeof description === 'string' ? description.trim() : '';

    // Generate current timestamp string (server-side)
    const nowString = new Date().toISOString();
    // Prepare for hash: title|description|time
    const hashString = `${title}|${description}|${nowString}`;
    const hash = crypto.createHash('md5').update(hashString).digest('hex');

    // Determine file extension
    let extension = '';
    const originalName = videoFile.originalname || '';
    const extMatch = originalName.match(/\.([a-zA-Z0-9]+)$/);
    if (extMatch) {
      extension = extMatch[1];
    }
    // Build hashed filename (with extension if present)
    const hashedFilename = extension ? `${hash}.${extension}` : hash;
    const s3ObjectKey = `videos/${hashedFilename}`;

    // S3 Upload
    let s3Url, s3Key;
    try {
      // Modify uploadToS3 to accept an explicit key, or implement here for backward compatibility
      const s3Result = await uploadToS3(
        videoFile.buffer,
        videoFile.mimetype,
        s3ObjectKey
      );
      s3Url = s3Result.url;
      s3Key = s3Result.key;
    } catch (err) {
      console.error('S3 upload error:', err);
      return res.status(500).json({ error: 'Failed to upload to S3.' });
    }
    // Insert document in MongoDB
    try {
      const doc = {
        title,
        description: description,
        url: s3Url,
        uploaded: new Date(),
        size: videoFile.size,
        contentType: videoFile.mimetype,
        s3Key, // internal use for cleanup if needed
        originalFilename: originalName,
        filenameHash: hash,
        viewCount: 0, // Initialize viewCount to 0 on upload
        tags: tags,
        likes: 0, // Initialize likes to 0 on upload
      };
      const inserted = await insertVideo(doc);
      // --- Record upload for IP only after success ---
      try {
        await recordVideoUpload(clientIp);
      } catch (rlError) {
        // Log but don't fail the response if stats update fails
        console.error("Failed to record video rate limit usage:", rlError);
      }
      res.status(201).json(inserted);
    } catch (mongoError) {
      // Clean up the just-uploaded S3 object if DB error
      try {
        const { deleteFromS3 } = await import('../utils/s3Upload.js');
        await deleteFromS3(s3Key);
      } catch {}
      res.status(500).json({ error: 'Video upload succeeded but database insertion failed.' });
    }
  } catch (e) {
    res.status(500).json({ error: 'Unexpected server error.' });
  }
});
export default router;







