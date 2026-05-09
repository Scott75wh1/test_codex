# SoundTouch Radio Bridge

Dashboard locale **Node.js + Express + React/Vite** per testare le API Bose SoundTouch sulla LAN.

La V3 non usa Cloud Task o servizi cloud: il browser chiama il backend Express locale, che rileva la subnet LAN del server Node, cerca dispositivi Bose SoundTouch, inoltra le richieste HTTP/XML al dispositivo su `http://IP:8090` e apre un bridge realtime verso `ws://BOSE_IP:8080` usando il subprotocol WebSocket `gabbo`.

## Funzioni V3

- Campo per l'indirizzo IP del Bose SoundTouch con salvataggio dell'ultimo IP funzionante in `localStorage`.
- Pulsante **Cerca dispositivi Bose** che chiama `GET /api/discover`.
- Discovery LAN lato backend: rileva la subnet IPv4 locale del server Node e scansiona gli host `.1` - `.254` su `http://IP:8090/info` con timeout di 800ms per IP.
- Stato connessione in dashboard: `online`, `offline`, `timeout`, `non Bose` o `scanning`.
- Pannello log tecnico con timestamp, IP, stato e durata.
- Click su un device trovato per impostarlo come IP attivo.
- Pulsante **Connetti realtime**: il frontend apre una connessione SSE al backend, mentre il backend apre un WebSocket verso `ws://BOSE_IP:8080` con subprotocol `gabbo`.
- Ping/keepalive e reconnect automatico lato backend verso Bose se il WebSocket cade; il browser ritenta automaticamente la connessione SSE.
- Parser XML generico per `nowPlayingUpdated`, `volumeUpdated`, `presetsUpdated`, `infoUpdated`, `connectionStateUpdated` e di qualunque XML/evento raw ricevuto.
- UI realtime per source attiva, titolo, artista, stato play/pause e volume.
- Pannello debug eventi raw per vedere tutti gli XML originali Bose anche se i nomi evento differiscono. Se arriva solo `SoundTouchSdkInfo`, lo stato mostra che la WebSocket è aperta e in attesa di notifiche.
- Pulsante **Forza refresh REST** per sincronizzare manualmente `GET /now_playing`, `GET /volume` e `GET /sources`. Dopo ogni comando inviato dall’app viene eseguito automaticamente un polling REST di `now_playing` e `volume` dopo 300ms.
- Test `GET http://IP:8090/info`.
- Proxy locale per:
  - `GET /info`
  - `GET /now_playing`
  - `GET /sources`
  - `GET /volume`
  - `POST /volume` con payload XML `<volume>...</volume>`
  - `POST /key` per `PLAY_PAUSE`, `STOP`, `VOLUME_UP`, `VOLUME_DOWN`
- Lista di radio web in `data/radios.json`, esposta da `GET /api/radios`, pronta come base dati per preset/streaming futuri.

## Requisiti

- Node.js 18 o superiore.
- Un dispositivo Bose SoundTouch raggiungibile dalla stessa LAN sulla porta `8090`.

## Installazione

```bash
npm install
```

Copia il file di esempio se vuoi personalizzare porta o timeout delle chiamate API verso un IP Bose attivo:

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
- `npm run clean` rimuove cache/build locali (`dist`, `build`, cache Vite e tsbuildinfo).

## API backend locale

Discovery automatico dalla subnet locale del server Node:

```bash
curl http://localhost:3001/api/discover
```

La risposta include `devices` con nome, IP, `deviceID` e tipo prodotto se presente, più `logs` tecnici per gli host scansionati.

Bridge realtime via Server-Sent Events verso il browser e WebSocket verso Bose:

```bash
curl -N http://localhost:3001/api/realtime/192.168.1.50
```

Il backend si collega a `ws://192.168.1.50:8080` con subprotocol `gabbo`, inoltra gli eventi raw al frontend, invia ping/keepalive e prova a riconnettersi automaticamente se la connessione cade. Se la Bose invia solo `<SoundTouchSdkInfo ... />`, la dashboard lo mostra come WebSocket aperta in attesa di notifiche.

Sostituisci `192.168.1.50` con l'IP del tuo Bose.

```bash
curl http://localhost:3001/api/bose/192.168.1.50/info
curl http://localhost:3001/api/bose/192.168.1.50/now_playing
curl http://localhost:3001/api/bose/192.168.1.50/sources
curl http://localhost:3001/api/bose/192.168.1.50/volume
```

Impostazione volume tramite dashboard/backend locale:

```bash
curl -X POST http://localhost:3001/api/bose/192.168.1.50/volume \
  -H 'Content-Type: application/json' \
  -d '{"volume":35}'
```

Invio tasto tramite dashboard/backend locale:

```bash
curl -X POST http://localhost:3001/api/bose/192.168.1.50/key \
  -H 'Content-Type: application/json' \
  -d '{"key":"PLAY_PAUSE"}'
```

## Test curl diretti verso Bose

Per isolare eventuali problemi del dispositivo, puoi inviare XML puro direttamente al Bose sostituendo `BOSE_IP` con l'indirizzo reale:

```bash
curl -X POST "http://BOSE_IP:8090/key" \
  -H "Content-Type: application/xml" \
  -d '<key state="press" sender="Gabbo">PLAY_PAUSE</key>'
```

```bash
curl -X POST "http://BOSE_IP:8090/key" \
  -H "Content-Type: application/xml" \
  -d '<key state="release" sender="Gabbo">PLAY_PAUSE</key>'
```

```bash
curl -X POST "http://BOSE_IP:8090/volume" \
  -H "Content-Type: application/xml" \
  -d '<volume>30</volume>'
```

## Note SoundTouch

Il backend restituisce XML quando il dispositivo Bose risponde con XML sugli endpoint REST. Gli errori di validazione o di rete sono restituiti in JSON per semplificare il debug dalla dashboard. Il bridge realtime usa SSE verso il frontend e mostra sempre gli XML/eventi raw ricevuti dal WebSocket Bose.
