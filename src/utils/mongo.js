// Helper to escape RegExp special chars in search keywords
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Search videos by query string, return array sorted by likes desc, limited to 50
export async function searchVideos(searchString) {
  const col = await getVideosCollection();
  if (typeof searchString !== 'string' || !searchString.trim()) return [];
  // Split by whitespace, filter out empty words
  const words = searchString
    .split(/\s+/)
    .map(w => w.trim())
    .filter(Boolean);
  if (words.length === 0) return [];
  // For each word, build a $or: title, description, tags (partial, case-insensitive)
  // Each word: match if it's in title, description, or tags. All words must match (AND).
  const andClauses = words.map(word => {
    // Sanitize the word for regex (to prevent injection)
    const safe = escapeRegExp(word);
    // Use partial matching (anywhere in field), case-insensitive
    const regex = new RegExp(safe, 'i');
    return {
      $or: [
        { title: regex },
        { description: regex },
        { tags: { $elemMatch: { $regex: regex } } }
      ]
    };
  });
  const query = { $and: andClauses };
  // Limit results, sort by likes descending, fallback to uploaded date if tie
  const docs = await col
    .find(query)
    .sort({ likes: -1, uploaded: -1 })
    .limit(50)
    .toArray();
  // Ensure likes, viewCount, etc. returned same as listing
  return docs.map(v => ({
    ...v,
    viewCount: (typeof v.viewCount === 'number') ? v.viewCount : 0,
    likes: (typeof v.likes === 'number') ? v.likes : 0,
  }));
}
// MongoDB utility connection and helpers
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DBNAME = process.env.MONGODB_DBNAME || undefined;
let client;
let db;

async function getMongoClient() {
  if (!MONGODB_URI) throw new Error('MONGODB_URI env variable is required');
  if (!client) {
    client = new MongoClient(MONGODB_URI, {
      // You can add any important options here
    });
    await client.connect();
  }
  return client;
}
export async function getVideosCollection() {
  await getMongoClient();
  if (!db) {
    db = client.db(MONGODB_DBNAME); // If no db name is set, uses the one in MONGODB_URI
  }
  return db.collection('videos');
}

export async function getDb() {
  await getMongoClient();
  if (!db) {
    db = client.db(MONGODB_DBNAME);
  }
  return db;
}
export async function insertVideo(doc) {
  const col = await getVideosCollection();
  // Ensure the viewCount is initialized to 0 if not set in doc
  if (typeof doc.viewCount !== 'number') doc.viewCount = 0;
  if (typeof doc.likes !== 'number') doc.likes = 0;
  const result = await col.insertOne(doc);
  // Return the inserted document with its _id
  return { ...doc, _id: result.insertedId };
}
export async function findAllVideos() {
  const col = await getVideosCollection();
  // Always include viewCount in the returned results (default to 0 if missing for legacy)
  const rawVideos = await col.find({}).sort({ uploaded: -1 }).toArray();
  return rawVideos.map(v => ({
    ...v,
    viewCount: (typeof v.viewCount === 'number') ? v.viewCount : 0,
    likes: (typeof v.likes === 'number') ? v.likes : 0,
  }));
}

// Utility: Find a single video by filenameHash (for debugging/demo)
export async function findVideoByFilenameHash(hash) {
  const col = await getVideosCollection();
  return await col.findOne({ filenameHash: hash });
}



// --------- COMMENTS COLLECTION UTILS ---------


let commentsCol = null;
export async function getCommentsCollection() {
  await getMongoClient();
  if (!db) {
    db = client.db(MONGODB_DBNAME);
  }
  if (!commentsCol) {
    commentsCol = db.collection('comments');
    // Consider indexes for videoId, if doing more advanced queries later
  }
  return commentsCol;
}

// Insert comment: Accepts { videoId, filenameHash, content, created }
// Uses both videoId (ObjectId) and filenameHash (if provided)
export async function insertComment({ videoId, filenameHash, content }) {
  const col = await getCommentsCollection();
  const doc = {
    content: typeof content === "string" ? content.trim() : "",
    created: new Date(),
  };
  // Accept either or both identifiers
  if (videoId) doc.videoId = videoId;
  if (filenameHash) doc.filenameHash = filenameHash;
  const result = await col.insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

// Find all comments for a video, by videoId or filenameHash
// videoIdArg: ObjectId|string, hashArg: string
export async function findCommentsForVideo({ videoId, filenameHash }) {
  const col = await getCommentsCollection();
  let query = {};
  if (videoId && filenameHash) {
    query = { $or: [{ videoId: videoId }, { filenameHash: filenameHash }] };
  } else if (videoId) {
    query = { videoId: videoId };
  } else if (filenameHash) {
    query = { filenameHash: filenameHash };
  } else {
    // No identifier; empty results
    return [];
  }
  const comments = await col.find(query).sort({ created: 1 }).toArray();
  return comments;
}

// For test/debug only
export async function clearCommentsCollection() {
  const col = await getCommentsCollection();
  await col.deleteMany({});
}



