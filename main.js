/* ============================================================
   ToDo Planner — Electron Main Process
   Storage: JSON file in userData (no native compilation needed)
   ============================================================ */

const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs   = require('fs');

let dataPath;
let data;
let mainWindow;

// ─── DATA INIT ────────────────────────────────────────────
function initData() {
    dataPath = path.join(app.getPath('userData'), 'todo-data.json');

    try {
        data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    } catch {
        data = {};
    }

    // Ensure all top-level keys exist
    data.tasks    = data.tasks    || [];
    data.player   = Object.assign({ level: 1, xp: 0, total_xp: 0 }, data.player || {});
    data.settings = Object.assign(
        { names: ['босс', 'Алексей Олегович'], clockStyle: 'classic' },
        data.settings || {}
    );

    save();
}

function save() {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
}

// ─── IPC HANDLERS ─────────────────────────────────────────
function setupIPC() {

    /* ── TASKS ── */

    ipcMain.handle('tasks:getAll', () =>
        [...data.tasks].sort((a, b) => b.id - a.id)
    );

    ipcMain.handle('tasks:add', (_, task) => {
        data.tasks.push({
            id:           task.id,
            title:        task.title,
            notes:        task.notes        || '',
            priority:     task.priority,
            due:          task.due          || null,
            completed:    task.completed    || 0,
            created_at:   task.created_at,
            completed_at: task.completed_at || null,
            xp_reward:    task.xp_reward,
        });
        save();
        return true;
    });

    ipcMain.handle('tasks:update', (_, id, changes) => {
        const task = data.tasks.find(t => t.id === id);
        if (task) Object.assign(task, changes);
        save();
        return true;
    });

    ipcMain.handle('tasks:delete', (_, id) => {
        data.tasks = data.tasks.filter(t => t.id !== id);
        save();
        return true;
    });

    /* ── PLAYER ── */

    ipcMain.handle('player:get', () => data.player);

    ipcMain.handle('player:update', (_, playerData) => {
        Object.assign(data.player, playerData);
        save();
        return true;
    });

    /* ── SETTINGS ── */

    ipcMain.handle('settings:get', (_, key) =>
        data.settings[key] ?? null
    );

    ipcMain.handle('settings:set', (_, key, value) => {
        data.settings[key] = value;
        save();
        return true;
    });

    ipcMain.handle('settings:getAll', () => data.settings);
}

// ─── WINDOW ───────────────────────────────────────────────
function createWindow() {
    mainWindow = new BrowserWindow({
        width:     1280,
        height:    820,
        minWidth:  900,
        minHeight: 620,
        title:     'ToDo Planner',
        backgroundColor: '#ffffff',
        show: false,
        webPreferences: {
            preload:          path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration:  false,
            sandbox:          false,
        },
    });

    mainWindow.loadFile('index.html');
    mainWindow.once('ready-to-show', () => mainWindow.show());
    Menu.setApplicationMenu(null);
}

// ─── APP LIFECYCLE ────────────────────────────────────────
app.whenReady().then(() => {
    initData();
    setupIPC();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
