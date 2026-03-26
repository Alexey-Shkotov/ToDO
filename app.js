/* ============================================================
   THE WITCHER'S JOURNAL — App Logic
   ============================================================ */
 
// ─── STATE ───────────────────────────────────────────────
const DEFAULT_STATE = {
    player: {
        name: 'Witcher',
        level: 1,
        xp: 0,
        totalXp: 0,
        streak: 0,
        lastCompletedDate: null,
    },
    tasks: [],
    unlockedAchievements: [],
    achievementQueue: [],
    weatherDate: null,
    weatherIndex: null,
    bountyDate: null,
    bountyType: null,
};
 
let state = JSON.parse(JSON.stringify(DEFAULT_STATE));
 
let filters = { status: 'active', type: 'all' };
 
// ─── CONSTANTS ───────────────────────────────────────────
const XP_VALUES = { errand: 25, quest: 50, contract: 100 };
 
const LEVEL_TITLES = [
    [1,  2,  'Apprentice'],
    [3,  5,  'Trial Survivor'],
    [6,  10, 'Witcher'],
    [11, 15, 'Journeyman'],
    [16, 20, 'Senior Witcher'],
    [21, 30, 'Veteran'],
    [31, 40, 'Master Witcher'],
    [41, 49, 'Grand Master'],
    [50, Infinity, 'Legend of the Continent'],
];
 
const LEVEL_FLAVORS = [
    "Every contract completed makes a Witcher stronger.",
    "The path of the Witcher is paved with completed tasks.",
    "Your medallion vibrates with newfound power.",
    "The trials have not broken you. They have shaped you.",
    "Silver for humans, steel for monsters — and discipline for yourself.",
    "Even the White Wolf began with small contracts.",
    "The Continent whispers your name.",
    "Your deeds echo in every corner of the known world.",
    "Not many reach this height. You are a legend in the making.",
    "Fortune favors those who keep their word and their schedule.",
];
 
const WEATHER = [
    { emoji: '☀',  desc: 'Clear skies above the Continent',            bonus: 1.0,  type: null       },
    { emoji: '🌫', desc: 'Fog rolls in from the eastern swamps',        bonus: 1.15, type: 'quest'    },
    { emoji: '⛈',  desc: 'Storm approaches from the mountains',         bonus: 1.20, type: 'contract' },
    { emoji: '🌤', desc: 'A mild day for wandering and small errands',   bonus: 1.15, type: 'errand'   },
    { emoji: '🌕', desc: 'The full moon rises — magic stirs tonight',    bonus: 1.25, type: 'all'      },
    { emoji: '❄',  desc: "Winter bites down from Skellige's shores",    bonus: 1.10, type: 'contract' },
    { emoji: '🌙', desc: 'A dark and mysterious night falls',            bonus: 1.10, type: 'quest'    },
];
 
const BOUNTY_TYPES = [
    { type: 'contract', desc: 'The coin purses are heavy — Contracts are highly sought today!' },
    { type: 'quest',    desc: 'Quest-givers grow generous — Quests reward double today!' },
    { type: 'errand',   desc: 'Even small deeds are valued — Errands pay double today!' },
];
 
const ACHIEVEMENTS = [
    {
        id: 'first_blood', icon: '🗡', name: 'First Blood',
        desc: 'Complete your first task.',
        check: s => completedCount(s) >= 1,
    },
    {
        id: 'hunter', icon: '🏹', name: 'On the Hunt',
        desc: 'Complete 10 tasks.',
        check: s => completedCount(s) >= 10,
    },
    {
        id: 'slayer', icon: '⚔', name: 'Monster Slayer',
        desc: 'Complete 50 tasks.',
        check: s => completedCount(s) >= 50,
    },
    {
        id: 'contract_done', icon: '📜', name: 'Contract Fulfilled',
        desc: 'Complete a Contract task.',
        check: s => completedOfType(s, 'contract') >= 1,
    },
    {
        id: 'contractor', icon: '🏰', name: 'Master Contractor',
        desc: 'Complete 10 Contracts.',
        check: s => completedOfType(s, 'contract') >= 10,
    },
    {
        id: 'streak3', icon: '🔥', name: 'Streak of Luck',
        desc: 'Maintain a 3-day completion streak.',
        check: s => s.player.streak >= 3,
    },
    {
        id: 'streak7', icon: '💪', name: 'Iron Will',
        desc: 'Maintain a 7-day completion streak.',
        check: s => s.player.streak >= 7,
    },
    {
        id: 'level5', icon: '⭐', name: 'Witcher',
        desc: 'Reach level 5.',
        check: s => s.player.level >= 5,
    },
    {
        id: 'level10', icon: '🐺', name: 'The White Wolf',
        desc: 'Reach level 10.',
        check: s => s.player.level >= 10,
    },
    {
        id: 'level25', icon: '👑', name: 'Legend',
        desc: 'Reach level 25 — a true legend of the Continent.',
        check: s => s.player.level >= 25,
    },
];
 
