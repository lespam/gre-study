/* GRE Study — vanilla JS, sin build. Contenido en /data/*.json (ver README). */
(() => {
'use strict';

const KEY = 'grestudy.v1';
const INTERVALS = [0, 1, 3, 7, 14, 30];   // días por caja de repetición espaciada
const SESSION_SIZE = 10;                   // tarjetas por sesión (~5 min)
const NEW_PER_DAY = 10;

const $ = s => document.querySelector(s);
const app = $('#app'), titleEl = $('#title'), backBtn = $('#back');

/* ---------- Estado (localStorage) ---------- */
const today = () => { const d = new Date(); return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 864e5); };
const blank = () => ({ v: 1, cards: {}, days: [], newToday: { day: 0, n: 0 }, theme: 'auto', mistakes: [] });
let state = load();
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return Object.assign(blank(), s); } catch (e) {}
  return blank();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

function streak() {
  const set = new Set(state.days); let d = today(); if (!set.has(d)) d--;
  let n = 0; while (set.has(d)) { n++; d--; } return n;
}
function markToday() { const d = today(); if (!state.days.includes(d)) state.days.push(d); }

/* ---------- Contenido ---------- */
const cache = {};
async function getJSON(path) {
  if (cache[path]) return cache[path];
  const r = await fetch(path); if (!r.ok) throw new Error(path);
  return (cache[path] = await r.json());
}

/* ---------- Tema ---------- */
function applyTheme() {
  const r = document.documentElement;
  if (state.theme === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', state.theme);
}

/* ---------- Utilidades ---------- */
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function setView(title, back) { titleEl.textContent = title; backBtn.hidden = !back; window.scrollTo(0, 0); }

/* ---------- Repetición espaciada ---------- */
function dueCards(items) {
  const t = today();
  return items.filter(c => { const s = state.cards[c.id]; return s && s.due <= t; });
}
function newCards(items) {
  if (state.newToday.day !== today()) state.newToday = { day: today(), n: 0 };
  const left = Math.max(0, NEW_PER_DAY - state.newToday.n);
  return items.filter(c => !state.cards[c.id]).slice(0, left);
}
function grade(card, g) { // g: 0 otra vez, 1 bien, 2 fácil
  const s = state.cards[card.id] || (state.cards[card.id] = { box: 0, due: today(), seen: 0, lapses: 0 });
  if (s.seen === 0) { if (state.newToday.day !== today()) state.newToday = { day: today(), n: 0 }; state.newToday.n++; }
  s.seen++;
  if (g === 0) { s.box = 0; s.lapses++; s.due = today(); }
  else { s.box = Math.min(5, Math.max(1, s.box) + (g === 2 ? 2 : 1) - (s.box === 0 ? 1 : 0)); s.due = today() + INTERVALS[s.box]; }
  markToday(); save();
}

/* ---------- Vistas ---------- */
async function home() {
  setView('GRE Study', false);
  let topics = [];
  try { topics = (await getJSON('data/index.json')).topics; } catch (e) { app.innerHTML = '<div class="card">No se pudo cargar el contenido.</div>'; return; }
  let due = 0, learned = 0;
  const rows = [];
  for (const t of topics) {
    let items = [];
    if (t.file) { try { items = (await getJSON(t.file)).items; } catch (e) {} }
    const d = dueCards(items).length, n = newCards(items).length;
    const seen = items.filter(c => state.cards[c.id]).length;
    due += d; learned += seen;
    rows.push(`<button class="card topic ${t.file ? '' : 'off'}" ${t.file ? `data-topic="${esc(t.id)}"` : 'disabled'}>
      <div class="grow"><b>${esc(t.title)}</b><div class="muted">${t.file ? `${d} para repasar · ${n} nuevas · ${seen}/${items.length} vistas` : 'Próximamente'}</div>
      ${t.file ? `<div class="progress"><i style="width:${items.length ? Math.round(seen / items.length * 100) : 0}%"></i></div>` : ''}</div><span>›</span></button>`);
  }
  app.innerHTML = `<div class="stats">
    <div class="card stat"><b>🔥 ${streak()}</b><span class="muted">días seguidos</span></div>
    <div class="card stat"><b>${due}</b><span class="muted">por repasar hoy</span></div></div>
    <h2>Temas</h2>${rows.join('')}`;
  app.querySelectorAll('[data-topic]').forEach(b => b.onclick = () => { location.hash = '#/study/' + b.dataset.topic; });
}

async function study(topicId) {
  const topics = (await getJSON('data/index.json')).topics;
  const t = topics.find(x => x.id === topicId);
  if (!t || !t.file) return go('');
  setView(t.title, true);
  const data = await getJSON(t.file);
  const due = shuffle(dueCards(data.items));
  const fresh = newCards(data.items);
  let queue = due.concat(fresh).slice(0, SESSION_SIZE);
  if (!queue.length) {
    app.innerHTML = `<div class="card"><b>¡Todo al día! 🎉</b><p class="muted">No hay tarjetas pendientes. Vuelve mañana o repasa extra.</p>
      <button class="btn" id="extra">Repasar 10 al azar</button></div>`;
    $('#extra').onclick = () => { queue = shuffle(data.items).slice(0, SESSION_SIZE); run(); };
    return;
  }
  const total = queue.length; let done = 0, again = 0;
  run();

  function run() {
    if (!queue.length) {
      app.innerHTML = `<div class="card"><b>Sesión completa ✅</b><p>${total} tarjetas · ${again} para repetir.</p>
        <p class="muted">Racha: 🔥 ${streak()} días</p>
        <button class="btn" id="more">Otra sesión</button><button class="btn sec" id="home">Inicio</button></div>`;
      $('#more').onclick = () => study(topicId); $('#home').onclick = () => go('');
      return;
    }
    const c = queue[0]; let shown = false;
    const front = () => `<div class="word">${esc(c.front)}</div><span class="tag">${esc(c.pos || '')}</span><div class="muted">Toca para ver la definición</div>`;
    const back = () => `<div class="word">${esc(c.front)}</div><div class="def">${esc(c.back)}</div>
      <div class="ex">“${esc(c.example)}”</div>${c.extra ? `<div class="muted">${esc(c.extra)}</div>` : ''}`;
    app.innerHTML = `<div class="muted">${done}/${total}</div><div class="progress"><i style="width:${done / total * 100}%"></i></div>
      <div class="card flash" id="fc" role="button" tabindex="0">${front()}</div><div id="ctl"></div>`;
    const flip = () => {
      if (shown) return; shown = true; $('#fc').innerHTML = back();
      $('#ctl').innerHTML = `<div class="row"><button class="btn again" data-g="0">Otra vez</button><button class="btn good" data-g="1">Bien</button><button class="btn easy" data-g="2">Fácil</button></div>`;
      $('#ctl').querySelectorAll('button').forEach(b => b.onclick = () => {
        const g = +b.dataset.g; grade(c, g); queue.shift();
        if (g === 0) { again++; queue.splice(Math.min(3, queue.length), 0, c); } else done++;
        run();
      });
    };
    $('#fc').onclick = flip; $('#fc').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } };
  }
}

