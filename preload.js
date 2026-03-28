/* ============================================================
   ToDo Planner — Preload (contextBridge)
   Exposes a safe window.api surface to the renderer.
   No logic here — pure channel forwarding.
   ============================================================ */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {

    // Tasks
    getTasks:    ()              => ipcRenderer.invoke('tasks:getAll'),
    addTask:     (task)          => ipcRenderer.invoke('tasks:add', task),
    updateTask:  (id, changes)   => ipcRenderer.invoke('tasks:update', id, changes),
    deleteTask:  (id)            => ipcRenderer.invoke('tasks:delete', id),

    // Player
    getPlayer:    ()     => ipcRenderer.invoke('player:get'),
    updatePlayer: (data) => ipcRenderer.invoke('player:update', data),

    // Settings
    getSetting:  (key)        => ipcRenderer.invoke('settings:get', key),
    setSetting:  (key, value) => ipcRenderer.invoke('settings:set', key, value),
    getAllSettings: ()         => ipcRenderer.invoke('settings:getAll'),

});