// ─── HELPERS ─────────────────────────────────────────────
function completedCount(s) {
    return s.tasks.filter(t => t.completed).length;
}
 
function completedOfType(s, type) {
    return s.tasks.filter(t => t.completed && t.type === type).length;
}
 
function getLevelTitle(level) {
    for (const [min, max, title] of LEVEL_TITLES) {
        if (level >= min && level <= max) return title;
    }
    return 'Legend of the Continent';
}
 
function xpToNextLevel(level) {
    return 100 + (level - 1) * 50;
}
 
function today() {
    return new Date().toISOString().slice(0, 10);
}
 
/** Deterministic daily pick: hashes date string + offset to an array index */
function dailyPick(arr, offset) {
    const d = today();
    let h = offset | 0;
    for (let i = 0; i < d.length; i++) {
        h = Math.imul(h ^ d.charCodeAt(i), 0x9e3779b9);
        h ^= h >>> 16;
    }
    return Math.abs(h) % arr.length;
}
 
function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}
 
function formatDateDisplay(iso) {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}
 
function formatDateTime(iso) {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
 
// ─── PERSISTENCE ─────────────────────────────────────────
function loadState() {
    try {
        const raw = localStorage.getItem('witcherJournal_v2');
        if (raw) state = Object.assign(JSON.parse(JSON.stringify(DEFAULT_STATE)), JSON.parse(raw));
    } catch (_) { /* start fresh */ }
}
 
function saveState() {
    try {
        localStorage.setItem('witcherJournal_v2', JSON.stringify(state));
    } catch (_) { /* ignore */ }
}
 
// ─── DAILY SYSTEMS ───────────────────────────────────────
function refreshDailyValues() {
    const t = today();
 
    if (state.weatherDate !== t) {
        state.weatherIndex = dailyPick(WEATHER, 1);
        state.weatherDate  = t;
    }
 
    if (state.bountyDate !== t) {
        state.bountyType = BOUNTY_TYPES[dailyPick(BOUNTY_TYPES, 7)].type;
        state.bountyDate = t;
    }
 
    saveState();
}
 
function currentWeather() {
    return WEATHER[state.weatherIndex ?? 0];
}
 
function xpMultiplier(taskType) {
    let mult = 1;
    const w = currentWeather();
 
    // Weather bonus
    if (w.type === 'all' || w.type === taskType) mult *= w.bonus;
 
    // Daily bounty: 2× for the chosen type
    if (state.bountyType === taskType) mult *= 2;
 
    return mult;
}
 
// ─── STREAK ──────────────────────────────────────────────
function checkStreak() {
    const last = state.player.lastCompletedDate;
    if (!last) return;
 
    const diffMs   = new Date(today()) - new Date(last);
    const diffDays = Math.round(diffMs / 86400000);
 
    if (diffDays > 1) {
        state.player.streak = 0;
        saveState();
    }
}
 
// ─── TASK MANAGEMENT ─────────────────────────────────────
function addTask() {
    const titleEl = document.getElementById('taskTitle');
    const title   = titleEl.value.trim();
 
    if (!title) {
        titleEl.style.borderColor = 'rgba(224,80,80,0.7)';
        titleEl.focus();
        setTimeout(() => (titleEl.style.borderColor = ''), 900);
        return;
    }
 
    const task = {
        id:          Date.now(),
        title,
        notes:       document.getElementById('taskNotes').value.trim(),
        type:        document.getElementById('taskType').value,
        due:         document.getElementById('taskDue').value || null,
        completed:   false,
        createdAt:   new Date().toISOString(),
        completedAt: null,
        xpReward:    XP_VALUES[document.getElementById('taskType').value],
    };
 
    state.tasks.unshift(task);
    saveState();
 
    // Reset form
    titleEl.value = '';
    document.getElementById('taskNotes').value = '';
    document.getElementById('taskDue').value   = '';
    document.getElementById('taskType').value  = 'quest';
 
    renderTasks();
}
 
function completeTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task || task.completed) return;
 
    task.completed   = true;
    task.completedAt = new Date().toISOString();
 
    // Update streak
    const t = today();
    if (state.player.lastCompletedDate !== t) {
        const last     = state.player.lastCompletedDate;
        const diffDays = last ? Math.round((new Date(t) - new Date(last)) / 86400000) : 0;
        state.player.streak         = (diffDays === 1) ? state.player.streak + 1 : 1;
        state.player.lastCompletedDate = t;
    }
 
    saveState();
 
    const mult    = xpMultiplier(task.type);
    const xpGain  = Math.round(task.xpReward * mult);
    const isBonusTask = mult > 1;
 
    // Floating XP label
    showXpFloat(xpGain, isBonusTask);
 
    // Slight delay so the float is visible before level-up modal
    setTimeout(() => {
        gainXP(xpGain);
        checkAchievements();
        renderAll();
    }, 250);
 
    renderTasks();
}
 
