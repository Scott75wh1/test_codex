const telexInput = document.getElementById("telexInput");
const generateBtn = document.getElementById("generateBtn");
const statusEl = document.getElementById("status");
const qrImage = document.getElementById("qrImage");
const bookingRef = document.getElementById("bookingRef");
const telexDate = document.getElementById("telexDate");
const phoneNumber = document.getElementById("phoneNumber");
const passengers = document.getElementById("passengers");
const flights = document.getElementById("flights");
const services = document.getElementById("services");
const video = document.getElementById("video");
const startScanBtn = document.getElementById("startScanBtn");
const scanStatus = document.getElementById("scanStatus");

function fillFields(data) {
  bookingRef.value = data.booking_ref || "";
  telexDate.value = data.date || "";
  phoneNumber.value = data.phone_number || "";
  passengers.textContent = JSON.stringify(data.passengers || [], null, 2);
  flights.textContent = JSON.stringify(data.flights || [], null, 2);
  services.textContent = JSON.stringify(data.services || [], null, 2);
}

generateBtn.addEventListener("click", async () => {
  statusEl.textContent = "Generazione in corso...";
  const res = await fetch("/api/generate-qr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ telex: telexInput.value }),
  });

  const data = await res.json();
  if (!res.ok) {
    statusEl.textContent = data.error || "Errore sconosciuto";
    return;
  }

  qrImage.src = `data:image/png;base64,${data.qr_image_base64}`;
  fillFields(data.parsed_telex);
  statusEl.textContent = "QR generato con successo.";
});

async function startScanner() {
  if (!("BarcodeDetector" in window)) {
    scanStatus.textContent = "BarcodeDetector non supportato su questo browser.";
    return;
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" },
    audio: false,
  });

  video.srcObject = stream;
  const detector = new BarcodeDetector({ formats: ["qr_code"] });

  const tick = async () => {
    try {
      const codes = await detector.detect(video);
      if (codes.length > 0) {
        const rawValue = codes[0].rawValue;
        const parsed = JSON.parse(rawValue);
        fillFields(parsed);
        scanStatus.textContent = "QR letto con successo.";
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
    } catch (err) {
      scanStatus.textContent = `Errore scanner: ${err.message}`;
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

startScanBtn.addEventListener("click", () => {
  scanStatus.textContent = "Scanner avviato...";
  startScanner();
});
