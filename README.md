# Apollo 13 Launch & Lunar Flyby Simulator

Simulatore didattico React + TypeScript + Vite per visualizzare una missione Apollo 13 semplificata (lancio, TLI, evento esplosione, free-return, flyby lunare, rientro).

## Avvio rapido

```bash
npm install
npm run dev:apollo
```

Apri: `http://localhost:5188`

## Script di lancio rapido (macOS/Linux)

È incluso `launch_apollo13.sh` con percorso preimpostato a:

`/Users/cristian/Downloads/Apollo 13`

Uso:

```bash
chmod +x launch_apollo13.sh
./launch_apollo13.sh
```

Lo script:
- verifica che la cartella esista
- verifica che `npm` sia disponibile
- esegue `npm install` solo se `node_modules` manca
- avvia `npm run dev:apollo`

## Script disponibili

- `npm run dev` → sviluppo Vite (porta fissata in `vite.config.ts`)
- `npm run dev:apollo` → sviluppo con host/porta espliciti (`5188`)
- `npm run build` → type-check + build produzione
- `npm run preview` → preview build (porta fissata in `vite.config.ts`, `4188`)
- `npm run preview:apollo` → preview con host/porta espliciti (`4188`)

## Troubleshooting rapido

- Se la porta `5188` è occupata, libera il processo o cambia `server.port` in `vite.config.ts`.
- Se `npm install` fallisce con `403`, è un blocco del registry/rete dell'ambiente in uso (non del progetto).

## Deploy veloce (Vercel)

1. Pubblica il repository su GitHub.
2. Importa il repo su Vercel.
3. Framework: **Vite** (auto-rilevato).
4. Build command: `npm run build`
5. Output directory: `dist`
6. Deploy.
