const fs = require('node:fs');
const path = require('node:path');
const sqlite3 = require('sqlite3').verbose();

const dataDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'slyce_demo.sqlite');

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function getDb() {
  ensureDataDir();
  return new sqlite3.Database(dbPath);
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this);
    });
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

async function initDb() {
  const db = getDb();

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      document_type TEXT NOT NULL,
      amount REAL NOT NULL,
      notes TEXT,
      status TEXT NOT NULL,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      pdf_path TEXT,
      json_path TEXT,
      remote_receipt_id INTEGER
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      context TEXT,
      created_at TEXT NOT NULL
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS inbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_job_id INTEGER,
      customer_name TEXT NOT NULL,
      document_type TEXT NOT NULL,
      amount REAL NOT NULL,
      notes TEXT,
      received_at TEXT NOT NULL,
      json_payload TEXT NOT NULL,
      pdf_path TEXT
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS simulation_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      latency_ms INTEGER NOT NULL DEFAULT 800,
      failure_mode TEXT NOT NULL DEFAULT 'none'
    )`
  );

  await run(
    db,
    `INSERT OR IGNORE INTO simulation_settings (id, latency_ms, failure_mode)
     VALUES (1, 800, 'none')`
  );

  db.close();
}

module.exports = {
  dbPath,
  getDb,
  run,
  all,
  get,
  initDb
};
