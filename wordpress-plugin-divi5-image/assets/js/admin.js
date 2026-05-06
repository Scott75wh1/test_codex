(function () {
  const generateBtn = document.getElementById('di2d5_generate');
  const imageField = document.getElementById('di2d5_image');
  const outputField = document.getElementById('di2d5_output');
  const statusField = document.getElementById('di2d5_status');

  if (!generateBtn || !imageField || !outputField || !statusField || !window.di2d5Config) {
    return;
  }

  generateBtn.addEventListener('click', async function () {
    const image = imageField.value.trim();
    if (!image) {
      statusField.textContent = 'Inserisci un URL o un data URL immagine.';
      return;
    }

    generateBtn.disabled = true;
    statusField.textContent = 'Generazione in corso...';

    try {
      const response = await fetch(window.di2d5Config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': window.di2d5Config.nonce,
        },
        body: JSON.stringify({ image }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Errore durante la generazione.');
      }

      outputField.value = data.shortcode || '';
      statusField.textContent = data.message || 'Completato.';
    } catch (error) {
      statusField.textContent = error.message;
    } finally {
      generateBtn.disabled = false;
    }
  });
})();
