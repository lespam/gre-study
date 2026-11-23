/* Fase 3: Quant (4 modos), Verbal, Essay & Writing, Pronunciación + panel de datos.
   Datos del usuario = APP_DATA (state.extra en localStorage["grestudy.v1"]). Contenido base sigue en /data. */
(() => {
'use strict';
const G = () => window.GS, app = () => G().app;
const KEYS = ['quant', 'vocab', 'phrases', 'essayPrompts', 'essayStructure', 'pronRef', 'synonyms', 'journal'];
const SEED = {
  essayPrompts: [
    { id: 'e1', claim: 'Governments should place few, if any, restrictions on scientific research.', instruction: 'Write a response in which you discuss the extent to which you agree or disagree with the claim and explain your reasoning.' },
    { id: 'e2', claim: 'The best way to understand a society is to examine its failures rather than its successes.', instruction: 'Write a response in which you discuss the extent to which you agree or disagree with the claim.' }],
  phrases: [
    { id: 'p1', category: 'Tesis', text: 'I firmly believe that the claim holds true only under certain conditions.' },
    { id: 'p2', category: 'Evidencia', text: 'A case in point is the way in which ...' }],
  synonyms: [{ id: 's1', basic: 'show', academic: ['demonstrate', 'underscore', 'illustrate'] }, { id: 's2', basic: 'help', academic: ['facilitate', 'foster'] }]
};
function D() {
  const s = G().state; if (!s.extra || typeof s.extra !== 'object') s.extra = {};
  const e = s.extra; e.version = 1;
  KEYS.forEach(k => { if (!Array.isArray(e[k])) e[k] = []; });
  if (!e.seeded) { e.seeded = true; Object.keys(SEED).forEach(k => { if (!e[k].length) e[k] = JSON.parse(JSON.stringify(SEED[k])); }); G().save(); }
  e.wc = e.wc || {};
  return e;
}
const save = () => G().save();
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function h(t, a, ...c) {
  const e = document.createElement(t);
  for (const k in a || {}) { const v = a[k]; if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v); }
  c.flat(9).forEach(x => x != null && x !== false && e.append(x.nodeType ? x : document.createTextNode(x)));
  return e;
}
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>').replace(/\n/g, '<br>');
const fmt = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
const empty = m => h('p', { class: 'muted' }, m);
let timers = [];
const every = (f, ms) => timers.push(setInterval(f, ms));
const stopTimers = () => { timers.forEach(clearInterval); timers = []; };
let toastT;
function toast(m) {
  let t = document.getElementById('xtoast');
  if (!t) { t = h('div', { id: 'xtoast', style: 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--text);color:var(--bg);padding:8px 16px;border-radius:99px;z-index:30' }); document.body.append(t); }
  t.textContent = m; t.style.display = 'block'; clearTimeout(toastT); toastT = setTimeout(() => t.style.display = 'none', 1600);
}
async function copy(txt) {
  try { await navigator.clipboard.writeText(txt); } catch (e) { const a = h('textarea'); document.body.append(a); a.value = txt; a.select(); try { document.execCommand('copy'); } catch (_) {} a.remove(); }
  toast('Copiado');
}
function download(name, txt, type) { const a = h('a', { href: URL.createObjectURL(new Blob([txt], { type })), download: name }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }

/* ---------- montaje / rutas ---------- */
let cur = () => {}, view = {};
const mount = el => { app().className = 'x'; app().replaceChildren(el); };
const rerender = () => cur();
const page = (title, fn) => (a, b) => { stopTimers(); G().setView(title, false); cur = async () => { const y = scrollY; mount(await fn(a, b)); scrollTo(0, y); }; cur(); };
const subTabs = (names, key, onpick) => h('div', { class: 'sub' }, names.map(([k, l]) => h('button', { class: view[key] === k ? 'on' : '', onclick: () => onpick(k) }, l)));

/* ---------- QUANT ---------- */
let qopt = { topic: '', limit: 0 }, qmode = null;
const wcOf = q => D().wc[q.id] ?? q.wrongCount ?? (G().state.mistakes.includes(q.id) ? 1 : 0);
async function quantItems() {
  const topics = (await G().getJSON('data/index.json')).topics.filter(t => t.area === 'quant' && t.file), out = [];
  const wrap = (i, label) => Object.assign({}, i, { tl: label, level: i.level || (i.difficulty === 3 ? 'mindbreaker' : 'machine'), vg: i.variantGroup || String(i.id).replace(/-?\d+$/, '') });
  for (const t of topics) (await G().getJSON(t.file)).items.filter(i => i.type !== 'card' && i.type !== 'lesson').forEach(i => out.push(wrap(i, t.title)));
  D().quant.forEach(i => out.push(wrap(i, i.topic)));
  return out;
}
function pool(items, m) {
  if (m === 'mixed') return G().shuffle(items).slice(0, 10);
  if (m === 'repaso') return G().shuffle(items.filter(q => wcOf(q) > 0));
  const l = items.filter(q => q.level === (m === 'machine' ? 'machine' : 'mindbreaker') && (!qopt.topic || q.tl === qopt.topic));
  if (m === 'mind') return G().shuffle(l);
  const g = []; l.forEach(q => { const x = g.find(a => a[0].vg === q.vg); x ? x.push(q) : g.push([q]); }); return g.flat();
}
async function quantMenu() {
  const items = await quantItems(), topics = [...new Set(items.map(q => q.tl))];
  if (qopt.topic && !topics.includes(qopt.topic)) qopt.topic = '';
  const ts = h('select', { onchange: e => { qopt.topic = e.target.value; rerender(); } }, h('option', { value: '' }, 'Todos los temas'), topics.map(t => h('option', { value: t }, t)));
  ts.value = qopt.topic;
  const ls = h('select', { onchange: e => qopt.limit = +e.target.value }, [[0, 'Sin límite'], [105, '1:45 por pregunta'], [158, '2:38 por pregunta (1.5x)']].map(([v, l]) => h('option', { value: v }, l)));
  ls.value = qopt.limit;
  const card = (m, t, d, x) => h('div', { class: 'card' }, h('b', {}, t), h('p', { class: 'muted' }, d + ' · ' + pool(items, m).length + ' disponibles'), x, h('button', { class: 'btn p', onclick: () => startQ(m, items) }, 'Iniciar'));
  return h('div', {}, h('div', { class: 'rw' }, 'Tema:', ts),
    card('machine', 'Máquina', 'Variantes del mismo grupo, en secuencia.'),
    card('mind', 'Mindbreaker', 'Solo preguntas difíciles.'),
    card('repaso', 'Repaso', 'Solo preguntas falladas.', h('div', { class: 'rw' }, ls)),
    card('mixed', 'Mezclado', 'Bloque aleatorio de temas y dificultades.'));
}
function startQ(m, items) {
  const l = pool(items, m); if (!l.length) return toast('No hay preguntas para este modo');
  const before = {}; items.forEach(q => before[q.id] = wcOf(q));
  stopTimers(); G().setView('Quant · ' + { machine: 'Máquina', mind: 'Mindbreaker', repaso: 'Repaso', mixed: 'Mezclado' }[m], false);
  mount(h('div')); app().className = '';
  G().runQuiz(l, {
    limit: m === 'repaso' ? qopt.limit : 0,
    onAnswer: (q, ok) => { const w = before[q.id]; D().wc[q.id] = ok ? (m === 'repaso' ? 0 : w) : w + 1; save(); },
    done: r => G().summary(r, 'Menú de Quant', 'quant', () => startQ(m, items))
  });
}

/* ---------- VERBAL ---------- */
let vs = { q: '', filter: 'all', dir: 'fr', queue: null, flip: false };
async function vocabAll() {
  const t = (await G().getJSON('data/index.json')).topics.find(x => x.id === 'vocabulary');
  const base = t && t.file ? (await G().getJSON(t.file)).items.filter(i => i.type === 'card').map(c => ({ id: c.id, word: c.front, definition: c.back + (c.extra ? ' · ' + c.extra : ''), example: c.example, notes: '', starred: false })) : [];
  const meta = D().vocab, byId = new Map(base.map(w => [w.id, w]));
  meta.forEach(m => { const b = byId.get(m.id); if (b) Object.assign(b, m); else { const n = Object.assign({ notes: '', starred: false }, m); base.push(n); byId.set(n.id, n); } });
  return base;
}
function setMeta(id, patch) { const v = D().vocab; let m = v.find(x => x.id === id); if (!m) v.push(m = { id }); Object.assign(m, patch); save(); }
async function verbal() {
  const words = await vocabAll();
  const sub = subTabs([['list', 'Palabras'], ['cards', 'Flashcards']], 'v', k => { view.v = k; vs.queue = null; location.hash = '#/verbal/' + k; });
  return h('div', {}, sub, view.v === 'cards' ? flashcards(words) : vocabList(words));
}
function vocabList(words) {
  const box = h('div'), draw = () => {
    box.replaceChildren(); const q = vs.q.toLowerCase();
    const l = words.filter(w => !q || (w.word + ' ' + w.definition + ' ' + w.notes).toLowerCase().includes(q));
    if (!l.length) box.append(empty('Sin palabras.'));
    l.forEach(w => {
      const st = h('button', { class: 'star' + (w.starred ? ' on' : ''), 'aria-label': 'Difícil', onclick: () => { w.starred = !w.starred; setMeta(w.id, { starred: w.starred }); st.classList.toggle('on', w.starred); st.textContent = w.starred ? '★' : '☆'; } }, w.starred ? '★' : '☆');
      box.append(h('div', { class: 'card' }, h('div', { class: 'rw' }, h('b', { class: 'grow', style: 'font-size:1.3rem' }, w.word), st), h('div', {}, w.definition), h('p', { class: 'muted' }, h('i', {}, w.example || '')),
        h('textarea', { rows: 2, placeholder: 'Notas personales…', onchange: e => { w.notes = e.target.value; setMeta(w.id, { notes: w.notes }); } }, w.notes || '')));
    });
  };
  draw();
  return h('div', {}, h('input', { type: 'search', placeholder: 'Buscar palabra…', value: vs.q, oninput: e => { vs.q = e.target.value; draw(); } }), box);
}
function flashcards(words) {
  const pl = () => words.filter(w => vs.filter === 'all' || w.starred);
  if (!vs.queue) { vs.queue = G().shuffle(pl()).map(w => w.id); vs.flip = false; }
  const w = words.find(x => x.id === vs.queue[0]);
  const ctl = h('div', { class: 'rw' }, h('select', { onchange: e => { vs.filter = e.target.value; vs.queue = null; rerender(); } }, h('option', { value: 'all' }, 'Todas'), h('option', { value: 'star' }, 'Solo marcadas')),
    h('button', { class: 'btn', onclick: () => { vs.dir = vs.dir === 'fr' ? 'rv' : 'fr'; vs.flip = false; rerender(); } }, vs.dir === 'fr' ? 'Palabra → Definición' : 'Definición → Palabra'));
  ctl.firstChild.value = vs.filter;
  if (!w) return h('div', {}, ctl, h('div', { class: 'card' }, h('p', {}, words.length ? 'Mazo terminado 🎉' : 'Sin palabras.'), h('button', { class: 'btn p', onclick: () => { vs.queue = null; rerender(); } }, 'Reiniciar')));
  const front = vs.dir === 'fr' ? h('div', { class: 'word' }, w.word) : h('div', { class: 'def' }, w.definition);
  const back = vs.dir === 'fr' ? h('div', {}, h('div', { class: 'def' }, w.definition), h('div', { class: 'ex' }, '“' + (w.example || '') + '”')) : h('div', { class: 'word' }, w.word);
  const next = known => { const id = vs.queue.shift(); if (!known) vs.queue.push(id); G().grade({ id }, known ? 1 : 0); vs.flip = false; rerender(); };
  return h('div', {}, ctl, h('p', { class: 'muted' }, 'Restantes: ' + vs.queue.length),
    h('div', { class: 'card flash', role: 'button', tabindex: 0, onclick: () => { vs.flip = !vs.flip; rerender(); } }, vs.flip ? back : front),
    h('div', { class: 'rw' }, h('button', { class: 'btn good', onclick: () => next(true) }, 'La sé'), h('button', { class: 'btn again', onclick: () => next(false) }, 'Repasar luego')));
}

/* ---------- ESSAY ---------- */
const ETS = 'https://www.ets.org/gre/test-takers/general-test/prepare/content/analytical-writing/issue/pool.html';
const CATS = ['Tesis', 'Concesión/Refutación', 'Evidencia', 'Conclusión'];
const RULES = [['Concordancia', 'El verbo concuerda con el sujeto real, no con el sustantivo cercano: *The list of items **is** long.* *Each, every, neither, either* son singulares.'],
  ['Modificadores', 'Coloca el modificador junto a lo que describe. Mal: *Walking down the street, the trees were beautiful.* Bien: *Walking down the street, I saw beautiful trees.*'],
  ['Paralelismo', 'Misma forma gramatical en listas y comparaciones: *reading, writing, and traveling* (no *to travel*).'],
  ['Pronombres', 'Cada pronombre necesita un antecedente claro. Evita *this/it* ambiguos.'],
  ['Comparaciones', '*fewer* (contables) vs *less* (incontables); *between* (2) vs *among* (3+).']];
const selPrompt = () => D().essayPrompts.find(p => p.id === D().sel);
const promptBox = p => p ? h('div', { class: 'card' }, h('b', {}, p.claim), h('p', { class: 'muted' }, p.instruction)) : empty('Ningún tema elegido: ve a "Temas ETS".');
function essay(sub) {
  sub = view.e = ['prompts', 'guide', 'practice', 'syn'].includes(sub) ? sub : (view.e || 'prompts');
  const tabs = subTabs([['prompts', 'Temas ETS'], ['guide', 'Estructura y frases'], ['practice', 'Práctica'], ['syn', 'Sinónimos']], 'e', k => { location.hash = '#/essay/' + k; });
  return h('div', {}, tabs, { prompts: essayPrompts, guide: essayGuide, practice: essayPractice, syn: essaySyn }[sub]());
}
function essayPrompts() {
  const l = D().essayPrompts;
  return h('div', {}, h('div', { class: 'rw' }, h('button', { class: 'btn p', onclick: () => { if (l.length) { D().sel = l[Math.random() * l.length | 0].id; save(); rerender(); } } }, 'Tema aleatorio'), h('a', { href: ETS, target: '_blank', rel: 'noopener' }, 'Banco oficial ETS ↗')),
    promptBox(selPrompt()), h('h3', {}, 'Todos los temas'), !l.length && empty('Sin temas.'),
    l.map(p => h('div', { class: 'card' }, h('p', {}, p.claim), h('p', { class: 'muted' }, p.instruction), h('button', { class: 'btn' + (D().sel === p.id ? ' p' : ''), onclick: () => { D().sel = p.id; save(); rerender(); } }, D().sel === p.id ? 'Elegido' : 'Elegir'))));
}
function structCards() {
  const s = D().essayStructure; if (!s.length) return empty('Sin contenido: importa essayStructure por JSON (Ajustes ⚙).');
  return h('div', { class: 'grid' }, s.map((x, i) => h('div', { class: 'scard c' + i % 4 }, h('h3', {}, x.title), h('p', { class: 'muted', html: md(x.goal) }),
    h('ul', {}, (x.points || []).map(p => h('li', {}, h('b', {}, p.label + ': '), h('span', { html: md(p.text) })))),
    x.template ? h('div', {}, h('pre', {}, x.template), h('button', { class: 'sm', onclick: () => copy(x.template) }, 'Copiar plantilla')) : '')));
}
function essayGuide() {
  const ph = D().phrases, row = p => h('div', { class: 'rw' }, h('span', { class: 'grow' }, p.text), h('button', { class: 'sm', onclick: () => copy(p.text) }, 'Copiar')), other = ph.filter(p => !CATS.includes(p.category));
  return h('div', {}, h('h3', {}, 'Estructura'), structCards(), h('h3', {}, 'Banco de frases'),
    CATS.map(c => { const l = ph.filter(p => p.category === c); return h('details', { open: true }, h('summary', {}, c + ' (' + l.length + ')'), !l.length && empty('—'), l.map(row)); }),
    other.length ? h('details', {}, h('summary', {}, 'Otras'), other.map(row)) : '',
    h('h3', {}, 'Cheatsheet de gramática GRE'), RULES.map(([t, d]) => h('div', { class: 'card' }, h('b', {}, t), h('p', { html: md(d) }))));
}
const STOP = new Set('about which their there these those would could should because other being where while thing things people more most some have also than then this that with from they them into only very such what when your were been does'.split(' '));
const TYP = [[/\balot\b/i, '"alot" → "a lot" (mejor: "many/much")'], [/\b(should|could|would|must) of\b/i, '"should of" → "should have"'], [/\birregardless\b/i, '"irregardless" → "regardless"'], [/\bless (people|things|students|problems)\b/i, '"less" + contable → "fewer"'], [/\bdifferent than\b/i, '"different than" → "different from"'], [/\b(very|really|extremely)\b/i, 'Intensificador vago (very/really): usa un adjetivo más preciso'], [/\b(a lot of|lots of|stuff|thing|things)\b/i, 'Término informal/vago: sé específico'], [/\b(I think|I feel|in my opinion)\b/i, 'Evita muletillas; afirma la tesis directamente'], [/\b(gonna|wanna|gotta|kinda)\b/i, 'Coloquial: no usar en ensayo académico'], [/\bthe reason is because\b/i, '"the reason is because" → "the reason is that"'], [/\b(get|gets|got|getting)\b/i, '"get" es informal: prefiere obtain, become, receive']];
function lint(t) {
  const r = [], add = (s, m) => r.push([s, m]); if (!t.trim()) return r; let m;
  const rep = /\b([A-Za-z']+)\s+\1\b/gi, seen = new Set(); while (m = rep.exec(t)) { const k = m[0].toLowerCase(); if (!seen.has(k)) { seen.add(k); add('e', 'Palabra repetida: "' + m[0] + '"'); } }
  if (/ {2,}/.test(t)) add('w', 'Espacios dobles');
  if (/\s[,.;:!?]/.test(t)) add('w', 'Espacio antes de un signo de puntuación');
  if (/[,;:][A-Za-z]/.test(t) || /[a-z][.!?][A-Z]/.test(t)) add('w', 'Falta espacio después de puntuación');
  if (/(^|[.!?]\s+)[a-z]/.test(t)) add('e', 'Oración que empieza con minúscula');
  if (/(^|[\s(])i(\s|'|’)/.test(t)) add('e', '"i" debe ir en mayúscula: "I"');
  const caps = t.match(/\b[A-Z]{4,}\b/g); if (caps) add('w', 'Mayúsculas excesivas: ' + [...new Set(caps)].slice(0, 5).join(', '));
  if (!/[.!?"”)]\s*$/.test(t.trim())) add('w', 'El texto no termina con puntuación final');
  const sent = t.split(/[.!?]+/).filter(s => s.trim()).length, pas = (t.match(/\b(is|are|was|were|be|been|being)\s+(\w+ly\s+)?\w+(ed|en)\b/gi) || []).length;
  if (pas >= 3 && pas / Math.max(sent, 1) > 0.3) add('w', `Posible exceso de voz pasiva (${pas} en ${sent} oraciones)`);
  if (/\b\w+n't\b|\b(it|that|there|I|we|they|he|she)'(s|re|ve|ll|d|m)\b/i.test(t)) add('w', 'Contracciones: evítalas en inglés académico');
  TYP.forEach(([re, msg]) => { if (re.test(t)) add('w', msg); });
  const f = {}; (t.toLowerCase().match(/[a-z']{5,}/g) || []).forEach(w => { if (!STOP.has(w)) f[w] = (f[w] || 0) + 1; });
  Object.entries(f).filter(([, n]) => n >= 5).forEach(([w, n]) => add('w', `"${w}" aparece ${n} veces: varía el vocabulario`));
  return r;
}
function essayPractice() {
  const ta = h('textarea', { rows: 16, placeholder: 'Escribe tu ensayo aquí…', style: 'min-height:260px' });
  try { ta.value = localStorage.getItem('grestudy.draft') || ''; } catch (e) {}
  const wc = h('b', {}, '0'), out = h('ul', { class: 'lint' }), tm = h('span', { class: 'timer' }, '--:--');
  const upd = () => { wc.textContent = (ta.value.match(/\S+/g) || []).length; try { localStorage.setItem('grestudy.draft', ta.value); } catch (e) {} };
  ta.addEventListener('input', upd); upd();
  let total = 0;
  const sel = h('select', {}, h('option', { value: 0 }, 'Sin temporizador'), h('option', { value: 1800 }, '30:00'), h('option', { value: 2700 }, '45:00 (1.5x)'));
  const setT = () => { tm.textContent = total ? fmt(total) : '--:--'; tm.classList.toggle('warn', total > 0 && total <= 60); };
  sel.onchange = () => { stopTimers(); total = +sel.value; setT(); };
  const start = () => { if (!total) total = +sel.value; if (!total) return toast('Elige un tiempo'); stopTimers(); every(() => { total--; setT(); if (total <= 0) { stopTimers(); toast('¡Tiempo!'); } }, 1000); };
  const lb = h('button', { class: 'btn', onclick: () => { out.replaceChildren(); const r = lint(ta.value); if (!r.length) out.append(h('li', {}, ta.value.trim() ? '✓ Sin problemas detectados' : 'Escribe algo primero')); r.forEach(([s, m]) => out.append(h('li', { class: s }, (s === 'e' ? '● ' : '▲ ') + m))); } }, 'Revisar (linter)');
  return h('div', {}, promptBox(selPrompt()), h('div', { class: 'two' },
    h('div', {}, h('div', { class: 'rw' }, sel, tm, h('button', { class: 'btn', onclick: start }, 'Iniciar'), h('button', { class: 'btn', onclick: stopTimers }, 'Pausa')), ta,
      h('div', { class: 'rw' }, 'Palabras: ', wc, lb, h('button', { class: 'btn', onclick: () => { ta.value = ''; upd(); out.replaceChildren(); } }, 'Borrar')), out),
    h('details', { open: innerWidth >= 800 }, h('summary', {}, 'Guía de estructura'), structCards())));
}
function essaySyn() {
  const box = h('div', { class: 'tw' }), draw = q => {
    box.replaceChildren(); const l = D().synonyms.filter(s => !q || (s.basic + ' ' + (s.academic || []).join(' ')).toLowerCase().includes(q.toLowerCase()));
    box.append(l.length ? h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Básico'), h('th', {}, 'Académico / Jargon'))), h('tbody', {}, l.map(s => h('tr', {}, h('td', {}, h('b', {}, s.basic)), h('td', {}, (s.academic || []).map(a => h('span', { class: 'chip' }, a))))))) : empty('Sin resultados.'));
  };
  draw(''); return h('div', {}, h('input', { type: 'search', placeholder: 'Buscar…', oninput: e => draw(e.target.value) }), box);
}

/* ---------- PRONUNCIACIÓN ---------- */
const PROBS = ['The word has a sound that’s difficult for me. I say a different sound instead.', 'I put the stress on the wrong syllable, and it made the word hard to understand.', 'I didn’t know how to pronounce the word at first. It was a new one, or it had confusing spelling.'];
const IPA = ['θ', 'ð', 'ʃ', 'ʒ', 'tʃ', 'dʒ', 'ŋ', 'ɛ', 'æ', 'ɪ', 'ʊ', 'ə', 'ɑ', 'ɔ', 'ˈ', 'ˌ'];
let lastIpa = null;
function pron(sub) {
  sub = view.p = ['ref', 'journal'].includes(sub) ? sub : (view.p || 'ref');
  return h('div', {}, subTabs([['ref', 'Referencia offline'], ['journal', 'Journal']], 'p', k => { location.hash = '#/pron/' + k; }), sub === 'journal' ? journal() : pronRef());
}
function block(b) {
  switch (b.type) {
    case 'p': return h('p', { html: md(b.text) });
    case 'list': return h(b.ordered ? 'ol' : 'ul', {}, (b.items || []).map(i => h('li', { html: md(i) })));
    case 'table': return h('div', { class: 'tw' }, h('table', {}, h('thead', {}, h('tr', {}, (b.head || []).map(x => h('th', { html: md(x) })))), h('tbody', {}, (b.rows || []).map(r => h('tr', {}, r.map(c => h('td', { html: md(c) })))))));
    case 'dialogue': return h('div', {}, (b.lines || []).map(l => h('div', { class: 'dl' }, h('b', {}, l.who + ': '), h('span', { html: md(l.text) }))));
  }
  return null;
}
function pronRef() {
  const l = D().pronRef; if (!l.length) return empty('Sin contenido: importa pronRef por JSON (Ajustes ⚙).');
  return h('div', {}, l.map(s => h('details', {}, h('summary', {}, s.title), (s.blocks || []).map(block))));
}
function journal() {
  const J = D().journal;
  const w = h('input', { id: 'jw', placeholder: 'Palabra o frase' }), ipa = h('input', { id: 'jipa', placeholder: '/IPA/', onfocus: e => lastIpa = e.target });
  const kb = h('div', { class: 'rw ipa' }, IPA.map(s => h('button', { class: 'sm', type: 'button', onmousedown: e => e.preventDefault(), onclick: () => { const t = lastIpa || ipa; t.focus(); const a = t.selectionStart ?? t.value.length, b = t.selectionEnd ?? a; t.setRangeText(s, a, b, 'end'); t.dispatchEvent(new Event('change')); } }, s)));
  const sel = h('select', {}, PROBS.map((p, i) => h('option', { value: p }, (i + 1) + '. ' + p)), h('option', { value: '' }, 'Nota personalizada…')), cu = h('textarea', { rows: 2, placeholder: 'Escribe tu nota', style: 'display:none' });
  sel.onchange = () => cu.style.display = sel.value ? 'none' : 'block';
  const add = () => { if (!w.value.trim()) return toast('Falta la palabra'); J.push({ id: uid('j'), word: w.value.trim(), ipa: ipa.value.trim(), problem: sel.value || cu.value.trim() }); save(); rerender(); };
  const f = (e, k, ta) => { const x = h(ta ? 'textarea' : 'input', { onfocus: ev => { if (k === 'ipa') lastIpa = ev.target; }, onchange: ev => { e[k] = ev.target.value; save(); } }); x.value = e[k] || ''; if (ta) x.rows = 3; return x; };
  return h('div', {}, h('div', { class: 'card' }, h('b', {}, 'Nueva entrada'), w, h('div', { style: 'height:6px' }), ipa, kb, sel, cu, h('div', { class: 'rw' }, h('button', { class: 'btn p', onclick: add }, 'Agregar'))),
    h('div', { class: 'rw' }, h('button', { class: 'btn', onclick: () => download('pronunciation-journal.md', mdJournal(), 'text/markdown') }, 'Exportar .md'), h('button', { class: 'btn', onclick: () => copy(mdJournal()) }, 'Copiar .md')),
    J.length ? h('div', { class: 'tw' }, h('table', {}, h('thead', {}, h('tr', {}, ['Palabra', 'IPA', 'Problema', ''].map(x => h('th', {}, x)))),
      h('tbody', {}, J.map(e => h('tr', {}, h('td', {}, f(e, 'word')), h('td', {}, f(e, 'ipa')), h('td', {}, f(e, 'problem', 1)), h('td', {}, h('button', { class: 'sm', 'aria-label': 'Borrar', onclick: () => { D().journal = J.filter(x => x !== e); save(); rerender(); } }, '🗑'))))))) : empty('Sin entradas.'));
}
function mdJournal() {
  const cell = s => String(s || '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  const L = ['# University of California, Irvine', '## Division of Continuing Education', '### Optional Assignment: Pronunciation Journal ', '#### Procedure ',
    'Keep a record of words and sounds that cause problems for you. You can use a small notebook that you can carry with you, or use an electronic format—a phone app or computer software. ', '',
    'For each entry: ', '1. Write the word or phrase that caused the problem. ', '2. Check the pronunciation of the word in an online dictionary or pronunciation app. If you want, write down the pronunciation using IPA or other symbols. ',
    '3. Practice saying the word or phrase several times. ', '4. Make a note of why you think this word causes problems. For example: ',
    '\t1. The word has a sound that’s difficult for me. I say a different sound instead. ', '\t2. I put the stress on the wrong syllable, and it made the word hard to understand. ', '\t3. I didn’t know how to pronounce the word at first. It was a new one, or it had confusing spelling. ',
    '5. Use your notebook to practice and review from time to time. Read over your words and see if they’re becoming easier to pronounce.', '', '#### Example journal entries', '',
    '| Word or phrase | Pronunciation | What’s the problem? |', '| -------------- | ------------- | ------------------- |',
    '| recipe | /\'rɛsəpi/ | The spelling is tricky! I thought it should sound like “recite,” but with a “p” instead of “t,” but it’s different. It has three syllables. |'];
  D().journal.forEach(e => L.push(`| ${cell(e.word)} | ${cell(e.ipa)} | ${cell(e.problem)} |`));
  L.push('', '[[My Pronunciation Journal]]', '', 'Original Document:', '![[Optional Pronunciation Journal Instructions.pdf]]');
  return L.join('\n');
}

/* ---------- DATOS (dentro de Ajustes) ---------- */
const nq = q => {
  const ch = q.options || q.choices || []; let a = q.answer, i = typeof a === 'number' ? a : ch.indexOf(a);
  if (i < 0 && typeof a === 'string' && /^[A-Za-z]$/.test(a)) i = a.toUpperCase().charCodeAt(0) - 65;
  const lv = q.difficulty === 'mindbreaker' ? 'mindbreaker' : 'machine';
  return { id: q.id, type: 'mc', topic: q.topic || 'General', difficulty: lv === 'mindbreaker' ? 3 : 2, level: lv, variantGroup: q.variantGroup || q.id, stem: q.question, choices: ch, answer: Math.max(i, 0), explanation: q.explanation || '', wrongCount: q.wrongCount || 0 };
};
const dq = i => ({ id: i.id, topic: i.topic, difficulty: i.level, variantGroup: i.variantGroup, question: i.stem, options: i.choices, answer: i.choices[i.answer], explanation: i.explanation, wrongCount: wcOf(i) });
function exportData() { const e = D(), o = { version: 1 }; KEYS.forEach(k => o[k] = k === 'quant' ? e.quant.map(dq) : e[k]); return JSON.stringify(o, null, 2); }
function importData(inc, replace) {
  const e = D();
  KEYS.forEach(k => {
    if (!Array.isArray(inc[k])) return;
    const items = inc[k].filter(x => x && typeof x === 'object').map(x => { x = Object.assign({}, x); if (!x.id) x.id = uid(k[0]); if (k === 'quant') { if ('wrongCount' in x) e.wc[x.id] = x.wrongCount; x = nq(x); } return x; });
    if (replace) e[k] = items;
    else items.forEach(it => { const i = e[k].findIndex(x => x.id === it.id); i >= 0 ? e[k][i] = Object.assign({}, e[k][i], it) : e[k].push(it); });
  });
  save();
}
const SCHEMA = `{ "version":1,
 "quant":[{id,topic,difficulty:"machine|mindbreaker",variantGroup,question,options:[],answer,explanation,wrongCount}], "vocab":[{id,word,definition,example,notes,starred}],
 "phrases":[{id,category,text}], "essayPrompts":[{id,claim,instruction}], "synonyms":[{id,basic,academic:[]}],
 "essayStructure":[{id,title,goal,points:[{label,text}],template}],
 "pronRef":[{id,title,blocks:[{type:"p|list|table|dialogue",text|items,ordered|head,rows|lines:[{who,text}]}]}],
 "journal":[{id,word,ipa,problem}] }`;
function settings(box) {
  if (!box) return;
  const msg = h('p', { class: 'muted' }), act = h('div', { class: 'rw' }), sch = h('pre', { style: 'display:none' }, SCHEMA);
  const file = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: ev => {
    const f = ev.target.files[0]; if (!f) return;
    f.text().then(t => {
      let d; try { d = JSON.parse(t); if (!d || typeof d !== 'object' || Array.isArray(d)) throw 0; } catch (x) { msg.textContent = 'JSON inválido.'; act.replaceChildren(); return; }
      msg.textContent = '¿Cómo importar "' + f.name + '"?';
      const fin = (r, m) => () => { importData(d, r); msg.textContent = m; act.replaceChildren(); };
      act.replaceChildren(h('button', { class: 'btn again', onclick: fin(true, 'Reemplazado ✅') }, 'Reemplazar'), h('button', { class: 'btn p', onclick: fin(false, 'Fusionado ✅') }, 'Fusionar'), h('button', { class: 'btn', onclick: () => { act.replaceChildren(); msg.textContent = ''; } }, 'Cancelar'));
    }); ev.target.value = '';
  } });
  const card = h('div', { class: 'card x' }, h('b', {}, 'Contenido de estudio (JSON)'), h('p', { class: 'muted' }, 'Quant, vocabulario, essay y pronunciación que cargas tú. Importar: Reemplazar o Fusionar por id.'),
    h('div', { class: 'rw' }, h('button', { class: 'btn', onclick: () => download('gre-contenido.json', exportData(), 'application/json') }, 'Exportar'), h('button', { class: 'btn', onclick: () => file.click() }, 'Importar'), file, h('button', { class: 'btn', onclick: () => sch.style.display = sch.style.display === 'none' ? 'block' : 'none' }, 'Ver esquema JSON')),
    msg, act, sch,
    h('div', { class: 'rw' }, h('button', { class: 'btn', onclick: () => download('pronunciation-journal.md', mdJournal(), 'text/markdown') }, 'Journal .md'), h('button', { class: 'btn', onclick: () => copy(mdJournal()) }, 'Copiar Journal')));
  box.replaceChildren(card);
}

window.GSX = {
  leave() { stopTimers(); if (app()) app().className = ''; },
  settings,
  mdJournal,
  lint,
  routes: {
    quant: page('Quant', quantMenu),
    verbal: (a, b) => { view.v = a === 'cards' ? 'cards' : a === 'list' ? 'list' : (view.v || 'list'); return page('Verbal', verbal)(a, b); },
    essay: (a, b) => page('Essay & Writing', async () => essay(a))(a, b),
    pron: (a, b) => page('Pronunciación', async () => pron(a))(a, b)
  }
};
Object.defineProperty(window, 'APP_DATA', { get: () => D() });
})();
