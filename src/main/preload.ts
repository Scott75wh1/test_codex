import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  getState: () => ipcRenderer.invoke('state:get'),
  saveState: (payload: unknown) => ipcRenderer.invoke('state:save', payload),
  setSimulationMode: (mode: string) => ipcRenderer.invoke('state:setSimulationMode', mode),
  createManualDocument: (doc: unknown) => ipcRenderer.invoke('document:createManual', doc),
  generateRandomDocument: (options: unknown) => ipcRenderer.invoke('document:generateRandom', options),
  generateBatchDocuments: (options: unknown, count: number) => ipcRenderer.invoke('document:generateBatch', options, count),
  runPrinter: (docId: string) => ipcRenderer.invoke('printer:run', docId),
  openFile: (filePath: string) => ipcRenderer.invoke('file:open', filePath),
  getPaths: () => ipcRenderer.invoke('paths:get')
});
