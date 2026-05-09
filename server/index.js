import express from 'express';
import WebSocket from 'ws';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_DIST_DIR = path.join(__dirname, '..', 'frontend', 'dist');
const FRONTEND_INDEX_HTML = path.join(FRONTEND_DIST_DIR, 'index.html');

loadLocalEnv();

const app = express();
const PORT = Number(process.env.PORT ?? 3001);
const BOSE_PORT = 8090;
const UPNP_AVTRANSPORT_PORT = 8091;
const REQUEST_TIMEOUT_MS = Number(process.env.BOSE_REQUEST_TIMEOUT_MS ?? 6000);
const ALLOWED_KEYS = new Set(['PLAY_PAUSE', 'STOP', 'VOLUME_UP', 'VOLUME_DOWN', 'PRESET_1', 'PRESET_2', 'PRESET_3', 'PRESET_4', 'PRESET_5', 'PRESET_6', 'ADD_FAVORITE', 'REMOVE_FAVORITE']);
const KEY_SENDER = 'Gabbo';
const KEY_RELEASE_DELAY_MS = 100;
const REPLACEMENT_PRESET_COUNT = 6;

function replacementPresetsPath() {
  return path.join(__dirname, '..', 'data', 'replacement-presets.json');
}

function normalizeReplacementPreset(preset, index) {
  const fallbackId = index + 1;
  const id = Number(preset?.id ?? fallbackId);

  return {
    id: Number.isInteger(id) && id >= 1 && id <= REPLACEMENT_PRESET_COUNT ? id : fallbackId,
    name: String(preset?.name ?? `Preset ${fallbackId}`).trim() || `Preset ${fallbackId}`,
    streamUrl: String(preset?.streamUrl ?? '').trim(),
    logoUrl: String(preset?.logoUrl ?? '').trim(),
    category: String(preset?.category ?? '').trim(),
    notes: String(preset?.notes ?? '').trim(),
    enabled: Boolean(preset?.enabled),
    lastPlayedAt: String(preset?.lastPlayedAt ?? '').trim()
  };
}

async function readReplacementPresets() {
  const raw = await readFile(replacementPresetsPath(), 'utf8');
  const parsed = JSON.parse(raw);
  const byId = new Map((Array.isArray(parsed) ? parsed : []).map((preset, index) => {
    const normalized = normalizeReplacementPreset(preset, index);
    return [normalized.id, normalized];
  }));

  return Array.from({ length: REPLACEMENT_PRESET_COUNT }, (_, index) => {
    const id = index + 1;
    return byId.get(id) ?? normalizeReplacementPreset({ id, name: `Preset ${id}`, enabled: false }, index);
  });
}

async function writeReplacementPresets(presets) {
  await writeFile(replacementPresetsPath(), `${JSON.stringify(presets, null, 2)}\n`, 'utf8');
}

function validateStreamUrl(url) {
  if (!url) return '';
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('streamUrl deve usare protocollo http o https.');
  }

  return parsed.toString();
}


app.use((req, res, next) => {
  const allowedOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
  res.header('Access-Control-Allow-Origin', allowedOrigin);
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  return next();
});
app.use(express.text({ type: ['application/xml', 'text/xml'] }));
app.use(express.json());
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

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

function upnpUrl(ip, endpoint) {
  return `http://${ip}:${UPNP_AVTRANSPORT_PORT}${endpoint}`;
}

function escapeXmlText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function makeDidlLiteMetadata(streamUrl, title = 'Groove Salad') {
  return `<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/"
             xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/"
             xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">
  <item id="1" parentID="0" restricted="1">
    <dc:title>${escapeXmlText(title)}</dc:title>
    <upnp:class>object.item.audioItem.audioBroadcast</upnp:class>
    <res protocolInfo="http-get:*:audio/mpeg:*">${escapeXmlText(streamUrl)}</res>
  </item>
</DIDL-Lite>`;
}

