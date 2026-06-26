import { executeSoapCommand } from '../lib/ac-provision.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: process.env.DOTENV_PATH || path.resolve(__dirname, '../../../.env') });

const host = process.env.AC_SOAP_HOST || '127.0.0.1:7878';
try {
  const result = await executeSoapCommand('server info', { host });
  console.log('[ok] SOAP:', result);
} catch (e) {
  console.error('[fail]', e.message);
  process.exit(1);
}