# Telex QR Manager

MVP backend + frontend per:

1. incollare un telex,
2. parsare i campi principali,
3. generare un QR code con JSON strutturato,
4. scannerizzare il QR da smartphone/browser e compilare i campi.

## Requisiti

- Python 3.11+ (consigliato)
- Browser moderno (Chrome consigliato per scanner via `BarcodeDetector`)

## Avvio rapido (locale)

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Poi apri nel browser:

- `http://localhost:5000`

## Come testarlo (backend)

### 1) Test automatici

```bash
python -m pytest -q
```

### 2) Test API manuale con `curl`

```bash
curl -X POST http://localhost:5000/api/generate-qr \
  -H "Content-Type: application/json" \
  -d '{"telex":"FROM HOTELTURIST SPA - BAOBAB\nTO LOVE EGYPT TOURS\nMarch, 26, 2026\nBOOKING REF 2026/TB/111458\nNO 7928 VRN 12/04/26 08:15 - SSH 12/04/26 12:05\nMR.NEZZO GIORDANO (02/07/1947)\nPhone number : 3358203771"}'
```

Dovresti ricevere JSON con:

- `parsed_telex`
- `qr_data`
- `qr_image_base64`

## Come visualizzare il frontend

1. Avvia il server (`python app.py`).
2. Apri `http://localhost:5000`.
3. Incolla il telex nel box a sinistra.
4. Clicca **Genera QR**.
5. Vedrai:
   - immagine QR,
   - campi già compilati dal parser.

## Come testare lo scanner QR da smartphone

### Opzione A (stesso PC con webcam)

- Clicca **Avvia scanner** direttamente dalla pagina.
- Consenti accesso alla camera quando richiesto.

### Opzione B (smartphone sulla stessa rete Wi‑Fi)

1. Trova IP locale del PC (esempio `192.168.1.50`).
2. Avvia Flask in bind su tutte le interfacce (già impostato in `app.py`):
   - `python app.py`
3. Apri dal telefono:
   - `http://192.168.1.50:5000`
4. Premi **Avvia scanner** e inquadra il QR.

> Nota: su alcuni browser i permessi camera richiedono `https` (oppure `localhost`).

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
