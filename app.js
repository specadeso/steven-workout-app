/* Steven 5x5 — phone logger. Storage prefix sl5x5-v1 only.
   Legacy A–D keys are never read or written. */
(function () {
  'use strict';

  const PREFIX = 'sl5x5-v1';
  const KEY_HISTORY = PREFIX + '-history';
  const KEY_ACTIVE = PREFIX + '-active';
  const KEY_SETTINGS = PREFIX + '-settings';

  const ORDER = ['A', 'B', 'C'];
  const PROGRAM = {
    A: ['Barbell squat', 'Barbell bench press', 'Preacher curls'],
    B: ['Barbell deadlift', 'Overhead press', 'Back extensions'],
    C: ['Kettlebell swings', 'Decline bench sit-ups', 'Barbell squat']
  };
  const FINISHERS = ['Run', 'Row', 'Jump rope'];
  const TOOLS = ['Trigger Point Roller', 'Chirp RPM', 'Massage gun', 'Yoga poses'];
  const PHASES = ['stretch', 'lifts', 'finisher', 'cooldown'];

  let active = null;
  let view = 'home';
  let pickedLetter = null;
  let editing = false;
  let audioCtx = null;
  let pendingAlert = false;
  let modalResolver = null;
  let toastTimer = null;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  }

  function loadHistory() {
    const data = readJSON(KEY_HISTORY, []);
    return Array.isArray(data) ? data : [];
  }

  function loadSettings() {
    const data = readJSON(KEY_SETTINGS, {});
    const rest = Number(data && data.restSec);
    return { restSec: rest === 60 || rest === 90 || rest === 180 ? rest : 90 };
  }

  function saveSettings(settings) {
    try { localStorage.setItem(KEY_SETTINGS, JSON.stringify(settings)); } catch (err) { /* quota */ }
  }

  function loadActive() {
    const data = readJSON(KEY_ACTIVE, null);
    if (!data || !PROGRAM[data.letter] || PHASES.indexOf(data.phase) < 0) return null;
    if (!Array.isArray(data.exercises) || data.exercises.length !== 3) return null;
    return data;
  }

  function persistActive() {
    try {
      if (active) localStorage.setItem(KEY_ACTIVE, JSON.stringify(active));
      else localStorage.removeItem(KEY_ACTIVE);
    } catch (err) { /* quota */ }
  }

  function suggestLetter(history) {
    const list = history || [];
    if (!list.length || ORDER.indexOf(list[0].letter) < 0) return 'A';
    return ORDER[(ORDER.indexOf(list[0].letter) + 1) % ORDER.length];
  }

  function nextWeightFromHistory(history, name) {
    const list = history || [];
    for (let i = 0; i < list.length; i += 1) {
      const exercises = list[i].exercises || [];
      const ex = exercises.find(function (item) {
        return item && item.name === name && item.sets && item.sets.length;
      });
      if (!ex) continue;
      const prev = Number(ex.sets[ex.sets.length - 1].weight);
      if (!Number.isFinite(prev)) continue;
      const increased = ex.sets.length >= 5 && ex.sets.every(function (set) {
        return Number(set.reps) === 5;
      });
      return { weight: increased ? Math.round((prev + 5) * 10) / 10 : prev, increased: increased, previous: prev };
    }
    return null;
  }

  function plateLine(total) {
    const w = Number(total);
    if (!Number.isFinite(w)) return '';
    const halfPounds = Math.round(w * 2);
    if (Math.abs(w * 2 - halfPounds) > 1e-6) return '';
    const bar = 90;
    if (halfPounds < bar) return '';
    const sideUnits = (halfPounds - bar) / 2;
    if (!Number.isInteger(sideUnits)) return '';
    let side = sideUnits;
    const labels = [45, 25, 10, 5, 2.5];
    const sizes = labels.map(function (n) { return n * 2; });
    const parts = [];
    for (let i = 0; i < sizes.length; i += 1) {
      const count = Math.floor(side / sizes[i]);
      if (count > 0) {
        side -= count * sizes[i];
        parts.push(count === 1 ? String(labels[i]) : count + '×' + labels[i]);
      }
    }
    if (side !== 0) return '';
    if (!parts.length) return 'Bar only';
    return parts.join(' + ') + ' / side';
  }

  function platesFor(name, total) {
    const n = String(name || '').toLowerCase();
    const barLift = n.indexOf('barbell') >= 0 || n.indexOf('overhead press') >= 0 || n.indexOf('preacher') >= 0;
    if (!barLift) return '';
    return plateLine(total);
  }

  function fmtW(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    const rounded = Math.round(n * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded);
  }

  function fmtClock(totalSeconds) {
    const s = Math.max(0, totalSeconds | 0);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0');
    return m + ':' + String(r).padStart(2, '0');
  }

  function parseWeight(value) {
    const text = String(value == null ? '' : value).trim().replace(',', '.');
    if (!text) return null;
    const n = Number(text);
    if (!Number.isFinite(n) || n < 0 || n > 1500) return null;
    return Math.round(n * 10) / 10;
  }

  function parseReps(value) {
    const text = String(value == null ? '' : value).trim();
    if (!/^\d+$/.test(text)) return null;
    const n = Number(text);
    if (n < 0 || n > 30) return null;
    return n;
  }

  function formatWork(sets) {
    if (!sets || !sets.length) return 'No sets';
    const same = sets.every(function (set) {
      return Number(set.weight) === Number(sets[0].weight) && Number(set.reps) === Number(sets[0].reps);
    });
    if (same) return sets.length + ' × ' + sets[0].reps + ' @ ' + fmtW(sets[0].weight) + ' lb';
    return sets.map(function (set) { return fmtW(set.weight) + '×' + set.reps; }).join(', ');
  }

  function formatWhen(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    });
  }

  function blankSession(letter) {
    return {
      id: String(Date.now()),
      letter: letter,
      startedAt: new Date().toISOString(),
      phase: 'stretch',
      exerciseIndex: 0,
      stretch: {
        presetSec: 300,
        remainingMs: 300000,
        running: false,
        endsAt: null,
        completed: false,
        skipped: false
      },
      exercises: PROGRAM[letter].map(function (name) { return { name: name, sets: [] }; }),
      finisher: {
        kind: null,
        elapsedMs: 0,
        running: false,
        runningSince: null,
        done: false,
        skipped: false
      },
      cooldown: {
        remainingMs: 15 * 60 * 1000,
        running: false,
        endsAt: null,
        timerDone: false,
        started: false,
        checks: []
      },
      rest: null
    };
  }

  function $(id) { return document.getElementById(id); }

  function primeAudio() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (err) { /* autoplay */ }
  }

  function beep() {
    try {
      primeAudio();
      if (!audioCtx) return;
      const start = audioCtx.currentTime + 0.01;
      [880, 1175].forEach(function (freq, index) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const t = start + index * 0.16;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
        osc.start(t);
        osc.stop(t + 0.15);
      });
    } catch (err) { /* no audio */ }
  }

  function buzz() {
    try {
      if (navigator.vibrate) navigator.vibrate([200, 80, 200, 80, 200]);
    } catch (err) { /* no vibrate */ }
  }

  function alertDone() {
    if (document.visibilityState === 'hidden') pendingAlert = true;
    else { beep(); buzz(); }
  }

  function setRestOpen(open) {
    const rest = $('rest');
    if (!rest) return;
    rest.hidden = !open;
    document.body.classList.toggle('resting', open);
    const app = $('app');
    if (!app) return;
    if (open) app.setAttribute('inert', '');
    else app.removeAttribute('inert');
    if (open) paintRest();
  }

  function showToast(message) {
    const toast = $('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.hidden = true; }, 2600);
  }

  function confirmModal(title, body, okText) {
    return new Promise(function (resolve) {
      modalResolver = resolve;
      $('modal-title').textContent = title;
      $('modal-body').textContent = body;
      $('modal-ok').textContent = okText || 'OK';
      $('modal').hidden = false;
    });
  }

  function closeModal(ok) {
    const modal = $('modal');
    if (modal) modal.hidden = true;
    if (modalResolver) {
      const resolve = modalResolver;
      modalResolver = null;
      resolve(!!ok);
    }
  }

  function stretchLeft() {
    const s = active.stretch;
    if (s.running && s.endsAt) return Math.max(0, s.endsAt - Date.now());
    return Math.max(0, s.remainingMs || 0);
  }

  function cooldownLeft() {
    const c = active.cooldown;
    if (c.running && c.endsAt) return Math.max(0, c.endsAt - Date.now());
    return Math.max(0, c.remainingMs || 0);
  }

  function finisherElapsed() {
    const f = active.finisher;
    let ms = f.elapsedMs || 0;
    if (f.running && f.runningSince) ms += Date.now() - f.runningSince;
    return Math.max(0, ms);
  }

  function restLeft() {
    if (!active || !active.rest) return 0;
    return Math.max(0, active.rest.deadline - Date.now());
  }

  function weightHint(name) {
    const suggestion = nextWeightFromHistory(loadHistory(), name);
    if (!suggestion) return 'No saved weight yet. Enter a starting weight.';
    if (suggestion.increased) {
      return 'Last time ' + fmtW(suggestion.previous) + ' lb, all 5×5. Suggest ' + fmtW(suggestion.weight) + ' lb.';
    }
    return 'Last time ' + fmtW(suggestion.previous) + ' lb. Not all 5 sets were 5 reps, so stay here.';
  }

  function defaultWeight(ex) {
    if (ex.sets.length) return ex.sets[ex.sets.length - 1].weight;
    const suggestion = nextWeightFromHistory(loadHistory(), ex.name);
    return suggestion ? suggestion.weight : '';
  }

  function lastSetLocation() {
    if (!active) return null;
    for (let i = active.exerciseIndex; i >= 0; i -= 1) {
      const sets = active.exercises[i].sets;
      if (sets && sets.length) return { exIndex: i, setIndex: sets.length - 1 };
    }
    return null;
  }

  function shell(kicker, title, rightLabel, rightAction, body) {
    return '<header class="top"><div>'
      + (kicker ? '<p class="kicker">' + esc(kicker) + '</p>' : '')
      + '<h1>' + esc(title) + '</h1></div>'
      + (rightLabel ? '<button type="button" class="ghost small" data-action="' + esc(rightAction) + '">' + esc(rightLabel) + '</button>' : '')
      + '</header><div class="content">' + body + '</div>';
  }

  function steps(current) {
    const labels = { stretch: 'Stretch', lifts: 'Lifts', finisher: 'Finisher', cooldown: 'Cooldown' };
    return '<ol class="steps">' + PHASES.map(function (phase) {
      const cls = phase === current ? 'current' : (PHASES.indexOf(phase) < PHASES.indexOf(current) ? 'done' : '');
      return '<li class="' + cls + '">' + labels[phase] + '</li>';
    }).join('') + '</ol>';
  }

  function escapeBtn() {
    return '<button type="button" class="text" data-action="end">End without saving</button>';
  }

  function renderHome() {
    const history = loadHistory();
    const suggested = suggestLetter(history);
    const selected = pickedLetter || suggested;
    const names = PROGRAM[selected];
    let resume = '';
    if (active) {
      resume = '<section class="card resume"><h2>Workout ' + esc(active.letter) + ' in progress</h2>'
        + '<p class="note">' + esc(resumeSummary()) + '</p>'
        + '<div class="stack"><button type="button" class="primary block" data-action="resume">Resume</button>'
        + '<button type="button" class="ghost block" data-action="discard">Discard</button></div></section>';
    }
    const last = history[0];
    const lastLine = last
      ? '<p class="note">Last session: Workout ' + esc(last.letter) + ' · ' + esc(formatWhen(last.finishedAt || last.startedAt)) + '</p>'
      : '';
    const days = ORDER.map(function (letter) {
      const on = letter === selected ? ' on' : '';
      const mark = letter === suggested ? '<em>Next</em>' : '<em>&nbsp;</em>';
      return '<button type="button" class="day' + on + '" data-action="pick-day" data-day="' + letter + '" aria-pressed="' + (letter === selected) + '"><strong>' + letter + '</strong>' + mark + '</button>';
    }).join('');
    const body = resume
      + '<section class="hero"><p class="kicker">Next workout</p>'
      + '<p class="letter" data-letter="' + esc(selected) + '">' + esc(selected) + '</p>'
      + '<h2>Workout ' + esc(selected) + '</h2>'
      + '<ul class="plan">' + names.map(function (name) {
        return '<li>' + esc(name) + '<span>5 sets of 5</span></li>';
      }).join('') + '</ul>'
      + lastLine
      + '<p class="note">A → B → C, then back to A. Switch the day before you start. +5 lb next time only if every set was 5 reps.</p>'
      + '<div class="day-row" role="group" aria-label="Choose workout">' + days + '</div>'
      + '<div class="stack"><button type="button" class="primary block" data-action="start">Start workout</button>'
      + '<button type="button" class="ghost block" data-action="history">History</button></div>'
      + '<p class="note" style="margin-top:14px">Logs stay on this phone only.</p></section>';
    $('app').innerHTML = shell('', 'Steven 5x5', 'History', 'history', body);
  }

  function resumeSummary() {
    if (!active) return '';
    if (active.rest && active.rest.deadline > Date.now()) return 'Resting';
    if (active.phase === 'stretch') return 'Precor StretchTrainer';
    if (active.phase === 'lifts') {
      const ex = active.exercises[active.exerciseIndex];
      const n = Math.min((ex.sets || []).length + 1, 5);
      return ex.name + ' · set ' + n + ' of 5';
    }
    if (active.phase === 'finisher') return 'Optional finisher';
    if (active.phase === 'cooldown') return 'Cooldown';
    return '';
  }

  function renderStretch() {
    const s = active.stretch;
    const left = fmtClock(Math.ceil(stretchLeft() / 1000));
    const running = !!s.running;
    const label = running ? 'Pause' : (stretchLeft() < s.presetSec * 1000 && stretchLeft() > 0 ? 'Resume' : 'Start');
    const presets = [300, 600].map(function (sec) {
      const on = s.presetSec === sec ? ' on' : '';
      return '<button type="button" class="' + on + '" data-action="stretch-preset" data-sec="' + sec + '" aria-pressed="' + (s.presetSec === sec) + '">' + (sec / 60) + ' min</button>';
    }).join('');
    const body = steps('stretch')
      + '<section class="card clock-wrap"><p class="kicker">Before you lift</p><h2>Precor StretchTrainer</h2>'
      + '<p class="lede">Begin every workout with 5–10 minutes here.</p>'
      + '<div class="preset-row" role="group" aria-label="Stretch length">' + presets + '</div>'
      + '<div class="mega" id="clock" role="timer">' + left + '</div>'
      + '<div class="row"><button type="button" class="primary" id="timer-toggle" data-action="stretch-toggle" style="flex:1">' + label + '</button>'
      + '<button type="button" class="ghost" data-action="stretch-skip" style="flex:1">Skip</button></div></section>'
      + escapeBtn();
    $('app').innerHTML = shell('Workout ' + active.letter, 'Stretch', 'Home', 'home', body);
  }

  function renderLifts() {
    const ex = active.exercises[active.exerciseIndex];
    const sets = ex.sets || [];
    const list = ORDER.length ? active.exercises.map(function (item, index) {
      const cls = index === active.exerciseIndex ? 'current' : (index < active.exerciseIndex ? 'done' : '');
      return '<li class="' + cls + '">' + esc(item.name) + '</li>';
    }).join('') : '';
    const logged = sets.map(function (set, index) {
      return '<li><span>Set ' + (index + 1) + '</span><strong>' + esc(fmtW(set.weight)) + ' × ' + esc(set.reps) + '</strong></li>';
    }).join('');
    let form = '';
    if (sets.length < 5) {
      const weight = defaultWeight(ex);
      const setNo = sets.length + 1;
      form = '<form id="set-form" class="set-card"><p class="set-label">Set ' + setNo + ' of 5</p>'
        + '<h2>' + esc(ex.name) + '</h2>'
        + '<p class="hint">' + esc(weightHint(ex.name)) + '</p>'
        + '<div class="fields"><label class="field">Weight<input id="weight" inputmode="decimal" autocomplete="off" enterkeyhint="next" value="' + esc(weight === '' ? '' : fmtW(weight)) + '" placeholder="lb"></label>'
        + '<label class="field">Reps<input id="reps" inputmode="numeric" autocomplete="off" enterkeyhint="done" value="5"></label></div>'
        + '<p class="plates" id="plates" hidden></p>'
        + '<p class="form-error" id="form-error"></p>'
        + '<div class="stack"><button type="submit" class="primary block">Log set ' + setNo + '</button></div></form>';
    } else {
      form = '<section class="set-card"><h2>' + esc(ex.name) + '</h2><p class="done-all">All 5 sets logged</p></section>';
    }
    const loc = lastSetLocation();
    let editor = '';
    if (loc) {
      const prev = active.exercises[loc.exIndex];
      const set = prev.sets[loc.setIndex];
      editor = '<button type="button" class="ghost block" data-action="edit-toggle">' + (editing ? 'Cancel edit' : 'Edit last set') + '</button>';
      if (editing) {
        editor += '<form id="edit-form" class="card"><p class="hint">Editing ' + esc(prev.name) + ' · set ' + (loc.setIndex + 1) + '</p>'
          + '<div class="fields"><label class="field">Weight<input id="edit-weight" inputmode="decimal" autocomplete="off" value="' + esc(fmtW(set.weight)) + '"></label>'
          + '<label class="field">Reps<input id="edit-reps" inputmode="numeric" autocomplete="off" value="' + esc(set.reps) + '"></label></div>'
          + '<p class="form-error" id="edit-error"></p>'
          + '<div class="stack"><button type="submit" class="primary block">Save edit</button></div></form>';
      }
    }
    const body = steps('lifts')
      + '<ul class="ex-list">' + list + '</ul>'
      + (logged ? '<ol class="logged">' + logged + '</ol>' : '')
      + form
      + editor
      + escapeBtn();
    $('app').innerHTML = shell('Workout ' + active.letter + ' · ' + (active.exerciseIndex + 1) + '/3', ex.name, 'Home', 'home', body);
    const weightInput = $('weight');
    if (weightInput) refreshPlates();
  }

  function renderFinisher() {
    const f = active.finisher;
    const clock = fmtClock(Math.floor(finisherElapsed() / 1000));
    const running = !!f.running;
    const label = running ? 'Pause' : (finisherElapsed() > 0 ? 'Resume' : 'Start');
    const choices = FINISHERS.map(function (kind) {
      const on = f.kind === kind ? ' on' : '';
      return '<button type="button" class="' + on + '" data-action="finisher-kind" data-kind="' + esc(kind) + '" aria-pressed="' + (f.kind === kind) + '">' + esc(kind) + '</button>';
    }).join('');
    const body = steps('finisher')
      + '<section class="card clock-wrap"><span class="pill">Optional</span>'
      + '<h2 style="margin-top:10px">Finisher</h2>'
      + '<p class="lede">Run, row, or jump rope. Or skip it.</p>'
      + '<div class="choice-row" role="group" aria-label="Finisher">' + choices + '</div>'
      + '<div class="mega" id="clock" role="timer">' + clock + '</div>'
      + '<div class="row"><button type="button" class="ghost" id="timer-toggle" data-action="finisher-toggle" style="flex:1">' + label + '</button>'
      + '<button type="button" class="primary" data-action="finisher-done" style="flex:1">Done</button></div>'
      + '<p class="form-error" id="form-error"></p>'
      + '<div class="stack"><button type="button" class="ghost block" data-action="finisher-skip">Skip finisher</button></div></section>'
      + escapeBtn();
    $('app').innerHTML = shell('Workout ' + active.letter, 'Finisher', 'Home', 'home', body);
  }

  function renderCooldown() {
    const c = active.cooldown;
    const clock = fmtClock(Math.ceil(cooldownLeft() / 1000));
    const running = !!c.running;
    const label = running ? 'Pause' : (cooldownLeft() < 15 * 60 * 1000 && cooldownLeft() > 0 ? 'Resume' : 'Start');
    const status = c.timerDone ? '<p class="note">15:00 complete. Finish when you are ready.</p>' : '';
    const checks = TOOLS.map(function (tool) {
      const on = c.checks.indexOf(tool) >= 0;
      return '<button type="button"' + (on ? ' class="on"' : '') + ' data-action="check" data-name="' + esc(tool) + '" aria-pressed="' + on + '">' + (on ? '✓ ' : '') + esc(tool) + '</button>';
    }).join('');
    const body = steps('cooldown')
      + '<section class="card clock-wrap"><h2>Cooldown</h2>'
      + '<p class="lede">15 minute cooldown with stretches and rolling.</p>'
      + '<div class="mega" id="clock" role="timer">' + clock + '</div>'
      + '<button type="button" class="primary block" id="timer-toggle" data-action="cooldown-toggle">' + label + '</button>'
      + status
      + '<div class="checks" role="group" aria-label="Cooldown tools">' + checks + '</div>'
      + '<p class="note">Check any you use. None are required.</p>'
      + '<button type="button" class="primary block" data-action="finish">Finish workout</button></section>'
      + escapeBtn();
    $('app').innerHTML = shell('Workout ' + active.letter, 'Cooldown', 'Home', 'home', body);
  }

  function renderHistory() {
    const history = loadHistory();
    let body;
    if (!history.length) {
      body = '<p class="empty">No workouts yet. Finish a session and it will show up here.</p>';
    } else {
      body = history.map(function (session) {
        const exercises = (session.exercises || []).map(function (ex) {
          return '<p class="ex"><strong>' + esc(ex.name || 'Exercise') + '</strong><span>' + esc(formatWork(ex.sets || [])) + '</span></p>';
        }).join('');
        const fin = session.finisher || {};
        const cool = session.cooldown || {};
        const finLine = fin.done
          ? 'Finisher: done · ' + (fin.kind || 'Done') + ' · ' + fmtClock(Number(fin.seconds) || 0)
          : 'Finisher: skipped';
        const coolBits = [cool.done ? 'Cooldown: done' : 'Cooldown: not done'];
        if (cool.done) coolBits.push(cool.timerDone ? '15:00 complete' : 'timer not finished');
        if (cool.checks && cool.checks.length) coolBits.push(cool.checks.join(', '));
        return '<article class="card hist"><time>' + esc(formatWhen(session.finishedAt || session.startedAt)) + '</time>'
          + '<h3>Workout ' + esc(session.letter || '?') + '</h3>'
          + exercises
          + '<p class="flags">' + esc(finLine) + '<br>' + esc(coolBits.join(' · ')) + '</p></article>';
      }).join('');
    }
    $('app').innerHTML = shell('', 'History', 'Home', 'home', body);
  }

  function render() {
    if (!document.body) return;
    if (view === 'history') renderHistory();
    else if (view === 'session' && active) {
      if (active.phase === 'stretch') renderStretch();
      else if (active.phase === 'lifts') renderLifts();
      else if (active.phase === 'finisher') renderFinisher();
      else renderCooldown();
    } else {
      view = 'home';
      renderHome();
    }
    paintClocks();
  }

  function refreshPlates() {
    const input = $('weight');
    const plates = $('plates');
    if (!input || !plates || !active) return;
    const name = active.exercises[active.exerciseIndex].name;
    const line = platesFor(name, parseWeight(input.value));
    plates.hidden = !line;
    plates.textContent = line ? 'Plates: ' + line : '';
  }

  function paintRest() {
    if (!active || !active.rest) return;
    const ctx = $('rest-context');
    const clock = $('rest-clock');
    if (ctx) ctx.textContent = active.rest.label || 'Rest';
    if (clock) clock.textContent = fmtClock(Math.ceil(restLeft() / 1000));
    const bar = $('rest-bar');
    if (bar) {
      const dur = active.rest.durationMs || 1;
      const pct = Math.max(0, Math.min(1, restLeft() / dur));
      bar.style.transform = 'scaleX(' + pct + ')';
    }
    const chosen = loadSettings().restSec;
    document.querySelectorAll('[data-rest]').forEach(function (btn) {
      btn.classList.toggle('on', Number(btn.dataset.rest) === chosen);
    });
  }

  function paintClocks() {
    if (!active) return;
    const clock = $('clock');
    if (clock) {
      if (active.phase === 'stretch') clock.textContent = fmtClock(Math.ceil(stretchLeft() / 1000));
      else if (active.phase === 'finisher') clock.textContent = fmtClock(Math.floor(finisherElapsed() / 1000));
      else if (active.phase === 'cooldown') clock.textContent = fmtClock(Math.ceil(cooldownLeft() / 1000));
    }
    if (active.rest) paintRest();
  }

  function recent(deadline) {
    return Date.now() - deadline < 120000;
  }

  function runDeadlines() {
    if (!active) return false;
    let changed = false;

    if (active.phase === 'stretch' && active.stretch.running && active.stretch.endsAt && Date.now() >= active.stretch.endsAt) {
      const ended = active.stretch.endsAt;
      active.stretch.running = false;
      active.stretch.endsAt = null;
      active.stretch.remainingMs = 0;
      active.stretch.completed = true;
      active.phase = 'lifts';
      changed = true;
      if (recent(ended)) alertDone();
      persistActive();
    }

    if (active.rest && Date.now() >= active.rest.deadline) {
      const ended = active.rest.deadline;
      const advance = active.rest.advanceExercise;
      const skipped = !!active.rest.skip;
      active.rest = null;
      if (advance) {
        if (active.exerciseIndex < active.exercises.length - 1) active.exerciseIndex += 1;
        else active.phase = 'finisher';
      }
      editing = false;
      changed = true;
      setRestOpen(false);
      if (!skipped && recent(ended)) alertDone();
      persistActive();
    }

    if (active.phase === 'cooldown' && active.cooldown.running && active.cooldown.endsAt && Date.now() >= active.cooldown.endsAt) {
      const ended = active.cooldown.endsAt;
      active.cooldown.running = false;
      active.cooldown.endsAt = null;
      active.cooldown.remainingMs = 0;
      const first = !active.cooldown.timerDone;
      active.cooldown.timerDone = true;
      changed = true;
      if (first && recent(ended)) alertDone();
      persistActive();
    }

    return changed;
  }

  function openSession() {
    view = 'session';
    editing = false;
    render();
    if (active && active.rest && active.rest.deadline > Date.now()) setRestOpen(true);
    else setRestOpen(false);
  }

  async function startWorkout() {
    primeAudio();
    if (active) {
      const ok = await confirmModal('Replace workout?', 'Discard the in-progress session and start this one?', 'Discard and start');
      if (!ok) return;
    }
    const letter = pickedLetter || suggestLetter(loadHistory());
    active = blankSession(letter);
    pickedLetter = null;
    editing = false;
    persistActive();
    openSession();
  }

  async function discardActive() {
    const ok = await confirmModal('Discard workout?', 'This in-progress session will not be saved.', 'Discard');
    if (!ok) return;
    active = null;
    pickedLetter = null;
    editing = false;
    persistActive();
    setRestOpen(false);
    view = 'home';
    render();
  }

  function logSet() {
    if (!active || active.phase !== 'lifts' || active.rest) return;
    const ex = active.exercises[active.exerciseIndex];
    if (ex.sets.length >= 5) return;
    const weight = parseWeight($('weight').value);
    const reps = parseReps($('reps').value);
    const err = $('form-error');
    if (weight == null || reps == null) {
      if (err) err.textContent = weight == null ? 'Enter a weight in pounds.' : 'Enter whole reps.';
      return;
    }
    ex.sets.push({ weight: weight, reps: reps });
    const advance = ex.sets.length === 5;
    let label;
    if (!advance) label = 'Set ' + ex.sets.length + ' done. Next is set ' + (ex.sets.length + 1) + '.';
    else if (active.exerciseIndex < 2) label = ex.name + ' done. Next: ' + active.exercises[active.exerciseIndex + 1].name + '.';
    else label = 'Lifts done. Finisher is next.';
    const restSec = loadSettings().restSec;
    active.rest = {
      deadline: Date.now() + restSec * 1000,
      durationMs: restSec * 1000,
      restSec: restSec,
      advanceExercise: advance,
      label: label
    };
    editing = false;
    persistActive();
    render();
    setRestOpen(true);
  }

  function saveEdit() {
    const loc = lastSetLocation();
    if (!loc) return;
    const weight = parseWeight($('edit-weight').value);
    const reps = parseReps($('edit-reps').value);
    if (weight == null || reps == null) {
      const err = $('edit-error');
      if (err) err.textContent = 'Enter weight and whole reps.';
      return;
    }
    active.exercises[loc.exIndex].sets[loc.setIndex] = { weight: weight, reps: reps };
    editing = false;
    persistActive();
    render();
  }

  function setRestSeconds(sec) {
    if (!active || !active.rest) return;
    active.rest.deadline = Date.now() + sec * 1000;
    active.rest.durationMs = sec * 1000;
    active.rest.restSec = sec;
    saveSettings({ restSec: sec });
    persistActive();
    paintRest();
  }

  function addRest() {
    if (!active || !active.rest) return;
    active.rest.deadline += 30000;
    active.rest.durationMs += 30000;
    persistActive();
    paintRest();
  }

  function skipRest() {
    if (!active || !active.rest) return;
    active.rest.skip = true;
    active.rest.deadline = Date.now() - 1;
    if (runDeadlines()) render();
  }

  function toggleStretch() {
    const s = active.stretch;
    if (s.running) {
      s.remainingMs = Math.max(0, s.endsAt - Date.now());
      s.endsAt = null;
      s.running = false;
    } else {
      if (s.remainingMs <= 0) s.remainingMs = s.presetSec * 1000;
      s.endsAt = Date.now() + s.remainingMs;
      s.running = true;
    }
    persistActive();
    render();
  }

  function toggleFinisher() {
    const f = active.finisher;
    if (f.running) {
      f.elapsedMs = finisherElapsed();
      f.running = false;
      f.runningSince = null;
    } else {
      f.running = true;
      f.runningSince = Date.now();
    }
    persistActive();
    render();
  }

  function toggleCooldown() {
    const c = active.cooldown;
    if (c.running) {
      c.remainingMs = Math.max(0, c.endsAt - Date.now());
      c.endsAt = null;
      c.running = false;
    } else {
      if (c.remainingMs <= 0) c.remainingMs = 15 * 60 * 1000;
      c.endsAt = Date.now() + c.remainingMs;
      c.running = true;
      c.started = true;
    }
    persistActive();
    render();
  }

  function finishWorkout() {
    if (!active) return;
    if (active.cooldown.running) {
      active.cooldown.remainingMs = Math.max(0, active.cooldown.endsAt - Date.now());
      active.cooldown.running = false;
      active.cooldown.endsAt = null;
    }
    if (active.finisher.running) {
      active.finisher.elapsedMs = finisherElapsed();
      active.finisher.running = false;
      active.finisher.runningSince = null;
    }
    const record = {
      id: active.id,
      startedAt: active.startedAt,
      finishedAt: new Date().toISOString(),
      letter: active.letter,
      stretch: {
        completed: !!active.stretch.completed,
        skipped: !!active.stretch.skipped,
        presetSec: active.stretch.presetSec
      },
      exercises: active.exercises.map(function (ex) {
        return {
          name: ex.name,
          sets: (ex.sets || []).map(function (set) { return { weight: set.weight, reps: set.reps }; })
        };
      }),
      finisher: {
        done: !!active.finisher.done,
        skipped: !!active.finisher.skipped,
        kind: active.finisher.kind,
        seconds: Math.round((active.finisher.elapsedMs || 0) / 1000)
      },
      cooldown: {
        done: true,
        timerDone: !!active.cooldown.timerDone,
        started: !!active.cooldown.started,
        checks: (active.cooldown.checks || []).slice()
      }
    };
    const history = loadHistory();
    history.unshift(record);
    try { localStorage.setItem(KEY_HISTORY, JSON.stringify(history.slice(0, 300))); } catch (err) { /* quota */ }
    const letter = active.letter;
    active = null;
    pickedLetter = null;
    editing = false;
    persistActive();
    setRestOpen(false);
    view = 'home';
    render();
    showToast('Workout ' + letter + ' saved on this phone.');
  }

  function onClick(event) {
    const target = event.target.closest('[data-action]');
    if (!target || !$('app').contains(target)) return;
    const action = target.dataset.action;
    primeAudio();
    if (action === 'history') { view = 'history'; setRestOpen(false); render(); return; }
    if (action === 'home') { view = 'home'; setRestOpen(false); render(); return; }
    if (action === 'pick-day') { pickedLetter = target.dataset.day; render(); return; }
    if (action === 'start') { startWorkout(); return; }
    if (action === 'resume') { openSession(); return; }
    if (action === 'discard' || action === 'end') { discardActive(); return; }
    if (!active) return;
    if (action === 'stretch-preset') {
      const sec = Number(target.dataset.sec);
      active.stretch.presetSec = sec;
      active.stretch.remainingMs = sec * 1000;
      if (active.stretch.running) active.stretch.endsAt = Date.now() + active.stretch.remainingMs;
      persistActive();
      render();
      return;
    }
    if (action === 'stretch-toggle') { toggleStretch(); return; }
    if (action === 'stretch-skip') {
      active.stretch.running = false;
      active.stretch.endsAt = null;
      active.stretch.skipped = true;
      active.stretch.completed = false;
      active.phase = 'lifts';
      persistActive();
      render();
      return;
    }
    if (action === 'edit-toggle') { editing = !editing; render(); return; }
    if (action === 'finisher-kind') {
      active.finisher.kind = target.dataset.kind;
      persistActive();
      render();
      return;
    }
    if (action === 'finisher-toggle') { toggleFinisher(); return; }
    if (action === 'finisher-done') {
      if (!active.finisher.kind) {
        const err = $('form-error');
        if (err) err.textContent = 'Pick Run, Row, or Jump rope — or skip the finisher.';
        return;
      }
      if (active.finisher.running) {
        active.finisher.elapsedMs = finisherElapsed();
        active.finisher.running = false;
        active.finisher.runningSince = null;
      }
      active.finisher.done = true;
      active.finisher.skipped = false;
      active.phase = 'cooldown';
      persistActive();
      render();
      return;
    }
    if (action === 'finisher-skip') {
      if (active.finisher.running) {
        active.finisher.elapsedMs = finisherElapsed();
        active.finisher.running = false;
        active.finisher.runningSince = null;
      }
      active.finisher.skipped = true;
      active.finisher.done = false;
      active.phase = 'cooldown';
      persistActive();
      render();
      return;
    }
    if (action === 'cooldown-toggle') { toggleCooldown(); return; }
    if (action === 'check') {
      const name = target.dataset.name;
      const checks = active.cooldown.checks;
      const index = checks.indexOf(name);
      if (index >= 0) checks.splice(index, 1);
      else checks.push(name);
      persistActive();
      render();
      return;
    }
    if (action === 'finish') finishWorkout();
  }

  function onSubmit(event) {
    if (event.target.id !== 'set-form' && event.target.id !== 'edit-form') return;
    event.preventDefault();
    primeAudio();
    if (event.target.id === 'set-form') logSet();
    else saveEdit();
  }

  function onInput(event) {
    if (event.target.id === 'weight') refreshPlates();
  }

  function mount() {
    $('app').addEventListener('click', onClick);
    $('app').addEventListener('submit', onSubmit);
    $('app').addEventListener('input', onInput);
    $('rest').addEventListener('click', function (event) {
      const preset = event.target.closest('[data-rest]');
      if (preset) { primeAudio(); setRestSeconds(Number(preset.dataset.rest)); return; }
      if (event.target.id === 'rest-skip') { primeAudio(); skipRest(); return; }
      if (event.target.id === 'rest-add') { primeAudio(); addRest(); }
    });
    $('modal-ok').addEventListener('click', function () { closeModal(true); });
    $('modal-cancel').addEventListener('click', function () { closeModal(false); });
    $('modal').addEventListener('click', function (event) {
      if (event.target.id === 'modal') closeModal(false);
    });
    document.addEventListener('pointerdown', primeAudio);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') return;
      if (pendingAlert) { pendingAlert = false; beep(); buzz(); }
      if (runDeadlines()) render();
      else paintClocks();
    });
    active = loadActive();
    view = active ? 'session' : 'home';
    runDeadlines();
    render();
    if (active && active.rest && active.rest.deadline > Date.now()) setRestOpen(true);
    setInterval(function () {
      if (runDeadlines()) render();
      else paintClocks();
    }, 250);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(function () {});
  }

  const api = {
    PROGRAM: PROGRAM,
    ORDER: ORDER,
    plateLine: plateLine,
    platesFor: platesFor,
    suggestLetter: suggestLetter,
    nextWeightFromHistory: nextWeightFromHistory,
    formatWork: formatWork,
    parseWeight: parseWeight,
    parseReps: parseReps
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document !== 'undefined') mount();
})();
