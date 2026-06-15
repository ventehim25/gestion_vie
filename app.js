/* ============================================================
   Gestion de Vie — PWA (vanilla JS, stockage local hors-ligne)
   Données 100% sur ton appareil (localStorage). Sauvegarde
   manuelle export/import dans Réglages.
   ============================================================ */

const KEY = 'gestion_vie_v1';
const $ = (s, r = document) => r.querySelector(s);
const el = (h) => { const t = document.createElement('template'); t.innerHTML = h.trim(); return t.content.firstElementChild; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const todayISO = () => new Date().toISOString().slice(0, 10);
const monthOf = (iso) => iso.slice(0, 7);
const fmtDH = (n) => (Math.round(n) || 0).toLocaleString('fr-FR') + ' DH';
const escape = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const PRAYERS = ['Fajr', 'Dohr', 'Asr', 'Maghrib', 'Icha'];
const ACCOUNTS = ['Moi', 'Maman', 'Business'];
const OWN_ACCOUNTS = ['Moi', 'Business']; // caisse Maman exclue du Budget (onglet dédié)
const CATS = {
  depense: ['Nourriture', 'Loyer', 'Assurance', 'Carburant', 'Voiture', 'Enfants', 'Santé', 'Médicaments', 'Factures', 'Sadaqa', 'Marchandise', 'Autre'],
  revenu: ['Filtres', 'Loyer garage', 'Salaire', 'Vente', 'Autre'],
};

/* ---------- Données par défaut (pré-remplies avec ta situation) ---------- */
function seed() {
  const today = todayISO();
  return {
    version: 1,
    profile: { name: '', ville: '' },
    capital: 0,
    savings: { goal: 20000, log: [] },
    debts: [],
    reminder: { enabled: false, time: '20:30' },
    theme: 'light',
    habits: [],
    car: { km: 0, log: [] },
    vault: [],
    transactions: [],
    fixed: [
      { id: uid(), label: 'Assurance voiture', amount: 0, account: 'Moi', cat: 'Assurance' },
      { id: uid(), label: 'Nourriture (estimée)', amount: 0, account: 'Moi', cat: 'Nourriture' },
      { id: uid(), label: 'Loyer (futur appart.)', amount: 0, account: 'Moi', cat: 'Loyer' },
      { id: uid(), label: 'Médicaments maman', amount: 0, account: 'Maman', cat: 'Médicaments' },
    ],
    incomes: [
      { id: uid(), label: 'Distribution filtres', amount: 0, account: 'Business', cat: 'Filtres' },
      { id: uid(), label: 'Loyer garage (maman)', amount: 0, account: 'Maman', cat: 'Loyer garage' },
    ],
    tasks: [],
    echeances: [],
    meals: { plan: {}, stock: [], shopping: [], ideas: [] },
    prayer: { adjust: { Fajr: 0, Dohr: 0, Asr: 0, Maghrib: 0, Icha: 0 } },
    spiritual: { prayers: {}, quran: [], sadaqa: [], quranGoal: 2 },
    kids: [
      { id: uid(), name: 'Enfant 1', notes: '', items: [] },
      { id: uid(), name: 'Enfant 2', notes: '', items: [] },
    ],
    mother: {
      meds: [],
      cnss: [
        { id: uid(), label: 'Rassembler les pièces (CIN, photos)', done: false },
        { id: uid(), label: 'Justificatif du revenu / garage', done: false },
        { id: uid(), label: 'Certificat médical (Alzheimer)', done: false },
        { id: uid(), label: 'Déposer le dossier à la CNSS', done: false },
      ],
      notes: '',
    },
    farm: {
      opening: { perso: 0, partage: 0 },
      trees: { me: 79, gm: 132 },
      sheep: { log: [] },
      harvest: [],
      agenda: [],
      tx: [],
    },
    projects: [
      { id: uid(), title: 'Appartement pour habiter', type: 'Logement', cost: 0, priority: 1, status: 'reflexion',
        pros: ['Sécurité de la famille', 'Stabilité'], cons: ['Bloque du capital', 'Mensualités'], notes: '' },
      { id: uid(), title: 'Garage locatif (revenu passif)', type: 'Investissement', cost: 0, priority: 2, status: 'reflexion',
        pros: ['Revenu mensuel régulier', 'Modèle déjà prouvé'], cons: ['Ne règle pas le logement'], notes: '' },
      { id: uid(), title: 'Agriculture + élevage', type: 'Investissement', cost: 0, priority: 3, status: 'en_attente',
        pros: ['Terres déjà possédées', 'Potentiel élevage'], cons: ['Éloignement', 'Sécurité du terrain', 'Demande ma présence'], notes: '' },
    ],
  };
}

/* ---------- Store ---------- */
let DB = load();
function load() {
  try { const r = localStorage.getItem(KEY); if (r) return migrate(JSON.parse(r)); } catch (e) {}
  const s = seed(); persist(s); return s;
}
function migrate(d) {
  const s = seed();
  const out = Object.assign({}, s, d);
  out.profile = Object.assign({}, s.profile, d.profile || {});
  out.savings = Object.assign({}, s.savings, d.savings || {});
  if (!Array.isArray(out.savings.log)) out.savings.log = [];
  out.debts = Array.isArray(d.debts) ? d.debts : s.debts;
  out.echeances = Array.isArray(d.echeances) ? d.echeances : s.echeances;
  out.meals = {
    plan: (d.meals && d.meals.plan) || {},
    stock: (d.meals && Array.isArray(d.meals.stock)) ? d.meals.stock : [],
    shopping: (d.meals && Array.isArray(d.meals.shopping)) ? d.meals.shopping : [],
    ideas: (d.meals && Array.isArray(d.meals.ideas)) ? d.meals.ideas : [],
  };
  out.reminder = Object.assign({}, s.reminder, d.reminder || {});
  out.theme = d.theme === 'dark' ? 'dark' : 'light';
  out.habits = Array.isArray(d.habits) ? d.habits : s.habits;
  out.car = { km: (d.car && +d.car.km) || 0, log: (d.car && Array.isArray(d.car.log)) ? d.car.log : [] };
  out.vault = Array.isArray(d.vault) ? d.vault : s.vault;
  out.prayer = Object.assign({}, s.prayer, d.prayer || {});
  out.prayer.adjust = Object.assign({}, s.prayer.adjust, (d.prayer && d.prayer.adjust) || {});
  out.mother = Object.assign({}, s.mother, d.mother || {});
  out.spiritual = Object.assign({}, s.spiritual, d.spiritual || {});
  const df = d.farm || {};
  out.farm = {
    opening: Object.assign({}, s.farm.opening, df.opening || {}),
    trees: Object.assign({}, s.farm.trees, df.trees || {}),
    sheep: Object.assign({}, s.farm.sheep, df.sheep || {}),
    harvest: Array.isArray(df.harvest) ? df.harvest : s.farm.harvest,
    agenda: Array.isArray(df.agenda) ? df.agenda : s.farm.agenda,
    tx: Array.isArray(df.tx) ? df.tx : s.farm.tx,
  };
  return out;
}
function persist(d = DB) { localStorage.setItem(KEY, JSON.stringify(d)); }
function save() { DB.updatedAt = Date.now(); persist(); scheduleGhPush(); }

/* ---------- Sauvegarde GitHub (Gist privé) ---------- */
const SYNC_KEY = 'gestion_vie_sync';
const GIST_FILE = 'gestion-vie-data.json';
let SYNC = loadSync();
function loadSync() { try { return JSON.parse(localStorage.getItem(SYNC_KEY)) || {}; } catch (e) { return {}; } }
function saveSync() { localStorage.setItem(SYNC_KEY, JSON.stringify(SYNC)); }
function ghHeaders() { return { 'Authorization': 'token ' + SYNC.token, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' }; }
async function ghCreateGist() {
  const res = await fetch('https://api.github.com/gists', { method: 'POST', headers: ghHeaders(), body: JSON.stringify({ description: 'Données Gestion de Vie (privé)', public: false, files: { [GIST_FILE]: { content: JSON.stringify(DB) } } }) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return (await res.json()).id;
}
async function ghPush() {
  if (!SYNC.token || !SYNC.gistId) return;
  const res = await fetch('https://api.github.com/gists/' + SYNC.gistId, { method: 'PATCH', headers: ghHeaders(), body: JSON.stringify({ files: { [GIST_FILE]: { content: JSON.stringify(DB) } } }) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  SYNC.lastSync = Date.now(); saveSync();
}
async function ghPull() {
  if (!SYNC.token || !SYNC.gistId) return null;
  const res = await fetch('https://api.github.com/gists/' + SYNC.gistId, { headers: ghHeaders() });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const j = await res.json();
  const f = j.files && j.files[GIST_FILE];
  return f ? JSON.parse(f.content) : null;
}
let pushTimer = null;
function scheduleGhPush() {
  if (!SYNC.enabled) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { ghPush().catch(() => {}); }, 2500);
}
async function syncOnLoad() {
  if (!SYNC.enabled || !SYNC.token || !SYNC.gistId) return;
  try {
    const remote = await ghPull();
    if (remote && (remote.updatedAt || 0) > (DB.updatedAt || 0)) { DB = migrate(remote); persist(); router(); }
  } catch (e) {}
}

/* ---------- Calculs budget (caisse Maman exclue : elle a son propre onglet) ---------- */
const isOwn = (x) => x.account !== 'Maman';
function savingsTotal() { return DB.savings.log.reduce((a, e) => a + (+e.amount || 0), 0); }
function debtsTotal() { return DB.debts.filter(d => !d.paid).reduce((a, d) => a + (+d.amount || 0), 0); }
function monthTx(month = monthOf(todayISO())) { return DB.transactions.filter(t => monthOf(t.date) === month); }
function sumFixed() { return DB.fixed.filter(isOwn).reduce((a, f) => a + (+f.amount || 0), 0); }
function sumIncomes() { return DB.incomes.filter(isOwn).reduce((a, f) => a + (+f.amount || 0), 0); }
function monthTotals(month) {
  const tx = monthTx(month).filter(isOwn);
  const dep = tx.filter(t => t.type === 'depense').reduce((a, t) => a + (+t.amount || 0), 0);
  const rev = tx.filter(t => t.type === 'revenu').reduce((a, t) => a + (+t.amount || 0), 0);
  return { dep, rev, net: rev - dep };
}
function todayTotals() {
  const t = DB.transactions.filter(t => t.date === todayISO() && isOwn(t));
  return { dep: t.filter(x => x.type === 'depense').reduce((a, x) => a + (+x.amount || 0), 0) };
}

/* ---------- Horaires de prière (calcul astronomique, Kénitra) ---------- */
const KENITRA = { lat: 34.261, lng: -6.5802 };
const _dtr = d => d * Math.PI / 180, _rtd = r => r * 180 / Math.PI;
const _sin = d => Math.sin(_dtr(d)), _cos = d => Math.cos(_dtr(d)), _tan = d => Math.tan(_dtr(d));
const _asin = x => _rtd(Math.asin(x)), _acos = x => _rtd(Math.acos(x)), _atan2 = (y, x) => _rtd(Math.atan2(y, x)), _acot = x => _rtd(Math.atan(1 / x));
const _fixH = h => ((h % 24) + 24) % 24, _fixA = a => ((a % 360) + 360) % 360;
function _julian(y, m, d) { if (m <= 2) { y -= 1; m += 12; } const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4); return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5; }
function _sunPos(jd) {
  const D = jd - 2451545.0;
  const g = _fixA(357.529 + 0.98560028 * D), q = _fixA(280.459 + 0.98564736 * D);
  const L = _fixA(q + 1.915 * _sin(g) + 0.020 * _sin(2 * g));
  const e = 23.439 - 0.00000036 * D;
  const decl = _asin(_sin(e) * _sin(L));
  const RA = _fixH(_atan2(_cos(e) * _sin(L), _cos(L)) / 15);
  return { decl, eqt: q / 15 - RA };
}
function prayerTimes(date) {
  const { lat, lng } = KENITRA;
  const tz = -date.getTimezoneOffset() / 60;
  const jd = _julian(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const { decl, eqt } = _sunPos(jd);
  const noon = _fixH(12 - eqt);
  const T = a => (1 / 15) * _acos((-_sin(a) - _sin(decl) * _sin(lat)) / (_cos(decl) * _cos(lat)));
  const asrA = -_acot(1 + _tan(Math.abs(lat - decl)));
  const adj = tz - lng / 15;
  const o = DB.prayer.adjust || {};
  const mk = (h, name) => _fixH(h + adj + ((+o[name] || 0) / 60));
  return {
    Fajr: mk(noon - T(18), 'Fajr'),
    Chourouq: mk(noon - T(0.833), 'Chourouq'),
    Dohr: mk(noon, 'Dohr'),
    Asr: mk(noon + T(asrA), 'Asr'),
    Maghrib: mk(noon + T(0.833), 'Maghrib'),
    Icha: mk(noon + T(17), 'Icha'),
  };
}
function fmtHM(h) { h = _fixH(h + 0.5 / 60); const hh = Math.floor(h); const mm = Math.floor((h - hh) * 60); return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); }
function nextPrayer(times) {
  const now = new Date(); const nowH = now.getHours() + now.getMinutes() / 60;
  const order = ['Fajr', 'Chourouq', 'Dohr', 'Asr', 'Maghrib', 'Icha'];
  for (const k of order) if (times[k] > nowH) return { name: k, at: times[k] };
  return { name: 'Fajr', at: times.Fajr, tomorrow: true };
}

/* ---------- Zakat ---------- */
function zakatBase() { return (+DB.capital || 0) + savingsTotal(); }
function zakatDue() { return zakatBase() * 0.025; }

/* ---------- Habitudes ---------- */
function habitDoneToday(h) { return (h.dates || []).includes(todayISO()); }
function habitStreak(h) {
  const set = new Set(h.dates || []); let s = 0; const d = new Date();
  if (!set.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
  for (;;) { const iso = d.toISOString().slice(0, 10); if (set.has(iso)) { s++; d.setDate(d.getDate() - 1); } else break; }
  return s;
}

/* ---------- Export vers l'agenda du téléphone (.ics, alarmes natives) ---------- */
function _icsUTC(d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
function _icsLocal(y, m, day, hh, mm) { const p = n => String(n).padStart(2, '0'); return `${y}${p(m)}${p(day)}T${p(hh)}${p(mm)}00`; }
function _icsEsc(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
function downloadICS(filename, events) {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GestionVie//FR', 'CALSCALE:GREGORIAN'];
  events.forEach(e => {
    L.push('BEGIN:VEVENT', 'UID:' + (e.uid || uid()) + '@gestionvie', 'DTSTAMP:' + _icsUTC(new Date()));
    if (e.allday) L.push('DTSTART;VALUE=DATE:' + e.dateVal);
    else { L.push('DTSTART:' + e.start); if (e.duration) L.push('DURATION:' + e.duration); }
    L.push('SUMMARY:' + _icsEsc(e.summary));
    if (e.rrule) L.push('RRULE:' + e.rrule);
    if (e.alarm) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + _icsEsc(e.summary), 'TRIGGER:' + e.alarm, 'END:VALARM');
    L.push('END:VEVENT');
  });
  L.push('END:VCALENDAR');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([L.join('\r\n')], { type: 'text/calendar' }));
  a.download = filename; a.click();
}
function exportPrayerICS() {
  const evs = [], base = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(base); d.setDate(base.getDate() + i);
    const tt = prayerTimes(d);
    ['Fajr', 'Dohr', 'Asr', 'Maghrib', 'Icha'].forEach(k => {
      let h = _fixH(tt[k] + 0.5 / 60); const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
      evs.push({ uid: uid(), start: _icsLocal(d.getFullYear(), d.getMonth() + 1, d.getDate(), hh, mm), duration: 'PT15M', summary: '🕌 ' + k, alarm: '-PT0M' });
    });
  }
  downloadICS('prieres-kenitra-30j.ics', evs);
}
function exportMedICS() {
  const evs = [], t = new Date();
  (DB.mother.meds || []).forEach(med => (med.times || []).forEach(hm => {
    const [hh, mm] = hm.split(':').map(Number);
    evs.push({ uid: uid(), start: _icsLocal(t.getFullYear(), t.getMonth() + 1, t.getDate(), hh, mm), duration: 'PT10M', summary: '💊 ' + med.name, rrule: 'FREQ=DAILY', alarm: '-PT0M' });
  }));
  if (!evs.length) { alert('Ajoute d\'abord des heures de prise aux médicaments.'); return; }
  downloadICS('medicaments-maman.ics', evs);
}
function exportEcheanceICS(e) {
  const [y, m, d] = e.date.split('-').map(Number);
  const ev = { uid: e.id, allday: true, dateVal: `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`, summary: '⏰ ' + e.label, alarm: '-P1D' };
  if (e.recur === 'monthly') ev.rrule = 'FREQ=MONTHLY'; else if (e.recur === 'yearly') ev.rrule = 'FREQ=YEARLY';
  downloadICS('echeance.ics', [ev]);
}

/* ============================================================
   ROUTER
   ============================================================ */
const routes = {
  '/': renderHome, 'budget': renderBudget, 'planning': renderPlanning,
  'repas': renderRepas, 'famille': renderFamille, 'maman': renderMaman, 'ferme': renderFerme, 'spirituel': renderSpirituel, 'projets': renderProjets,
  'reglages': renderReglages, 'revue': renderRevue, 'voiture': renderVoiture, 'stats': renderStats, 'coffre': renderCoffre,
};
function currentRoute() { return (location.hash.replace(/^#\//, '') || '/'); }
function applyTheme() { document.body.classList.toggle('dark', DB.theme === 'dark'); }
function router() {
  applyTheme();
  const r = currentRoute();
  const fn = routes[r] || renderHome;
  $('#view').innerHTML = '';
  fn($('#view'));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === r));
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', router);
function go(r) { location.hash = '#/' + (r === '/' ? '' : r); }

/* ============================================================
   MODALE générique
   ============================================================ */
function modal(title, bodyHTML, onMount) {
  const bg = el(`<div class="modal-bg"><div class="modal"><h2>${escape(title)}</h2><div class="mbody">${bodyHTML}</div></div></div>`);
  bg.addEventListener('click', e => { if (e.target === bg) bg.remove(); });
  document.body.appendChild(bg);
  if (onMount) onMount(bg);
  return bg;
}
function field(label, inner) { return `<label class="field">${label}${inner}</label>`; }
function options(arr, sel) { return arr.map(a => `<option ${a === sel ? 'selected' : ''}>${escape(a)}</option>`).join(''); }

/* ============================================================
   ACCUEIL
   ============================================================ */
function renderHome(v) {
  const m = monthOf(todayISO());
  const tot = monthTotals(m);
  const tday = todayTotals();
  const fixed = sumFixed(), inc = sumIncomes();
  const dispo = inc - fixed;
  const prDone = (DB.spiritual.prayers[todayISO()] || []).length;
  const tasks = DB.tasks.filter(t => t.date === todayISO());
  const tasksDone = tasks.filter(t => t.done).length;
  const hello = DB.profile.name ? `Salam ${escape(DB.profile.name)} 👋` : 'Salam 👋';
  const mSolde = mamanSolde();
  const fPerso = caisseSums('perso').solde;
  const fShare = treeSplit(caisseSums('partage').outs);
  const sheepBen = sheepStats().benefice;
  const saved = savingsTotal(), goal = +DB.savings.goal || 0;
  const owed = debtsTotal();
  const noTxToday = !DB.transactions.some(t => t.date === todayISO());
  const nowHM = new Date().toTimeString().slice(0, 5);
  const showReminder = DB.reminder.enabled && noTxToday && nowHM >= DB.reminder.time;
  bumpEcheances();
  const upcoming = DB.echeances.filter(e => daysUntil(e.date) <= 30).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
  const caisses = [
    ['💰 Capital (moi)', DB.capital, 'teal'],
    ['💸 On me doit (impayés)', owed, owed > 0 ? 'teal' : 'pos'],
    ['👵 Caisse Maman', mSolde, mSolde >= 0 ? 'pos' : 'neg'],
    ['🚜 Ferme — perso', fPerso, fPerso >= 0 ? 'pos' : 'neg'],
    ['🫒 Oliviers — ma part', fShare.me, 'neg'],
    ['🫒 Oliviers — grand-mère', fShare.gm, 'neg'],
    ['🐑 Moutons (bénéfice)', sheepBen, sheepBen >= 0 ? 'pos' : 'neg'],
  ];

  v.append(el(`<div>
    <h1>${hello}</h1>
    ${showReminder ? `<div class="hint" style="background:#fef3c7;color:#92400e">🌙 N'oublie pas : note tes dépenses du jour (2 min). C'est la règle du soir.</div>` : ''}
    <div class="hint">Astuce : note chaque dépense pendant 30 jours. Tu connaîtras enfin tes vraies charges fixes — et les grandes décisions deviendront claires.</div>

    <div class="card">
      <div class="row between"><h3 style="margin:0">🎯 Fonds d'urgence</h3><button class="btn ghost sm" id="addSave">+ Mettre de côté</button></div>
      <div class="row between" style="margin-top:8px"><b style="font-size:1.3rem">${fmtDH(saved)}</b><small>objectif ${fmtDH(goal)}</small></div>
      <div class="bar"><span style="width:${goal ? Math.min(100, saved / goal * 100) : 0}%"></span></div>
      <button class="btn gray sm" id="editGoal" style="margin-top:10px">Modifier l'objectif</button>
    </div>

    <div class="grid2">
      <div class="stat"><div class="label">Capital</div><div class="value teal">${fmtDH(DB.capital)}</div></div>
      <div class="stat"><div class="label">Dépensé aujourd'hui</div><div class="value neg">${fmtDH(tday.dep)}</div></div>
      <div class="stat"><div class="label">Revenus / mois</div><div class="value pos">${fmtDH(inc)}</div></div>
      <div class="stat"><div class="label">Charges fixes / mois</div><div class="value neg">${fmtDH(fixed)}</div></div>
    </div>

    <div class="card">
      <div class="row between"><h3 style="margin:0">Disponible / mois (revenus − charges fixes)</h3></div>
      <div class="value ${dispo >= 0 ? 'pos' : 'neg'}" style="font-size:1.6rem;font-weight:800;margin-top:6px">${fmtDH(dispo)}</div>
      <small>${fixed === 0 ? 'Renseigne tes charges fixes dans Budget pour un chiffre réel.' : 'Ce qui te reste pour épargner / loyer / projets.'}</small>
    </div>

    ${upcoming.length ? `<div class="section-title">⏰ Échéances proches</div><div class="card">${upcoming.map(e => { const dl = daysUntil(e.date); return `<div class="item"><span class="ic">⏰</span><span class="grow"><div class="t">${escape(e.label)}</div><div class="s">${e.date}</div></span><span class="chip ${dl <= 7 ? 'red' : ''}">${dl < 0 ? 'en retard' : dl === 0 ? "auj." : dl + ' j'}</span></div>`; }).join('')}</div>` : ''}

    <div class="section-title">Vue d'ensemble des caisses</div>
    <div class="card">
      ${caisses.map(([lab, val, cls]) => `<div class="item"><span class="grow"><div class="t">${lab}</div></span><b class="amt ${cls}">${fmtDH(val)}</b></div>`).join('')}
      <small>« Ma part » et « grand-mère » = répartition des dépenses partagées de la ferme au prorata des arbres.</small>
    </div>

    <div class="section-title">Aujourd'hui</div>
    <div class="card tap" id="goPray">
      <div class="row between"><h3 style="margin:0">🕌 Prières</h3><span class="chip ${prDone === 5 ? 'green' : ''}">${prDone}/5</span></div>
      <div class="bar"><span style="width:${prDone / 5 * 100}%"></span></div>
    </div>
    <div class="card tap" id="goTasks">
      <div class="row between"><h3 style="margin:0">📅 Tâches du jour</h3><span class="chip ${tasks.length && tasksDone === tasks.length ? 'green' : ''}">${tasksDone}/${tasks.length}</span></div>
      ${tasks.length ? tasks.slice(0, 3).map(t => `<div class="item"><span class="check ${t.done ? 'on' : ''}">${t.done ? '✓' : ''}</span><span class="grow"><div class="t">${escape(t.title)}</div></span></div>`).join('') : '<small>Aucune tâche. Ajoute ta journée dans Planning.</small>'}
    </div>

    <div class="section-title">🔥 Habitudes</div>
    <div class="card" id="habitsCard">
      <div class="row between"><h3 style="margin:0">Aujourd'hui</h3><button class="btn ghost sm" id="manageHabits">gérer</button></div>
      <div id="habitsList" style="margin-top:6px"></div>
    </div>

    <div class="section-title">Bilan du mois</div>
    <div class="grid2">
      <div class="stat"><div class="label">Entrées</div><div class="value pos">${fmtDH(tot.rev)}</div></div>
      <div class="stat"><div class="label">Sorties</div><div class="value neg">${fmtDH(tot.dep)}</div></div>
    </div>

    <div class="section-title">Outils</div>
    <div class="grid2">
      <a class="btn ghost" href="#/stats">📈 Statistiques</a>
      <a class="btn ghost" href="#/revue">📊 Revue semaine</a>
      <a class="btn ghost" href="#/voiture">🚗 Voiture</a>
      <a class="btn ghost" href="#/coffre">🗂️ Coffre infos</a>
    </div>

    <a class="btn block ghost" href="#/reglages" style="margin-top:10px">⚙️ Réglages & sauvegarde</a>
  </div>`));

  // Habitudes
  const hc = $('#habitsList', v);
  if (!DB.habits.length) hc.append(el('<small>Aucune habitude. Touche « gérer » pour en ajouter (sport, eau, dhikr…).</small>'));
  DB.habits.forEach(h => {
    const on = habitDoneToday(h); const st = habitStreak(h);
    const row = el(`<div class="item"><span class="check ${on ? 'on' : ''}">${on ? '✓' : ''}</span><span class="ic">${h.icon || '⭐'}</span><span class="grow"><div class="t">${escape(h.name)}</div></span><span class="chip ${st > 0 ? 'green' : 'gray'}">🔥 ${st} j</span></div>`);
    $('.check', row).onclick = () => { const iso = todayISO(); h.dates = h.dates || []; h.dates = h.dates.includes(iso) ? h.dates.filter(x => x !== iso) : [...h.dates, iso]; save(); router(); };
    hc.append(row);
  });
  $('#manageHabits', v).onclick = () => habitsModal();
  $('#goPray', v).onclick = () => go('spirituel');
  $('#goTasks', v).onclick = () => go('planning');
  $('#addSave', v).onclick = () => {
    const bg = modal('Mettre de côté', `<p><small>« Paie-toi d'abord » : ajoute ce que tu épargnes ce mois.</small></p>${field('Montant (DH)', '<input id="sv_a" type="number" inputmode="decimal" autofocus>')}${field('Note', '<input id="sv_n" placeholder="ex: épargne du mois">')}<div class="modal-actions"><button class="btn" id="ok">Enregistrer</button></div>`);
    $('#ok', bg).onclick = () => { const a = +$('#sv_a', bg).value; if (!a) return; DB.savings.log.push({ id: uid(), date: todayISO(), amount: a, note: $('#sv_n', bg).value.trim() }); save(); bg.remove(); router(); };
  };
  $('#editGoal', v).onclick = () => {
    const bg = modal('Objectif d\'épargne', `<p><small>Vise 3 à 6 mois de charges (fonds d'urgence).</small></p>${field('Objectif (DH)', `<input id="g_v" type="number" inputmode="decimal" value="${goal || ''}">`)}<div class="modal-actions"><button class="btn" id="ok">Enregistrer</button></div>`);
    $('#ok', bg).onclick = () => { DB.savings.goal = +$('#g_v', bg).value || 0; save(); bg.remove(); router(); };
  };
}

/* ============================================================
   BUDGET  (ma caisse : Moi / Business — Maman a son propre onglet)
   ============================================================ */
function renderBudget(v) {
  const m = monthOf(todayISO());
  const tx = monthTx(m).filter(isOwn).sort((a, b) => b.date.localeCompare(a.date));
  const tot = monthTotals(m);

  const byCat = {};
  tx.filter(t => t.type === 'depense').forEach(t => byCat[t.cat] = (byCat[t.cat] || 0) + (+t.amount || 0));
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const maxCat = cats.length ? cats[0][1] : 1;

  v.append(el(`<div>
    <h1>💰 Budget</h1>
    <div class="grid3">
      <div class="stat"><div class="label">Entrées</div><div class="value pos">${fmtDH(tot.rev)}</div></div>
      <div class="stat"><div class="label">Sorties</div><div class="value neg">${fmtDH(tot.dep)}</div></div>
      <div class="stat"><div class="label">Net</div><div class="value ${tot.net >= 0 ? 'pos' : 'neg'}">${fmtDH(tot.net)}</div></div>
    </div>

    <div class="section-title">💸 Qui me doit de l'argent (impayés)</div>
    <div class="card">
      <div class="row between"><span><b>Total à récupérer</b></span><b class="amt pos">${fmtDH(debtsTotal())}</b></div>
      <div id="debtList" style="margin-top:6px"></div>
      <button class="btn ghost sm" id="addDebt" style="margin-top:8px">+ Ajouter un impayé</button>
    </div>

    <div class="section-title">Charges fixes & revenus récurrents</div>
    <div class="card">
      <div class="row between"><span><b>Revenus</b> récurrents</span><b class="amt pos">${fmtDH(sumIncomes())}</b></div>
      ${DB.incomes.filter(isOwn).map(f => recurRow(f, 'incomes')).join('') || '<small>Aucun</small>'}
      <div class="divider"></div>
      <div class="row between"><span><b>Charges</b> fixes</span><b class="amt neg">${fmtDH(sumFixed())}</b></div>
      ${DB.fixed.filter(isOwn).map(f => recurRow(f, 'fixed')).join('') || '<small>Aucune</small>'}
      <div class="row" style="gap:8px;margin-top:10px">
        <button class="btn ghost sm" id="addInc">+ Revenu</button>
        <button class="btn ghost sm" id="addFix">+ Charge fixe</button>
      </div>
    </div>

    <div class="section-title">Dépenses par catégorie (ce mois)</div>
    <div class="card">
      ${cats.length ? cats.map(([c, n]) => `<div class="catrow" data-catrow="${escape(c)}" style="margin-bottom:10px;cursor:pointer"><div class="row between"><span>${escape(c)} <small>›</small></span><b>${fmtDH(n)}</b></div><div class="bar"><span style="width:${n / maxCat * 100}%"></span></div></div>`).join('') : '<div class="empty">Aucune dépense ce mois. Ajoute-en avec le bouton +.</div>'}
      ${cats.length ? '<small>Touche une catégorie pour voir le détail (ex : viande, lait…) et repérer le gaspillage.</small>' : ''}
    </div>

    <div class="section-title">Opérations du mois</div>
    <div class="card" id="txList">
      ${tx.length ? tx.map(txRow).join('') : '<div class="empty">Aucune opération. Touche le bouton + en bas à droite.</div>'}
    </div>
  </div>`));

  v.append(el(`<button class="btn fab" id="fab">＋</button>`));
  $('#fab', v).onclick = () => txModal();
  $('#addInc', v).onclick = () => recurModal('incomes');
  $('#addFix', v).onclick = () => recurModal('fixed');
  v.querySelectorAll('[data-del-tx]').forEach(b => b.onclick = () => { DB.transactions = DB.transactions.filter(t => t.id !== b.dataset.delTx); save(); router(); });
  v.querySelectorAll('[data-edit-recur]').forEach(b => b.onclick = () => recurModal(b.dataset.kind, b.dataset.editRecur));
  v.querySelectorAll('[data-catrow]').forEach(r => r.onclick = () => catDetailModal(r.dataset.catrow));

  // Impayés
  const dl = $('#debtList', v);
  const unpaid = DB.debts.filter(d => !d.paid).sort((a, b) => (b.amount || 0) - (a.amount || 0));
  if (!unpaid.length) dl.append(el('<small>Personne ne te doit d\'argent. 👍</small>'));
  unpaid.forEach(d => {
    const row = el(`<div class="item"><span class="ic">💸</span>
      <span class="grow"><div class="t">${escape(d.name)}</div><div class="s">${d.date}${d.note ? ' · ' + escape(d.note) : ''}</div></span>
      <b class="amt pos">${fmtDH(d.amount)}</b>
      <button class="btn sm" data-paid title="Marquer payé">✓</button>
      <button class="btn gray sm" data-x>✕</button></div>`);
    $('[data-paid]', row).onclick = () => { if (confirm(d.name + ' t\'a payé ' + fmtDH(d.amount) + ' ?')) { d.paid = true; save(); router(); } };
    $('[data-x]', row).onclick = () => { DB.debts = DB.debts.filter(x => x !== d); save(); router(); };
    dl.append(row);
  });
  $('#addDebt', v).onclick = () => {
    const bg = modal('Impayé — qui me doit', `${field('Nom (garage / station / client)', '<input id="d_n" autofocus placeholder="ex: Garage Sidi Kacem">')}${field('Montant (DH)', '<input id="d_a" type="number" inputmode="decimal">')}${field('Date', `<input id="d_d" type="date" value="${todayISO()}">`)}${field('Note', '<input id="d_note" placeholder="ex: filtres livrés">')}<div class="modal-actions"><button class="btn gray" id="cancel">Annuler</button><button class="btn" id="ok">Ajouter</button></div>`);
    $('#cancel', bg).onclick = () => bg.remove();
    $('#ok', bg).onclick = () => { const n = $('#d_n', bg).value.trim(); const a = +$('#d_a', bg).value; if (!n || !a) return; DB.debts.push({ id: uid(), name: n, amount: a, date: $('#d_d', bg).value, note: $('#d_note', bg).value.trim(), paid: false }); save(); bg.remove(); router(); };
  };
}
function catDetailModal(cat) {
  const m = monthOf(todayISO());
  const list = DB.transactions.filter(t => t.type === 'depense' && t.cat === cat && monthOf(t.date) === m && isOwn(t));
  const groups = {};
  list.forEach(t => { const k = t.note ? t.note : '(sans détail)'; groups[k] = (groups[k] || 0) + (+t.amount || 0); });
  const rows = Object.entries(groups).sort((a, b) => b[1] - a[1]);
  const total = list.reduce((a, t) => a + (+t.amount || 0), 0);
  const body = `
    <div class="hint">Astuce : écris le produit dans la <b>note</b> en ajoutant une dépense (ex : viande, lait, légumes). Ici tu vois où part l'argent et tu repères le gaspillage.</div>
    <div>${rows.length ? rows.map(([k, n]) => `<div class="item"><span class="ic">🧺</span><span class="grow"><div class="t">${escape(k)}</div></span><b class="amt neg">${fmtDH(n)}</b></div>`).join('') : '<div class="empty">Aucune dépense ce mois dans cette catégorie.</div>'}</div>
    <div class="row between" style="margin-top:10px;font-weight:800;font-size:1.05rem"><span>Total ${escape(cat)}</span><span style="color:var(--red)">${fmtDH(total)}</span></div>
    <div class="modal-actions"><button class="btn" id="ok">Fermer</button></div>`;
  const bg = modal('Détail — ' + cat, body);
  $('#ok', bg).onclick = () => bg.remove();
}
function recurRow(f, kind) {
  return `<div class="item"><span class="ic">${kind === 'incomes' ? '💵' : '🧾'}</span>
    <span class="grow"><div class="t">${escape(f.label)}</div><div class="s"><span class="chip ${f.account.toLowerCase()}">${f.account}</span></div></span>
    <b class="amt ${kind === 'incomes' ? 'pos' : 'neg'}">${fmtDH(f.amount)}</b>
    <button class="btn gray sm" data-edit-recur="${f.id}" data-kind="${kind}">✎</button></div>`;
}
function txRow(t) {
  return `<div class="item"><span class="ic">${t.type === 'revenu' ? '＋' : '－'}</span>
    <span class="grow"><div class="t">${escape(t.cat)}${t.note ? ' · ' + escape(t.note) : ''}</div>
    <div class="s">${t.date} · <span class="chip ${t.account.toLowerCase()}">${t.account}</span></div></span>
    <b class="amt ${t.type === 'revenu' ? 'pos' : 'neg'}">${t.type === 'revenu' ? '+' : '-'}${fmtDH(t.amount)}</b>
    <button class="btn gray sm" data-del-tx="${t.id}">✕</button></div>`;
}
function txModal() {
  let type = 'depense';
  const body = `
    <div class="seg" id="segType"><button data-t="depense" class="active">－ Dépense</button><button data-t="revenu">＋ Revenu</button></div>
    ${field('Montant (DH)', '<input id="f_amt" type="number" inputmode="decimal" placeholder="0" autofocus>')}
    ${field('Caisse', `<select id="f_acc">${options(OWN_ACCOUNTS, 'Moi')}</select>`)}
    ${field('Catégorie', `<select id="f_cat">${options(CATS.depense)}</select>`)}
    ${field('Date', `<input id="f_date" type="date" value="${todayISO()}">`)}
    ${field('Note (optionnel)', '<input id="f_note" placeholder="ex: courses Marjane">')}
    <div class="modal-actions"><button class="btn gray" id="cancel">Annuler</button><button class="btn" id="ok">Enregistrer</button></div>`;
  const bg = modal('Nouvelle opération', body);
  const setCats = () => { $('#f_cat', bg).innerHTML = options(CATS[type]); };
  bg.querySelectorAll('#segType button').forEach(b => b.onclick = () => {
    bg.querySelectorAll('#segType button').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); type = b.dataset.t; setCats();
  });
  $('#cancel', bg).onclick = () => bg.remove();
  $('#ok', bg).onclick = () => {
    const amount = +$('#f_amt', bg).value;
    if (!amount) { $('#f_amt', bg).focus(); return; }
    DB.transactions.push({ id: uid(), type, amount, account: $('#f_acc', bg).value, cat: $('#f_cat', bg).value, date: $('#f_date', bg).value, note: $('#f_note', bg).value.trim() });
    save(); bg.remove(); router();
  };
}
function recurModal(kind, id, accList) {
  accList = accList || OWN_ACCOUNTS;
  const list = DB[kind];
  const defAcc = kind === 'incomes' ? (accList.includes('Business') ? 'Business' : accList[0]) : accList[0];
  const cur = id ? list.find(x => x.id === id) : { label: '', amount: 0, account: defAcc, cat: '' };
  const catList = kind === 'incomes' ? CATS.revenu : CATS.depense;
  const accChoices = accList.includes(cur.account) ? accList : [cur.account, ...accList];
  const body = `
    ${field('Libellé', `<input id="r_lab" value="${escape(cur.label)}" placeholder="ex: Assurance voiture">`)}
    ${field('Montant / mois (DH)', `<input id="r_amt" type="number" inputmode="decimal" value="${cur.amount || ''}">`)}
    ${field('Caisse', `<select id="r_acc">${options(accChoices, cur.account)}</select>`)}
    ${field('Catégorie', `<select id="r_cat">${options(catList, cur.cat)}</select>`)}
    <div class="modal-actions">${id ? '<button class="btn danger" id="del">Supprimer</button>' : ''}<button class="btn" id="ok">Enregistrer</button></div>`;
  const bg = modal(kind === 'incomes' ? 'Revenu récurrent' : 'Charge fixe', body);
  $('#ok', bg).onclick = () => {
    const o = { label: $('#r_lab', bg).value.trim() || '(sans nom)', amount: +$('#r_amt', bg).value || 0, account: $('#r_acc', bg).value, cat: $('#r_cat', bg).value };
    if (id) Object.assign(cur, o); else list.push(Object.assign({ id: uid() }, o));
    save(); bg.remove(); router();
  };
  if (id) $('#del', bg).onclick = () => { DB[kind] = list.filter(x => x.id !== id); save(); bg.remove(); router(); };
}

/* ============================================================
   PLANNING
   ============================================================ */
function renderPlanning(v) {
  const today = todayISO();
  const days = [];
  for (let i = 0; i < 7; i++) { const d = new Date(); d.setDate(d.getDate() + i); days.push(d.toISOString().slice(0, 10)); }
  const fmtDay = (iso) => new Date(iso + 'T00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });
  const CATICON = { Famille: '👨‍👩‍👧', Business: '🚚', Perso: '🙂', Religion: '🕌', Maman: '💊' };

  v.append(el(`<div><h1>📅 Planning</h1>
    <div class="section-title">⏰ Échéances à venir</div>
    <div class="card" id="echeances"></div>
    <button class="btn ghost block sm" id="addEch" style="margin-bottom:8px">+ Ajouter une échéance</button>

    <div class="section-title">Tâches (7 jours)</div>
    <div class="hint">Organise enfants, maman et moments de foi. Touche une tâche pour la modifier.</div>
    <div id="days"></div>
    <button class="btn fab" id="fab">＋</button>
  </div>`));

  // Échéances
  bumpEcheances();
  const ec = $('#echeances', v);
  const ech = DB.echeances.slice().sort((a, b) => a.date.localeCompare(b.date));
  if (!ech.length) ec.append(el('<small>Aucune échéance. Ajoute assurance auto, vignette, CNSS…</small>'));
  ech.forEach(e => {
    const dleft = daysUntil(e.date);
    const cls = dleft < 0 ? 'red' : dleft <= 7 ? 'red' : dleft <= 30 ? '' : 'green';
    const label = dleft < 0 ? 'en retard' : dleft === 0 ? "aujourd'hui" : 'dans ' + dleft + ' j';
    const row = el(`<div class="item"><span class="ic">⏰</span>
      <span class="grow"><div class="t">${escape(e.label)}${e.recur && e.recur !== 'none' ? ' 🔁' : ''}</div><div class="s">${e.date}${e.note ? ' · ' + escape(e.note) : ''}</div></span>
      <span class="chip ${cls}">${label}</span><button class="btn gray sm" data-cal title="Ajouter à l'agenda">📅</button><button class="btn gray sm" data-x>✕</button></div>`);
    row.querySelector('.grow').style.cursor = 'pointer';
    row.querySelector('.grow').onclick = () => echeanceModal(e.id);
    $('[data-cal]', row).onclick = () => exportEcheanceICS(e);
    $('[data-x]', row).onclick = () => { DB.echeances = DB.echeances.filter(x => x.id !== e.id); save(); router(); };
    ec.append(row);
  });
  $('#addEch', v).onclick = () => echeanceModal();

  const c = $('#days', v);
  days.forEach(d => {
    const list = DB.tasks.filter(t => t.date === d).sort((a, b) => (a.done - b.done));
    const card = el(`<div class="card"><div class="row between"><h3 style="margin:0;text-transform:capitalize">${fmtDay(d)}${d === today ? ' · <span class="chip">aujourd\'hui</span>' : ''}</h3></div>
      <div class="list"></div></div>`);
    const lc = $('.list', card);
    if (!list.length) lc.append(el('<small>Rien de prévu.</small>'));
    list.forEach(t => {
      const it = el(`<div class="item"><span class="check ${t.done ? 'on' : ''}">${t.done ? '✓' : ''}</span>
        <span class="ic">${CATICON[t.cat] || '•'}</span>
        <span class="grow" data-edit style="cursor:pointer"><div class="t" style="${t.done ? 'text-decoration:line-through;color:#94a3b8' : ''}">${escape(t.title)}</div><div class="s">${escape(t.cat)} · ✎ modifier</div></span>
        <button class="btn gray sm" data-del="${t.id}">✕</button></div>`);
      $('.check', it).onclick = () => { t.done = !t.done; save(); router(); };
      $('[data-edit]', it).onclick = () => taskModal(t.date, t.id);
      $('[data-del]', it).onclick = () => { DB.tasks = DB.tasks.filter(x => x.id !== t.id); save(); router(); };
      lc.append(it);
    });
    c.append(card);
  });
  $('#fab', v).onclick = () => taskModal(today);
}
function taskModal(date, id) {
  const cats = ['Business', 'Famille', 'Maman', 'Perso', 'Religion'];
  const cur = id ? DB.tasks.find(t => t.id === id) : null;
  const body = `
    ${field('Tâche', `<input id="t_title" value="${cur ? escape(cur.title) : ''}" placeholder="ex: Tournée garages Sidi Kacem" autofocus>`)}
    ${field('Catégorie', `<select id="t_cat">${options(cats, cur ? cur.cat : 'Business')}</select>`)}
    ${field('Date', `<input id="t_date" type="date" value="${cur ? cur.date : date}">`)}
    <div class="modal-actions">${id ? '<button class="btn danger" id="del">Supprimer</button>' : '<button class="btn gray" id="cancel">Annuler</button>'}<button class="btn" id="ok">${id ? 'Enregistrer' : 'Ajouter'}</button></div>`;
  const bg = modal(id ? 'Modifier la tâche' : 'Nouvelle tâche', body);
  if ($('#cancel', bg)) $('#cancel', bg).onclick = () => bg.remove();
  if (id) $('#del', bg).onclick = () => { DB.tasks = DB.tasks.filter(x => x.id !== id); save(); bg.remove(); router(); };
  $('#ok', bg).onclick = () => {
    const title = $('#t_title', bg).value.trim(); if (!title) return;
    const o = { title, cat: $('#t_cat', bg).value, date: $('#t_date', bg).value };
    if (cur) Object.assign(cur, o); else DB.tasks.push(Object.assign({ id: uid(), done: false }, o));
    save(); bg.remove(); router();
  };
}
function daysUntil(iso) { const d = new Date(iso + 'T00:00'); const now = new Date(); now.setHours(0, 0, 0, 0); return Math.round((d - now) / 86400000); }
function bumpEcheances() {
  // fait avancer les échéances récurrentes passées vers la prochaine occurrence
  let changed = false;
  DB.echeances.forEach(e => {
    if (!e.recur || e.recur === 'none') return;
    let d = new Date(e.date + 'T00:00');
    const now = new Date(); now.setHours(0, 0, 0, 0);
    while (d < now) { if (e.recur === 'monthly') d.setMonth(d.getMonth() + 1); else d.setFullYear(d.getFullYear() + 1); changed = true; }
    e.date = d.toISOString().slice(0, 10);
  });
  if (changed) persist();
}
function echeanceModal(id) {
  const cur = id ? DB.echeances.find(e => e.id === id) : { label: '', date: todayISO(), note: '', recur: 'yearly' };
  const body = `
    ${field('Quoi ?', `<input id="e_l" value="${escape(cur.label)}" placeholder="ex: Assurance voiture" autofocus>`)}
    ${field('Date limite', `<input id="e_d" type="date" value="${cur.date}">`)}
    ${field('Répétition', `<select id="e_r">
      <option value="none" ${cur.recur === 'none' ? 'selected' : ''}>Aucune</option>
      <option value="monthly" ${cur.recur === 'monthly' ? 'selected' : ''}>Chaque mois</option>
      <option value="yearly" ${cur.recur === 'yearly' ? 'selected' : ''}>Chaque année</option>
    </select>`)}
    ${field('Note', `<input id="e_n" value="${escape(cur.note || '')}" placeholder="ex: agence, montant…">`)}
    <div class="modal-actions"><button class="btn gray" id="cancel">Annuler</button><button class="btn" id="ok">Enregistrer</button></div>`;
  const bg = modal(id ? 'Modifier l\'échéance' : 'Nouvelle échéance', body);
  $('#cancel', bg).onclick = () => bg.remove();
  $('#ok', bg).onclick = () => {
    const o = { label: $('#e_l', bg).value.trim() || '(sans nom)', date: $('#e_d', bg).value, recur: $('#e_r', bg).value, note: $('#e_n', bg).value.trim() };
    if (id) Object.assign(cur, o); else DB.echeances.push(Object.assign({ id: uid() }, o));
    save(); bg.remove(); router();
  };
}

/* ============================================================
   REPAS  (planning des repas par semaine + stock maison)
   ============================================================ */
let mealWeek = weekStartISO(new Date());
function weekStartISO(d) { const x = new Date(d); const off = (x.getDay() + 6) % 7; x.setDate(x.getDate() - off); x.setHours(0, 0, 0, 0); return x.toISOString().slice(0, 10); }
const MEAL_SLOTS = [['matin', '🌅 Petit-déjeuner'], ['midi', '☀️ Déjeuner'], ['soir', '🌙 Dîner']];
const STOCK_CATS = ['Viande', 'Poisson', 'Légumes', 'Fruits', 'Épicerie', 'Produits laitiers', 'Boissons', 'Autre'];
const STOCK_ICON = { 'Viande': '🥩', 'Poisson': '🐟', 'Légumes': '🥦', 'Fruits': '🍎', 'Épicerie': '🛒', 'Produits laitiers': '🥛', 'Boissons': '🧃', 'Autre': '📦' };
function renderRepas(v) {
  const start = new Date(mealWeek + 'T00:00');
  const days = [];
  for (let i = 0; i < 7; i++) { const d = new Date(start); d.setDate(start.getDate() + i); days.push(d.toISOString().slice(0, 10)); }
  const end = days[6];
  const fmtD = iso => new Date(iso + 'T00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });
  const fmtShort = iso => new Date(iso + 'T00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  v.append(el(`<div><h1>🍽️ Repas</h1>
    <div class="hint">Planifie les repas de la semaine <b>selon le stock</b> de la maison (affiché ci-dessous). Touche un aliment du stock pour l'ajouter à un repas.</div>

    <div class="card">
      <div class="row between"><h3 style="margin:0">🧺 Stock de la maison</h3><button class="btn ghost sm" id="addStock">+ Aliment</button></div>
      <div id="stockList" style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px"></div>
    </div>

    <div class="card">
      <div class="row between"><h3 style="margin:0">💡 Mes plats (idées)</h3><button class="btn ghost sm" id="addIdea">+ Plat</button></div>
      <div id="ideaList" style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px"></div>
    </div>

    <div class="card">
      <div class="row between">
        <button class="btn gray sm" id="wPrev">‹</button>
        <b>Semaine du ${fmtShort(mealWeek)} au ${fmtShort(end)}</b>
        <button class="btn gray sm" id="wNext">›</button>
      </div>
    </div>

    <div id="mealDays"></div>

    <div class="section-title">🛒 Liste de courses</div>
    <div class="card">
      <div class="row between"><h3 style="margin:0">À acheter</h3><button class="btn ghost sm" id="suggest">🔎 Ce qui manque</button></div>
      <div id="shopList" style="margin-top:6px"></div>
      <div class="row" style="gap:8px;margin-top:8px"><input id="shopInp" placeholder="Ajouter un article…"><button class="btn sm" id="shopAdd">+</button></div>
      ${DB.meals.shopping.some(s => s.done) ? '<button class="btn gray sm" id="shopClear" style="margin-top:8px">Retirer les articles cochés</button>' : ''}
    </div>
  </div>`));

  // Stock par catégorie
  const sc = $('#stockList', v);
  sc.style.display = 'block';
  if (!DB.meals.stock.length) sc.append(el('<small>Stock vide. Ajoute ce que tu as : poulet, légumes, poisson, huile d\'olive, café…</small>'));
  STOCK_CATS.forEach(cat => {
    const items = DB.meals.stock.filter(it => (it.cat || 'Autre') === cat);
    if (!items.length) return;
    const block = el(`<div style="margin-bottom:10px"><div style="font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:4px">${STOCK_ICON[cat] || ''} ${cat}</div><div class="chips" style="display:flex;flex-wrap:wrap;gap:6px"></div></div>`);
    const cw = $('.chips', block);
    items.forEach(it => {
      const chip = el(`<span class="chip" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;padding:6px 10px">${escape(it.name)}<b data-rm style="color:var(--red)">✕</b></span>`);
      chip.onclick = (e) => { if (e.target.hasAttribute('data-rm')) return; pickMealForStock(it.name, days); };
      chip.querySelector('[data-rm]').onclick = (e) => { e.stopPropagation(); DB.meals.stock = DB.meals.stock.filter(x => x.id !== it.id); save(); router(); };
      cw.append(chip);
    });
    sc.append(block);
  });
  $('#addStock', v).onclick = () => {
    const bg = modal('Ajouter au stock', `${field('Aliment', '<input id="st_n" placeholder="ex: poulet, tomates, lait…" autofocus>')}${field('Catégorie', `<select id="st_c">${options(STOCK_CATS, 'Légumes')}</select>`)}<div class="modal-actions"><button class="btn" id="ok">Ajouter</button></div>`);
    $('#ok', bg).onclick = () => { const n = $('#st_n', bg).value.trim(); if (!n) return; DB.meals.stock.push({ id: uid(), name: n, cat: $('#st_c', bg).value }); save(); bg.remove(); router(); };
  };

  // Idées de repas
  const il = $('#ideaList', v);
  const SLOT_LBL = { matin: '🌅', midi: '☀️', soir: '🌙', all: '🍽️' };
  if (!DB.meals.ideas.length) il.append(el('<small>Enregistre tes plats habituels pour les réutiliser en 1 clic.</small>'));
  DB.meals.ideas.forEach(it => {
    const chip = el(`<span class="chip green" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;padding:6px 10px">${SLOT_LBL[it.slot] || '🍽️'} ${escape(it.name)}<b data-rm style="color:var(--red)">✕</b></span>`);
    chip.onclick = (e) => { if (e.target.hasAttribute('data-rm')) return; pickMealForStock(it.name, days, it.slot && it.slot !== 'all' ? it.slot : null); };
    chip.querySelector('[data-rm]').onclick = (e) => { e.stopPropagation(); DB.meals.ideas = DB.meals.ideas.filter(x => x.id !== it.id); save(); router(); };
    il.append(chip);
  });
  $('#addIdea', v).onclick = () => {
    const bg = modal('Nouveau plat', `${field('Nom du plat', '<input id="id_n" placeholder="ex: tajine poulet, harira…" autofocus>')}${field('Pour quel repas ?', `<select id="id_s"><option value="all">🍽️ Tout</option><option value="matin">🌅 Petit-déjeuner</option><option value="midi">☀️ Déjeuner</option><option value="soir">🌙 Dîner</option></select>`)}<div class="modal-actions"><button class="btn" id="ok">Enregistrer</button></div>`);
    $('#ok', bg).onclick = () => { const n = $('#id_n', bg).value.trim(); if (!n) return; DB.meals.ideas.push({ id: uid(), name: n, slot: $('#id_s', bg).value }); save(); bg.remove(); router(); };
  };

  // Week nav
  $('#wPrev', v).onclick = () => { const d = new Date(mealWeek + 'T00:00'); d.setDate(d.getDate() - 7); mealWeek = d.toISOString().slice(0, 10); router(); };
  $('#wNext', v).onclick = () => { const d = new Date(mealWeek + 'T00:00'); d.setDate(d.getDate() + 7); mealWeek = d.toISOString().slice(0, 10); router(); };

  // Liste de courses
  const shl = $('#shopList', v);
  const shop = DB.meals.shopping.slice().sort((a, b) => (a.done - b.done));
  if (!shop.length) shl.append(el('<small>Liste vide. Ajoute des articles ou touche « Ce qui manque ».</small>'));
  shop.forEach(it => {
    const row = el(`<div class="item"><span class="check ${it.done ? 'on' : ''}">${it.done ? '✓' : ''}</span><span class="grow"><div class="t" style="${it.done ? 'text-decoration:line-through;color:#94a3b8' : ''}">${escape(it.name)}</div></span><button class="btn gray sm" data-x>✕</button></div>`);
    $('.check', row).onclick = () => { it.done = !it.done; save(); router(); };
    $('[data-x]', row).onclick = () => { DB.meals.shopping = DB.meals.shopping.filter(x => x.id !== it.id); save(); router(); };
    shl.append(row);
  });
  const addShop = () => { const n = $('#shopInp', v).value.trim(); if (!n) return; DB.meals.shopping.push({ id: uid(), name: n, done: false }); save(); router(); };
  $('#shopAdd', v).onclick = addShop;
  $('#shopInp', v).addEventListener('keydown', e => { if (e.key === 'Enter') addShop(); });
  $('#suggest', v).onclick = () => suggestModal(days);
  if ($('#shopClear', v)) $('#shopClear', v).onclick = () => { DB.meals.shopping = DB.meals.shopping.filter(s => !s.done); save(); router(); };

  // Days
  const md = $('#mealDays', v);
  const todayI = todayISO();
  days.forEach(d => {
    const plan = DB.meals.plan[d] || {};
    const card = el(`<div class="card"><h3 style="text-transform:capitalize;margin-bottom:8px">${fmtD(d)}${d === todayI ? ' · <span class="chip">aujourd\'hui</span>' : ''}</h3>
      ${MEAL_SLOTS.map(([k, lab]) => `<label class="field" style="margin-bottom:8px">${lab}<input data-meal="${d}" data-slot="${k}" value="${escape(plan[k] || '')}" placeholder="…"></label>`).join('')}
    </div>`);
    card.querySelectorAll('[data-meal]').forEach(inp => inp.onchange = () => {
      const day = inp.dataset.meal, slot = inp.dataset.slot;
      DB.meals.plan[day] = DB.meals.plan[day] || {};
      DB.meals.plan[day][slot] = inp.value.trim();
      save();
    });
    md.append(card);
  });
}
function pickMealForStock(name, days, defaultSlot) {
  const todayI = todayISO();
  const defaultDay = days.includes(todayI) ? todayI : days[0];
  const body = `
    <p><small>Ajouter « <b>${escape(name)}</b> » à quel repas ?</small></p>
    ${field('Jour', `<select id="pm_d">${days.map(d => `<option value="${d}" ${d === defaultDay ? 'selected' : ''}>${new Date(d + 'T00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })}</option>`).join('')}</select>`)}
    ${field('Repas', `<select id="pm_s">${MEAL_SLOTS.map(([k, lab]) => `<option value="${k}" ${k === defaultSlot ? 'selected' : ''}>${lab}</option>`).join('')}</select>`)}
    <div class="modal-actions"><button class="btn gray" id="cancel">Annuler</button><button class="btn" id="ok">Ajouter</button></div>`;
  const bg = modal('Ajouter au repas', body);
  $('#cancel', bg).onclick = () => bg.remove();
  $('#ok', bg).onclick = () => {
    const d = $('#pm_d', bg).value, s = $('#pm_s', bg).value;
    DB.meals.plan[d] = DB.meals.plan[d] || {};
    DB.meals.plan[d][s] = (DB.meals.plan[d][s] ? DB.meals.plan[d][s] + ' + ' : '') + name;
    save(); bg.remove(); router();
  };
}
function suggestMissing(days) {
  const stop = new Set(['avec', 'sans', 'des', 'les', 'pour', 'plus', 'une', 'aux', 'sur', 'dans', 'sauce', 'petit', 'fait', 'maison']);
  const stockN = DB.meals.stock.map(s => s.name.toLowerCase());
  const shopN = DB.meals.shopping.map(s => s.name.toLowerCase());
  const seen = new Set(), out = [];
  days.forEach(d => { const p = DB.meals.plan[d] || {}; ['matin', 'midi', 'soir'].forEach(k => {
    (p[k] || '').toLowerCase().split(/[^a-zàâäéèêëïîôöùûüç]+/).forEach(w => {
      if (w.length < 3 || stop.has(w) || seen.has(w)) return;
      const has = arr => arr.some(s => s.includes(w) || w.includes(s));
      if (!has(stockN) && !has(shopN)) { seen.add(w); out.push(w); }
    });
  }); });
  return out;
}
function suggestModal(days) {
  const sug = suggestMissing(days);
  if (!sug.length) { alert('Rien à acheter : tes repas de la semaine utilisent ce que tu as en stock 👍'); return; }
  const body = `<p><small>Mots de tes repas de la semaine absents du stock. Touche pour ajouter à la liste de courses.</small></p>
    <div style="display:flex;flex-wrap:wrap;gap:6px">${sug.map(w => `<span class="chip" data-w="${escape(w)}" style="cursor:pointer;padding:7px 11px">+ ${escape(w)}</span>`).join('')}</div>
    <div class="modal-actions"><button class="btn gray" id="all">Tout ajouter</button><button class="btn" id="ok">Fermer</button></div>`;
  const bg = modal('🔎 Ce qui manque', body);
  const add = w => { if (!DB.meals.shopping.some(s => s.name.toLowerCase() === w.toLowerCase())) DB.meals.shopping.push({ id: uid(), name: w, done: false }); };
  bg.querySelectorAll('[data-w]').forEach(c => c.onclick = () => { add(c.dataset.w); save(); c.style.display = 'none'; });
  $('#all', bg).onclick = () => { sug.forEach(add); save(); bg.remove(); router(); };
  $('#ok', bg).onclick = () => { bg.remove(); router(); };
}

/* ============================================================
   FAMILLE  (enfants)
   ============================================================ */
function renderFamille(v) {
  v.append(el(`<div><h1>👨‍👩‍👧 Famille</h1>
    <div class="hint">Enfants : sorties, devoirs, activités. (Maman a son propre espace 👵 dans la barre du bas.)</div>
    <div id="kids"></div>
    <button class="btn ghost block sm" id="addKid" style="margin-bottom:8px">+ Ajouter un enfant</button>
  </div>`));

  // Kids
  const kc = $('#kids', v);
  DB.kids.forEach(k => {
    const card = el(`<div class="card">
      <div class="row between"><input value="${escape(k.name)}" data-kid-name style="font-weight:700;border:none;padding:4px 0;font-size:1rem">
      <button class="btn gray sm" data-del-kid>✕</button></div>
      <div class="list"></div>
      <div class="row" style="gap:8px;margin-top:8px"><input data-kid-item placeholder="Sortie, devoir, activité..."><button class="btn sm" data-add-item>+</button></div>
    </div>`);
    $('[data-kid-name]', card).onchange = e => { k.name = e.target.value; save(); };
    $('[data-del-kid]', card).onclick = () => { if (confirm('Supprimer ' + k.name + ' ?')) { DB.kids = DB.kids.filter(x => x.id !== k.id); save(); router(); } };
    const lc = $('.list', card);
    (k.items || []).forEach(it => {
      const row = el(`<div class="item"><span class="check ${it.done ? 'on' : ''}">${it.done ? '✓' : ''}</span><span class="grow"><div class="t" style="${it.done ? 'text-decoration:line-through;color:#94a3b8' : ''}">${escape(it.text)}</div></span><button class="btn gray sm" data-x>✕</button></div>`);
      $('.check', row).onclick = () => { it.done = !it.done; save(); router(); };
      $('[data-x]', row).onclick = () => { k.items = k.items.filter(x => x !== it); save(); router(); };
      lc.append(row);
    });
    const add = () => { const inp = $('[data-kid-item]', card); const t = inp.value.trim(); if (!t) return; k.items = k.items || []; k.items.push({ text: t, done: false }); save(); router(); };
    $('[data-add-item]', card).onclick = add;
    $('[data-kid-item]', card).addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
    kc.append(card);
  });
  $('#addKid', v).onclick = () => { DB.kids.push({ id: uid(), name: 'Nouvel enfant', notes: '', items: [] }); save(); router(); };
}

/* ============================================================
   MAMAN  (carnet de caisse : rentrées / sorties + médic. + CNSS)
   ============================================================ */
const MAMAN_CATS = { revenu: ['Loyer garage', 'Aide', 'Autre'], depense: ['Médicaments', 'Santé', 'Dons', 'Autre'] };
function renderMaman(v) {
  const m = monthOf(todayISO());
  const all = DB.transactions.filter(t => t.account === 'Maman').sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const ins = all.filter(t => t.type === 'revenu').reduce((a, t) => a + (+t.amount || 0), 0);
  const outs = all.filter(t => t.type === 'depense').reduce((a, t) => a + (+t.amount || 0), 0);
  const opening = +DB.mother.opening || 0;
  const solde = opening + ins - outs;
  const mt = all.filter(t => monthOf(t.date) === m);
  const mIn = mt.filter(t => t.type === 'revenu').reduce((a, t) => a + (+t.amount || 0), 0);
  const mOut = mt.filter(t => t.type === 'depense').reduce((a, t) => a + (+t.amount || 0), 0);
  const mInc = DB.incomes.filter(t => t.account === 'Maman');
  const mFix = DB.fixed.filter(t => t.account === 'Maman');
  const mIncSum = mInc.reduce((a, f) => a + (+f.amount || 0), 0);
  const mFixSum = mFix.reduce((a, f) => a + (+f.amount || 0), 0);

  v.append(el(`<div><h1>👵 Maman</h1>
    <div class="hint">Le carnet de la caisse de maman : chaque montant qui <b>rentre</b> (loyer garage…) et qui <b>sort</b> (médicaments, dons…). Le solde reste toujours visible.</div>
    <div class="card">
      <div class="row between"><span style="color:var(--muted);font-size:.72rem;text-transform:uppercase;letter-spacing:.4px;font-weight:700">Solde de la caisse</span>
        <button class="btn gray sm" id="editOpen">Solde de départ</button></div>
      <div class="value ${solde >= 0 ? 'pos' : 'neg'}" style="font-size:1.9rem;font-weight:800;margin-top:4px">${fmtDH(solde)}</div>
    </div>
    <div class="grid2">
      <div class="stat"><div class="label">Entré ce mois</div><div class="value pos">${fmtDH(mIn)}</div></div>
      <div class="stat"><div class="label">Sorti ce mois</div><div class="value neg">${fmtDH(mOut)}</div></div>
    </div>

    <div class="section-title">Revenus & charges récurrents (par mois)</div>
    <div class="card">
      <div class="row between"><span><b>Revenus</b> (ex: loyer garage)</span><b class="amt pos">${fmtDH(mIncSum)}</b></div>
      ${mInc.map(f => recurRow(f, 'incomes')).join('') || '<small>Aucun</small>'}
      <div class="divider"></div>
      <div class="row between"><span><b>Charges</b> (ex: médicaments)</span><b class="amt neg">${fmtDH(mFixSum)}</b></div>
      ${mFix.map(f => recurRow(f, 'fixed')).join('') || '<small>Aucune</small>'}
      <div class="row" style="gap:8px;margin-top:10px">
        <button class="btn ghost sm" id="mAddInc">+ Revenu</button>
        <button class="btn ghost sm" id="mAddFix">+ Charge</button>
      </div>
    </div>

    <div class="section-title">Carnet — rentrées & sorties</div>
    <div class="card" id="ledger">
      ${all.length ? all.map(txRow).join('') : '<div class="empty">Aucun mouvement. Touche ＋ en bas pour ajouter une rentrée ou une sortie.</div>'}
    </div>

    <div class="section-title">💊 Médicaments (posologie)</div>
    <div class="card">
      <div class="row between"><h3 style="margin:0">Liste</h3><button class="btn ghost sm" id="addMed">+ Médicament</button></div>
      <div id="meds"></div>
      <button class="btn block ghost sm" id="medICS" style="margin-top:8px">📅 Alarmes médicaments dans l'agenda</button>
    </div>

    <div class="section-title">📄 Dossier CNSS</div>
    <div class="card">
      <div id="cnss"></div>
      <button class="btn ghost sm" id="addCnss" style="margin-top:8px">+ Étape</button>
    </div>

    <div class="card">
      <h3>📝 Notes</h3>
      <textarea id="mNotes" placeholder="ex: garage loué, pharmacie habituelle, médecin…">${escape(DB.mother.notes)}</textarea>
      <button class="btn sm" id="saveNotes" style="margin-top:8px">Enregistrer</button>
    </div>
    <button class="btn fab" id="fab">＋</button>
  </div>`));

  $('#fab', v).onclick = () => mamanOpModal();
  $('#editOpen', v).onclick = () => {
    const bg = modal('Solde de départ', `<p><small>Argent déjà présent dans la caisse de maman avant de commencer le suivi.</small></p>${field('Montant (DH)', `<input id="o_v" type="number" inputmode="decimal" value="${opening || ''}">`)}<div class="modal-actions"><button class="btn" id="ok">Enregistrer</button></div>`);
    $('#ok', bg).onclick = () => { DB.mother.opening = +$('#o_v', bg).value || 0; save(); bg.remove(); router(); };
  };
  v.querySelectorAll('[data-del-tx]').forEach(b => b.onclick = () => { DB.transactions = DB.transactions.filter(t => t.id !== b.dataset.delTx); save(); router(); });
  $('#mAddInc', v).onclick = () => recurModal('incomes', null, ['Maman']);
  $('#mAddFix', v).onclick = () => recurModal('fixed', null, ['Maman']);
  v.querySelectorAll('[data-edit-recur]').forEach(b => b.onclick = () => recurModal(b.dataset.kind, b.dataset.editRecur, ['Maman']));

  // Médicaments
  const mc = $('#meds', v);
  if (!DB.mother.meds.length) mc.append(el('<small>Aucun médicament enregistré.</small>'));
  DB.mother.meds.forEach(med => {
    const times = (med.times || []).join(' · ');
    const row = el(`<div class="item"><span class="ic">💊</span><span class="grow"><div class="t">${escape(med.name)}</div><div class="s">${escape(med.schedule || '')}${times ? ' · ⏰ ' + escape(times) : ''}</div></span><button class="btn gray sm" data-x>✕</button></div>`);
    $('[data-x]', row).onclick = () => { DB.mother.meds = DB.mother.meds.filter(x => x !== med); save(); router(); };
    mc.append(row);
  });
  $('#medICS', v).onclick = () => exportMedICS();
  $('#addMed', v).onclick = () => {
    const bg = modal('Médicament', `${field('Nom', '<input id="m_n" autofocus>')}${field('Posologie', '<input id="m_s" placeholder="ex: 1 comprimé">')}${field('Heures de prise (ex: 08:00, 14:00, 20:00)', '<input id="m_h" placeholder="08:00, 20:00">')}<div class="modal-actions"><button class="btn" id="ok">Ajouter</button></div>`);
    $('#ok', bg).onclick = () => {
      const n = $('#m_n', bg).value.trim(); if (!n) return;
      const times = $('#m_h', bg).value.split(',').map(s => s.trim()).filter(s => /^\d{1,2}:\d{2}$/.test(s));
      DB.mother.meds.push({ name: n, schedule: $('#m_s', bg).value.trim(), times });
      save(); bg.remove(); scheduleMedReminder(); router();
    };
  };

  // CNSS
  const cc = $('#cnss', v);
  DB.mother.cnss.forEach(s => {
    const row = el(`<div class="item"><span class="check ${s.done ? 'on' : ''}">${s.done ? '✓' : ''}</span><span class="grow"><div class="t" style="${s.done ? 'text-decoration:line-through;color:#94a3b8' : ''}">${escape(s.label)}</div></span><button class="btn gray sm" data-x>✕</button></div>`);
    $('.check', row).onclick = () => { s.done = !s.done; save(); router(); };
    $('[data-x]', row).onclick = () => { DB.mother.cnss = DB.mother.cnss.filter(x => x !== s); save(); router(); };
    cc.append(row);
  });
  $('#addCnss', v).onclick = () => { const t = prompt('Nouvelle étape du dossier :'); if (t) { DB.mother.cnss.push({ id: uid(), label: t, done: false }); save(); router(); } };
  $('#saveNotes', v).onclick = () => { DB.mother.notes = $('#mNotes', v).value; save(); $('#saveNotes', v).textContent = 'Enregistré ✓'; };
}
function mamanOpModal() {
  let type = 'depense';
  const body = `
    <div class="seg" id="segType"><button data-t="depense" class="active">－ Sortie</button><button data-t="revenu">＋ Rentrée</button></div>
    ${field('Montant (DH)', '<input id="f_amt" type="number" inputmode="decimal" placeholder="0" autofocus>')}
    ${field('Motif', `<select id="f_cat">${options(MAMAN_CATS.depense)}</select>`)}
    ${field('Date', `<input id="f_date" type="date" value="${todayISO()}">`)}
    ${field('Note (optionnel)', '<input id="f_note" placeholder="ex: pharmacie, garage…">')}
    <div class="modal-actions"><button class="btn gray" id="cancel">Annuler</button><button class="btn" id="ok">Enregistrer</button></div>`;
  const bg = modal('Mouvement — caisse maman', body);
  bg.querySelectorAll('#segType button').forEach(b => b.onclick = () => {
    bg.querySelectorAll('#segType button').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); type = b.dataset.t; $('#f_cat', bg).innerHTML = options(MAMAN_CATS[type]);
  });
  $('#cancel', bg).onclick = () => bg.remove();
  $('#ok', bg).onclick = () => {
    const amount = +$('#f_amt', bg).value;
    if (!amount) { $('#f_amt', bg).focus(); return; }
    DB.transactions.push({ id: uid(), type, amount, account: 'Maman', cat: $('#f_cat', bg).value, date: $('#f_date', bg).value, note: $('#f_note', bg).value.trim() });
    save(); bg.remove(); router();
  };
}

/* ============================================================
   FERME  (dépenses agricoles, 2 caisses : perso / moi & grand-mère)
   ============================================================ */
const FARM_CAISSES = { perso: 'Personnelle (moi)', partage: 'Oliviers — Moi & GM' };
const FARM_CATS = {
  depense: ['Semences', 'Irrigation / Eau', 'Engrais', 'Main d’œuvre', 'Moutons / Animaux', 'Gardiennage', 'Transport', 'Outils', 'Oliviers', 'Autre'],
  revenu: ['Vente olives', 'Vente moutons', 'Vente récolte', 'Autre'],
};
let farmFilter = 'all';
let farmYear = new Date().getFullYear();
function farmAnnual(caisse, year) {
  const list = DB.farm.tx.filter(t => t.caisse === caisse && (t.date || '').slice(0, 4) === String(year));
  const dep = list.filter(t => t.type === 'depense');
  const rev = list.filter(t => t.type === 'revenu');
  const depSum = dep.reduce((a, t) => a + (+t.amount || 0), 0);
  const revSum = rev.reduce((a, t) => a + (+t.amount || 0), 0);
  return { dep, rev, depSum, revSum, benefice: revSum - depSum };
}
function datedExpenseRows(list) {
  return list.slice().sort((a, b) => a.date.localeCompare(b.date))
    .map(t => `<div class="item"><span class="ic">📅</span><span class="grow"><div class="t">${escape(t.cat)}${t.note ? ' · ' + escape(t.note) : ''}</div><div class="s">${t.date}</div></span><b class="amt neg">${fmtDH(t.amount)}</b></div>`).join('');
}
function caisseSums(c) {
  const open = +DB.farm.opening[c] || 0;
  const list = DB.farm.tx.filter(t => t.caisse === c);
  const ins = list.filter(t => t.type === 'revenu').reduce((a, t) => a + (+t.amount || 0), 0);
  const outs = list.filter(t => t.type === 'depense').reduce((a, t) => a + (+t.amount || 0), 0);
  return { solde: open + ins - outs, outs, ins, open };
}
function treeSplit(amount) {
  const me = +DB.farm.trees.me || 0, gm = +DB.farm.trees.gm || 0, tot = (me + gm) || 1;
  return { me: amount * me / tot, gm: amount * gm / tot, meN: me, gmN: gm, tot: me + gm };
}
function sheepStats() {
  const log = DB.farm.sheep.log;
  const plus = ['achat', 'naissance'], moins = ['vente', 'perte'];
  const heads = log.reduce((a, e) => a + (plus.includes(e.type) ? +e.heads || 0 : moins.includes(e.type) ? -(+e.heads || 0) : 0), 0);
  const achats = log.filter(e => e.type === 'achat').reduce((a, e) => a + (+e.amount || 0), 0);
  const ventes = log.filter(e => e.type === 'vente').reduce((a, e) => a + (+e.amount || 0), 0);
  return { heads, achats, ventes, benefice: ventes - achats };
}
function mamanSolde() {
  const all = DB.transactions.filter(t => t.account === 'Maman');
  const ins = all.filter(t => t.type === 'revenu').reduce((a, t) => a + (+t.amount || 0), 0);
  const outs = all.filter(t => t.type === 'depense').reduce((a, t) => a + (+t.amount || 0), 0);
  return (+DB.mother.opening || 0) + ins - outs;
}
function farmRow(t) {
  return `<div class="item"><span class="ic">${t.type === 'revenu' ? '＋' : '－'}</span>
    <span class="grow"><div class="t">${escape(t.cat)}${t.note ? ' · ' + escape(t.note) : ''}</div>
    <div class="s">${t.date} · <span class="chip ${t.caisse === 'perso' ? 'moi' : 'maman'}">${FARM_CAISSES[t.caisse]}</span></div></span>
    <b class="amt ${t.type === 'revenu' ? 'pos' : 'neg'}">${t.type === 'revenu' ? '+' : '-'}${fmtDH(t.amount)}</b>
    <button class="btn gray sm" data-del-farm="${t.id}">✕</button></div>`;
}
function renderFerme(v) {
  const sP = caisseSums('perso'), sG = caisseSums('partage');
  const tsp = treeSplit(sG.outs), ss = sheepStats();
  const aP = farmAnnual('perso', farmYear), aG = farmAnnual('partage', farmYear);
  const aGsplit = treeSplit(aG.benefice);
  const oliveDep = DB.farm.tx.filter(t => t.caisse === 'partage' && t.type === 'depense').sort((a, b) => b.date.localeCompare(a.date));
  const m = monthOf(todayISO());
  const monthOut = DB.farm.tx.filter(t => t.type === 'depense' && monthOf(t.date) === m).reduce((a, t) => a + (+t.amount || 0), 0);
  let list = DB.farm.tx.slice().sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  if (farmFilter !== 'all') list = list.filter(t => t.caisse === farmFilter);

  v.append(el(`<div><h1>🚜 Ferme</h1>
    <div class="hint">2 caisses : la caisse <b>partagée = uniquement les oliviers</b> (répartis avec grand-mère au prorata des arbres). <b>Tout le reste</b> (moutons, frais divers) = caisse <b>personnelle</b>.</div>

    <div class="grid2">
      <div class="card" style="margin:0">
        <div class="row between"><span style="font-size:.72rem;color:var(--muted);text-transform:uppercase;font-weight:700">Personnelle</span><button class="btn gray sm" data-open="perso">solde départ</button></div>
        <div class="value ${sP.solde >= 0 ? 'teal' : 'neg'}" style="font-size:1.4rem;font-weight:800;margin-top:4px">${fmtDH(sP.solde)}</div>
      </div>
      <div class="card" style="margin:0">
        <div class="row between"><span style="font-size:.72rem;color:var(--muted);text-transform:uppercase;font-weight:700">Moi & Grand-mère</span><button class="btn gray sm" data-open="partage">solde départ</button></div>
        <div class="value ${sG.solde >= 0 ? 'teal' : 'neg'}" style="font-size:1.4rem;font-weight:800;margin-top:4px">${fmtDH(sG.solde)}</div>
      </div>
    </div>
    <div class="stat" style="margin-top:12px"><div class="label">Total dépensé ce mois (ferme)</div><div class="value neg">${fmtDH(monthOut)}</div></div>

    <div class="section-title">🫒 Oliviers — répartition par arbres</div>
    <div class="card">
      <div class="row between"><span>Total dépensé oliviers (partagé)</span><b>${fmtDH(sG.outs)}</b></div>
      <button class="btn ghost sm" id="editTrees" style="margin:8px 0">🌳 ${tsp.tot} arbres — modifier</button>
      <div class="divider"></div>
      <div class="row between"><span>🧍 Ma part <small>(${tsp.meN}/${tsp.tot})</small></span><b class="amt neg">${fmtDH(tsp.me)}</b></div>
      <div class="bar"><span style="width:${tsp.tot ? tsp.meN / tsp.tot * 100 : 0}%"></span></div>
      <div class="row between" style="margin-top:10px"><span>👵 Part grand-mère <small>(${tsp.gmN}/${tsp.tot})</small></span><b class="amt neg">${fmtDH(tsp.gm)}</b></div>
      <div class="bar"><span style="width:${tsp.tot ? tsp.gmN / tsp.tot * 100 : 0}%"></span></div>
      <button class="btn block ghost sm" id="addOlive" style="margin-top:12px">➕ Décrire une dépense oliviers</button>
      ${oliveDep.length ? `<div style="margin-top:8px"><small>Dépenses oliviers décrites :</small>${oliveDep.map(t => `<div class="item"><span class="ic">🫒</span><span class="grow"><div class="t">${escape(t.cat)}${t.note ? ' · ' + escape(t.note) : ''}</div><div class="s">${t.date}</div></span><b class="amt neg">${fmtDH(t.amount)}</b><button class="btn gray sm" data-del-farm="${t.id}">✕</button></div>`).join('')}</div>` : ''}
    </div>

    <div class="section-title">🐑 Moutons</div>
    <div class="card">
      <div class="row between"><h3 style="margin:0">Suivi du troupeau</h3><button class="btn ghost sm" id="addSheep">+ Mouvement</button></div>
      <div class="grid3" style="margin-top:10px">
        <div class="stat"><div class="label">Têtes</div><div class="value teal">${ss.heads}</div></div>
        <div class="stat"><div class="label">Investi</div><div class="value neg">${fmtDH(ss.achats)}</div></div>
        <div class="stat"><div class="label">Bénéfice</div><div class="value ${ss.benefice >= 0 ? 'pos' : 'neg'}">${fmtDH(ss.benefice)}</div></div>
      </div>
      <div id="sheepLog" style="margin-top:8px"></div>
    </div>

    <div class="section-title">📅 Bilan annuel</div>
    <div class="card">
      <div class="row between" style="margin-bottom:6px">
        <button class="btn gray sm" id="yPrev">‹</button>
        <b>Année ${farmYear}</b>
        <button class="btn gray sm" id="yNext">›</button>
      </div>

      <h3 style="margin:12px 0 6px">💼 Personnelle</h3>
      <div class="row between"><span>Dépenses de l'année</span><b class="amt neg">${fmtDH(aP.depSum)}</b></div>
      <div class="row between"><span>Revenus de l'année</span><b class="amt pos">${fmtDH(aP.revSum)}</b></div>
      <div class="row between"><span><b>Bénéfice</b></span><b class="amt ${aP.benefice >= 0 ? 'pos' : 'neg'}">${fmtDH(aP.benefice)}</b></div>
      ${aP.dep.length ? `<div style="margin-top:8px"><small>Détail des dépenses (date & montant)</small>${datedExpenseRows(aP.dep)}</div>` : '<small>Aucune dépense personnelle cette année.</small>'}

      <div class="divider"></div>
      <h3 style="margin:6px 0">🫒 Oliviers — Moi & Grand-mère</h3>
      <div class="row between"><span>Dépenses de l'année</span><b class="amt neg">${fmtDH(aG.depSum)}</b></div>
      <div class="row between"><span>Revenus (ventes olives)</span><b class="amt pos">${fmtDH(aG.revSum)}</b></div>
      <div class="row between"><span><b>Bénéfice récolte ${farmYear}</b></span><b class="amt ${aG.benefice >= 0 ? 'pos' : 'neg'}">${fmtDH(aG.benefice)}</b></div>
      <div class="divider"></div>
      <small>Répartition au prorata des arbres (${tsp.tot})</small>
      <div class="row between" style="margin-top:4px"><span>🧍 Ma part (${tsp.meN}/${tsp.tot})</span><b>${fmtDH(aGsplit.me)}</b></div>
      <div class="row between"><span>👵 Part grand-mère (${tsp.gmN}/${tsp.tot})</span><b>${fmtDH(aGsplit.gm)}</b></div>
      ${aG.dep.length ? `<div style="margin-top:8px"><small>Détail des dépenses oliviers (date & montant)</small>${datedExpenseRows(aG.dep)}</div>` : '<small>Aucune dépense oliviers cette année.</small>'}
    </div>

    <div class="section-title">🫒 Récolte d'olives</div>
    <div class="card">
      <div class="row between"><h3 style="margin:0">Saisons</h3><button class="btn ghost sm" id="addHarvest">+ Récolte</button></div>
      <div id="harvestList" style="margin-top:6px"></div>
    </div>

    <div class="section-title">📌 Agenda agricole</div>
    <div class="card">
      <div class="row between"><h3 style="margin:0">Travaux à faire</h3><button class="btn ghost sm" id="addAgenda">+ Tâche</button></div>
      <div id="agendaList" style="margin-top:6px"></div>
    </div>

    <div class="section-title">Mouvements</div>
    <div class="seg" id="farmFilter" style="margin-bottom:10px">
      <button data-f="all" class="${farmFilter === 'all' ? 'active' : ''}">Tout</button>
      <button data-f="perso" class="${farmFilter === 'perso' ? 'active' : ''}">Perso</button>
      <button data-f="partage" class="${farmFilter === 'partage' ? 'active' : ''}">Moi & GM</button>
    </div>
    <div class="card" id="farmLedger">
      ${list.length ? list.map(farmRow).join('') : '<div class="empty">Aucun mouvement. Touche ＋ pour ajouter une dépense ou une rentrée.</div>'}
    </div>
    <button class="btn fab" id="fab">＋</button>
  </div>`));

  $('#fab', v).onclick = () => farmOpModal();
  $('#addOlive', v).onclick = () => farmOpModal('partage');
  $('#yPrev', v).onclick = () => { farmYear--; router(); };
  $('#yNext', v).onclick = () => { farmYear++; router(); };
  v.querySelectorAll('#farmFilter button').forEach(b => b.onclick = () => { farmFilter = b.dataset.f; router(); });
  v.querySelectorAll('[data-del-farm]').forEach(b => b.onclick = () => { DB.farm.tx = DB.farm.tx.filter(t => t.id !== b.dataset.delFarm); save(); router(); });
  v.querySelectorAll('[data-open]').forEach(b => b.onclick = () => {
    const c = b.dataset.open;
    const bg = modal('Solde de départ — ' + FARM_CAISSES[c], `<p><small>Argent déjà présent dans cette caisse avant le suivi.</small></p>${field('Montant (DH)', `<input id="o_v" type="number" inputmode="decimal" value="${DB.farm.opening[c] || ''}">`)}<div class="modal-actions"><button class="btn" id="ok">Enregistrer</button></div>`);
    $('#ok', bg).onclick = () => { DB.farm.opening[c] = +$('#o_v', bg).value || 0; save(); bg.remove(); router(); };
  });

  // Récolte d'olives
  const hl = $('#harvestList', v);
  const harv = DB.farm.harvest.slice().sort((a, b) => (b.year || 0) - (a.year || 0));
  if (!harv.length) hl.append(el('<small>Note chaque saison : kg récoltés, litres d\'huile, prix de vente.</small>'));
  harv.forEach(h => {
    const row = el(`<div class="item"><span class="ic">🫒</span><span class="grow"><div class="t">Saison ${h.year} — ${h.kg || 0} kg · ${h.litres || 0} L d'huile</div><div class="s">${h.prix ? 'Vente : ' + fmtDH(h.prix) : ''}${h.note ? ' · ' + escape(h.note) : ''}</div></span><button class="btn gray sm" data-x>✕</button></div>`);
    $('[data-x]', row).onclick = () => { DB.farm.harvest = DB.farm.harvest.filter(x => x.id !== h.id); save(); router(); };
    hl.append(row);
  });
  $('#addHarvest', v).onclick = () => {
    const bg = modal('Récolte d\'olives', `
      ${field('Année / saison', `<input id="h_y" type="number" inputmode="numeric" value="${new Date().getFullYear()}">`)}
      ${field('Kg d\'olives récoltés', '<input id="h_kg" type="number" inputmode="decimal">')}
      ${field('Litres d\'huile', '<input id="h_l" type="number" inputmode="decimal">')}
      ${field('Montant des ventes (DH)', '<input id="h_p" type="number" inputmode="decimal">')}
      ${field('Note', '<input id="h_n" placeholder="ex: pressoir, prix/L…">')}
      <div class="modal-actions"><button class="btn gray" id="cancel">Annuler</button><button class="btn" id="ok">Enregistrer</button></div>`);
    $('#cancel', bg).onclick = () => bg.remove();
    $('#ok', bg).onclick = () => { DB.farm.harvest.push({ id: uid(), year: +$('#h_y', bg).value || new Date().getFullYear(), kg: +$('#h_kg', bg).value || 0, litres: +$('#h_l', bg).value || 0, prix: +$('#h_p', bg).value || 0, note: $('#h_n', bg).value.trim() }); save(); bg.remove(); router(); };
  };

  // Agenda agricole
  const al = $('#agendaList', v);
  const ag = DB.farm.agenda.slice().sort((a, b) => (a.done - b.done) || a.date.localeCompare(b.date));
  if (!ag.length) al.append(el('<small>Ajoute les travaux : taille, irrigation, traitement, récolte…</small>'));
  ag.forEach(a => {
    const dl = daysUntil(a.date);
    const row = el(`<div class="item"><span class="check ${a.done ? 'on' : ''}">${a.done ? '✓' : ''}</span><span class="ic">🌳</span>
      <span class="grow"><div class="t" style="${a.done ? 'text-decoration:line-through;color:#94a3b8' : ''}">${escape(a.task)}</div><div class="s">${a.date}${!a.done && dl >= 0 && dl <= 14 ? ' · dans ' + dl + ' j' : ''}</div></span>
      <button class="btn gray sm" data-x>✕</button></div>`);
    $('.check', row).onclick = () => { a.done = !a.done; save(); router(); };
    $('[data-x]', row).onclick = () => { DB.farm.agenda = DB.farm.agenda.filter(x => x.id !== a.id); save(); router(); };
    al.append(row);
  });
  $('#addAgenda', v).onclick = () => {
    const bg = modal('Travail agricole', `
      ${field('Tâche', '<input id="a_t" placeholder="ex: taille des oliviers, irrigation…" autofocus>')}
      ${field('Date prévue', `<input id="a_d" type="date" value="${todayISO()}">`)}
      <div class="modal-actions"><button class="btn gray" id="cancel">Annuler</button><button class="btn" id="ok">Ajouter</button></div>`);
    $('#cancel', bg).onclick = () => bg.remove();
    $('#ok', bg).onclick = () => { const t = $('#a_t', bg).value.trim(); if (!t) return; DB.farm.agenda.push({ id: uid(), task: t, date: $('#a_d', bg).value, done: false }); save(); bg.remove(); router(); };
  };

  // Arbres
  $('#editTrees', v).onclick = () => {
    const bg = modal('Nombre d’arbres', `<p><small>La caisse partagée est répartie au prorata des arbres.</small></p>
      ${field('🧍 Mes arbres', `<input id="t_me" type="number" inputmode="numeric" value="${DB.farm.trees.me}">`)}
      ${field('👵 Arbres grand-mère', `<input id="t_gm" type="number" inputmode="numeric" value="${DB.farm.trees.gm}">`)}
      <div class="modal-actions"><button class="btn" id="ok">Enregistrer</button></div>`);
    $('#ok', bg).onclick = () => { DB.farm.trees.me = +$('#t_me', bg).value || 0; DB.farm.trees.gm = +$('#t_gm', bg).value || 0; save(); bg.remove(); router(); };
  };

  // Moutons — log
  const sl = $('#sheepLog', v);
  const log = DB.farm.sheep.log.slice().sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const SHEEP_IC = { achat: '🛒', vente: '💰', naissance: '🐑', perte: '⚠️' };
  if (!log.length) sl.append(el('<small>Aucun mouvement. Ajoute un achat, une vente, une naissance ou une perte.</small>'));
  log.forEach(e => {
    const signHeads = (e.type === 'vente' || e.type === 'perte') ? '−' : '+';
    const row = el(`<div class="item"><span class="ic">${SHEEP_IC[e.type] || '🐑'}</span>
      <span class="grow"><div class="t">${signHeads}${e.heads} tête(s) · ${e.type}${e.note ? ' · ' + escape(e.note) : ''}</div><div class="s">${e.date}${e.amount ? ' · ' + fmtDH(e.amount) : ''}</div></span>
      <button class="btn gray sm" data-x>✕</button></div>`);
    $('[data-x]', row).onclick = () => { DB.farm.sheep.log = DB.farm.sheep.log.filter(x => x.id !== e.id); save(); router(); };
    sl.append(row);
  });
  $('#addSheep', v).onclick = () => sheepModal();
}
function sheepModal() {
  const types = { achat: 'Achat (+ têtes, − argent)', vente: 'Vente (− têtes, + argent)', naissance: 'Naissance (+ têtes)', perte: 'Perte / mort (− têtes)' };
  const body = `
    ${field('Type', `<select id="s_type">${Object.entries(types).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>`)}
    ${field('Nombre de têtes', '<input id="s_h" type="number" inputmode="numeric" value="1" autofocus>')}
    ${field('Montant (DH) — achat ou vente', '<input id="s_a" type="number" inputmode="decimal" placeholder="0">')}
    ${field('Date', `<input id="s_d" type="date" value="${todayISO()}">`)}
    ${field('Note (optionnel)', '<input id="s_n" placeholder="ex: souk El Arbaa">')}
    <div class="modal-actions"><button class="btn gray" id="cancel">Annuler</button><button class="btn" id="ok">Enregistrer</button></div>`;
  const bg = modal('Mouvement — moutons', body);
  $('#cancel', bg).onclick = () => bg.remove();
  $('#ok', bg).onclick = () => {
    const heads = +$('#s_h', bg).value || 0;
    if (!heads) { $('#s_h', bg).focus(); return; }
    DB.farm.sheep.log.push({ id: uid(), type: $('#s_type', bg).value, heads, amount: +$('#s_a', bg).value || 0, date: $('#s_d', bg).value, note: $('#s_n', bg).value.trim() });
    save(); bg.remove(); router();
  };
}
function farmOpModal(defCaisse) {
  let type = 'depense';
  const body = `
    <div class="seg" id="segType"><button data-t="depense" class="active">－ Dépense</button><button data-t="revenu">＋ Rentrée</button></div>
    ${field('Caisse', `<select id="f_caisse">${Object.entries(FARM_CAISSES).map(([k, l]) => `<option value="${k}" ${k === defCaisse ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
    <div class="hint" id="caisseHint" style="display:${defCaisse === 'partage' ? 'block' : 'none'}">Caisse partagée = oliviers uniquement (réparti avec grand-mère).</div>
    ${field('Montant (DH)', '<input id="f_amt" type="number" inputmode="decimal" placeholder="0" autofocus>')}
    ${field('Motif', `<select id="f_cat">${options(FARM_CATS.depense, defCaisse === 'partage' ? 'Oliviers' : '')}</select>`)}
    ${field('Date', `<input id="f_date" type="date" value="${todayISO()}">`)}
    ${field('Détail / description de la dépense', '<input id="f_note" placeholder="ex: taille des oliviers, 2 sacs d’engrais, ouvrier 1 jour…">')}
    <div class="modal-actions"><button class="btn gray" id="cancel">Annuler</button><button class="btn" id="ok">Enregistrer</button></div>`;
  const bg = modal('Mouvement — ferme', body);
  bg.querySelectorAll('#segType button').forEach(b => b.onclick = () => {
    bg.querySelectorAll('#segType button').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); type = b.dataset.t; $('#f_cat', bg).innerHTML = options(FARM_CATS[type]);
    if (type === 'depense' && $('#f_caisse', bg).value === 'partage') $('#f_cat', bg).value = 'Oliviers';
  });
  $('#f_caisse', bg).onchange = (e) => {
    const partage = e.target.value === 'partage';
    $('#caisseHint', bg).style.display = partage ? 'block' : 'none';
    if (partage && type === 'depense') $('#f_cat', bg).value = 'Oliviers';
  };
  $('#cancel', bg).onclick = () => bg.remove();
  $('#ok', bg).onclick = () => {
    const amount = +$('#f_amt', bg).value;
    if (!amount) { $('#f_amt', bg).focus(); return; }
    DB.farm.tx.push({ id: uid(), type, amount, caisse: $('#f_caisse', bg).value, cat: $('#f_cat', bg).value, date: $('#f_date', bg).value, note: $('#f_note', bg).value.trim() });
    save(); bg.remove(); router();
  };
}

/* ============================================================
   SPIRITUEL
   ============================================================ */
function renderSpirituel(v) {
  const t = todayISO();
  const done = DB.spiritual.prayers[t] || [];
  const sadaqaMonth = DB.spiritual.sadaqa.filter(s => monthOf(s.date) === monthOf(t)).reduce((a, s) => a + (+s.amount || 0), 0);
  const quranWeek = DB.spiritual.quran.slice(-7).reduce((a, q) => a + (+q.pages || 0), 0);
  const times = prayerTimes(new Date());
  const next = nextPrayer(times);
  const PR_LABEL = { Fajr: 'Fajr', Chourouq: 'Chourouq', Dohr: 'Dohr', Asr: 'Asr', Maghrib: 'Maghrib', Icha: 'Icha' };
  const totalPages = DB.spiritual.quran.reduce((a, q) => a + (+q.pages || 0), 0);
  const goalDay = +DB.spiritual.quranGoal || 2;
  const khatmaPage = totalPages % 604;
  const khatmas = Math.floor(totalPages / 604);
  const daysLeft = goalDay ? Math.ceil((604 - khatmaPage) / goalDay) : 0;

  v.append(el(`<div><h1>🕌 Spiritualité</h1>

    <div class="card">
      <div class="row between"><h3 style="margin:0">🕌 Horaires de prière — Kénitra</h3><button class="btn gray sm" id="adjPray">ajuster</button></div>
      <div class="prayers" style="margin-top:8px">
        ${['Fajr', 'Chourouq', 'Dohr', 'Asr', 'Maghrib', 'Icha'].map(k => `<div class="pray ${next.name === k ? 'on' : ''}" style="cursor:default">${PR_LABEL[k]}<div style="font-weight:800;margin-top:2px">${fmtHM(times[k])}</div></div>`).join('')}
      </div>
      <small>Prochaine : <b>${PR_LABEL[next.name]}</b> à ${fmtHM(next.at)}${next.tomorrow ? ' (demain)' : ''}. Calcul approximatif — si besoin, touche « ajuster ».</small>
      <button class="btn block ghost sm" id="prayICS" style="margin-top:10px">📅 Mettre les prières dans l'agenda (alarmes, 30 j)</button>
    </div>

    <div class="card">
      <h3>Prières faites aujourd'hui</h3>
      <div class="prayers" id="prayers">
        ${PRAYERS.map(p => `<div class="pray ${done.includes(p) ? 'on' : ''}" data-p="${p}">${p}</div>`).join('')}
      </div>
      <div class="bar" style="margin-top:10px"><span style="width:${done.length / 5 * 100}%"></span></div>
    </div>

    <div class="grid2">
      <div class="stat"><div class="label">Coran (7 j.)</div><div class="value teal">${quranWeek} pages</div></div>
      <div class="stat"><div class="label">Sadaqa (mois)</div><div class="value teal">${fmtDH(sadaqaMonth)}</div></div>
    </div>

    <div class="card">
      <div class="row between"><h3 style="margin:0">📗 Khatma (finir le Coran)</h3><button class="btn gray sm" id="khGoal">objectif</button></div>
      <div class="row between" style="margin-top:6px"><span>Page ${khatmaPage} / 604</span><b>${khatmas} khatma(s) ✓</b></div>
      <div class="bar"><span style="width:${khatmaPage / 604 * 100}%"></span></div>
      <small>Objectif ${goalDay} page(s)/jour → fini dans ~${daysLeft} jour(s). Ajoute ta lecture ci-dessous.</small>
    </div>

    <div class="card">
      <div class="row between"><h3 style="margin:0">💎 Zakat (2,5 %)</h3><button class="btn ghost sm" id="zInfo">détail</button></div>
      <div class="row between" style="margin-top:6px"><span>Base (capital + épargne)</span><b>${fmtDH(zakatBase())}</b></div>
      <div class="row between"><span><b>Zakat à donner / an</b></span><b class="amt pos">${fmtDH(zakatDue())}</b></div>
    </div>

    <div class="card">
      <div class="row between"><h3 style="margin:0">📖 Lecture du Coran</h3><button class="btn ghost sm" id="addQ">+ Aujourd'hui</button></div>
      <div id="qlist"></div>
    </div>

    <div class="card">
      <div class="row between"><h3 style="margin:0">🤲 Sadaqa</h3><button class="btn ghost sm" id="addS">+ Don</button></div>
      <div id="slist"></div>
    </div>
  </div>`));

  v.querySelectorAll('.pray[data-p]').forEach(p => p.onclick = () => {
    const set = new Set(DB.spiritual.prayers[t] || []);
    set.has(p.dataset.p) ? set.delete(p.dataset.p) : set.add(p.dataset.p);
    DB.spiritual.prayers[t] = [...set]; save(); router();
  });
  $('#prayICS', v).onclick = () => exportPrayerICS();
  $('#adjPray', v).onclick = () => {
    const o = DB.prayer.adjust;
    const body = ['Fajr', 'Dohr', 'Asr', 'Maghrib', 'Icha'].map(k => field(k + ' (± minutes)', `<input id="adj_${k}" type="number" inputmode="numeric" value="${+o[k] || 0}">`)).join('') + '<div class="modal-actions"><button class="btn gray" id="cancel">Annuler</button><button class="btn" id="ok">Enregistrer</button></div>';
    const bg = modal('Ajuster les horaires', '<p><small>Compare avec l\'horaire officiel de ta mosquée et corrige en minutes (+ ou −).</small></p>' + body);
    $('#cancel', bg).onclick = () => bg.remove();
    $('#ok', bg).onclick = () => { ['Fajr', 'Dohr', 'Asr', 'Maghrib', 'Icha'].forEach(k => o[k] = +$('#adj_' + k, bg).value || 0); save(); bg.remove(); router(); };
  };
  $('#khGoal', v).onclick = () => {
    const bg = modal('Objectif Khatma', `${field('Pages à lire par jour', `<input id="kg" type="number" inputmode="numeric" value="${+DB.spiritual.quranGoal || 2}">`)}<div class="modal-actions"><button class="btn" id="ok">Enregistrer</button></div>`);
    $('#ok', bg).onclick = () => { DB.spiritual.quranGoal = +$('#kg', bg).value || 1; save(); bg.remove(); router(); };
  };
  $('#zInfo', v).onclick = () => {
    modal('Zakat', `<p><small>La Zakat = <b>2,5 %</b> de l'épargne gardée une année lunaire (au-dessus du nisab).</small></p>
      <div class="row between"><span>Capital</span><b>${fmtDH(+DB.capital || 0)}</b></div>
      <div class="row between"><span>Épargne (fonds)</span><b>${fmtDH(savingsTotal())}</b></div>
      <div class="divider"></div>
      <div class="row between"><span><b>Base</b></span><b>${fmtDH(zakatBase())}</b></div>
      <div class="row between"><span><b>Zakat (2,5 %)</b></span><b class="amt pos">${fmtDH(zakatDue())}</b></div>
      <div class="modal-actions"><button class="btn" id="ok">Fermer</button></div>`).querySelector('#ok').onclick = e => e.target.closest('.modal-bg').remove();
  };

  const ql = $('#qlist', v);
  const q = DB.spiritual.quran.slice().reverse().slice(0, 10);
  if (!q.length) ql.append(el('<small>Note ta lecture quotidienne.</small>'));
  q.forEach(x => ql.append(el(`<div class="item"><span class="ic">📖</span><span class="grow"><div class="t">${x.pages} pages</div><div class="s">${x.date}</div></span></div>`)));
  $('#addQ', v).onclick = () => {
    const bg = modal('Lecture du Coran', `${field('Pages lues aujourd\'hui', '<input id="q_p" type="number" inputmode="numeric" autofocus>')}<div class="modal-actions"><button class="btn" id="ok">Enregistrer</button></div>`);
    $('#ok', bg).onclick = () => { const p = +$('#q_p', bg).value; if (!p) return; DB.spiritual.quran.push({ date: todayISO(), pages: p }); save(); bg.remove(); router(); };
  };

  const sl = $('#slist', v);
  const s = DB.spiritual.sadaqa.slice().reverse().slice(0, 10);
  if (!s.length) sl.append(el('<small>Garde une trace de tes dons.</small>'));
  s.forEach(x => sl.append(el(`<div class="item"><span class="ic">🤲</span><span class="grow"><div class="t">${fmtDH(x.amount)}${x.note ? ' · ' + escape(x.note) : ''}</div><div class="s">${x.date}</div></span></div>`)));
  $('#addS', v).onclick = () => {
    const bg = modal('Sadaqa', `${field('Montant (DH)', '<input id="s_a" type="number" inputmode="decimal" autofocus>')}${field('Note', '<input id="s_n" placeholder="ex: mosquée">')}<div class="modal-actions"><button class="btn" id="ok">Enregistrer</button></div>`);
    $('#ok', bg).onclick = () => {
      const a = +$('#s_a', bg).value; if (!a) return;
      DB.spiritual.sadaqa.push({ date: todayISO(), amount: a, note: $('#s_n', bg).value.trim() });
      DB.transactions.push({ id: uid(), type: 'depense', amount: a, account: 'Moi', cat: 'Sadaqa', date: todayISO(), note: $('#s_n', bg).value.trim() });
      save(); bg.remove(); router();
    };
  };
}

/* ============================================================
   PROJETS DE VIE  (aide à la décision)
   ============================================================ */
const STATUS = { reflexion: ['En réflexion', 'gray'], en_cours: ['En cours', 'green'], en_attente: ['En attente', 'red'], abandonne: ['Abandonné', 'gray'] };
const PROJECT_CATS = ['Garage', 'Appartement', 'Terrain', 'Ferme / Agricole', 'Commerce / Local', 'Véhicule', 'Autre'];
const PAYMENTS = ['Comptant', '2 tranches', '3 tranches', 'Crédit / Mourabaha', 'Autre'];
const CAT_ICON = { 'Garage': '🔧', 'Appartement': '🏢', 'Terrain': '🌍', 'Ferme / Agricole': '🌳', 'Commerce / Local': '🏪', 'Véhicule': '🚗', 'Autre': '📦' };
function renderProjets(v) {
  const projects = DB.projects.slice().sort((a, b) => (a.priority || 9) - (b.priority || 9));
  const groups = {};
  projects.forEach(p => { const c = p.type || 'Autre'; (groups[c] = groups[c] || []).push(p); });
  v.append(el(`<div><h1>🎯 Projets de vie</h1>
    <div class="hint">Tes options classées par catégorie. Remplis budget, lieu, métrage, paiement, délai… pour tout comparer et décider sereinement.</div>
    <button class="btn block ghost" id="simBtn" style="margin-bottom:10px">🏦 Simulateur immobilier (louer / acheter / Mourabaha)</button>
    <div id="plist"></div>
    <button class="btn block ghost" id="addP">+ Nouveau projet</button>
  </div>`));
  $('#simBtn', v).onclick = () => simulatorModal();
  const pc = $('#plist', v);
  Object.keys(groups).forEach(cat => {
    pc.append(el(`<div class="section-title">${CAT_ICON[cat] || '📦'} ${escape(cat)} (${groups[cat].length})</div>`));
    groups[cat].forEach(p => {
      const st = STATUS[p.status] || STATUS.reflexion;
      const rent = (p.income && p.cost) ? (p.income * 12 / p.cost * 100) : null;
      const card = el(`<div class="card">
        <div class="row between"><h3 style="margin:0">${escape(p.title)}</h3><span class="chip ${st[1]}">${st[0]}</span></div>
        ${p.location ? `<div class="s">📍 ${escape(p.location)}</div>` : ''}
        <div class="row" style="gap:6px;flex-wrap:wrap;margin:8px 0">
          <span class="chip gray">Priorité ${p.priority}</span>
          <span class="chip">💰 ${fmtDH(p.cost)}</span>
          ${p.surface ? `<span class="chip">📐 ${p.surface} m²</span>` : ''}
          ${p.payment ? `<span class="chip">💳 ${escape(p.payment)}</span>` : ''}
          ${p.deadline ? `<span class="chip">⏳ ${escape(p.deadline)}</span>` : ''}
        </div>
        ${p.income ? `<div class="row between"><span>Revenu attendu / mois</span><b class="amt pos">${fmtDH(p.income)}</b></div>` : ''}
        ${rent !== null ? `<div class="row between"><span>Rentabilité annuelle</span><b style="color:${rent >= 8 ? 'var(--green)' : 'var(--amber)'}">${rent.toFixed(1)} %</b></div>` : ''}
        <div class="grid2" style="gap:10px;margin-top:8px">
          <div><b style="color:var(--green)">✅ Pour</b>${(p.pros || []).map(x => `<div class="s" style="font-size:.82rem">• ${escape(x)}</div>`).join('') || '<div class="s">—</div>'}</div>
          <div><b style="color:var(--red)">⚠️ Contre</b>${(p.cons || []).map(x => `<div class="s" style="font-size:.82rem">• ${escape(x)}</div>`).join('') || '<div class="s">—</div>'}</div>
        </div>
        ${p.notes ? `<div class="hint" style="margin-top:10px">${escape(p.notes)}</div>` : ''}
        <div class="divider"></div>
        <div class="row between"><b style="font-size:.85rem">🗒️ Suivi / nouveautés</b><button class="btn ghost sm" data-addinfo>➕ Noter une info</button></div>
        <div class="infolist" style="margin-top:6px">${(p.log || []).slice().sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).map(l => `<div class="item"><span class="ic">📌</span><span class="grow"><div class="t" style="font-weight:400;white-space:normal">${escape(l.text)}</div><div class="s">${l.date}</div></span><button class="btn gray sm" data-delinfo="${l.id}">✕</button></div>`).join('') || '<small>Aucune info notée. Ajoute du nouveau dès que tu en apprends.</small>'}</div>
        <div class="row" style="gap:8px;margin-top:10px"><button class="btn gray sm" data-edit>✎ Modifier</button><button class="btn gray sm" data-del>🗑</button></div>
      </div>`);
      $('[data-edit]', card).onclick = () => projModal(p.id);
      $('[data-del]', card).onclick = () => { if (confirm('Supprimer ce projet ?')) { DB.projects = DB.projects.filter(x => x.id !== p.id); save(); router(); } };
      $('[data-addinfo]', card).onclick = () => infoModal(p);
      card.querySelectorAll('[data-delinfo]').forEach(b => b.onclick = () => { p.log = (p.log || []).filter(l => l.id !== b.dataset.delinfo); save(); router(); });
      pc.append(card);
    });
  });
  $('#addP', v).onclick = () => projModal();
}
function simulatorModal() {
  const body = `
    <p><small>Estime ta mensualité et compare avec une location. Chiffres indicatifs.</small></p>
    ${field('Prix du bien (DH)', '<input id="sm_prix" type="number" inputmode="decimal" value="600000" autofocus>')}
    ${field('Apport / avance (DH)', '<input id="sm_apport" type="number" inputmode="decimal" value="300000">')}
    ${field('Durée (années)', '<input id="sm_an" type="number" inputmode="numeric" value="15">')}
    <div class="seg" id="sm_mode"><button data-m="mourabaha" class="active">Mourabaha</button><button data-m="credit">Crédit (taux)</button></div>
    ${field('Marge / taux annuel (%)', '<input id="sm_taux" type="number" inputmode="decimal" value="6">')}
    ${field('Loyer actuel pour comparer (DH/mois)', '<input id="sm_loyer" type="number" inputmode="decimal" value="2500">')}
    <div id="sm_out" class="card" style="background:var(--teal-l);margin-top:6px"></div>
    <div class="modal-actions"><button class="btn" id="ok">Fermer</button></div>`;
  const bg = modal('🏦 Simulateur immobilier', body);
  let mode = 'mourabaha';
  const calc = () => {
    const prix = +$('#sm_prix', bg).value || 0, apport = +$('#sm_apport', bg).value || 0;
    const n = (+$('#sm_an', bg).value || 1) * 12, taux = +$('#sm_taux', bg).value || 0;
    const principal = Math.max(0, prix - apport);
    let mensual, total;
    if (mode === 'mourabaha') { total = principal * (1 + taux / 100); mensual = total / n; }
    else { const r = taux / 100 / 12; mensual = r ? principal * r / (1 - Math.pow(1 + r, -n)) : principal / n; total = mensual * n; }
    const surcout = total - principal;
    const loyer = +$('#sm_loyer', bg).value || 0;
    const diff = mensual - loyer;
    $('#sm_out', bg).innerHTML = `
      <div class="row between"><span>Montant à financer</span><b>${fmtDH(principal)}</b></div>
      <div class="row between"><span><b>Mensualité</b></span><b style="color:var(--teal-d);font-size:1.1rem">${fmtDH(mensual)}/mois</b></div>
      <div class="row between"><span>Coût total payé</span><b>${fmtDH(total)}</b></div>
      <div class="row between"><span>Surcoût (${mode === 'mourabaha' ? 'marge' : 'intérêts'})</span><b>${fmtDH(surcout)}</b></div>
      <div class="divider"></div>
      <div class="row between"><span>vs loyer (${fmtDH(loyer)})</span><b style="color:${diff > 0 ? 'var(--red)' : 'var(--green)'}">${diff > 0 ? '+' : ''}${fmtDH(diff)}/mois</b></div>
      <small>${diff > 0 ? 'Acheter coûte plus par mois, mais tu deviens propriétaire.' : 'La mensualité est ≤ ton loyer : acheter est intéressant.'}</small>`;
  };
  bg.querySelectorAll('#sm_mode button').forEach(b => b.onclick = () => { bg.querySelectorAll('#sm_mode button').forEach(x => x.classList.remove('active')); b.classList.add('active'); mode = b.dataset.m; calc(); });
  bg.querySelectorAll('input').forEach(i => i.addEventListener('input', calc));
  $('#ok', bg).onclick = () => bg.remove();
  calc();
}
function infoModal(p) {
  const body = `
    ${field('Quoi de neuf sur ce projet ?', '<textarea id="i_t" placeholder="ex: le propriétaire demande 350 000 / visite prévue samedi / besoin de travaux toiture" autofocus></textarea>')}
    ${field('Date', `<input id="i_d" type="date" value="${todayISO()}">`)}
    <div class="modal-actions"><button class="btn gray" id="cancel">Annuler</button><button class="btn" id="ok">Ajouter</button></div>`;
  const bg = modal('Noter une info — ' + p.title, body);
  $('#cancel', bg).onclick = () => bg.remove();
  $('#ok', bg).onclick = () => {
    const t = $('#i_t', bg).value.trim(); if (!t) return;
    p.log = p.log || [];
    p.log.push({ id: uid(), date: $('#i_d', bg).value || todayISO(), text: t });
    save(); bg.remove(); router();
  };
}
function projModal(id) {
  const cur = id ? DB.projects.find(p => p.id === id) : { title: '', type: 'Garage', location: '', cost: 0, surface: 0, payment: 'Comptant', deadline: '', income: 0, priority: DB.projects.length + 1, status: 'reflexion', pros: [], cons: [], notes: '' };
  const catChoices = PROJECT_CATS.includes(cur.type) ? PROJECT_CATS : [cur.type, ...PROJECT_CATS];
  const body = `
    ${field('Nom du projet', `<input id="p_t" value="${escape(cur.title)}" placeholder="ex: Garage à acheter" autofocus>`)}
    <div class="grid2">
      ${field('Catégorie', `<select id="p_type">${options(catChoices, cur.type)}</select>`)}
      ${field('Lieu', `<input id="p_loc" value="${escape(cur.location || '')}" placeholder="ex: Benslimane">`)}
    </div>
    <div class="grid2">
      ${field('Budget (DH)', `<input id="p_c" type="number" inputmode="decimal" value="${cur.cost || ''}" placeholder="ex: 340000">`)}
      ${field('Métrage (m²)', `<input id="p_surf" type="number" inputmode="decimal" value="${cur.surface || ''}">`)}
    </div>
    <div class="grid2">
      ${field('Paiement', `<select id="p_pay">${options(PAYMENTS, cur.payment || 'Comptant')}</select>`)}
      ${field('Délai / échéance', `<input id="p_dl" value="${escape(cur.deadline || '')}" placeholder="ex: 3 mois, fin 2026">`)}
    </div>
    <div class="grid2">
      ${field('Revenu attendu / mois (DH)', `<input id="p_inc" type="number" inputmode="decimal" value="${cur.income || ''}" placeholder="loyer, 0 si aucun">`)}
      ${field('Priorité (1=top)', `<input id="p_pr" type="number" inputmode="numeric" value="${cur.priority || 1}">`)}
    </div>
    ${field('Statut', `<select id="p_st">${Object.entries(STATUS).map(([k, val]) => `<option value="${k}" ${cur.status === k ? 'selected' : ''}>${val[0]}</option>`).join('')}</select>`)}
    ${field('Pour (une raison par ligne)', `<textarea id="p_pro">${(cur.pros || []).join('\n')}</textarea>`)}
    ${field('Contre (une raison par ligne)', `<textarea id="p_con">${(cur.cons || []).join('\n')}</textarea>`)}
    ${field('Notes', `<textarea id="p_n">${escape(cur.notes || '')}</textarea>`)}
    <div class="modal-actions"><button class="btn gray" id="cancel">Annuler</button><button class="btn" id="ok">Enregistrer</button></div>`;
  const bg = modal(id ? 'Modifier le projet' : 'Nouveau projet', body);
  $('#cancel', bg).onclick = () => bg.remove();
  $('#ok', bg).onclick = () => {
    const o = {
      title: $('#p_t', bg).value.trim() || '(sans titre)', type: $('#p_type', bg).value, location: $('#p_loc', bg).value.trim(),
      cost: +$('#p_c', bg).value || 0, surface: +$('#p_surf', bg).value || 0, payment: $('#p_pay', bg).value,
      deadline: $('#p_dl', bg).value.trim(), income: +$('#p_inc', bg).value || 0,
      priority: +$('#p_pr', bg).value || 1, status: $('#p_st', bg).value,
      pros: $('#p_pro', bg).value.split('\n').map(s => s.trim()).filter(Boolean),
      cons: $('#p_con', bg).value.split('\n').map(s => s.trim()).filter(Boolean),
      notes: $('#p_n', bg).value.trim(),
    };
    if (id) Object.assign(cur, o); else DB.projects.push(Object.assign({ id: uid() }, o));
    save(); bg.remove(); router();
  };
}

/* ============================================================
   RÉGLAGES  (profil, sauvegarde, reset)
   ============================================================ */
function renderReglages(v) {
  v.append(el(`<div><h1>⚙️ Réglages</h1>
    <div class="card">
      <h3>Profil</h3>
      ${field('Ton prénom', `<input id="s_name" value="${escape(DB.profile.name)}" placeholder="ex: Yassine">`)}
      ${field('Ville', `<input id="s_ville" value="${escape(DB.profile.ville)}">`)}
      ${field('Capital actuel (DH)', `<input id="s_cap" type="number" value="${DB.capital}">`)}
      <button class="btn" id="saveProf">Enregistrer</button>
    </div>

    <div class="card">
      <h3>🎨 Apparence</h3>
      <label class="field" style="display:flex;align-items:center;gap:10px"><input type="checkbox" id="darkTog" ${DB.theme === 'dark' ? 'checked' : ''} style="width:auto;margin:0"> 🌙 Mode sombre</label>
    </div>

    <div class="card">
      <h3>🌙 Rappel du soir</h3>
      <p><small>Te rappelle de noter tes dépenses chaque soir. Visible dans l'app ; aussi en notification système si tu l'autorises (quand l'app reste ouverte). Astuce : mets aussi une alarme sur ton téléphone après Icha.</small></p>
      <label class="field" style="display:flex;align-items:center;gap:10px"><input type="checkbox" id="rem_on" ${DB.reminder.enabled ? 'checked' : ''} style="width:auto;margin:0"> Activer le rappel</label>
      ${field('Heure', `<input id="rem_t" type="time" value="${DB.reminder.time}">`)}
      <button class="btn sm" id="saveRem">Enregistrer</button>
    </div>

    <div class="card">
      <h3>☁️ Sauvegarde GitHub (privée, multi-appareils)</h3>
      ${SYNC.enabled ? `
        <p><small>✅ <b>Connecté.</b> Tes données sont sauvegardées automatiquement dans un Gist privé et synchronisées entre tes appareils.</small></p>
        <p><small>Dernière sauvegarde : ${SYNC.lastSync ? new Date(SYNC.lastSync).toLocaleString('fr-FR') : '—'}</small></p>
        <div class="row" style="gap:8px"><button class="btn" id="ghSave">⬆ Sauvegarder</button><button class="btn ghost" id="ghRestore">⬇ Restaurer</button></div>
        <button class="btn gray sm" id="ghDisc" style="margin-top:8px">Déconnecter cet appareil</button>
      ` : `
        <p><small>Sauvegarde tes données dans un <b>Gist GitHub privé</b> : elles survivent aux réinstallations et se synchronisent entre téléphone et ordinateur. Le jeton n'a besoin que de la permission <b>gist</b> — il ne touche <b>aucun</b> de tes dépôts (ton projet « gestion filtre » reste intact).</small></p>
        ${field('Jeton GitHub (permission : gist)', '<input id="gh_tok" type="password" placeholder="ghp_…" autocomplete="off">')}
        ${field('ID du Gist (si tu en as déjà un — sinon laisse vide)', '<input id="gh_gid" placeholder="optionnel" autocomplete="off">')}
        <button class="btn" id="ghConnect">Connecter</button>
        <p><small>Créer un jeton : ouvre <b>github.com/settings/tokens</b> → « Generate new token (classic) » → coche uniquement <b>gist</b> → Generate → copie le code <b>ghp_…</b>.</small></p>
      `}
    </div>

    <div class="card">
      <h3>💾 Sauvegarde fichier (hors-ligne)</h3>
      <p><small>Exporte un fichier pour sauvegarder ou transférer entre appareils sans GitHub.</small></p>
      <div class="row" style="gap:8px"><button class="btn ghost" id="exp">⬇ Exporter</button><button class="btn ghost" id="imp">⬆ Importer</button></div>
      <input id="impFile" type="file" accept="application/json" style="display:none">
    </div>

    <div class="card">
      <h3>📲 Installer l'app</h3>
      <p><small>Sur téléphone : menu du navigateur → « Ajouter à l'écran d'accueil ». Sur ordinateur (Chrome/Edge) : icône d'installation dans la barre d'adresse.</small></p>
    </div>

    <div class="card">
      <h3 style="color:var(--red)">Zone sensible</h3>
      <button class="btn danger" id="reset">Tout réinitialiser</button>
    </div>
    <a class="btn block gray" href="#/">← Retour</a>
  </div>`));

  $('#darkTog', v).onclick = () => { DB.theme = $('#darkTog', v).checked ? 'dark' : 'light'; save(); applyTheme(); };
  $('#saveProf', v).onclick = () => {
    DB.profile.name = $('#s_name', v).value.trim();
    DB.profile.ville = $('#s_ville', v).value.trim();
    DB.capital = +$('#s_cap', v).value || 0;
    save(); $('#saveProf', v).textContent = 'Enregistré ✓';
  };
  $('#saveRem', v).onclick = () => {
    DB.reminder.enabled = $('#rem_on', v).checked;
    DB.reminder.time = $('#rem_t', v).value || '20:30';
    save();
    if (DB.reminder.enabled && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    scheduleReminder();
    $('#saveRem', v).textContent = 'Enregistré ✓';
  };
  $('#exp', v).onclick = () => {
    const blob = new Blob([JSON.stringify(DB, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'gestion-vie-' + todayISO() + '.json'; a.click();
  };
  $('#imp', v).onclick = () => $('#impFile', v).click();
  $('#impFile', v).onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { try { DB = migrate(JSON.parse(r.result)); save(); alert('Données importées ✓'); go('/'); } catch (err) { alert('Fichier invalide.'); } };
    r.readAsText(f);
  };
  $('#reset', v).onclick = () => { if (confirm('Effacer TOUTES les données ? (Exporte d\'abord une sauvegarde !)')) { localStorage.removeItem(KEY); DB = load(); go('/'); } };

  // GitHub sync
  if (SYNC.enabled) {
    $('#ghSave', v).onclick = async () => { const b = $('#ghSave', v); b.textContent = '…'; try { await ghPush(); router(); } catch (e) { alert('Erreur : ' + e.message); b.textContent = '⬆ Sauvegarder'; } };
    $('#ghRestore', v).onclick = async () => {
      if (!confirm('Remplacer les données de cet appareil par celles de GitHub ?')) return;
      try { const r = await ghPull(); if (r) { DB = migrate(r); persist(); alert('Restauré depuis GitHub ✓'); go('/'); } else alert('Aucune donnée trouvée dans le Gist.'); } catch (e) { alert('Erreur : ' + e.message); }
    };
    $('#ghDisc', v).onclick = () => { if (confirm('Déconnecter GitHub ? Les données restent sur cet appareil.')) { SYNC = {}; saveSync(); router(); } };
  } else {
    $('#ghConnect', v).onclick = async () => {
      const tok = $('#gh_tok', v).value.trim(); if (!tok) { alert('Colle ton jeton GitHub (ghp_…).'); return; }
      const gid = $('#gh_gid', v).value.trim();
      const btn = $('#ghConnect', v); btn.textContent = 'Connexion…'; btn.disabled = true;
      SYNC.token = tok;
      try {
        if (gid) {
          SYNC.gistId = gid; SYNC.enabled = true; saveSync();
          const r = await ghPull();
          if (r) { DB = migrate(r); persist(); }
          alert('Connecté ✓ Tes données ont été chargées depuis GitHub.');
        } else {
          const id = await ghCreateGist();
          SYNC.gistId = id; SYNC.enabled = true; SYNC.lastSync = Date.now(); saveSync();
          alert('Connecté ✓ Un Gist privé a été créé pour tes données.');
        }
        go('/');
      } catch (e) {
        SYNC.enabled = false; saveSync();
        alert('Échec : ' + e.message + '\nVérifie le jeton (permission « gist ») et ta connexion internet.');
        btn.textContent = 'Connecter'; btn.disabled = false;
      }
    };
  }
}

/* ============================================================
   HABITUDES (gestion)
   ============================================================ */
function habitsModal() {
  const list = DB.habits.map(h => `<div class="item"><span class="ic">${h.icon || '⭐'}</span><span class="grow"><div class="t">${escape(h.name)}</div><div class="s">🔥 ${habitStreak(h)} jours</div></span><button class="btn gray sm" data-x="${h.id}">✕</button></div>`).join('') || '<small>Aucune habitude pour l\'instant.</small>';
  const body = `<div id="hlist">${list}</div>
    <div class="divider"></div>
    ${field('Nouvelle habitude', '<input id="h_n" placeholder="ex: Sport, Boire 2L d\'eau, Dhikr…">')}
    ${field('Emoji (optionnel)', '<input id="h_i" placeholder="🏃 💧 📿" maxlength="2">')}
    <div class="modal-actions"><button class="btn gray" id="close">Fermer</button><button class="btn" id="add">Ajouter</button></div>`;
  const bg = modal('Gérer les habitudes', body);
  bg.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { DB.habits = DB.habits.filter(h => h.id !== b.dataset.x); save(); bg.remove(); router(); });
  $('#add', bg).onclick = () => { const n = $('#h_n', bg).value.trim(); if (!n) return; DB.habits.push({ id: uid(), name: n, icon: $('#h_i', bg).value.trim() || '⭐', dates: [] }); save(); bg.remove(); router(); };
  $('#close', bg).onclick = () => { bg.remove(); router(); };
}

/* ============================================================
   STATISTIQUES (dépenses mensuelles)
   ============================================================ */
function renderStats(v) {
  const months = [], now = new Date();
  for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push(d.toISOString().slice(0, 7)); }
  const data = months.map(m => { const tx = DB.transactions.filter(t => monthOf(t.date) === m && isOwn(t)); const dep = tx.filter(t => t.type === 'depense').reduce((a, t) => a + (+t.amount || 0), 0); const rev = tx.filter(t => t.type === 'revenu').reduce((a, t) => a + (+t.amount || 0), 0); return { m, dep, rev }; });
  const max = Math.max(1, ...data.map(d => Math.max(d.dep, d.rev)));
  const lbl = m => new Date(m + '-01').toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
  const avgDep = Math.round(data.reduce((a, d) => a + d.dep, 0) / 6);
  v.append(el(`<div><h1>📈 Statistiques</h1>
    <div class="hint">Dépenses (rouge) et entrées (vert) des 6 derniers mois — caisse perso (Maman exclue). Moyenne dépenses : <b>${fmtDH(avgDep)}/mois</b>.</div>
    <div class="card">${data.map(d => `<div style="margin-bottom:14px"><div class="row between"><b style="text-transform:capitalize">${lbl(d.m)}</b><small>−${fmtDH(d.dep)} · +${fmtDH(d.rev)}</small></div>
      <div class="bar" style="height:11px"><span style="width:${d.dep / max * 100}%;background:var(--red)"></span></div>
      <div class="bar" style="height:11px;margin-top:3px"><span style="width:${d.rev / max * 100}%;background:var(--green)"></span></div></div>`).join('')}</div>
    <a class="btn block gray" href="#/">← Accueil</a></div>`));
}

/* ============================================================
   REVUE DE LA SEMAINE (dimanche)
   ============================================================ */
function renderRevue(v) {
  const days = []; for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(d.toISOString().slice(0, 10)); }
  const setDays = new Set(days);
  const tx = DB.transactions.filter(t => setDays.has(t.date) && isOwn(t));
  const dep = tx.filter(t => t.type === 'depense').reduce((a, t) => a + (+t.amount || 0), 0);
  const rev = tx.filter(t => t.type === 'revenu').reduce((a, t) => a + (+t.amount || 0), 0);
  let prayCount = 0; days.forEach(d => prayCount += (DB.spiritual.prayers[d] || []).length);
  const tasks = DB.tasks.filter(t => setDays.has(t.date)); const tasksDone = tasks.filter(t => t.done).length;
  const mealsPlanned = days.filter(d => { const p = DB.meals.plan[d] || {}; return p.matin || p.midi || p.soir; }).length;
  const habitsTop = DB.habits.map(h => ({ name: h.name, icon: h.icon, s: habitStreak(h) })).sort((a, b) => b.s - a.s);
  v.append(el(`<div><h1>📊 Revue de la semaine</h1>
    <div class="hint">À faire chaque <b>dimanche</b> : où est passé l'argent, où en sont tes prières et tes objectifs (7 derniers jours).</div>
    <div class="grid2">
      <div class="stat"><div class="label">Dépensé (7j)</div><div class="value neg">${fmtDH(dep)}</div></div>
      <div class="stat"><div class="label">Entré (7j)</div><div class="value pos">${fmtDH(rev)}</div></div>
      <div class="stat"><div class="label">Prières</div><div class="value teal">${prayCount}/35</div></div>
      <div class="stat"><div class="label">Tâches faites</div><div class="value teal">${tasksDone}/${tasks.length}</div></div>
    </div>
    <div class="card"><div class="row between"><span>🍽️ Jours avec repas planifiés</span><b>${mealsPlanned}/7</b></div></div>
    ${habitsTop.length ? `<div class="card"><h3>🔥 Habitudes</h3>${habitsTop.map(h => `<div class="row between" style="padding:4px 0"><span>${h.icon || '⭐'} ${escape(h.name)}</span><b>${h.s} j</b></div>`).join('')}</div>` : ''}
    <div class="hint">💡 Question du dimanche : qu'est-ce que tu améliores la semaine prochaine ?</div>
    <a class="btn block gray" href="#/">← Accueil</a></div>`));
}

/* ============================================================
   VOITURE & ENTRETIEN
   ============================================================ */
function renderVoiture(v) {
  const log = DB.car.log.slice().sort((a, b) => b.date.localeCompare(a.date));
  const lastVid = DB.car.log.filter(e => e.type === 'Vidange').sort((a, b) => b.date.localeCompare(a.date))[0];
  v.append(el(`<div><h1>🚗 Voiture & entretien</h1>
    <div class="card">
      <div class="row between"><h3 style="margin:0">Kilométrage actuel</h3><button class="btn gray sm" id="setKm">modifier</button></div>
      <div class="value teal" style="font-size:1.5rem;font-weight:800;margin-top:4px">${(+DB.car.km || 0).toLocaleString('fr-FR')} km</div>
      ${lastVid ? `<small>Dernière vidange : ${lastVid.date}${lastVid.km ? ' à ' + (+lastVid.km).toLocaleString('fr-FR') + ' km' : ''}. Prochaine conseillée ≈ ${((+lastVid.km || 0) + 10000).toLocaleString('fr-FR')} km.</small>` : '<small>Note ta première vidange ci-dessous.</small>'}
    </div>
    <div class="row between" style="margin:6px 4px"><b>Entretiens & frais</b><button class="btn ghost sm" id="addCar">+ Entretien</button></div>
    <div class="card" id="carList">${log.length ? log.map(e => `<div class="item"><span class="ic">🔧</span><span class="grow"><div class="t">${escape(e.type)}${e.note ? ' · ' + escape(e.note) : ''}</div><div class="s">${e.date}${e.km ? ' · ' + (+e.km).toLocaleString('fr-FR') + ' km' : ''}</div></span>${e.cost ? `<b class="amt neg">${fmtDH(e.cost)}</b>` : ''}<button class="btn gray sm" data-x="${e.id}">✕</button></div>`).join('') : '<div class="empty">Aucun entretien noté.</div>'}</div>
    <a class="btn block gray" href="#/">← Accueil</a></div>`));
  $('#setKm', v).onclick = () => { const bg = modal('Kilométrage', field('Km actuel', `<input id="km" type="number" inputmode="numeric" value="${+DB.car.km || 0}">`) + '<div class="modal-actions"><button class="btn" id="ok">Enregistrer</button></div>'); $('#ok', bg).onclick = () => { DB.car.km = +$('#km', bg).value || 0; save(); bg.remove(); router(); }; };
  v.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { DB.car.log = DB.car.log.filter(e => e.id !== b.dataset.x); save(); router(); });
  $('#addCar', v).onclick = () => carModal();
}
function carModal() {
  const types = ['Vidange', 'Filtres', 'Pneus', 'Freins', 'Assurance', 'Visite technique', 'Vignette', 'Réparation', 'Carburant', 'Autre'];
  const bg = modal('Entretien / frais voiture', `
    ${field('Type', `<select id="c_t">${options(types)}</select>`)}
    ${field('Date', `<input id="c_d" type="date" value="${todayISO()}">`)}
    ${field('Km (optionnel)', '<input id="c_k" type="number" inputmode="numeric">')}
    ${field('Coût (DH)', '<input id="c_c" type="number" inputmode="decimal">')}
    ${field('Note', '<input id="c_n" placeholder="ex: garage, huile 10W40">')}
    <div class="modal-actions"><button class="btn gray" id="cancel">Annuler</button><button class="btn" id="ok">Enregistrer</button></div>`);
  $('#cancel', bg).onclick = () => bg.remove();
  $('#ok', bg).onclick = () => { const km = +$('#c_k', bg).value || 0; DB.car.log.push({ id: uid(), type: $('#c_t', bg).value, date: $('#c_d', bg).value, km, cost: +$('#c_c', bg).value || 0, note: $('#c_n', bg).value.trim() }); if (km) DB.car.km = Math.max(+DB.car.km || 0, km); save(); bg.remove(); router(); };
}

/* ============================================================
   COFFRE À INFOS IMPORTANTES
   ============================================================ */
function renderCoffre(v) {
  v.append(el(`<div><h1>🗂️ Coffre à infos</h1>
    <div class="hint">Tes infos importantes (CIN, carte grise, n° assurance, RIB, CNSS…), gardées sur ton appareil et dans ta sauvegarde privée. Évite les mots de passe très sensibles.</div>
    <div id="vaultList"></div>
    <button class="btn block ghost" id="addV">+ Ajouter une info</button>
    <a class="btn block gray" href="#/" style="margin-top:8px">← Accueil</a></div>`));
  const vl = $('#vaultList', v);
  if (!DB.vault.length) vl.append(el('<small>Vide. Ajoute ta CIN, carte grise, n° assurance…</small>'));
  DB.vault.forEach(it => {
    const card = el(`<div class="card"><div class="row between"><b>${escape(it.label)}</b><span><button class="btn gray sm" data-c>copier</button> <button class="btn gray sm" data-e>✎</button> <button class="btn gray sm" data-x>✕</button></span></div><div style="font-family:monospace;margin-top:6px;word-break:break-all">${escape(it.value)}</div>${it.note ? `<small>${escape(it.note)}</small>` : ''}</div>`);
    $('[data-c]', card).onclick = () => { try { navigator.clipboard.writeText(it.value); } catch (e) {} $('[data-c]', card).textContent = 'copié ✓'; };
    $('[data-e]', card).onclick = () => vaultModal(it.id);
    $('[data-x]', card).onclick = () => { if (confirm('Supprimer cette info ?')) { DB.vault = DB.vault.filter(x => x.id !== it.id); save(); router(); } };
    vl.append(card);
  });
  $('#addV', v).onclick = () => vaultModal();
}
function vaultModal(id) {
  const cur = id ? DB.vault.find(x => x.id === id) : { label: '', value: '', note: '' };
  const bg = modal(id ? 'Modifier l\'info' : 'Nouvelle info', `
    ${field('Titre', `<input id="v_l" value="${escape(cur.label)}" placeholder="ex: CIN, Carte grise, RIB" autofocus>`)}
    ${field('Valeur', `<textarea id="v_v" placeholder="numéro / info">${escape(cur.value)}</textarea>`)}
    ${field('Note', `<input id="v_n" value="${escape(cur.note || '')}" placeholder="ex: expire 2027">`)}
    <div class="modal-actions"><button class="btn gray" id="cancel">Annuler</button><button class="btn" id="ok">Enregistrer</button></div>`);
  $('#cancel', bg).onclick = () => bg.remove();
  $('#ok', bg).onclick = () => { const o = { label: $('#v_l', bg).value.trim() || '(sans titre)', value: $('#v_v', bg).value.trim(), note: $('#v_n', bg).value.trim() }; if (id) Object.assign(cur, o); else DB.vault.push(Object.assign({ id: uid() }, o)); save(); bg.remove(); router(); };
}

/* ============================================================
   RAPPEL DU SOIR (notification quand l'app est ouverte)
   ============================================================ */
let reminderTimer = null;
function scheduleReminder() {
  if (reminderTimer) { clearTimeout(reminderTimer); reminderTimer = null; }
  if (!DB.reminder || !DB.reminder.enabled) return;
  const [h, mi] = (DB.reminder.time || '20:30').split(':').map(Number);
  const now = new Date();
  const next = new Date(); next.setHours(h, mi, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  reminderTimer = setTimeout(() => {
    const noTx = !DB.transactions.some(t => t.date === todayISO());
    if (noTx && 'Notification' in window && Notification.permission === 'granted') {
      try { new Notification('Gestion de Vie', { body: 'Pense à noter tes dépenses du jour (2 min) 🌙', icon: 'icons/icon-192.png' }); } catch (e) {}
    }
    if (currentRoute() === '/') router();
    scheduleReminder();
  }, Math.min(next - now, 2147483000));
}

/* ============================================================
   RAPPEL MÉDICAMENTS MAMAN (notification à l'heure de prise)
   ============================================================ */
let medTimer = null;
function scheduleMedReminder() {
  if (medTimer) { clearTimeout(medTimer); medTimer = null; }
  const all = [];
  (DB.mother.meds || []).forEach(med => (med.times || []).forEach(hm => all.push({ name: med.name, hm })));
  if (!all.length) return;
  const now = new Date(); const nowMin = now.getHours() * 60 + now.getMinutes();
  let best = null;
  all.forEach(x => { const [h, mi] = x.hm.split(':').map(Number); let mins = h * 60 + mi - nowMin; if (mins <= 0) mins += 1440; if (!best || mins < best.mins) best = { mins, name: x.name, hm: x.hm }; });
  if (!best) return;
  medTimer = setTimeout(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification('💊 Médicament de maman', { body: best.name + ' — ' + best.hm, icon: 'icons/icon-192.png' }); } catch (e) {}
    }
    scheduleMedReminder();
  }, Math.min(best.mins * 60000, 2147483000));
}

/* ============================================================
   INIT
   ============================================================ */
$('#todayDate').textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' });
router();
scheduleReminder();
scheduleMedReminder();
syncOnLoad();
