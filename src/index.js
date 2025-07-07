// Video Sharing Platform Server Entry Index File
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

// === Mock database (in-memory for dev) ===
const videosDB = [];

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static serving for SPA core.html
// get dirname relative to ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uiPath = path.resolve(__dirname, './ui');

app.use('/ui', express.static(uiPath));

// Serve core.html as SPA entry point
app.get('/', (req, res) => {
  res.sendFile(path.join(uiPath, 'core.html'));
});

// Multer config for file upload (100MB limit, memory storage for mock)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// ========== MOCK API Endpoints ==========

// List uploaded videos (GET /api/videos)
app.get('/api/videos', (req, res) => {
  // In a real app, return from DB
  // videosDB: [{ title, description, uploaded, url }, ...]
  res.json(videosDB);
});

// Upload a video (POST /api/upload)
app.post('/api/upload', upload.single('video'), (req, res) => {
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

  // Respond
  res.status(201).json(record);
});

// ========== Fallback: handle everything else by returning SPA ==========
app.get('*', (req, res) => {
  res.sendFile(path.join(uiPath, 'core.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Video sharing app listening at http://localhost:${PORT}`);
});



