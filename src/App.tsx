import { useEffect, useMemo, useState } from 'react';

type BoseEndpoint = 'info' | 'now_playing' | 'sources' | 'volume';
type BoseKey = 'PLAY_PAUSE' | 'STOP' | 'VOLUME_UP' | 'VOLUME_DOWN';

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

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';
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
    body: 'Inserisci l’IP del Bose SoundTouch e scegli un comando.'
  };
}

async function readResponseBody(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return JSON.stringify(await response.json(), null, 2);
  }

  return response.text();
}

export default function App() {
  const [boseIp, setBoseIp] = useState('192.168.1.50');
  const [volume, setVolume] = useState(30);
  const [response, setResponse] = useState<ApiResponse>(() => makeInitialResponse());
  const [radios, setRadios] = useState<Radio[]>([]);
  const encodedIp = useMemo(() => encodeURIComponent(boseIp.trim()), [boseIp]);
  const canSend = encodedIp.length > 0;

  useEffect(() => {
    fetch(`${API_BASE}/radios`)
      .then((res) => res.json())
      .then(setRadios)
      .catch(() => setRadios([]));
  }, []);

  async function runRequest(title: string, request: () => Promise<Response>) {
    if (!canSend) {
      setResponse({ title, status: 'error', body: 'Inserisci prima un indirizzo IP Bose valido.', timestamp: now() });
      return;
    }

    setResponse({ title, status: 'loading', body: 'Richiesta in corso sulla LAN…', timestamp: now() });

    try {
      const apiResponse = await request();
      const body = await readResponseBody(apiResponse);
      setResponse({
        title: `${title} — HTTP ${apiResponse.status}`,
        status: apiResponse.ok ? 'success' : 'error',
        body,
        timestamp: now()
      });
    } catch (error) {
      setResponse({
        title,
        status: 'error',
        body: error instanceof Error ? error.message : 'Errore sconosciuto.',
        timestamp: now()
      });
    }
  }

  function getEndpoint(endpoint: BoseEndpoint) {
    void runRequest(`GET /${endpoint}`, () => fetch(`${API_BASE}/bose/${encodedIp}/${endpoint}`));
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

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">LAN testing dashboard</p>
          <h1>SoundTouch Radio Bridge</h1>
          <p className="subtitle">
            App locale Node.js + Express + React/Vite per provare le API Bose SoundTouch sulla rete di casa.
          </p>
        </div>
        <div className="status-card">
          <span>Backend</span>
          <strong>{API_BASE}</strong>
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
              placeholder="es. 192.168.1.50"
              inputMode="decimal"
            />
            <button type="button" onClick={() => getEndpoint('info')} disabled={!canSend}>
              Test GET /info
            </button>
          </div>
          <p className="hint">Il backend inoltra le richieste a http://IP:8090 senza usare Cloud Task.</p>

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

      <section className="panel radios-panel">
        <div>
          <p className="eyebrow">Preparazione V2</p>
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
