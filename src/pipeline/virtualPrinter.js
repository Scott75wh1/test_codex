const fs = require('node:fs');
const path = require('node:path');
const PDFDocument = require('pdfkit');
const { getDb, run, all, get } = require('../shared/db');
const { log } = require('../shared/logger');

let processing = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getSimulationSettings() {
  const db = getDb();
  const row = await get(db, 'SELECT latency_ms, failure_mode FROM simulation_settings WHERE id = 1');
  db.close();
  return row;
}

async function setSimulationSettings({ latencyMs, failureMode }) {
  const db = getDb();
  await run(
    db,
    `UPDATE simulation_settings
     SET latency_ms = ?, failure_mode = ?
     WHERE id = 1`,
    [latencyMs, failureMode]
  );
  db.close();

  await log('INFO', 'Simulation settings updated', { latencyMs, failureMode });
}

async function addJob({ customerName, documentType, amount, notes }) {
  const now = new Date().toISOString();
  const db = getDb();
  const result = await run(
    db,
    `INSERT INTO jobs (
      customer_name, document_type, amount, notes,
      status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'queued', ?, ?)`,
    [customerName, documentType, amount, notes || '', now, now]
  );
  db.close();

  await log('INFO', 'Job added to print queue', { jobId: result.lastID, customerName, documentType });
  processQueue();
  return result.lastID;
}

async function updateJobStatus(jobId, status, fields = {}) {
  const db = getDb();
  const now = new Date().toISOString();
  await run(
    db,
    `UPDATE jobs SET
      status = ?,
      error_message = ?,
      pdf_path = COALESCE(?, pdf_path),
      json_path = COALESCE(?, json_path),
      remote_receipt_id = COALESCE(?, remote_receipt_id),
      updated_at = ?
     WHERE id = ?`,
    [
      status,
      fields.errorMessage || null,
      fields.pdfPath || null,
      fields.jsonPath || null,
      fields.remoteReceiptId || null,
      now,
      jobId
    ]
  );
  db.close();
}

function shouldFail(mode) {
  if (mode === 'random') {
    return Math.random() < 0.35;
  }
  return false;
}

async function generatePdf(job, outDir) {
  const pdfPath = path.join(outDir, `job_${job.id}.pdf`);
  const doc = new PDFDocument();
  const stream = fs.createWriteStream(pdfPath);

  const done = new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  doc.pipe(stream);
  doc.fontSize(20).text('Slyce Supplier Print Job', { underline: true });
  doc.moveDown();
  doc.fontSize(12).text(`Job ID: ${job.id}`);
  doc.text(`Customer: ${job.customer_name}`);
  doc.text(`Document Type: ${job.document_type}`);
  doc.text(`Amount: $${Number(job.amount).toFixed(2)}`);
  doc.text(`Notes: ${job.notes || '-'}`);
  doc.text(`Created At: ${job.created_at}`);
  doc.end();

  await done;
  return pdfPath;
}

async function processOneJob(job) {
  const settings = await getSimulationSettings();
  const outDir = path.join(process.cwd(), 'data', 'outbox');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  await updateJobStatus(job.id, 'processing');
  await log('INFO', 'Processing started', { jobId: job.id });
  await sleep(settings.latency_ms);

  if (settings.failure_mode === 'pdf' || shouldFail(settings.failure_mode)) {
    throw new Error('Simulated PDF generation failure');
  }

  const pdfPath = await generatePdf(job, outDir);
  await updateJobStatus(job.id, 'pdf_created', { pdfPath });
  await sleep(settings.latency_ms);

  const document = {
    jobId: job.id,
    customerName: job.customer_name,
    documentType: job.document_type,
    amount: Number(job.amount),
    notes: job.notes,
    generatedAt: new Date().toISOString()
  };

  const jsonPath = path.join(outDir, `job_${job.id}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(document, null, 2));
  await updateJobStatus(job.id, 'json_created', { jsonPath });
  await sleep(settings.latency_ms);

  if (settings.failure_mode === 'network' || shouldFail(settings.failure_mode)) {
    throw new Error('Simulated network transmission failure');
  }

  const pdfBase64 = fs.readFileSync(pdfPath).toString('base64');
  const response = await fetch('http://localhost:3001/receive', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jobId: job.id,
      document,
      pdfBase64
    })
  });

  if (!response.ok) {
    throw new Error(`Backend rejected payload: ${response.status}`);
  }

  const payload = await response.json();
  await updateJobStatus(job.id, 'completed', { remoteReceiptId: payload.inboxId, pdfPath, jsonPath });
  await log('INFO', 'Processing completed', { jobId: job.id, inboxId: payload.inboxId });
}

async function processQueue() {
  if (processing) {
    return;
  }

  processing = true;
  try {
    while (true) {
      const db = getDb();
      const nextJob = await get(
        db,
        `SELECT * FROM jobs
         WHERE status = 'queued'
         ORDER BY id ASC
         LIMIT 1`
      );
      db.close();

      if (!nextJob) {
        break;
      }

      try {
        await processOneJob(nextJob);
      } catch (error) {
        await updateJobStatus(nextJob.id, 'failed', { errorMessage: error.message });
        await log('ERROR', 'Processing failed', { jobId: nextJob.id, reason: error.message });
      }
    }
  } finally {
    processing = false;
  }
}

async function getQueue() {
  const db = getDb();
  const jobs = await all(
    db,
    `SELECT id, customer_name, document_type, amount, status, error_message, updated_at, remote_receipt_id
     FROM jobs
     ORDER BY id DESC
     LIMIT 100`
  );
  db.close();
  return jobs;
}

async function getLogs() {
  const db = getDb();
  const rows = await all(
    db,
    `SELECT id, level, message, context, created_at
     FROM logs
     ORDER BY id DESC
     LIMIT 200`
  );
  db.close();
  return rows;
}

async function seedDemoData() {
  const samples = [
    { customerName: 'Acme Logistics', documentType: 'Invoice', amount: 342.1, notes: 'Demo seed order #1' },
    { customerName: 'Northstar Retail', documentType: 'Shipping Label', amount: 18.99, notes: 'Priority handling' },
    { customerName: 'Blue Harbor Co', documentType: 'Invoice', amount: 1940.0, notes: 'Net 30 terms' }
  ];

  for (const sample of samples) {
    await addJob(sample);
  }

  return samples.length;
}

module.exports = {
  addJob,
  processQueue,
  getQueue,
  getLogs,
  getSimulationSettings,
  setSimulationSettings,
  seedDemoData
};