function deleteTask(id) {
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveState();
    renderTasks();
}
 
// ─── XP & LEVELING ───────────────────────────────────────
function gainXP(amount) {
    state.player.xp      += amount;
    state.player.totalXp += amount;
 
    let leveled = false;
    while (state.player.xp >= xpToNextLevel(state.player.level)) {
        state.player.xp    -= xpToNextLevel(state.player.level);
        state.player.level += 1;
        leveled = true;
    }
 
    saveState();
 
    if (leveled) {
        // Small delay so achievement check runs first if any
        setTimeout(() => showLevelUpModal(state.player.level), 350);
    }
 
    updateCharPanel();
}
 
// ─── ACHIEVEMENTS ────────────────────────────────────────
function checkAchievements() {
    let newUnlock = false;
 
    for (const ach of ACHIEVEMENTS) {
        if (!state.unlockedAchievements.includes(ach.id) && ach.check(state)) {
            state.unlockedAchievements.push(ach.id);
            state.achievementQueue.push(ach.id);
            newUnlock = true;
        }
    }
 
    if (newUnlock) {
        saveState();
        renderTrophies();
        dequeueAchievement();
    }
}
 
function dequeueAchievement() {
    if (state.achievementQueue.length === 0) return;
    const id  = state.achievementQueue[0];
    const ach = ACHIEVEMENTS.find(a => a.id === id);
    if (ach) setTimeout(() => showAchievementModal(ach), 600);
}
 
// ─── RENDERING ───────────────────────────────────────────
function renderAll() {
    updateCharPanel();
    renderTasks();
    renderTrophies();
    renderWeather();
    renderBounty();
}
 
function updateCharPanel() {
    const p   = state.player;
    const max = xpToNextLevel(p.level);
    const pct = Math.min(100, (p.xp / max) * 100);
 
    document.getElementById('medLevel').textContent  = p.level;
    document.getElementById('charName').textContent  = p.name;
    document.getElementById('charRank').textContent  = getLevelTitle(p.level);
    document.getElementById('xpNums').textContent    = `${p.xp.toLocaleString()} / ${max.toLocaleString()}`;
    document.getElementById('xpFill').style.width    = pct + '%';
 
    document.getElementById('sTasksSlain').textContent = completedCount(state);
    document.getElementById('sContracts').textContent  = completedOfType(state, 'contract');
    document.getElementById('sQuests').textContent     = completedOfType(state, 'quest');
    document.getElementById('sStreak').textContent     = p.streak + ' day' + (p.streak !== 1 ? 's' : '');
    document.getElementById('sTotalXP').textContent    = p.totalXp.toLocaleString();
}
 
