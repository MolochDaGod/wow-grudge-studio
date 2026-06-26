import http from 'http';
import { generateWowPassword, sanitizeWowLogin } from './username.js';

function buildSoapEnvelope(command) {
  return [
    '<SOAP-ENV:Envelope',
    ' xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"',
    ' xmlns:SOAP-ENC="http://schemas.xmlsoap.org/soap/encoding/"',
    ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    ' xmlns:xsd="http://www.w3.org/2001/XMLSchema"',
    ' xmlns:ns1="urn:AC">',
    '<SOAP-ENV:Body>',
    '<ns1:executeCommand>',
    `<command>${command}</command>`,
    '</ns1:executeCommand>',
    '</SOAP-ENV:Body>',
    '</SOAP-ENV:Envelope>',
  ].join('');
}

function parseSoapResult(body) {
  if (body.includes('<SOAP-ENV:Fault>')) {
    const match = body.match(/<faultstring>([^<]+)<\/faultstring>/);
    throw new Error(match?.[1] || 'SOAP fault');
  }
  const match = body.match(/<result>([\s\S]*?)<\/result>/);
  return match ? match[1].replace(/&#xD;/g, '\n').trim() : body;
}

export async function executeSoapCommand(command, options = {}) {
  const host = options.host || process.env.AC_SOAP_HOST || 'ac-worldserver:7878';
  const [hostname, portStr] = host.split(':');
  const port = Number(portStr || 7878);
  const user = options.user || process.env.AC_SOAP_USER || 'admin';
  const pass = options.pass || process.env.AC_SOAP_PASS || 'admin';
  const auth = Buffer.from(`${user}:${pass}`).toString('base64');
  const payload = buildSoapEnvelope(command);

  const maxRetries = 5;
  let lastErr;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await new Promise((resolve, reject) => {
        const req = http.request({
          hostname,
          port,
          method: 'POST',
          path: '/',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'text/xml; charset=utf-8',
            'Content-Length': Buffer.byteLength(payload),
          },
          timeout: 15000,
        }, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              resolve(parseSoapResult(data));
            } catch (error) {
              reject(error);
            }
          });
        });

        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('SOAP request timed out'));
        });
        req.write(payload);
        req.end();
      });
      return result;
    } catch (err) {
      lastErr = err;
      const msg = (err && err.message) || String(err);
      const transient = /ECONNREFUSED|ETIMEDOUT|timeout|socket hang up/i.test(msg);
      if (!transient || attempt === maxRetries) {
        throw err;
      }
      const delay = 1000 * attempt;
      console.warn(`[ac-provision] SOAP transient error (attempt ${attempt}/${maxRetries}): ${msg}. Retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

export async function ensureWowAccount({ grudgeId, grudgeUsername, playerStore }) {
  const existing = playerStore.get(grudgeId);
  if (existing?.wowAccount?.login && existing?.wowAccount?.password) {
    return {
      login: existing.wowAccount.login,
      password: existing.wowAccount.password,
      created: false,
    };
  }

  const login = existing?.wowAccount?.login || sanitizeWowLogin(grudgeUsername, grudgeId);
  const password = existing?.wowAccount?.password || generateWowPassword(grudgeId);
  const command = `account create ${login} ${password} ${password}`;

  let created = false;
  try {
    const result = await executeSoapCommand(command);
    created = !/already exist/i.test(result);
    console.log(`[ac-provision] ${created ? 'created' : 'exists'} account ${login} for ${grudgeId}`);
  } catch (error) {
    console.error('[ac-provision] SOAP failed:', error.message);

    if (process.env.AC_MOCK_PROVISION === 'true') {
      console.warn('[ac-provision] AC_MOCK_PROVISION=true — storing credentials without SOAP');
      playerStore.upsert(grudgeId, {
        grudgeUsername,
        wowAccount: { login, password, createdAt: new Date().toISOString(), mock: true },
      });
      return { login, password, created: true, mock: true };
    }

    throw new Error(
      'Could not create WoW account automatically. Ensure AzerothCore SOAP is enabled (port 7878) and AC_SOAP_USER/PASS are set.',
    );
  }

  playerStore.upsert(grudgeId, {
    grudgeUsername,
    wowAccount: {
      login,
      password,
      createdAt: new Date().toISOString(),
    },
  });

  return { login, password, created };
}