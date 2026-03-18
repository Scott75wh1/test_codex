const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { initDb } = require('./shared/db');
const { startBackendServer } = require('./backend/server');
const {
  addJob,
  getQueue,
  getLogs,
  processQueue,
  getSimulationSettings,
  setSimulationSettings,
  seedDemoData
} = require('./pipeline/virtualPrinter');

let backendServer;

async function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });

  await mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(async () => {
  await initDb();
  backendServer = await startBackendServer(3001);

  ipcMain.handle('create-document', async (_event, payload) => {
    const jobId = await addJob(payload);
    return { ok: true, jobId };
  });

  ipcMain.handle('get-queue', async () => getQueue());
  ipcMain.handle('get-logs', async () => getLogs());
  ipcMain.handle('process-queue', async () => {
    await processQueue();
    return { ok: true };
  });
  ipcMain.handle('get-inbox', async () => {
    const response = await fetch('http://localhost:3001/inbox');
    return response.json();
  });
  ipcMain.handle('get-simulation', async () => getSimulationSettings());
  ipcMain.handle('set-simulation', async (_event, payload) => {
    await setSimulationSettings(payload);
    return { ok: true };
  });
  ipcMain.handle('seed-demo', async () => {
    const count = await seedDemoData();
    return { ok: true, count };
  });

  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (backendServer) {
    backendServer.close();
  }
});
