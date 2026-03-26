# Telex QR Manager

MVP backend + frontend per:

1. incollare un telex,
2. parsare i campi principali,
3. generare un QR code con JSON strutturato,
4. scannerizzare il QR da smartphone/browser e compilare i campi.

## Avvio

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Apri `http://localhost:5000`.

## API

### `POST /api/generate-qr`

Body JSON:

```json
{
  "telex": "...contenuto telex..."
}
```

Risposta:
- `parsed_telex`: JSON con campi estratti.
- `qr_data`: JSON serializzato dentro il QR.
- `qr_image_base64`: PNG del QR in base64.
