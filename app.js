/* ───────────────────────────────────────────
   Spartan Workout — app.js
   A robust, mobile-ready training suite.
─────────────────────────────────────────── */

// ─── SVG GRADIENT for ring progress ──────────
document.body.insertAdjacentHTML('beforeend', `
<svg width="0" height="0" style="position:absolute;pointer-events:none">
  <defs>
    <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color: var(--accent)"/>
      <stop offset="100%" style="stop-color: var(--accent2)"/>
    </linearGradient>
  </defs>
</svg>`);

// ─── ICONS ──────────────────────────────────
const ICONS = ['🏋️','🤸','🏃','💪','🦵','🧘','🚴','⚡','🎯','🔥','🥊','🧗'];

// ─── AUDIO SYSTEM (Web Audio API) ─────────────
const AUDIO = {
  ctx: null,
  init() { if(!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); },
  beep(freq, type, dur, vol=0.1) {
    if(!this.ctx) return;
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(); osc.stop(this.ctx.currentTime + dur);
  },
  playStart() { this.beep(880, 'sine', 0.5, 0.15); },
  playTick()  { this.beep(660, 'sine', 0.1, 0.05); },
  playEnd()   { 
    setTimeout(()=>this.beep(440, 'triangle', 0.6), 0); 
    setTimeout(()=>this.beep(660, 'triangle', 0.8, 0.2), 200); 
  }
};
document.body.addEventListener('click', () => AUDIO.init(), {once:true});

// ─── DATA PERSISTENCE ────────────────────────
let data = {
  trainings: [
    {
      id: 't1', name: 'Spartan Basics', icon: '🏋️', breakMin: 2,
      exercises: [
        { id: 'e1', name: 'Push-ups', sets: 3, secsPerSet: 45, mode: 'time' },
        { id: 'e2', name: 'Squats',   sets: 3, secsPerSet: 45, mode: 'time' },
      ]
    }
  ],
  history: []
};

let _saveTimer = null;
function save() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    try { localStorage.setItem('wt_data', JSON.stringify(data)); } catch(e){}
  }, 300);
}
function load() { 
  try { 
    const s = localStorage.getItem('wt_data'); 
    if (s) data = JSON.parse(s); 
    if(!data.history) data.history = [];
    if(!data.schedule) data.schedule = {};
    data.trainings.forEach(t => t.exercises.forEach(e => { if(!e.mode) e.mode = 'time'; }));
  } catch(e){} 
}
load();

// ─── UTILITIES ────────────────────────────────
function uid()       { return '_' + Math.random().toString(36).slice(2,9); }
function esc(s)      { return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fmtMin(sec) { return Math.ceil(sec/60); }
function fmtSec(sec) { 
  const m=Math.floor(sec/60), s=sec%60; 
  if (m > 0) return `${m}:${s.toString().padStart(2, '0')}`;
  return `${s}s`;
}

// ─── SCREEN NAVIGATION ────────────────────────
const SCREENS = {
  list:   document.getElementById('screen-list'),
  detail: document.getElementById('screen-detail'),
  timer:  document.getElementById('screen-timer'),
  finish: document.getElementById('screen-finish'),
};
let curScreen = 'list';

// ─── THEME TOGGLE ────────────────────────────
const themeToggleBtn = document.getElementById('btn-theme-toggle');
if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('theme-neon');
    const isNeon = document.body.classList.contains('theme-neon');
    localStorage.setItem('wt_theme', isNeon ? 'neon' : 'spartan');
  });
  if (localStorage.getItem('wt_theme') === 'neon') {
    document.body.classList.add('theme-neon');
  }
}

function showScreen(name, back = false) {
  if (name === curScreen) return;
  const prev = SCREENS[curScreen];
  const next = SCREENS[name];
  prev.classList.remove('active');
  next.classList.remove('back-anim');
  if (back) next.classList.add('back-anim');
  next.classList.add('active');
  const scrollable = next.querySelector('[class$="-content"]') || next;
  scrollable.scrollTop = 0;
  curScreen = name;

  // Push a new history entry only when navigating forward (not on back animation)
  if (!back) {
    history.pushState({ screen: name }, '', '');
  }
}

// Handle hardware/browser back button
window.addEventListener('popstate', () => {
  // 1. Close any open modal first
  const openModal = document.querySelector('.modal-overlay:not(.hidden)');
  if (openModal) {
    openModal.classList.add('hidden');
    history.pushState({ screen: curScreen }, '', ''); // restore entry consumed by this back
    return;
  }

  // 2. Navigate between screens
  switch (curScreen) {
    case 'timer':
      clearInterval(TS.interval);
      releaseWakeLock();
      // restore UI without pushing new entry (we're going "back")
      SCREENS.timer.classList.remove('active');
      SCREENS.detail.classList.add('active');
      curScreen = 'detail';
      renderDetail();
      break;
    case 'finish':
      SCREENS.finish.classList.remove('active');
      SCREENS.list.classList.add('active');
      curScreen = 'list';
      renderList();
      break;
    case 'detail':
      SCREENS.detail.classList.remove('active');
      SCREENS.list.classList.add('back-anim');
      SCREENS.list.classList.add('active');
      curScreen = 'list';
      renderList();
      break;
    // 'list' — nothing to do, browser exits or goes back to real previous page
  }
});

