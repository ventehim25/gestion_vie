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
    spiritual: { prayers: {}, quran: [], sadaqa: [] },
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
function migrate(d) { const s = seed(); return Object.assign({}, s, d); }
function persist(d = DB) { localStorage.setItem(KEY, JSON.stringify(d)); }
function save() { persist(); }

/* ---------- Calculs budget ---------- */
function monthTx(month = monthOf(todayISO())) { return DB.transactions.filter(t => monthOf(t.date) === month); }
function sumFixed() { return DB.fixed.reduce((a, f) => a + (+f.amount || 0), 0); }
function sumIncomes() { return DB.incomes.reduce((a, f) => a + (+f.amount || 0), 0); }
function monthTotals(month) {
  const tx = monthTx(month);
  const dep = tx.filter(t => t.type === 'depense').reduce((a, t) => a + (+t.amount || 0), 0);
  const rev = tx.filter(t => t.type === 'revenu').reduce((a, t) => a + (+t.amount || 0), 0);
  return { dep, rev, net: rev - dep };
}
function todayTotals() {
  const t = DB.transactions.filter(t => t.date === todayISO());
  return { dep: t.filter(x => x.type === 'depense').reduce((a, x) => a + (+x.amount || 0), 0) };
}

/* ============================================================
   ROUTER
   ============================================================ */
