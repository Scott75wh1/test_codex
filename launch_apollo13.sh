#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/Users/cristian/Downloads/Apollo 13"

if [[ ! -d "$APP_DIR" ]]; then
  echo "❌ Cartella non trovata: $APP_DIR"
  echo "Aggiorna APP_DIR dentro launch_apollo13.sh se il percorso è diverso."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "❌ npm non trovato. Installa Node.js da https://nodejs.org"
  exit 1
fi

cd "$APP_DIR"

echo "🚀 Avvio Apollo 13 Simulator da: $APP_DIR"

if [[ ! -d node_modules ]]; then
  echo "📦 Dipendenze mancanti: eseguo npm install..."
  npm install
fi

echo "🌍 Apertura server di sviluppo su http://localhost:5188"
exec npm run dev:apollo