function makeUpnpEnvelope(actionName, innerXml) {
  return `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"
  s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:${actionName} xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
${innerXml}
    </u:${actionName}>
  </s:Body>
</s:Envelope>`;
}

function makeSetAvTransportUriSoap(streamUrl, metadata = '') {
  return makeUpnpEnvelope('SetAVTransportURI', `      <InstanceID>0</InstanceID>
      <CurrentURI>${escapeXmlText(streamUrl)}</CurrentURI>
      <CurrentURIMetaData>${escapeXmlText(metadata)}</CurrentURIMetaData>`);
}

function makePlaySoap() {
  return makeUpnpEnvelope('Play', `      <InstanceID>0</InstanceID>
      <Speed>1</Speed>`);
}

function makeStopSoap() {
  return makeUpnpEnvelope('Stop', '      <InstanceID>0</InstanceID>');
}

function makeGetMediaInfoSoap() {
  return makeUpnpEnvelope('GetMediaInfo', '      <InstanceID>0</InstanceID>');
}

function makeGetTransportInfoSoap() {
  return makeUpnpEnvelope('GetTransportInfo', '      <InstanceID>0</InstanceID>');
}

function makeGetPositionInfoSoap() {
  return makeUpnpEnvelope('GetPositionInfo', '      <InstanceID>0</InstanceID>');
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


function parseSoundTouchRealtimeXml(xml) {
  const rootTag = xml.match(/<([a-zA-Z][\w:-]*)\b/)?.[1] ?? 'raw';
  const knownEvents = ['nowPlayingUpdated', 'nowSelectionUpdated', 'volumeUpdated', 'presetsUpdated', 'infoUpdated', 'connectionStateUpdated'];
  const eventName = knownEvents.find((name) => new RegExp(`<${name}\\b`, 'i').test(xml)) ?? rootTag;
  const nowPlayingXml = xml.match(/<nowPlayingUpdated\b[\s\S]*?<\/nowPlayingUpdated>/i)?.[0]
    ?? xml.match(/<nowPlaying\b[\s\S]*?<\/nowPlaying>/i)?.[0]
    ?? xml;
  const parsed = {
    eventName,
    source: extractXmlAttribute(nowPlayingXml, 'source') ?? extractXmlValue(nowPlayingXml, 'source'),
    title: extractXmlValue(nowPlayingXml, 'track')
      ?? extractXmlValue(nowPlayingXml, 'itemName')
      ?? extractXmlValue(nowPlayingXml, 'stationName'),
    artist: extractXmlValue(nowPlayingXml, 'artist'),
    playStatus: extractXmlValue(nowPlayingXml, 'playStatus') ?? extractXmlValue(nowPlayingXml, 'state'),
    volume: extractXmlValue(xml, 'actualvolume') ?? extractXmlValue(xml, 'volume'),
    deviceID: extractXmlAttribute(xml, 'deviceID') ?? extractXmlValue(xml, 'deviceID')
  };

  if (/^SoundTouchSdkInfo$/i.test(rootTag)) {
    return {
      ...parsed,
      eventName: 'SoundTouchSdkInfo',
      connectionState: 'waiting',
      message: 'WebSocket aperta, in attesa di notifiche'
    };
  }

  return parsed;
}


function parseSourcesXml(xml) {
  return findXmlBlocks(xml, 'sourceItem').map((sourceXml) => ({
    source: extractXmlAttribute(sourceXml, 'source'),
    sourceAccount: extractXmlAttribute(sourceXml, 'sourceAccount'),
    status: extractXmlAttribute(sourceXml, 'status'),
    isLocal: extractXmlAttribute(sourceXml, 'isLocal'),
    multiroomAllowed: extractXmlAttribute(sourceXml, 'multiroomallowed'),
    text: sourceXml.replace(/<[^>]+>/g, '').trim() || null
  }));
}

function findXmlBlocks(xml, tagName) {
  return [...String(xml ?? '').matchAll(new RegExp(`<${tagName}\\b[\\s\\S]*?</${tagName}>`, 'gi'))].map((match) => match[0]);
}

function parseStatusSnapshot({ ip, infoXml = '', nowPlayingXml = '', volumeXml = '', sourcesXml = '' }) {
  return {
    boseIp: ip,
    online: /<info\b/i.test(infoXml),
    deviceName: extractXmlValue(infoXml, 'name') || 'SoundTouch',
    nowPlaying: {
      source: extractXmlAttribute(nowPlayingXml, 'source') ?? extractXmlValue(nowPlayingXml, 'source') ?? '',
      title: extractXmlValue(nowPlayingXml, 'track') ?? extractXmlValue(nowPlayingXml, 'itemName') ?? extractXmlValue(nowPlayingXml, 'stationName') ?? '',
      artist: extractXmlValue(nowPlayingXml, 'artist') ?? '',
      playStatus: extractXmlValue(nowPlayingXml, 'playStatus') ?? extractXmlValue(nowPlayingXml, 'state') ?? '',
      itemName: extractXmlValue(nowPlayingXml, 'itemName') ?? '',
      stationName: extractXmlValue(nowPlayingXml, 'stationName') ?? ''
    },
    volume: Number(extractXmlValue(volumeXml, 'actualvolume') ?? extractXmlValue(volumeXml, 'volume') ?? 0),
    sources: parseSourcesXml(sourcesXml),
    updatedAt: timestamp()
  };
}

function writeSse(res, event, payload) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
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

async function postUpnpSoap(ip, soapAction, requestSoap) {
  const targetIp = sanitizeIp(ip);
  if (!targetIp) {
    const error = new Error('Indirizzo IP Bose mancante o non valido.');
    error.statusCode = 400;
    throw error;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const targetUrl = upnpUrl(targetIp, '/AVTransport/Control');

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'text/xml; charset="utf-8"',
        SOAPAction: `"${soapAction}"`
      },
      body: requestSoap
    });
    const responseBody = await response.text();

    return {
      url: targetUrl,
      soapAction,
      requestSoap,
      status: response.status,
      ok: response.ok,
      contentType: response.headers.get('content-type') ?? 'text/xml',
      responseBody
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      return {
        url: targetUrl,
        soapAction,
        requestSoap,
        status: 504,
        ok: false,
        contentType: 'text/plain',
        responseBody: `Timeout dopo ${REQUEST_TIMEOUT_MS} ms verso UPnP AVTransport.`
      };
    }

    return {
      url: targetUrl,
      soapAction,
      requestSoap,
      status: 502,
      ok: false,
      contentType: 'text/plain',
      responseBody: error.message ?? 'Errore SOAP UPnP AVTransport.'
    };
  } finally {
    clearTimeout(timeoutId);
  }
}


