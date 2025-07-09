// Utility for rate limiting video uploads: max 5 uploads per IP in a rolling 24h window
// MongoDB collection: rateLimitVideos
// Schema: { ip: String, timestamps: [Date, Date, ...] }

import { getDb } from './mongo.js';

const COLLECTION_NAME = 'rateLimitVideos';
const UPLOAD_LIMIT = 5;
const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Returns { allowed: boolean, retryAfterMs: number|null, doc: object|null } for the given IP.
 * Prunes timestamps older than 24h from now before evaluating limit.
 */
export async function canUploadVideo(ip) {
  if (!ip) return { allowed: false, retryAfterMs: null, doc: null };
  const db = await getDb();
  const now = Date.now();
  let doc = await db.collection(COLLECTION_NAME).findOne({ ip });
  if (!doc) {
    return { allowed: true, retryAfterMs: null, doc: null };
  }
  let prunedTimestamps = Array.isArray(doc.timestamps)
    ? doc.timestamps.filter(ts => {
        const t = ts instanceof Date ? ts.getTime() : new Date(ts).getTime();
        return (now - t) <= WINDOW_MS;
      })
    : [];
  // If pruned count changed, update doc
  if (prunedTimestamps.length !== (doc.timestamps?.length || 0)) {
    await db.collection(COLLECTION_NAME).updateOne(
      { ip },
      { $set: { timestamps: prunedTimestamps } }
    );
    doc.timestamps = prunedTimestamps;
  }
  if (prunedTimestamps.length < UPLOAD_LIMIT) {
    return { allowed: true, retryAfterMs: null, doc };
  }
  // Compute earliest next allowed time
  const sorted = prunedTimestamps
    .map(ts => ts instanceof Date ? ts : new Date(ts))
    .sort((a, b) => a - b);
  const firstTs = sorted[0];
  const msUntilOldestExpires = WINDOW_MS - (now - firstTs.getTime());
  return {
    allowed: false,
    retryAfterMs: msUntilOldestExpires > 0 ? msUntilOldestExpires : 0,
    doc
  };
}

/**
 * Record a successful upload for the IP. Prunes >24h old timestamps and pushes a new one.
 * Only call AFTER successful S3/Mongo insertion!
 */
export async function recordVideoUpload(ip) {
  if (!ip) return;
  const db = await getDb();
  const now = new Date();
  // Use atomic update
  const doc = await db.collection(COLLECTION_NAME).findOne({ ip });
  let prunedTimestamps = [];
  if (doc && Array.isArray(doc.timestamps)) {
    const nowMs = now.getTime();
    prunedTimestamps = doc.timestamps
      .map(ts => ts instanceof Date ? ts : new Date(ts))
      .filter(ts => (nowMs - ts.getTime()) <= WINDOW_MS);
  }
  // Add new timestamp and keep only last N (for safety, but typically will be <= 5)
  prunedTimestamps.push(now);
  // Update or insert
  await db.collection(COLLECTION_NAME).updateOne(
    { ip },
    {
      $set: { timestamps: prunedTimestamps },
      $setOnInsert: { ip },
    },
    { upsert: true }
  );
}

// For tests or debug: count of uploads in last 24h
export async function getUploadCountLast24h(ip) {
  const { doc } = await canUploadVideo(ip);
  if (!doc) return 0;
  return doc.timestamps.length;
}

// Export config constants for tests
export const UPLOAD_WINDOW_MS = WINDOW_MS;
export const UPLOAD_LIMIT_PER_WINDOW = UPLOAD_LIMIT;
