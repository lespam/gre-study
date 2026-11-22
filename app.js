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
const blank = () => ({ v: 1, cards: {}, days: [], newToday: { day: 0, n: 0 }, theme: 'auto', mistakes: [], stats: {} });
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
  const rows = [], all = [];
  for (const t of topics) {
    let items = [];
    if (t.file) { try { items = (await getJSON(t.file)).items; } catch (e) {} }
    if (items.length && items[0].type !== 'card') all.push(...items);
    const d = dueCards(items).length, n = newCards(items).length;
    const seen = items.filter(c => state.cards[c.id]).length;
    due += d; learned += seen;
    rows.push(`<button class="card topic ${t.file ? '' : 'off'}" ${t.file ? `data-topic="${esc(t.id)}" data-kind="${items[0] && items[0].type === 'card' ? 'study' : 'topic'}"` : 'disabled'}>
      <div class="grow"><b>${esc(t.title)}</b><div class="muted">${t.file ? `${d} para repasar · ${n} nuevas · ${seen}/${items.length} vistas` : 'Próximamente'}</div>
      ${t.file ? `<div class="progress"><i style="width:${items.length ? Math.round(seen / items.length * 100) : 0}%"></i></div>` : ''}</div><span>›</span></button>`);
  }
  app.innerHTML = `<div class="stats">
    <div class="card stat"><b>🔥 ${streak()}</b><span class="muted">días seguidos</span></div>
    <div class="card stat"><b>${due}</b><span class="muted">por repasar hoy</span></div></div>
    <button class="btn" id="rev">Repaso mezclado (${dueCards(all).length} pendientes)</button>
    <button class="btn sec" id="mis">Mistake Log (${state.mistakes.length})</button>
    <button class="btn sec" id="prog">Mi progreso</button>
    <h2>Temas</h2>${rows.join('')}`;
  $('#rev').onclick = () => go('review'); $('#mis').onclick = () => go('mistakes'); $('#prog').onclick = () => go('progress');
  app.querySelectorAll('[data-topic]').forEach(b => b.onclick = () => { location.hash = `#/${b.dataset.kind}/${b.dataset.topic}`; });
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

/* ---------- Motor de preguntas (Fase 2) ---------- */
const QC_CHOICES = ['La cantidad A es mayor', 'La cantidad B es mayor', 'Son iguales', 'No se puede determinar'];
const letter = k => String.fromCharCode(65 + k);

async function loadAll() {
  const topics = (await getJSON('data/index.json')).topics, items = [];
  for (const t of topics) if (t.file) { try { items.push(...(await getJSON(t.file)).items); } catch (e) {} }
  return { topics, items: items.filter(i => i.type !== 'card' && i.type !== 'lesson') };
}

// Una "unidad" = una lección seguida de sus preguntas (el orden del archivo las agrupa).
function unitsOf(items) {
  const units = []; let cur = null;
  for (const it of items) {
    if (it.type === 'lesson') { cur = { lesson: it, qs: [] }; units.push(cur); }
    else { if (!cur) { cur = { lesson: null, qs: [] }; units.push(cur); } cur.qs.push(it); }
  }
  return units;
}

function record(q, ok) {
  const st = state.stats[q.topic] || (state.stats[q.topic] = { ok: 0, n: 0 }); st.n++; if (ok) st.ok++;
  const s = state.cards[q.id] || (state.cards[q.id] = { box: 0, due: today(), seen: 0, lapses: 0 });
  s.seen++;
  if (ok) { s.box = Math.min(5, s.box + 1); s.due = today() + INTERVALS[s.box]; state.mistakes = state.mistakes.filter(m => m !== q.id); }
  else { s.box = 0; s.lapses++; s.due = today(); if (!state.mistakes.includes(q.id)) state.mistakes.push(q.id); }
  markToday(); save();
}

function parseNum(v) {
  v = String(v).trim().replace(',', '.');
  const f = v.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/);
  return f ? +f[1] / +f[2] : (v === '' ? NaN : Number(v));
}

