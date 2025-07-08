// Comments API endpoints for video comments
import express from 'express';
import { ObjectId } from 'mongodb';
import { getDb } from '../utils/mongo.js';
import fetch from 'node-fetch';

const router = express.Router();

/**
 * Helper to call OpenAI Moderation API on the provided text.
 * Returns { flagged: boolean } or throws on error.
 */
async function moderateCommentWithOpenAI(text) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI moderation not configured');
  }
  const response = await fetch('https://api.openai.com/v1/moderations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ input: text })
  });
  if (!response.ok) {
    // Most common error: 429 - Too Many Requests, or API down
    const body = await response.text();
    throw new Error('Moderation API error: ' + (body || response.statusText));
  }
  const data = await response.json();
  if (!data || !Array.isArray(data.results) || !data.results[0]) {
    throw new Error('Unexpected response from moderation API');
  }
  return { flagged: !!data.results[0].flagged };
}

// --- Add a comment to a video ---
// POST /api/comments { videoId, content }
router.post('/', async (req, res) => {
  const { videoId, content } = req.body;
  if (!videoId || typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: 'Missing videoId or comment content.' });
  }
  // Sanitize content length
  if (content.length > 1000) {
    return res.status(400).json({ error: 'Comment too long (max 1000 chars).' });
  }
  // Accept videoId as ObjectId or filenameHash (md5)
  let videoObjectId = null, filenameHash = null;
  if (/^[a-fA-F0-9]{24}$/.test(videoId)) {
    videoObjectId = new ObjectId(videoId);
  } else if (/^[a-fA-F0-9]{32}$/.test(videoId)) {
    filenameHash = videoId.toLowerCase();
  } else {
    return res.status(400).json({ error: 'Invalid videoId format.' });
  }
  // --- OpenAI Moderation Check ---
  try {
    let moderationResult;
    try {
      moderationResult = await moderateCommentWithOpenAI(content.trim());
    } catch (e) {
      console.error('OpenAI moderation API error:', e);
      return res.status(500).json({ error: 'Comment could not be checked for safety. Please try again later.' });
    }
    if (moderationResult.flagged) {
      return res.status(400).json({
        error: 'Your comment could not be added because it may violate our content guidelines.'
      });
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


