const SAMPLE_TELEX = `FROM HOTELTURIST SPA - BAOBAB
Backoffice Baobab
TO   LOVE EGYPT TOURS

March, 26, 2026

BOOKING REF 2026/TB/111458

Flights:                   departure                 arrival
NO  7928   VRN    12/04/26 08:15 - SSH    12/04/26 12:05
NO  7929   SSH    19/04/26 13:10 - VRN    20/04/26 17:40
MR.NEZZO GIORDANO (02/07/1947)
Phone number : 3358203771
MR.SANTER HEDWIG (10/03/1952)

Transfer from Aerporto to Steigenber ger Alcazar
Steigenberger Alcazar Resort
Transfer from Steigenberger Alcazar to Aerport`;

const telexInput = document.getElementById("telexInput");
const loadDemoBtn = document.getElementById("loadDemoBtn");
const generateBtn = document.getElementById("generateBtn");
const downloadQrBtn = document.getElementById("downloadQrBtn");
const statusEl = document.getElementById("status");
const qrImage = document.getElementById("qrImage");
const qrPayload = document.getElementById("qrPayload");

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

loadDemoBtn.addEventListener("click", () => {
  telexInput.value = SAMPLE_TELEX;
  statusEl.textContent = "Telex demo caricato. Premi 'Genera QR'.";
});

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
  qrPayload.textContent = data.qr_data;
  fillFields(data.parsed_telex);
  statusEl.textContent = "QR generato con successo.";
});

downloadQrBtn.addEventListener("click", () => {
  if (!qrImage.src) {
    statusEl.textContent = "Genera prima un QR.";
    return;
  }
  const a = document.createElement("a");
  a.href = qrImage.src;
  a.download = "telex-qr.png";
  a.click();
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
        qrPayload.textContent = rawValue;
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

window.addEventListener("DOMContentLoaded", () => {
  telexInput.value = SAMPLE_TELEX;
});
