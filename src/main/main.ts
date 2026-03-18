import { app, BrowserWindow, ipcMain, shell } from 'electron';
import fs from 'fs';
import path from 'path';
import { generateRandomDocument } from '../modules/documentGenerator';
import { runPdfOnly, runVirtualPrinterPipeline } from '../modules/printer';
import { loadData, saveData, getDataPath } from '../modules/storage';
import { AppData, DocumentRecord } from '../shared/types';

let mainWindow: BrowserWindow | null = null;
let data: AppData;

const createWindow = async () => {
  const isDev = !app.isPackaged;
  const preloadPath = path.resolve(__dirname, 'preload.js');

  mainWindow = new BrowserWindow({
    width: 1450,
    height: 940,
    title: 'Slyce Virtual Printer Lab',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.webContents.on('did-fail-load', (_event, code, description, url) => {
    console.error('[Electron] did-fail-load', { code, description, url });
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[Electron] render-process-gone', details);
  });

  try {
    if (isDev) {
      const devUrl = 'http://localhost:5173';
      console.log('[Electron] DEV loadURL:', devUrl);
      await mainWindow.loadURL(devUrl);
      mainWindow.webContents.openDevTools({ mode: 'detach' });
      return;
    }

    const indexPath = path.resolve(__dirname, '../../dist/index.html');
    const exists = fs.existsSync(indexPath);
    console.log('[Electron] PROD loadFile:', indexPath, 'exists=', exists, 'preload=', preloadPath);

    if (!exists) {
      throw new Error(`Missing renderer entry: ${indexPath}`);
    }

    await mainWindow.loadFile(indexPath);
  } catch (error) {
    console.error('[Electron] Window load error', error);
  }
};

app.whenReady().then(() => {
  data = loadData();
  void createWindow();

  ipcMain.handle('state:get', () => data);
  ipcMain.handle('state:setSimulationMode', (_, mode) => {
    data.simulationMode = mode;
    saveData(data);
    return data.simulationMode;
  });
  ipcMain.handle('state:save', (_, nextData: AppData) => {
    data = nextData;
    saveData(data);
    return data;
  });

  ipcMain.handle('document:createManual', (_, doc: DocumentRecord) => {
    data.documents.unshift(doc);
    saveData(data);
    return doc;
  });

  ipcMain.handle('document:generateRandom', (_, options) => {
    const doc = generateRandomDocument(data, options);
    data.documents.unshift(doc);
    saveData(data);
    return doc;
  });

  ipcMain.handle('document:generateBatch', (_, options, count: number) => {
    const generated = Array.from({ length: count }).map(() => generateRandomDocument(data, options));
    data.documents.unshift(...generated);
    saveData(data);
    return generated;
  });

  ipcMain.handle('printer:run', async (_, docId: string) => {
    const result = await runVirtualPrinterPipeline(data, docId);
    saveData(data);
    return result;
  });

  ipcMain.handle('printer:pdfOnly', async (_, docId: string) => {
    const result = await runPdfOnly(data, docId);
    saveData(data);
    return result;
  });

  ipcMain.handle('file:open', (_, filePath: string) => shell.openPath(filePath));
  ipcMain.handle('paths:get', () => getDataPath());

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
