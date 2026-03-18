const fs = require('node:fs');
const path = require('node:path');
const { getDb, run } = require('./db');

const logDir = path.join(process.cwd(), 'logs');
const logFile = path.join(logDir, 'slyce.log');

function ensureLogDir() {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
}

async function log(level, message, context = null) {
  const createdAt = new Date().toISOString();
  const contextText = context ? JSON.stringify(context) : null;

  ensureLogDir();
  fs.appendFileSync(logFile, `${createdAt} [${level}] ${message} ${contextText ?? ''}\n`);

  const db = getDb();
  await run(
    db,
    `INSERT INTO logs (level, message, context, created_at)
     VALUES (?, ?, ?, ?)`,
    [level, message, contextText, createdAt]
  );
  db.close();
}

module.exports = {
  log,
  logFile
};