const routes = {
  '/': renderHome, 'budget': renderBudget, 'planning': renderPlanning,
  'famille': renderFamille, 'spirituel': renderSpirituel, 'projets': renderProjets,
  'reglages': renderReglages,
};
function currentRoute() { return (location.hash.replace(/^#\//, '') || '/'); }
function router() {
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

  v.append(el(`<div>
    <h1>${hello}</h1>
    <div class="hint">Astuce : note chaque dépense pendant 30 jours. Tu connaîtras enfin tes vraies charges fixes — et les grandes décisions deviendront claires.</div>

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

    <div class="section-title">Aujourd'hui</div>
    <div class="card tap" id="goPray">
      <div class="row between"><h3 style="margin:0">🕌 Prières</h3><span class="chip ${prDone === 5 ? 'green' : ''}">${prDone}/5</span></div>
      <div class="bar"><span style="width:${prDone / 5 * 100}%"></span></div>
    </div>
    <div class="card tap" id="goTasks">
      <div class="row between"><h3 style="margin:0">📅 Tâches du jour</h3><span class="chip ${tasks.length && tasksDone === tasks.length ? 'green' : ''}">${tasksDone}/${tasks.length}</span></div>
      ${tasks.length ? tasks.slice(0, 3).map(t => `<div class="item"><span class="check ${t.done ? 'on' : ''}">${t.done ? '✓' : ''}</span><span class="grow"><div class="t">${escape(t.title)}</div></span></div>`).join('') : '<small>Aucune tâche. Ajoute ta journée dans Planning.</small>'}
    </div>

    <div class="section-title">Bilan du mois</div>
    <div class="grid2">
      <div class="stat"><div class="label">Entrées</div><div class="value pos">${fmtDH(tot.rev)}</div></div>
      <div class="stat"><div class="label">Sorties</div><div class="value neg">${fmtDH(tot.dep)}</div></div>
    </div>

    <a class="btn block ghost" href="#/reglages" style="margin-top:8px">⚙️ Réglages & sauvegarde</a>
  </div>`));
  $('#goPray', v).onclick = () => go('spirituel');
  $('#goTasks', v).onclick = () => go('planning');
}

/* ============================================================
   BUDGET  (3 caisses : Moi / Maman / Business)
   ============================================================ */
function renderBudget(v) {
  const m = monthOf(todayISO());
  const tx = monthTx(m).sort((a, b) => b.date.localeCompare(a.date));
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

    <div class="section-title">Charges fixes & revenus récurrents</div>
    <div class="card">
      <div class="row between"><span><b>Revenus</b> récurrents</span><b class="amt pos">${fmtDH(sumIncomes())}</b></div>
      ${DB.incomes.map(f => recurRow(f, 'incomes')).join('') || '<small>Aucun</small>'}
      <div class="divider"></div>
      <div class="row between"><span><b>Charges</b> fixes</span><b class="amt neg">${fmtDH(sumFixed())}</b></div>
      ${DB.fixed.map(f => recurRow(f, 'fixed')).join('') || '<small>Aucune</small>'}
      <div class="row" style="gap:8px;margin-top:10px">
        <button class="btn ghost sm" id="addInc">+ Revenu</button>
        <button class="btn ghost sm" id="addFix">+ Charge fixe</button>
      </div>
    </div>

    <div class="section-title">Dépenses par catégorie (ce mois)</div>
    <div class="card">
      ${cats.length ? cats.map(([c, n]) => `<div style="margin-bottom:10px"><div class="row between"><span>${escape(c)}</span><b>${fmtDH(n)}</b></div><div class="bar"><span style="width:${n / maxCat * 100}%"></span></div></div>`).join('') : '<div class="empty">Aucune dépense ce mois. Ajoute-en avec le bouton +.</div>'}
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
    ${field('Caisse', `<select id="f_acc">${options(ACCOUNTS, 'Moi')}</select>`)}
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
function recurModal(kind, id) {
  const list = DB[kind];
  const cur = id ? list.find(x => x.id === id) : { label: '', amount: 0, account: kind === 'incomes' ? 'Business' : 'Moi', cat: '' };
  const catList = kind === 'incomes' ? CATS.revenu : CATS.depense;
  const body = `
    ${field('Libellé', `<input id="r_lab" value="${escape(cur.label)}" placeholder="ex: Assurance voiture">`)}
    ${field('Montant / mois (DH)', `<input id="r_amt" type="number" inputmode="decimal" value="${cur.amount || ''}">`)}
    ${field('Caisse', `<select id="r_acc">${options(ACCOUNTS, cur.account)}</select>`)}
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

  v.append(el(`<div><h1>📅 Planning (7 jours)</h1>
    <div class="hint">Organise tournées (filtres), enfants, maman et moments de foi. Coche en fin de journée.</div>
    <div id="days"></div>
    <button class="btn fab" id="fab">＋</button>
  </div>`));
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
        <span class="grow"><div class="t" style="${t.done ? 'text-decoration:line-through;color:#94a3b8' : ''}">${escape(t.title)}</div></span>
        <button class="btn gray sm" data-del="${t.id}">✕</button></div>`);
      $('.check', it).onclick = () => { t.done = !t.done; save(); router(); };
      $('[data-del]', it).onclick = () => { DB.tasks = DB.tasks.filter(x => x.id !== t.id); save(); router(); };
      lc.append(it);
    });
    c.append(card);
  });
  $('#fab', v).onclick = () => taskModal(today);
}
function taskModal(date) {
  const cats = ['Business', 'Famille', 'Maman', 'Perso', 'Religion'];
  const body = `
    ${field('Tâche', '<input id="t_title" placeholder="ex: Tournée garages Sidi Kacem" autofocus>')}
    ${field('Catégorie', `<select id="t_cat">${options(cats)}</select>`)}
    ${field('Date', `<input id="t_date" type="date" value="${date}">`)}
    <div class="modal-actions"><button class="btn gray" id="cancel">Annuler</button><button class="btn" id="ok">Ajouter</button></div>`;
  const bg = modal('Nouvelle tâche', body);
  $('#cancel', bg).onclick = () => bg.remove();
  $('#ok', bg).onclick = () => {
    const title = $('#t_title', bg).value.trim(); if (!title) return;
    DB.tasks.push({ id: uid(), title, cat: $('#t_cat', bg).value, date: $('#t_date', bg).value, done: false });
    save(); bg.remove(); router();
  };
}

/* ============================================================
   FAMILLE  (enfants + maman)
   ============================================================ */
