import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { generateRandomDocument } from '../modules/documentGenerator';
import { runVirtualPrinterPipeline } from '../modules/printer';
import { loadData, saveData, getDataPath } from '../modules/storage';
import { AppData, DocumentRecord } from '../shared/types';

let mainWindow: BrowserWindow | null = null;
let data: AppData;

const createWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 1450,
    height: 940,
    title: 'Slyce Virtual Printer Lab',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (!app.isPackaged) {
    await mainWindow.loadURL('http://localhost:5173');
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
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

  ipcMain.handle('file:open', (_, filePath: string) => shell.openPath(filePath));
  ipcMain.handle('paths:get', () => getDataPath());

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
