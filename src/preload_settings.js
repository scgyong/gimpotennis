// preload_settings.js
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('settingsAPI', {
  getMenuTime: () => ipcRenderer.invoke('menu_time'),
  load: () => ipcRenderer.invoke('settings:load'),
  save: (payload) => ipcRenderer.invoke('settings:save', payload),
  close: () => ipcRenderer.send('settings:close')
});

