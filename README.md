# Slyce Virtual Printer Lab

Standalone desktop simulator (Electron + React + TypeScript) that emulates a supplier gestionale and the full **Slyce Virtual Printer** workflow in one installable app.

## Features
- Supplier management software with Italian labels.
- Manual creation of **Fattura** and **Bolla/DDT**.
- Random realistic document generation (single + batch).
- 5 distinct PDF layout templates.
- Internal software-only **Slyce Virtual Printer** pipeline (no OS printer driver).
- Slyce JSON conversion and local transmission simulation.
- Internal Slyce Inbox, transmission tracking, and chronological logs.
- Error simulation panel for demo scenarios.

## Project tree
```text
.
├── package.json
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tsconfig.electron.json
├── scripts/
│   └── check-structure.js
└── src/
    ├── main/
    │   ├── main.ts
    │   └── preload.ts
    ├── renderer/
    │   ├── App.tsx
    │   ├── main.tsx
    │   ├── styles.css
    │   └── vite-env.d.ts
    ├── modules/
    │   ├── storage.ts
    │   ├── documentGenerator.ts
    │   ├── pdf.ts
    │   ├── json.ts
    │   └── printer.ts
    └── shared/
        └── types.ts
```

## Architecture overview
- `src/main`: Electron main process + IPC handlers.
- `src/renderer`: React desktop UI.
- `src/modules`: domain and workflow modules:
  - local storage + seed data
  - random document generation
  - PDF rendering (5 templates)
  - Slyce JSON generation
  - virtual printer pipeline + logs/transmissions/inbox
- `src/shared`: shared TypeScript types.

## Local persistence
Saved under `app.getPath("userData")`:
- `app-data.json`
- `output/pdfs`
- `output/json`
- `output/transmissions`
- `output/logs`

## Seed/demo data included
- 5 suppliers
- 10 customers
- 20 products
- 5 layout templates (A-E)
- 5 pre-generated fatture + 5 pre-generated DDT

## Development
```bash
npm install
npm run dev
```

## Build and packaging
```bash
npm run build
npm run dist
npm run dist:mac
npm run dist:win
```

### Targets
- macOS `.dmg`
- Windows `.exe` via NSIS

## Structure verification
```bash
npm run check:structure
```

## Demo workflow
1. Create document manually in **Nuova Fattura** or **Nuova Bolla / DDT**.
2. Or generate random docs in **Generatore Documenti Casuali**.
3. Open **Archivio Documenti** and click **Stampa**.
4. Select `slyce` to run the internal virtual-printer pipeline.
5. Inspect outputs in:
   - **Trasmissioni**
   - **Slyce Inbox**
   - **Log di sistema**
6. Open generated PDF/JSON from archive/inbox actions.

## Error simulation
From **Pannello Simulazione**, choose:
- `success`
- `validation_error`
- `duplicate`
- `slow`
- `json_error`
- `pdf_error`
- `delivery_failure`
- `retry_success`

Then run a new print from **Archivio Documenti**.
