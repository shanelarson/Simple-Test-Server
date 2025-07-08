// Load environment variables from .env file first
import 'dotenv/config';



// Video Sharing Platform Server Entry Index File
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

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

// ----- API Endpoints from src/endpoints/ -----
import getVideosRouter from './endpoints/getVideos.js';
import uploadVideoRouter from './endpoints/uploadVideo.js';
import getVideoByIdRouter from './endpoints/getVideoById.js';

// Combine both the video list and get-by-id routers into one under /api/videos
import { Router } from 'express';
const videosRouter = Router();
// Mount the list endpoint
videosRouter.use('/', getVideosRouter);
// Mount the get-by-id endpoint (must come after "/")
videosRouter.use('/', getVideoByIdRouter);

app.use('/api/videos', videosRouter);
app.use('/api/upload', uploadVideoRouter);

// ========== Fallback: handle everything else by returning SPA ==========







// Serve /view path with video ID to core.html, injecting params via a script tag
app.get('/view', (req, res) => {
  const id = typeof req.query.id === 'string' ? req.query.id : undefined;
  // Only allow HEX hashes, up to 64 chars for safety (covers md5/sha256 if needed)
  const validId = id && /^[a-fA-F0-9]{24,64}$/.test(id);
  // Read core.html as string, inject window.VIEW_MODE/VIDEO_ID, send to client
  const filePath = path.join(uiPath, 'core.html');
  fs.readFile(filePath, 'utf8', (err, html) => {
    if (err) return res.status(500).send('Internal server error');




    let inject = '';
    inject += `<script>window.VIEW_MODE="view";window.VIDEO_ID=${validId ? JSON.stringify(id) : 'null'};</script>`;
    // Inject our script after <body> tag
    html = html.replace(/<body[^>]*>/, bodyMatch => `${bodyMatch}\n${inject}`);
    res.send(html);
  });
});

// Fallback: handle everything else by returning SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(uiPath, 'core.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Video sharing app listening at http://localhost:${PORT}`);
});









