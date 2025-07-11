// Comments API endpoints for video comments
import express from 'express';
import { ObjectId } from 'mongodb';
import { getDb } from '../utils/mongo.js';
import { moderateText } from '../utils/moderation.js';
import { getClientIp } from '../utils/getClientIp.js';
import { canComment, recordComment } from '../utils/rateLimitComments.js';
import { validateCaptcha } from '../utils/captcha.js';

const router = express.Router();


// --- Add a comment to a video ---
// POST /api/comments { videoId, content, captchaText, captchaHash }
router.post('/', async (req, res) => {
  const { videoId, content, captchaText, captchaHash } = req.body;
  if (!videoId || typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: 'Missing videoId or comment content.' });
  }
  // CAPTCHA CHECK (same as upload)
  if (
    typeof captchaText !== "string"
    || typeof captchaHash !== "string"
    || !captchaText.trim()
    || !captchaHash
  ) {
    return res.status(400).json({ error: 'Captcha is required.' });
  }
  if (!validateCaptcha(captchaText, captchaHash)) {
    return res.status(400).json({ error: 'The captcha you entered is incorrect. Please try again.' });
  }
  // Sanitize content length
  if (content.length > 1000) {
    return res.status(400).json({ error: 'Comment too long (max 1000 chars).' });
  }
  // Accept videoId as ObjectId or filenameHash (md5)
  let videoObjectId = null, filenameHash = null;
  let rateLimitType = null, rateLimitId = null;
  if (/^[a-fA-F0-9]{24}$/.test(videoId)) {
    videoObjectId = new ObjectId(videoId);
    rateLimitType = 'objectId';
    rateLimitId = videoObjectId;
  } else if (/^[a-fA-F0-9]{32}$/.test(videoId)) {
    filenameHash = videoId.toLowerCase();
    rateLimitType = 'hash';
    rateLimitId = filenameHash;
  } else {
    return res.status(400).json({ error: 'Invalid videoId format.' });
  }
  // --- COMMENT RATE LIMIT LOGIC ---
  try {
    const clientIp = getClientIp(req);
    // Returns { allowed, retryAfterMs, lastComment, doc }
    const limitState = await canComment({
      videoId: rateLimitId,
      type: rateLimitType,
      clientIp
    });
    if (!limitState.allowed) {
      let retrySecs = Math.ceil(limitState.retryAfterMs / 1000);
      let mins = Math.floor(retrySecs / 60);
      let hrs = Math.floor(mins / 60);
      mins = mins % 60;
      let msg = "You can only add one comment per day per video from your IP address.";
      if (retrySecs > 0) {
        let human = "";
        if (hrs > 0) human += `${hrs}h `;
        if (mins > 0) human += `${mins}m `;
        if (retrySecs % 60 > 0) human += `${retrySecs % 60}s`;
        msg += ` Please try again in ${human.trim()}.`;
      }
      return res.status(429).json({ error: msg, retryAfterSeconds: retrySecs });
    }
  } catch (rateErr) {
    console.error("Comment rate limit internal error:", rateErr);
    return res.status(500).json({ error: "Rate limit check failed." });
  }

  // --- OpenAI Moderation Check ---
  try {
    let moderationResult;
    try {
      moderationResult = await moderateText(content.trim());
    } catch (e) {
      console.error('OpenAI moderation API error:', e);
      return res.status(500).json({ error: 'Comment could not be checked for safety. Please try again later.' });
    }
    if (moderationResult.flagged) {
      // Log more details for auditing
      console.warn('Comment flagged by moderation:', {
        content: content.trim(),
        categories: moderationResult.categories,
        reasons: moderationResult.reasons
      });
      return res.status(400).json({
        error: 'Your comment could not be added because it may violate our content guidelines.'
      });
    }
    // --- record the comment in rateLimitComments collection for this IP/video ---
    try {
      const clientIp = getClientIp(req);
      // Ensure (IP, videoId) updated or inserted before actual comment insert
      await recordComment({
        videoId: rateLimitId,
        type: rateLimitType,
        clientIp,
      });
    } catch (err) {
      console.error("Error updating rateLimitComments collection:", err);
      // Don't block comment post if just stats error, but log it
      // (Or you can block and error out if data integrity is paramount)
      return res.status(500).json({ error: "Failed to update comment rate limit. Please try again." });
    }
    const db = await getDb();
    const doc = {
      videoObjectId: videoObjectId || null,
      filenameHash: filenameHash || null,
      content: content.trim(),
      created: new Date()
    };
    const result = await db.collection('comments').insertOne(doc);
    return res.status(201).json({ _id: result.insertedId, ...doc });
  } catch (err) {
    console.error('POST /api/comments error:', err);
    return res.status(500).json({ error: 'Failed to add comment.' });
  }
});

// --- Get comments for a video by videoId (ObjectId or hash) ---
// GET /api/comments/:videoId
router.get('/:videoId', async (req, res) => {
  const { videoId } = req.params;
  if (!videoId) {
    return res.status(400).json({ error: 'No videoId specified.' });
  }
  let query = {};
  if (/^[a-fA-F0-9]{24}$/.test(videoId)) {
    query.videoObjectId = new ObjectId(videoId);
  } else if (/^[a-fA-F0-9]{32}$/.test(videoId)) {
    query.filenameHash = videoId.toLowerCase();
  } else {
    return res.status(400).json({ error: 'Invalid videoId format.' });
  }
  try {
    const db = await getDb();
    const comments = await db
      .collection('comments')
      .find(query)
      .sort({ created: 1 })
      .toArray();
    // Remove database-internal fields for client
    const safeComments = comments.map(({ _id, content, created }) => ({
      _id,
      content,
      created
    }));
    return res.json(safeComments);
  } catch (err) {
    console.error('GET /api/comments/:videoId error:', err);
    return res.status(500).json({ error: 'Failed to fetch comments.' });
  }
});

export default router;
// To use OpenAI moderation your environment must have OPENAI_API_KEY set (see README or deployment docs)
// If you see "OpenAI moderation not configured", set the variable in your .env or deployment environment.


