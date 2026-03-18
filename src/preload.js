const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('slyceApi', {
  createDocument: (payload) => ipcRenderer.invoke('create-document', payload),
  getQueue: () => ipcRenderer.invoke('get-queue'),
  getLogs: () => ipcRenderer.invoke('get-logs'),
  processQueue: () => ipcRenderer.invoke('process-queue'),
  getInbox: () => ipcRenderer.invoke('get-inbox'),
  getSimulation: () => ipcRenderer.invoke('get-simulation'),
  setSimulation: (payload) => ipcRenderer.invoke('set-simulation', payload),
  seedDemo: () => ipcRenderer.invoke('seed-demo')
});
