import { useEffect, useMemo, useRef, useState } from 'react';

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

function parseSourcesXml(xml: string) {
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

export default function App() {
  const [boseIp, setBoseIp] = useState(() => getStoredIp());
  const [volume, setVolume] = useState(30);
  const [response, setResponse] = useState<ApiResponse>(() => makeInitialResponse());
  const [radios, setRadios] = useState<Radio[]>([]);
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
  const lastRealtimeErrorRawRef = useRef<string | null>(null);
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
    setRealtimeEvents((prev) => [event, ...prev].slice(0, 50));

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


  return (
    <div className="app-shell">
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
              Test stream nel browser
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
                        Test stream nel browser
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