function renderTasks() {
    const container = document.getElementById('tasksContainer');
    const emptyEl   = document.getElementById('emptyBoard');
 
    let tasks = [...state.tasks];
 
    if (filters.status === 'active')    tasks = tasks.filter(t => !t.completed);
    if (filters.status === 'completed') tasks = tasks.filter(t =>  t.completed);
    if (filters.type !== 'all')         tasks = tasks.filter(t => t.type === filters.type);
 
    tasks.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return b.id - a.id;
    });
 
    // Remove existing cards only
    container.querySelectorAll('.task-card').forEach(el => el.remove());
 
    if (tasks.length === 0) {
        emptyEl.hidden = false;
        return;
    }
    emptyEl.hidden = true;
 
    const t = today();
 
    tasks.forEach(task => {
        const mult        = xpMultiplier(task.type);
        const effectiveXP = Math.round(task.xpReward * mult);
        const hasBonus    = mult > 1;
        const isOverdue   = task.due && !task.completed && task.due < t;
 
        const typeLabel = { contract: 'Contract', quest: 'Quest', errand: 'Errand' }[task.type];
 
        const card = document.createElement('div');
        card.className = `task-card type-${task.type}${task.completed ? ' completed' : ''}`;
 
        card.innerHTML = `
            <button class="task-check" data-id="${task.id}" title="${task.completed ? 'Completed' : 'Mark complete'}">
                ${task.completed ? '✓' : ''}
            </button>
            <div class="task-content">
                <div class="task-type-label">${typeLabel}</div>
                <div class="task-header">
                    <span class="task-title">${escapeHtml(task.title)}</span>
                    <span class="task-xp-badge">${effectiveXP} XP${hasBonus ? ' ✦' : ''}</span>
                </div>
                ${task.notes ? `<div class="task-notes">${escapeHtml(task.notes)}</div>` : ''}
                <div class="task-footer">
                    ${task.due && !task.completed
                        ? `<span class="task-due${isOverdue ? ' overdue' : ''}">${isOverdue ? '⚠ Overdue: ' : '📅 '}${formatDateDisplay(task.due)}</span>`
                        : ''}
                    ${task.completed && task.completedAt
                        ? `<span class="task-done-at">✓ Completed ${formatDateTime(task.completedAt)}</span>`
                        : ''}
                </div>
            </div>
            <div class="task-actions">
                <button class="btn-delete" data-id="${task.id}" title="Delete">✕</button>
            </div>
        `;
 
        container.appendChild(card);
    });
}
 
function renderTrophies() {
    const grid = document.getElementById('trophiesGrid');
    grid.innerHTML = '';
 
    ACHIEVEMENTS.forEach(ach => {
        const unlocked = state.unlockedAchievements.includes(ach.id);
        const el = document.createElement('div');
        el.className = 'trophy-item' + (unlocked ? '' : ' locked');
        el.dataset.tip = ach.name;
        el.title = unlocked ? `${ach.name}: ${ach.desc}` : '???';
        el.textContent = ach.icon;
        grid.appendChild(el);
    });
}
 
function renderWeather() {
    const w = currentWeather();
    document.getElementById('weatherEmoji').textContent = w.emoji;
    let desc = w.desc;
    if (w.bonus > 1) {
        const typeStr = w.type === 'all' ? 'all tasks' : w.type + 's';
        desc += ` — +${Math.round((w.bonus - 1) * 100)}% XP for ${typeStr}`;
    }
    document.getElementById('weatherDesc').textContent = desc;
}
 
function renderBounty() {
    const bounty = BOUNTY_TYPES.find(b => b.type === state.bountyType);
    if (!bounty) return;
    document.getElementById('bountyDesc').textContent  = bounty.desc;
    const label = bounty.type.charAt(0).toUpperCase() + bounty.type.slice(1) + 's';
    document.getElementById('bountyBonus').textContent = `✦ ×2 XP for ${label} today ✦`;
}
 
// ─── MODALS ───────────────────────────────────────────────
function showLevelUpModal(level) {
    const flavor = LEVEL_FLAVORS[(level - 2) % LEVEL_FLAVORS.length];
    document.getElementById('luLevel').textContent = level;
    document.getElementById('luRank').textContent  = getLevelTitle(level);
    document.getElementById('luFlavor').textContent = `"${flavor}"`;
    document.getElementById('levelUpOverlay').hidden = false;
}
 