// Seed the initial history entry so there's always one to pop back to
history.replaceState({ screen: 'list' }, '', '');

// ─── DASHBOARD (List Screen) ───────────────────
function renderList() {
  const list = document.getElementById('training-list');
  list.innerHTML = '';
  if (data.trainings.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">📂</div>No workouts yet.<br>Click + to create one!</div>`;
    return;
  }
  data.trainings.forEach(t => {
    let exSec = 0;
    let brkSec = 0;
    let totalSets = 0;
    const isCircuit = t.type === 'circuit';
    
    if (isCircuit) {
      const sum1Cycle = t.exercises.reduce((a,e) => a + e.secsPerSet, 0);
      const cycles = t.cycles || 3;
      exSec = sum1Cycle * cycles;
      brkSec = Math.max(0, cycles - 1) * t.breakMin * 60;
      totalSets = t.exercises.length * cycles;
    } else {
      exSec = t.exercises.reduce((a,e) => a + e.sets * e.secsPerSet, 0);
      brkSec = Math.max(0, t.exercises.length - 1) * t.breakMin * 60;
      totalSets = t.exercises.reduce((a,e) => a + e.sets, 0);
    }
    
    const totalMin = Math.ceil((exSec + brkSec) / 60);

    const card = document.createElement('div');
    card.className = 'training-card';
    card.innerHTML = `
      <div class="card-left">
        <div class="card-icon" style="${t.icon && t.icon.startsWith('data:image') ? `background-image:url('${t.icon}'); font-size:0;` : ''}">${t.icon && !t.icon.startsWith('data:image') ? t.icon : ''}</div>
        <div class="card-info">
          <div class="card-name">${esc(t.name)}</div>
          <div class="card-meta">${t.exercises.length} ex · ${isCircuit ? (t.cycles||3)+' cycles' : totalSets+' sets'} · ~${totalMin} min</div>
        </div>
      </div>
      <div class="card-actions" style="position:relative; z-index:2;">
        <button class="card-action-btn btn-delete-training" title="Delete">
          <svg style="pointer-events:none;" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
      <svg class="card-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

    card.addEventListener('click', e => {
      if (e.target.closest('.btn-delete-training')) return;
      openDetail(t.id);
    });
    card.querySelector('.btn-delete-training').addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      confirmDel(`Delete workout "${t.name}"?`, () => {
        data.trainings = data.trainings.filter(x => x.id !== t.id);
        save();
        renderList();
      });
    });
    list.appendChild(card);
  });
}

// ─── TABS & HISTORY ────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', e => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-view').forEach(v => v.classList.remove('active'));
    e.target.classList.add('active');
    const tab = e.target.getAttribute('data-tab');
    document.getElementById('view-' + tab).classList.add('active');
    if(tab === 'history') renderHistory();
  });
});

let curDate = new Date();
function renderHistory() {
  const hList = document.getElementById('history-list');
  hList.innerHTML = '';
  
  if(!data.history.length) {
    hList.innerHTML = '<div class="empty-state" style="padding:2rem"><p>No history yet</p></div>';
  } else {
    const sorted = [...data.history].sort((a,b)=>b.ts - a.ts);
    sorted.forEach(h => {
      const el = document.createElement('div');
      el.className = 'history-item';
      let d = new Date(h.ts);
      let dateStr = d.toLocaleDateString('en-US', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
      el.innerHTML = `
        <div class="history-item-left">
          <div class="history-item-name">${esc(h.name)}</div>
          <div class="history-item-date">${dateStr} · ${h.exCount} ex</div>
        </div>
        <div class="history-item-right">${fmtMin(h.elapsed)} m</div>
      `;
      hList.appendChild(el);
    });
  }

  const totalSecs = data.history.reduce((acc, h) => acc + (h.elapsed||0), 0);
  document.getElementById('hist-total-time').textContent = fmtMin(totalSecs) + 'm';
  document.getElementById('hist-total-workouts').textContent = data.history.length;
  renderCalendar();
}

function renderCalendar() {
  const y = curDate.getFullYear(), m = curDate.getMonth();
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('cal-month-year').textContent = months[m] + ' ' + y;
  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = '';
  
  let firstDay = new Date(y, m, 1).getDay();
  if (firstDay === 0) firstDay = 7; // monday start
  const daysInMonth = new Date(y, m+1, 0).getDate();

  const frag = document.createDocumentFragment();
  for(let i=1; i<firstDay; i++) {
    const el = document.createElement('div');
    el.className = 'cal-day empty';
    frag.appendChild(el);
  }

  const activeDays = new Set(data.history.map(h => {
    const d = new Date(h.ts);
    if(d.getFullYear()===y && d.getMonth()===m) return d.getDate();
    return -1;
  }));

  for(let i=1; i<=daysInMonth; i++) {
    const el = document.createElement('div');
    const isoDateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
    let c = 'cal-day';
    if(activeDays.has(i)) c += ' active';
    if(data.schedule[isoDateStr] && data.schedule[isoDateStr].length > 0) c += ' scheduled';
    
    el.className = c;
    el.textContent = i;
    el.dataset.date = isoDateStr;
    el.addEventListener('click', () => openScheduleModal(isoDateStr));
    frag.appendChild(el);
  }
  grid.appendChild(frag);
}

// ─── SCHEDULE MODAL ─────────────────────────
let curScheduleDate = null;
function openScheduleModal(dateStr) {
  curScheduleDate = dateStr;
  const d = new Date(dateStr);
  document.getElementById('modal-schedule-title').textContent = d.toLocaleDateString('en-US', { day:'numeric', month:'long', year:'numeric' });
  renderScheduleList();
  
  const sel = document.getElementById('schedule-select');
  sel.innerHTML = '<option value="" disabled selected>Select workout...</option>';
  data.trainings.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    sel.appendChild(opt);
  });
  
  document.getElementById('modal-schedule').classList.remove('hidden');
}

function renderScheduleList() {
  const list = document.getElementById('schedule-list');
  list.innerHTML = '';
  const arr = data.schedule[curScheduleDate] || [];
  if (!arr.length) {
    list.innerHTML = '<div style="color:var(--muted); font-size:0.85rem; text-align:center; margin-top:0.5rem">Nothing planned yet.</div>';
    return;
  }
  arr.forEach((tId, idx) => {
    const t = data.trainings.find(x => x.id === tId);
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.justifyContent = 'space-between';
    div.style.padding = '0.5rem';
    div.style.background = 'rgba(255,255,255,0.05)';
    div.style.borderRadius = '6px';
    div.innerHTML = `
      <span>${t ? esc(t.name) : 'Unknown'}</span>
      <button class="btn-icon" style="width:28px; height:28px; border:none; background:transparent" title="Remove">✕</button>
    `;
    div.querySelector('button').addEventListener('click', () => {
      data.schedule[curScheduleDate].splice(idx, 1);
      save();
      renderScheduleList();
      renderCalendar();
    });
    list.appendChild(div);
  });
}

document.getElementById('btn-schedule-close').addEventListener('click', () => {
  document.getElementById('modal-schedule').classList.add('hidden');
});

document.getElementById('btn-schedule-add').addEventListener('click', () => {
  const tId = document.getElementById('schedule-select').value;
  if (!tId) return;
  if (!data.schedule[curScheduleDate]) data.schedule[curScheduleDate] = [];
  data.schedule[curScheduleDate].push(tId);
  save();
  renderScheduleList();
  renderCalendar();
  document.getElementById('schedule-select').value = '';
});

document.getElementById('cal-prev').addEventListener('click', () => {
  const d = new Date(curDate.getFullYear(), curDate.getMonth() - 1, 1);
  curDate = d;
  renderCalendar();
});
document.getElementById('cal-next').addEventListener('click', () => {
  const d = new Date(curDate.getFullYear(), curDate.getMonth() + 1, 1);
  curDate = d;
  renderCalendar();
});
document.getElementById('btn-add-training').addEventListener('click', () => openTrainingModal(null));

// ─── DETAIL SCREEN ───────────────────────────
let curTrainingId = null;
const getT = () => data.trainings.find(t => t.id === curTrainingId);

function openDetail(id) {
  curTrainingId = id;
  renderDetail();
  showScreen('detail');
}

function renderDetail() {
  const t = getT(); if (!t) return;
  document.getElementById('detail-name').textContent = t.name;
  document.getElementById('break-value').textContent  = t.breakMin;

  const isCircuit = t.type === 'circuit';
  let exSec = 0;
  let brkSec = 0;
  
  if (isCircuit) {
    const sum1Cycle = t.exercises.reduce((a,e) => a + e.secsPerSet, 0);
    const cycles = t.cycles || 3;
    exSec = sum1Cycle * cycles;
    brkSec = Math.max(0, cycles - 1) * t.breakMin * 60;
  } else {
    exSec = t.exercises.reduce((a,e) => a + e.sets * e.secsPerSet, 0);
    brkSec = Math.max(0, t.exercises.length-1) * t.breakMin * 60;
  }
  
  document.querySelector('#stat-exercises .stat-num').textContent = t.exercises.length;
  document.querySelector('#stat-duration  .stat-num').textContent = fmtMin(exSec + brkSec);
  document.querySelector('#stat-break     .stat-num').textContent = t.breakMin;

  const el = document.getElementById('exercise-list');
  el.innerHTML = '';
  t.exercises.forEach((ex, i) => {
    const item = document.createElement('div');
    item.className = 'exercise-item';
    item.dataset.id = ex.id;
    
    // In circuit mode, we don't display the number of sets on each exercise
    let metaTxt;
    if (isCircuit) {
       metaTxt = `${ex.mode==='reps' ? 'Manual' : ex.secsPerSet+'s'} · ${ex.mode==='reps' ? '---' : fmtSec(ex.secsPerSet)}`;
    } else {
       metaTxt = `${ex.sets} sets · ${ex.mode==='reps' ? 'Manual' : ex.secsPerSet+'s/set'} · ${ex.mode==='reps' ? '---' : fmtSec(ex.sets * ex.secsPerSet)}`;
    }

    item.innerHTML = `
      <div class="drag-handle" title="Drag to reorder">≡</div>
      <div class="exercise-num">${i+1}</div>
      <div class="exercise-info">
        <div class="exercise-name">${esc(ex.name)}</div>
        <div class="exercise-meta">${metaTxt}</div>
      </div>
      <div class="exercise-btns">
        <button class="ex-btn edit" title="Edit">
          <svg style="pointer-events:none;" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="ex-btn btn-delete-ex" title="Delete">
          <svg style="pointer-events:none;" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`;
    item.querySelector('.edit').addEventListener('click', () => openExModal(ex.id));
    item.querySelector('.btn-delete-ex').addEventListener('click', () => {
      confirmDel(`Delete "${ex.name}"?`, () => { 
        t.exercises = t.exercises.filter(x=>x.id!==ex.id); 
        save(); renderDetail(); 
      });
    });
    el.appendChild(item);
  });
  
  if (t.exercises.length > 1 && window.Sortable) {
    if (el._sortable) el._sortable.destroy();
    el._sortable = new Sortable(el, {
      handle: '.drag-handle',
      animation: 200,
      onEnd: function (evt) {
        const moved = t.exercises.splice(evt.oldIndex, 1)[0];
        t.exercises.splice(evt.newIndex, 0, moved);
        save();
        renderDetail();
      }
    });
  }
}

document.getElementById('btn-back').addEventListener('click', () => { showScreen('list', true); renderList(); });
document.getElementById('btn-edit-training').addEventListener('click', () => { const t=getT(); if(t) openTrainingModal(t.id); });
document.getElementById('break-minus').addEventListener('click', () => { const t=getT(); if(t&&t.breakMin>1){t.breakMin--;save();renderDetail();} });
document.getElementById('break-plus' ).addEventListener('click', () => { const t=getT(); if(t&&t.breakMin<60){t.breakMin++;save();renderDetail();} });
document.getElementById('btn-add-exercise').addEventListener('click', () => openExModal(null));

// ─── TRAINING MODAL ──────────────────────────
let editTId = null;
let currentModalIcon = '';

// Shared avatar preview function used by both training and exercise modals
function setAvatarPreview(previewEl, value) {
  if (value && value.startsWith('data:image')) {
    previewEl.style.backgroundImage = `url('${value}')`;
    previewEl.textContent = '';
  } else {
    previewEl.style.backgroundImage = 'none';
    previewEl.textContent = value || '';
  }
}
function updateAvatarPreview()   { setAvatarPreview(document.getElementById('modal-avatar-preview'),    currentModalIcon);  }
function updateExAvatarPreview() { setAvatarPreview(document.getElementById('modal-ex-avatar-preview'), currentExModalIcon); }

document.getElementById('input-training-photo').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_SIZE = 120;
      let w = img.width, h = img.height;
      if (w > h) { if (w > MAX_SIZE) { h *= MAX_SIZE / w; w = MAX_SIZE; } } 
      else { if (h > MAX_SIZE) { w *= MAX_SIZE / h; h = MAX_SIZE; } }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      currentModalIcon = canvas.toDataURL('image/jpeg', 0.82);
      updateAvatarPreview();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

document.getElementById('modal-avatar-picker').addEventListener('click', () => {
  document.getElementById('input-training-photo').click();
});

document.querySelectorAll('input[name="tr-mode"]').forEach(r => {
  r.addEventListener('change', e => {
    document.getElementById('label-tr-cycles').style.display = e.target.value === 'circuit' ? '' : 'none';
  });
});

function openTrainingModal(id) {
  editTId = id;
  const t = id ? data.trainings.find(x=>x.id===id) : null;
  document.getElementById('modal-training-title').textContent = id ? 'Edit workout' : 'New workout';
  document.getElementById('input-training-name').value = t ? t.name : '';
  
  const mode = t && t.type === 'circuit' ? 'circuit' : 'standard';
  const modeInput = document.querySelector(`input[name="tr-mode"][value="${mode}"]`);
  if(modeInput) modeInput.checked = true;
  document.getElementById('label-tr-cycles').style.display = mode === 'circuit' ? '' : 'none';
  document.getElementById('input-training-cycles').value = t ? (t.cycles || 3) : 3;

  currentModalIcon = t && t.icon ? t.icon : ICONS[Math.floor(Math.random()*ICONS.length)];
  updateAvatarPreview();
  document.getElementById('modal-training').classList.remove('hidden');
  document.getElementById('input-training-photo').value = '';
  setTimeout(() => document.getElementById('input-training-name').focus(), 80);
}
document.getElementById('btn-modal-cancel').addEventListener('click', () => document.getElementById('modal-training').classList.add('hidden'));
document.getElementById('btn-modal-save').addEventListener('click', () => {
  const name = document.getElementById('input-training-name').value.trim();
  const typeEl = document.querySelector('input[name="tr-mode"]:checked');
  const type = typeEl ? typeEl.value : 'standard';
  const cycles = parseInt(document.getElementById('input-training-cycles').value) || 3;
  if(!name){ document.getElementById('input-training-name').focus(); return; }
  if(editTId) { const t=data.trainings.find(x=>x.id===editTId); if(t) { t.name=name; t.icon = currentModalIcon; t.type=type; t.cycles=cycles; } }
  else data.trainings.push({ id:uid(), name, breakMin:5, icon:currentModalIcon, type, cycles, exercises:[] });
  save();
  document.getElementById('modal-training').classList.add('hidden');
  if(editTId && curScreen==='detail') renderDetail();
  else renderList();
});
document.getElementById('input-training-name').addEventListener('keydown', e=>{ if(e.key==='Enter') document.getElementById('btn-modal-save').click(); });

// ─── EXERCISE MODAL ──────────────────────────
let editExId = null;
let currentExModalIcon = '';


document.getElementById('input-ex-photo').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_SIZE = 250;
      let w = img.width, h = img.height;
      if (w > h) { if (w > MAX_SIZE) { h *= MAX_SIZE / w; w = MAX_SIZE; } } 
      else { if (h > MAX_SIZE) { w *= MAX_SIZE / h; h = MAX_SIZE; } }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      currentExModalIcon = canvas.toDataURL('image/jpeg', 0.85);
      updateExAvatarPreview();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

document.getElementById('modal-ex-avatar-picker').addEventListener('click', () => {
  document.getElementById('input-ex-photo').click();
});

function openExModal(id) {
  editExId = id;
  const t = getT(); if(!t) return;
  const ex = id ? t.exercises.find(x=>x.id===id) : null;
  document.getElementById('modal-exercise-title').textContent = id ? 'Edit exercise' : 'Add exercise';
  document.getElementById('input-exercise-name').value = ex ? ex.name : '';
  currentExModalIcon = ex && ex.image ? ex.image : '';
  updateExAvatarPreview();
  const modeVal = ex ? (ex.mode || 'time') : 'time';
  document.querySelector(`input[name="ex-mode"][value="${modeVal}"]`).checked = true;
  document.getElementById('input-exercise-sets').value = ex ? ex.sets : 3;
  document.getElementById('input-exercise-secs').value = ex ? ex.secsPerSet : 30;
  document.getElementById('label-secs').style.display = (modeVal === 'reps') ? 'none' : '';
  
  const isCircuit = t.type === 'circuit';
  document.getElementById('label-ex-sets').style.display = isCircuit ? 'none' : '';
  
  document.getElementById('modal-exercise').classList.remove('hidden');
  document.getElementById('input-ex-photo').value = '';
  setTimeout(() => document.getElementById('input-exercise-name').focus(), 80);
}

document.querySelectorAll('input[name="ex-mode"]').forEach(r => {
  r.addEventListener('change', e => {
    document.getElementById('label-secs').style.display = e.target.value === 'reps' ? 'none' : '';
  });
});

document.getElementById('btn-ex-cancel').addEventListener('click', ()=>document.getElementById('modal-exercise').classList.add('hidden'));
document.getElementById('btn-ex-save').addEventListener('click', ()=>{
  const name = document.getElementById('input-exercise-name').value.trim();
  const sets = parseInt(document.getElementById('input-exercise-sets').value)||3;
  const secs = parseInt(document.getElementById('input-exercise-secs').value)||30;
  const mode = document.querySelector('input[name="ex-mode"]:checked').value;
  if(!name){ document.getElementById('input-exercise-name').focus(); return; }
  const t=getT(); if(!t) return;
  if(editExId) { const ex=t.exercises.find(x=>x.id===editExId); if(ex){ex.name=name;ex.sets=sets;ex.secsPerSet=secs;ex.mode=mode;ex.image=currentExModalIcon;} }
  else t.exercises.push({id:uid(),name,sets,secsPerSet:secs,mode,image:currentExModalIcon});
  save();
  document.getElementById('modal-exercise').classList.add('hidden');
  renderDetail();
});

// ─── CONFIRM MODAL ───────────────────────────
let _confirmCb = null;
function confirmDel(text, cb) {
  _confirmCb = cb;
  document.getElementById('confirm-text').textContent = text;
  document.getElementById('modal-confirm').classList.remove('hidden');
}
document.getElementById('btn-confirm-no' ).addEventListener('click',()=>{ document.getElementById('modal-confirm').classList.add('hidden'); _confirmCb=null; });
document.getElementById('btn-confirm-yes').addEventListener('click',()=>{ document.getElementById('modal-confirm').classList.add('hidden'); if(_confirmCb){_confirmCb();_confirmCb=null;} });
['modal-training','modal-exercise','modal-confirm'].forEach(id=>{
  document.getElementById(id).addEventListener('click',e=>{if(e.target.id===id)e.target.classList.add('hidden');});
});

// ─── TIMER ENGINE ────────────────────────────
const TS = {
  steps: [], idx: 0, secsLeft: 0,
  interval: null, paused: false,
  startTime: 0,   
  wakeLock: null,
};

async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try { TS.wakeLock = await navigator.wakeLock.request('screen'); } 
    catch (err) { console.error(`${err.name}, ${err.message}`); }
  }
}
function releaseWakeLock() {
  if (TS.wakeLock) { TS.wakeLock.release().then(() => { TS.wakeLock = null; }); }
}

function buildSteps(t) {
  const steps = [];
  if (t.type === 'circuit') {
    const cycles = t.cycles || 3;
    for (let c = 1; c <= cycles; c++) {
      t.exercises.forEach(ex => {
        steps.push({ type:'exercise', exName:ex.name, setIdx:c, setsTotal:cycles, duration:ex.secsPerSet, mode: ex.mode||'time', image: ex.image });
      });
      if (c < cycles) {
        steps.push({ type:'break', exName:'Break', setIdx:0, setsTotal:0, duration:t.breakMin * 60 });
      }
    }
  } else {
    t.exercises.forEach((ex, ei) => {
      for (let s = 1; s <= ex.sets; s++) {
        steps.push({ type:'exercise', exName:ex.name, setIdx:s, setsTotal:ex.sets, duration:ex.secsPerSet, mode: ex.mode||'time', image: ex.image });
      }
      if (ei < t.exercises.length - 1) {
        steps.push({ type:'break', exName:'Break', setIdx:0, setsTotal:0, duration:t.breakMin * 60 });
      }
    });
  }
  return steps;
}

document.getElementById('btn-start-training').addEventListener('click', () => {
  const t = getT();
  if (!t || !t.exercises.length) { alert('Add at least one exercise!'); return; }
  TS.steps   = buildSteps(t);
  TS.idx     = 0;
  TS.paused  = false;
  TS.startTime = Date.now();
  document.getElementById('pause-icon').style.display = '';
  document.getElementById('play-icon' ).style.display = 'none';
  showScreen('timer');
  loadStep(0);
  startInterval();
  requestWakeLock();
});

function loadStep(idx) {
  if (idx >= TS.steps.length) { finishTraining(); return; }
  const step = TS.steps[idx];
  TS.secsLeft = step.mode === 'reps' ? 0 : step.duration;
  renderTimerUI();
}

function renderTimerUI() {
  const step = TS.steps[TS.idx];
  if (!step) return;

  const pl = document.getElementById('phase-label');
  if (step.type === 'break') {
    pl.textContent = '⏸  Break';
    pl.className = 'phase-label is-break';
  } else {
    pl.textContent = '💪  Exercise';
    pl.className = 'phase-label';
  }

  const exNameDisplay = step.type === 'break' ? 'Break' : step.exName;
  document.getElementById('timer-training-name').textContent = exNameDisplay;
  document.getElementById('timer-exercise-name').textContent = step.exName;

  const setsRow = document.getElementById('sets-row');
  setsRow.innerHTML = '';
  if (step.type === 'exercise') {
    for (let i = 1; i <= step.setsTotal; i++) {
      const b = document.createElement('div');
      b.className = 'set-badge' + (i < step.setIdx ? ' done' : i === step.setIdx ? ' active' : '');
      b.textContent = i;
      setsRow.appendChild(b);
    }
  }

  const info = document.getElementById('timer-sets-info');
  if (step.type === 'exercise') {
    info.textContent = `Set ${step.setIdx} of ${step.setsTotal}`;
  } else {
    info.textContent = `Rest period · ${fmtSec(step.duration)}`;
  }

  const nextStep = TS.steps[TS.idx + 1];
  const nextEl = document.getElementById('next-preview');
  if (nextStep) {
    nextEl.style.display = '';
    if (nextStep.type === 'break') {
      nextEl.innerHTML = `Next: <span>⏸ Break ${fmtSec(nextStep.duration)}</span>`;
    } else {
      nextEl.innerHTML = `Next: <span>${esc(nextStep.exName)} — set ${nextStep.setIdx}/${nextStep.setsTotal}</span>`;
    }
  } else {
    nextEl.innerHTML = `Next: <span>🏆 Finish!</span>`;
  }

  const imgEl = document.getElementById('timer-exercise-image');
  if (step.image && step.image.startsWith('data:image')) {
    imgEl.style.backgroundImage = `url('${step.image}')`;
    imgEl.style.display = '';
  } else {
    imgEl.style.display = 'none';
  }

  updateCountdown();
  updateDots();
  updateOverall();
  AUDIO.playStart();
}

function updateCountdown() {
  const step = TS.steps[TS.idx]; if (!step) return;
  const secs = TS.secsLeft;
  const isReps = step.mode === 'reps';

  const el = document.getElementById('timer-seconds');
  const btnDone = document.getElementById('btn-manual-done');
  
  el.textContent = fmtSec(secs);
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');

  if (isReps) {
    btnDone.style.display = 'block';
    document.getElementById('ring-progress').style.strokeDashoffset = 0;
    document.getElementById('ring-glow').style.strokeDashoffset = 0;
  } else {
    btnDone.style.display = 'none';
    const circ = 534.07;
    const fraction = Math.max(0, secs / step.duration);
    const offset = circ * (1 - fraction);
    document.getElementById('ring-progress').style.strokeDashoffset = offset;
    document.getElementById('ring-glow').style.strokeDashoffset = offset;
  }
}

document.getElementById('btn-manual-done').addEventListener('click', () => {
  AUDIO.playTick();
  TS.idx++;
  loadStep(TS.idx);
});

function updateOverall() {
  const pct = TS.steps.length ? (TS.idx / TS.steps.length) * 100 : 0;
  document.getElementById('overall-bar').style.width = pct + '%';
  document.getElementById('overall-label').textContent = `Step ${TS.idx + 1} of ${TS.steps.length}`;
}

function updateDots() {
  const c = document.getElementById('step-indicator');
  c.innerHTML = '';
  const max = Math.min(TS.steps.length, 24);
  for (let i = 0; i < max; i++) {
    const d = document.createElement('div');
    d.className = 'step-dot' + (i < TS.idx ? ' done' : i === TS.idx ? ' active' : '');
    c.appendChild(d);
  }
}

function startInterval() {
  clearInterval(TS.interval);
  TS.interval = setInterval(() => {
    if (TS.paused) return;
    const step = TS.steps[TS.idx];
    if (!step) return; // guard: can happen if navigating fast
    if (step.mode === 'reps') {
      TS.secsLeft++;
      updateCountdown();
    } else {
      TS.secsLeft--;
      if (TS.secsLeft <= 3 && TS.secsLeft > 0) AUDIO.playTick();
      if (TS.secsLeft <= 0) {
        TS.idx++;
        loadStep(TS.idx);
      } else {
        updateCountdown();
      }
    }
  }, 1000);
}

document.getElementById('btn-pause-timer').addEventListener('click', () => {
  TS.paused = !TS.paused;
  document.getElementById('pause-icon').style.display = TS.paused ? 'none' : '';
  document.getElementById('play-icon' ).style.display = TS.paused ? '' : 'none';
});
document.getElementById('btn-prev-set').addEventListener('click', () => {
  if (TS.idx > 0) TS.idx--;
  loadStep(TS.idx);
});
document.getElementById('btn-next-set').addEventListener('click', () => {
  TS.idx++;
  loadStep(TS.idx);
});
document.getElementById('btn-stop-training').addEventListener('click', () => {
  clearInterval(TS.interval);
  releaseWakeLock();
  showScreen('detail', true);
});

function finishTraining() {
  clearInterval(TS.interval);
  releaseWakeLock();
  AUDIO.playEnd();
  const t = getT();
  const elapsed = Math.round((Date.now() - TS.startTime) / 1000);
  const exCount  = t ? t.exercises.length : 0;
  const setCount = t ? t.exercises.reduce((a,e)=>a+e.sets, 0) : 0;
  document.getElementById('finish-ex-count' ).textContent = exCount;
  document.getElementById('finish-set-count').textContent = setCount;
  document.getElementById('finish-time'     ).textContent = fmtSec(elapsed);
  if (t) {
    data.history.push({ ts: Date.now(), trainId: t.id, name: t.name, elapsed, exCount });
    save();
  }
  showScreen('finish');
}

document.getElementById('btn-finish-back').addEventListener('click', () => { showScreen('list', true); renderList(); });

// ─── INITIALIZE ───────────────────────────────
renderList();

// ─── SETTINGS & THEME ──────────────────────
document.getElementById('btn-settings').addEventListener('click', () => {
  document.getElementById('modal-settings').classList.remove('hidden');
});
document.getElementById('btn-settings-close').addEventListener('click', () => {
  document.getElementById('modal-settings').classList.add('hidden');
});
document.getElementById('modal-settings').addEventListener('click', e => {
  if(e.target.id === 'modal-settings') e.target.classList.add('hidden');
});

const themeRadios = document.querySelectorAll('input[name="themeSelector"]');
themeRadios.forEach(r => {
  r.addEventListener('change', e => {
    const t = e.target.value;
    localStorage.setItem('wt_theme', t);
    applyTheme(t);
  });
});

function applyTheme(t) {
  if (t === 'neon') {
    document.body.classList.add('theme-neon');
    document.querySelector('input[name="themeSelector"][value="neon"]').checked = true;
  } else {
    document.body.classList.remove('theme-neon');
    document.querySelector('input[name="themeSelector"][value="default"]').checked = true;
  }
}
applyTheme(localStorage.getItem('wt_theme') || 'default');

// ─── I18N TRANSLATIONS ────────────────────────
const TRANSLATIONS = {
  en: {
    dashboard: 'Dashboard', workouts: 'Workouts', history: 'History',
    workoutLog: 'Workout log', exercises: 'exercises', totalMin: 'total min',
    pauseMin: 'pause min', breakBetween: '⏸ Break between exercises', min: 'min',
    startWorkout: 'Start workout', workoutCompleted: 'Workout\ncompleted!',
    keepItUp: 'Great job, keep it up!', backToWorkouts: 'Back to workouts',
    settings: 'Settings', appTheme: 'App Theme', language: 'Language', close: 'Close',
    noWorkouts: 'No workouts.\nPress «+» to add.', noHistory: 'No history yet',
    totalTime: 'Total time', addExercise: 'Add exercise',
    plannedWorkouts: 'Planned workouts:', addWorkout: 'Add a workout', addBtn: 'Add',
    nothingPlanned: 'Nothing planned yet.',
    'break': 'Break', cycle: 'Cycle',
  },
  ru: {
    dashboard: 'Главная', workouts: 'Тренировки', history: 'История',
    workoutLog: 'Журнал тренировок', exercises: 'упражнений', totalMin: 'минут всего',
    pauseMin: 'минут паузы', breakBetween: '⏸ Пауза между упражнениями', min: 'мин',
    startWorkout: 'Начать тренировку', workoutCompleted: 'Тренировка\nзавершена!',
    keepItUp: 'Отличная работа, продолжай!', backToWorkouts: 'К тренировкам',
    settings: 'Настройки', appTheme: 'Тема приложения', language: 'Язык', close: 'Закрыть',
    noWorkouts: 'Нет тренировок.\nНажми «+» чтобы добавить.', noHistory: 'История пуста',
    totalTime: 'Общее время', addExercise: 'Добавить упражнение',
    plannedWorkouts: 'Запланированные:', addWorkout: 'Добавить тренировку', addBtn: 'Добавить',
    nothingPlanned: 'Ничего не запланировано.',
    'break': 'Отдых', cycle: 'Круг',
  },
  de: {
    dashboard: 'Dashboard', workouts: 'Workouts', history: 'Verlauf',
    workoutLog: 'Trainingsprotokoll', exercises: 'Übungen', totalMin: 'Min gesamt',
    pauseMin: 'Pause Min', breakBetween: '⏸ Pause zwischen Übungen', min: 'Min',
    startWorkout: 'Training starten', workoutCompleted: 'Training\nabgeschlossen!',
    keepItUp: 'Super, weiter so!', backToWorkouts: 'Zurück zu Workouts',
    settings: 'Einstellungen', appTheme: 'App-Design', language: 'Sprache', close: 'Schließen',
    noWorkouts: 'Keine Workouts.\n«+» drücken um hinzuzufügen.', noHistory: 'Noch kein Verlauf',
    totalTime: 'Gesamtzeit', addExercise: 'Übung hinzufügen',
    plannedWorkouts: 'Geplante Workouts:', addWorkout: 'Workout hinzufügen', addBtn: 'Hinzufügen',
    nothingPlanned: 'Noch nichts geplant.',
    'break': 'Pause', cycle: 'Runde',
  }
};

let currentLang = localStorage.getItem('wt_lang') || 'en';

function t(key) {
  return (TRANSLATIONS[currentLang] && TRANSLATIONS[currentLang][key]) || TRANSLATIONS['en'][key] || key;
}

function applyLang() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const val = t(key);
    // For elements with child nodes (like h2 with <br>), only update text content safely
    if (el.children.length === 0) {
      el.textContent = val;
    } else {
      // Replace innerHTML for elements like h2 with line breaks
      el.innerHTML = val.replace(/\n/g, '<br/>');
    }
  });
  // Sync radio selection
  const langRadio = document.querySelector(`input[name="langSelector"][value="${currentLang}"]`);
  if (langRadio) langRadio.checked = true;
}

document.querySelectorAll('input[name="langSelector"]').forEach(r => {
  r.addEventListener('change', e => {
    currentLang = e.target.value;
    localStorage.setItem('wt_lang', currentLang);
    applyLang();
    // Re-render current view to update dynamically generated text
    if (curScreen === 'list') renderList();
    else if (curScreen === 'detail') renderDetail();
  });
});

// Apply saved language on init
applyLang();

// ─── DEV EASTER EGG ─────────────────────────

const DEV_PHOTO = "data:image/jpeg;base64,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";
(function() {
  let devClickCount = 0;
  let devClickTimer = null;
  const sig = document.getElementById('dev-signature');
  const overlay = document.getElementById('modal-dev-photo');
  const img = document.getElementById('dev-photo-img');
  const closeBtn = document.getElementById('btn-dev-photo-close');

  let canClose = false;

  function showDevPhoto() {
    canClose = false;
    closeBtn.style.opacity = '0';
    closeBtn.style.pointerEvents = 'none';

    img.src = DEV_PHOTO;
    // re-trigger animation
    img.style.animation = 'none';
    img.offsetHeight; // reflow
    img.style.animation = '';
    overlay.classList.remove('hidden');

    // Wait 3 seconds before allowing to close
    setTimeout(() => {
      canClose = true;
      closeBtn.style.opacity = '1';
      closeBtn.style.pointerEvents = 'auto';
    }, 3000);
  }

  sig.addEventListener('click', () => {
    devClickCount++;
    clearTimeout(devClickTimer);
    // Reset counter after 2s of inactivity
    devClickTimer = setTimeout(() => { devClickCount = 0; }, 2000);

    // Visual pulse feedback on each click
    sig.style.opacity = '0.9';
    setTimeout(() => { sig.style.opacity = '0.5'; }, 150);

    if (devClickCount >= 10) {
      devClickCount = 0;
      clearTimeout(devClickTimer);
      showDevPhoto();
    }
  });

  closeBtn.addEventListener('click', () => {
    if (canClose) overlay.classList.add('hidden');
  });

  overlay.addEventListener('click', e => {
    if (canClose && e.target === overlay) overlay.classList.add('hidden');
  });
})();
