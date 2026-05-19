import { useEffect, useMemo, useRef, useState } from 'react';
import RemotePage from './routes';

type BoseEndpoint = 'info' | 'now_playing' | 'sources' | 'volume';
type BoseKey = 'PLAY_PAUSE' | 'STOP' | 'VOLUME_UP' | 'VOLUME_DOWN';
type ConnectionStatus = 'online' | 'offline' | 'timeout' | 'non Bose' | 'idle' | 'scanning';

type ApiResponse = {
  title: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  body: string;
  timestamp?: string;
};

type Radio = {
  id: string;
  name: string;
  genre: string;
  homepage: string;
  streamUrl: string;
};

type ReplacementPreset = {
  id: number;
  name: string;
  streamUrl: string;
  logoUrl?: string;
  category?: string;
  notes: string;
  enabled: boolean;
  lastPlayedAt?: string;
};

type StreamCheckResult = {
  ok: boolean;
  potentiallyPlayable?: boolean;
  status?: number;
  mimeType?: string | null;
  contentLength?: string | null;
  finalUrl?: string;
  durationMs?: number;
  error?: string;
};

type RadioSearchResult = {
  name: string;
  streamUrl: string;
  favicon: string;
  homepage: string;
  country: string;
  language: string;
  tags: string;
  codec: string;
  bitrate: number;
  lastcheckok: boolean;
};

type BoseSourceItem = {
  source: string | null;
  sourceAccount: string | null;
  status: string | null;
  isLocal: string | null;
  multiroomAllowed: string | null;
  text: string | null;
};

type UpnpSoapResult = {
  url: string;
  soapAction: string;
  requestSoap: string;
  status: number;
  ok: boolean;
  contentType: string;
  responseBody: string;
};

type UpnpRootDescAttempt = {
  endpoint: string;
  url: string;
  status: number;
  ok: boolean;
  contentType: string;
  body: string;
};

type UpnpRootDescResult = {
  ok: boolean;
  selectedEndpoint: string | null;
  attempts: UpnpRootDescAttempt[];
};

type UpnpSetUriMode = 'direct' | 'didl';

type UpnpPlaybackLog = {
  timestamp: string;
  command: 'root-desc' | 'set-uri' | 'play' | 'set-uri-play' | 'verify-flow';
  presetId?: number;
  streamUrl: string;
  setUriMode?: UpnpSetUriMode;
  stopResult?: UpnpSoapResult;
  setUriResult?: UpnpSoapResult;
  getMediaInfoResult?: UpnpSoapResult;
  getTransportInfoResult?: UpnpSoapResult;
  getPositionInfoResult?: UpnpSoapResult;
  playResult?: UpnpSoapResult;
  rootDescResult?: UpnpRootDescResult;
  nowPlayingAfter: PresetLabPoll[];
  errorUpdateRaw?: string | null;
  outcome: string;
};

type RadioPresetPlayResult = {
  timestamp: string;
  preset: ReplacementPreset;
  stopResult?: UpnpSoapResult;
  setUriResult?: UpnpSoapResult;
  playResult?: UpnpSoapResult;
  getTransportInfoResult?: UpnpSoapResult;
  getPositionInfoResult?: UpnpSoapResult;
  nowPlayingAfter: PresetLabPoll[];
  errorUpdateRaw?: string | null;
  outcome: string;
};

type DiscoveredDevice = {
  ip: string;
  status: ConnectionStatus;
  name: string;
  deviceID: string;
  productType?: string | null;
  durationMs?: number;
};

type TechnicalLog = {
  timestamp: string;
  ip?: string;
  status: ConnectionStatus | string;
  durationMs?: number;
  message: string;
};

type DiscoverResponse = {
  devices: DiscoveredDevice[];
  logs: TechnicalLog[];
  subnet?: { cidr: string; address: string; interfaceName: string };
  scannedHosts?: number;
  durationMs?: number;
  error?: string;
};

type RealtimeSnapshot = {
  source: string;
  title: string;
  artist: string;
  playStatus: string;
  volume: string;
  itemName?: string | null;
  stationName?: string | null;
};

type RealtimeEvent = {
  timestamp: string;
  eventName: string;
  connectionState?: string;
  message?: string;
  source?: string | null;
  title?: string | null;
  artist?: string | null;
  playStatus?: string | null;
  volume?: string | null;
  raw?: string;
};

type InspectorTab = 'Info' | 'Sources' | 'Presets' | 'Now Playing' | 'Raw XML' | 'WebSocket Events';

type InspectorRecord = {
  label: string;
  endpoint: string;
  rawXml: string;
  parsedJson: unknown;
  timestamp: string;
};

type ParsedPreset = {
  id: string | null;
  source: string | null;
  sourceAccount: string | null;
  location: string | null;
  container: string | null;
  itemName: string | null;
  art: string | null;
  stationName: string | null;
  contentItemXml: string | null;
};

type SelectPoll = {
  delayMs: number;
  timestamp: string;
  httpStatus: { nowPlaying: number | null; volume: number | null };
  nowPlayingXml: string;
  volumeXml: string;
  parsed: ReturnType<typeof parseRestSnapshot>;
};

type SelectResult = {
  presetLabel?: string;
  requestXml: string;
  responseBody: string;
  httpStatus: number | null;
  timestamp: string;
  polls: SelectPoll[];
  outcome: 'pending' | 'success' | 'failed' | 'error';
  errorUpdateRaw?: string | null;
};

type LocalRadioTemplateId = 'A' | 'B' | 'C' | 'D' | 'Manual';

type LocalRadioTemplate = {
  id: Exclude<LocalRadioTemplateId, 'Manual'>;
  label: string;
  description: string;
  source: 'LOCAL_INTERNET_RADIO' | 'TUNEIN';
  typeAttribute: 'stationurl' | 'url' | null;
};

type LocalRadioPoll = {
  delayMs: number;
  timestamp: string;
  httpStatus: number | null;
  nowPlayingXml: string;
  parsed: ReturnType<typeof parseRestSnapshot>;
};

type LocalRadioTestResult = {
  templateId: LocalRadioTemplateId;
  templateLabel: string;
  radioName: string;
  streamUrl: string;
  requestXml: string;
  responseBody: string;
  httpStatus: number | null;
  timestamp: string;
  nowPlaying: LocalRadioPoll[];
  errorUpdateRaw?: string | null;
  outcome: 'pending' | 'success' | 'failed' | 'error';
};

type PresetLabCommand = 'PRESET_1' | 'PRESET_2' | 'PRESET_3' | 'PRESET_4' | 'PRESET_5' | 'PRESET_6' | 'ADD_FAVORITE' | 'REMOVE_FAVORITE' | 'RECENTS' | 'CAPABILITIES' | 'NOW_SELECTION';

type PresetLabPoll = {
  delayMs: number;
  timestamp: string;
  httpStatus: number | null;
  nowPlayingXml: string;
  parsed: ReturnType<typeof parseRestSnapshot>;
};

type ExperimentalEndpointResult = {
  endpoint: string;
  status: number;
  ok: boolean;
  contentType: string;
  body: string;
};

type PresetResearchSnapshot = {
  httpStatus: number | null;
  rawXml: string;
  parsed: ReturnType<typeof parsePresetResearchXml>;
};

type PresetLabExperiment = {
  timestamp: string;
  command: PresetLabCommand;
  responseBose: string;
  nowPlayingBefore?: PresetLabPoll;
  nowPlayingAfter: PresetLabPoll[];
  presetsBefore?: PresetResearchSnapshot;
  presetsAfter?: PresetResearchSnapshot;
  websocketEvents: RealtimeEvent[];
  errorUpdateRaw?: string | null;
  outcome: string;
};

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';
const LAST_IP_STORAGE_KEY = 'soundtouch-radio-bridge:last-ip';
const ENDPOINTS: Array<{ id: BoseEndpoint; label: string; method: string }> = [
  { id: 'info', label: 'Info dispositivo', method: 'GET /info' },
  { id: 'now_playing', label: 'Now playing', method: 'GET /now_playing' },
  { id: 'sources', label: 'Sorgenti', method: 'GET /sources' },
  { id: 'volume', label: 'Volume', method: 'GET /volume' }
];
const KEYS: BoseKey[] = ['PLAY_PAUSE', 'STOP', 'VOLUME_UP', 'VOLUME_DOWN'];
const INSPECTOR_TABS: InspectorTab[] = ['Info', 'Sources', 'Presets', 'Now Playing', 'Raw XML', 'WebSocket Events'];
const SELECT_TEMPLATES = {
  tuneIn: '<ContentItem source="TUNEIN" type="stationurl" location="/v1/playback/station/s293430" sourceAccount="" isPresetable="true">\n  <itemName>Just House Music</itemName>\n</ContentItem>',
  localInternetRadio: '<ContentItem source="LOCAL_INTERNET_RADIO" type="stationurl" location="http://example.com/stream.mp3" sourceAccount="" isPresetable="true">\n  <itemName>Manual Web Radio</itemName>\n</ContentItem>',
  upnp: '<ContentItem source="UPNP" type="object.item.audioItem.musicTrack" location="0$0$TRACK_ID" sourceAccount="" isPresetable="true">\n  <itemName>UPNP manual item</itemName>\n</ContentItem>'
};
const LOCAL_RADIO_TEMPLATES: LocalRadioTemplate[] = [
  {
    id: 'A',
    label: 'Template A · LOCAL stationurl',
    description: 'source LOCAL_INTERNET_RADIO con type="stationurl".',
    source: 'LOCAL_INTERNET_RADIO',
    typeAttribute: 'stationurl'
  },
  {
    id: 'B',
    label: 'Template B · LOCAL senza type',
    description: 'source LOCAL_INTERNET_RADIO senza attributo type.',
    source: 'LOCAL_INTERNET_RADIO',
    typeAttribute: null
  },
  {
    id: 'C',
    label: 'Template C · LOCAL url',
    description: 'source LOCAL_INTERNET_RADIO con type="url".',
    source: 'LOCAL_INTERNET_RADIO',
    typeAttribute: 'url'
  },
  {
    id: 'D',
    label: 'Template D · TUNEIN direct URL',
    description: 'source TUNEIN con type="stationurl" ma location impostata allo stream diretto.',
    source: 'TUNEIN',
    typeAttribute: 'stationurl'
  }
];
const LOCAL_RADIO_POLL_DELAYS = [500, 1500, 3000, 5000];
const PRESET_LAB_KEYS: Array<Extract<PresetLabCommand, `PRESET_${number}`>> = ['PRESET_1', 'PRESET_2', 'PRESET_3', 'PRESET_4', 'PRESET_5', 'PRESET_6'];
const PRESET_LAB_POLL_DELAYS = [500, 1500, 3000];
const CAPABILITY_HIGHLIGHT_PATTERNS = ['preset', 'recent', 'favorite', 'music', 'service', 'local_internet_radio', 'LOCAL_INTERNET_RADIO'];
const UPNP_TEST_STREAMS = [
  'http://ice1.somafm.com/groovesalad-128-mp3',
  'http://stream.live.vc.bbcmedia.co.uk/bbc_world_service',
  'http://stream.radioparadise.com/mp3-128'
];
const UPNP_VERIFY_POLL_DELAYS = [500, 1500, 3000, 5000];

function now() {
  return new Date().toLocaleTimeString('it-IT');
}

function makeInitialResponse(): ApiResponse {
  return {
    title: 'Nessuna richiesta eseguita',
    status: 'idle',
    body: 'Inserisci l’IP del Bose SoundTouch, cerca i dispositivi sulla LAN o scegli un comando.'
  };
}

function makeLog(status: TechnicalLog['status'], message: string, ip?: string, durationMs?: number): TechnicalLog {
  return {
    timestamp: new Date().toISOString(),
    status,
    message,
    ip,
    durationMs
  };
}

function escapeXmlText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildLocalRadioSelectXml(template: LocalRadioTemplate, streamUrl: string, radioName: string) {
  const typeAttribute = template.typeAttribute ? ` type="${template.typeAttribute}"` : '';

  return `<ContentItem source="${template.source}"${typeAttribute} location="${escapeXmlText(streamUrl)}" sourceAccount="" isPresetable="true">\n  <itemName>${escapeXmlText(radioName)}</itemName>\n</ContentItem>`;
}

function formatBridgePostResponse(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return JSON.stringify(payload, null, 2);
  }

  const data = payload as {
    requestXml?: string;
    requestXmlSequence?: string[];
    boseResponse?: unknown;
  };

  if (!data.requestXml && !data.requestXmlSequence) {
    return JSON.stringify(payload, null, 2);
  }

  const requestXml = data.requestXmlSequence?.join('\n') ?? data.requestXml;

  return [
    'Request XML inviata:',
    requestXml,
    '',
    'Response Bose ricevuta:',
    JSON.stringify(data.boseResponse, null, 2)
  ].join('\n');
}

async function readResponseBody(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return formatBridgePostResponse(await response.json());
  }

  return response.text();
}

function statusFromInfoResponse(response: Response, body: string): ConnectionStatus {
  if (response.ok && /<info\b/i.test(body)) {
    return 'online';
  }

  if (response.status === 504 || /timeout/i.test(body)) {
    return 'timeout';
  }

  if (response.ok) {
    return 'non Bose';
  }

  return 'offline';
}


function extractXmlValue(xml: string, tagName: string) {
  const match = xml.match(new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'i'));
  return match?.[1]?.trim() || null;
}

function extractXmlAttribute(xml: string, attributeName: string) {
  const match = xml.match(new RegExp(`${attributeName}="([^"]+)"`, 'i'));
  return match?.[1]?.trim() || null;
}

function parseRestSnapshot(nowPlayingXml: string, volumeXml: string) {
  return {
    source: extractXmlAttribute(nowPlayingXml, 'source') ?? extractXmlValue(nowPlayingXml, 'source'),
    title: extractXmlValue(nowPlayingXml, 'track')
      ?? extractXmlValue(nowPlayingXml, 'itemName')
      ?? extractXmlValue(nowPlayingXml, 'stationName'),
    artist: extractXmlValue(nowPlayingXml, 'artist'),
    playStatus: extractXmlValue(nowPlayingXml, 'playStatus') ?? extractXmlValue(nowPlayingXml, 'state'),
    itemName: extractXmlValue(nowPlayingXml, 'itemName'),
    stationName: extractXmlValue(nowPlayingXml, 'stationName'),
    volume: extractXmlValue(volumeXml, 'actualvolume') ?? extractXmlValue(volumeXml, 'volume')
  };
}


