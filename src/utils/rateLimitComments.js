// Utility for rate limit storage and per-video/IP logic for comments
import { getDb } from './mongo.js';

/**
Schema in 'rateLimitComments' collection:
One document per video. Example:
{
  _id: ObjectId,
  videoId: ObjectId | string (filenameHash),
  type: 'objectId' | 'hash',
  ips: [
    { ip: "1.2.3.4", lastComment: ISODate },
    ...
  ]
}
*/

const COLLECTION_NAME = 'rateLimitComments';
const RATE_LIMIT_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function getRateLimitDoc(videoId, type) {
  const db = await getDb();
  const query = type === 'objectId' ? { videoId: videoId, type: 'objectId' } : { videoId, type: 'hash' };
  const doc = await db.collection(COLLECTION_NAME).findOne(query);
  return doc;
}

export async function canComment({ videoId, type, clientIp }) {
  // Returns { allowed: boolean, retryAfterMs: number|null, lastComment: Date|null, doc }
  const doc = await getRateLimitDoc(videoId, type);
  if (!doc) {
    return { allowed: true, retryAfterMs: null, lastComment: null, doc: null };
  }
  if (!Array.isArray(doc.ips)) {
    return { allowed: true, retryAfterMs: null, lastComment: null, doc };
  }
  const entry = doc.ips.find(iplog => iplog.ip === clientIp);
  if (!entry || !entry.lastComment) {
    return { allowed: true, retryAfterMs: null, lastComment: null, doc };
  }
  const now = Date.now();
  const last = new Date(entry.lastComment).getTime();
  const delta = now - last;
  if (delta >= RATE_LIMIT_MS) {
    return { allowed: true, retryAfterMs: null, lastComment: entry.lastComment, doc };
  }
  return { allowed: false, retryAfterMs: RATE_LIMIT_MS - delta, lastComment: entry.lastComment, doc };
}

export async function recordComment({ videoId, type, clientIp }) {
  // On first comment: create; on repeat: upsert IP in array and update timestamp
  const db = await getDb();
  const now = new Date();
  const filter = type === 'objectId' ? { videoId: videoId, type: 'objectId' } : { videoId, type: 'hash' };
  const update = {
    $setOnInsert: {
      videoId: videoId,
      type: type,
    },
    $set: {
      // No global updated field needed
    },
    $push: {
      // We'll use $set/email for upsert, not $push
    }
  };
  // Upsert IP entry in the array: if exists, update, else add
  // Use MongoDB's positional operator (arrayFilters)
  const doc = await db.collection(COLLECTION_NAME).findOne(filter);
  if (!doc) {
    await db.collection(COLLECTION_NAME).insertOne({
      videoId,
      type,
      ips: [ { ip: clientIp, lastComment: now } ],
    });
    return;
  }
  // Check if the ip exists
  let match = false;
  for (const ipEntry of doc.ips) {
    if (ipEntry.ip === clientIp) {
      match = true;
      break;
    }
  }
  if (!match) {
    // Add new entry
    await db.collection(COLLECTION_NAME).updateOne(
      filter,
      { $push: { ips: { ip: clientIp, lastComment: now } } }
    );
  } else {
    // Update that IP's lastComment
    await db.collection(COLLECTION_NAME).updateOne(
      {...filter, 'ips.ip': clientIp },
      { $set: { 'ips.$.lastComment': now } }
    );
  }
}
