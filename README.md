# SoundTouch Radio Bridge

Dashboard locale **Node.js + Express + React/Vite** per testare le API Bose SoundTouch sulla LAN.

La V5 non usa Cloud Task o servizi cloud: il browser chiama il backend Express locale, che rileva la subnet LAN del server Node, cerca dispositivi Bose SoundTouch, inoltra le richieste HTTP/XML al dispositivo su `http://IP:8090` e apre un bridge realtime verso `ws://BOSE_IP:8080` usando il subprotocol WebSocket `gabbo`.

## Funzioni V8

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
- Nuovo pannello **Inspector** con tab `Info`, `Sources`, `Presets`, `Now Playing`, `Raw XML` e `WebSocket Events`.
- Ogni risposta inspector salva raw XML, parsed JSON e timestamp; i preset mostrano id, source, sourceAccount, location, container, itemName, art e stationName con fallback se mancano campi.
- Export **JSON diagnostics** e **raw XML** per analizzare come Bose referenzia internamente radio web e preset legacy.
- Storico degli ultimi 50 eventi WebSocket nel tab inspector dedicato.
- Nuovo pannello **Experimental Select** per testare `POST /select` con il ContentItem XML esatto dei preset.
- Lista preset da `/presets` con pulsante **Try Select**, editor XML manuale e template TUNEIN legacy, LOCAL_INTERNET_RADIO e UPNP.
- Ogni test mostra XML inviato, risposta Bose e HTTP status; dopo 500ms viene eseguito refresh REST di `/now_playing`.
- Test `GET http://IP:8090/info`.
- Proxy locale per:
  - `GET /info`
  - `GET /now_playing` e alias inspector `GET /now-playing`
  - `GET /sources`
  - `GET /presets`
  - `GET /volume`
  - `POST /select` con ContentItem XML sperimentale
  - `POST /volume` con payload XML `<volume>...</volume>`
  - `POST /key` per `PLAY_PAUSE`, `STOP`, `VOLUME_UP`, `VOLUME_DOWN`, `PRESET_1`...`PRESET_6`, `ADD_FAVORITE`, `REMOVE_FAVORITE`
  - `GET /api/replacement-presets`, `PUT /api/replacement-presets/:id`, `POST /api/replacement-presets/:id/play` e `POST /api/replacement-presets/:id/test-stream` per leggere, salvare, testare e riprodurre i preset sostitutivi locali
  - `GET /api/radio-search?q=QUERY&country=COUNTRY&tag=TAG` per cercare stream via Radio Browser, normalizzati prima di salvarli nel JSON locale
  - `POST /api/stream-check` per verificare raggiungibilità, MIME type, potenziale compatibilità audio e redirect/final URL degli stream diretti
  - `POST /api/upnp/:ip/stop`, `POST /api/upnp/:ip/set-uri`, `POST /api/upnp/:ip/get-media-info`, `POST /api/upnp/:ip/get-transport-info`, `POST /api/upnp/:ip/get-position-info`, `POST /api/upnp/:ip/play` e `GET /api/upnp/:ip/root-desc` per test AVTransport su porta `8091`
- Lista di radio web in `data/radios.json`, esposta da `GET /api/radios`, pronta come base dati per preset/streaming futuri.
- Nuova UI principale **V12 Remote Control**: telecomando mobile-first “SoundTouch Radio Remote” con stato Bose, nome dispositivo, IP attivo, Now Playing, controlli Play/Pause/Stop/Volume/Mute, sorgenti disponibili e sei preset radio grandi touch-friendly.
- La modifica preset avviene in una modal moderna con nome, stream URL manuale, logo opzionale, ricerca Radio Browser integrata, test stream e salvataggio immediato nel JSON locale.
- Ogni replacement preset ha `id` 1-6, `name`, `streamUrl`, `logoUrl` opzionale, `category` opzionale, `notes`, `enabled` e `lastPlayedAt`; tutti i preset, default e utente, vengono letti solo da `data/replacement-presets.json`.
- Il play di un preset chiama `POST /api/replacement-presets/:id/play`: il backend legge lo `streamUrl` dal JSON e usa lo stesso flusso per tutti i preset: Stop UPnP, SetAVTransportURI, attesa 300 ms, Play, GetTransportInfo, GetPositionInfo e polling `/now_playing`.
- Radio Browser serve solo per trovare stream radio; la riproduzione non usa AirPlay, Bluetooth o audio HTML5, ma avviene direttamente dalla Bose via UPnP AVTransport sulla porta `8091`.
- La diagnostica storica (inspector, raw XML, SOAP log, websocket debug, export JSON, experimental select e research panels) non è più visibile nella UI principale: resta accessibile solo aprendo `/dashboard/diagnostics` dal link “Diagnostica avanzata”.
- Nuova sezione **UPnP Playback Test**: prova sperimentale di `SetAVTransportURI` e `Play` su `http://BOSE_IP:8091/AVTransport/Control`, con polling `/now_playing` dopo il comando e probe `rootDesc.xml`/porta 8091.

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

Inspector e bridge realtime via Server-Sent Events verso il browser e WebSocket verso Bose:

