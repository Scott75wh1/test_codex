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

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';
const LAST_IP_STORAGE_KEY = 'soundtouch-radio-bridge:last-ip';
const ENDPOINTS: Array<{ id: BoseEndpoint; label: string; method: string }> = [
  { id: 'info', label: 'Info dispositivo', method: 'GET /info' },
  { id: 'now_playing', label: 'Now playing', method: 'GET /now_playing' },
  { id: 'sources', label: 'Sorgenti', method: 'GET /sources' },
  { id: 'volume', label: 'Volume', method: 'GET /volume' }
];
const KEYS: BoseKey[] = ['PLAY_PAUSE', 'STOP', 'VOLUME_UP', 'VOLUME_DOWN'];

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

  function postVolume() {
    void runRequest('POST /volume XML', () =>
      fetch(`${API_BASE}/bose/${encodedIp}/volume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volume })
      })
    );
  }

  function postKey(key: BoseKey) {
    void runRequest(`POST /key ${key}`, () =>
      fetch(`${API_BASE}/bose/${encodedIp}/key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
      })
    );
  }


  function applyRealtimeEvent(event: RealtimeEvent) {
    setRealtimeEvents((prev) => [event, ...prev].slice(0, 120));

    if (event.eventName === 'connectionState') {
      setRealtimeState(event.connectionState ?? event.message ?? 'connectionState');
      appendLog(makeLog(event.connectionState ?? 'realtime', event.message ?? 'Evento realtime connectionState.', boseIp));
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

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">LAN testing dashboard · V3 realtime</p>
          <h1>SoundTouch Radio Bridge</h1>
          <p className="subtitle">
            App locale Node.js + Express + React/Vite per trovare Bose SoundTouch 30 in LAN, provare le API SoundTouch e ricevere eventi realtime.
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

      <section className="panel log-panel">
        <div className="response-heading">
          <div>
            <p className="eyebrow">Diagnostica V3</p>
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
