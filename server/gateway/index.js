import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import httpProxy from 'http-proxy';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';

import { listCharactersForWowLogin } from './lib/ac-characters.js';
import { ensureWowAccount } from './lib/ac-provision.js';
import {
  completeGrudgeProfile,
  fetchGrudgeProfileFromRequest,
  needsUsernameSetup,
} from './lib/grudge-auth.js';
import { grudgePlayerReference } from './lib/player-public.js';
import { PlayerStore } from './lib/player-store.js';
import { isValidGrudgeUsername } from './lib/username.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: process.env.DOTENV_PATH || path.resolve(__dirname, '../../.env') });

const PORT = Number(process.env.GATEWAY_PORT || 8787);
const PIPELINE_URL = process.env.PIPELINE_URL || 'http://127.0.0.1:3000';
const WOW_AUTH_HOST = process.env.WOW_AUTH_HOST || '127.0.0.1:3724';
const WOW_WORLD_HOST = process.env.WOW_WORLD_HOST || '127.0.0.1:8085';
const PUBLIC_PIPELINE_URL = process.env.PUBLIC_PIPELINE_URL || 'https://wow-pipeline.grudge-studio.com';
const PUBLIC_AUTH_WS = process.env.PUBLIC_AUTH_WS || 'wss://wow-auth.grudge-studio.com';
const PUBLIC_WORLD_WS = process.env.PUBLIC_WORLD_WS || 'wss://wow-world.grudge-studio.com';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://wow.grudge-studio.com';
const GRUDGE_AUTH_URL = process.env.GRUDGE_AUTH_URL || 'https://id.grudge-studio.com';
const REQUIRE_GRUDGE_AUTH = process.env.REQUIRE_GRUDGE_AUTH !== 'false';

const playerStore = new PlayerStore();

function readBearerToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

async function requireGrudgeAuth(req, res, next) {
  if (!REQUIRE_GRUDGE_AUTH) {
    req.grudgeUser = {
      grudgeId: 'local-dev',
      username: 'local-dev',
      displayName: 'local-dev',
    };
    req.grudgeToken = null;
    return next();
  }

  const token = readBearerToken(req);
  const user = await fetchGrudgeProfileFromRequest(req, GRUDGE_AUTH_URL);
  if (!user) {
    return res.status(401).json({ error: 'Grudge ID required. Sign in at id.grudge-studio.com.' });
  }
  req.grudgeUser = user;
  req.grudgeToken = token;
  return next();
}

function publicPlayerView(profile, playerRecord) {
  const grudgeUsername = playerRecord?.grudgeUsername || profile.displayName || profile.username;
  const setupRequired = needsUsernameSetup(profile, playerRecord);

  return {
    grudgeId: profile.grudgeId,
    grudgeUsername,
    displayName: profile.displayName || grudgeUsername,
    needsUsernameSetup: setupRequired,
    usernameSetupComplete: Boolean(playerRecord?.usernameSetupComplete),
    isFirstLaunch: !playerRecord?.firstLaunchAt,
    wowAccountReady: Boolean(playerRecord?.wowAccount?.login),
    wowLogin: playerRecord?.wowAccount?.login || null,
    launchCount: playerRecord?.launchCount || 0,
  };
}

