/* Steven Workout PWA — localStorage logger */
(function () {
  'use strict';

  const STORAGE = {
    history: 'sw_history_v1',
    active: 'sw_active_v1',
    settings: 'sw_settings_v1',
    lastSets: 'sw_last_sets_v1'
  };

  const FOCUS = {
    A: { name: 'Push', cls: 'push' },
    B: { name: 'Pull', cls: 'pull' },
    C: { name: 'Legs', cls: 'legs' },
    D: { name: 'Full-body', cls: 'fullbody' }
  };

  /** @typedef {{ name: string, sets: number, reps: string, note?: string, optional?: boolean, sides?: boolean, circuit?: boolean, duration?: string }} Exercise */

  /** @type {Record<string, { label: string, exercises: Exercise[] }>} */
  const PROGRAM = {
    'A-full': {
      label: 'Day A Push · FULL',
      exercises: [
        { name: 'Barbell bench press', sets: 3, reps: '6–8' },
        { name: 'OHP (rack)', sets: 3, reps: '6–8' },
        { name: 'Incline DB press', sets: 3, reps: '8–10' },
        { name: 'Landmine press', sets: 3, reps: '8–10/side', sides: true },
        { name: 'Cable laterals', sets: 3, reps: '12–15' },
        { name: 'Dips', sets: 3, reps: '6–10', note: 'Band OK' },
        { name: 'Cable pushdowns', sets: 3, reps: '10–12' }
      ]
    },
    'A-short': {
      label: 'Day A Push · SHORT',
      exercises: [
        { name: 'Bench or incline DB', sets: 3, reps: '8–10' },
        { name: 'OHP or landmine', sets: 3, reps: '8–10' },
        { name: 'Laterals', sets: 2, reps: '12–15' },
        { name: 'Dips or pushdowns', sets: 2, reps: '8–12' },
        { name: 'Incline treadmill', sets: 1, reps: '5 min', optional: true, duration: '5 min' }
      ]
    },
    'B-full': {
      label: 'Day B Pull · FULL',
      exercises: [
        { name: 'Band-assisted pull-ups (or lat pulldown)', sets: 3, reps: '6–10', note: 'Unitree PUMP lat pulldown OK; add slow negatives when ready' },
        { name: 'Barbell row', sets: 3, reps: '6–8' },
        { name: 'Single-arm cable row', sets: 3, reps: '8–10/side', sides: true },
        { name: 'Face pulls', sets: 3, reps: '12–15' },
        { name: 'Preacher curls', sets: 3, reps: '10–12' },
        { name: 'Band pull-aparts', sets: 2, reps: '15–20' }
      ]
    },
    'B-short': {
      label: 'Day B Pull · SHORT',
      exercises: [
        { name: 'Band-assisted pull-ups / lat pulldown', sets: 3, reps: 'AMRAP (stop shy)', note: 'Stop ~2 RIR' },
        { name: 'DB or landmine row', sets: 3, reps: '8–10' },
        { name: 'Face pulls', sets: 2, reps: '12–15' },
        { name: 'Curls', sets: 2, reps: '10–12' }
      ]
    },
    'C-full': {
      label: 'Day C Legs · FULL',
      exercises: [
        { name: 'Back squat', sets: 3, reps: '6–8' },
        { name: 'RDL', sets: 3, reps: '8–10' },
        { name: 'Bulgarian split squat', sets: 3, reps: '8–10/leg', sides: true },
        { name: 'Nordics', sets: 3, reps: '5–8' },
        { name: 'Calves', sets: 3, reps: '12–15' },
        { name: 'KB swings', sets: 3, reps: '15', optional: true, note: 'Optional — kettlebell as written only' }
      ]
    },
    'C-short': {
      label: 'Day C Legs · SHORT',
      exercises: [
        { name: 'Goblet or front squat', sets: 3, reps: '8–10' },
        { name: 'RDL', sets: 3, reps: '8–10' },
        { name: 'Split squat / lunges', sets: 2, reps: '8/leg', sides: true },
        { name: 'Nordics OR KB swings', sets: 2, reps: '5–6 / 15', note: 'Nordics 2×5–6 or KB swings 2×15' }
      ]
    },
    'D-full': {
      label: 'Day D Full · FULL',
      exercises: [
        { name: 'Light–mod deadlift or landmine squat', sets: 3, reps: '6–8' },
        { name: 'Incline press', sets: 3, reps: '8–10' },
        { name: 'Band-assisted pull-ups or cable row', sets: 3, reps: '8–10' },
        { name: 'Hip thrust', sets: 3, reps: '8–12' },
        { name: 'Core pallof or med-ball', sets: 3, reps: '10–12' },
        { name: 'Cardio finisher', sets: 1, reps: '10–15 min', note: 'Rower / walk / bike', duration: '10–15 min' }
      ]
    },
    'D-short': {
      label: 'Day D Full · SHORT circuit',
      exercises: [
        { name: 'KB goblet squat', sets: 4, reps: '10', note: 'Circuit ×3–4 rounds', circuit: true },
        { name: 'Push-ups or incline DB', sets: 4, reps: '10', circuit: true },
        { name: 'Band / cable row', sets: 4, reps: '12', circuit: true },
        { name: 'Jump rope or med-ball slams', sets: 4, reps: '30–45s', circuit: true, duration: '30–45s' },
        { name: 'StretchTrainer cool-down', sets: 1, reps: 'optional', optional: true }
      ]
    }
  };

  // Year 2026 implied by "Today's date: Thursday Sep 24, 2026"
  const SCHEDULE = [
    { date: '2026-09-25', key: 'A-full', label: 'FULL A', focus: 'Push' },
    { date: '2026-09-27', key: 'B-full', label: 'FULL B', focus: 'Pull' },
    { date: '2026-09-28', key: 'C-full', label: 'FULL C', focus: 'Legs' },
    { date: '2026-09-30', key: 'D-full', label: 'FULL D', focus: 'Full-body' },
    { date: '2026-10-02', key: 'A-short', label: 'SHORT A', focus: 'Push (OSM)' },
    { date: '2026-10-04', key: 'B-short', label: 'SHORT B', focus: 'Pull' },
    { date: '2026-10-06', key: 'C-full', label: 'FULL C', focus: 'Legs' },
    { date: '2026-10-07', key: 'D-short', label: 'SHORT D', focus: 'Full circuit (OSM)' }
  ];

  // ---------- storage ----------
  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }
  function save(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  function getSettings() {
    return Object.assign({ restSec: 90, stretchSec: 900 }, load(STORAGE.settings, {}));
  }
  function setSettings(s) {
    save(STORAGE.settings, s);
  }

  function getHistory() {
    return load(STORAGE.history, []);
  }
  function getLastSets() {
    return load(STORAGE.lastSets, {});
  }

  // ---------- state ----------
  let active = load(STORAGE.active, null);
  let stretchTimer = null;
  let stretchRemaining = 0;
  let stretchRunning = false;
  let restTimer = null;
  let restRemaining = 0;
  let modalResolve = null;

  // ---------- helpers ----------
  function todayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function formatDateLabel(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function fmtTime(sec) {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  }

  function sessionDayLetter(key) {
    return key.charAt(0);
  }
  function sessionLength(key) {
    return key.endsWith('short') ? 'short' : 'full';
  }

  function confirmModal(title, body) {
    return new Promise((resolve) => {
      modalResolve = resolve;
      document.getElementById('modal-title').textContent = title;
      document.getElementById('modal-body').textContent = body;
      document.getElementById('modal').classList.add('show');
    });
  }

  function closeModal(ok) {
    document.getElementById('modal').classList.remove('show');
    if (modalResolve) {
      modalResolve(!!ok);
      modalResolve = null;
    }
  }

  // ---------- navigation ----------
  function showView(name) {
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    const el = document.getElementById('view-' + name);
    if (el) el.classList.add('active');
    document.querySelectorAll('#bottom-nav button').forEach((b) => {
      b.classList.toggle('active', b.dataset.view === name);
    });
    const titles = {
      home: ['Steven Workout', 'Home · local only'],
      workout: [active ? PROGRAM[active.key].label : 'Workout', active ? 'In progress' : 'No active session'],
      history: ['History', 'Past sessions on this device'],
      settings: ['Settings', 'Timers & data']
    };
    const t = titles[name] || titles.home;
    document.getElementById('header-title').textContent = t[0];
    document.getElementById('header-sub').textContent = t[1];
    if (name === 'home') renderHome();
    if (name === 'history') renderHistory();
    if (name === 'workout') renderWorkout();
    if (name === 'settings') renderSettings();
  }

  // ---------- home ----------
  function renderHome() {
    const today = todayISO();
    const sug = SCHEDULE.find((s) => s.date === today);
    const sugCard = document.getElementById('suggested-card');
    if (sug) {
      sugCard.style.display = '';
      const letter = sessionDayLetter(sug.key);
      const len = sessionLength(sug.key);
      document.getElementById('suggested-title').textContent = sug.label + ' · ' + FOCUS[letter].name;
      document.getElementById('suggested-meta').textContent =
        formatDateLabel(sug.date) + ' · ' + (len === 'full' ? 'Full session' : 'Short / OSM');
      sugCard.dataset.key = sug.key;
    } else {
      sugCard.style.display = 'none';
    }

    const grid = document.getElementById('session-grid');
    const picks = [
      ['A-full', 'A Full', 'Push'],
      ['A-short', 'A Short', 'Push'],
      ['B-full', 'B Full', 'Pull'],
      ['B-short', 'B Short', 'Pull'],
      ['C-full', 'C Full', 'Legs'],
      ['C-short', 'C Short', 'Legs'],
      ['D-full', 'D Full', 'Full-body'],
      ['D-short', 'D Short', 'Circuit']
    ];
    grid.innerHTML = picks
      .map(
        ([key, title, sub]) =>
          `<button class="session-pick" data-key="${key}"><strong>${title}</strong><span>${sub}</span></button>`
      )
      .join('');

    const list = document.getElementById('schedule-list');
    list.innerHTML = SCHEDULE.map((s) => {
      const isToday = s.date === today;
      return `<li>
        <span>${formatDateLabel(s.date)}${isToday ? ' <span class="today-mark">· today</span>' : ''}</span>
        <span><span class="badge ${sessionLength(s.key)}">${s.label}</span> ${s.focus}</span>
      </li>`;
    }).join('');

    const resume = document.getElementById('resume-card');
    if (active) {
      resume.style.display = '';
      document.getElementById('resume-meta').textContent =
        PROGRAM[active.key].label + ' · started ' + new Date(active.startedAt).toLocaleString();
    } else {
      resume.style.display = 'none';
    }
  }

  // ---------- workout ----------
  function startWorkout(key) {
    const prog = PROGRAM[key];
    if (!prog) return;
    const settings = getSettings();
    const last = getLastSets();
    active = {
      key,
      startedAt: Date.now(),
      stretchDone: false,
      stretchSec: settings.stretchSec,
      exercises: prog.exercises.map((ex, i) => ({
        name: ex.name,
        targetSets: ex.sets,
        reps: ex.reps,
        note: ex.note || '',
        optional: !!ex.optional,
        duration: ex.duration || '',
        sets: Array.from({ length: ex.sets }, (_, si) => {
          const prev = (last[ex.name] && last[ex.name][si]) || {};
          return {
            weight: prev.weight != null ? String(prev.weight) : '',
            reps: prev.reps != null ? String(prev.reps) : '',
            done: false,
            prevWeight: prev.weight,
            prevReps: prev.reps
          };
        })
      }))
    };
    save(STORAGE.active, active);
    showView('workout');
  }

  function persistActive() {
    if (active) save(STORAGE.active, active);
  }

  function renderWorkout() {
    const root = document.getElementById('workout-content');
    if (!active) {
      root.innerHTML = `<div class="empty">No workout in progress.<br/>Pick a session on Home.</div>`;
      return;
    }
    const settings = getSettings();
    const letter = sessionDayLetter(active.key);
    const len = sessionLength(active.key);
    const totalSets = active.exercises.reduce((n, e) => n + e.sets.length, 0);
    const doneSets = active.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
    const pct = totalSets ? Math.round((doneSets / totalSets) * 100) : 0;

    let html = `
      <div class="card">
        <div class="flex" style="justify-content:space-between">
          <span class="badge ${len} ${FOCUS[letter].cls}">${PROGRAM[active.key].label}</span>
          <span class="muted">${doneSets}/${totalSets} sets</span>
        </div>
        <div class="progress-bar"><span style="width:${pct}%"></span></div>
      </div>

      <div class="card stretch-block" id="stretch-card">
        <h2>Precor StretchTrainer</h2>
        <div class="meta">Required warm-up · ≥15 min before every workout</div>
        <div class="timer-display" id="stretch-display">${fmtTime(active.stretchDone ? 0 : (stretchRunning ? stretchRemaining : active.stretchSec))}</div>
        <div class="timer-controls">
          <button class="ghost" id="stretch-start">${stretchRunning ? 'Pause' : 'Start'}</button>
          <button class="ghost" id="stretch-reset">Reset</button>
        </div>
        <label class="done-check">
          <input type="checkbox" id="stretch-done" ${active.stretchDone ? 'checked' : ''} />
          StretchTrainer done (≥15 min)
        </label>
      </div>
    `;

    active.exercises.forEach((ex, ei) => {
      const allDone = ex.sets.every((s) => s.done);
      const prevHint = ex.sets.some((s) => s.prevWeight != null)
        ? `Previous: ${ex.sets
            .filter((s) => s.prevWeight != null)
            .map((s) => `${s.prevWeight}×${s.prevReps || '?'}`)
            .join(', ')}`
        : '';
      html += `<div class="card ex-card ${allDone ? 'done' : ''}" data-ei="${ei}">
        <div class="ex-head">
          <div class="ex-name">${ex.name}${ex.optional ? '<span class="optional-tag">optional</span>' : ''}</div>
        </div>
        <div class="ex-target">${ex.sets.length} × ${ex.reps}${ex.duration ? ' · ' + ex.duration : ''}</div>
        ${ex.note ? `<div class="ex-note">${ex.note}</div>` : ''}
        ${prevHint ? `<div class="prev-weight">${prevHint}</div>` : ''}
        ${ex.sets
          .map((s, si) => {
            return `<div class="set-row ${s.done ? 'complete' : ''}" data-ei="${ei}" data-si="${si}">
              <div class="set-num">${si + 1}</div>
              <input type="number" inputmode="decimal" placeholder="lb" aria-label="Weight" data-field="weight" value="${s.weight}" ${s.done ? '' : ''} />
              <input type="number" inputmode="numeric" placeholder="reps" aria-label="Reps" data-field="reps" value="${s.reps}" />
              <button class="check-btn" data-action="toggle-set" aria-label="Mark set complete">${s.done ? '✓' : '○'}</button>
            </div>`;
          })
          .join('')}
      </div>`;
    });

    root.innerHTML = html;

    // Wire stretch
    document.getElementById('stretch-start').onclick = toggleStretch;
    document.getElementById('stretch-reset').onclick = resetStretch;
    document.getElementById('stretch-done').onchange = (e) => {
      active.stretchDone = e.target.checked;
      persistActive();
    };

    // Wire sets
    root.querySelectorAll('.set-row input').forEach((inp) => {
      inp.addEventListener('change', onSetInput);
      inp.addEventListener('blur', onSetInput);
    });
    root.querySelectorAll('[data-action="toggle-set"]').forEach((btn) => {
      btn.addEventListener('click', onToggleSet);
    });
  }

  function onSetInput(e) {
    const row = e.target.closest('.set-row');
    const ei = +row.dataset.ei;
    const si = +row.dataset.si;
    const field = e.target.dataset.field;
    active.exercises[ei].sets[si][field] = e.target.value;
    persistActive();
  }

  function onToggleSet(e) {
    const row = e.target.closest('.set-row');
    const ei = +row.dataset.ei;
    const si = +row.dataset.si;
    const set = active.exercises[ei].sets[si];
    // Sync inputs
    const w = row.querySelector('[data-field="weight"]');
    const r = row.querySelector('[data-field="reps"]');
    set.weight = w.value;
    set.reps = r.value;
    set.done = !set.done;
    persistActive();
    row.classList.toggle('complete', set.done);
    e.target.textContent = set.done ? '✓' : '○';
    if (set.done) startRestTimer();
    // Update progress header without full re-render
    const totalSets = active.exercises.reduce((n, ex) => n + ex.sets.length, 0);
    const doneSets = active.exercises.reduce((n, ex) => n + ex.sets.filter((s) => s.done).length, 0);
    const pct = totalSets ? Math.round((doneSets / totalSets) * 100) : 0;
    const bar = document.querySelector('#workout-content .progress-bar > span');
    const meta = document.querySelector('#workout-content .card .muted');
    if (bar) bar.style.width = pct + '%';
    if (meta) meta.textContent = `${doneSets}/${totalSets} sets`;
  }

  // Stretch timer
  function toggleStretch() {
    if (stretchRunning) {
      clearInterval(stretchTimer);
      stretchRunning = false;
      document.getElementById('stretch-start').textContent = 'Start';
      return;
    }
    if (!stretchRemaining || stretchRemaining <= 0) {
      stretchRemaining = active.stretchSec || getSettings().stretchSec;
    }
    stretchRunning = true;
    document.getElementById('stretch-start').textContent = 'Pause';
    stretchTimer = setInterval(() => {
      stretchRemaining -= 1;
      const el = document.getElementById('stretch-display');
      if (el) el.textContent = fmtTime(stretchRemaining);
      if (stretchRemaining <= 0) {
        clearInterval(stretchTimer);
        stretchRunning = false;
        active.stretchDone = true;
        persistActive();
        const cb = document.getElementById('stretch-done');
        if (cb) cb.checked = true;
        const btn = document.getElementById('stretch-start');
        if (btn) btn.textContent = 'Start';
        try {
          navigator.vibrate && navigator.vibrate([200, 100, 200]);
        } catch (_) {}
      }
    }, 1000);
  }

  function resetStretch() {
    clearInterval(stretchTimer);
    stretchRunning = false;
    stretchRemaining = active.stretchSec || getSettings().stretchSec;
    const el = document.getElementById('stretch-display');
    if (el) el.textContent = fmtTime(stretchRemaining);
    const btn = document.getElementById('stretch-start');
    if (btn) btn.textContent = 'Start';
  }

  // Rest timer
  function startRestTimer() {
    const settings = getSettings();
    restRemaining = settings.restSec;
    document.getElementById('rest-seconds').value = settings.restSec;
    document.getElementById('rest-display').textContent = fmtTime(restRemaining);
    document.getElementById('rest-overlay').classList.add('show');
    clearInterval(restTimer);
    restTimer = setInterval(() => {
      restRemaining -= 1;
      document.getElementById('rest-display').textContent = fmtTime(restRemaining);
      if (restRemaining <= 0) {
        clearInterval(restTimer);
        document.getElementById('rest-overlay').classList.remove('show');
        try {
          navigator.vibrate && navigator.vibrate([150, 80, 150]);
        } catch (_) {}
      }
    }, 1000);
  }

  function closeRest() {
    clearInterval(restTimer);
    document.getElementById('rest-overlay').classList.remove('show');
  }

  async function finishWorkout() {
    if (!active) return;
    if (!active.stretchDone) {
      const ok = await confirmModal(
        'StretchTrainer not marked done',
        'Warm-up ≥15 min is required. Finish anyway?'
      );
      if (!ok) return;
    }
    const ok = await confirmModal('Finish workout?', 'Save this session to history on this device.');
    if (!ok) return;

    const history = getHistory();
    const entry = {
      id: Date.now().toString(36),
      key: active.key,
      label: PROGRAM[active.key].label,
      startedAt: active.startedAt,
      finishedAt: Date.now(),
      stretchDone: active.stretchDone,
      exercises: active.exercises.map((ex) => ({
        name: ex.name,
        sets: ex.sets
          .filter((s) => s.done || s.weight || s.reps)
          .map((s) => ({
            weight: s.weight === '' ? null : Number(s.weight),
            reps: s.reps === '' ? null : Number(s.reps),
            done: s.done
          }))
      }))
    };
    history.unshift(entry);
    save(STORAGE.history, history);

    // Update last sets for previous-weight hints
    const last = getLastSets();
    active.exercises.forEach((ex) => {
      last[ex.name] = ex.sets.map((s) => ({
        weight: s.weight === '' ? null : Number(s.weight),
        reps: s.reps === '' ? null : Number(s.reps)
      }));
    });
    save(STORAGE.lastSets, last);

    active = null;
    localStorage.removeItem(STORAGE.active);
    clearInterval(stretchTimer);
    stretchRunning = false;
    showView('history');
  }

  async function cancelWorkout() {
    if (!active) return;
    const ok = await confirmModal('Cancel workout?', 'Progress for this session will be discarded.');
    if (!ok) return;
    active = null;
    localStorage.removeItem(STORAGE.active);
    clearInterval(stretchTimer);
    stretchRunning = false;
    showView('home');
  }

  // ---------- history ----------
  function renderHistory() {
    const list = document.getElementById('history-list');
    const history = getHistory();
    if (!history.length) {
      list.innerHTML = `<div class="empty">No sessions yet.<br/>Finish a workout to see it here.</div>`;
      return;
    }
    list.innerHTML = history
      .map((h) => {
        const date = new Date(h.finishedAt).toLocaleString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        });
        const lines = h.exercises
          .filter((e) => e.sets.length)
          .map((e) => {
            const sets = e.sets
              .map((s) => (s.weight != null ? `${s.weight}×${s.reps ?? '?'}` : `${s.reps ?? '?'} reps`))
              .join(', ');
            return `<div class="line"><strong>${e.name}</strong> — ${sets}</div>`;
          })
          .join('');
        return `<div class="card hist-item" data-id="${h.id}">
          <div class="hist-title">${h.label}</div>
          <div class="hist-date">${date}${h.stretchDone ? ' · stretch ✓' : ''}</div>
          <div class="hist-detail">${lines || '<div class="line muted">No sets logged</div>'}</div>
        </div>`;
      })
      .join('');
  }

  // ---------- settings ----------
  function renderSettings() {
    const s = getSettings();
    document.getElementById('rest-default').value = s.restSec;
    document.getElementById('stretch-default').value = s.stretchSec;
  }

  // ---------- init ----------
  function init() {
    // Nav
    document.getElementById('bottom-nav').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-view]');
      if (!btn) return;
      if (btn.dataset.view === 'workout' && !active) {
        showView('home');
        return;
      }
      showView(btn.dataset.view);
    });

    document.getElementById('session-grid').addEventListener('click', async (e) => {
      const pick = e.target.closest('.session-pick');
      if (!pick) return;
      if (active) {
        const ok = await confirmModal('Replace active workout?', 'Current in-progress session will be discarded.');
        if (!ok) return;
      }
      startWorkout(pick.dataset.key);
    });

    document.getElementById('btn-start-suggested').addEventListener('click', async () => {
      const key = document.getElementById('suggested-card').dataset.key;
      if (!key) return;
      if (active) {
        const ok = await confirmModal('Replace active workout?', 'Current in-progress session will be discarded.');
        if (!ok) return;
      }
      startWorkout(key);
    });

    document.getElementById('btn-resume').addEventListener('click', () => showView('workout'));
    document.getElementById('btn-discard').addEventListener('click', cancelWorkout);
    document.getElementById('btn-finish').addEventListener('click', finishWorkout);
    document.getElementById('btn-cancel-workout').addEventListener('click', cancelWorkout);

    document.getElementById('rest-skip').addEventListener('click', closeRest);
    document.getElementById('rest-done').addEventListener('click', closeRest);
    document.getElementById('rest-seconds').addEventListener('change', (e) => {
      const v = Math.max(15, Number(e.target.value) || 90);
      restRemaining = v;
      document.getElementById('rest-display').textContent = fmtTime(restRemaining);
      const s = getSettings();
      s.restSec = v;
      setSettings(s);
    });

    document.getElementById('modal-cancel').addEventListener('click', () => closeModal(false));
    document.getElementById('modal-ok').addEventListener('click', () => closeModal(true));

    document.getElementById('rest-default').addEventListener('change', (e) => {
      const s = getSettings();
      s.restSec = Math.max(15, Number(e.target.value) || 90);
      setSettings(s);
    });
    document.getElementById('stretch-default').addEventListener('change', (e) => {
      const s = getSettings();
      s.stretchSec = Math.max(60, Number(e.target.value) || 900);
      setSettings(s);
    });

    document.getElementById('btn-export').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(getHistory(), null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'steven-workout-history.json';
      a.click();
    });

    document.getElementById('btn-clear-history').addEventListener('click', async () => {
      const ok = await confirmModal('Clear all history?', 'This cannot be undone on this device.');
      if (!ok) return;
      save(STORAGE.history, []);
      save(STORAGE.lastSets, {});
      renderHistory();
    });

    // SW
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

    showView('home');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
