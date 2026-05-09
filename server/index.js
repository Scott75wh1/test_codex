import express from 'express';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
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
const KEY_SENDER = 'Gabbo';
const KEY_RELEASE_DELAY_MS = 100;

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


function timestamp() {
  return new Date().toISOString();
}

function getLocalSubnets() {
  const interfaces = os.networkInterfaces();
  const subnets = [];

  for (const [name, addresses] of Object.entries(interfaces)) {
    for (const address of addresses ?? []) {
      if (address.family !== 'IPv4' || address.internal) {
        continue;
      }

      const parts = address.address.split('.');
      if (parts.length !== 4) {
        continue;
      }

      const base = parts.slice(0, 3).join('.');
      if (!subnets.some((subnet) => subnet.base === base)) {
        subnets.push({ interfaceName: name, address: address.address, base, cidr: `${base}.0/24` });
      }
    }
  }

  return subnets;
}

function extractXmlValue(xml, tagName) {
  const match = xml.match(new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'i'));
  return match?.[1]?.trim() || null;
}

function extractXmlAttribute(xml, attributeName) {
  const match = xml.match(new RegExp(`${attributeName}="([^"]+)"`, 'i'));
  return match?.[1]?.trim() || null;
}

function parseBoseInfoXml(xml) {
  if (!xml || !/<info\b/i.test(xml)) {
    return null;
  }

  const deviceID = extractXmlAttribute(xml, 'deviceID') ?? extractXmlValue(xml, 'deviceID');
  const name = extractXmlValue(xml, 'name');
  const productType = extractXmlValue(xml, 'type') ?? extractXmlValue(xml, 'product') ?? extractXmlValue(xml, 'productType');
  const hasBoseMarker = /soundtouch|bose/i.test(xml) || Boolean(deviceID);

  if (!hasBoseMarker) {
    return null;
  }

  return {
    name: name || 'Bose SoundTouch',
    deviceID: deviceID || 'n/d',
    productType: productType || null
  };
}

async function probeSoundTouchInfo(ip, timeoutMs = 800) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(soundTouchUrl(ip, '/info'), {
      signal: controller.signal,
      headers: { Accept: 'application/xml' }
    });
    const body = await response.text();
    const durationMs = Date.now() - startedAt;

    if (!response.ok) {
      return { ip, status: 'offline', httpStatus: response.status, durationMs };
    }

    const info = parseBoseInfoXml(body);
    if (!info) {
      return { ip, status: 'non Bose', httpStatus: response.status, durationMs };
    }

    return { ip, status: 'online', httpStatus: response.status, durationMs, ...info };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    if (error.name === 'AbortError') {
      return { ip, status: 'timeout', durationMs };
    }

    return { ip, status: 'offline', durationMs, error: error.code ?? error.cause?.code ?? error.message };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function scanSubnet(subnet) {
  const startedAt = Date.now();
  const ips = Array.from({ length: 254 }, (_, index) => `${subnet.base}.${index + 1}`);
  const results = await Promise.all(ips.map((ip) => probeSoundTouchInfo(ip)));
  const devices = results.filter((result) => result.status === 'online');
  const logs = results.map((result) => ({
    timestamp: timestamp(),
    ip: result.ip,
    status: result.status,
    durationMs: result.durationMs,
    message: result.status === 'online'
      ? `Bose trovato: ${result.name} (${result.deviceID})`
      : result.error || `HTTP ${result.httpStatus ?? 'n/d'}`
  }));

  return {
    subnet,
    scannedHosts: ips.length,
    durationMs: Date.now() - startedAt,
    devices,
    logs
  };
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

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function postXmlToSoundTouch(ip, endpoint, xmlBody) {
  console.log(`[SoundTouch POST ${endpoint}] XML body: ${xmlBody}`);

  try {
    return await fetchSoundTouch(ip, endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
        Accept: 'application/xml'
      },
      body: xmlBody
    });
  } catch (error) {
    error.requestXml = xmlBody;
    throw error;
  }
}

async function pressAndReleaseKey(ip, key) {
  const pressXml = `<key state="press" sender="${KEY_SENDER}">${key}</key>`;
  const releaseXml = `<key state="release" sender="${KEY_SENDER}">${key}</key>`;

  const requestXmlSequence = [pressXml, releaseXml];

  try {
    const press = await postXmlToSoundTouch(ip, '/key', pressXml);
    await wait(KEY_RELEASE_DELAY_MS);
    const release = await postXmlToSoundTouch(ip, '/key', releaseXml);

    return {
      requestXmlSequence,
      boseResponse: { press, release }
    };
  } catch (error) {
    error.requestXmlSequence = requestXmlSequence;
    throw error;
  }
}


function sendBridgePostError(res, error) {
  const statusCode = error.statusCode ?? 502;
  res.status(statusCode).json({
    error: error.message ?? 'Errore proxy SoundTouch.',
    details: error.payload,
    requestXml: error.requestXml,
    requestXmlSequence: error.requestXmlSequence,
    boseResponse: {
      status: error.statusCode,
      body: error.payload
    }
  });
}


app.get('/api/health', (_req, res) => {
  res.json({ ok: true, name: 'SoundTouch Radio Bridge' });
});


app.get('/api/discover', async (_req, res, next) => {
  try {
    const subnets = getLocalSubnets();
    if (subnets.length === 0) {
      return res.status(500).json({
        error: 'Nessuna subnet IPv4 LAN rilevata sul server Node.',
        devices: [],
        logs: [{ timestamp: timestamp(), status: 'offline', message: 'Nessuna interfaccia IPv4 non interna disponibile.' }]
      });
    }

    const scans = [];
    for (const subnet of subnets) {
      scans.push(await scanSubnet(subnet));
    }

    const devices = scans.flatMap((scan) => scan.devices);
    const logs = scans.flatMap((scan) => scan.logs);

    return res.json({
      subnet: scans[0].subnet,
      subnets: scans.map((scan) => scan.subnet),
      scannedHosts: scans.reduce((total, scan) => total + scan.scannedHosts, 0),
      durationMs: scans.reduce((total, scan) => total + scan.durationMs, 0),
      devices,
      logs,
      availableSubnets: subnets
    });
  } catch (error) {
    return next(error);
  }
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

    const requestXml = `<volume>${volume}</volume>`;
    const result = await postXmlToSoundTouch(req.params.ip, '/volume', requestXml);

    return res.status(result.status).json({
      requestXml,
      boseResponse: result
    });
  } catch (error) {
    if (error.requestXml) {
      return sendBridgePostError(res, error);
    }

    return next(error);
  }
});

app.post('/api/bose/:ip/key', async (req, res, next) => {
  try {
    const key = String(req.body?.key ?? '').trim().toUpperCase();
    if (!ALLOWED_KEYS.has(key)) {
      return res.status(400).json({ error: 'Key non supportata.', allowedKeys: [...ALLOWED_KEYS] });
    }

    const result = await pressAndReleaseKey(req.params.ip, key);

    return res.status(result.boseResponse.release.status).json(result);
  } catch (error) {
    if (error.requestXmlSequence) {
      return sendBridgePostError(res, error);
    }

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
