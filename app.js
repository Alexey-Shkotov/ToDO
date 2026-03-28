/* ============================================================
   ToDo Planner — Renderer Process (app.js)
   State lives in memory; every mutation syncs to SQLite via IPC.
   ============================================================ */

// ─── IN-MEMORY STATE ──────────────────────────────────────
let state = {
    tasks:    [],
    player:   { level: 1, xp: 0, totalXp: 0 },
    settings: { names: ['босс', 'Алексей Олегович'], clockStyle: 'classic' },
    calView:  null,
};

// ─── XP CONFIG ────────────────────────────────────────────
const XP_VALUES = { low: 25, medium: 50, high: 100 };
function xpForLevel(lvl) { return 100 + (lvl - 1) * 50; }

// ─── GREETINGS ────────────────────────────────────────────
const GREETINGS = {
    morning: [
        'Доброе утро, {n}! Чем займёмся сегодня?',
        'С добрым утром, {n}! Новый день — новые победы.',
        'Привет, {n}! Готовы покорять задачи?',
        'Доброе утро, {n}! Продуктивного вам дня.',
        'Рад видеть тебя, {n}! Начнём с лучшего?',
    ],
    afternoon: [
        'Добрый день, {n}! Задачи не ждут.',
        'Добрый день, {n}! Как идёт день?',
        'Привет, {n}! Время действовать.',
        'Здравствуй, {n}! Списки не вычёркивают себя сами.',
        'Добрый день, {n}! Продолжаем покорять?',
    ],
    evening: [
        'Добрый вечер, {n}! Остался последний рывок.',
        'Добрый вечер, {n}! Финишная прямая.',
        'Вечер добрый, {n}! Завершаем начатое?',
        'Добрый вечер, {n}! Ещё немного — и цель достигнута.',
        'Приветствую, {n}! Вечер — лучшее время для итогов.',
    ],
    night: [
        'Доброй ночи, {n}! Планируете задачи на завтра?',
        'Тихой ночи, {n}! Самое время для планирования.',
        'Доброй ночи, {n}! Завтра будет продуктивный день.',
        'Ночной планировщик, {n}? Отличная привычка!',
        'Доброй ночи, {n}! Завтра всё получится.',
    ],
};

function pickGreeting() {
    const h      = new Date().getHours();
    const period = h >= 5 && h < 12 ? 'morning'
                 : h >= 12 && h < 17 ? 'afternoon'
                 : h >= 17 && h < 22 ? 'evening'
                 : 'night';
    const msgs   = GREETINGS[period];
    const msg    = msgs[Math.floor(Math.random() * msgs.length)];
    const names  = state.settings.names;
    const name   = names.length ? names[Math.floor(Math.random() * names.length)] : 'друг';
    return msg.replace('{n}', name);
}

// ─── DB LOAD ──────────────────────────────────────────────
// Converts DB snake_case row → JS camelCase task object
function normalizeTask(row) {
    return {
        id:          row.id,
        title:       row.title,
        notes:       row.notes  || '',
        priority:    row.priority,
        due:         row.due    || null,
        completed:   row.completed === 1,
        createdAt:   row.created_at,
        completedAt: row.completed_at || null,
        xpReward:    row.xp_reward,
    };
}

async function loadState() {
    const [tasks, player, settings] = await Promise.all([
        window.api.getTasks(),
        window.api.getPlayer(),
        window.api.getAllSettings(),
    ]);

    state.tasks  = tasks.map(normalizeTask);
    state.player = {
        level:   player.level,
        xp:      player.xp,
        totalXp: player.total_xp,
    };
    state.settings = {
        names:      Array.isArray(settings.names)      ? settings.names      : ['босс', 'Алексей Олегович'],
        clockStyle: typeof settings.clockStyle === 'string' ? settings.clockStyle : 'classic',
    };
}