```bash
curl -N http://localhost:3001/api/realtime/192.168.1.50
```

Il backend si collega a `ws://192.168.1.50:8080` con subprotocol `gabbo`, inoltra gli eventi raw al frontend, invia ping/keepalive e prova a riconnettersi automaticamente se la connessione cade. Se la Bose invia solo `<SoundTouchSdkInfo ... />`, la dashboard lo mostra come WebSocket aperta in attesa di notifiche.

Endpoint inspector/rest principali e select sperimentale:

```bash
curl http://localhost:3001/api/bose/192.168.1.50/info
curl http://localhost:3001/api/bose/192.168.1.50/sources
curl http://localhost:3001/api/bose/192.168.1.50/presets
curl http://localhost:3001/api/bose/192.168.1.50/now-playing
```

Esempio `POST /select` con ContentItem TuneIn legacy:

```bash
curl -X POST http://localhost:3001/api/bose/192.168.1.50/select \
  -H 'Content-Type: application/xml' \
  -H 'Accept: application/xml' \
  -d '<ContentItem source="TUNEIN" type="stationurl" location="/v1/playback/station/s293430" sourceAccount="" isPresetable="true"><itemName>Just House Music</itemName></ContentItem>'
```

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

Replacement presets locali:

```bash
curl http://localhost:3001/api/replacement-presets
curl -X PUT http://localhost:3001/api/replacement-presets/1 \
  -H 'Content-Type: application/json' \
  -d '{"name":"SomaFM Groove Salad","streamUrl":"http://ice1.somafm.com/groovesalad-128-mp3","category":"Downtempo","notes":"Test","enabled":true}'
curl -X POST http://localhost:3001/api/replacement-presets/1/test-stream
curl -X POST http://localhost:3001/api/replacement-presets/1/play \
  -H 'Content-Type: application/json' \
  -d '{"boseIp":"192.168.1.50"}'
curl 'http://localhost:3001/api/radio-search?q=bbc&country=United%20Kingdom&tag=news'
curl -X POST http://localhost:3001/api/stream-check \
  -H 'Content-Type: application/json' \
  -d '{"streamUrl":"http://ice1.somafm.com/groovesalad-128-mp3"}'
```

UPnP AVTransport sperimentale su porta 8091:

```bash
curl http://localhost:3001/api/upnp/192.168.1.50/root-desc
curl -X POST http://localhost:3001/api/upnp/192.168.1.50/stop \
  -H 'Content-Type: application/json' \
  -d '{}'
curl -X POST http://localhost:3001/api/upnp/192.168.1.50/set-uri \
  -H 'Content-Type: application/json' \
  -d '{"streamUrl":"http://ice1.somafm.com/groovesalad-128-mp3","mode":"didl"}'
curl -X POST http://localhost:3001/api/upnp/192.168.1.50/get-media-info \
  -H 'Content-Type: application/json' \
  -d '{}'
curl -X POST http://localhost:3001/api/upnp/192.168.1.50/get-transport-info \
  -H 'Content-Type: application/json' \
  -d '{}'
curl -X POST http://localhost:3001/api/upnp/192.168.1.50/play \
  -H 'Content-Type: application/json' \
  -d '{}'
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


## Conclusione tecnica sui preset legacy

Dai test diagnostici V7/V8 emerge che `/presets` sulle API locali SoundTouch è disponibile solo in lettura, mentre `/key PRESET_1`...`PRESET_6` può restituire HTTP 200 ma portare `/now_playing` a `INVALID_SOURCE`. Anche `POST /select` con ContentItem TuneIn legacy può rispondere HTTP 200 senza produrre audio, e `/capabilities` non espone endpoint locali utili per riscrivere preset radio o risolvere cataloghi TuneIn.

Conclusione operativa: i preset radio legacy sembrano dipendere da una risoluzione cloud/TuneIn non più affidabile o non più disponibile. I preset Bose nativi non risultano modificabili tramite API locale ufficiale: l’app non li ripristina né li riscrive, ma crea sei preset sostitutivi gestiti localmente in `data/replacement-presets.json`. Con V12, la UI principale è un telecomando finale: il click su una card preset invia al backend solo l’ID preset; il backend legge lo stream dal JSON e invia Stop, SetAVTransportURI, Play, GetTransportInfo, GetPositionInfo e polling `/now_playing`. La riproduzione avviene direttamente dalla Bose tramite UPnP AVTransport, senza AirPlay/Bluetooth e senza usare il browser come player audio. Radio Browser serve esclusivamente per trovare URL di stream radio da salvare nei preset locali. La diagnostica avanzata rimane disponibile su `/dashboard/diagnostics`, separata dalla UI telecomando. Serve che Mac/server e Bose siano sulla stessa LAN e che la porta UPnP `8091` della SoundTouch sia raggiungibile.

## Note SoundTouch

Il backend restituisce XML quando il dispositivo Bose risponde con XML sugli endpoint REST. Gli errori di validazione o di rete sono restituiti in JSON per semplificare il debug dalla dashboard. Il bridge realtime usa SSE verso il frontend e mostra sempre gli XML/eventi raw ricevuti dal WebSocket Bose.
