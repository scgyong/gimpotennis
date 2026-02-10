// preload_schedules.js
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  makeReservation: (arg) => ipcRenderer.invoke('schedules:reservation', arg),
  sendScheduleForDate: (ymd, scheduleData) => ipcRenderer.invoke('schedules:update-date', { ymd, scheduleData }),
  getCachedSchedules: () => ipcRenderer.invoke('schedules:get-cached'),
  getCacheStatus: () => ipcRenderer.invoke('schedules:cache-status'),
});