// ─── DATE HELPERS ─────────────────────────────────────────
const MONTHS_RU     = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const MONTHS_RU_GEN = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const DOW_SHORT     = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

function todayStr() { return new Date().toISOString().slice(0, 10); }

function isoDate(y, m, d) {
    return new Date(y, m, d).toISOString().slice(0, 10);
}

function escHtml(s) {
    const el = document.createElement('div');
    el.textContent = s;
    return el.innerHTML;
}

// ─── CLOCK ────────────────────────────────────────────────
function tickClock() {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    document.getElementById('clock').textContent =
        `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function applyClockStyle() {
    document.getElementById('clock').classList.toggle('glow', state.settings.clockStyle === 'glow');
}

// ─── GREETING ─────────────────────────────────────────────
let currentGreeting  = '';
let greetingLastHour = -1;

function refreshGreeting() {
    const h = new Date().getHours();
    if (!currentGreeting || h !== greetingLastHour) {
        currentGreeting  = pickGreeting();
        greetingLastHour = h;
    }
    document.getElementById('greeting').textContent = currentGreeting;
}

// ─── CALENDAR ─────────────────────────────────────────────
let selectedDate = todayStr();

function renderCalendar() {
    const { year, month } = state.calView;
    const t = todayStr();

    document.getElementById('calTitle').textContent = `${MONTHS_RU[month]} ${year}`;

    const grid = document.getElementById('calGrid');
    grid.innerHTML = '';

    DOW_SHORT.forEach(d => {
        const el = document.createElement('div');
        el.className = 'cal-dow';
        el.textContent = d;
        grid.appendChild(el);
    });

    const firstWd   = (new Date(year, month, 1).getDay() + 6) % 7;
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevTotal = new Date(year, month, 0).getDate();

    for (let i = firstWd - 1; i >= 0; i--)
        appendCalDay(grid, prevTotal - i, isoDate(year, month - 1, prevTotal - i), true, t);

    for (let d = 1; d <= totalDays; d++)
        appendCalDay(grid, d, isoDate(year, month, d), false, t);

    const filled   = firstWd + totalDays;
    const trailing = (7 - (filled % 7)) % 7;
    for (let d = 1; d <= trailing; d++)
        appendCalDay(grid, d, isoDate(year, month + 1, d), true, t);
}

function appendCalDay(grid, dayNum, dateStr, otherMonth, t) {
    const cell = document.createElement('div');
    cell.className = 'cal-day'
        + (otherMonth            ? ' other-month' : '')
        + (dateStr === t         ? ' today'        : '')
        + (dateStr === selectedDate && dateStr !== t ? ' selected' : '');
    cell.dataset.date = dateStr;

    const numEl = document.createElement('div');
    numEl.className  = 'cal-day-num';
    numEl.textContent = dayNum;
    cell.appendChild(numEl);

    const dayTasks = state.tasks.filter(tk => tk.due === dateStr);
    const MAX = 2;
    dayTasks.slice(0, MAX).forEach(tk => {
        const chip = document.createElement('div');
        chip.className  = 'cal-chip ' + tk.priority + (tk.completed ? ' done' : '');
        chip.textContent = tk.title;
        chip.dataset.tid = tk.id;
        cell.appendChild(chip);
    });
    if (dayTasks.length > MAX) {
        const more = document.createElement('div');
        more.className  = 'cal-more';
        more.textContent = `+${dayTasks.length - MAX} ещё`;
        cell.appendChild(more);
    }

    grid.appendChild(cell);
}

// ─── TODAY PANEL ──────────────────────────────────────────
function renderToday() {
    const t      = todayStr();
    const [y, m, d] = t.split('-');
    document.getElementById('todayDate').textContent =
        `${parseInt(d)} ${MONTHS_RU_GEN[parseInt(m) - 1]} ${y}`;

    const tasks = state.tasks.filter(tk =>
        tk.due === t || (!tk.due && !tk.completed)
    );

    const pOrd = { high: 0, medium: 1, low: 2 };
    tasks.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return (pOrd[a.priority] ?? 1) - (pOrd[b.priority] ?? 1);
    });

    const incomplete = tasks.filter(t => !t.completed).length;
    const countEl = document.getElementById('todayCount');
    countEl.textContent   = incomplete > 0 ? incomplete : '';
    countEl.style.display = incomplete > 0 ? '' : 'none';

    const container = document.getElementById('todayTasks');
    container.innerHTML = '';

    if (tasks.length === 0) {
        container.innerHTML = `
            <div class="today-empty">
                <div class="today-empty-icon">✦</div>
                <div class="today-empty-text">Задач на сегодня нет.<br>Добавьте первую!</div>
            </div>`;
        return;
    }

    tasks.forEach(tk => {
        const card = document.createElement('div');
        card.className  = `today-card ${tk.priority}${tk.completed ? ' done' : ''}`;
        card.dataset.id = tk.id;

        card.innerHTML = `
            <button class="task-cb" data-id="${tk.id}">${tk.completed ? '✓' : ''}</button>
            <div class="task-info">
                <div class="task-title-txt">${escHtml(tk.title)}</div>
                ${tk.notes ? `<div class="task-notes-txt">${escHtml(tk.notes)}</div>` : ''}
            </div>
            <span class="task-xp-badge">+${tk.xpReward} XP</span>
            <button class="task-del-btn" data-id="${tk.id}">✕</button>
        `;

        container.appendChild(card);
    });
}

// ─── XP BAR ───────────────────────────────────────────────
function updateXpBar() {
    const { level, xp } = state.player;
    const max = xpForLevel(level);
    const pct = Math.min(100, (xp / max) * 100);
    document.getElementById('xpFill').style.width    = pct + '%';
    document.getElementById('xpLevel').textContent   = level;
    document.getElementById('xpNumbers').textContent = `${xp} / ${max} XP`;
}

async function gainXp(amount) {
    state.player.xp     += amount;
    state.player.totalXp += amount;

    const max = xpForLevel(state.player.level);
    let leveledUp = false;
    if (state.player.xp >= max) {
        state.player.xp -= max;
        state.player.level++;
        leveledUp = true;
    }

    await window.api.updatePlayer({
        level:    state.player.level,
        xp:       state.player.xp,
        total_xp: state.player.totalXp,
    });

    updateXpBar();

    if (leveledUp) {
        setTimeout(() => showLevelUp(state.player.level), 400);
    }
}

// ─── PARTICLES ────────────────────────────────────────────
const canvas = document.getElementById('particleCanvas');
const ctx    = canvas.getContext('2d');
let   particles = [];
let   rafId     = null;

function resizeCanvas() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

class Particle {
    constructor(sx, sy, tx, ty) {
        this.x  = sx; this.y  = sy;
        this.tx = tx; this.ty = ty;

        const ang  = Math.random() * Math.PI * 2;
        const dist = 18 + Math.random() * 25;
        this.bx = sx + Math.cos(ang) * dist;
        this.by = sy + Math.sin(ang) * dist;

        this.size   = 5 + Math.random() * 7;
        this.alpha  = 1;
        this.rot    = Math.random() * Math.PI * 2;
        this.rotSpd = (Math.random() - 0.5) * 0.18;
        this.phase  = 'burst';
        this.prog   = 0;
        this.spd    = 0.025 + Math.random() * 0.025;
        this.color  = Math.random() > 0.45 ? '#e8420a'
                    : Math.random() > 0.5  ? '#ff7043'
                    : '#ffa07a';
        this.shape  = Math.random() > 0.45 ? 'star4'
                    : Math.random() > 0.5  ? 'diamond'
                    : 'dot';
    }

    update() {
        this.rot  += this.rotSpd;
        this.size *= 0.978;

        if (this.phase === 'burst') {
            this.x = lerp(this.x, this.bx, 0.18);
            this.y = lerp(this.y, this.by, 0.18);
            this.prog += 0.09;
            if (this.prog >= 1) { this.phase = 'fly'; this.prog = 0; }
        } else {
            this.prog += this.spd;
            this.x = lerp(this.x, this.tx, this.spd * 2.5);
            this.y = lerp(this.y, this.ty, this.spd * 2.5);
            this.alpha = Math.max(0, 1 - this.prog);
        }
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle   = this.color;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rot);

        if      (this.shape === 'star4')   drawStar4(this.size * 0.5);
        else if (this.shape === 'diamond') drawDiamond(this.size * 0.45);
        else {
            ctx.beginPath();
            ctx.arc(0, 0, this.size * 0.28, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    isDead() { return this.phase === 'fly' && this.prog >= 1; }
}

function lerp(a, b, t) { return a + (b - a) * t; }

function drawStar4(r) {
    const inner = r * 0.28;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
        const oa = (i * Math.PI / 2) - Math.PI / 4;
        const ia = oa + Math.PI / 4;
        if (i === 0) ctx.moveTo(Math.cos(oa) * r, Math.sin(oa) * r);
        else         ctx.lineTo(Math.cos(oa) * r, Math.sin(oa) * r);
        ctx.lineTo(Math.cos(ia) * inner, Math.sin(ia) * inner);
    }
    ctx.closePath();
    ctx.fill();
}

function drawDiamond(r) {
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.58, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.58, 0);
    ctx.closePath();
    ctx.fill();
}

function spawnParticles(srcX, srcY) {
    const xpTrack = document.getElementById('xpTrack');
    const rect    = xpTrack.getBoundingClientRect();
    const pct     = state.player.xp / xpForLevel(state.player.level);
    const tx = rect.left + pct * rect.width;
    const ty = rect.top  + rect.height / 2;

    const count = 14 + Math.floor(Math.random() * 8);
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(srcX, srcY, tx, ty));
    }
    if (!rafId) loopParticles();
}

function loopParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter(p => !p.isDead());
    particles.forEach(p => { p.update(); p.draw(); });
    rafId = particles.length > 0 ? requestAnimationFrame(loopParticles) : null;
}

// ─── TASK CRUD ────────────────────────────────────────────
let editTaskId = null;

function openTaskModal(date) {
    editTaskId = null;
    document.getElementById('taskModalTitle').textContent = 'Новая задача';
    document.getElementById('taskTitleInput').value       = '';
    document.getElementById('taskNotesInput').value       = '';
    document.getElementById('taskDateInput').value        = date || todayStr();
    document.getElementById('taskPriorityInput').value    = 'medium';
    document.getElementById('saveTaskBtn').textContent    = 'Добавить';
    document.getElementById('taskModal').hidden = false;
    setTimeout(() => document.getElementById('taskTitleInput').focus(), 60);
}

function closeTaskModal() {
    document.getElementById('taskModal').hidden = true;
}

async function saveTask() {
    const titleEl = document.getElementById('taskTitleInput');
    const title   = titleEl.value.trim();

    if (!title) {
        titleEl.classList.add('error');
        titleEl.focus();
        setTimeout(() => titleEl.classList.remove('error'), 900);
        return;
    }

    const due      = document.getElementById('taskDateInput').value     || null;
    const priority = document.getElementById('taskPriorityInput').value;
    const notes    = document.getElementById('taskNotesInput').value.trim();

    if (editTaskId) {
        const tk = state.tasks.find(t => t.id === editTaskId);
        if (tk) {
            Object.assign(tk, { title, due, priority, notes, xpReward: XP_VALUES[priority] });
            await window.api.updateTask(editTaskId, {
                title, notes, priority,
                due:       due || null,
                xp_reward: XP_VALUES[priority],
            });
        }
    } else {
        const now  = new Date().toISOString();
        const task = {
            id:          Date.now(),
            title, notes, priority, due,
            completed:   false,
            createdAt:   now,
            completedAt: null,
            xpReward:    XP_VALUES[priority],
        };
        state.tasks.unshift(task);
        await window.api.addTask({
            id:           task.id,
            title, notes, priority,
            due:          due || null,
            completed:    0,
            created_at:   now,
            completed_at: null,
            xp_reward:    task.xpReward,
        });
    }

    closeTaskModal();
    renderCalendar();
    renderToday();
}

async function completeTask(id) {
    const tk = state.tasks.find(t => t.id === id);
    if (!tk || tk.completed) return;

    // Capture position BEFORE DOM re-render
    const cardEl = document.querySelector(`.today-card[data-id="${id}"]`);
    let sx = window.innerWidth / 2, sy = window.innerHeight / 2;
    if (cardEl) {
        const cbEl = cardEl.querySelector('.task-cb');
        const r    = (cbEl || cardEl).getBoundingClientRect();
        sx = r.left + r.width  / 2;
        sy = r.top  + r.height / 2;
    }

    const completedAt = new Date().toISOString();
    tk.completed   = true;
    tk.completedAt = completedAt;

    await window.api.updateTask(id, { completed: 1, completed_at: completedAt });

    renderToday();
    renderCalendar();

    spawnParticles(sx, sy);
    setTimeout(() => gainXp(tk.xpReward), 550);
}

async function deleteTask(id) {
    state.tasks = state.tasks.filter(t => t.id !== id);
    await window.api.deleteTask(id);
    renderCalendar();
    renderToday();
}

// ─── LEVEL UP MODAL ───────────────────────────────────────
const LEVEL_FLAVORS = [
    'Отличная работа! Продолжайте в том же духе.',
    'Вы становитесь лучше с каждым днём.',
    'Новые высоты покоряются упорным.',
    'Продуктивность — ваш главный актив.',
    'Каждая задача — шаг вперёд.',
    'Дисциплина — это свобода.',
    'Систематичность побеждает мотивацию.',
];

function showLevelUp(level) {
    document.getElementById('luNum').textContent    = level;
    document.getElementById('luFlavor').textContent = LEVEL_FLAVORS[(level - 2) % LEVEL_FLAVORS.length];
    document.getElementById('levelUpModal').hidden  = false;
}

// ─── SETTINGS ─────────────────────────────────────────────
function openSettings() {
    renderNames();
    document.getElementById('settingsModal').hidden = false;
}

function closeSettings() {
    document.getElementById('settingsModal').hidden = true;
}

function renderNames() {
    const list = document.getElementById('namesList');
    list.innerHTML = '';
    state.settings.names.forEach((name, i) => {
        const chip = document.createElement('div');
        chip.className = 'name-chip';
        chip.innerHTML = `<span>${escHtml(name)}</span>
            <button class="name-chip-rm" data-i="${i}">✕</button>`;
        list.appendChild(chip);
    });
}

async function addName() {
    const inp  = document.getElementById('newNameInput');
    const name = inp.value.trim();
    if (!name || state.settings.names.includes(name)) { inp.focus(); return; }

    state.settings.names.push(name);
    await window.api.setSetting('names', state.settings.names);

    renderNames();
    currentGreeting = '';
    refreshGreeting();
    inp.value = '';
    inp.focus();
}

async function removeName(i) {
    state.settings.names.splice(i, 1);
    await window.api.setSetting('names', state.settings.names);

    renderNames();
    currentGreeting = '';
    refreshGreeting();
}

// ─── FULLSCREEN ───────────────────────────────────────────
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
    } else {
        document.exitFullscreen().catch(() => {});
    }
}

// ─── EVENT BINDING ────────────────────────────────────────
function bindEvents() {

    // Clock style toggle
    document.getElementById('clockToggle').addEventListener('click', async () => {
        state.settings.clockStyle = state.settings.clockStyle === 'classic' ? 'glow' : 'classic';
        await window.api.setSetting('clockStyle', state.settings.clockStyle);
        applyClockStyle();
    });

    // Fullscreen
    document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);

    // Settings
    document.getElementById('settingsBtn').addEventListener('click', openSettings);
    document.getElementById('closeSettings').addEventListener('click', closeSettings);
    document.getElementById('settingsModal').addEventListener('click', e => {
        if (e.target === e.currentTarget) closeSettings();
    });

    document.getElementById('addNameBtn').addEventListener('click', addName);
    document.getElementById('newNameInput').addEventListener('keydown', e => {
        if (e.key === 'Enter') addName();
    });
    document.getElementById('namesList').addEventListener('click', e => {
        const btn = e.target.closest('.name-chip-rm');
        if (btn) removeName(parseInt(btn.dataset.i));
    });

    // Calendar navigation
    document.getElementById('calPrev').addEventListener('click', () => {
        let { year, month } = state.calView;
        if (--month < 0) { month = 11; year--; }
        state.calView = { year, month };
        renderCalendar();
    });

    document.getElementById('calNext').addEventListener('click', () => {
        let { year, month } = state.calView;
        if (++month > 11) { month = 0; year++; }
        state.calView = { year, month };
        renderCalendar();
    });

    // Calendar grid click
    document.getElementById('calGrid').addEventListener('click', e => {
        const chip = e.target.closest('.cal-chip');
        if (chip) {
            e.stopPropagation();
            const id = parseInt(chip.dataset.tid);
            const tk = state.tasks.find(t => t.id === id);
            if (tk && !tk.completed) completeTask(id);
            return;
        }
        const day = e.target.closest('.cal-day');
        if (day) {
            selectedDate = day.dataset.date;
            openTaskModal(selectedDate);
        }
    });

    // Today panel
    document.getElementById('addTodayBtn').addEventListener('click', () => {
        openTaskModal(todayStr());
    });

    document.getElementById('todayTasks').addEventListener('click', e => {
        const cb  = e.target.closest('.task-cb');
        const del = e.target.closest('.task-del-btn');
        if (cb)  completeTask(parseInt(cb.dataset.id));
        if (del) deleteTask(parseInt(del.dataset.id));
    });

    // Task modal
    document.getElementById('closeTaskModal').addEventListener('click', closeTaskModal);
    document.getElementById('taskModal').addEventListener('click', e => {
        if (e.target === e.currentTarget) closeTaskModal();
    });
    document.getElementById('saveTaskBtn').addEventListener('click', saveTask);
    document.getElementById('taskTitleInput').addEventListener('keydown', e => {
        if (e.key === 'Enter')  saveTask();
        if (e.key === 'Escape') closeTaskModal();
    });

    // Level up
    document.getElementById('luClose').addEventListener('click', () => {
        document.getElementById('levelUpModal').hidden = true;
    });
    document.getElementById('levelUpModal').addEventListener('click', e => {
        if (e.target === e.currentTarget) document.getElementById('levelUpModal').hidden = true;
    });
}

// ─── INIT ─────────────────────────────────────────────────
async function init() {
    await loadState();

    const now = new Date();
    state.calView = { year: now.getFullYear(), month: now.getMonth() };

    applyClockStyle();
    refreshGreeting();
    updateXpBar();
    renderCalendar();
    renderToday();
    bindEvents();

    tickClock();
    setInterval(tickClock, 1000);
    setInterval(refreshGreeting, 60_000);
}

document.addEventListener('DOMContentLoaded', () => {
    init().catch(err => {
        console.error('Init failed:', err);
        document.body.innerHTML = `<div style="padding:2rem;color:#e8420a;font-family:Inter,sans-serif">
            <h2>Ошибка запуска</h2><pre>${err.message}</pre>
        </div>`;
    });
});