function isPotentialAudioContentType(contentType) {
  const normalized = String(contentType ?? '').split(';')[0].trim().toLowerCase();
  return [
    'audio/mpeg',
    'audio/aac',
    'audio/x-aac',
    'audio/aacp',
    'audio/x-mpegurl',
    'application/x-mpegurl',
    'application/vnd.apple.mpegurl',
    'application/octet-stream'
  ].includes(normalized) || normalized.startsWith('audio/');
}

async function checkStreamReachability(streamUrl) {
  const parsedUrl = validateStreamUrl(String(streamUrl ?? '').trim());
  if (!parsedUrl) {
    const error = new Error('streamUrl mancante.');
    error.statusCode = 400;
    throw error;
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    let response = await fetch(parsedUrl, { method: 'HEAD', signal: controller.signal });
    if (response.status === 405 || response.status === 403) {
      response = await fetch(parsedUrl, { method: 'GET', signal: controller.signal, headers: { Range: 'bytes=0-0' } });
    }

    const mimeType = response.headers.get('content-type') ?? null;
    return {
      ok: response.ok,
      potentiallyPlayable: response.ok && isPotentialAudioContentType(mimeType),
      status: response.status,
      mimeType,
      contentLength: response.headers.get('content-length') ?? null,
      finalUrl: response.url,
      durationMs: Date.now() - startedAt
    };
  } catch (error) {
    return {
      ok: false,
      potentiallyPlayable: false,
      error: error.name === 'AbortError' ? `Timeout dopo ${REQUEST_TIMEOUT_MS} ms.` : error.message,
      durationMs: Date.now() - startedAt
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchNowPlayingSnapshot(ip, delayMs) {
  const result = await fetchSoundTouchExperimental(ip, '/now_playing');
  return {
    delayMs,
    timestamp: timestamp(),
    httpStatus: result.status,
    ok: result.ok,
    nowPlayingXml: result.body
  };
}

async function pollNowPlayingAfterPlay(ip, delays = [500, 1500, 3000, 5000]) {
  const polls = [];
  let elapsedMs = 0;
  for (const delayMs of delays) {
    await wait(Math.max(0, delayMs - elapsedMs));
    elapsedMs = delayMs;
    polls.push(await fetchNowPlayingSnapshot(ip, delayMs));
  }
  return polls;
}

async function playReplacementPresetById(ip, id) {
  const targetIp = sanitizeIp(ip);
  if (!targetIp) {
    const error = new Error('Indirizzo IP Bose mancante o non valido.');
    error.statusCode = 400;
    throw error;
  }

  const presetId = Number(id);
  if (!Number.isInteger(presetId) || presetId < 1 || presetId > REPLACEMENT_PRESET_COUNT) {
    const error = new Error('ID preset non valido. Usa un valore da 1 a 6.');
    error.statusCode = 400;
    throw error;
  }

  const presets = await readReplacementPresets();
  const preset = presets[presetId - 1];
  const streamUrl = validateStreamUrl(preset?.streamUrl ?? '');
  if (!streamUrl) {
    const error = new Error(`Preset ${presetId}: streamUrl mancante.`);
    error.statusCode = 400;
    throw error;
  }

  const startedAt = timestamp();
  const stopResult = await postUpnpSoap(targetIp, 'urn:schemas-upnp-org:service:AVTransport:1#Stop', makeStopSoap());
  const metadata = makeDidlLiteMetadata(streamUrl, preset.name);
  const setUriResult = await postUpnpSoap(
    targetIp,
    'urn:schemas-upnp-org:service:AVTransport:1#SetAVTransportURI',
    makeSetAvTransportUriSoap(streamUrl, metadata)
  );
  await wait(300);
  const playResult = await postUpnpSoap(targetIp, 'urn:schemas-upnp-org:service:AVTransport:1#Play', makePlaySoap());
  const getTransportInfoResult = await postUpnpSoap(targetIp, 'urn:schemas-upnp-org:service:AVTransport:1#GetTransportInfo', makeGetTransportInfoSoap());
  const getPositionInfoResult = await postUpnpSoap(targetIp, 'urn:schemas-upnp-org:service:AVTransport:1#GetPositionInfo', makeGetPositionInfoSoap());
  const nowPlayingAfter = await pollNowPlayingAfterPlay(targetIp);

  const updatedPreset = normalizeReplacementPreset({ ...preset, lastPlayedAt: timestamp() }, presetId - 1);
  presets[presetId - 1] = updatedPreset;
  await writeReplacementPresets(presets);

  return {
    timestamp: startedAt,
    boseIp: targetIp,
    preset: updatedPreset,
    streamUrl,
    mode: 'didl',
    metadata,
    stopResult,
    setUriResult,
    playResult,
    getTransportInfoResult,
    getPositionInfoResult,
    nowPlayingAfter,
    outcome: playResult.ok ? 'Play inviato alla Bose via UPnP AVTransport.' : 'Play inviato ma la risposta UPnP non è OK.'
  };
}

function normalizeRadioBrowserStation(station) {
  return {
    name: String(station?.name ?? '').trim(),
    streamUrl: String(station?.url_resolved || station?.url || '').trim(),
    favicon: String(station?.favicon ?? '').trim(),
    homepage: String(station?.homepage ?? '').trim(),
    country: String(station?.country ?? '').trim(),
    language: String(station?.language ?? '').trim(),
    tags: String(station?.tags ?? '').trim(),
    codec: String(station?.codec ?? '').trim(),
    bitrate: Number(station?.bitrate ?? 0),
    lastcheckok: Boolean(station?.lastcheckok)
  };
}

async function fetchUpnpDescription(ip) {
  const targetIp = sanitizeIp(ip);
  if (!targetIp) {
    const error = new Error('Indirizzo IP Bose mancante o non valido.');
    error.statusCode = 400;
    throw error;
  }

  const attempts = ['/rootDesc.xml', '/'];
  const results = [];

  for (const endpoint of attempts) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const targetUrl = upnpUrl(targetIp, endpoint);

    try {
      const response = await fetch(targetUrl, {
        signal: controller.signal,
        headers: { Accept: 'application/xml, text/xml, */*' }
      });
      const body = await response.text();
      results.push({ endpoint, url: targetUrl, status: response.status, ok: response.ok, contentType: response.headers.get('content-type') ?? 'application/xml', body });
      if (response.ok) {
        return { ok: true, selectedEndpoint: endpoint, attempts: results };
      }
    } catch (error) {
      results.push({ endpoint, url: targetUrl, status: error.name === 'AbortError' ? 504 : 502, ok: false, contentType: 'text/plain', body: error.name === 'AbortError' ? `Timeout dopo ${REQUEST_TIMEOUT_MS} ms.` : error.message });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return { ok: false, selectedEndpoint: null, attempts: results };
}

async function fetchSoundTouchExperimental(ip, endpoint) {
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
      signal: controller.signal,
      headers: { Accept: 'application/xml, text/xml, */*' }
    });
    const body = await response.text();

    return {
      endpoint,
      status: response.status,
      ok: response.ok,
      contentType: response.headers.get('content-type') ?? 'application/xml',
      body
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      return { endpoint, status: 504, ok: false, contentType: 'text/plain', body: `Timeout dopo ${REQUEST_TIMEOUT_MS} ms verso Bose SoundTouch.` };
    }

    return { endpoint, status: 502, ok: false, contentType: 'text/plain', body: error.message ?? 'Errore proxy SoundTouch.' };
  } finally {
    clearTimeout(timeoutId);
  }
}

function sendExperimentalEndpoint(res, result) {
  res.status(result.status).json(result);
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

app.get('/api/status', async (req, res) => {
  const ip = sanitizeIp(req.query.ip ?? process.env.BOSE_DEFAULT_IP ?? process.env.BOSE_IP);
  if (!ip) {
    return res.json({
      boseIp: '',
      online: false,
      deviceName: 'SoundTouch',
      nowPlaying: { source: '', title: '', artist: '', playStatus: 'STOPPED', itemName: '', stationName: '' },
      volume: 0,
      sources: [],
      updatedAt: timestamp()
    });
  }

  const [info, nowPlaying, volume, sources] = await Promise.all([
    fetchSoundTouchExperimental(ip, '/info'),
    fetchSoundTouchExperimental(ip, '/now_playing'),
    fetchSoundTouchExperimental(ip, '/volume'),
    fetchSoundTouchExperimental(ip, '/sources')
  ]);

  return res.json(parseStatusSnapshot({
    ip,
    infoXml: info.ok ? info.body : '',
    nowPlayingXml: nowPlaying.ok ? nowPlaying.body : '',
    volumeXml: volume.ok ? volume.body : '',
    sourcesXml: sources.ok ? sources.body : ''
  }));
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


app.get('/api/realtime/:ip', (req, res) => {
  const targetIp = sanitizeIp(req.params.ip);
  if (!targetIp) {
    return res.status(400).json({ error: 'Indirizzo IP Bose mancante o non valido.' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders?.();

  let closed = false;
  let boseSocket = null;
  let reconnectTimer = null;
  const boseWsUrl = `ws://${targetIp}:8080`;

  const connect = () => {
    if (closed) {
      return;
    }

    writeSse(res, 'soundtouch', {
      timestamp: timestamp(),
      eventName: 'connectionStateUpdated',
      connectionState: 'connecting',
      message: `Connessione backend -> Bose ${boseWsUrl}`
    });

    boseSocket = new WebSocket(boseWsUrl, 'gabbo');
    let keepAliveTimer = null;

    boseSocket.on('open', () => {
      writeSse(res, 'soundtouch', {
        timestamp: timestamp(),
        eventName: 'connectionStateUpdated',
        connectionState: 'connected',
        message: `WebSocket Bose connesso a ${boseWsUrl} con subprotocol gabbo`
      });

      keepAliveTimer = setInterval(() => {
        if (boseSocket?.readyState === WebSocket.OPEN) {
          boseSocket.ping();
        }
      }, 25000);
    });

    boseSocket.on('message', (data) => {
      const raw = data.toString();
      const parsed = parseSoundTouchRealtimeXml(raw);
      writeSse(res, 'soundtouch', {
        timestamp: timestamp(),
        ...parsed,
        raw
      });
    });

    boseSocket.on('error', (error) => {
      writeSse(res, 'soundtouch', {
        timestamp: timestamp(),
        eventName: 'connectionStateUpdated',
        connectionState: 'error',
        message: error.message
      });
    });

    boseSocket.on('close', (code, reason) => {
      if (keepAliveTimer) {
        clearInterval(keepAliveTimer);
      }
      writeSse(res, 'soundtouch', {
        timestamp: timestamp(),
        eventName: 'connectionStateUpdated',
        connectionState: 'disconnected',
        code,
        message: reason?.toString() || 'WebSocket Bose chiuso. Reconnect automatico in 1500ms.'
      });

      if (!closed) {
        reconnectTimer = setTimeout(connect, 1500);
      }
    });
  };

  req.on('close', () => {
    closed = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }
    if (boseSocket) {
      boseSocket.close();
    }
  });

  connect();
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

app.get('/api/replacement-presets', async (_req, res, next) => {
  try {
    res.json(await readReplacementPresets());
  } catch (error) {
    next(error);
  }
});

app.put('/api/replacement-presets/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1 || id > REPLACEMENT_PRESET_COUNT) {
      return res.status(400).json({ error: 'ID preset non valido. Usa un valore da 1 a 6.' });
    }

    const presets = await readReplacementPresets();
    const index = id - 1;
    const streamUrl = validateStreamUrl(String(req.body?.streamUrl ?? '').trim());
    const nextPreset = normalizeReplacementPreset({
      ...presets[index],
      ...req.body,
      id,
      streamUrl
    }, index);
    presets[index] = nextPreset;
    await writeReplacementPresets(presets);

    return res.json(nextPreset);
  } catch (error) {
    if (error instanceof TypeError || /streamUrl/.test(error.message ?? '')) {
      return res.status(400).json({ error: error.message });
    }

    return next(error);
  }
});

app.post('/api/stream-check', async (req, res) => {
  try {
    return res.json(await checkStreamReachability(req.body?.streamUrl));
  } catch (error) {
    return res.status(error.statusCode ?? 400).json({ ok: false, potentiallyPlayable: false, error: error.message });
  }
});

app.post('/api/replacement-presets/:id/test-stream', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1 || id > REPLACEMENT_PRESET_COUNT) {
      return res.status(400).json({ ok: false, potentiallyPlayable: false, error: 'ID preset non valido. Usa un valore da 1 a 6.' });
    }

    const presets = await readReplacementPresets();
    const preset = presets[id - 1];
    const result = await checkStreamReachability(preset?.streamUrl);
    return res.json({ preset, ...result });
  } catch (error) {
    if (error.statusCode || error instanceof TypeError || /streamUrl/.test(error.message ?? '')) {
      return res.status(error.statusCode ?? 400).json({ ok: false, potentiallyPlayable: false, error: error.message });
    }

    return next(error);
  }
});

app.post('/api/replacement-presets/:id/play', async (req, res, next) => {
  try {
    const boseIp = req.body?.boseIp ?? req.query.boseIp ?? process.env.BOSE_DEFAULT_IP ?? process.env.BOSE_IP;
    return res.json(await playReplacementPresetById(boseIp, req.params.id));
  } catch (error) {
    if (error.statusCode || error instanceof TypeError || /streamUrl|Preset|Indirizzo IP|ID preset/.test(error.message ?? '')) {
      return res.status(error.statusCode ?? 400).json({ error: error.message });
    }

    return next(error);
  }
});

app.get('/api/radio-search', async (req, res) => {
  const query = String(req.query.q ?? '').trim();
  const country = String(req.query.country ?? '').trim();
  const tag = String(req.query.tag ?? '').trim();

  const searchUrl = new URL('https://de1.api.radio-browser.info/json/stations/search');
  if (query) searchUrl.searchParams.set('name', query);
  if (country) searchUrl.searchParams.set('country', country);
  if (tag) searchUrl.searchParams.set('tag', tag);
  searchUrl.searchParams.set('hidebroken', 'true');
  searchUrl.searchParams.set('limit', '30');
  searchUrl.searchParams.set('order', 'clickcount');
  searchUrl.searchParams.set('reverse', 'true');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'SoundTouchRadioBridge/1.0'
      }
    });
    const payload = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: `Radio Browser HTTP ${response.status}.`, details: payload });
    }

    const stations = (Array.isArray(payload) ? payload : [])
      .map(normalizeRadioBrowserStation)
      .filter((station) => station.name && station.streamUrl);

    return res.json({ source: searchUrl.toString(), stations });
  } catch (error) {
    return res.status(error.name === 'AbortError' ? 504 : 502).json({ error: error.name === 'AbortError' ? `Timeout dopo ${REQUEST_TIMEOUT_MS} ms.` : error.message });
  } finally {
    clearTimeout(timeoutId);
  }
});

