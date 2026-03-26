const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store({ name: 'witcher-journal' });

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 820,
        minWidth: 900,
        minHeight: 600,
        title: "The Witcher's Journal",
        backgroundColor: '#0d0b08',
        frame: true,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    win.loadFile('index.html');
}

// IPC handlers for persistent storage
ipcMain.handle('store-get', (_event, key) => {
    return store.get(key, null);
});

ipcMain.handle('store-set', (_event, key, value) => {
    store.set(key, value);
});

ipcMain.handle('store-delete', (_event, key) => {
    store.delete(key);
});

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
