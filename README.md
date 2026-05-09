# SoundTouch Radio Bridge

Dashboard locale **Node.js + Express + React/Vite** per testare le API Bose SoundTouch sulla LAN.

La V1 non usa Cloud Task o servizi cloud: il browser chiama il backend Express locale, che inoltra le richieste HTTP al dispositivo Bose su `http://IP:8090`.

## Funzioni V1

- Campo per l'indirizzo IP del Bose SoundTouch.
- Test `GET http://IP:8090/info`.
- Proxy locale per:
  - `GET /info`
  - `GET /now_playing`
  - `GET /sources`
  - `GET /volume`
  - `POST /volume` con payload XML `<volume>...</volume>`
  - `POST /key` per `PLAY_PAUSE`, `STOP`, `VOLUME_UP`, `VOLUME_DOWN`
- Lista di radio web in `data/radios.json`, esposta da `GET /api/radios`, pronta come base dati per la V2.

## Requisiti

- Node.js 18 o superiore.
- Un dispositivo Bose SoundTouch raggiungibile dalla stessa LAN sulla porta `8090`.

## Installazione

```bash
npm install
```

Copia il file di esempio se vuoi personalizzare porta o timeout:

```bash
cp .env.example .env
```

Variabili disponibili:

```ini
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
BOSE_REQUEST_TIMEOUT_MS=6000
```

## Sviluppo locale

Avvia backend Express e frontend Vite insieme:

```bash
npm run dev
```

Apri il frontend all'indirizzo mostrato da Vite, normalmente:

```text
http://localhost:5173
```

Il backend ascolta su:

```text
http://localhost:3001
```

## Script npm

- `npm install` installa le dipendenze.
- `npm run dev` avvia Express in watch mode e Vite in parallelo.
- `npm run dev:server` avvia solo il backend.
- `npm run dev:client` avvia solo il frontend.
- `npm run build` compila TypeScript e crea la build Vite.
- `npm run start` avvia il backend Express.

## API backend locale

Sostituisci `192.168.1.50` con l'IP del tuo Bose.

```bash
curl http://localhost:3001/api/bose/192.168.1.50/info
curl http://localhost:3001/api/bose/192.168.1.50/now_playing
curl http://localhost:3001/api/bose/192.168.1.50/sources
curl http://localhost:3001/api/bose/192.168.1.50/volume
```

Impostazione volume:

```bash
curl -X POST http://localhost:3001/api/bose/192.168.1.50/volume \
  -H 'Content-Type: application/json' \
  -d '{"volume":35}'
```

Invio tasto:

```bash
curl -X POST http://localhost:3001/api/bose/192.168.1.50/key \
  -H 'Content-Type: application/json' \
  -d '{"key":"PLAY_PAUSE"}'
```

## Note SoundTouch

Il backend restituisce XML quando il dispositivo Bose risponde con XML. Gli errori di validazione o di rete sono restituiti in JSON per semplificare il debug dalla dashboard.
