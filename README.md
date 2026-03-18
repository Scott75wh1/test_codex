# Slyce Virtual Printer Demo (Electron + Express + SQLite)

A founder-ready local prototype that validates the Slyce virtual printer concept end-to-end:

- Supplier desktop app (Electron)
- Document creation form
- Simulated virtual printer pipeline
- PDF + JSON generation
- Express receiver backend
- Slyce inbox viewer
- Local logging and queue tracking
- Simulation controls with error modes

## Quick start

```bash
npm install
npm start
```

The Electron app starts the local backend receiver automatically on `http://localhost:3001`.

## What the demo does

1. User fills form in supplier desktop app.
2. Job enters local SQLite queue.
3. Pipeline generates PDF + JSON artifacts in `data/outbox`.
4. Job transmits to local Express backend.
5. Backend stores received payload in SQLite inbox + writes PDF in `data/inbox`.
6. UI shows queue status, inbox entries, and logs.

## Refinement features included

- UI polish with dashboard cards and tables
- Demo seed data button
- Simulation control panel (latency + error mode)
- Transmission status tracking per job
- Print queue with retry via new jobs / manual run button
- Error simulation modes: `none`, `network`, `pdf`, `random`

## Data and logs

- SQLite DB: `data/slyce_demo.sqlite`
- Outbox files: `data/outbox`
- Receiver inbox files: `data/inbox`
- Log file: `logs/slyce.log`

## Optional scripts

```bash
npm run start:backend
npm run seed
```

Use `npm run start:backend` only if you want backend without Electron.
