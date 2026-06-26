#!/usr/bin/env node
/**
 * Non-interactive config for server/wowser (wowserhq/wowser pipeline + blizzardry MPQ).
 * Run after: cd server/wowser && npm install && npm run gulp
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(root, '.env') });

const mpqPath = process.env.WOW_MPQ_DATA_PATH;
if (!mpqPath || !fs.existsSync(mpqPath)) {
  console.error('[skip] WOW_MPQ_DATA_PATH not set or missing — wowserhq MPQ pipeline needs licensed 3.3.5a Data/');
  process.exit(0);
}

const configDir = path.join(process.env.APPDATA || path.join(process.env.HOME || '', '.config'), 'Config', 'wowser');
const configFile = path.join(configDir, 'config.json');
const config = {
  clientData: mpqPath.replace(/\\/g, '/'),
  clusterWorkerCount: 1,
  isFirstRun: false,
  serverPort: String(process.env.WOWSER_NATIVE_PORT || 3001),
};

fs.mkdirSync(configDir, { recursive: true });
fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
console.log(`[ok] wowser config -> ${configFile}`);
console.log(`     clientData: ${config.clientData}`);
console.log(`     port: ${config.serverPort}`);
console.log('Start: cd server/wowser && npm run serve');