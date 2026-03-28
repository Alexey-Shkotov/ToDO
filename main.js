/* ============================================================
   ToDo Planner — Electron Main Process
   ============================================================ */

const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path    = require('path');
const Database = require('better-sqlite3');

let db;
let mainWindow;

// ─── DATABASE INIT ────────────────────────────────────────
function initDB() {
    const dbPath = path.join(app.getPath('userData'), 'todo.db');
    db = new Database(dbPath);

    // WAL mode: faster writes, safer on crash
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    db.exec(`
        CREATE TABLE IF NOT EXISTS tasks (
            id          INTEGER PRIMARY KEY,
            title       TEXT    NOT NULL,
            notes       TEXT    DEFAULT '',
            priority    TEXT    DEFAULT 'medium',
            due         TEXT,
            completed   INTEGER DEFAULT 0,
            created_at  TEXT    NOT NULL,
            completed_at TEXT,
            xp_reward   INTEGER DEFAULT 50
        );

        CREATE TABLE IF NOT EXISTS player (
            id       INTEGER PRIMARY KEY CHECK (id = 1),
            level    INTEGER DEFAULT 1,
            xp       INTEGER DEFAULT 0,
            total_xp INTEGER DEFAULT 0
        );

        INSERT OR IGNORE INTO player (id, level, xp, total_xp) VALUES (1, 1, 0, 0);

        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        INSERT OR IGNORE INTO settings (key, value) VALUES ('names',      '["босс","Алексей Олегович"]');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('clockStyle', '"classic"');
    `);
}

// ─── IPC HANDLERS ────────────────────────────────────────
function setupIPC() {

    /* ── TASKS ── */

    ipcMain.handle('tasks:getAll', () => {
        return db.prepare('SELECT * FROM tasks ORDER BY id DESC').all();
    });

    ipcMain.handle('tasks:add', (_, task) => {
        db.prepare(`
            INSERT INTO tasks (id, title, notes, priority, due, completed, created_at, completed_at, xp_reward)
            VALUES (@id, @title, @notes, @priority, @due, @completed, @created_at, @completed_at, @xp_reward)
        `).run(task);
        return true;
    });

    ipcMain.handle('tasks:update', (_, id, changes) => {
        // Build SET clause dynamically from provided fields only
        const cols  = Object.keys(changes);
        const sets  = cols.map(c => `${c} = @${c}`).join(', ');
        db.prepare(`UPDATE tasks SET ${sets} WHERE id = @__id`)
          .run({ ...changes, __id: id });
        return true;
    });

    ipcMain.handle('tasks:delete', (_, id) => {
        db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
        return true;
    });

    /* ── PLAYER ── */

    ipcMain.handle('player:get', () => {
        return db.prepare('SELECT * FROM player WHERE id = 1').get();
    });

    ipcMain.handle('player:update', (_, data) => {
        db.prepare('UPDATE player SET level = @level, xp = @xp, total_xp = @total_xp WHERE id = 1')
          .run(data);
        return true;
    });

    /* ── SETTINGS ── */

    ipcMain.handle('settings:get', (_, key) => {
        const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
        return row ? JSON.parse(row.value) : null;
    });

    ipcMain.handle('settings:set', (_, key, value) => {
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
          .run(key, JSON.stringify(value));
        return true;
    });

    ipcMain.handle('settings:getAll', () => {
        const rows = db.prepare('SELECT key, value FROM settings').all();
        const out  = {};
        rows.forEach(r => { out[r.key] = JSON.parse(r.value); });
        return out;
    });
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
        show: false,   // show after ready-to-show to avoid white flash
        webPreferences: {
            preload:          path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration:  false,
            sandbox:          false,
        },
    });

    mainWindow.loadFile('index.html');

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Remove default menu bar
    Menu.setApplicationMenu(null);
}

// ─── APP LIFECYCLE ────────────────────────────────────────
app.whenReady().then(() => {
    initDB();
    setupIPC();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (db) db.close();
    if (process.platform !== 'darwin') app.quit();
});