function parseXmlAttributes(fragment: string) {
  return Object.fromEntries([...fragment.matchAll(/([\w:-]+)="([^"]*)"/g)].map((match) => [match[1], match[2]]));
}


function formatXml(xml: string) {
  return xml
    .replace(/></g, '>' + '\n' + '<')
    .split('\n')
    .reduce<{ depth: number; lines: string[] }>((acc, line) => {
      const trimmed = line.trim();
      const closes = /^<\//.test(trimmed);
      const selfClosing = /\/?>$/.test(trimmed) && /\/>$/.test(trimmed);
      const declaration = /^<\?/.test(trimmed) || /^<!--/.test(trimmed);
      const depth = closes ? Math.max(acc.depth - 1, 0) : acc.depth;
      acc.lines.push(`${'  '.repeat(depth)}${trimmed}`);
      acc.depth = !closes && !selfClosing && !declaration && /^<[^/!][^>]*>$/.test(trimmed) ? depth + 1 : depth;
      return acc;
    }, { depth: 0, lines: [] })
    .lines
    .join('\n');
}

function findXmlBlocks(xml: string, tagName: string) {
  return [...xml.matchAll(new RegExp(`<${tagName}\\b[\\s\\S]*?</${tagName}>`, 'gi'))].map((match) => match[0]);
}

function parsePresetXml(presetXml: string): ParsedPreset {
  const openTag = presetXml.match(/<preset\b[^>]*>/i)?.[0] ?? '';
  const contentItemXml = presetXml.match(/<ContentItem\b[\s\S]*?<\/ContentItem>/i)?.[0] ?? null;
  const attrs = parseXmlAttributes(openTag);
  const contentAttrs = parseXmlAttributes(contentItemXml?.match(/<ContentItem\b[^>]*>/i)?.[0] ?? '');
  const dataXml = contentItemXml ?? presetXml;

  return {
    id: attrs.id ?? extractXmlValue(presetXml, 'id'),
    source: contentAttrs.source ?? extractXmlAttribute(dataXml, 'source') ?? extractXmlValue(dataXml, 'source'),
    sourceAccount: contentAttrs.sourceAccount ?? extractXmlAttribute(dataXml, 'sourceAccount') ?? extractXmlValue(dataXml, 'sourceAccount'),
    location: contentAttrs.location ?? extractXmlValue(dataXml, 'location'),
    container: extractXmlValue(dataXml, 'container'),
    itemName: extractXmlValue(dataXml, 'itemName'),
    art: extractXmlValue(dataXml, 'art'),
    stationName: extractXmlValue(dataXml, 'stationName'),
    contentItemXml
  };
}

function parseSourcesXml(xml: string): BoseSourceItem[] {
  return findXmlBlocks(xml, 'sourceItem').map((sourceXml) => ({
    source: extractXmlAttribute(sourceXml, 'source'),
    sourceAccount: extractXmlAttribute(sourceXml, 'sourceAccount'),
    status: extractXmlAttribute(sourceXml, 'status'),
    isLocal: extractXmlAttribute(sourceXml, 'isLocal'),
    multiroomAllowed: extractXmlAttribute(sourceXml, 'multiroomallowed'),
    text: sourceXml.replace(/<[^>]+>/g, '').trim() || null
  }));
}

function parseInspectorXml(label: InspectorTab, rawXml: string) {
  const rootTag = rawXml.match(/<([a-zA-Z][\w:-]*)\b/)?.[1] ?? 'raw';
  const base = { rootTag, attributes: parseXmlAttributes(rawXml.match(/<[^!?][^>]*>/)?.[0] ?? '') };

  if (label === 'Presets') {
    return { ...base, presets: findXmlBlocks(rawXml, 'preset').map(parsePresetXml) };
  }

  if (label === 'Sources') {
    return { ...base, sources: parseSourcesXml(rawXml) };
  }

  if (label === 'Now Playing') {
    return { ...base, nowPlaying: parseRestSnapshot(rawXml, '') };
  }

  if (label === 'Info') {
    return {
      ...base,
      info: {
        name: extractXmlValue(rawXml, 'name'),
        type: extractXmlValue(rawXml, 'type'),
        deviceID: extractXmlAttribute(rawXml, 'deviceID') ?? extractXmlValue(rawXml, 'deviceID'),
        networkInfo: extractXmlValue(rawXml, 'networkInfo')
      }
    };
  }

  return base;
}

function parsePresetResearchXml(xml: string) {
  const presets = findXmlBlocks(xml, 'preset').map((presetXml) => {
    const openTag = presetXml.match(/<preset\b[^>]*>/i)?.[0] ?? '';
    const attrs = parseXmlAttributes(openTag);
    const parsed = parsePresetXml(presetXml);

    return {
      ...parsed,
      updatedOn: attrs.updatedOn ?? attrs.updatedon ?? extractXmlAttribute(presetXml, 'updatedOn') ?? extractXmlValue(presetXml, 'updatedOn')
    };
  });

  return {
    rootTag: xml.match(/<([a-zA-Z][\w:-]*)\b/)?.[1] ?? 'raw',
    presetCount: presets.length,
    updatedOnValues: presets.map((preset) => preset.updatedOn).filter(Boolean),
    contentItems: presets.map((preset) => preset.contentItemXml).filter(Boolean),
    presets
  };
}

function parseExperimentalXml(xml: string) {
  const rootTag = xml.match(/<([a-zA-Z][\w:-]*)\b/)?.[1] ?? 'raw';
  const firstTag = xml.match(/<[^!?][^>]*>/)?.[0] ?? '';
  const interestingTags = ['ContentItem', 'capability', 'capabilities', 'endpoint', 'url', 'service', 'sourceItem', 'recent', 'nowSelection', 'selection'];
  const absoluteUrls = [...xml.matchAll(/https?:\/\/[^\s<"]+/gi)].map((match) => match[0]);
  const urlElements = [...xml.matchAll(/<url\b[^>]*>([^<]+)<\/url>/gi)].map((match) => match[1].trim()).filter(Boolean);
  const urlAttributes = [...xml.matchAll(/\b(?:url|href|location|endpoint|path)="([^"]+)"/gi)].map((match) => match[1].trim()).filter(Boolean);
  const urls = [...new Set([...absoluteUrls, ...urlElements, ...urlAttributes])];

  return {
    rootTag,
    attributes: parseXmlAttributes(firstTag),
    values: Object.fromEntries(interestingTags.map((tag) => [tag, extractXmlValue(xml, tag)]).filter(([, value]) => Boolean(value))),
    contentItems: findXmlBlocks(xml, 'ContentItem').map((block) => ({
      attributes: parseXmlAttributes(block.match(/<ContentItem\b[^>]*>/i)?.[0] ?? ''),
      itemName: extractXmlValue(block, 'itemName'),
      rawXml: block
    })),
    sourceItems: parseSourcesXml(xml),
    links: absoluteUrls,
    urls,
    highlightedTerms: CAPABILITY_HIGHLIGHT_PATTERNS.filter((pattern) => new RegExp(pattern, 'i').test(xml))
  };
}

function summarizePresetChange(before?: PresetResearchSnapshot, after?: PresetResearchSnapshot) {
  if (!before || !after) {
    return 'presets non confrontati';
  }

  const beforeJson = JSON.stringify(before.parsed.contentItems);
  const afterJson = JSON.stringify(after.parsed.contentItems);
  const beforeUpdatedOn = JSON.stringify(before.parsed.updatedOnValues);
  const afterUpdatedOn = JSON.stringify(after.parsed.updatedOnValues);

  if (beforeJson !== afterJson || beforeUpdatedOn !== afterUpdatedOn || before.rawXml !== after.rawXml) {
    return 'presets cambiati';
  }

  return 'nessuna modifica preset rilevata';
}

function summarizeSourceChange(before?: PresetLabPoll, after?: PresetLabPoll[]) {
  const latest = after?.length ? after[after.length - 1] : null;
  if (!before || !latest) {
    return 'now_playing non confrontato';
  }

  if (before.parsed.source !== latest.parsed.source || before.parsed.title !== latest.parsed.title || before.parsed.playStatus !== latest.parsed.playStatus) {
    return 'now_playing cambiato';
  }

  return 'nessun cambio now_playing rilevato';
}

function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function getStoredIp() {
  return window.localStorage.getItem(LAST_IP_STORAGE_KEY) ?? '192.168.1.50';
}

function DiagnosticsApp() {
  const [boseIp, setBoseIp] = useState(() => getStoredIp());
  const [volume, setVolume] = useState(30);
  const [response, setResponse] = useState<ApiResponse>(() => makeInitialResponse());
  const [radios, setRadios] = useState<Radio[]>([]);
  const [replacementPresets, setReplacementPresets] = useState<ReplacementPreset[]>([]);
  const [deviceName, setDeviceName] = useState('SoundTouch 30');
  const [availableSources, setAvailableSources] = useState<BoseSourceItem[]>([]);
  const [editingPresetId, setEditingPresetId] = useState<number | null>(null);
  const [replacementLoading, setReplacementLoading] = useState(false);
  const [replacementSavingId, setReplacementSavingId] = useState<number | null>(null);
  const [replacementStreamChecks, setReplacementStreamChecks] = useState<Record<number, StreamCheckResult>>({});
  const [radioPresetPlayingId, setRadioPresetPlayingId] = useState<number | null>(null);
  const [radioPresetNowPlaying, setRadioPresetNowPlaying] = useState<ReplacementPreset | null>(null);
  const [radioPresetLastResult, setRadioPresetLastResult] = useState<RadioPresetPlayResult | null>(null);
  const [radioSearchQuery, setRadioSearchQuery] = useState('');
  const [radioSearchCountry, setRadioSearchCountry] = useState('');
  const [radioSearchTag, setRadioSearchTag] = useState('');
  const [radioSearchLoading, setRadioSearchLoading] = useState(false);
  const [radioSearchError, setRadioSearchError] = useState('');
  const [radioSearchResults, setRadioSearchResults] = useState<RadioSearchResult[]>([]);
  const [manualPresetDraft, setManualPresetDraft] = useState({ name: '', streamUrl: '', logoUrl: '', category: '', notes: '' });
  const [selectedUpnpPresetId, setSelectedUpnpPresetId] = useState(2);
  const [upnpStreamUrl, setUpnpStreamUrl] = useState(UPNP_TEST_STREAMS[0]);
  const [upnpSetUriMode, setUpnpSetUriMode] = useState<UpnpSetUriMode>('direct');
  const [upnpLoading, setUpnpLoading] = useState(false);
  const [upnpLastResult, setUpnpLastResult] = useState<UpnpPlaybackLog | null>(null);
  const [upnpHistory, setUpnpHistory] = useState<UpnpPlaybackLog[]>([]);
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [technicalLogs, setTechnicalLogs] = useState<TechnicalLog[]>([
    makeLog('idle', 'Dashboard pronta. Cerca dispositivi Bose o testa l’IP attivo.')
  ]);
  const [discovering, setDiscovering] = useState(false);
  const [lastScanSummary, setLastScanSummary] = useState('Nessuna scansione eseguita.');
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [realtimeState, setRealtimeState] = useState('disconnesso');
  const [realtimeSnapshot, setRealtimeSnapshot] = useState<RealtimeSnapshot>({
    source: 'n/d',
    title: 'n/d',
    artist: 'n/d',
    playStatus: 'n/d',
    volume: 'n/d'
  });
  const [realtimeEvents, setRealtimeEvents] = useState<RealtimeEvent[]>([]);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('Info');
  const [inspectorRecords, setInspectorRecords] = useState<Partial<Record<InspectorTab, InspectorRecord>>>({});
  const [inspectorLoading, setInspectorLoading] = useState(false);
  const [selectXml, setSelectXml] = useState(SELECT_TEMPLATES.tuneIn);
  const [selectResult, setSelectResult] = useState<SelectResult | null>(null);
  const [selectHistory, setSelectHistory] = useState<SelectResult[]>([]);
  const [selectLoading, setSelectLoading] = useState(false);
  const [localRadioXml, setLocalRadioXml] = useState('');
  const [localRadioCustomStreamUrl, setLocalRadioCustomStreamUrl] = useState('');
  const [localRadioResult, setLocalRadioResult] = useState<LocalRadioTestResult | null>(null);
  const [localRadioHistory, setLocalRadioHistory] = useState<LocalRadioTestResult[]>([]);
  const [localRadioLoading, setLocalRadioLoading] = useState(false);
  const [browserStreamUrl, setBrowserStreamUrl] = useState('');
  const [presetLabLoading, setPresetLabLoading] = useState(false);
  const [presetLabHistory, setPresetLabHistory] = useState<PresetLabExperiment[]>([]);
  const [presetLabResult, setPresetLabResult] = useState<PresetLabExperiment | null>(null);
  const [recentsResearch, setRecentsResearch] = useState<ExperimentalEndpointResult | null>(null);
  const [capabilitiesResearch, setCapabilitiesResearch] = useState<ExperimentalEndpointResult | null>(null);
  const [nowSelectionResearch, setNowSelectionResearch] = useState<ExperimentalEndpointResult | null>(null);
  const lastRealtimeErrorRawRef = useRef<string | null>(null);
  const realtimeEventsRef = useRef<RealtimeEvent[]>([]);
  const browserAudioRef = useRef<HTMLAudioElement | null>(null);
  const realtimeSourceRef = useRef<EventSource | null>(null);
  const encodedIp = useMemo(() => encodeURIComponent(boseIp.trim()), [boseIp]);
  const canSend = encodedIp.length > 0;

  useEffect(() => {
    fetch(`${API_BASE}/radios`)
      .then((res) => res.json())
      .then(setRadios)
      .catch(() => setRadios([]));
  }, []);

  useEffect(() => {
    void loadReplacementPresets();
  }, []);

  useEffect(() => {
    if (boseIp.trim()) {
      void forceRefreshRest('avvio telecomando', true);
      void runRequest('GET /info', () => fetch(`${API_BASE}/bose/${encodedIp}/info`), 'info');
    }
  }, []);

  useEffect(() => () => {
    realtimeSourceRef.current?.close();
  }, []);

  function appendLog(log: TechnicalLog) {
    setTechnicalLogs((prev) => [log, ...prev].slice(0, 300));
  }

  function appendLogs(logs: TechnicalLog[]) {
    setTechnicalLogs((prev) => [...logs.reverse(), ...prev].slice(0, 300));
  }

  function setActiveIp(ip: string, source: string) {
    setBoseIp(ip);
    window.localStorage.setItem(LAST_IP_STORAGE_KEY, ip);
    appendLog(makeLog('online', `IP attivo impostato da ${source}: ${ip}`, ip));
    if (realtimeSourceRef.current) {
      disconnectRealtime();
    }
  }

  async function runRequest(title: string, request: () => Promise<Response>, endpoint?: BoseEndpoint) {
    if (!canSend) {
      setConnectionStatus('offline');
      setResponse({ title, status: 'error', body: 'Inserisci prima un indirizzo IP Bose valido.', timestamp: now() });
      appendLog(makeLog('offline', 'Richiesta annullata: IP Bose mancante.'));
      return;
    }

    setResponse({ title, status: 'loading', body: 'Richiesta in corso sulla LAN…', timestamp: now() });
    appendLog(makeLog('scanning', `${title} verso ${boseIp}`, boseIp));

    try {
      const apiResponse = await request();
      const body = await readResponseBody(apiResponse);
      const requestStatus = apiResponse.ok ? 'success' : 'error';
      setResponse({
        title: `${title} — HTTP ${apiResponse.status}`,
        status: requestStatus,
        body,
        timestamp: now()
      });

      if (endpoint === 'info') {
        const nextStatus = statusFromInfoResponse(apiResponse, body);
        setConnectionStatus(nextStatus);
        const parsedName = extractXmlValue(body, 'name');
        if (parsedName) {
          setDeviceName(parsedName);
        }
        appendLog(makeLog(nextStatus, `GET /info completato con stato ${nextStatus}.`, boseIp));
        if (nextStatus === 'online') {
          window.localStorage.setItem(LAST_IP_STORAGE_KEY, boseIp);
        }
      }
    } catch (error) {
      setConnectionStatus('offline');
      const message = error instanceof Error ? error.message : 'Errore sconosciuto.';
      setResponse({ title, status: 'error', body: message, timestamp: now() });
      appendLog(makeLog('offline', message, boseIp));
    }
  }

  async function discoverDevices() {
    setDiscovering(true);
    setConnectionStatus('scanning');
    setLastScanSummary('Scansione subnet locale in corso: IP .1-.254, timeout 800ms per host.');
    appendLog(makeLog('scanning', 'Avvio scansione LAN Bose SoundTouch.'));

    try {
      const res = await fetch(`${API_BASE}/discover`);
      const payload = (await res.json()) as DiscoverResponse;
      setDevices(payload.devices ?? []);
      appendLogs(payload.logs ?? []);

      const summary = payload.error
        ? payload.error
        : `Scansione ${payload.subnet?.cidr ?? 'subnet locale'} completata: ${payload.devices?.length ?? 0} device Bose trovati su ${payload.scannedHosts ?? 254} host in ${payload.durationMs ?? 0}ms.`;
      setLastScanSummary(summary);
      appendLog(makeLog(payload.devices?.length ? 'online' : 'offline', summary));

      if (payload.devices?.length) {
        setConnectionStatus('online');
        setActiveIp(payload.devices[0].ip, 'scansione automatica');
      } else {
        setConnectionStatus(res.ok ? 'offline' : 'timeout');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore sconosciuto durante la scansione.';
      setConnectionStatus('offline');
      setLastScanSummary(message);
      appendLog(makeLog('offline', message));
    } finally {
      setDiscovering(false);
    }
  }

  function getEndpoint(endpoint: BoseEndpoint) {
    void runRequest(`GET /${endpoint}`, () => fetch(`${API_BASE}/bose/${encodedIp}/${endpoint}`), endpoint);
  }

  async function forceRefreshRest(reason = 'manuale', includeSources = true) {
    if (!canSend) {
      appendLog(makeLog('offline', 'Force refresh REST annullato: IP Bose mancante.'));
      return;
    }

    appendLog(makeLog('scanning', `Force refresh REST (${reason}) verso ${boseIp}`, boseIp));

    try {
      const [nowPlayingResponse, volumeResponse, sourcesResponse] = await Promise.all([
        fetch(`${API_BASE}/bose/${encodedIp}/now_playing`),
        fetch(`${API_BASE}/bose/${encodedIp}/volume`),
        includeSources ? fetch(`${API_BASE}/bose/${encodedIp}/sources`) : Promise.resolve(null)
      ]);
      const [nowPlayingXml, volumeXml, sourcesXml] = await Promise.all([
        nowPlayingResponse.text(),
        volumeResponse.text(),
        sourcesResponse ? sourcesResponse.text() : Promise.resolve('')
      ]);
      const restSnapshot = parseRestSnapshot(nowPlayingXml, volumeXml);
      if (includeSources && sourcesXml) {
        setAvailableSources(parseSourcesXml(sourcesXml));
      }

      setRealtimeSnapshot((prev) => ({
        source: restSnapshot.source || prev.source,
        title: restSnapshot.title || prev.title,
        artist: restSnapshot.artist || prev.artist,
        playStatus: restSnapshot.playStatus || prev.playStatus,
        itemName: restSnapshot.itemName || prev.itemName,
        stationName: restSnapshot.stationName || prev.stationName,
        volume: restSnapshot.volume || prev.volume
      }));
      setResponse({
        title: includeSources ? 'Force refresh REST — now_playing / volume / sources' : 'Sync REST — now_playing / volume',
        status: nowPlayingResponse.ok && volumeResponse.ok && (sourcesResponse?.ok ?? true) ? 'success' : 'error',
        timestamp: now(),
        body: [
          'GET /now_playing',
          nowPlayingXml,
          '',
          'GET /volume',
          volumeXml,
          ...(includeSources ? ['', 'GET /sources', sourcesXml] : [])
        ].join('\n')
      });
      appendLog(makeLog('online', `Force refresh REST completato (${reason}).`, boseIp));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore sconosciuto durante force refresh REST.';
      appendLog(makeLog('offline', message, boseIp));
    }
  }

  function postVolume() {
    void (async () => {
      await runRequest('POST /volume XML', () =>
        fetch(`${API_BASE}/bose/${encodedIp}/volume`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ volume })
        })
      );
      window.setTimeout(() => {
        void forceRefreshRest('sync dopo comando volume app', false);
      }, 300);
    })();
  }

  function postKey(key: BoseKey) {
    void (async () => {
      await runRequest(`POST /key ${key}`, () =>
        fetch(`${API_BASE}/bose/${encodedIp}/key`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key })
        })
      );
      window.setTimeout(() => {
        void forceRefreshRest(`sync dopo comando ${key} app`, false);
      }, 300);
    })();
  }


  function applyRealtimeEvent(event: RealtimeEvent) {
    setRealtimeEvents((prev) => {
      const nextEvents = [event, ...prev].slice(0, 50);
      realtimeEventsRef.current = nextEvents;
      return nextEvents;
    });

    if (event.eventName === 'errorUpdate' || /<errorUpdate\b/i.test(event.raw ?? '')) {
      const rawError = event.raw ?? JSON.stringify(event, null, 2);
      lastRealtimeErrorRawRef.current = rawError;
    }

    if (event.connectionState || event.eventName === 'connectionStateUpdated') {
      setRealtimeState(event.connectionState ?? event.message ?? 'connectionStateUpdated');
      appendLog(makeLog(event.connectionState ?? 'realtime', event.message ?? 'Evento realtime connectionStateUpdated.', boseIp));
    }

    setRealtimeSnapshot((prev) => ({
      source: event.source || prev.source,
      title: event.title || prev.title,
      artist: event.artist || prev.artist,
      playStatus: event.playStatus || prev.playStatus,
      volume: event.volume || prev.volume
    }));
  }

  function disconnectRealtime() {
    realtimeSourceRef.current?.close();
    realtimeSourceRef.current = null;
    setRealtimeConnected(false);
    setRealtimeState('disconnesso');
    appendLog(makeLog('offline', 'Realtime disconnesso dal frontend.', boseIp));
  }

  function connectRealtime() {
    if (!canSend) {
      appendLog(makeLog('offline', 'Realtime non avviato: IP Bose mancante.'));
      return;
    }

    realtimeSourceRef.current?.close();
    setRealtimeConnected(true);
    setRealtimeState('connessione...');
    appendLog(makeLog('scanning', `Avvio realtime backend -> ws://${boseIp}:8080`, boseIp));

    const source = new EventSource(`${API_BASE}/realtime/${encodedIp}`);
    realtimeSourceRef.current = source;

    source.addEventListener('soundtouch', (message) => {
      const event = JSON.parse((message as MessageEvent).data) as RealtimeEvent;
      applyRealtimeEvent(event);
    });

    source.onerror = () => {
      setRealtimeState('reconnect automatico');
      appendLog(makeLog('timeout', 'SSE realtime interrotto: il browser ritenterà automaticamente.', boseIp));
    };
  }


  function getInspectorEndpoint(tab: InspectorTab) {
    if (tab === 'Info') return 'info';
    if (tab === 'Sources') return 'sources';
    if (tab === 'Presets') return 'presets';
    if (tab === 'Now Playing') return 'now-playing';
    return null;
  }

  async function loadInspectorTab(tab = inspectorTab) {
    const endpoint = getInspectorEndpoint(tab);
    if (!endpoint || !canSend) {
      return;
    }

    setInspectorLoading(true);
    try {
      const res = await fetch(`${API_BASE}/bose/${encodedIp}/${endpoint}`);
      const rawXml = await res.text();
      const record: InspectorRecord = {
        label: tab,
        endpoint,
        rawXml,
        parsedJson: parseInspectorXml(tab, rawXml),
        timestamp: new Date().toISOString()
      };
      setInspectorRecords((prev) => ({ ...prev, [tab]: record }));
      appendLog(makeLog(res.ok ? 'online' : 'offline', `Inspector ${tab}: HTTP ${res.status}`, boseIp));
    } catch (error) {
      appendLog(makeLog('offline', error instanceof Error ? error.message : `Inspector ${tab} fallito.`, boseIp));
    } finally {
      setInspectorLoading(false);
    }
  }

  async function loadAllInspectorTabs() {
    for (const tab of ['Info', 'Sources', 'Presets', 'Now Playing'] as InspectorTab[]) {
      await loadInspectorTab(tab);
    }
  }

  function exportDiagnosticsJson() {
    const payload = {
      exportedAt: new Date().toISOString(),
      activeIp: boseIp,
      inspectorRecords,
      websocketEvents: realtimeEvents
    };
    downloadText(`soundtouch-diagnostics-${boseIp || 'device'}.json`, JSON.stringify(payload, null, 2), 'application/json');
  }

  function exportRawXml() {
    const text = Object.values(inspectorRecords)
      .filter(Boolean)
      .map((record) => `<!-- ${record.label} · ${record.endpoint} · ${record.timestamp} -->\n${record.rawXml}`)
      .join('\n\n');
    downloadText(`soundtouch-raw-${boseIp || 'device'}.xml`, text || '<!-- Nessun XML inspector caricato -->', 'application/xml');
  }


  function getParsedPresets() {
    return (inspectorRecords.Presets?.parsedJson as { presets?: ParsedPreset[] } | undefined)?.presets ?? [];
  }

  function waitFor(ms: number) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  async function pollSelectVerification(delayMs: number): Promise<SelectPoll> {
    const [nowPlayingResponse, volumeResponse] = await Promise.all([
      fetch(`${API_BASE}/bose/${encodedIp}/now_playing`),
      fetch(`${API_BASE}/bose/${encodedIp}/volume`)
    ]);
    const [nowPlayingXml, volumeXml] = await Promise.all([
      nowPlayingResponse.text(),
      volumeResponse.text()
    ]);
    const parsed = parseRestSnapshot(nowPlayingXml, volumeXml);

    setRealtimeSnapshot((prev) => ({
      source: parsed.source || prev.source,
      title: parsed.title || prev.title,
      artist: parsed.artist || prev.artist,
      playStatus: parsed.playStatus || prev.playStatus,
      itemName: parsed.itemName || prev.itemName,
      stationName: parsed.stationName || prev.stationName,
      volume: parsed.volume || prev.volume
    }));

    return {
      delayMs,
      timestamp: new Date().toISOString(),
      httpStatus: { nowPlaying: nowPlayingResponse.status, volume: volumeResponse.status },
      nowPlayingXml,
      volumeXml,
      parsed
    };
  }

  function getLastSelectPoll(polls: SelectPoll[]) {
    return polls.length > 0 ? polls[polls.length - 1] : null;
  }

  function getSelectOutcome(polls: SelectPoll[], errorUpdateRaw?: string | null): SelectResult['outcome'] {
    if (errorUpdateRaw) {
      return 'error';
    }

    return polls.some((poll) => ['TUNEIN', 'LOCAL_INTERNET_RADIO'].includes(String(poll.parsed.source ?? '').toUpperCase()))
      ? 'success'
      : 'failed';
  }

  function exportSelectHistoryJson() {
    downloadText(
      `soundtouch-select-history-${boseIp || 'device'}.json`,
      JSON.stringify({ exportedAt: new Date().toISOString(), activeIp: boseIp, selectHistory }, null, 2),
      'application/json'
    );
  }

  async function trySelectXml(xml: string, presetLabel?: string) {
    if (!canSend) {
      appendLog(makeLog('offline', 'Select annullato: IP Bose mancante.'));
      return;
    }

    const requestXml = xml.trim();
    if (!requestXml) {
      appendLog(makeLog('offline', 'Select annullato: XML ContentItem vuoto.'));
      return;
    }

    setSelectLoading(true);
    lastRealtimeErrorRawRef.current = null;
    const startedAt = new Date().toISOString();

    try {
      const res = await fetch(`${API_BASE}/bose/${encodedIp}/select`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
          Accept: 'application/xml'
        },
        body: requestXml
      });
      const responseBody = await readResponseBody(res);
      let nextResult: SelectResult = {
        presetLabel,
        requestXml,
        responseBody,
        httpStatus: res.status,
        timestamp: startedAt,
        polls: [],
        outcome: 'pending',
        errorUpdateRaw: null
      };
      setSelectResult(nextResult);
      appendLog(makeLog(res.ok ? 'online' : 'offline', `POST /select HTTP ${res.status}`, boseIp));

      let elapsedMs = 0;
      for (const delayMs of [500, 1500, 3000]) {
        await waitFor(delayMs - elapsedMs);
        elapsedMs = delayMs;
        const poll = await pollSelectVerification(delayMs);
        nextResult = {
          ...nextResult,
          polls: [...nextResult.polls, poll],
          errorUpdateRaw: lastRealtimeErrorRawRef.current,
          outcome: getSelectOutcome([...nextResult.polls, poll], lastRealtimeErrorRawRef.current)
        };
        setSelectResult(nextResult);
      }

      setSelectHistory((prev) => [nextResult, ...prev].slice(0, 50));
      appendLog(makeLog(nextResult.outcome === 'success' ? 'online' : 'offline', `Verifica /select: ${nextResult.outcome}`, boseIp));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore sconosciuto POST /select.';
      const failedResult: SelectResult = {
        presetLabel,
        requestXml,
        responseBody: message,
        httpStatus: null,
        timestamp: startedAt,
        polls: [],
        outcome: 'error',
        errorUpdateRaw: lastRealtimeErrorRawRef.current
      };
      setSelectResult(failedResult);
      setSelectHistory((prev) => [failedResult, ...prev].slice(0, 50));
      appendLog(makeLog('offline', message, boseIp));
    } finally {
      setSelectLoading(false);
    }
  }

  async function tryAllPresets() {
    const presets = getParsedPresets().filter((preset) => preset.contentItemXml);
    if (presets.length === 0) {
      appendLog(makeLog('offline', 'Try all presets annullato: nessun ContentItem disponibile.'));
      return;
    }

    for (const [index, preset] of presets.entries()) {
      const label = preset.itemName ?? preset.stationName ?? `Preset ${preset.id ?? index + 1}`;
      if (!window.confirm(`Provare il preset ${index + 1}/${presets.length}: ${label}?`)) {
        appendLog(makeLog('idle', `Try all presets interrotto prima di ${label}.`, boseIp));
        break;
      }

      await trySelectXml(preset.contentItemXml!, label);
    }
  }


  function getLocalRadioStreamUrl(radio?: Radio) {
    return localRadioCustomStreamUrl.trim() || radio?.streamUrl || '';
  }

  function makeLocalRadioXml(template: LocalRadioTemplate, radio?: Radio) {
    const streamUrl = getLocalRadioStreamUrl(radio);
    const radioName = radio?.name ?? 'Custom Direct Stream';

    return buildLocalRadioSelectXml(template, streamUrl, radioName);
  }

  function previewLocalRadioTemplate(template: LocalRadioTemplate, radio?: Radio) {
    const xml = makeLocalRadioXml(template, radio);
    setLocalRadioXml(xml);
  }

  function getLatestLocalRadioPoll(polls: LocalRadioPoll[]) {
    return polls.length > 0 ? polls[polls.length - 1] : null;
  }

  function getLocalRadioOutcome(polls: LocalRadioPoll[], templateId: LocalRadioTemplateId, errorUpdateRaw?: string | null): LocalRadioTestResult['outcome'] {
    if (errorUpdateRaw) {
      return 'error';
    }

    const latestPoll = getLatestLocalRadioPoll(polls);
    const latestSource = String(latestPoll?.parsed.source ?? '').toUpperCase();
    const expectedSource = templateId === 'D' ? 'TUNEIN' : 'LOCAL_INTERNET_RADIO';

    return latestSource === expectedSource ? 'success' : 'failed';
  }

  async function pollLocalRadioNowPlaying(delayMs: number): Promise<LocalRadioPoll> {
    const response = await fetch(`${API_BASE}/bose/${encodedIp}/now_playing`);
    const nowPlayingXml = await response.text();
    const parsed = parseRestSnapshot(nowPlayingXml, '');

    setRealtimeSnapshot((prev) => ({
      source: parsed.source || prev.source,
      title: parsed.title || prev.title,
      artist: parsed.artist || prev.artist,
      playStatus: parsed.playStatus || prev.playStatus,
      itemName: parsed.itemName || prev.itemName,
      stationName: parsed.stationName || prev.stationName,
      volume: prev.volume
    }));

    return {
      delayMs,
      timestamp: new Date().toISOString(),
      httpStatus: response.status,
      nowPlayingXml,
      parsed
    };
  }

  async function runLocalRadioXmlTest(options: { templateId: LocalRadioTemplateId; templateLabel: string; radioName: string; streamUrl: string; xml: string }) {
    if (!canSend) {
      appendLog(makeLog('offline', 'Local Internet Radio test annullato: IP Bose mancante.'));
      return;
    }

    const requestXml = options.xml.trim();
    if (!requestXml) {
      appendLog(makeLog('offline', 'Local Internet Radio test annullato: XML vuoto.'));
      return;
    }

    setLocalRadioLoading(true);
    lastRealtimeErrorRawRef.current = null;
    const startedAt = new Date().toISOString();

    try {
      const response = await fetch(`${API_BASE}/bose/${encodedIp}/select`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
          Accept: 'application/xml'
        },
        body: requestXml
      });
      const responseBody = await readResponseBody(response);
      let nextResult: LocalRadioTestResult = {
        ...options,
        requestXml,
        responseBody,
        httpStatus: response.status,
        timestamp: startedAt,
        nowPlaying: [],
        errorUpdateRaw: null,
        outcome: 'pending'
      };
      setLocalRadioResult(nextResult);
      appendLog(makeLog(response.ok ? 'online' : 'offline', `Local Internet Radio POST /select ${options.templateLabel}: HTTP ${response.status}`, boseIp));

      let elapsedMs = 0;
      for (const delayMs of LOCAL_RADIO_POLL_DELAYS) {
        await waitFor(delayMs - elapsedMs);
        elapsedMs = delayMs;
        const poll = await pollLocalRadioNowPlaying(delayMs);
        const nowPlaying = [...nextResult.nowPlaying, poll];
        nextResult = {
          ...nextResult,
          nowPlaying,
          errorUpdateRaw: lastRealtimeErrorRawRef.current,
          outcome: getLocalRadioOutcome(nowPlaying, options.templateId, lastRealtimeErrorRawRef.current)
        };
        setLocalRadioResult(nextResult);
      }

      setLocalRadioHistory((prev) => [nextResult, ...prev].slice(0, 100));
      appendLog(makeLog(nextResult.outcome === 'success' ? 'online' : 'offline', `Local Internet Radio verifica ${options.templateLabel}: ${nextResult.outcome}`, boseIp));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore sconosciuto Local Internet Radio test.';
      const failedResult: LocalRadioTestResult = {
        ...options,
        requestXml,
        responseBody: message,
        httpStatus: null,
        timestamp: startedAt,
        nowPlaying: [],
        errorUpdateRaw: lastRealtimeErrorRawRef.current,
        outcome: 'error'
      };
      setLocalRadioResult(failedResult);
      setLocalRadioHistory((prev) => [failedResult, ...prev].slice(0, 100));
      appendLog(makeLog('offline', message, boseIp));
    } finally {
      setLocalRadioLoading(false);
    }
  }

  async function runLocalRadioTemplateTest(template: LocalRadioTemplate, radio?: Radio) {
    const streamUrl = getLocalRadioStreamUrl(radio);
    const radioName = radio?.name ?? 'Custom Direct Stream';
    const xml = buildLocalRadioSelectXml(template, streamUrl, radioName);
    setLocalRadioXml(xml);
    await runLocalRadioXmlTest({
      templateId: template.id,
      templateLabel: template.label,
      radioName,
      streamUrl,
      xml
    });
  }

  async function runManualLocalRadioXmlTest() {
    const streamUrl = extractXmlAttribute(localRadioXml, 'location') ?? localRadioCustomStreamUrl.trim();
    const radioName = extractXmlValue(localRadioXml, 'itemName') ?? 'Manual XML';
    await runLocalRadioXmlTest({
      templateId: 'Manual',
      templateLabel: 'Manual XML',
      radioName,
      streamUrl,
      xml: localRadioXml
    });
  }

  function testStreamInBrowser(streamUrl: string) {
    const nextStreamUrl = streamUrl.trim();
    if (!nextStreamUrl) {
      appendLog(makeLog('offline', 'Test stream browser annullato: URL stream mancante.'));
      return;
    }

    setBrowserStreamUrl(nextStreamUrl);
    window.setTimeout(() => {
      void browserAudioRef.current?.play().catch((error) => {
        appendLog(makeLog('offline', error instanceof Error ? error.message : 'Playback HTML5 non avviato.', boseIp));
      });
    }, 0);
  }

  function exportLocalRadioHistoryJson() {
    downloadText(
      `soundtouch-local-radio-history-${boseIp || 'device'}.json`,
      JSON.stringify({ exportedAt: new Date().toISOString(), activeIp: boseIp, localRadioHistory }, null, 2),
      'application/json'
    );
  }


  function getRealtimeEventsSince(timestampIso: string) {
    const startedAt = new Date(timestampIso).getTime();
    return realtimeEventsRef.current.filter((event) => new Date(event.timestamp).getTime() >= startedAt);
  }

  async function fetchPresetLabNowPlaying(delayMs = 0): Promise<PresetLabPoll> {
    const response = await fetch(`${API_BASE}/bose/${encodedIp}/now_playing`);
    const nowPlayingXml = await response.text();
    const parsed = parseRestSnapshot(nowPlayingXml, '');

    setRealtimeSnapshot((prev) => ({
      source: parsed.source || prev.source,
      title: parsed.title || prev.title,
      artist: parsed.artist || prev.artist,
      playStatus: parsed.playStatus || prev.playStatus,
      itemName: parsed.itemName || prev.itemName,
      stationName: parsed.stationName || prev.stationName,
      volume: prev.volume
    }));

    return {
      delayMs,
      timestamp: new Date().toISOString(),
      httpStatus: response.status,
      nowPlayingXml,
      parsed
    };
  }

  async function fetchPresetResearchSnapshot(): Promise<PresetResearchSnapshot> {
    const response = await fetch(`${API_BASE}/bose/${encodedIp}/presets`);
    const rawXml = await response.text();

    return {
      httpStatus: response.status,
      rawXml,
      parsed: parsePresetResearchXml(rawXml)
    };
  }

  async function sendPresetLabKey(command: Extract<PresetLabCommand, `PRESET_${number}` | 'ADD_FAVORITE' | 'REMOVE_FAVORITE'>) {
    const response = await fetch(`${API_BASE}/bose/${encodedIp}/key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: command })
    });
    const body = await readResponseBody(response);

    return { response, body };
  }

  async function runPresetKeyExperiment(command: Extract<PresetLabCommand, `PRESET_${number}`>) {
    if (!canSend) {
      appendLog(makeLog('offline', 'Preset key test annullato: IP Bose mancante.'));
      return;
    }

    setPresetLabLoading(true);
    lastRealtimeErrorRawRef.current = null;
    const startedAt = new Date().toISOString();

    try {
      const before = await fetchPresetLabNowPlaying(0);
      const keyResult = await sendPresetLabKey(command);
      let elapsedMs = 0;
      const after: PresetLabPoll[] = [];

      for (const delayMs of PRESET_LAB_POLL_DELAYS) {
        await waitFor(delayMs - elapsedMs);
        elapsedMs = delayMs;
        after.push(await fetchPresetLabNowPlaying(delayMs));
      }

      const sourceSummary = summarizeSourceChange(before, after);
      const errorUpdateRaw = lastRealtimeErrorRawRef.current;
      const experiment: PresetLabExperiment = {
        timestamp: startedAt,
        command,
        responseBose: keyResult.body,
        nowPlayingBefore: before,
        nowPlayingAfter: after,
        websocketEvents: getRealtimeEventsSince(startedAt),
        errorUpdateRaw,
        outcome: errorUpdateRaw ? 'errorUpdate ricevuto' : sourceSummary
      };
      setPresetLabResult(experiment);
      setPresetLabHistory((prev) => [experiment, ...prev].slice(0, 100));
      appendLog(makeLog(keyResult.response.ok ? 'online' : 'offline', `Preset Restoration ${command}: ${experiment.outcome}`, boseIp));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Preset key test fallito.';
      const experiment: PresetLabExperiment = {
        timestamp: startedAt,
        command,
        responseBose: message,
        nowPlayingAfter: [],
        websocketEvents: getRealtimeEventsSince(startedAt),
        errorUpdateRaw: lastRealtimeErrorRawRef.current,
        outcome: 'errore rete/proxy'
      };
      setPresetLabResult(experiment);
      setPresetLabHistory((prev) => [experiment, ...prev].slice(0, 100));
      appendLog(makeLog('offline', message, boseIp));
    } finally {
      setPresetLabLoading(false);
    }
  }

  async function runFavoriteExperiment(command: Extract<PresetLabCommand, 'ADD_FAVORITE' | 'REMOVE_FAVORITE'>) {
    if (!canSend) {
      appendLog(makeLog('offline', 'Favorite test annullato: IP Bose mancante.'));
      return;
    }

    setPresetLabLoading(true);
    lastRealtimeErrorRawRef.current = null;
    const startedAt = new Date().toISOString();

    try {
      const [nowPlayingBefore, presetsBefore] = await Promise.all([
        fetchPresetLabNowPlaying(0),
        fetchPresetResearchSnapshot()
      ]);
      const keyResult = await sendPresetLabKey(command);
      await waitFor(1500);
      const [nowPlayingAfter, presetsAfter] = await Promise.all([
        fetchPresetLabNowPlaying(1500),
        fetchPresetResearchSnapshot()
      ]);
      const presetSummary = summarizePresetChange(presetsBefore, presetsAfter);
      const errorUpdateRaw = lastRealtimeErrorRawRef.current;
      const experiment: PresetLabExperiment = {
        timestamp: startedAt,
        command,
        responseBose: keyResult.body,
        nowPlayingBefore,
        nowPlayingAfter: [nowPlayingAfter],
        presetsBefore,
        presetsAfter,
        websocketEvents: getRealtimeEventsSince(startedAt),
        errorUpdateRaw,
        outcome: errorUpdateRaw ? `errorUpdate ricevuto · ${presetSummary}` : presetSummary
      };
      setPresetLabResult(experiment);
      setPresetLabHistory((prev) => [experiment, ...prev].slice(0, 100));
      setInspectorRecords((prev) => ({
        ...prev,
        Presets: {
          label: 'Presets',
          endpoint: 'presets',
          rawXml: presetsAfter.rawXml,
          parsedJson: { rootTag: presetsAfter.parsed.rootTag, presets: presetsAfter.parsed.presets },
          timestamp: new Date().toISOString()
        }
      }));
      appendLog(makeLog(keyResult.response.ok ? 'online' : 'offline', `Favorite ${command}: ${experiment.outcome}`, boseIp));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Favorite test fallito.';
      const experiment: PresetLabExperiment = {
        timestamp: startedAt,
        command,
        responseBose: message,
        nowPlayingAfter: [],
        websocketEvents: getRealtimeEventsSince(startedAt),
        errorUpdateRaw: lastRealtimeErrorRawRef.current,
        outcome: 'errore rete/proxy'
      };
      setPresetLabResult(experiment);
      setPresetLabHistory((prev) => [experiment, ...prev].slice(0, 100));
      appendLog(makeLog('offline', message, boseIp));
    } finally {
      setPresetLabLoading(false);
    }
  }

  async function fetchPresetLabEndpoint(command: Extract<PresetLabCommand, 'RECENTS' | 'CAPABILITIES' | 'NOW_SELECTION'>, endpoint: 'recents' | 'capabilities' | 'now_selection') {
    if (!canSend) {
      appendLog(makeLog('offline', `GET /${endpoint} annullato: IP Bose mancante.`));
      return;
    }

    setPresetLabLoading(true);
    lastRealtimeErrorRawRef.current = null;
    const startedAt = new Date().toISOString();

    try {
      const response = await fetch(`${API_BASE}/bose/${encodedIp}/${endpoint}`);
      const result = (await response.json()) as ExperimentalEndpointResult;
      if (command === 'RECENTS') setRecentsResearch(result);
      if (command === 'CAPABILITIES') setCapabilitiesResearch(result);
      if (command === 'NOW_SELECTION') setNowSelectionResearch(result);

      const experiment: PresetLabExperiment = {
        timestamp: startedAt,
        command,
        responseBose: JSON.stringify(result, null, 2),
        nowPlayingAfter: [],
        websocketEvents: getRealtimeEventsSince(startedAt),
        errorUpdateRaw: lastRealtimeErrorRawRef.current,
        outcome: result.ok ? `endpoint disponibile HTTP ${result.status}` : `endpoint non disponibile HTTP ${result.status}`
      };
      setPresetLabResult(experiment);
      setPresetLabHistory((prev) => [experiment, ...prev].slice(0, 100));
      appendLog(makeLog(result.ok ? 'online' : 'offline', `Research /${endpoint}: ${experiment.outcome}`, boseIp));
    } catch (error) {
      const message = error instanceof Error ? error.message : `GET /${endpoint} fallito.`;
      appendLog(makeLog('offline', message, boseIp));
    } finally {
      setPresetLabLoading(false);
    }
  }

  function exportPresetLabHistoryJson() {
    downloadText(
      `soundtouch-preset-restoration-lab-${boseIp || 'device'}.json`,
      JSON.stringify({
        exportedAt: new Date().toISOString(),
        activeIp: boseIp,
        presetDiagnosis: getPresetDiagnosis(),
        presetLabHistory,
        recentsResearch,
        capabilitiesResearch,
        nowSelectionResearch
      }, null, 2),
      'application/json'
    );
  }

  async function loadReplacementPresets() {
    setReplacementLoading(true);
    try {
      const response = await fetch(`${API_BASE}/replacement-presets`);
      const presets = (await response.json()) as ReplacementPreset[];
      setReplacementPresets(presets);
    } catch (error) {
      appendLog(makeLog('offline', error instanceof Error ? error.message : 'Caricamento replacement presets fallito.'));
    } finally {
      setReplacementLoading(false);
    }
  }

  function updateReplacementPreset(id: number, patch: Partial<ReplacementPreset>) {
    setReplacementPresets((prev) => prev.map((preset) => preset.id === id ? { ...preset, ...patch } : preset));
  }

  async function saveReplacementPreset(preset: ReplacementPreset) {
    setReplacementSavingId(preset.id);
    try {
      const response = await fetch(`${API_BASE}/replacement-presets/${preset.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preset)
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? `Salvataggio preset ${preset.id} fallito.`);
      }

      updateReplacementPreset(preset.id, payload as ReplacementPreset);
      appendLog(makeLog('online', `Replacement preset ${preset.id} salvato nel JSON locale.`));
    } catch (error) {
      appendLog(makeLog('offline', error instanceof Error ? error.message : `Salvataggio preset ${preset.id} fallito.`));
    } finally {
      setReplacementSavingId(null);
    }
  }

  function openPresetEditor(preset: ReplacementPreset) {
    setEditingPresetId(preset.id);
    setManualPresetDraft({
      name: preset.name,
      streamUrl: preset.streamUrl,
      logoUrl: preset.logoUrl ?? '',
      category: preset.category ?? '',
      notes: preset.notes ?? ''
    });
    setRadioSearchError('');
  }

  function useStationInPresetEditor(station: RadioSearchResult) {
    setManualPresetDraft({
      name: station.name,
      streamUrl: station.streamUrl,
      logoUrl: station.favicon,
      category: station.tags.split(',').map((item) => item.trim()).filter(Boolean)[0] || station.country || 'Radio',
      notes: [station.codec, station.bitrate ? `${station.bitrate} kbps` : '', station.language, station.homepage].filter(Boolean).join(' · ')
    });
  }

  async function saveEditingPreset() {
    if (!editingPresetId) return;
    await saveManualPreset(editingPresetId);
    setEditingPresetId(null);
  }

  function isSelectableSource(source: BoseSourceItem) {
    const value = String(source.source ?? '').toUpperCase();
    return ['AUX', 'BLUETOOTH'].includes(value);
  }

  function getSourceLabel(source: BoseSourceItem) {
    const value = String(source.source ?? '').toUpperCase();
    if (value === 'AUX') return 'AUX';
    if (value === 'BLUETOOTH') return 'Bluetooth';
    if (value === 'AIRPLAY') return 'AirPlay';
    if (value === 'SPOTIFY') return 'Spotify';
    if (value === 'UPNP' || value === 'LOCAL_INTERNET_RADIO' || value === 'TUNEIN') return 'UPNP / Radio';
    return source.text || value || 'Sorgente';
  }

  function getSourceSelectXml(source: BoseSourceItem) {
    const value = String(source.source ?? '').toUpperCase();
    if (value === 'AUX') return '<ContentItem source="AUX" sourceAccount="AUX"></ContentItem>';
    if (value === 'BLUETOOTH') return '<ContentItem source="BLUETOOTH"></ContentItem>';
    return '';
  }

  async function selectRemoteSource(source: BoseSourceItem) {
    if (!isSelectableSource(source)) return;
    await trySelectXml(getSourceSelectXml(source), getSourceLabel(source));
    window.setTimeout(() => {
      void forceRefreshRest(`sync sorgente ${getSourceLabel(source)}`, false);
    }, 500);
  }

  function changeVolume(delta: number) {
    const nextVolume = Math.min(100, Math.max(0, volume + delta));
    setVolume(nextVolume);
    void (async () => {
      await runRequest('POST /volume XML', () =>
        fetch(`${API_BASE}/bose/${encodedIp}/volume`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ volume: nextVolume })
        })
      );
      window.setTimeout(() => {
        void forceRefreshRest('sync dopo comando volume app', false);
      }, 300);
    })();
  }

  async function saveManualPreset(presetId: number) {
    const nextPreset: ReplacementPreset = {
      id: presetId,
      name: manualPresetDraft.name.trim() || `Preset ${presetId}`,
      streamUrl: manualPresetDraft.streamUrl.trim(),
      logoUrl: manualPresetDraft.logoUrl.trim(),
      category: manualPresetDraft.category.trim() || 'Manuale',
      notes: manualPresetDraft.notes.trim(),
      enabled: true,
      lastPlayedAt: replacementPresets.find((preset) => preset.id === presetId)?.lastPlayedAt ?? ''
    };
    await saveReplacementPreset(nextPreset);
    await checkPresetStreamById(presetId);
  }

  async function searchRadios() {
    setRadioSearchLoading(true);
    setRadioSearchError('');
    try {
      const params = new URLSearchParams();
      if (radioSearchQuery.trim()) params.set('q', radioSearchQuery.trim());
      if (radioSearchCountry.trim()) params.set('country', radioSearchCountry.trim());
      if (radioSearchTag.trim()) params.set('tag', radioSearchTag.trim());
      const response = await fetch(`${API_BASE}/radio-search?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? 'Ricerca Radio Browser fallita.');
      }
      setRadioSearchResults(payload.stations as RadioSearchResult[]);
      appendLog(makeLog('online', `Radio Browser: ${(payload.stations as RadioSearchResult[]).length} risultati.`));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ricerca Radio Browser fallita.';
      setRadioSearchError(message);
      appendLog(makeLog('offline', message));
    } finally {
      setRadioSearchLoading(false);
    }
  }

  async function testArbitraryStream(streamUrl: string, key: number) {
    if (!streamUrl.trim()) {
      setReplacementStreamChecks((prev) => ({ ...prev, [key]: { ok: false, potentiallyPlayable: false, error: 'streamUrl mancante.' } }));
      return;
    }

    setReplacementStreamChecks((prev) => ({ ...prev, [key]: { ok: false, potentiallyPlayable: false, error: 'verifica in corso…' } }));
    try {
      const response = await fetch(`${API_BASE}/stream-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamUrl })
      });
      const result = (await response.json()) as StreamCheckResult;
      setReplacementStreamChecks((prev) => ({ ...prev, [key]: result }));
      appendLog(makeLog(result.ok ? 'online' : 'offline', `Test stream: ${result.ok ? 'raggiungibile' : result.error ?? `HTTP ${result.status ?? 'n/d'}`}`));
    } catch (error) {
      const result = { ok: false, potentiallyPlayable: false, error: error instanceof Error ? error.message : 'Verifica stream fallita.' };
      setReplacementStreamChecks((prev) => ({ ...prev, [key]: result }));
      appendLog(makeLog('offline', result.error));
    }
  }

  async function checkPresetStreamById(id: number) {
    setReplacementStreamChecks((prev) => ({ ...prev, [id]: { ok: false, potentiallyPlayable: false, error: 'verifica in corso…' } }));
    try {
      const response = await fetch(`${API_BASE}/replacement-presets/${id}/test-stream`, { method: 'POST' });
      const result = (await response.json()) as StreamCheckResult;
      setReplacementStreamChecks((prev) => ({ ...prev, [id]: result }));
      appendLog(makeLog(result.ok ? 'online' : 'offline', `Preset ${id} stream: ${result.ok ? 'raggiungibile' : result.error ?? `HTTP ${result.status ?? 'n/d'}`}`));
    } catch (error) {
      const result = { ok: false, potentiallyPlayable: false, error: error instanceof Error ? error.message : 'Verifica stream fallita.' };
      setReplacementStreamChecks((prev) => ({ ...prev, [id]: result }));
      appendLog(makeLog('offline', result.error));
    }
  }

  async function checkReplacementStream(preset: ReplacementPreset) {
    if (!preset.streamUrl.trim()) {
      setReplacementStreamChecks((prev) => ({ ...prev, [preset.id]: { ok: false, potentiallyPlayable: false, error: 'streamUrl mancante.' } }));
      return;
    }

    await checkPresetStreamById(preset.id);
  }


  function testReplacementStreamInBrowser(preset: ReplacementPreset) {
    void checkReplacementStream(preset);
  }

  function getSelectedUpnpPreset() {
    return replacementPresets.find((preset) => preset.id === selectedUpnpPresetId) ?? replacementPresets[1] ?? replacementPresets[0] ?? null;
  }

  function selectUpnpPreset(id: number) {
    setSelectedUpnpPresetId(id);
    const preset = replacementPresets.find((item) => item.id === id);
    if (preset?.streamUrl) {
      setUpnpStreamUrl(preset.streamUrl);
    }
  }

  async function pollUpnpNowPlayingAfterPlay(delays = PRESET_LAB_POLL_DELAYS): Promise<PresetLabPoll[]> {
    const polls: PresetLabPoll[] = [];
    let elapsedMs = 0;
    for (const delayMs of delays) {
      await waitFor(delayMs - elapsedMs);
      elapsedMs = delayMs;
      polls.push(await fetchPresetLabNowPlaying(delayMs));
    }

    return polls;
  }

  async function fetchUpnpRootDesc() {
    if (!canSend) {
      appendLog(makeLog('offline', 'UPnP rootDesc annullato: IP Bose mancante.'));
      return;
    }

    setUpnpLoading(true);
    const startedAt = new Date().toISOString();
    try {
      const response = await fetch(`${API_BASE}/upnp/${encodedIp}/root-desc`);
      const rootDescResult = (await response.json()) as UpnpRootDescResult;
      const log: UpnpPlaybackLog = {
        timestamp: startedAt,
        command: 'root-desc',
        presetId: selectedUpnpPresetId,
        streamUrl: upnpStreamUrl,
        rootDescResult,
        nowPlayingAfter: [],
        outcome: rootDescResult.ok ? `UPnP description OK (${rootDescResult.selectedEndpoint})` : 'UPnP description non disponibile'
      };
      setUpnpLastResult(log);
      setUpnpHistory((prev) => [log, ...prev].slice(0, 50));
      appendLog(makeLog(rootDescResult.ok ? 'online' : 'offline', `UPnP rootDesc: ${log.outcome}`, boseIp));
    } catch (error) {
      appendLog(makeLog('offline', error instanceof Error ? error.message : 'UPnP rootDesc fallito.', boseIp));
    } finally {
      setUpnpLoading(false);
    }
  }

  async function postUpnpActionFor(
    endpoint: 'stop' | 'set-uri' | 'get-media-info' | 'get-transport-info' | 'get-position-info' | 'play',
    options: { streamUrl?: string; mode?: UpnpSetUriMode; title?: string } = {}
  ) {
    const response = await fetch(`${API_BASE}/upnp/${encodedIp}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: endpoint === 'set-uri'
        ? JSON.stringify({ streamUrl: options.streamUrl?.trim() ?? upnpStreamUrl.trim(), mode: options.mode ?? upnpSetUriMode, title: options.title ?? getSelectedUpnpPreset()?.name ?? 'Groove Salad' })
        : '{}'
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? `UPnP ${endpoint} fallito.`);
    }

    return payload as UpnpSoapResult;
  }

  async function postUpnpAction(endpoint: 'stop' | 'set-uri' | 'get-media-info' | 'get-transport-info' | 'get-position-info' | 'play') {
    return postUpnpActionFor(endpoint);
  }

  async function playRadioPreset(preset: ReplacementPreset) {
    if (!canSend) {
      appendLog(makeLog('offline', 'Play preset annullato: IP Bose mancante.'));
      return;
    }

    if (!preset.streamUrl.trim()) {
      const message = `Preset ${preset.id}: streamUrl mancante.`;
      setRadioPresetLastResult({ timestamp: new Date().toISOString(), preset, nowPlayingAfter: [], outcome: message });
      appendLog(makeLog('offline', message, boseIp));
      return;
    }

    setRadioPresetPlayingId(preset.id);
    lastRealtimeErrorRawRef.current = null;

    try {
      const response = await fetch(`${API_BASE}/replacement-presets/${preset.id}/play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boseIp })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? `Play preset ${preset.id} fallito.`);
      }

      const result = payload as RadioPresetPlayResult;
      setRadioPresetLastResult(result);
      setRadioPresetNowPlaying(result.preset);
      updateReplacementPreset(result.preset.id, result.preset);
      appendLog(makeLog(result.playResult?.ok ? 'online' : 'offline', `Radio preset ${preset.id}: ${result.outcome}`, boseIp));
    } catch (error) {
      const log: RadioPresetPlayResult = {
        timestamp: new Date().toISOString(),
        preset,
        nowPlayingAfter: [],
        errorUpdateRaw: lastRealtimeErrorRawRef.current,
        outcome: error instanceof Error ? error.message : 'Play preset fallito.'
      };
      setRadioPresetLastResult(log);
      appendLog(makeLog('offline', log.outcome, boseIp));
    } finally {
      setRadioPresetPlayingId(null);
    }
  }


  async function stopRadioPresetPlayback() {
    if (!canSend) {
      appendLog(makeLog('offline', 'Stop globale annullato: IP Bose mancante.'));
      return;
    }

    setRadioPresetPlayingId(-1);
    try {
      const stopResult = await postUpnpActionFor('stop');
      const getTransportInfoResult = await postUpnpActionFor('get-transport-info');
      setRadioPresetLastResult({
        timestamp: new Date().toISOString(),
        preset: radioPresetNowPlaying ?? { id: 0, name: 'Stop globale', streamUrl: '', notes: '', enabled: false },
        stopResult,
        getTransportInfoResult,
        nowPlayingAfter: [],
        outcome: 'Stop globale inviato via UPnP'
      });
      setRadioPresetNowPlaying(null);
      appendLog(makeLog(stopResult.ok ? 'online' : 'offline', 'Stop globale UPnP inviato.', boseIp));
    } catch (error) {
      appendLog(makeLog('offline', error instanceof Error ? error.message : 'Stop globale fallito.', boseIp));
    } finally {
      setRadioPresetPlayingId(null);
    }
  }

  async function runUpnpVerifyFlow() {
    if (!canSend) {
      appendLog(makeLog('offline', 'UPnP Verify annullato: IP Bose mancante.'));
      return;
    }

    if (!upnpStreamUrl.trim()) {
      appendLog(makeLog('offline', 'UPnP Verify annullato: stream URL mancante.'));
      return;
    }

    setUpnpLoading(true);
    lastRealtimeErrorRawRef.current = null;
    const startedAt = new Date().toISOString();
    const selectedPreset = getSelectedUpnpPreset();

    try {
      const stopResult = await postUpnpAction('stop');
      const setUriResult = await postUpnpAction('set-uri');
      await waitFor(500);
      const getMediaInfoResult = await postUpnpAction('get-media-info');
      const getTransportInfoResult = await postUpnpAction('get-transport-info');
      const getPositionInfoResult = await postUpnpAction('get-position-info');
      const playResult = await postUpnpAction('play');
      const nowPlayingAfter = await pollUpnpNowPlayingAfterPlay(UPNP_VERIFY_POLL_DELAYS);
      const ok = [stopResult, setUriResult, getMediaInfoResult, getTransportInfoResult, getPositionInfoResult, playResult].every((result) => result.ok);
      const latestPoll = nowPlayingAfter[nowPlayingAfter.length - 1];
      const log: UpnpPlaybackLog = {
        timestamp: startedAt,
        command: 'verify-flow',
        presetId: selectedPreset?.id,
        streamUrl: upnpStreamUrl,
        setUriMode: upnpSetUriMode,
        stopResult,
        setUriResult,
        getMediaInfoResult,
        getTransportInfoResult,
        getPositionInfoResult,
        playResult,
        nowPlayingAfter,
        errorUpdateRaw: lastRealtimeErrorRawRef.current,
        outcome: ok ? `Verify completato · source ${latestPoll?.parsed.source ?? 'n/d'} · play ${latestPoll?.parsed.playStatus ?? 'n/d'}` : 'Verify completato con errori SOAP/HTTP'
      };
      setUpnpLastResult(log);
      setUpnpHistory((prev) => [log, ...prev].slice(0, 50));
      appendLog(makeLog(ok ? 'online' : 'offline', `UPnP Set URI + Play + Verify: ${log.outcome}`, boseIp));
    } catch (error) {
      const log: UpnpPlaybackLog = {
        timestamp: startedAt,
        command: 'verify-flow',
        presetId: selectedPreset?.id,
        streamUrl: upnpStreamUrl,
        setUriMode: upnpSetUriMode,
        nowPlayingAfter: [],
        errorUpdateRaw: lastRealtimeErrorRawRef.current,
        outcome: error instanceof Error ? error.message : 'UPnP Verify fallito.'
      };
      setUpnpLastResult(log);
      setUpnpHistory((prev) => [log, ...prev].slice(0, 50));
      appendLog(makeLog('offline', log.outcome, boseIp));
    } finally {
      setUpnpLoading(false);
    }
  }

  async function runUpnpPlaybackTest(command: 'set-uri' | 'play' | 'set-uri-play') {
    if (!canSend) {
      appendLog(makeLog('offline', 'UPnP Playback Test annullato: IP Bose mancante.'));
      return;
    }

    if (!upnpStreamUrl.trim() && command !== 'play') {
      appendLog(makeLog('offline', 'UPnP Set URI annullato: stream URL mancante.'));
      return;
    }

    setUpnpLoading(true);
    const startedAt = new Date().toISOString();
    const selectedPreset = getSelectedUpnpPreset();

    try {
      let setUriResult: UpnpSoapResult | undefined;
      let playResult: UpnpSoapResult | undefined;
      let nowPlayingAfter: PresetLabPoll[] = [];

      if (command === 'set-uri' || command === 'set-uri-play') {
        setUriResult = await postUpnpAction('set-uri');
      }

      if (command === 'play' || command === 'set-uri-play') {
        playResult = await postUpnpAction('play');
        nowPlayingAfter = await pollUpnpNowPlayingAfterPlay();
      }

      const ok = (setUriResult?.ok ?? true) && (playResult?.ok ?? true);
      const log: UpnpPlaybackLog = {
        timestamp: startedAt,
        command,
        presetId: selectedPreset?.id,
        streamUrl: upnpStreamUrl,
        setUriMode: upnpSetUriMode,
        setUriResult,
        playResult,
        nowPlayingAfter,
        errorUpdateRaw: lastRealtimeErrorRawRef.current,
        outcome: ok ? 'SOAP inviato: verificare now_playing/audio' : 'SOAP HTTP error o fault: vedi response body'
      };
      setUpnpLastResult(log);
      setUpnpHistory((prev) => [log, ...prev].slice(0, 50));
      appendLog(makeLog(ok ? 'online' : 'offline', `UPnP ${command}: ${log.outcome}`, boseIp));
    } catch (error) {
      const log: UpnpPlaybackLog = {
        timestamp: startedAt,
        command,
        presetId: selectedPreset?.id,
        streamUrl: upnpStreamUrl,
        setUriMode: upnpSetUriMode,
        nowPlayingAfter: [],
        errorUpdateRaw: lastRealtimeErrorRawRef.current,
        outcome: error instanceof Error ? error.message : 'UPnP Playback Test fallito.'
      };
      setUpnpLastResult(log);
      setUpnpHistory((prev) => [log, ...prev].slice(0, 50));
      appendLog(makeLog('offline', log.outcome, boseIp));
    } finally {
      setUpnpLoading(false);
    }
  }

  function getPresetDiagnosis() {
    const presetKeyExperiments = presetLabHistory.filter((item) => /^PRESET_[1-6]$/.test(item.command));
    const latestPresetExperiment = presetKeyExperiments[0];
    const presetExists = getParsedPresets().length > 0 || presetLabHistory.some((item) => (item.presetsBefore?.parsed.presetCount ?? item.presetsAfter?.parsed.presetCount ?? 0) > 0);
    const keyAccepted = Boolean(latestPresetExperiment && /"status":\s*200|HTTP 200/i.test(latestPresetExperiment.responseBose));
    const invalidSourceExperiment = presetKeyExperiments.find((item) => item.nowPlayingAfter.some((poll) => poll.parsed.source === 'INVALID_SOURCE' || /INVALID_SOURCE/i.test(poll.nowPlayingXml)));
    const nowPlayingBecomesInvalidSource = Boolean(invalidSourceExperiment);

    return {
      presetExists,
      keyAccepted,
      nowPlayingBecomesInvalidSource,
      likelyCloudResolutionMissing: presetExists && keyAccepted && nowPlayingBecomesInvalidSource,
      latestPresetCommand: latestPresetExperiment?.command ?? null,
      invalidSourceCommand: invalidSourceExperiment?.command ?? null
    };
  }


  const presetDiagnosis = getPresetDiagnosis();
  const isDiagnosticsRoute = window.location.pathname.includes('/dashboard/diagnostics');

  return (
    <div className={`app-shell ${isDiagnosticsRoute ? 'diagnostics-route' : 'remote-route'}`}>
      <header className="hero">
        <div>
          <p className="eyebrow">LAN testing dashboard · V5 select tester</p>
          <h1>SoundTouch Radio Bridge</h1>
          <p className="subtitle">
            App locale Node.js + Express + React/Vite per trovare Bose SoundTouch 30 in LAN, provare le API SoundTouch e ricevere eventi realtime, ispezionare preset e testare POST /select.
          </p>
        </div>
        <div className={`status-card connection-${connectionStatus.replace(' ', '-')}`}>
          <span>Connessione</span>
          <strong>{connectionStatus}</strong>
          <small>IP attivo: {boseIp || 'n/d'}</small>
        </div>
      </header>

      <main className="dashboard-grid">
        <section className="panel remote-control-panel">
          <div className="remote-header-card">
            <div>
              <p className="eyebrow">Bose SoundTouch 30</p>
              <h1>SoundTouch Radio Remote</h1>
              <p>{deviceName} · {boseIp || 'IP non impostato'}</p>
            </div>
            <div className={`remote-status ${connectionStatus === 'online' || realtimeConnected ? 'online' : 'offline'}`}>
              <span />
              <strong>{connectionStatus === 'online' || realtimeConnected ? 'Online' : 'Offline'}</strong>
            </div>
          </div>

          <div className="remote-layout">
            <section className="remote-main-column">
              <div className="remote-card now-playing-card">
                <p className="eyebrow">Now Playing</p>
                <h2>{radioPresetNowPlaying?.name ?? realtimeSnapshot.title ?? realtimeSnapshot.itemName ?? 'Nessuna riproduzione'}</h2>
                <p>{realtimeSnapshot.artist && realtimeSnapshot.artist !== 'n/d' ? realtimeSnapshot.artist : realtimeSnapshot.stationName ?? deviceName}</p>
                <div className="now-playing-meta">
                  <span>{realtimeSnapshot.source || 'UPNP / Radio'}</span>
                  <span>{realtimeSnapshot.playStatus || 'STOPPED'}</span>
                  <span>Vol {realtimeSnapshot.volume !== 'n/d' ? realtimeSnapshot.volume : volume}</span>
                </div>
                {radioPresetLastResult ? <small className="remote-last-command">{radioPresetLastResult.outcome}</small> : null}
              </div>

              <div className="remote-card transport-card">
                <h2>Controlli</h2>
                <div className="transport-grid">
                  <button type="button" onClick={() => postKey('PLAY_PAUSE')} disabled={!canSend}>▶︎/Ⅱ</button>
                  <button type="button" onClick={() => void stopRadioPresetPlayback()} disabled={!canSend || radioPresetPlayingId !== null}>■</button>
                  <button type="button" onClick={() => changeVolume(-5)} disabled={!canSend}>−</button>
                  <button type="button" onClick={() => changeVolume(5)} disabled={!canSend}>＋</button>
                  <button type="button" onClick={() => changeVolume(-volume)} disabled={!canSend} title="Mute via volume 0">Mute</button>
                </div>
                <label className="remote-volume-slider" htmlFor="remote-volume">
                  <span>Volume {volume}</span>
                  <input id="remote-volume" type="range" min="0" max="100" value={volume} onChange={(event) => setVolume(Number(event.target.value))} onMouseUp={postVolume} onTouchEnd={postVolume} />
                </label>
              </div>

              <div className="remote-card presets-remote-card">
                <div className="remote-section-heading">
                  <h2>Preset Radio</h2>
                  <span>{replacementPresets.length}/6</span>
                </div>
                <div className="remote-preset-grid">
                  {replacementPresets.map((preset) => {
                    const isPlaying = radioPresetPlayingId === preset.id;
                    const isCurrent = radioPresetNowPlaying?.id === preset.id;
                    return (
                      <article key={`remote-preset-${preset.id}`} className={isCurrent ? 'active' : ''}>
                        <div className="remote-preset-topline">
                          <span>{preset.id}</span>
                          <button type="button" onClick={() => openPresetEditor(preset)} aria-label={`Modifica preset ${preset.id}`}>✎</button>
                        </div>
                        {preset.logoUrl ? <img src={preset.logoUrl} alt="" /> : <div className="remote-logo-placeholder">♪</div>}
                        <h3>{preset.name}</h3>
                        <p>{preset.category || 'Radio'}</p>
                        <button type="button" className="remote-play-button" onClick={() => void playRadioPreset(preset)} disabled={!canSend || !preset.enabled || isPlaying || !preset.streamUrl.trim()}>
                          {isPlaying ? 'Avvio…' : isCurrent ? 'In onda' : 'Play'}
                        </button>
                      </article>
                    );
                  })}
                </div>
              </div>
            </section>

            <aside className="remote-side-column">
              <div className="remote-card sources-card">
                <h2>Sorgenti</h2>
                <div className="source-button-list">
                  {availableSources.length === 0 ? <p className="hint">Aggiorna le sorgenti dalle impostazioni.</p> : availableSources.map((source, index) => {
                    const selectable = isSelectableSource(source);
                    return (
                      <button key={`${source.source}-${source.sourceAccount}-${index}`} type="button" onClick={() => void selectRemoteSource(source)} disabled={!selectable || !canSend} title={selectable ? `Seleziona ${getSourceLabel(source)}` : 'Non selezionabile via API locale'}>
                        <span>{getSourceLabel(source)}</span>
                        <small>{selectable ? 'Seleziona' : 'Non selezionabile'}</small>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="remote-card settings-card">
                <h2>Impostazioni</h2>
                <label htmlFor="remote-ip">IP Bose</label>
                <input id="remote-ip" value={boseIp} onChange={(event) => setBoseIp(event.target.value)} onBlur={() => window.localStorage.setItem(LAST_IP_STORAGE_KEY, boseIp)} placeholder="192.168.1.50" inputMode="decimal" />
                <button type="button" onClick={discoverDevices} disabled={discovering}>{discovering ? 'Ricerca…' : 'Cerca dispositivo'}</button>
                <button type="button" onClick={realtimeConnected ? disconnectRealtime : connectRealtime} disabled={!canSend}>{realtimeConnected ? 'Realtime off' : 'Realtime on'}</button>
                <button type="button" onClick={() => void forceRefreshRest('telecomando', true)} disabled={!canSend}>Aggiorna stato</button>
                <a href="/dashboard/diagnostics">Diagnostica avanzata</a>
              </div>
            </aside>
          </div>

          {editingPresetId ? (
            <div className="modal-backdrop" role="presentation" onClick={() => setEditingPresetId(null)}>
              <section className="preset-modal remote-edit-modal" role="dialog" aria-modal="true" aria-label="Modifica preset" onClick={(event) => event.stopPropagation()}>
                <div className="section-title-row">
                  <div>
                    <p className="eyebrow">Preset {editingPresetId}</p>
                    <h2>Modifica preset</h2>
                  </div>
                  <button type="button" onClick={() => setEditingPresetId(null)}>Chiudi</button>
                </div>
                <label>Nome preset<input value={manualPresetDraft.name} onChange={(event) => setManualPresetDraft((prev) => ({ ...prev, name: event.target.value }))} placeholder="Nome radio" /></label>
                <label>Stream URL<input value={manualPresetDraft.streamUrl} onChange={(event) => setManualPresetDraft((prev) => ({ ...prev, streamUrl: event.target.value }))} placeholder="http:// o https://" /></label>
                <label>Logo URL opzionale<input value={manualPresetDraft.logoUrl} onChange={(event) => setManualPresetDraft((prev) => ({ ...prev, logoUrl: event.target.value }))} placeholder="https://…" /></label>

                <div className="modal-search-box">
                  <h3>Ricerca radio web</h3>
                  <form className="radio-search-form" onSubmit={(event) => { event.preventDefault(); void searchRadios(); }}>
                    <input className="big-search-input" value={radioSearchQuery} onChange={(event) => setRadioSearchQuery(event.target.value)} placeholder="Cerca una radio…" />
                    <div className="search-filter-row">
                      <input value={radioSearchCountry} onChange={(event) => setRadioSearchCountry(event.target.value)} placeholder="Paese" />
                      <input value={radioSearchTag} onChange={(event) => setRadioSearchTag(event.target.value)} placeholder="Tag" />
                    </div>
                    <button type="submit" disabled={radioSearchLoading}>{radioSearchLoading ? 'Cerco…' : 'Cerca'}</button>
                    {radioSearchError ? <p className="error-text">{radioSearchError}</p> : null}
                  </form>
                  <div className="modal-radio-results">
                    {radioSearchResults.slice(0, 8).map((station, index) => (
                      <button key={`${station.streamUrl}-${index}`} type="button" onClick={() => useStationInPresetEditor(station)}>
                        <strong>{station.name}</strong>
                        <small>{[station.country, station.codec, station.bitrate ? `${station.bitrate} kbps` : ''].filter(Boolean).join(' · ')}</small>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="modal-action-row">
                  <button type="button" onClick={() => void testArbitraryStream(manualPresetDraft.streamUrl, 1000)} disabled={!manualPresetDraft.streamUrl.trim()}>Test stream</button>
                  <button type="button" className="primary-action" onClick={() => void saveEditingPreset()} disabled={replacementSavingId === editingPresetId || !manualPresetDraft.streamUrl.trim()}>{replacementSavingId === editingPresetId ? 'Salvo…' : 'Salva'}</button>
                </div>
                {replacementStreamChecks[1000] ? (
                  <div className={`stream-status ${replacementStreamChecks[1000].potentiallyPlayable ? 'ok' : 'error'}`}>
                    <span>{replacementStreamChecks[1000].potentiallyPlayable ? 'Stream valido' : 'Verifica non conclusiva'}</span>
                    <small>{replacementStreamChecks[1000].mimeType ?? replacementStreamChecks[1000].error ?? `HTTP ${replacementStreamChecks[1000].status ?? 'n/d'}`}</small>
                  </div>
                ) : null}
              </section>
            </div>
          ) : null}
        </section>

        <section className="panel advanced-diagnostics-heading">
          <details>
            <summary>Advanced / Diagnostics</summary>
            <p className="hint">Le sezioni sotto mantengono inspector, replacement preset editor, test UPnP avanzato e laboratori diagnostici.</p>
          </details>
        </section>
        <section className="panel controls-panel">
          <h2>Connessione Bose</h2>
          <label className="field-label" htmlFor="bose-ip">
            IP Bose SoundTouch
          </label>
          <div className="ip-row">
            <input
              id="bose-ip"
              value={boseIp}
              onChange={(event) => setBoseIp(event.target.value)}
              onBlur={() => window.localStorage.setItem(LAST_IP_STORAGE_KEY, boseIp)}
              placeholder="es. 192.168.1.50"
              inputMode="decimal"
            />
            <button type="button" onClick={() => getEndpoint('info')} disabled={!canSend}>
              Test GET /info
            </button>
            <button type="button" onClick={discoverDevices} disabled={discovering}>
              {discovering ? 'Scansione…' : 'Cerca dispositivi Bose'}
            </button>
            <button type="button" onClick={realtimeConnected ? disconnectRealtime : connectRealtime} disabled={!canSend}>
              {realtimeConnected ? 'Disconnetti realtime' : 'Connetti realtime'}
            </button>
            <button type="button" onClick={() => void forceRefreshRest()} disabled={!canSend}>
              Forza refresh REST
            </button>
          </div>
          <p className="hint">Il backend rileva la subnet locale del server Node e scansiona gli IP .1-.254 su http://IP:8090/info.</p>

          <div className="discovery-box">
            <div className="discovery-heading">
              <h3>Dispositivi trovati</h3>
              <span>{lastScanSummary}</span>
            </div>
            {devices.length === 0 ? (
              <p className="hint">Nessun device Bose rilevato nella scansione corrente.</p>
            ) : (
              <div className="device-list">
                {devices.map((device) => (
                  <button
                    className="device-card"
                    key={`${device.ip}-${device.deviceID}`}
                    type="button"
                    onClick={() => setActiveIp(device.ip, `click su ${device.name}`)}
                  >
                    <strong>{device.name}</strong>
                    <span>{device.ip}</span>
                    <small>deviceID: {device.deviceID}</small>
                    <small>tipo: {device.productType ?? 'n/d'}</small>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="command-group">
            <h3>Endpoint GET</h3>
            <div className="button-grid">
              {ENDPOINTS.map((endpoint) => (
                <button key={endpoint.id} type="button" onClick={() => getEndpoint(endpoint.id)} disabled={!canSend}>
                  <span>{endpoint.label}</span>
                  <small>{endpoint.method}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="command-group split">
            <div>
              <h3>Volume XML</h3>
              <label className="field-label" htmlFor="volume">
                Volume: {volume}
              </label>
              <input
                id="volume"
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(event) => setVolume(Number(event.target.value))}
              />
              <button type="button" onClick={postVolume} disabled={!canSend}>
                POST /volume XML
              </button>
            </div>
            <div>
              <h3>Tasti</h3>
              <div className="key-grid">
                {KEYS.map((key) => (
                  <button key={key} type="button" onClick={() => postKey(key)} disabled={!canSend}>
                    {key.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className={`panel response-panel ${response.status}`}>
          <div className="response-heading">
            <div>
              <p className="eyebrow">Risposta API</p>
              <h2>{response.title}</h2>
            </div>
            {response.timestamp ? <span>{response.timestamp}</span> : null}
          </div>
          <pre>{response.body}</pre>
        </section>
      </main>

      <section className="panel realtime-panel">
        <div className="response-heading">
          <div>
            <p className="eyebrow">Realtime V3</p>
            <h2>Stato live SoundTouch</h2>
          </div>
          <span>{realtimeState}</span>
        </div>
        <div className="realtime-grid">
          <article><span>Source attiva</span><strong>{realtimeSnapshot.source}</strong></article>
          <article><span>Titolo</span><strong>{realtimeSnapshot.title}</strong></article>
          <article><span>Artista</span><strong>{realtimeSnapshot.artist}</strong></article>
          <article><span>Play/Pause</span><strong>{realtimeSnapshot.playStatus}</strong></article>
          <article><span>Volume</span><strong>{realtimeSnapshot.volume}</strong></article>
        </div>
        <h3>Debug eventi raw</h3>
        <div className="raw-events">
          {realtimeEvents.length === 0 ? (
            <p className="hint">Nessun evento realtime ricevuto. Premi “Connetti realtime”.</p>
          ) : realtimeEvents.map((event, index) => (
            <details key={`${event.timestamp}-${index}`} open={index === 0}>
              <summary>{new Date(event.timestamp).toLocaleTimeString('it-IT')} · {event.eventName}</summary>
              <pre>{event.raw ?? JSON.stringify(event, null, 2)}</pre>
            </details>
          ))}
        </div>
      </section>

      <section className="panel inspector-panel">
        <div className="response-heading">
          <div>
            <p className="eyebrow">V4 Diagnostic Inspector</p>
            <h2>Inspector</h2>
          </div>
          <span>{inspectorLoading ? 'caricamento…' : 'raw XML + parsed JSON'}</span>
        </div>
        <div className="inspector-actions">
          <div className="tab-row">
            {INSPECTOR_TABS.map((tab) => (
              <button
                className={inspectorTab === tab ? 'active' : ''}
                key={tab}
                type="button"
                onClick={() => {
                  setInspectorTab(tab);
                  if (!['Raw XML', 'WebSocket Events'].includes(tab)) {
                    void loadInspectorTab(tab);
                  }
                }}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="export-row">
            <button type="button" onClick={() => void loadAllInspectorTabs()} disabled={!canSend || inspectorLoading}>
              Aggiorna inspector
            </button>
            <button type="button" onClick={exportDiagnosticsJson}>Export JSON diagnostics</button>
            <button type="button" onClick={exportRawXml}>Export raw XML</button>
          </div>
        </div>

        {inspectorTab === 'WebSocket Events' ? (
          <div className="inspector-content">
            <h3>Ultimi 50 eventi WebSocket</h3>
            <pre>{JSON.stringify(realtimeEvents, null, 2)}</pre>
          </div>
        ) : inspectorTab === 'Raw XML' ? (
          <div className="inspector-content">
            <h3>Raw XML raccolto</h3>
            <pre>{Object.values(inspectorRecords).filter(Boolean).map((record) => `<!-- ${record.label} · ${record.timestamp} -->\n${formatXml(record.rawXml)}`).join('\n\n') || 'Carica una tab inspector per vedere XML raw.'}</pre>
          </div>
        ) : (
          <div className="inspector-content">
            <div className="inspector-meta">
              <span>Endpoint: {inspectorRecords[inspectorTab]?.endpoint ?? getInspectorEndpoint(inspectorTab)}</span>
              <span>Timestamp: {inspectorRecords[inspectorTab]?.timestamp ?? 'n/d'}</span>
            </div>
            {inspectorTab === 'Presets' && inspectorRecords.Presets ? (
              <div className="preset-table">
                {(inspectorRecords.Presets.parsedJson as { presets?: ParsedPreset[] }).presets?.map((preset, index) => (
                  <article key={`${preset.id ?? index}-${preset.location ?? 'preset'}`}>
                    <strong>Preset {preset.id ?? index + 1}</strong>
                    <span>source: {preset.source ?? 'n/d'}</span>
                    <span>sourceAccount: {preset.sourceAccount ?? 'n/d'}</span>
                    <span>location: {preset.location ?? 'n/d'}</span>
                    <span>container: {preset.container ?? 'n/d'}</span>
                    <span>itemName: {preset.itemName ?? 'n/d'}</span>
                    <span>art: {preset.art ?? 'n/d'}</span>
                    <span>stationName: {preset.stationName ?? 'n/d'}</span>
                  </article>
                )) ?? <p className="hint">Nessun preset parsato.</p>}
              </div>
            ) : null}
            <h3>Parsed JSON</h3>
            <pre>{JSON.stringify(inspectorRecords[inspectorTab]?.parsedJson ?? {}, null, 2)}</pre>
            <h3>Raw XML leggibile</h3>
            <pre>{inspectorRecords[inspectorTab]?.rawXml ? formatXml(inspectorRecords[inspectorTab].rawXml) : 'Premi la tab o “Aggiorna inspector” per caricare XML.'}</pre>
          </div>
        )}
      </section>

      <section className="panel experimental-panel">
        <div className="response-heading">
          <div>
            <p className="eyebrow">V5 Experimental Select Tester</p>
            <h2>Experimental Select</h2>
          </div>
          <span>POST /select ContentItem XML</span>
        </div>
        <p className="hint">
          Usa i preset letti da /presets o modifica manualmente un ContentItem per verificare TuneIn legacy, LOCAL_INTERNET_RADIO e UPNP.
        </p>
        <div className="experimental-grid">
          <section>
            <div className="response-heading compact-heading">
              <h3>Preset da /presets</h3>
              <div className="template-row">
                <button type="button" onClick={() => void loadInspectorTab('Presets')} disabled={!canSend || inspectorLoading}>
                  Ricarica presets
                </button>
                <button type="button" onClick={() => void tryAllPresets()} disabled={!canSend || selectLoading}>
                  Try all presets
                </button>
                <button type="button" onClick={exportSelectHistoryJson} disabled={selectHistory.length === 0}>
                  Export storico test JSON
                </button>
              </div>
            </div>
            <div className="select-preset-list">
              {getParsedPresets().length === 0 ? (
                <p className="hint">Carica la tab Presets nell’Inspector o premi “Ricarica presets”.</p>
              ) : getParsedPresets().map((preset, index) => (
                <article key={`select-${preset.id ?? index}-${preset.location ?? 'preset'}`}>
                  <strong>{preset.itemName ?? preset.stationName ?? `Preset ${preset.id ?? index + 1}`}</strong>
                  <small>source: {preset.source ?? 'n/d'} · location: {preset.location ?? 'n/d'}</small>
                  <button
                    type="button"
                    onClick={() => {
                      const xml = preset.contentItemXml ?? '';
                      setSelectXml(xml);
                      void trySelectXml(xml, preset.itemName ?? preset.stationName ?? `Preset ${preset.id ?? index + 1}`);
                    }}
                    disabled={!preset.contentItemXml || selectLoading}
                  >
                    Try Select
                  </button>
                </article>
              ))}
            </div>
          </section>
          <section>
            <h3>Editor XML manuale</h3>
            <div className="template-row">
              <button type="button" onClick={() => setSelectXml(SELECT_TEMPLATES.tuneIn)}>A) TUNEIN stationurl legacy</button>
              <button type="button" onClick={() => setSelectXml(SELECT_TEMPLATES.localInternetRadio)}>B) LOCAL_INTERNET_RADIO stationurl</button>
              <button type="button" onClick={() => setSelectXml(SELECT_TEMPLATES.upnp)}>C) UPNP item manuale</button>
            </div>
            <textarea value={selectXml} onChange={(event) => setSelectXml(event.target.value)} rows={8} />
            <button type="button" onClick={() => void trySelectXml(selectXml, 'XML manuale')} disabled={!canSend || selectLoading}>
              {selectLoading ? 'Select in corso…' : 'Try Select XML manuale'}
            </button>
          </section>
        </div>
        <div className="select-result">
          <h3>Risultato POST /select</h3>
          {selectResult ? (
            <>
              <div className="select-verification">
                <h4>Select verification</h4>
                <div className={`verification-badge ${selectResult.outcome}`}>
                  {selectResult.outcome === 'success' ? 'Select riuscito' : `Esito: ${selectResult.outcome}`}
                </div>
                <div className="realtime-grid">
                  <article><span>Source attiva</span><strong>{getLastSelectPoll(selectResult.polls)?.parsed.source ?? 'n/d'}</strong></article>
                  <article><span>itemName</span><strong>{getLastSelectPoll(selectResult.polls)?.parsed.itemName ?? 'n/d'}</strong></article>
                  <article><span>stationName</span><strong>{getLastSelectPoll(selectResult.polls)?.parsed.stationName ?? 'n/d'}</strong></article>
                  <article><span>playStatus</span><strong>{getLastSelectPoll(selectResult.polls)?.parsed.playStatus ?? 'n/d'}</strong></article>
                </div>
                {selectResult.errorUpdateRaw ? (
                  <details open>
                    <summary>errorUpdate realtime</summary>
                    <pre>{selectResult.errorUpdateRaw}</pre>
                  </details>
                ) : null}
                <div className="poll-grid">
                  {selectResult.polls.map((poll) => (
                    <details key={`${selectResult.timestamp}-${poll.delayMs}`}>
                      <summary>{poll.delayMs}ms · source {poll.parsed.source ?? 'n/d'} · play {poll.parsed.playStatus ?? 'n/d'}</summary>
                      <pre>{JSON.stringify(poll, null, 2)}</pre>
                    </details>
                  ))}
                </div>
              </div>
              <div className="experimental-grid">
                <section>
                  <p>Preset: <strong>{selectResult.presetLabel ?? 'n/d'}</strong></p>
                  <p>HTTP status: <strong>{selectResult.httpStatus ?? 'errore rete'}</strong></p>
                  <p>Timestamp: {new Date(selectResult.timestamp).toLocaleTimeString('it-IT')}</p>
                  <h4>XML inviato</h4>
                  <pre>{formatXml(selectResult.requestXml)}</pre>
                </section>
                <section>
                  <h4>Risposta Bose</h4>
                  <pre>{selectResult.responseBody}</pre>
                </section>
              </div>
            </>
          ) : (
            <p className="hint">Nessun test /select eseguito.</p>
          )}
          <h3>Storico test select</h3>
          <div className="select-history-list">
            {selectHistory.length === 0 ? <p className="hint">Nessuno storico disponibile.</p> : selectHistory.map((item, index) => (
              <details key={`${item.timestamp}-${index}`}>
                <summary>{new Date(item.timestamp).toLocaleTimeString('it-IT')} · {item.presetLabel ?? 'XML manuale'} · {item.outcome}</summary>
                <pre>{JSON.stringify(item, null, 2)}</pre>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="panel local-radio-panel">
        <div className="response-heading">
          <div>
            <p className="eyebrow">V6 Local Internet Radio Tester</p>
            <h2>Local Internet Radio Test</h2>
          </div>
          <span>URL stream diretti + POST /select</span>
        </div>
        <p className="hint">
          Testa stream URL diretti senza risoluzione cloud TuneIn. Ogni template invia un ContentItem diverso e poi interroga /now_playing a 500ms, 1500ms, 3000ms e 5000ms.
        </p>

        <div className="local-radio-custom-row">
          <label className="field-label" htmlFor="custom-stream-url">Stream URL custom</label>
          <div className="ip-row">
            <input
              id="custom-stream-url"
              value={localRadioCustomStreamUrl}
              onChange={(event) => setLocalRadioCustomStreamUrl(event.target.value)}
              placeholder="https://example.com/live/stream.mp3"
            />
            <button type="button" onClick={() => testStreamInBrowser(localRadioCustomStreamUrl)} disabled={!localRadioCustomStreamUrl.trim()}>
              Test stream URL
            </button>
          </div>
          <audio ref={browserAudioRef} controls src={browserStreamUrl} className="browser-audio" />
          <div className="template-button-grid">
            {LOCAL_RADIO_TEMPLATES.map((template) => (
              <button
                key={`custom-${template.id}`}
                type="button"
                onClick={() => void runLocalRadioTemplateTest(template)}
                disabled={!canSend || localRadioLoading || !localRadioCustomStreamUrl.trim()}
                title={`Test custom URL con ${template.label}`}
              >
                Test custom {template.id}
              </button>
            ))}
          </div>
        </div>

        <div className="local-radio-layout">
          <section>
            <div className="response-heading compact-heading">
              <h3>Radio test</h3>
              <button type="button" onClick={exportLocalRadioHistoryJson} disabled={localRadioHistory.length === 0}>
                Export JSON storico test
              </button>
            </div>
            <div className="local-radio-list">
              {radios.length === 0 ? (
                <p className="hint">Nessuna radio caricata da data/radios.json.</p>
              ) : radios.map((radio) => {
                const activeStreamUrl = getLocalRadioStreamUrl(radio);

                return (
                  <article key={`local-${radio.id}`}>
                    <div>
                      <h4>{radio.name}</h4>
                      <p>{radio.genre}</p>
                      <code>{activeStreamUrl}</code>
                    </div>
                    <div className="template-button-grid">
                      {LOCAL_RADIO_TEMPLATES.map((template) => (
                        <button
                          key={`${radio.id}-${template.id}`}
                          type="button"
                          onClick={() => void runLocalRadioTemplateTest(template, radio)}
                          disabled={!canSend || localRadioLoading || !activeStreamUrl}
                          title={template.description}
                        >
                          Test {template.id}
                        </button>
                      ))}
                    </div>
                    <div className="template-row">
                      <button type="button" onClick={() => testStreamInBrowser(activeStreamUrl)} disabled={!activeStreamUrl}>
                        Test stream URL
                      </button>
                      {LOCAL_RADIO_TEMPLATES.map((template) => (
                        <button key={`${radio.id}-${template.id}-preview`} type="button" onClick={() => previewLocalRadioTemplate(template, radio)} disabled={!activeStreamUrl}>
                          XML {template.id}
                        </button>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section>
            <h3>Varianti XML generate</h3>
            <div className="local-template-list">
              {LOCAL_RADIO_TEMPLATES.map((template) => (
                <details key={template.id}>
                  <summary>{template.label}</summary>
                  <p>{template.description}</p>
                  <pre>{formatXml(buildLocalRadioSelectXml(template, localRadioCustomStreamUrl || 'STREAM_URL', 'RADIO_NAME'))}</pre>
                </details>
              ))}
            </div>
            <h3>Editor manuale XML</h3>
            <textarea
              value={localRadioXml}
              onChange={(event) => setLocalRadioXml(event.target.value)}
              rows={10}
              placeholder={formatXml(buildLocalRadioSelectXml(LOCAL_RADIO_TEMPLATES[0], localRadioCustomStreamUrl || 'STREAM_URL', 'RADIO_NAME'))}
            />
            <button type="button" onClick={() => void runManualLocalRadioXmlTest()} disabled={!canSend || localRadioLoading || !localRadioXml.trim()}>
              {localRadioLoading ? 'Test Local Internet Radio in corso…' : 'POST /select XML manuale'}
            </button>
          </section>
        </div>

        <div className="local-radio-result">
          <h3>Risultato Local Internet Radio</h3>
          {localRadioResult ? (
            <>
              <div className="select-verification">
                <h4>{localRadioResult.templateLabel}</h4>
                <div className={`verification-badge ${localRadioResult.outcome}`}>
                  {localRadioResult.outcome === 'success' ? 'Formato accettato' : `Esito: ${localRadioResult.outcome}`}
                </div>
                <div className="realtime-grid">
                  <article><span>Radio</span><strong>{localRadioResult.radioName}</strong></article>
                  <article><span>Template</span><strong>{localRadioResult.templateId}</strong></article>
                  <article><span>Source now_playing</span><strong>{getLatestLocalRadioPoll(localRadioResult.nowPlaying)?.parsed.source ?? 'n/d'}</strong></article>
                  <article><span>PlayStatus</span><strong>{getLatestLocalRadioPoll(localRadioResult.nowPlaying)?.parsed.playStatus ?? 'n/d'}</strong></article>
                </div>
                <p className="hint"><strong>Stream:</strong> {localRadioResult.streamUrl || 'n/d'}</p>
                {localRadioResult.errorUpdateRaw ? (
                  <details open>
                    <summary>errorUpdate realtime</summary>
                    <pre>{localRadioResult.errorUpdateRaw}</pre>
                  </details>
                ) : null}
                <div className="experimental-grid">
                  <section>
                    <h4>XML inviato</h4>
                    <pre>{formatXml(localRadioResult.requestXml)}</pre>
                    <h4>Response Bose</h4>
                    <pre>{localRadioResult.responseBody}</pre>
                  </section>
                  <section>
                    <h4>Raw now_playing</h4>
                    <div className="poll-grid">
                      {localRadioResult.nowPlaying.map((poll) => (
                        <details key={`${localRadioResult.timestamp}-${poll.delayMs}`} open={poll.delayMs === 5000}>
                          <summary>{poll.delayMs}ms · HTTP {poll.httpStatus ?? 'errore'} · source {poll.parsed.source ?? 'n/d'}</summary>
                          <pre>{formatXml(poll.nowPlayingXml)}</pre>
                        </details>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            </>
          ) : (
            <p className="hint">Nessun test Local Internet Radio eseguito.</p>
          )}

          <h3>Storico Local Internet Radio</h3>
          <div className="select-history-list">
            {localRadioHistory.length === 0 ? <p className="hint">Nessuno storico disponibile.</p> : localRadioHistory.map((item, index) => (
              <details key={`${item.timestamp}-${index}`}>
                <summary>{new Date(item.timestamp).toLocaleTimeString('it-IT')} · {item.templateId} · {item.radioName} · {item.outcome}</summary>
                <pre>{JSON.stringify(item, null, 2)}</pre>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="panel replacement-presets-panel">
        <div className="response-heading">
          <div>
            <p className="eyebrow">V8 Replacement Radio Presets MVP</p>
            <h2>Replacement Presets</h2>
          </div>
          <span>preset radio gestiti dall’app</span>
        </div>
        <p className="hint">
          Editor avanzato dei 6 preset locali: il playback diretto Bose resta gestito dal player V11 tramite UPnP AVTransport.
        </p>

        <div className="replacement-audio-row">
          <button type="button" onClick={() => void loadReplacementPresets()} disabled={replacementLoading}>
            {replacementLoading ? 'Ricarico preset…' : 'Ricarica JSON locale'}
          </button>
        </div>

        <div className="replacement-presets-grid">
          {replacementPresets.map((preset) => {
            const streamCheck = replacementStreamChecks[preset.id];

            return (
              <article key={preset.id} className={!preset.enabled ? 'disabled' : ''}>
                <div className="replacement-preset-heading">
                  <strong>Preset {preset.id}</strong>
                  <label>
                    <input
                      type="checkbox"
                      checked={preset.enabled}
                      onChange={(event) => updateReplacementPreset(preset.id, { enabled: event.target.checked })}
                    />
                    enabled
                  </label>
                </div>
                {preset.logoUrl ? <img src={preset.logoUrl} alt="" /> : null}
                <label className="field-label" htmlFor={`replacement-name-${preset.id}`}>Nome</label>
                <input
                  id={`replacement-name-${preset.id}`}
                  value={preset.name}
                  onChange={(event) => updateReplacementPreset(preset.id, { name: event.target.value })}
                />
                <label className="field-label" htmlFor={`replacement-logo-${preset.id}`}>Logo URL</label>
                <input
                  id={`replacement-logo-${preset.id}`}
                  value={preset.logoUrl ?? ''}
                  onChange={(event) => updateReplacementPreset(preset.id, { logoUrl: event.target.value })}
                  placeholder="https://example.com/logo.png"
                />
                <label className="field-label" htmlFor={`replacement-category-${preset.id}`}>Categoria</label>
                <input
                  id={`replacement-category-${preset.id}`}
                  value={preset.category ?? ''}
                  onChange={(event) => updateReplacementPreset(preset.id, { category: event.target.value })}
                  placeholder="News, Jazz, Rock…"
                />
                <label className="field-label" htmlFor={`replacement-stream-${preset.id}`}>Stream URL</label>
                <input
                  id={`replacement-stream-${preset.id}`}
                  value={preset.streamUrl}
                  onChange={(event) => updateReplacementPreset(preset.id, { streamUrl: event.target.value })}
                  placeholder="https://example.com/live.mp3"
                />
                <label className="field-label" htmlFor={`replacement-notes-${preset.id}`}>Note</label>
                <textarea
                  id={`replacement-notes-${preset.id}`}
                  value={preset.notes}
                  onChange={(event) => updateReplacementPreset(preset.id, { notes: event.target.value })}
                  rows={3}
                />
                <div className="replacement-actions">
                  <button type="button" onClick={() => void saveReplacementPreset(preset)} disabled={replacementSavingId === preset.id}>
                    {replacementSavingId === preset.id ? 'Salvataggio…' : 'Salva'}
                  </button>
                  <button type="button" onClick={() => testReplacementStreamInBrowser(preset)} disabled={!preset.streamUrl.trim()}>
                    Test stream URL
                  </button>
                </div>
                <div className={`stream-status ${streamCheck?.ok ? 'ok' : streamCheck ? 'error' : 'idle'}`}>
                  <span>Stato stream</span>
                  <strong>{streamCheck ? (streamCheck.ok ? 'raggiungibile' : 'errore stream') : 'non testato'}</strong>
                  <small>{streamCheck?.mimeType ? `MIME: ${streamCheck.mimeType}` : streamCheck?.error ?? (streamCheck?.status ? `HTTP ${streamCheck.status}` : 'MIME type n/d')}</small>
                  {streamCheck?.finalUrl ? <small>final URL: {streamCheck.finalUrl}</small> : null}
                </div>
              </article>
            );
          })}
        </div>

        <div className="bose-output-strategy">
          <h3>Strategia V11</h3>
          <div className="strategy-grid">
            <article>
              <strong>Preset locali</strong>
              <p>I sei slot sono salvati in data/replacement-presets.json e non distinguono tra default e preset creati dall’utente.</p>
            </article>
            <article>
              <strong>Play backend per ID</strong>
              <p>Il frontend invia l’ID preset; il backend legge streamUrl dal JSON e usa sempre Stop, SetAVTransportURI, Play e polling.</p>
            </article>
            <article>
              <strong>Radio Browser</strong>
              <p>La ricerca online serve solo per trovare URL radio da assegnare ai preset locali.</p>
            </article>
            <article>
              <strong>Audio dalla Bose</strong>
              <p>La riproduzione diretta passa da UPnP AVTransport sulla porta 8091, senza browser player, AirPlay o Bluetooth.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="panel upnp-playback-panel">
        <div className="response-heading">
          <div>
            <p className="eyebrow">V9 UPnP AVTransport Playback Test</p>
            <h2>UPnP Playback Test</h2>
          </div>
          <span>SetAVTransportURI + Play su porta 8091</span>
        </div>
        <p className="hint">
          Test mirato per capire se la SoundTouch 30 può riprodurre una web radio direttamente via UPnP AVTransport, senza AirPlay/Bluetooth e senza player browser.
        </p>

        <div className="upnp-controls-grid">
          <section>
            <h3>Preset replacement sorgente</h3>
            <label className="field-label" htmlFor="upnp-preset-select">Scegli preset replacement</label>
            <select id="upnp-preset-select" value={selectedUpnpPresetId} onChange={(event) => selectUpnpPreset(Number(event.target.value))}>
              {replacementPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>Preset {preset.id} · {preset.name}</option>
              ))}
            </select>
            <label className="field-label" htmlFor="upnp-stream-url">Stream URL</label>
            <input
              id="upnp-stream-url"
              value={upnpStreamUrl}
              onChange={(event) => setUpnpStreamUrl(event.target.value)}
              placeholder="http://ice1.somafm.com/groovesalad-128-mp3"
            />
            <div className="template-row">
              {UPNP_TEST_STREAMS.map((stream) => (
                <button key={stream} type="button" onClick={() => setUpnpStreamUrl(stream)}>
                  {stream.includes('somafm') ? 'SomaFM MP3' : stream.includes('bbc') ? 'BBC World' : 'Radio Paradise'}
                </button>
              ))}
            </div>
            <label className="field-label" htmlFor="upnp-set-uri-mode">SetAVTransportURI mode</label>
            <select id="upnp-set-uri-mode" value={upnpSetUriMode} onChange={(event) => setUpnpSetUriMode(event.target.value as UpnpSetUriMode)}>
              <option value="direct">Mode A · CurrentURI diretto + metadata vuoto</option>
              <option value="didl">Mode B · CurrentURI diretto + DIDL-Lite metadata escaped</option>
            </select>
            <p className="hint">Primo stream di test: http://ice1.somafm.com/groovesalad-128-mp3</p>
          </section>

          <section>
            <h3>Comandi AVTransport</h3>
            <div className="template-row">
              <button type="button" onClick={() => void fetchUpnpRootDesc()} disabled={!canSend || upnpLoading}>
                Test rootDesc.xml / 8091
              </button>
              <button type="button" onClick={() => void runUpnpPlaybackTest('set-uri')} disabled={!canSend || upnpLoading || !upnpStreamUrl.trim()}>
                Set URI
              </button>
              <button type="button" onClick={() => void runUpnpPlaybackTest('play')} disabled={!canSend || upnpLoading}>
                Play on Bose
              </button>
              <button type="button" onClick={() => void runUpnpPlaybackTest('set-uri-play')} disabled={!canSend || upnpLoading || !upnpStreamUrl.trim()}>
                Set URI + Play
              </button>
              <button type="button" onClick={() => void runUpnpVerifyFlow()} disabled={!canSend || upnpLoading || !upnpStreamUrl.trim()}>
                Set URI + Play + Verify
              </button>
            </div>
            <p className="hint">Il verify flow esegue Stop → SetAVTransportURI → attesa 500ms → GetMediaInfo → GetTransportInfo → GetPositionInfo → Play → polling /now_playing a 500, 1500, 3000, 5000ms.</p>
          </section>
        </div>

        <div className="upnp-result-panel">
          <h3>Risultato UPnP</h3>
          {upnpLastResult ? (
            <div className="select-verification">
              <div className={`verification-badge ${upnpLastResult.outcome.includes('error') || upnpLastResult.outcome.includes('fallito') || upnpLastResult.outcome.includes('non disponibile') ? 'error' : 'pending'}`}>
                {upnpLastResult.command} · {upnpLastResult.outcome}
              </div>
              <div className="realtime-grid">
                <article><span>Preset</span><strong>{upnpLastResult.presetId ?? 'n/d'}</strong></article>
                <article><span>Stream</span><strong>{upnpLastResult.streamUrl || 'n/d'}</strong></article>
                <article><span>Set URI HTTP</span><strong>{upnpLastResult.setUriResult?.status ?? 'n/d'}</strong></article>
                <article><span>Play HTTP</span><strong>{upnpLastResult.playResult?.status ?? 'n/d'}</strong></article>
              </div>

              {upnpLastResult.rootDescResult ? (
                <details open>
                  <summary>UPnP rootDesc / probe 8091</summary>
                  <pre>{JSON.stringify(upnpLastResult.rootDescResult, null, 2)}</pre>
                </details>
              ) : null}
              {upnpLastResult.errorUpdateRaw ? (
                <details open>
                  <summary>errorUpdate WebSocket</summary>
                  <pre>{upnpLastResult.errorUpdateRaw}</pre>
                </details>
              ) : null}

              <div className="experimental-grid">
                <section>
                  <h4>Request SOAP</h4>
                  <pre>{upnpLastResult.setUriResult?.requestSoap ? formatXml(upnpLastResult.setUriResult.requestSoap) : upnpLastResult.playResult?.requestSoap ? formatXml(upnpLastResult.playResult.requestSoap) : 'n/d'}</pre>
                  <h4>SOAPAction</h4>
                  <pre>{upnpLastResult.setUriResult?.soapAction ?? upnpLastResult.playResult?.soapAction ?? 'n/d'}</pre>
                </section>
                <section>
                  <h4>Response SOAP / errori</h4>
                  <pre>{upnpLastResult.setUriResult ? JSON.stringify({ status: upnpLastResult.setUriResult.status, ok: upnpLastResult.setUriResult.ok, contentType: upnpLastResult.setUriResult.contentType, body: upnpLastResult.setUriResult.responseBody }, null, 2) : upnpLastResult.playResult ? JSON.stringify({ status: upnpLastResult.playResult.status, ok: upnpLastResult.playResult.ok, contentType: upnpLastResult.playResult.contentType, body: upnpLastResult.playResult.responseBody }, null, 2) : 'n/d'}</pre>
                </section>
              </div>

              <details open>
                <summary>Log SOAP completo</summary>
                <pre>{JSON.stringify({
                  stop: upnpLastResult.stopResult,
                  setUri: upnpLastResult.setUriResult,
                  getMediaInfo: upnpLastResult.getMediaInfoResult,
                  getTransportInfo: upnpLastResult.getTransportInfoResult,
                  getPositionInfo: upnpLastResult.getPositionInfoResult,
                  play: upnpLastResult.playResult
                }, null, 2)}</pre>
              </details>
              {upnpLastResult.getMediaInfoResult ? (
                <details open>
                  <summary>Response GetMediaInfo</summary>
                  <pre>{JSON.stringify(upnpLastResult.getMediaInfoResult, null, 2)}</pre>
                </details>
              ) : null}
              {upnpLastResult.getTransportInfoResult ? (
                <details open>
                  <summary>Response GetTransportInfo</summary>
                  <pre>{JSON.stringify(upnpLastResult.getTransportInfoResult, null, 2)}</pre>
                </details>
              ) : null}
              {upnpLastResult.playResult ? (
                <details open>
                  <summary>Response Play</summary>
                  <pre>{JSON.stringify(upnpLastResult.playResult, null, 2)}</pre>
                </details>
              ) : null}

              <h4>now_playing dopo comando</h4>
              <div className="poll-grid">
                {upnpLastResult.nowPlayingAfter.length === 0 ? <p className="hint">Nessun polling now_playing per questo comando.</p> : upnpLastResult.nowPlayingAfter.map((poll) => (
                  <details key={`${upnpLastResult.timestamp}-${poll.delayMs}`} open={poll.delayMs === 5000 || poll.delayMs === 3000}>
                    <summary>{poll.delayMs}ms · HTTP {poll.httpStatus ?? 'errore'} · source {poll.parsed.source ?? 'n/d'} · play {poll.parsed.playStatus ?? 'n/d'}</summary>
                    <pre>{formatXml(poll.nowPlayingXml)}</pre>
                  </details>
                ))}
              </div>
            </div>
          ) : <p className="hint">Nessun test UPnP eseguito.</p>}

          <h3>Storico UPnP</h3>
          <div className="select-history-list">
            {upnpHistory.length === 0 ? <p className="hint">Nessuno storico disponibile.</p> : upnpHistory.map((item, index) => (
              <details key={`${item.timestamp}-${index}`}>
                <summary>{new Date(item.timestamp).toLocaleTimeString('it-IT')} · {item.command} · {item.outcome}</summary>
                <pre>{JSON.stringify(item, null, 2)}</pre>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="panel preset-lab-panel">
        <div className="response-heading">
          <div>
            <p className="eyebrow">V7 Preset Restoration Research</p>
            <h2>Preset Restoration Lab</h2>
          </div>
          <span>preset keys · favorites · endpoint discovery</span>
        </div>
        <p className="hint">
          Laboratorio per capire se le API locali ufficiali possono richiamare preset legacy, trasformare lo stream corrente in preset con ADD_FAVORITE, usare recents come ponte o scoprire capability locali non esposte.
        </p>

        <div className="preset-diagnosis-card">
          <h3>Preset diagnosis</h3>
          <div className="diagnosis-grid">
            <article className={presetDiagnosis.presetExists ? 'ok' : 'pending'}>
              <span>preset exists</span>
              <strong>{presetDiagnosis.presetExists ? 'sì' : 'non confermato'}</strong>
            </article>
            <article className={presetDiagnosis.keyAccepted ? 'ok' : 'pending'}>
              <span>key accepted</span>
              <strong>{presetDiagnosis.keyAccepted ? 'HTTP 200 rilevato' : 'da testare'}</strong>
            </article>
            <article className={presetDiagnosis.nowPlayingBecomesInvalidSource ? 'warn' : 'pending'}>
              <span>nowPlaying becomes INVALID_SOURCE</span>
              <strong>{presetDiagnosis.nowPlayingBecomesInvalidSource ? `sì (${presetDiagnosis.invalidSourceCommand})` : 'non rilevato'}</strong>
            </article>
            <article className={presetDiagnosis.likelyCloudResolutionMissing ? 'warn' : 'pending'}>
              <span>likely cloud resolution missing</span>
              <strong>{presetDiagnosis.likelyCloudResolutionMissing ? 'probabile' : 'non concluso'}</strong>
            </article>
          </div>
          <p className="hint">
            Se un tasto preset è accettato ma /now_playing passa a INVALID_SOURCE, il preset legacy probabilmente esiste ancora nella cassa ma il servizio cloud/TuneIn non risolve più lo stream audio.
          </p>
        </div>

        <div className="preset-lab-grid">
          <section>
            <h3>1. Preset key test</h3>
            <p className="hint">Invia press+release su PRESET_1…PRESET_6 e confronta /now_playing prima/dopo con polling a 500ms, 1500ms e 3000ms.</p>
            <div className="template-button-grid">
              {PRESET_LAB_KEYS.map((key) => (
                <button key={key} type="button" onClick={() => void runPresetKeyExperiment(key)} disabled={!canSend || presetLabLoading}>
                  {key}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3>2. Favorite test</h3>
            <p className="hint">ADD_FAVORITE e REMOVE_FAVORITE vengono inviati come key press+release. Dopo il comando aspetto 1500ms, ricarico /presets e confronto updatedOn/ContentItem.</p>
            <div className="template-row">
              <button type="button" onClick={() => void runFavoriteExperiment('ADD_FAVORITE')} disabled={!canSend || presetLabLoading}>
                ADD_FAVORITE
              </button>
              <button type="button" onClick={() => void runFavoriteExperiment('REMOVE_FAVORITE')} disabled={!canSend || presetLabLoading}>
                REMOVE_FAVORITE
              </button>
            </div>
          </section>

          <section>
            <h3>3–5. Endpoint research</h3>
            <p className="hint">Prova endpoint locali sperimentali e conserva anche 404/errori con raw response.</p>
            <div className="template-row">
              <button type="button" onClick={() => void fetchPresetLabEndpoint('RECENTS', 'recents')} disabled={!canSend || presetLabLoading}>
                GET /recents
              </button>
              <button type="button" onClick={() => void fetchPresetLabEndpoint('CAPABILITIES', 'capabilities')} disabled={!canSend || presetLabLoading}>
                GET /capabilities
              </button>
              <button type="button" onClick={() => void fetchPresetLabEndpoint('NOW_SELECTION', 'now_selection')} disabled={!canSend || presetLabLoading}>
                GET /now_selection
              </button>
            </div>
            <button type="button" onClick={exportPresetLabHistoryJson} disabled={presetLabHistory.length === 0 && !recentsResearch && !capabilitiesResearch && !nowSelectionResearch}>
              Export JSON completo
            </button>
          </section>
        </div>

        <div className="preset-research-endpoints">
          {([['Recents', recentsResearch], ['Capabilities', capabilitiesResearch], ['Now selection', nowSelectionResearch]] as Array<[string, ExperimentalEndpointResult | null]>).map(([label, result]) => (
            <details key={label} open={Boolean(result)}>
              <summary>{label}: {result ? `HTTP ${result.status} · ${result.ok ? 'ok' : 'errore/non disponibile'}` : 'non testato'}</summary>
              {result ? (() => {
                const parsed = parseExperimentalXml(result.body);
                const isXml = result.contentType.includes('xml') || /^\s*</.test(result.body);

                return (
                  <>
                    <div className="capability-highlights">
                      <mark className={result.ok ? 'ok' : 'error'}>{result.ok ? 'endpoint disponibile' : 'raw errore preservato'}</mark>
                      {parsed.highlightedTerms.map((term) => <mark key={term}>{term}</mark>)}
                    </div>
                    <h4>URL disponibili</h4>
                    <div className="url-highlight-list">
                      {parsed.urls.length === 0 ? <span>Nessun URL rilevato nel payload.</span> : parsed.urls.map((url) => <code key={url}>{url}</code>)}
                    </div>
                    {label === 'Now selection' ? (
                      <p className="hint">Eventi websocket nowSelectionUpdated correlati: {realtimeEvents.filter((event) => event.eventName === 'nowSelectionUpdated' || /<nowSelectionUpdated\b/i.test(event.raw ?? '')).length}</p>
                    ) : null}
                    <h4>Parsed JSON</h4>
                    <pre>{JSON.stringify(parsed, null, 2)}</pre>
                    <h4>{result.ok ? 'Raw XML / response' : 'Raw errore / response'}</h4>
                    <pre>{isXml ? formatXml(result.body) : result.body}</pre>
                  </>
                );
              })() : <p className="hint">Premi il pulsante GET per interrogare l’endpoint.</p>}
            </details>
          ))}
        </div>

        <div className="preset-lab-result">
          <h3>Risultato ultimo esperimento</h3>
          {presetLabResult ? (
            <div className="select-verification">
              <div className={`verification-badge ${presetLabResult.errorUpdateRaw ? 'error' : 'pending'}`}>{presetLabResult.outcome}</div>
              <div className="realtime-grid">
                <article><span>Comando</span><strong>{presetLabResult.command}</strong></article>
                <article><span>Before source</span><strong>{presetLabResult.nowPlayingBefore?.parsed.source ?? 'n/d'}</strong></article>
                <article><span>After source</span><strong>{presetLabResult.nowPlayingAfter[presetLabResult.nowPlayingAfter.length - 1]?.parsed.source ?? 'n/d'}</strong></article>
                <article><span>WebSocket correlati</span><strong>{presetLabResult.websocketEvents.length}</strong></article>
              </div>
              {presetLabResult.errorUpdateRaw ? (
                <details open>
                  <summary>errorUpdate realtime</summary>
                  <pre>{presetLabResult.errorUpdateRaw}</pre>
                </details>
              ) : null}
              <div className="experimental-grid">
                <section>
                  <h4>Response Bose</h4>
                  <pre>{presetLabResult.responseBose}</pre>
                  <h4>now_playing before</h4>
                  <pre>{presetLabResult.nowPlayingBefore ? formatXml(presetLabResult.nowPlayingBefore.nowPlayingXml) : 'n/d'}</pre>
                </section>
                <section>
                  <h4>now_playing after</h4>
                  <div className="poll-grid">
                    {presetLabResult.nowPlayingAfter.length === 0 ? <p className="hint">Nessun polling now_playing.</p> : presetLabResult.nowPlayingAfter.map((poll) => (
                      <details key={`${presetLabResult.timestamp}-${poll.delayMs}`} open={poll.delayMs === PRESET_LAB_POLL_DELAYS[PRESET_LAB_POLL_DELAYS.length - 1]}>
                        <summary>{poll.delayMs}ms · HTTP {poll.httpStatus ?? 'errore'} · source {poll.parsed.source ?? 'n/d'}</summary>
                        <pre>{formatXml(poll.nowPlayingXml)}</pre>
                      </details>
                    ))}
                  </div>
                </section>
              </div>
              {presetLabResult.presetsBefore || presetLabResult.presetsAfter ? (
                <div className="experimental-grid">
                  <section>
                    <h4>Presets before</h4>
                    <pre>{presetLabResult.presetsBefore ? JSON.stringify(presetLabResult.presetsBefore.parsed, null, 2) : 'n/d'}</pre>
                  </section>
                  <section>
                    <h4>Presets after</h4>
                    <pre>{presetLabResult.presetsAfter ? JSON.stringify(presetLabResult.presetsAfter.parsed, null, 2) : 'n/d'}</pre>
                  </section>
                </div>
              ) : null}
              <h4>WebSocket events correlati</h4>
              <pre>{JSON.stringify(presetLabResult.websocketEvents, null, 2)}</pre>
            </div>
          ) : <p className="hint">Nessun esperimento V7 eseguito.</p>}

          <h3>Storico esperimenti</h3>
          <div className="select-history-list">
            {presetLabHistory.length === 0 ? <p className="hint">Nessuno storico disponibile.</p> : presetLabHistory.map((item, index) => (
              <details key={`${item.timestamp}-${index}`}>
                <summary>{new Date(item.timestamp).toLocaleTimeString('it-IT')} · {item.command} · {item.outcome}</summary>
                <pre>{JSON.stringify(item, null, 2)}</pre>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="panel log-panel">
        <div className="response-heading">
          <div>
            <p className="eyebrow">Diagnostica V5</p>
            <h2>Log tecnico</h2>
          </div>
          <span>{technicalLogs.length} eventi</span>
        </div>
        <div className="log-list">
          {technicalLogs.map((log, index) => (
            <div className={`log-row connection-${String(log.status).replace(' ', '-')}`} key={`${log.timestamp}-${index}`}>
              <span>{new Date(log.timestamp).toLocaleTimeString('it-IT')}</span>
              <strong>{log.status}</strong>
              <code>{log.ip ?? '-'}</code>
              <p>{log.message}{typeof log.durationMs === 'number' ? ` · ${log.durationMs}ms` : ''}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="panel radios-panel">
        <div>
          <p className="eyebrow">Preparazione future radio</p>
          <h2>Radio web in JSON</h2>
          <p className="hint">
            Questa lista è solo dati locali per una futura integrazione di preset o streaming verso SoundTouch.
          </p>
        </div>
        <div className="radio-grid">
          {radios.map((radio) => (
            <article key={radio.id} className="radio-card">
              <h3>{radio.name}</h3>
              <p>{radio.genre}</p>
              <a href={radio.homepage} target="_blank" rel="noreferrer">
                Homepage
              </a>
              <code>{radio.streamUrl}</code>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const isDiagnosticsRoute = window.location.pathname.includes('/dashboard/diagnostics');
  return isDiagnosticsRoute ? <DiagnosticsApp /> : <RemotePage />;
}
