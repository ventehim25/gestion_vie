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
    farm: {
      opening: { perso: 0, partage: 0 },
      trees: { me: 79, gm: 132 },
      sheep: { log: [] },
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
  out.reminder = Object.assign({}, s.reminder, d.reminder || {});
  out.mother = Object.assign({}, s.mother, d.mother || {});
  out.spiritual = Object.assign({}, s.spiritual, d.spiritual || {});
  const df = d.farm || {};
  out.farm = {
    opening: Object.assign({}, s.farm.opening, df.opening || {}),
    trees: Object.assign({}, s.farm.trees, df.trees || {}),
    sheep: Object.assign({}, s.farm.sheep, df.sheep || {}),
    tx: Array.isArray(df.tx) ? df.tx : s.farm.tx,
  };
  return out;
}
function persist(d = DB) { localStorage.setItem(KEY, JSON.stringify(d)); }
function save() { persist(); }

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

/* ============================================================
   ROUTER
   ============================================================ */
const routes = {
  '/': renderHome, 'budget': renderBudget, 'planning': renderPlanning,
  'famille': renderFamille, 'maman': renderMaman, 'ferme': renderFerme, 'spirituel': renderSpirituel, 'projets': renderProjets,
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
  const mSolde = mamanSolde();
  const fPerso = caisseSums('perso').solde;
  const fShare = treeSplit(caisseSums('partage').outs);
  const sheepBen = sheepStats().benefice;
  const saved = savingsTotal(), goal = +DB.savings.goal || 0;
  const owed = debtsTotal();
  const noTxToday = !DB.transactions.some(t => t.date === todayISO());
  const nowHM = new Date().toTimeString().slice(0, 5);
  const showReminder = DB.reminder.enabled && noTxToday && nowHM >= DB.reminder.time;
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

    <div class="section-title">Bilan du mois</div>
    <div class="grid2">
      <div class="stat"><div class="label">Entrées</div><div class="value pos">${fmtDH(tot.rev)}</div></div>
      <div class="stat"><div class="label">Sorties</div><div class="value neg">${fmtDH(tot.dep)}</div></div>
    </div>

    <a class="btn block ghost" href="#/reglages" style="margin-top:8px">⚙️ Réglages & sauvegarde</a>
  </div>`));
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
  v.querySelectorAll('#farmFilter button').forEach(b => b.onclick = () => { farmFilter = b.dataset.f; router(); });
  v.querySelectorAll('[data-del-farm]').forEach(b => b.onclick = () => { DB.farm.tx = DB.farm.tx.filter(t => t.id !== b.dataset.delFarm); save(); router(); });
  v.querySelectorAll('[data-open]').forEach(b => b.onclick = () => {
    const c = b.dataset.open;
    const bg = modal('Solde de départ — ' + FARM_CAISSES[c], `<p><small>Argent déjà présent dans cette caisse avant le suivi.</small></p>${field('Montant (DH)', `<input id="o_v" type="number" inputmode="decimal" value="${DB.farm.opening[c] || ''}">`)}<div class="modal-actions"><button class="btn" id="ok">Enregistrer</button></div>`);
    $('#ok', bg).onclick = () => { DB.farm.opening[c] = +$('#o_v', bg).value || 0; save(); bg.remove(); router(); };
  });

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
function farmOpModal() {
  let type = 'depense';
  const body = `
    <div class="seg" id="segType"><button data-t="depense" class="active">－ Dépense</button><button data-t="revenu">＋ Rentrée</button></div>
    ${field('Caisse', `<select id="f_caisse">${Object.entries(FARM_CAISSES).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>`)}
    <div class="hint" id="caisseHint" style="display:none">Caisse partagée = oliviers uniquement (réparti avec grand-mère).</div>
    ${field('Montant (DH)', '<input id="f_amt" type="number" inputmode="decimal" placeholder="0" autofocus>')}
    ${field('Motif', `<select id="f_cat">${options(FARM_CATS.depense)}</select>`)}
    ${field('Date', `<input id="f_date" type="date" value="${todayISO()}">`)}
    ${field('Note (optionnel)', '<input id="f_note" placeholder="ex: taille des oliviers">')}
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
      <h3>🌙 Rappel du soir</h3>
      <p><small>Te rappelle de noter tes dépenses chaque soir. Visible dans l'app ; aussi en notification système si tu l'autorises (quand l'app reste ouverte). Astuce : mets aussi une alarme sur ton téléphone après Icha.</small></p>
      <label class="field" style="display:flex;align-items:center;gap:10px"><input type="checkbox" id="rem_on" ${DB.reminder.enabled ? 'checked' : ''} style="width:auto;margin:0"> Activer le rappel</label>
      ${field('Heure', `<input id="rem_t" type="time" value="${DB.reminder.time}">`)}
      <button class="btn sm" id="saveRem">Enregistrer</button>
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
   INIT
   ============================================================ */
$('#todayDate').textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' });
router();
scheduleReminder();