function renderFamille(v) {
  v.append(el(`<div><h1>👨‍👩‍👧 Famille</h1>
    <div class="section-title">Enfants — sorties & éducation</div>
    <div id="kids"></div>
    <button class="btn ghost block sm" id="addKid" style="margin-bottom:8px">+ Ajouter un enfant</button>

    <div class="section-title">👵 Maman (Alzheimer)</div>
    <div class="card">
      <div class="row between"><h3 style="margin:0">💊 Médicaments</h3><button class="btn ghost sm" id="addMed">+ Médicament</button></div>
      <div id="meds"></div>
    </div>
    <div class="card">
      <h3>📄 Dossier CNSS</h3>
      <div id="cnss"></div>
      <button class="btn ghost sm" id="addCnss" style="margin-top:8px">+ Étape</button>
    </div>
    <div class="card">
      <h3>📝 Notes / budget maman</h3>
      <textarea id="mNotes" placeholder="Revenu garage, dépenses médicaments...">${escape(DB.mother.notes)}</textarea>
      <button class="btn sm" id="saveNotes" style="margin-top:8px">Enregistrer</button>
    </div>
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

  // Meds
  const mc = $('#meds', v);
  if (!DB.mother.meds.length) mc.append(el('<small>Aucun médicament enregistré.</small>'));
  DB.mother.meds.forEach(med => {
    const row = el(`<div class="item"><span class="ic">💊</span><span class="grow"><div class="t">${escape(med.name)}</div><div class="s">${escape(med.schedule || '')}</div></span><button class="btn gray sm" data-x>✕</button></div>`);
    $('[data-x]', row).onclick = () => { DB.mother.meds = DB.mother.meds.filter(x => x !== med); save(); router(); };
    mc.append(row);
  });
  $('#addMed', v).onclick = () => {
    const bg = modal('Médicament', `${field('Nom', '<input id="m_n" autofocus>')}${field('Posologie / horaire', '<input id="m_s" placeholder="ex: 1 matin, 1 soir">')}<div class="modal-actions"><button class="btn" id="ok">Ajouter</button></div>`);
    $('#ok', bg).onclick = () => { const n = $('#m_n', bg).value.trim(); if (!n) return; DB.mother.meds.push({ name: n, schedule: $('#m_s', bg).value.trim() }); save(); bg.remove(); router(); };
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

/* ============================================================
   SPIRITUEL
   ============================================================ */
function renderSpirituel(v) {
  const t = todayISO();
  const done = DB.spiritual.prayers[t] || [];
  const sadaqaMonth = DB.spiritual.sadaqa.filter(s => monthOf(s.date) === monthOf(t)).reduce((a, s) => a + (+s.amount || 0), 0);
  const quranWeek = DB.spiritual.quran.slice(-7).reduce((a, q) => a + (+q.pages || 0), 0);

  v.append(el(`<div><h1>🕌 Spiritualité</h1>
    <div class="card">
      <h3>Prières d'aujourd'hui</h3>
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
      <div class="row between"><h3 style="margin:0">📖 Lecture du Coran</h3><button class="btn ghost sm" id="addQ">+ Aujourd'hui</button></div>
      <div id="qlist"></div>
    </div>

    <div class="card">
      <div class="row between"><h3 style="margin:0">🤲 Sadaqa</h3><button class="btn ghost sm" id="addS">+ Don</button></div>
      <div id="slist"></div>
    </div>
  </div>`));

  v.querySelectorAll('.pray').forEach(p => p.onclick = () => {
    const set = new Set(DB.spiritual.prayers[t] || []);
    set.has(p.dataset.p) ? set.delete(p.dataset.p) : set.add(p.dataset.p);
    DB.spiritual.prayers[t] = [...set]; save(); router();
  });

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
function renderProjets(v) {
  const sorted = DB.projects.slice().sort((a, b) => (a.priority || 9) - (b.priority || 9));
  v.append(el(`<div><h1>🎯 Projets de vie</h1>
    <div class="hint">Compare tes options sans pression. Donne une priorité à chacune, pèse le pour/contre, et décide quand tes chiffres budget sont clairs.</div>
    <div id="plist"></div>
    <button class="btn block ghost" id="addP">+ Nouveau projet</button>
  </div>`));
  const pc = $('#plist', v);
  sorted.forEach(p => {
    const st = STATUS[p.status] || STATUS.reflexion;
    const card = el(`<div class="card">
      <div class="row between"><h3 style="margin:0">${escape(p.title)}</h3><span class="chip ${st[1]}">${st[0]}</span></div>
      <div class="row" style="gap:8px;margin:6px 0"><span class="chip gray">Priorité ${p.priority}</span><span class="chip">${escape(p.type)}</span><span class="chip">${fmtDH(p.cost)}</span></div>
      <div class="grid2" style="gap:10px">
        <div><b style="color:var(--green)">✅ Pour</b>${(p.pros || []).map(x => `<div class="s" style="font-size:.82rem">• ${escape(x)}</div>`).join('') || '<div class="s">—</div>'}</div>
        <div><b style="color:var(--red)">⚠️ Contre</b>${(p.cons || []).map(x => `<div class="s" style="font-size:.82rem">• ${escape(x)}</div>`).join('') || '<div class="s">—</div>'}</div>
      </div>
      ${p.notes ? `<div class="hint" style="margin-top:10px">${escape(p.notes)}</div>` : ''}
      <div class="row" style="gap:8px;margin-top:10px"><button class="btn gray sm" data-edit>✎ Modifier</button><button class="btn gray sm" data-del>🗑</button></div>
    </div>`);
    $('[data-edit]', card).onclick = () => projModal(p.id);
    $('[data-del]', card).onclick = () => { if (confirm('Supprimer ce projet ?')) { DB.projects = DB.projects.filter(x => x.id !== p.id); save(); router(); } };
    pc.append(card);
  });
  $('#addP', v).onclick = () => projModal();
}
function projModal(id) {
  const cur = id ? DB.projects.find(p => p.id === id) : { title: '', type: 'Investissement', cost: 0, priority: DB.projects.length + 1, status: 'reflexion', pros: [], cons: [], notes: '' };
  const body = `
    ${field('Titre', `<input id="p_t" value="${escape(cur.title)}" autofocus>`)}
    <div class="grid2">${field('Type', `<select id="p_type">${options(['Logement', 'Investissement', 'Business', 'Personnel'], cur.type)}</select>`)}${field('Coût estimé (DH)', `<input id="p_c" type="number" value="${cur.cost || ''}">`)}</div>
    <div class="grid2">${field('Priorité (1=top)', `<input id="p_pr" type="number" value="${cur.priority || 1}">`)}${field('Statut', `<select id="p_st">${Object.entries(STATUS).map(([k, val]) => `<option value="${k}" ${cur.status === k ? 'selected' : ''}>${val[0]}</option>`).join('')}</select>`)}</div>
    ${field('Pour (une raison par ligne)', `<textarea id="p_pro">${(cur.pros || []).join('\n')}</textarea>`)}
    ${field('Contre (une raison par ligne)', `<textarea id="p_con">${(cur.cons || []).join('\n')}</textarea>`)}
    ${field('Notes', `<textarea id="p_n">${escape(cur.notes || '')}</textarea>`)}
    <div class="modal-actions"><button class="btn gray" id="cancel">Annuler</button><button class="btn" id="ok">Enregistrer</button></div>`;
  const bg = modal(id ? 'Modifier le projet' : 'Nouveau projet', body);
  $('#cancel', bg).onclick = () => bg.remove();
  $('#ok', bg).onclick = () => {
    const o = {
      title: $('#p_t', bg).value.trim() || '(sans titre)', type: $('#p_type', bg).value, cost: +$('#p_c', bg).value || 0,
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
      <h3>💾 Sauvegarde</h3>
      <p><small>Tes données restent sur cet appareil. Exporte un fichier pour les sauvegarder ou les transférer entre téléphone et ordinateur.</small></p>
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

  $('#saveProf', v).onclick = () => {
    DB.profile.name = $('#s_name', v).value.trim();
    DB.profile.ville = $('#s_ville', v).value.trim();
    DB.capital = +$('#s_cap', v).value || 0;
    save(); $('#saveProf', v).textContent = 'Enregistré ✓';
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
}

/* ============================================================
   INIT
   ============================================================ */
$('#todayDate').textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' });
router();
