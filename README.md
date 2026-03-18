# Slyce Virtual Printer Lab

Standalone desktop simulator (Electron + React + TypeScript) that emulates a supplier gestionale and the full **Slyce Virtual Printer** pipeline in one installable app.

## What it simulates
- Supplier management software with Italian UI labels.
- Manual creation of **Fattura** and **Bolla/DDT**.
- Random realistic document generation with configurable options.
- 5 visually distinct PDF layouts.
- Internal software-only "Slyce Virtual Printer" pipeline.
- Slyce JSON conversion and local transmission simulation.
- Internal Slyce Inbox, transmissions, and chronological logs.
- Error scenarios via simulation panel.

## Architecture overview
- `src/main`: Electron main process and IPC.
- `src/renderer`: React UI and sections.
- `src/modules`: business modules (storage, random generator, pdf/json generation, virtual printer pipeline).
- `src/shared`: shared domain types.
- Local persistence at `app.getPath("userData")`:
  - `/output/pdfs`
  - `/output/json`
  - `/output/transmissions`
  - `/output/logs`
  - `app-data.json`

## Run in development
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
npm run dist
npm run dist:mac
npm run dist:win
```

## Installer targets
- macOS: `.dmg`
- Windows: `.exe` (NSIS)

## How to test manual document creation
1. Open **Nuova Fattura** or **Nuova Bolla / DDT**.
2. Select fornitore, cliente, layout, and fill line items.
3. Save document, then open **Archivio Documenti**.
4. Click **Stampa** and choose `slyce` in prompt.

## How to test random generation
1. Open **Generatore Documenti Casuali**.
2. Configure type/supplier/customer/layout/date-range/amount band.
3. Generate one or batch.
4. Verify results in **Archivio Documenti** and **Dashboard**.

## How to test Slyce Virtual Printer flow
1. Go to **Archivio Documenti**.
2. Click **Stampa** on a document and choose `slyce`.
3. Inspect output in:
   - **Trasmissioni**
   - **Slyce Inbox**
   - **Log di sistema**
4. Open generated PDF/JSON using related buttons.

## How to simulate errors
Use **Pannello Simulazione** and pick mode:
- `validation_error`
- `duplicate`
- `slow`
- `json_error`
- `pdf_error`
- `delivery_failure`
- `retry_success`

Then run a new print from **Archivio Documenti**.
