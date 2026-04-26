# Manuale di utilizzo
## Apollo 13 Launch & Lunar Flyby Simulator

Questo manuale spiega come installare, avviare e usare il simulatore didattico.

---

## 1) Requisiti

- macOS / Linux / Windows
- Node.js 18+ consigliato
- npm 9+
- Browser moderno (Chrome, Edge, Firefox, Safari)

Verifica versioni:

```bash
node -v
npm -v
```

---

## 2) Installazione

Apri il terminale e posizionati nella cartella del progetto:

```bash
cd "/Users/cristian/Downloads/Apollo 13/test_codex-main"
```

Installa le dipendenze:

```bash
npm install
```

---

## 3) Avvio rapido

### Opzione A — comando npm

```bash
npm run dev:apollo
```

Apri nel browser:

- `http://localhost:5188`

### Opzione B — script helper

```bash
chmod +x launch_apollo13.sh
./launch_apollo13.sh
```

Lo script controlla automaticamente:
- esistenza cartella
- disponibilità npm
- installazione dipendenze (se `node_modules` non esiste)

---

## 4) Struttura dell'interfaccia

- **Top bar (Controlli):** start/pause/reset, velocità simulazione, burn manuali, eventi missione.
- **Area sinistra (Canvas):** Terra, Luna, capsula, traiettoria prevista e traiettoria reale.
- **Area destra (Mission Data):** telemetria in tempo reale.
- **Area bassa (Timeline):** stato avanzamento eventi Apollo 13.

---

## 5) Controlli principali

### Start simulation
Avvia il loop fisico della simulazione.

### Pause
Ferma l’aggiornamento fisico mantenendo lo stato corrente.

### Reset
Riporta missione e capsula allo stato iniziale.

### Speed x1 / x10 / x100 / x1000
Aumenta il numero di step fisici eseguiti ad ogni tick UI.

### Show vectors
Mostra i vettori di velocità e accelerazione della capsula.

### Show gravity fields
Mostra overlay semplificati dei campi gravitazionali Terra/Luna.

### Trigger oxygen tank explosion
Simula l’evento critico: riduzione energia, service module offline, modalità abort.

### Apply free-return correction burn
Applica burn verso traiettoria di ritorno libero (free-return).

### Burn direction + DeltaV + Trigger manual correction burn
Permette burn manuali personalizzati.

---

## 6) Lettura pannello Mission Data

- **Mission Time:** tempo missione simulato.
- **Distance from Earth / Moon:** distanza capsula dai due corpi.
- **Estimated Speed:** modulo della velocità capsula.
- **Mission Phase:** fase missione attiva.
- **Fuel / Energy:** risorse residue.
- **Crew Status:** stato operativo equipaggio.

---

## 7) Flusso di test consigliato (didattico)

1. Premi **Start simulation**.
2. Porta velocità su **x10** o **x100**.
3. Attiva **Show vectors**.
4. Dopo alcuni secondi usa **Trigger oxygen tank explosion**.
5. Osserva cambio fase e stato energia/crew.
6. Usa **Apply free-return correction burn**.
7. Confronta **planned trajectory** vs **actual trajectory**.

---

## 8) Risoluzione problemi

### Errore: `vite: not found`
Esegui:

```bash
npm install
```

### Errore: `permission denied` su file `.json`
Non eseguire `package.json` direttamente. Usa sempre `npm run ...`.

### Porta occupata
Se `5188` è occupata, cambia la porta in `vite.config.ts` o lancia con:

```bash
npm run dev -- --port 5190 --host
```

### Errore npm 403
È un problema di rete/policy del registry npm dell’ambiente, non del codice.

---

## 9) Build produzione

```bash
npm run build
npm run preview
```

Preview di default:
- `http://localhost:4188`

---

## 10) Note didattiche

Il simulatore è intenzionalmente semplificato:
- fisica in unità SI
- rendering normalizzato per chiarezza visiva
- eventi missione educativi (non replica NASA 1:1)

Obiettivo: comprendere concetti di gravità, correzione di rotta, free-return e flyby lunare.


## 11) Scenari di simulazione

Nel selettore **Scenario** puoi scegliere:

- **Nominal Apollo 13**: profilo standard con eventi in sequenza temporale didattica.
- **Early Explosion**: emergenza anticipata per allenare abort e free-return.
- **Fuel Critical Return**: risorse ridotte, richiede burn più efficienti.
- **Manual Burn Training**: scenario libero per sperimentazione manuale.
