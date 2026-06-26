#!/usr/bin/env node
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { computeVerifier, params: srpParams } = require('@azerothcore/ac-nodejs-srp6');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: process.env.DOTENV_PATH || path.resolve(__dirname, '../../../.env') });

async function main() {
  const host = process.env.AC_MYSQL_HOST || '127.0.0.1';
  const port = Number(process.env.AC_MYSQL_PORT || process.env.DOCKER_DB_EXTERNAL_PORT || 63306);
  const dbUser = process.env.AC_MYSQL_USER || 'root';
  const password = process.env.DOCKER_DB_ROOT_PASSWORD || process.env.AC_MYSQL_PASSWORD || 'password';
  const db = process.env.AC_MYSQL_AUTH_DB || 'acore_auth';
  // AzerothCore stores usernames uppercase
  // AC Utf8ToUpperOnlyLatin() on both fields before SRP6::MakeRegistrationData
  const username = (process.env.AC_SOAP_USER || 'ADMIN').toUpperCase();
  const pass = (process.env.AC_SOAP_PASS || 'admin').toUpperCase();

  const conn = await mysql.createConnection({ host, port, user: dbUser, password, database: db });
  const [rows] = await conn.execute('SELECT id FROM account WHERE username = ?', [username]);
  if (rows.length) {
    console.log(`[ok] account "${username}" exists (id=${rows[0].id})`);
    await conn.end();
    return;
  }

  const salt = crypto.randomBytes(32);
  const verifier = computeVerifier(srpParams.constants, salt, username, pass);
  // SOAP basic auth accepts the password as typed; game login uses uppercased form
  const [result] = await conn.execute(
    'INSERT INTO account (username, salt, verifier, email, reg_mail, joindate) VALUES (?, ?, ?, ?, ?, NOW())',
    [username, salt, verifier, `${username}@grudge.local`, `${username}@grudge.local`],
  );
  await conn.execute(
    'INSERT INTO account_access (id, gmlevel, RealmID, Comment) VALUES (?, 3, -1, ?)',
    [result.insertId, 'Grudge WoW SOAP admin'],
  );
  console.log(`[ok] created "${username}" id=${result.insertId} gmlevel=3`);
  await conn.end();
}

main().catch((e) => { console.error('[fail]', e.message); process.exit(1); });