const app = express();
app.use('/api', cors({
  origin: [CORS_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'wow-grudge-gateway',
    pipeline: PIPELINE_URL,
    auth: WOW_AUTH_HOST,
    world: WOW_WORLD_HOST,
    playerStore: playerStore.filePath,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/config', (_req, res) => {
  res.json({
    pipelineUrl: PUBLIC_PIPELINE_URL,
    authWsUrl: PUBLIC_AUTH_WS,
    worldWsUrl: PUBLIC_WORLD_WS,
    clientVersion: '3.3.5a',
    realm: process.env.WOW_REALM_NAME || 'Grudge WoW',
    grudgeAuthUrl: GRUDGE_AUTH_URL,
    requiresGrudgeId: REQUIRE_GRUDGE_AUTH,
  });
});

app.get('/api/player/me', requireGrudgeAuth, (req, res) => {
  const record = playerStore.get(req.grudgeUser.grudgeId);
  res.json(publicPlayerView(req.grudgeUser, record));
});

app.get('/api/grudge/player/:grudgeId', requireGrudgeAuth, (req, res) => {
  const { grudgeId } = req.params;
  if (req.grudgeUser.grudgeId !== grudgeId) {
    return res.status(403).json({ error: 'Can only look up your own Grudge ID profile.' });
  }
  const record = playerStore.get(grudgeId);
  res.json(grudgePlayerReference(req.grudgeUser, record));
});

app.get('/api/player/characters', requireGrudgeAuth, async (req, res) => {
  const record = playerStore.get(req.grudgeUser.grudgeId);
  const wowLogin = record?.wowAccount?.login;
  if (!wowLogin) {
    return res.json({
      grudgeUsername: record?.grudgeUsername || req.grudgeUser.displayName,
      wowLogin: null,
      characters: [],
      message: 'Launch once to provision your WoW account.',
    });
  }

  const result = await listCharactersForWowLogin(wowLogin);
  res.json({
    grudgeId: req.grudgeUser.grudgeId,
    grudgeUsername: record.grudgeUsername,
    wowLogin,
    accountId: result.accountId || null,
    dbAvailable: result.available,
    characters: result.characters,
    error: result.error || null,
  });
});

app.post('/api/player/username', requireGrudgeAuth, async (req, res) => {
  try {
    const { action, username } = req.body || {};
    const profile = req.grudgeUser;
    const token = req.grudgeToken;
    let grudgeUsername = profile.displayName || profile.username;

    if (action === 'set') {
      if (!isValidGrudgeUsername(username)) {
        return res.status(400).json({
          error: 'Usernames must be 3–30 characters: letters, numbers, underscore, or hyphen.',
        });
      }
      if (token) {
        const updated = await completeGrudgeProfile(
          token,
          GRUDGE_AUTH_URL,
          { username: username.trim() },
          req.headers.cookie,
        );
        grudgeUsername = updated.displayName || updated.username || username.trim();
      } else {
        grudgeUsername = username.trim();
      }
    } else if (action !== 'accept') {
      return res.status(400).json({ error: 'action must be "accept" or "set"' });
    }

    const record = playerStore.upsert(profile.grudgeId, {
      grudgeUsername,
      usernameSetupComplete: true,
      usernameAcceptedAt: new Date().toISOString(),
      usernameSource: action === 'set' ? 'changed' : 'accepted',
    });

    res.json({
      ok: true,
      player: publicPlayerView(
        { ...profile, displayName: grudgeUsername, username: grudgeUsername },
        record,
      ),
    });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ error: error.message || 'Could not save username' });
  }
});

app.post('/api/play/direct', requireGrudgeAuth, async (req, res) => {
  try {
    const user = req.grudgeUser;
    const record = playerStore.get(user.grudgeId);

    if (needsUsernameSetup(user, record)) {
      return res.status(409).json({
        error: 'Choose or accept your Grudge username before launching.',
        needsUsernameSetup: true,
      });
    }

    const grudgeUsername = record.grudgeUsername || user.displayName || user.username;
    playerStore.touchLaunch(user.grudgeId);

    const wow = await ensureWowAccount({
      grudgeId: user.grudgeId,
      grudgeUsername,
      playerStore,
    });

    const characters = await listCharactersForWowLogin(wow.login);

    res.json({
      mode: 'wowser',
      accountId: user.grudgeId,
      grudgeId: user.grudgeId,
      grudgeUsername,
      username: grudgeUsername,
      wowAccount: {
        login: wow.login,
        password: wow.password,
        created: wow.created,
      },
      characters: characters.characters,
      pipelineUrl: PUBLIC_PIPELINE_URL,
      authWsUrl: PUBLIC_AUTH_WS,
      worldWsUrl: PUBLIC_WORLD_WS,
      clientUrl: CORS_ORIGIN,
      realm: process.env.WOW_REALM_NAME || 'Grudge WoW',
      message: wow.created
        ? `Welcome ${grudgeUsername}! Your WoW account is ready.`
        : `Welcome back, ${grudgeUsername}.`,
    });
  } catch (error) {
    console.error('[wow-gateway] play/direct failed:', error.message);
    res.status(502).json({ error: error.message || 'Unable to start Wowser session.' });
  }
});

