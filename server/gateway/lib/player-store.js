import fs from 'fs';
import path from 'path';

const DEFAULT_PATH = path.resolve(process.cwd(), 'data', 'players.json');

function emptyStore() {
  return { version: 1, players: {} };
}

export class PlayerStore {
  constructor(filePath = process.env.PLAYER_DATA_PATH || DEFAULT_PATH) {
    this.filePath = filePath;
    this.data = emptyStore();
    this.load();
  }

  load() {
    try {
      const dir = path.dirname(this.filePath);
      fs.mkdirSync(dir, { recursive: true });
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        this.data = { ...emptyStore(), ...JSON.parse(raw) };
      } else {
        this.save();
      }
    } catch (error) {
      console.error('[player-store] load failed:', error.message);
      this.data = emptyStore();
    }
  }

  save() {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }

  get(grudgeId) {
    return this.data.players[grudgeId] || null;
  }

  upsert(grudgeId, patch) {
    const existing = this.get(grudgeId) || {
      grudgeId,
      createdAt: new Date().toISOString(),
    };
    const next = {
      ...existing,
      ...patch,
      grudgeId,
      updatedAt: new Date().toISOString(),
    };
    this.data.players[grudgeId] = next;
    this.save();
    return next;
  }

  touchLaunch(grudgeId) {
    const player = this.get(grudgeId);
    const now = new Date().toISOString();
    return this.upsert(grudgeId, {
      firstLaunchAt: player?.firstLaunchAt || now,
      lastLaunchAt: now,
      launchCount: (player?.launchCount || 0) + 1,
    });
  }
}