// list: preguntas; opts.done({ok,total}) se llama al final.
function runQuiz(list, opts) {
  let i = 0, okCount = 0; const total = list.length;
  next();
  function next() {
    if (i >= total) return opts.done({ ok: okCount, total });
    const q = list[i]; let locked = false; const sel = new Set();
    const choices = q.type === 'qc' ? QC_CHOICES : (q.choices || []);
    const answerSet = new Set([].concat(q.answer));
    app.innerHTML = `<div class="muted">${i + 1}/${total}</div><div class="progress"><i style="width:${i / total * 100}%"></i></div>
      ${q.passage ? `<div class="card passage">${esc(q.passage)}</div>` : ''}
      <div class="card"><div class="stem">${esc(q.stem)}</div>
      ${q.type === 'qc' ? `<div class="qc"><div><b>A</b> ${esc(q.quantityA)}</div><div><b>B</b> ${esc(q.quantityB)}</div></div>` : ''}
      ${q.type === 'multi' ? '<div class="muted">Elige todas las correctas.</div>' : ''}</div>
      <div id="opts"></div><button class="btn sec" id="hint" ${q.hint ? '' : 'hidden'}>💡 Pista</button><div id="hintBox"></div>
      <div id="fb"></div><div id="ctl"></div>`;
    const optsEl = $('#opts');
    if (q.type === 'numeric') {
      optsEl.innerHTML = `<input id="num" class="num" inputmode="decimal" autocomplete="off" placeholder="Tu respuesta">
        <button class="btn" id="chk">Comprobar</button>`;
      $('#chk').onclick = () => finish(Math.abs(parseNum($('#num').value) - q.answer) <= (q.tolerance || 0) + 1e-9, null);
    } else {
      optsEl.innerHTML = choices.map((c, k) => `<button class="opt" data-k="${k}"><b>${letter(k)}</b> ${esc(c)}</button>`).join('') +
        (q.type === 'multi' ? '<button class="btn" id="chk" disabled>Comprobar</button>' : '');
      optsEl.querySelectorAll('.opt').forEach(b => b.onclick = () => {
        if (locked) return; const k = +b.dataset.k;
        if (q.type === 'multi') {
          sel.has(k) ? sel.delete(k) : sel.add(k); b.classList.toggle('sel'); $('#chk').disabled = sel.size === 0;
        } else finish(answerSet.has(k), new Set([k]));
      });
      if (q.type === 'multi') $('#chk').onclick = () => finish(sel.size === answerSet.size && [...sel].every(k => answerSet.has(k)), sel);
    }
    $('#hint').onclick = () => { $('#hintBox').innerHTML = `<div class="card muted">${esc(q.hint)}</div>`; $('#hint').hidden = true; };

    function finish(ok, picked) {
      if (locked) return; locked = true; if (ok) okCount++; record(q, ok);
      optsEl.querySelectorAll('.opt').forEach(b => {
        const k = +b.dataset.k; b.disabled = true;
        if (answerSet.has(k)) b.classList.add('ok');
        else if (picked && picked.has(k)) b.classList.add('bad');
      });
      const chk = $('#chk'); if (chk) chk.disabled = true; $('#hint').hidden = true;
      let why = '';
      if (q.whyWrong) why = '<ul>' + choices.map((c, k) => (!answerSet.has(k) && q.whyWrong[k]) ? `<li><b>${letter(k)}</b> ${esc(q.whyWrong[k])}</li>` : '').join('') + '</ul>';
      const ans = q.type === 'numeric' ? `<p>Respuesta: <b>${esc(q.answer)}</b></p>` : '';
      $('#fb').innerHTML = `<div class="card fb ${ok ? 'okc' : 'badc'}"><b>${ok ? '✓ Correcto' : '✗ Incorrecto'}</b>${ans}<p>${esc(q.explanation)}</p>${why}</div>`;
      $('#ctl').innerHTML = `<button class="btn" id="nx">${i + 1 >= total ? 'Terminar' : 'Siguiente'}</button>`;
      $('#nx').onclick = () => { i++; next(); };
      $('#nx').scrollIntoView({ block: 'nearest' });
    }
  }
}