function showAchievementModal(ach) {
    document.getElementById('achIcon').textContent = ach.icon;
    document.getElementById('achName').textContent = ach.name;
    document.getElementById('achDesc').textContent = ach.desc;
    document.getElementById('achievOverlay').hidden = false;
}
 
function closeLevelUp() {
    document.getElementById('levelUpOverlay').hidden = true;
    dequeueAchievement();
}
 
function closeAchievement() {
    document.getElementById('achievOverlay').hidden = true;
    state.achievementQueue.shift();
    saveState();
    dequeueAchievement();
}
 
// ─── XP FLOAT ANIMATION ───────────────────────────────────
function showXpFloat(amount, bonus) {
    const el = document.createElement('div');
    el.className = 'xp-float';
    el.textContent = `+${amount} XP${bonus ? ' ✦' : ''}`;
    el.style.left  = (30 + Math.random() * 35) + 'vw';
    el.style.top   = (35 + Math.random() * 20) + 'vh';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1700);
}
 
// ─── NAME EDITING ────────────────────────────────────────
function editName() {
    const current = state.player.name;
    const input   = document.createElement('input');
    input.type        = 'text';
    input.value       = current;
    input.maxLength   = 24;
    input.className   = 'form-input';
    input.style.cssText = 'width:100%;text-align:center;font-family:Cinzel,serif;font-size:0.9rem;padding:0.3rem;margin-top:0.1rem;';
 
    const nameEl = document.getElementById('charName');
    nameEl.replaceWith(input);
    input.focus();
    input.select();
 
    function commit() {
        const val = input.value.trim() || current;
        state.player.name = val;
        saveState();
        const newEl = document.createElement('div');
        newEl.id = 'charName';
        newEl.className = 'char-name';
        newEl.title = 'Double-click to rename';
        newEl.textContent = val;
        newEl.ondblclick = editName;
        input.replaceWith(newEl);
    }
 
    input.addEventListener('blur',    commit);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); if (e.key === 'Escape') { input.value = current; input.blur(); } });
}
 
// ─── EVENT BINDING ───────────────────────────────────────
function bindEvents() {
    document.getElementById('btnPost').addEventListener('click', addTask);
 
    document.getElementById('taskTitle').addEventListener('keydown', e => {
        if (e.key === 'Enter') addTask();
    });
 
    document.getElementById('luClose').addEventListener('click',  closeLevelUp);
    document.getElementById('achClose').addEventListener('click', closeAchievement);
 
    document.getElementById('levelUpOverlay').addEventListener('click', e => {
        if (e.target === e.currentTarget) closeLevelUp();
    });
    document.getElementById('achievOverlay').addEventListener('click', e => {
        if (e.target === e.currentTarget) closeAchievement();
    });
 
    // Filter buttons — status
    document.getElementById('statusFilters').addEventListener('click', e => {
        const btn = e.target.closest('.flt');
        if (!btn) return;
        filters.status = btn.dataset.status;
        document.querySelectorAll('#statusFilters .flt').forEach(b => b.classList.toggle('active', b === btn));
        renderTasks();
    });
 
    // Filter buttons — type
    document.getElementById('typeFilters').addEventListener('click', e => {
        const btn = e.target.closest('.flt');
        if (!btn) return;
        filters.type = btn.dataset.type;
        document.querySelectorAll('#typeFilters .flt').forEach(b => b.classList.toggle('active', b === btn));
        renderTasks();
    });
 
    // Task actions (delegated)
    document.getElementById('tasksContainer').addEventListener('click', e => {
        const checkBtn  = e.target.closest('.task-check');
        const deleteBtn = e.target.closest('.btn-delete');
 
        if (checkBtn)  completeTask(Number(checkBtn.dataset.id));
        if (deleteBtn) deleteTask(Number(deleteBtn.dataset.id));
    });
}
 
// ─── INIT ────────────────────────────────────────────────
function init() {
    loadState();
    checkStreak();
    refreshDailyValues();
    renderAll();
    bindEvents();
}
 
document.addEventListener('DOMContentLoaded', init);
