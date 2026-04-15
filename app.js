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

function save() { try { localStorage.setItem('wt_data', JSON.stringify(data)); } catch(e){} }
function load() { 
  try { 
    const s = localStorage.getItem('wt_data'); 
    if (s) data = JSON.parse(s); 
    if(!data.history) data.history = [];
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
}

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
          <div class="card-meta">${t.exercises.length} ex · ${isCircuit ? (t.cycles||3)+' cycles' : totalSets+' sets'} · ~${totalMin} min · ⏸ ${t.breakMin}m</div>
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
    data.history.sort((a,b)=>b.ts - a.ts).forEach(h => {
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

  for(let i=1; i<firstDay; i++) {
    const el = document.createElement('div');
    el.className = 'cal-day empty';
    grid.appendChild(el);
  }

  const activeDays = new Set(data.history.map(h => {
    let d = new Date(h.ts);
    if(d.getFullYear()===y && d.getMonth()===m) return d.getDate();
    return -1;
  }));

  for(let i=1; i<=daysInMonth; i++) {
    const el = document.createElement('div');
    el.className = 'cal-day' + (activeDays.has(i) ? ' active' : '');
    el.textContent = i;
    grid.appendChild(el);
  }
}

document.getElementById('cal-prev').addEventListener('click', () => { curDate.setMonth(curDate.getMonth()-1); renderCalendar(); });
document.getElementById('cal-next').addEventListener('click', () => { curDate.setMonth(curDate.getMonth()+1); renderCalendar(); });
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

function updateAvatarPreview() {
  const preview = document.getElementById('modal-avatar-preview');
  if (currentModalIcon && currentModalIcon.startsWith('data:image')) {
    preview.style.backgroundImage = `url('${currentModalIcon}')`;
    preview.textContent = '';
  } else {
    preview.style.backgroundImage = 'none';
    preview.textContent = currentModalIcon;
  }
}

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

function updateExAvatarPreview() {
  const preview = document.getElementById('modal-ex-avatar-preview');
  if (currentExModalIcon && currentExModalIcon.startsWith('data:image')) {
    preview.style.backgroundImage = `url('${currentExModalIcon}')`;
    preview.textContent = '';
  } else {
    preview.style.backgroundImage = 'none';
    preview.textContent = currentExModalIcon;
  }
}

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