function settings() {
  setView('Ajustes', true);
  app.innerHTML = `<div class="card"><b>Tema</b>
      <div class="row"><button class="btn sec" data-t="auto">Auto</button><button class="btn sec" data-t="light">Claro</button><button class="btn sec" data-t="dark">Oscuro</button></div></div>
    <div class="card"><b>Respaldo</b><p class="muted">Tu progreso vive solo en este teléfono. Exporta una copia de vez en cuando.</p>
      <button class="btn" id="exp">Exportar JSON</button>
      <button class="btn sec" id="imp">Importar JSON</button>
      <input type="file" id="file" accept="application/json,.json" hidden>
      <p class="muted" id="msg"></p></div>
    <div class="card"><b>Borrar progreso</b><button class="btn sec" id="reset">Borrar todo</button></div>`;
  app.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { state.theme = b.dataset.t; save(); applyTheme(); });
  $('#exp').onclick = () => {
    const blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `gre-study-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000); $('#msg').textContent = 'Archivo exportado.';
  };
  $('#imp').onclick = () => $('#file').click();
  $('#file').onchange = async e => {
    try {
      const s = JSON.parse(await e.target.files[0].text());
      if (!s || s.v !== 1 || typeof s.cards !== 'object') throw 0;
      state = Object.assign(blank(), s); save(); applyTheme(); $('#msg').textContent = 'Importado ✅';
    } catch (err) { $('#msg').textContent = 'Archivo no válido.'; }
  };
  $('#reset').onclick = () => { if (confirm('¿Borrar todo el progreso?')) { state = blank(); save(); applyTheme(); go(''); } };
}

/* ---------- Router ---------- */
function go(h) { location.hash = '#/' + h; }
function route() {
  const [, page, arg] = location.hash.split('/');
  if (page === 'study') study(arg); else if (page === 'settings') settings(); else home();
}
window.addEventListener('hashchange', route);
backBtn.onclick = () => history.length > 1 ? history.back() : go('');
$('#settingsBtn').onclick = () => go('settings');
applyTheme(); route();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
