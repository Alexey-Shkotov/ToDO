const { contextBridge, ipcRenderer } = require('electron');

// Expose a persistent store API to the renderer (app.js)
// Works exactly like localStorage but stores data in %APPDATA%/witcher-journal/config.json
contextBridge.exposeInMainWorld('electronStore', {
    getItem: (key) => ipcRenderer.invoke('store-get', key),
    setItem: (key, value) => ipcRenderer.invoke('store-set', key, value),
    removeItem: (key) => ipcRenderer.invoke('store-delete', key),
});
