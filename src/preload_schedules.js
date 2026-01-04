// preload_schedules.js
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  makeReservation: (arg) => ipcRenderer.invoke('schedules:reservation', arg),
});