function summary(r, backLabel, backHash, again) {
  const pct = r.total ? Math.round(r.ok / r.total * 100) : 0;
  app.innerHTML = `<div class="card"><b>${r.ok}/${r.total} correctas (${pct}%)</b>
    <p class="muted">${pct >= 80 ? '¡Muy bien!' : pct >= 50 ? 'Vas bien. Los errores quedaron en tu Mistake Log y volverán pronto.' : 'Repasa la lección y vuelve a intentar.'}</p>
    ${again ? '<button class="btn" id="again">Otra ronda</button>' : ''}
    <button class="btn sec" id="bk">${backLabel}</button></div>`;
  if (again) $('#again').onclick = again;
  $('#bk').onclick = () => go(backHash);
}

async function topicPage(id) {
  const { topics } = await loadAll(); const t = topics.find(x => x.id === id);
  if (!t || !t.file) return go('');
  setView(t.title, true);
  const data = await getJSON(t.file), units = unitsOf(data.items);
  const qn = units.reduce((n, u) => n + u.qs.length, 0);
  app.innerHTML = units.map((u, k) => {
    const seen = u.qs.filter(q => state.cards[q.id]).length;
    return `<button class="card topic" data-u="${k}"><div class="grow"><b>${esc(u.lesson ? u.lesson.title : 'Práctica')}</b>
      <div class="muted">${u.qs.length} preguntas · ${seen} vistas</div></div><span>›</span></button>`;
  }).join('') + `<button class="btn" id="cp" ${qn ? '' : 'disabled'}>Checkpoint del tema (10 preguntas)</button>`;
  app.querySelectorAll('[data-u]').forEach(b => b.onclick = () => go(`unit/${id}/${b.dataset.u}`));
  $('#cp').onclick = () => go(`checkpoint/${id}`);
}

async function unitPage(id, k) {
  const { topics } = await loadAll(); const t = topics.find(x => x.id === id); if (!t || !t.file) return go('');
  const u = unitsOf((await getJSON(t.file)).items)[k]; if (!u) return go(`topic/${id}`);
  if (!u.lesson) return practice(id, k);
  setView(t.title, true);
  app.innerHTML = `<div class="card"><h2>${esc(u.lesson.title)}</h2><p>${esc(u.lesson.body)}</p>
    <div class="card ex2"><b>Ejemplo</b><p>${esc(u.lesson.example)}</p></div></div>
    <button class="btn" id="go">Practicar (${u.qs.length} preguntas)</button>`;
  $('#go').onclick = () => go(`practice/${id}/${k}`);
}

async function practice(id, k) {
  const { topics } = await loadAll(); const t = topics.find(x => x.id === id); if (!t || !t.file) return go('');
  const u = unitsOf((await getJSON(t.file)).items)[k]; if (!u) return go(`topic/${id}`);
  setView(t.title, true);
  runQuiz(u.qs, { done: r => summary(r, 'Volver al tema', `topic/${id}`, () => practice(id, k)) });
}

async function checkpoint(id) {
  const { topics } = await loadAll(); const t = topics.find(x => x.id === id); if (!t || !t.file) return go('');
  setView('Checkpoint', true);
  const qs = shuffle(unitsOf((await getJSON(t.file)).items).flatMap(u => u.qs)).slice(0, 10);
  runQuiz(qs, { done: r => summary(r, 'Volver al tema', `topic/${id}`, () => checkpoint(id)) });
}

async function review() {
  setView('Repaso mezclado', true);
  const { items } = await loadAll(), qs = shuffle(dueCards(items)).slice(0, 10);
  if (!qs.length) { app.innerHTML = '<div class="card"><b>Nada pendiente 🎉</b><p class="muted">Las preguntas que falles volverán aquí.</p></div>'; return; }
  runQuiz(qs, { done: r => summary(r, 'Inicio', '', review) });
}

