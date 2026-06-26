#!/usr/bin/env node
/**
 * End-to-end Grudge WoW flow test (cookie + bearer auth)
 */
const GATEWAY = process.env.GATEWAY_URL || 'http://127.0.0.1:8787/api';
const GRUDGE_AUTH = process.env.GRUDGE_AUTH_URL || 'https://id.grudge-studio.com';
const LOCAL_AUTH_OFF = process.env.REQUIRE_GRUDGE_AUTH === 'false';

async function request(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  return { status: res.status, ok: res.ok, body, headers: res.headers };
}

function assert(label, condition, detail = '') {
  if (!condition) throw new Error(`${label}${detail ? `: ${detail}` : ''}`);
  console.log(`  ✓ ${label}`);
}

async function loginWithCookie() {
  const user = `wowtest${Date.now()}`;
  const pass = 'TestPass123!';
  const reg = await request(`${GRUDGE_AUTH}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user, email: `${user}@test.local`, password: pass }),
  });
  assert('register', reg.ok, JSON.stringify(reg.body));

  const login = await request(`${GRUDGE_AUTH}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user, password: pass }),
  });
  assert('login', login.ok, JSON.stringify(login.body));

  const cookie = login.headers.get('set-cookie');
  assert('session cookie', !!cookie, 'no Set-Cookie from login');

  return { cookie, grudgeId: login.body.grudgeId, username: user };
}

async function main() {
  console.log('=== Grudge WoW flow test ===');
  console.log(`Gateway: ${GATEWAY}`);
  console.log(`Auth:    ${GRUDGE_AUTH}`);
  console.log(`Mode:    ${LOCAL_AUTH_OFF ? 'local (auth off)' : 'cookie session'}\n`);

  console.log('1) Gateway health');
  const health = await request(`${GATEWAY}/health`);
  assert('gateway online', health.ok, JSON.stringify(health.body));

  let authHeaders = { 'Content-Type': 'application/json' };
  let grudgeId = 'local-dev';
  let username = `local_${Date.now().toString(36).slice(-6)}`;

  if (!LOCAL_AUTH_OFF) {
    console.log('\n2) Grudge ID login (cookie session)');
    const session = await loginWithCookie();
    authHeaders.Cookie = session.cookie.split(';')[0];
    grudgeId = session.grudgeId;
    username = `wow_${Date.now().toString(36).slice(-6)}`;
    assert('grudgeId', !!grudgeId);
  } else {
    console.log('\n2) Skipping auth (REQUIRE_GRUDGE_AUTH=false)');
  }

  console.log('\n3) Player profile (first launch)');
  const me1 = await request(`${GATEWAY}/player/me`, { headers: authHeaders });
  assert('player/me', me1.ok, JSON.stringify(me1.body));
  assert('needs username setup', me1.body.needsUsernameSetup === true);

  console.log('\n4) Set Grudge username');
  const accept = await request(`${GATEWAY}/player/username`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ action: 'set', username }),
  });
  assert('username saved', accept.ok, JSON.stringify(accept.body));
  assert('setup complete', accept.body.player?.usernameSetupComplete === true);

  console.log('\n5) Launch / provision WoW account');
  const play = await request(`${GATEWAY}/play/direct`, {
    method: 'POST',
    headers: authHeaders,
    body: '{}',
  });
  assert('play/direct', play.ok, JSON.stringify(play.body));
  assert('wow login', !!play.body.wowAccount?.login);
  assert('wow password', !!play.body.wowAccount?.password);

  console.log('\n6) Characters list');
  const chars = await request(`${GATEWAY}/player/characters`, { headers: authHeaders });
  assert('characters endpoint', chars.ok, JSON.stringify(chars.body));
  console.log(`     characters: ${chars.body.characters?.length || 0} (db: ${chars.body.dbAvailable})`);

  if (!LOCAL_AUTH_OFF) {
    console.log('\n7) Cross-game Grudge player lookup');
    const lookup = await request(`${GATEWAY}/grudge/player/${grudgeId}`, { headers: authHeaders });
    assert('grudge lookup', lookup.ok, JSON.stringify(lookup.body));
    assert('lookup username', lookup.body.grudgeUsername === username);
  }

  console.log('\n8) Return launch');
  const play2 = await request(`${GATEWAY}/play/direct`, {
    method: 'POST',
    headers: authHeaders,
    body: '{}',
  });
  assert('second launch', play2.ok, JSON.stringify(play2.body));

  console.log('\n=== ALL TESTS PASSED ===');
  console.log(`Grudge username: ${username}`);
  console.log(`WoW login:       ${play.body.wowAccount.login}`);
  console.log(`WoW password:    ${play.body.wowAccount.password}`);
  if (!LOCAL_AUTH_OFF) console.log(`Grudge ID:       ${grudgeId}`);
}

main().catch((err) => {
  console.error('\n✗ TEST FAILED:', err.message);
  process.exit(1);
});