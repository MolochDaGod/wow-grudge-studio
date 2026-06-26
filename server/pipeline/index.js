import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: process.env.DOTENV_PATH || path.resolve(__dirname, '../../.env') });

const PORT = Number(process.env.PIPELINE_PORT || 3000);
const WOW_DATA_PATH = process.env.WOW_DATA_PATH || '';
const WOW_MPQ_DATA_PATH = process.env.WOW_MPQ_DATA_PATH || '';
const WOWSER_PUBLIC = process.env.WOWSER_PUBLIC || path.resolve(__dirname, '../../frontend/wowser-client/public');
const WOWSER_NATIVE_URL = process.env.WOWSER_NATIVE_URL || '';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://wow.grudge-studio.com';

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

const dataExists = WOW_DATA_PATH && fs.existsSync(WOW_DATA_PATH);
const mpqExists = WOW_MPQ_DATA_PATH && fs.existsSync(WOW_MPQ_DATA_PATH);
const wowserPublicExists = fs.existsSync(WOWSER_PUBLIC);

function resolvePublicFile(relativePath) {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  const full = path.join(WOWSER_PUBLIC, normalized);
  if (!full.startsWith(WOWSER_PUBLIC) || !fs.existsSync(full)) return null;
  return full;
}

function resolveDataFile(relativePath) {
  if (!dataExists) return null;
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  const full = path.join(WOW_DATA_PATH, normalized);
  if (fs.existsSync(full)) return full;
  return null;
}

function globPublic(query) {
  const pattern = query.replace(/\*/g, '').toLowerCase();
  const hits = [];
  function walk(dir, prefix = '') {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path.join(dir, entry.name), rel);
      else if (rel.toLowerCase().includes(pattern)) hits.push(rel);
      if (hits.length >= 50) return;
    }
  }
  walk(WOWSER_PUBLIC);
  if (dataExists) walk(WOW_DATA_PATH);
  return hits;
}

/** wowserhq/pipeline-compatible asset router */
const pipeline = express.Router();

pipeline.get('/find/*', (req, res) => {
  const q = (req.params[0] || '').replace(/^\//, '');
  res.json(globPublic(q));
});

pipeline.get('*', (req, res, next) => {
  let rel = (req.params[0] || req.path || '').replace(/^\//, '');
  if (!rel) return next();

  if (/\.blp\.png$/i.test(rel)) {
    const pngPath = rel.replace(/\.blp\.png$/i, '.png');
    const pngFile = resolvePublicFile(pngPath) || resolveDataFile(pngPath);
    if (pngFile) return res.sendFile(pngFile);
  }

  const file = resolvePublicFile(rel) || resolveDataFile(rel);
  if (file) return res.sendFile(file);

  if (WOWSER_NATIVE_URL) {
    return proxyToNative(req, res, `/pipeline/${rel}`);
  }
  return res.status(404).json({ error: 'resource not found', path: rel });
});

function proxyToNative(req, res, targetPath) {
  const url = new URL(targetPath, WOWSER_NATIVE_URL);
  http.get(url, (upstream) => {
    res.status(upstream.statusCode || 502);
    upstream.pipe(res);
  }).on('error', (err) => {
    res.status(502).json({ error: 'wowser native pipeline offline', detail: err.message });
  });
}

app.use('/pipeline', pipeline);

app.get('/health', (_req, res) => {
  res.json({
    status: dataExists || wowserPublicExists || mpqExists ? 'ok' : 'missing-data',
    pipelineApi: '/pipeline',
    dataPath: WOW_DATA_PATH || null,
    mpqDataPath: mpqExists ? WOW_MPQ_DATA_PATH : null,
    wowserPublic: wowserPublicExists,
    wowserNative: WOWSER_NATIVE_URL || null,
    message: mpqExists
      ? 'wowserhq/pipeline MPQ path configured'
      : dataExists
        ? 'Pipeline ready with WoW client data (add WOW_MPQ_DATA_PATH for Interface/BLP)'
        : wowserPublicExists
          ? 'Pipeline ready with Wowser public stubs'
          : 'No asset paths configured',
  });
});

app.get('/status', (_req, res) => {
  res.json({
    service: 'wow-grudge-pipeline',
    wowserhq: 'https://github.com/wowserhq/pipeline',
    dataExists,
    mpqExists,
    wowserPublicExists,
    corsOrigin: CORS_ORIGIN,
    note: 'Emulates original wowserhq/wowser pipeline for /pipeline/* (find, assets from public + client data)',
  });
});

if (wowserPublicExists) {
  app.use(express.static(WOWSER_PUBLIC));
}

if (dataExists) {
  app.use('/data', express.static(WOW_DATA_PATH));
  app.use(express.static(WOW_DATA_PATH));
}

app.get('/', (_req, res) => {
  res.json({
    service: 'wow-grudge-pipeline',
    wowser: 'https://github.com/wowserhq',
    pipeline: '/pipeline',
    dataReady: dataExists,
    mpqReady: mpqExists,
    wowserPublicReady: wowserPublicExists,
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[wow-pipeline] listening on http://0.0.0.0:${PORT}`);
  console.log(`[wow-pipeline] wowserhq /pipeline API enabled`);
  console.log(`[wow-pipeline] data path: ${WOW_DATA_PATH || '(not set)'}`);
  console.log(`[wow-pipeline] mpq path: ${WOW_MPQ_DATA_PATH || '(not set)'}`);
  console.log(`[wow-pipeline] wowser public: ${WOWSER_PUBLIC}`);
  if (WOWSER_NATIVE_URL) console.log(`[wow-pipeline] native wowser proxy: ${WOWSER_NATIVE_URL}`);
});