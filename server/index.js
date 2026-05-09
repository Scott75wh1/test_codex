import express from 'express';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadLocalEnv();

const app = express();
const PORT = Number(process.env.PORT ?? 3001);
const BOSE_PORT = 8090;
const REQUEST_TIMEOUT_MS = Number(process.env.BOSE_REQUEST_TIMEOUT_MS ?? 6000);
const ALLOWED_KEYS = new Set(['PLAY_PAUSE', 'STOP', 'VOLUME_UP', 'VOLUME_DOWN']);

app.use((req, res, next) => {
  const allowedOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
  res.header('Access-Control-Allow-Origin', allowedOrigin);
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  return next();
});
app.use(express.json());

function loadLocalEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function sanitizeIp(ip) {
  const value = String(ip ?? '').trim();
  if (!value) {
    return null;
  }

  if (/^[a-zA-Z0-9.-]+$/.test(value)) {
    return value;
  }

  return null;
}

function soundTouchUrl(ip, endpoint) {
  return `http://${ip}:${BOSE_PORT}${endpoint}`;
}

async function fetchSoundTouch(ip, endpoint, options = {}) {
  const targetIp = sanitizeIp(ip);
  if (!targetIp) {
    const error = new Error('Indirizzo IP Bose mancante o non valido.');
    error.statusCode = 400;
    throw error;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(soundTouchUrl(targetIp, endpoint), {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/xml, text/xml, */*',
        ...(options.headers ?? {})
      }
    });
    const text = await response.text();

    if (!response.ok) {
      const error = new Error(`SoundTouch ha risposto con HTTP ${response.status}.`);
      error.statusCode = response.status;
      error.payload = text;
      throw error;
    }

    return {
      status: response.status,
      contentType: response.headers.get('content-type') ?? 'application/xml',
      body: text
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error(`Timeout dopo ${REQUEST_TIMEOUT_MS} ms verso Bose SoundTouch.`);
      timeoutError.statusCode = 504;
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function sendXml(res, result) {
  res.status(result.status).type(result.contentType).send(result.body);
}

function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

async function pressAndReleaseKey(ip, key) {
  const escapedKey = xmlEscape(key);
  const makePayload = (state) => `<key state="${state}" sender="SoundTouchRadioBridge">${escapedKey}</key>`;

  const press = await fetchSoundTouch(ip, '/key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/xml' },
    body: makePayload('press')
  });

  await fetchSoundTouch(ip, '/key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/xml' },
    body: makePayload('release')
  });

  return press;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, name: 'SoundTouch Radio Bridge' });
});

app.get('/api/radios', async (_req, res, next) => {
  try {
    const radiosPath = path.join(__dirname, '..', 'data', 'radios.json');
    const radios = JSON.parse(await readFile(radiosPath, 'utf8'));
    res.json(radios);
  } catch (error) {
    next(error);
  }
});

app.get('/api/bose/:ip/info', async (req, res, next) => {
  try {
    sendXml(res, await fetchSoundTouch(req.params.ip, '/info'));
  } catch (error) {
    next(error);
  }
});

app.get('/api/bose/:ip/now_playing', async (req, res, next) => {
  try {
    sendXml(res, await fetchSoundTouch(req.params.ip, '/now_playing'));
  } catch (error) {
    next(error);
  }
});

app.get('/api/bose/:ip/sources', async (req, res, next) => {
  try {
    sendXml(res, await fetchSoundTouch(req.params.ip, '/sources'));
  } catch (error) {
    next(error);
  }
});

app.get('/api/bose/:ip/volume', async (req, res, next) => {
  try {
    sendXml(res, await fetchSoundTouch(req.params.ip, '/volume'));
  } catch (error) {
    next(error);
  }
});

app.post('/api/bose/:ip/volume', async (req, res, next) => {
  try {
    const volume = Number(req.body?.volume);
    if (!Number.isInteger(volume) || volume < 0 || volume > 100) {
      return res.status(400).json({ error: 'Il volume deve essere un intero tra 0 e 100.' });
    }

    const result = await fetchSoundTouch(req.params.ip, '/volume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml' },
      body: `<volume>${volume}</volume>`
    });

    return sendXml(res, result);
  } catch (error) {
    return next(error);
  }
});

app.post('/api/bose/:ip/key', async (req, res, next) => {
  try {
    const key = String(req.body?.key ?? '').trim().toUpperCase();
    if (!ALLOWED_KEYS.has(key)) {
      return res.status(400).json({ error: 'Key non supportata.', allowedKeys: [...ALLOWED_KEYS] });
    }

    return sendXml(res, await pressAndReleaseKey(req.params.ip, key));
  } catch (error) {
    return next(error);
  }
});

app.use((error, _req, res, _next) => {
  const statusCode = error.statusCode ?? 502;
  res.status(statusCode).json({
    error: error.message ?? 'Errore proxy SoundTouch.',
    details: error.payload
  });
});

app.listen(PORT, () => {
  console.log(`SoundTouch Radio Bridge API in ascolto su http://localhost:${PORT}`);
});
