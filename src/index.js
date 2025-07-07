// Video Sharing Platform Server Entry Index File
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

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

app.use('/api/videos', getVideosRouter);
app.use('/api/upload', uploadVideoRouter);

// ========== Fallback: handle everything else by returning SPA ==========
app.get('*', (req, res) => {
  res.sendFile(path.join(uiPath, 'core.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Video sharing app listening at http://localhost:${PORT}`);
});

