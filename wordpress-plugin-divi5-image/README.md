# Divi 5 Image to Layout (MVP)

Plugin WordPress di esempio per trasformare uno screenshot in una **bozza** di layout Divi tramite AI.

## Cosa fa

- Pagina admin per inserire API key OpenAI.
- Endpoint REST che invia immagine al modello vision.
- Conversione JSON -> shortcode Divi (`et_pb_*`) per generare una base modificabile nel builder.

## Cosa NON fa (ancora)

- Non garantisce pixel-perfect 1:1.
- Non legge font/licenze esterne automaticamente.
- Non mappa tutti i moduli avanzati Divi 5.

## Installazione veloce

1. Copia la cartella `wordpress-plugin-divi5-image` in `wp-content/plugins/`.
2. Attiva il plugin dal pannello WordPress.
3. Vai in **Divi Image→Layout**.
4. Salva API key OpenAI.
5. Inserisci URL immagine/screenshot e genera shortcode.
6. Incolla shortcode in una pagina con Divi Builder e rifinisci.

## Roadmap suggerita

- Mappatura CSS semantica -> Design Tokens Divi.
- Segmentazione immagine in blocchi (hero, card grid, footer, ecc.).
- Riconoscimento responsive (desktop/tablet/mobile) con 3 screenshot.
- Output diretto in formato JSON nativo Divi 5 quando disponibile documentazione stabile.