app.get('/api/upnp/:ip/root-desc', async (req, res, next) => {
  try {
    res.json(await fetchUpnpDescription(req.params.ip));
  } catch (error) {
    next(error);
  }
});

app.post('/api/upnp/:ip/set-uri', async (req, res, next) => {
  try {
    const streamUrl = validateStreamUrl(String(req.body?.streamUrl ?? '').trim());
    if (!streamUrl) {
      return res.status(400).json({ error: 'streamUrl mancante.' });
    }

    const mode = String(req.body?.mode ?? 'direct').toLowerCase();
    const metadata = mode === 'didl'
      ? makeDidlLiteMetadata(streamUrl, String(req.body?.title ?? 'Groove Salad'))
      : '';
    const soapAction = 'urn:schemas-upnp-org:service:AVTransport:1#SetAVTransportURI';
    const requestSoap = makeSetAvTransportUriSoap(streamUrl, metadata);
    res.status(200).json({ mode, metadata, ...(await postUpnpSoap(req.params.ip, soapAction, requestSoap)) });
  } catch (error) {
    if (error instanceof TypeError || /streamUrl/.test(error.message ?? '')) {
      return res.status(400).json({ error: error.message });
    }

    return next(error);
  }
});

app.post('/api/upnp/:ip/stop', async (req, res, next) => {
  try {
    const soapAction = 'urn:schemas-upnp-org:service:AVTransport:1#Stop';
    res.status(200).json(await postUpnpSoap(req.params.ip, soapAction, makeStopSoap()));
  } catch (error) {
    next(error);
  }
});

