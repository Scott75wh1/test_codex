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

type SelectResult = {
  requestXml: string;
  responseBody: string;
  httpStatus: number | null;
  timestamp: string;
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
  const [selectLoading, setSelectLoading] = useState(false);
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


  async function refreshNowPlayingAfterSelect() {
    try {
      const res = await fetch(`${API_BASE}/bose/${encodedIp}/now_playing`);
      const nowPlayingXml = await res.text();
      const restSnapshot = parseRestSnapshot(nowPlayingXml, '');
      setRealtimeSnapshot((prev) => ({
        source: restSnapshot.source || prev.source,
        title: restSnapshot.title || prev.title,
        artist: restSnapshot.artist || prev.artist,
        playStatus: restSnapshot.playStatus || prev.playStatus,
        volume: prev.volume
      }));
      appendLog(makeLog(res.ok ? 'online' : 'offline', `Refresh /now_playing dopo select: HTTP ${res.status}`, boseIp));
    } catch (error) {
      appendLog(makeLog('offline', error instanceof Error ? error.message : 'Refresh /now_playing dopo select fallito.', boseIp));
    }
  }

  async function trySelectXml(xml: string) {
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
      setSelectResult({
        requestXml,
        responseBody,
        httpStatus: res.status,
        timestamp: new Date().toISOString()
      });
      appendLog(makeLog(res.ok ? 'online' : 'offline', `POST /select HTTP ${res.status}`, boseIp));
      window.setTimeout(() => {
        void refreshNowPlayingAfterSelect();
      }, 500);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore sconosciuto POST /select.';
      setSelectResult({ requestXml, responseBody: message, httpStatus: null, timestamp: new Date().toISOString() });
      appendLog(makeLog('offline', message, boseIp));
    } finally {
      setSelectLoading(false);
    }
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
              <button type="button" onClick={() => void loadInspectorTab('Presets')} disabled={!canSend || inspectorLoading}>
                Ricarica presets
              </button>
            </div>
            <div className="select-preset-list">
              {((inspectorRecords.Presets?.parsedJson as { presets?: ParsedPreset[] } | undefined)?.presets ?? []).length === 0 ? (
                <p className="hint">Carica la tab Presets nell’Inspector o premi “Ricarica presets”.</p>
              ) : ((inspectorRecords.Presets?.parsedJson as { presets?: ParsedPreset[] }).presets ?? []).map((preset, index) => (
                <article key={`select-${preset.id ?? index}-${preset.location ?? 'preset'}`}>
                  <strong>{preset.itemName ?? preset.stationName ?? `Preset ${preset.id ?? index + 1}`}</strong>
                  <small>source: {preset.source ?? 'n/d'} · location: {preset.location ?? 'n/d'}</small>
                  <button
                    type="button"
                    onClick={() => {
                      const xml = preset.contentItemXml ?? '';
                      setSelectXml(xml);
                      void trySelectXml(xml);
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
            <button type="button" onClick={() => void trySelectXml(selectXml)} disabled={!canSend || selectLoading}>
              {selectLoading ? 'Select in corso…' : 'Try Select XML manuale'}
            </button>
          </section>
        </div>
        <div className="select-result">
          <h3>Risultato POST /select</h3>
          {selectResult ? (
            <div className="experimental-grid">
              <section>
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
          ) : (
            <p className="hint">Nessun test /select eseguito.</p>
          )}
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
