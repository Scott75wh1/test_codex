const { initDb } = require('../shared/db');
const { startBackendServer } = require('./server');

async function boot() {
  await initDb();
  await startBackendServer(3001);
}

boot();