app.post('/api/upnp/:ip/get-media-info', async (req, res, next) => {
  try {
    const soapAction = 'urn:schemas-upnp-org:service:AVTransport:1#GetMediaInfo';
    res.status(200).json(await postUpnpSoap(req.params.ip, soapAction, makeGetMediaInfoSoap()));
  } catch (error) {
    next(error);
  }
});

app.post('/api/upnp/:ip/get-transport-info', async (req, res, next) => {
  try {
    const soapAction = 'urn:schemas-upnp-org:service:AVTransport:1#GetTransportInfo';
    res.status(200).json(await postUpnpSoap(req.params.ip, soapAction, makeGetTransportInfoSoap()));
  } catch (error) {
    next(error);
  }
});

app.post('/api/upnp/:ip/get-position-info', async (req, res, next) => {
  try {
    const soapAction = 'urn:schemas-upnp-org:service:AVTransport:1#GetPositionInfo';
    res.status(200).json(await postUpnpSoap(req.params.ip, soapAction, makeGetPositionInfoSoap()));
  } catch (error) {
    next(error);
  }
});

app.post('/api/upnp/:ip/play', async (req, res, next) => {
  try {
    const soapAction = 'urn:schemas-upnp-org:service:AVTransport:1#Play';
    const requestSoap = makePlaySoap();
    res.status(200).json(await postUpnpSoap(req.params.ip, soapAction, requestSoap));
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

app.get('/api/bose/:ip/now-playing', async (req, res, next) => {
  try {
    sendXml(res, await fetchSoundTouch(req.params.ip, '/now_playing'));
  } catch (error) {
    next(error);
  }
});

app.get('/api/bose/:ip/presets', async (req, res, next) => {
  try {
    sendXml(res, await fetchSoundTouch(req.params.ip, '/presets'));
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

app.get('/api/bose/:ip/recents', async (req, res, next) => {
  try {
    sendExperimentalEndpoint(res, await fetchSoundTouchExperimental(req.params.ip, '/recents'));
  } catch (error) {
    next(error);
  }
});

app.get('/api/bose/:ip/capabilities', async (req, res, next) => {
  try {
    sendExperimentalEndpoint(res, await fetchSoundTouchExperimental(req.params.ip, '/capabilities'));
  } catch (error) {
    next(error);
  }
});

app.get('/api/bose/:ip/now_selection', async (req, res, next) => {
  try {
    sendExperimentalEndpoint(res, await fetchSoundTouchExperimental(req.params.ip, '/now_selection'));
  } catch (error) {
    next(error);
  }
});

app.get('/api/bose/:ip/now-selection', async (req, res, next) => {
  try {
    sendExperimentalEndpoint(res, await fetchSoundTouchExperimental(req.params.ip, '/now_selection'));
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

app.post('/api/bose/:ip/select', async (req, res, next) => {
  try {
    const requestXml = typeof req.body === 'string' ? req.body.trim() : '';
    if (!requestXml || !/^<ContentItem\b[\s\S]*<\/ContentItem>$/.test(requestXml)) {
      return res.status(400).json({ error: 'Il body deve essere XML ContentItem puro.' });
    }

    const result = await postXmlToSoundTouch(req.params.ip, '/select', requestXml);

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


app.use(express.static(FRONTEND_DIST_DIR));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }

  if (!existsSync(FRONTEND_INDEX_HTML)) {
    return res.status(404).json({
      error: 'Frontend build non trovato. Esegui npm run build per generare frontend/dist.'
    });
  }

  return res.sendFile(FRONTEND_INDEX_HTML);
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
