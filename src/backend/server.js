const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const { getDb, run, all } = require('../shared/db');
const { log } = require('../shared/logger');

function createBackendServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'slyce-backend' });
  });

  app.get('/inbox', async (_req, res) => {
    const db = getDb();
    const rows = await all(
      db,
      `SELECT id, source_job_id, customer_name, document_type, amount, notes, received_at, pdf_path
       FROM inbox
       ORDER BY id DESC`
    );
    db.close();
    res.json(rows);
  });

  app.post('/receive', async (req, res) => {
    const payload = req.body;

    if (!payload || !payload.document || !payload.pdfBase64) {
      res.status(400).json({ error: 'Missing document or pdfBase64' });
      return;
    }

    const inboxDir = path.join(process.cwd(), 'data', 'inbox');
    if (!fs.existsSync(inboxDir)) {
      fs.mkdirSync(inboxDir, { recursive: true });
    }

    const receivedAt = new Date().toISOString();
    const pdfFileName = `receipt_${Date.now()}_${payload.document.customerName.replace(/\s+/g, '_')}.pdf`;
    const pdfPath = path.join(inboxDir, pdfFileName);

    fs.writeFileSync(pdfPath, Buffer.from(payload.pdfBase64, 'base64'));

    const db = getDb();
    const result = await run(
      db,
      `INSERT INTO inbox (
        source_job_id, customer_name, document_type, amount, notes,
        received_at, json_payload, pdf_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.jobId ?? null,
        payload.document.customerName,
        payload.document.documentType,
        payload.document.amount,
        payload.document.notes || '',
        receivedAt,
        JSON.stringify(payload.document),
        pdfPath
      ]
    );
    db.close();

    await log('INFO', 'Document received by Slyce backend', {
      inboxId: result.lastID,
      sourceJobId: payload.jobId
    });

    res.json({ ok: true, inboxId: result.lastID, receivedAt });
  });

  return app;
}

async function startBackendServer(port = 3001) {
  const app = createBackendServer();

  return new Promise((resolve) => {
    const server = app.listen(port, async () => {
      await log('INFO', 'Backend server started', { port });
      resolve(server);
    });
  });
}

module.exports = {
  createBackendServer,
  startBackendServer
};