async function mistakes() {
  setView('Mistake Log', true);
  const { items } = await loadAll(), qs = shuffle(items.filter(q => state.mistakes.includes(q.id))).slice(0, 10);
  if (!qs.length) { app.innerHTML = '<div class="card"><b>Sin errores guardados 👏</b><p class="muted">Cada pregunta que falles se guarda aquí hasta que la aciertes.</p></div>'; return; }
  app.innerHTML = `<div class="card"><b>${state.mistakes.length} preguntas por corregir</b>
    <p class="muted">Se quitan del log cuando las aciertas.</p><button class="btn" id="st">Practicar ${qs.length}</button></div>`;
  $('#st').onclick = () => runQuiz(qs, { done: r => summary(r, 'Inicio', '', mistakes) });
}

async function progress() {
  setView('Mi progreso', true);
  const { topics } = await loadAll();
  const names = { verbal: 'Verbal', quant: 'Quant', writing: 'Writing' }, area = {};
  let ok = 0, n = 0; const byArea = {};
  const rows = topics.map(t => {
    const st = state.stats[t.id]; if (!st || !st.n) return '';
    ok += st.ok; n += st.n; const a = byArea[t.area] || (byArea[t.area] = { ok: 0, n: 0 }); a.ok += st.ok; a.n += st.n;
    const p = Math.round(st.ok / st.n * 100);
    return `<div class="card"><b>${esc(t.title)}</b> <span class="muted">${st.ok}/${st.n} · ${p}%</span><div class="progress"><i style="width:${p}%"></i></div></div>`;
  }).join('');
  const weak = topics.map(t => ({ t, st: state.stats[t.id] })).filter(x => x.st && x.st.n >= 3)
    .sort((a, b) => a.st.ok / a.st.n - b.st.ok / b.st.n).slice(0, 3).filter(x => x.st.ok / x.st.n < 0.8);
  const est = ['verbal', 'quant'].map(k => {
    const a = byArea[k];
    if (!a || a.n < 15) return `<div>${names[k]}: <span class="muted">necesito ≥15 respuestas (llevas ${a ? a.n : 0})</span></div>`;
    const c = Math.round(130 + a.ok / a.n * 40); return `<div>${names[k]}: <b>${Math.max(130, c - 4)}–${Math.min(170, c + 4)}</b></div>`;
  }).join('');
  const last7 = Array.from({ length: 7 }, (_, k) => today() - 6 + k).map(d => `<span class="dot ${state.days.includes(d) ? 'on' : ''}"></span>`).join('');
  app.innerHTML = `<div class="stats"><div class="card stat"><b>🔥 ${streak()}</b><span class="muted">racha</span></div>
    <div class="card stat"><b>${n ? Math.round(ok / n * 100) : 0}%</b><span class="muted">precisión (${n} resp.)</span></div></div>
    <div class="card"><b>Últimos 7 días</b><div class="dots">${last7}</div></div>
    <div class="card"><b>Puntaje estimado (aprox.)</b>${est}<p class="muted">Solo orientativo: se basa en tus aciertos en preguntas propias, no en un examen real.</p></div>
    ${weak.length ? `<div class="card"><b>Áreas débiles</b>${weak.map(x => `<div>${esc(x.t.title)} · ${Math.round(x.st.ok / x.st.n * 100)}%</div>`).join('')}</div>` : ''}
    <h2>Por tema</h2>${rows || '<div class="card muted">Aún no hay respuestas. Practica un tema.</div>'}`;
}

/* ---------- Router ---------- */
function go(h) { location.hash = '#/' + h; }
function route() {
  const [, page, arg, arg2] = location.hash.split('/');
  const R = { study: () => study(arg), topic: () => topicPage(arg), unit: () => unitPage(arg, +arg2),
    practice: () => practice(arg, +arg2), checkpoint: () => checkpoint(arg), review: review, mistakes: mistakes,
    progress: progress, settings: settings };
  (R[page] || home)();
}
window.addEventListener('hashchange', route);
backBtn.onclick = () => history.length > 1 ? history.back() : go('');
$('#settingsBtn').onclick = () => go('settings');
applyTheme(); route();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