app.post('/api/play/disconnect', requireGrudgeAuth, (req, res) => {
  res.json({ ok: true, grudgeId: req.grudgeUser?.grudgeId || null });
});

const proxy = httpProxy.createProxyServer({ changeOrigin: true, ws: true });
app.use('/pipeline', (req, res) => {
  proxy.web(req, res, { target: PIPELINE_URL }, (err) => {
    res.status(502).json({ error: 'Pipeline offline', detail: err.message });
  });
});

// Serve static launcher (frontend/site) for live/self-hosted deployment.
// Main domain (wow.grudge-studio.com) can route here via cloudflared.
// Specific routes (/api/*, /pipeline, ws upgrades) are handled above.
const launcherDir = path.resolve(__dirname, '../../launcher');

// Support auth callback from Grudge ID (matches vercel rewrite and external redirects)
app.get(['/auth/callback', '/auth/callback.html'], (_req, res) => {
  res.sendFile(path.resolve(launcherDir, 'auth/callback.html'));
});

app.use(express.static(launcherDir, { index: 'index.html' }));

const server = http.createServer(app);

function attachTcpBridge(wss, targetHost) {
  wss.on('connection', (browserSocket) => {
    const [host, portStr] = targetHost.split(':');
    const port = Number(portStr);
    import('net').then(({ default: net }) => {
      const upstream = net.createConnection({ host, port }, () => {
        browserSocket.on('message', (data) => upstream.write(data));
        upstream.on('data', (chunk) => {
          if (browserSocket.readyState === 1) browserSocket.send(chunk);
        });
      });
      const closeBoth = () => {
        try { browserSocket.close(); } catch {}
        try { upstream.destroy(); } catch {}
      };
      browserSocket.on('close', closeBoth);
      browserSocket.on('error', closeBoth);
      upstream.on('close', closeBoth);
      upstream.on('error', closeBoth);
    });
  });
}

const authWss = new WebSocketServer({ noServer: true, path: '/auth' });
const worldWss = new WebSocketServer({ noServer: true, path: '/world' });
attachTcpBridge(authWss, WOW_AUTH_HOST);
attachTcpBridge(worldWss, WOW_WORLD_HOST);

server.on('upgrade', (req, socket, head) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  const host = (req.headers.host || '').toLowerCase();
  const isAuth = pathname === '/auth' || host.startsWith('wow-auth.');
  const isWorld = pathname === '/world' || host.startsWith('wow-world.');
  if (isAuth) {
    authWss.handleUpgrade(req, socket, head, (ws) => authWss.emit('connection', ws, req));
    return;
  }
  if (isWorld) {
    worldWss.handleUpgrade(req, socket, head, (ws) => worldWss.emit('connection', ws, req));
    return;
  }
  if (pathname.startsWith('/pipeline')) {
    proxy.ws(req, socket, head, { target: PIPELINE_URL });
    return;
  }
  socket.destroy();
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[wow-gateway] listening on http://0.0.0.0:${PORT}`);
  console.log(`[wow-gateway] pipeline -> ${PIPELINE_URL}`);
  console.log(`[wow-gateway] auth ws   -> ${WOW_AUTH_HOST}`);
  console.log(`[wow-gateway] world ws  -> ${WOW_WORLD_HOST}`);
  console.log(`[wow-gateway] players   -> ${playerStore.filePath}`);
});