/* ------------------------------------------------------------------
   Zeig, was du kannst! – Renderer
   Vanilla JS, keine Frameworks. Volle Re-Render-Architektur:
   Ein zentraler state + render() baut den sichtbaren Bereich neu auf.
   Texteingaben committen per "change" (Blur/Enter), damit der Cursor
   beim Tippen nicht durch Re-Renders springt. Regler committen per
   "change", zeigen den Wert aber live per "input" an.
------------------------------------------------------------------ */

let cache = { meta: null, groups: [] };
let state = { view: "dashboard", groupId: null, tab: "anmeldung", student: 0 };

const phaseNames = ["", "Themenwahl & Wissensaneignung", "Durchführung", "Vorstellung des Produkts", "Reflexion"];
const ampelLabel = { gruen: "im Plan", gelb: "Beratung fällig", rot: "braucht Aufmerksamkeit" };

const LEITFRAGEN = [
  "Wie zufrieden bist du insgesamt mit eurem Projekt?",
  "Was ist euch besonders gut gelungen?",
  "Was war schwieriger als gedacht?",
  "Welche eigenen Ideen hast du eingebracht?",
  "Was würdest du beim nächsten Projekt anders machen?",
  "Wie lief die Kommunikation in der Gruppe?",
  "Was hast du in diesem Projekt gelernt?",
];
const IMPULSKARTEN = [
  "Ich bin stolz darauf, dass …", "Beim nächsten Projekt würde ich verändern …",
  "Die Zusammenarbeit in der Gruppe …", "Geholfen hat mir/uns, dass …",
  "Eine Herausforderung, die ich/wir meistern musste(n), war …", "Mir/uns ist schwer gefallen …",
];

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function findGroup(id) { return cache.groups.find((g) => g.id === id); }

/* ---------------- Boot ---------------- */
async function boot() {
  cache.meta = await window.zwdk.getMeta();
  document.getElementById("schuljahrPill").textContent = `Schuljahr ${cache.meta.schuljahr}`;
  document.getElementById("lehrkraftName").textContent = cache.meta.lehrkraft.name || "Lehrkraft";
  document.getElementById("schuleLabel").textContent = cache.meta.lehrkraft.schule || "Schule hinterlegen";
  document.getElementById("avatarInitials").textContent = (cache.meta.lehrkraft.name || "L").slice(0, 2).toUpperCase();
  document.getElementById("newGroupBtn").onclick = openNewGroupModal;
  await refreshGroups();
  render();
}
async function refreshGroups() { cache.groups = await window.zwdk.listGroups(); }

/* ---------------- Sidebar subnav ---------------- */
function renderSubnav() {
  const el = document.getElementById("groupSubnav");
  if (state.view !== "group" || !state.groupId) {
    el.innerHTML = '<div class="empty-hint" style="padding:4px 10px; color:#8f8f88;">Gruppe in der Übersicht auswählen</div>';
    return;
  }
  const g = findGroup(state.groupId);
  if (!g) { el.innerHTML = ""; return; }
  const tabs = [["anmeldung", "1 · Anmeldung"], ["durchfuehrung", "2 · Durchführung"], ["praesentation", "3 · Präsentation"], ["reflexion", "4 · Reflexion"], ["bewertung", "Bewertung & Bescheinigung"]];
  el.innerHTML =
    `<div style="padding:2px 10px 8px; font-size:12.5px; font-weight:700; color:#efefe9;">${esc(g.name)}</div>` +
    tabs.map(([id, label]) => `<div class="nav-item ${state.tab === id ? "active" : ""}" data-tab="${id}" style="padding-left:18px; font-size:12.5px;">${label}</div>`).join("");
}

/* ---------------- Dashboard ---------------- */
function renderDashboard() {
  const groups = cache.groups;
  const alertCount = groups.filter((g) => g.status.ampel === "rot").length;
  const warnCount = groups.filter((g) => g.status.ampel === "gelb").length;
  const doneCount = groups.filter((g) => g.status.phase === 4).length;
  return `
  <div class="view">
    <div class="page-head">
      <div><h1>Übersicht</h1><p>${cache.meta.lehrkraft.name ? esc(cache.meta.lehrkraft.name) + " · " : ""}Schuljahr ${cache.meta.schuljahr}</p></div>
    </div>
    <div class="stat-row">
      <div class="stat-card"><div class="n">${groups.length}</div><div class="l">Betreute Gruppen</div></div>
      <div class="stat-card alert"><div class="n">${alertCount}</div><div class="l">brauchen Aufmerksamkeit</div></div>
      <div class="stat-card warn"><div class="n">${warnCount}</div><div class="l">Beratungstermin fällig</div></div>
      <div class="stat-card"><div class="n">${doneCount}/${groups.length}</div><div class="l">in Reflexion / abgeschlossen</div></div>
    </div>
    <div class="card">
      <div class="card-head"><h3>Gruppen</h3><span style="font-size:12px;color:var(--ink-faint)">Klicken für Details</span></div>
      ${groups.length === 0 ? `<div style="padding:40px; text-align:center;" class="empty-hint">Noch keine Gruppen angelegt. Klicke oben rechts auf „+ Neue Gruppe“.</div>` : `
      <table class="glist">
        <thead><tr><th>Gruppe</th><th>Fach</th><th>Phase</th><th>Status</th><th>Letzte Aktivität</th><th></th></tr></thead>
        <tbody>
          ${groups.map((g) => `
          <tr class="grow" data-open="${g.id}">
            <td><div class="gname">${esc(g.name)}</div><div class="gmeta">${esc(g.members.join(", "))}</div></td>
            <td><span class="fach-pill">${esc(g.fach || "–")}</span></td>
            <td>
              <div class="steps">${[1, 2, 3, 4].map((i) => `<div class="step ${i < g.status.phase ? "done" : (i === g.status.phase ? "now" : "")}"></div>`).join("")}</div>
              <div class="gmeta" style="margin-top:5px;">${phaseNames[g.status.phase]}</div>
            </td>
            <td><span class="ampel ${g.status.ampel}"><span class="dot"></span>${ampelLabel[g.status.ampel]}</span></td>
            <td class="gmeta">vor ${g.status.letzteAktivitaetTage} Tag${g.status.letzteAktivitaetTage === 1 ? "" : "en"}</td>
            <td><span class="ms-del" data-delete-group="${g.id}" title="Gruppe löschen">✕</span></td>
          </tr>`).join("")}
        </tbody>
      </table>`}
    </div>
  </div>`;
}

/* ---------------- Gruppenprofil ---------------- */
function renderGroup() {
  const g = findGroup(state.groupId);
  if (!g) { state.view = "dashboard"; return renderDashboard(); }
  const initials = g.name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  return `
  <div class="view">
    <div class="gp-head">
      <div class="gp-title">
        <div class="gp-icon">${esc(initials)}</div>
        <div>
          <h1>${esc(g.name)}</h1>
          <div class="sub">${esc(g.fach || "kein Fach")} ${g.fachlehrkraft ? "· " + esc(g.fachlehrkraft) : ""} ${g.thema ? "· „" + esc(g.thema) + "“" : ""}</div>
          <div class="members">${g.members.map((m) => `<span class="member-chip">${esc(m)}</span>`).join("")}</div>
        </div>
      </div>
      <span class="ampel ${g.status.ampel}"><span class="dot"></span>${ampelLabel[g.status.ampel]}</span>
    </div>
    <div class="tabs">
      ${["anmeldung", "durchfuehrung", "praesentation", "reflexion", "bewertung"].map((id, i) => {
        const labels = { anmeldung: "Anmeldung", durchfuehrung: "Durchführung", praesentation: "Präsentation", reflexion: "Reflexion", bewertung: "Bewertung & Bescheinigung" };
        const num = id === "bewertung" ? "★" : i + 1;
        return `<div class="tab ${state.tab === id ? "active" : ""}" data-tab="${id}"><span class="tnum">${num}</span>${labels[id]}</div>`;
      }).join("")}
    </div>
    <div id="tabContent">${renderTab(g)}</div>
  </div>`;
}

function renderTab(g) {
  if (state.tab === "anmeldung") return tabAnmeldung(g);
  if (state.tab === "durchfuehrung") return tabDurchfuehrung(g);
  if (state.tab === "praesentation") return tabPraesentation(g);
  if (state.tab === "reflexion") return tabReflexion(g);
  if (state.tab === "bewertung") return tabBewertung(g);
  return "";
}

function tabAnmeldung(g) {
  const b = g.anmeldung.bewertung;
  const total = Object.values(b).reduce((a, v) => a + Number(v || 0), 0);
  return `
  <div class="grid2">
    <div class="card" style="padding:20px;">
      <div class="section-title">Projektangaben</div>
      <div class="field-row"><label>Titel des Projekts</label><input type="text" value="${esc(g.thema)}" data-field="thema"></div>
      <div class="field-row"><label>Geplantes Endprodukt</label><input type="text" value="${esc(g.produkt)}" data-field="produkt"></div>
      <div class="field-row"><label>Beschreibung in Stichpunkten</label><textarea data-field="anmeldung.beschreibung">${esc(g.anmeldung.beschreibung)}</textarea></div>
      <div class="section-title" style="margin-top:22px;">Meilensteine<span class="btn btn-ghost btn-sm" id="addMilestone">+ hinzufügen</span></div>
      ${g.anmeldung.meilensteine.length === 0 ? '<div class="empty-hint">Noch keine Meilensteine.</div>' : g.anmeldung.meilensteine.map((m, i) => `
        <div class="milestone">
          <div class="ms-row">
            <div class="msbox ${m.done ? "done" : ""}" data-toggle-ms="${i}">${m.done ? '<svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round"><path d="M5 13l4 4L19 7"/></svg>' : ""}</div>
            <div style="margin-left:10px;"><div class="ms-title ${m.done ? "strike" : ""}">${esc(m.titel)}</div><div class="ms-due">fällig: ${esc(m.due)}</div></div>
            <span class="ms-del" data-del-ms="${i}">✕</span>
          </div>
        </div>`).join("")}
    </div>
    <div class="card" style="padding:20px;">
      <div class="section-title">Bewertung Anmeldebogen <span style="color:var(--ink-faint); font-weight:500; text-transform:none;">(10 P)</span></div>
      ${critRow("Projektidee & Beschreibung", b.idee, 2, "anmeldung.bewertung.idee")}
      ${critRow("Vollständigkeit der Angaben", b.vollstaendigkeit, 2, "anmeldung.bewertung.vollstaendigkeit")}
      ${critRow("Verständlichkeit & Zuständigkeiten", b.struktur, 2, "anmeldung.bewertung.struktur")}
      ${critRow("Meilensteine / Zeitplanung", b.meilensteineP, 2, "anmeldung.bewertung.meilensteineP")}
      ${critRow("Sorgfalt & Sprache", b.sorgfalt, 2, "anmeldung.bewertung.sorgfalt")}
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:14px; padding-top:14px; border-top:1px solid var(--border);">
        <b style="font-size:13px;">Gesamt</b><b style="font-size:16px;">${total} / 10</b>
      </div>
    </div>
  </div>`;
}

function critRow(label, val, max, field, step = 0.5) {
  return `<div class="criterion" style="padding:10px 0;">
    <div class="crit-top"><span class="crit-name" style="font-size:12.5px;">${label}</span><span class="crit-pts">${val} / ${max}</span></div>
    <div class="slider-row">
      <input type="range" min="0" max="${max}" step="${step}" value="${val}" data-slider-field="${field}">
      <div class="slider-val">${val}</div>
    </div>
  </div>`;
}

function tabDurchfuehrung(g) {
  const pct = Math.min(100, Math.round((g.durchfuehrung.stunden / 8) * 100));
  const st = g.durchfuehrung.beratung.status;
  const meetCls = st === "ueberfaellig" ? "overdue" : (st === "erledigt" ? "planned" : "");
  return `
  <div class="grid2">
    <div class="card" style="padding:20px;">
      <div class="section-title">Protokoll · Arbeitstreffen <span class="btn btn-ghost btn-sm" id="addProtocol">+ Eintrag</span></div>
      ${g.durchfuehrung.protokoll.length === 0 ? '<div class="empty-hint">Noch keine Einträge.</div>' : g.durchfuehrung.protokoll.map((e, i) => `
        <div class="protocol-entry">
          <span class="pdel" data-del-protokoll="${i}">✕</span>
          <div class="pdate">${esc(e.datum)} · ${esc(e.wer)}</div>
          <div class="pwhat">${esc(e.was)}</div>
          <div class="pnote">${esc(e.notiz)}</div>
        </div>`).join("")}
    </div>
    <div>
      <div class="card" style="padding:20px; margin-bottom:16px;">
        <div class="section-title">Stunden (Minimum 8)</div>
        <div class="hourbar-wrap">
          <div class="hourbar"><div class="hourbar-fill" style="width:${pct}%;"></div></div>
          <input type="number" min="0" max="30" step="0.5" value="${g.durchfuehrung.stunden}" data-field="durchfuehrung.stunden" style="width:70px;">
        </div>
      </div>
      <div class="card" style="padding:20px;">
        <div class="section-title">Verbindlicher Beratungstermin</div>
        <div class="meet-card ${meetCls}">
          <div class="field-row"><label>Status</label>
            <select data-field="durchfuehrung.beratung.status">
              <option value="nicht_geplant" ${st === "nicht_geplant" ? "selected" : ""}>nicht geplant</option>
              <option value="geplant" ${st === "geplant" ? "selected" : ""}>geplant</option>
              <option value="erledigt" ${st === "erledigt" ? "selected" : ""}>erledigt</option>
              <option value="ueberfaellig" ${st === "ueberfaellig" ? "selected" : ""}>überfällig</option>
            </select>
          </div>
          <div class="field-row"><label>Datum</label><input type="text" placeholder="TT.MM.JJJJ" value="${esc(g.durchfuehrung.beratung.datum)}" data-field="durchfuehrung.beratung.datum"></div>
          <div class="field-row"><label>Notiz</label><textarea data-field="durchfuehrung.beratung.notiz">${esc(g.durchfuehrung.beratung.notiz)}</textarea></div>
        </div>
      </div>
    </div>
  </div>`;
}

function tabPraesentation(g) {
  const p = g.praesentation;
  const zwischensumme = p.sinnhaftigkeit + p.tiefe + p.richtigkeit + p.struktur + p.medien + p.kommunikation + p.verteilung;
  return `
  <div class="grid2">
    <div class="card" style="padding:20px;">
      <div class="section-title">Rahmen der Vorstellung</div>
      <div class="field-row"><label>Termin</label><input type="text" placeholder="TT.MM.JJJJ" value="${esc(p.termin)}" data-field="praesentation.termin"></div>
      <div class="field-row"><label>Ort</label><input type="text" value="${esc(p.ort)}" data-field="praesentation.ort"></div>
      <div class="field-row"><label>Zielgruppe</label><input type="text" value="${esc(p.zielgruppe)}" data-field="praesentation.zielgruppe"></div>
      <div class="section-title" style="margin-top:18px;">Produktpräsentation <span style="color:var(--ink-faint); font-weight:500; text-transform:none;">(15 P)</span></div>
      ${critRow2("Struktur & inhaltliche Darstellung", "Ziel, Vorgehen und Ergebnis werden verständlich dargestellt.", p.struktur, 4, "praesentation.struktur")}
      ${critRow2("Anschaulichkeit / Medieneinsatz", "Materialien und Visualisierungen unterstützen das Verständnis.", p.medien, 4, "praesentation.medien")}
      ${critRow2("Kommunikation & Auftreten", "Verständliches Sprechen, adressatengerechte Darstellung.", p.kommunikation, 3, "praesentation.kommunikation")}
      ${critRow2("Sinnvolle Verteilung in der Gruppe", "Jede/r beteiligt sich aktiv und übernimmt Verantwortung.", p.verteilung, 4, "praesentation.verteilung")}
    </div>
    <div class="card" style="padding:20px;">
      <div class="section-title">Fachliche Bewertung <span style="color:var(--ink-faint); font-weight:500; text-transform:none;">(10 P)</span></div>
      ${critRow2("Fachliche Sinnhaftigkeit", "Thema & Umsetzung passen klar zum Unterrichtsfach.", p.sinnhaftigkeit, 3, "praesentation.sinnhaftigkeit")}
      ${critRow2("Inhaltliche Tiefe", "Nachvollziehbare Bearbeitung mit fachlicher Tiefe.", p.tiefe, 3, "praesentation.tiefe")}
      ${critRow2("Fachliche Richtigkeit", "Die dargestellten Inhalte sind fachlich korrekt.", p.richtigkeit, 4, "praesentation.richtigkeit")}
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:14px; padding-top:14px; border-top:1px solid var(--border);">
        <b style="font-size:13px;">Zwischensumme</b><b style="font-size:16px;">${zwischensumme} / 25</b>
      </div>
      <div class="section-title" style="margin-top:18px;">Rückfragen – Notizen</div>
      <textarea data-field="praesentation.rueckfragenNotiz" style="min-height:80px;">${esc(p.rueckfragenNotiz)}</textarea>
    </div>
  </div>`;
}
function critRow2(name, desc, val, max, field) {
  return `<div class="criterion"><div class="crit-top"><span class="crit-name">${name}</span><span class="crit-pts">${val} / ${max}</span></div>
    <div class="crit-desc">${desc}</div>
    <div class="slider-row"><input type="range" min="0" max="${max}" step="1" value="${val}" data-slider-field="${field}"><div class="slider-val">${val}</div></div></div>`;
}

function tabReflexion(g) {
  const student = g.members[state.student] || g.members[0];
  if (!student) return `<div class="card" style="padding:40px; text-align:center;"><div class="empty-hint">Diese Gruppe hat noch keine Mitglieder.</div></div>`;
  const rec = g.reflexion[student] || {};
  const selbst = rec.selbst || {};
  const fremd = rec.fremd || {};
  const cats = [
    ["Produkt aus der Lebenswelt", [["ideenentwicklung", "Ideenentwicklung"], ["information", "Umgang mit Informationen"], ["struktur", "Struktur & Darstellung"]]],
    ["Projektorientiertes Arbeiten", [["projektorg", "Projektorganisation"]]],
    ["Kompetenzen des 21. Jh.", [["kreativitaet", "Kreativität"], ["kritisch", "Kritisches Denken"], ["kooperation", "Kooperation"], ["kommunikation", "Kommunikation"]]],
    ["Selbsteinschätzung", [["reflexion", "Reflexionsfähigkeit"]]],
  ];
  const jmn = (side, key, val) => `<div class="jmn-toggle" data-jmn-group="${side}.${key}">
      <span class="jmn-btn ${val === "ja" ? "sel-ja" : ""}" data-jmn-set="ja">ja</span>
      <span class="jmn-btn ${val === "mittel" ? "sel-mittel" : ""}" data-jmn-set="mittel">mittel</span>
      <span class="jmn-btn ${val === "nein" ? "sel-nein" : ""}" data-jmn-set="nein">nein</span>
    </div>`;
  return `
  <div class="student-switch">${g.members.map((m, i) => `<span class="stu-pill ${state.student === i ? "sel" : ""}" data-stu="${i}">${esc(m)}</span>`).join("")}</div>
  <div class="grid2" style="grid-template-columns:1fr 1fr;">
    <div class="card" style="padding:20px;">
      <div class="reflect-col-head"><div class="badge">S</div><b>Selbsteinschätzung – ${esc(student)}</b></div>
      ${cats.map(([cat, items]) => `<div class="cat-label">${cat}</div>${items.map(([k, l]) => `<div class="crit-item"><span>${l}</span>${jmn("selbst", k, selbst[k])}</div>`).join("")}`).join("")}
    </div>
    <div class="card" style="padding:20px;">
      <div class="reflect-col-head"><div class="badge" style="background:var(--yellow); color:var(--ink);">L</div><b>Fremdeinschätzung – Lehrkraft</b></div>
      ${cats.map(([cat, items]) => `<div class="cat-label">${cat}</div>${items.map(([k, l]) => `<div class="crit-item"><span>${l}</span>${jmn("fremd", k, fremd[k])}</div>`).join("")}`).join("")}
    </div>
  </div>
  <div class="grid2" style="margin-top:16px;">
    <div class="card" style="padding:20px;">
      <div class="section-title">Leitfragen fürs Gespräch</div>
      <div class="empty-hint" style="font-style:normal; color:var(--ink-soft); line-height:1.7;">${LEITFRAGEN.map((f) => "„" + f + "“").join("<br>")}</div>
    </div>
    <div class="card" style="padding:20px;">
      <div class="section-title">Impulskarten</div>
      <div class="impulse-grid">${IMPULSKARTEN.map((t) => `<div class="impulse-card">${t}</div>`).join("")}</div>
    </div>
  </div>
  <div class="card" style="padding:20px; margin-top:16px;">
    <div class="section-title">Gesprächsnotizen – ${esc(student)}</div>
    <div class="field-row"><label>Diese Stärken konnte ${esc(student.split(" ")[0])} zeigen</label><textarea data-refl-field="staerken">${esc(rec.staerken)}</textarea></div>
    <div class="field-row"><label>Diesen Tipp gebe ich mit</label><textarea data-refl-field="tipp">${esc(rec.tipp)}</textarea></div>
  </div>`;
}

function scoreFromJmn(obj) {
  const keys = ["ideenentwicklung", "information", "struktur", "projektorg", "kreativitaet", "kritisch", "kooperation", "kommunikation", "reflexion"];
  let sum = 0, counted = 0;
  for (const k of keys) {
    const v = obj?.[k];
    if (v === "ja") { sum += 1; counted++; }
    else if (v === "mittel") { sum += 0.5; counted++; }
    else if (v === "nein") { sum += 0; counted++; }
  }
  if (counted === 0) return 0;
  return Math.round((sum / keys.length) * 15 * 2) / 2; // auf 0.5 runden, unbeantwortete zählen als 0
}

function computeScores(g, student) {
  const b = g.anmeldung.bewertung;
  const anmeldung = Object.values(b).reduce((a, v) => a + Number(v || 0), 0);
  const p = g.praesentation;
  const fach = p.sinnhaftigkeit + p.tiefe + p.richtigkeit;
  const produkt = p.struktur + p.medien + p.kommunikation + p.verteilung;
  const rec = g.reflexion[student] || {};
  const reflexionSelbst = scoreFromJmn(rec.selbst);
  const reflexionFremd = scoreFromJmn(rec.fremd);
  const reflexion = Math.round(((reflexionSelbst + reflexionFremd) / 2) * 2) / 2;
  const gesamt = anmeldung + fach + produkt + reflexion;
  const pct = Math.round((gesamt / 50) * 100);
  const note = pct >= 92 ? 1 : pct >= 81 ? 2 : pct >= 67 ? 3 : pct >= 50 ? 4 : pct >= 30 ? 5 : 6;
  return { anmeldung, fach, produkt, reflexion, gesamt, pct, noteVorschlag: note };
}

function tabBewertung(g) {
  const student = g.members[state.student] || g.members[0];
  if (!student) return `<div class="card" style="padding:40px; text-align:center;"><div class="empty-hint">Diese Gruppe hat noch keine Mitglieder.</div></div>`;
  const scores = computeScores(g, student);
  const rec = g.reflexion[student] || {};
  const note = rec.note ?? scores.noteVorschlag;
  return `
  <div class="student-switch">${g.members.map((m, i) => `<span class="stu-pill ${state.student === i ? "sel" : ""}" data-stu="${i}">${esc(m)}</span>`).join("")}</div>
  <div class="grid2">
    <div class="card" style="padding:20px;">
      <div class="section-title">Punkteübersicht (50 P gesamt)</div>
      <div class="score-donut-wrap">
        <div class="grade-badge"><div class="g">${note}</div><div class="p">${scores.pct}%</div></div>
        <div class="score-bars">
          ${bar("Anmeldeformular", scores.anmeldung, 10)}
          ${bar("Fachlicher Teil (25% Fachnote)", scores.fach, 10)}
          ${bar("Produkt / Präsentation", scores.produkt, 15)}
          ${bar("Reflexion (30% Gesamtnote)", scores.reflexion, 15)}
        </div>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:16px; padding-top:14px; border-top:1px solid var(--border);">
        <b>Gesamt</b><b style="font-size:17px;">${scores.gesamt} / 50 P</b>
      </div>
      <div class="field-row" style="margin-top:14px;"><label>Note (Vorschlag: ${scores.noteVorschlag}) – anpassbar</label>
        <input type="number" min="1" max="6" step="1" value="${note}" data-refl-field="note" style="width:90px;">
      </div>
      <div class="field-row"><label>Begründung</label><textarea data-refl-field="begruendung">${esc(rec.begruendung)}</textarea></div>
    </div>
    <div class="cert-preview">
      <div class="cert-inner">
        <div style="font-size:11px; text-transform:uppercase; letter-spacing:.05em; color:var(--ink-faint); font-weight:700;">Bescheinigung – Vorschau</div>
        <h2>${esc(student)}</h2>
        <div class="cert-sub">Projekt „Zeig, was du kannst!“ ${g.thema ? "· " + esc(g.thema) : ""}</div>
        <div class="cert-line">Note</div>
        <div class="cert-value">${note} (${scores.gesamt} von 50 Punkten)</div>
        <div class="cert-line">Gezeigte Stärken</div>
        <div class="cert-strengths">${(rec.staerken || "").split(",").map((s) => s.trim()).filter(Boolean).map((s) => `<span class="strength-tag">${esc(s)}</span>`).join("") || '<span class="empty-hint">Noch keine Stärken in Phase 4 eingetragen.</span>'}</div>
        <button class="btn btn-yellow" style="margin-top:22px;" id="genCertBtn">Bescheinigung als PDF erzeugen</button>
      </div>
    </div>
  </div>`;
}
function bar(label, val, max) {
  const p = Math.round((val / max) * 100);
  return `<div class="sb-row"><div class="sb-top"><span>${label}</span><b>${val} / ${max}</b></div><div class="sb-track"><div class="sb-fill" style="width:${p}%;"></div></div></div>`;
}

/* ---------------- Modals ---------------- */
function openModal(html) {
  document.getElementById("modalBody").innerHTML = html;
  const bd = document.getElementById("modalBackdrop");
  bd.classList.add("open");
  bd.onclick = (e) => { if (e.target === bd) closeModal(); };
}
function closeModal() { document.getElementById("modalBackdrop").classList.remove("open"); }

function openNewGroupModal() {
  openModal(`
    <h2>Neue Gruppe anlegen</h2>
    <div class="field-row"><label>Gruppenname</label><input type="text" id="ngName" placeholder="z.B. Team RoboArm"></div>
    <div class="field-row"><label>Fach</label><input type="text" id="ngFach" placeholder="z.B. NWT"></div>
    <div class="field-row"><label>Fachlehrkraft</label><input type="text" id="ngFachlehrkraft"></div>
    <div class="field-row"><label>Thema</label><input type="text" id="ngThema"></div>
    <div class="field-row"><label>Geplantes Produkt</label><input type="text" id="ngProdukt"></div>
    <div class="field-row"><label>Mitglieder (Komma-getrennt)</label><input type="text" id="ngMembers" placeholder="Lena Bauer, Finn Weber, Mia Hoffmann"></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="ngCancel">Abbrechen</button>
      <button class="btn btn-primary" id="ngSave">Anlegen</button>
    </div>
  `);
  document.getElementById("ngCancel").onclick = closeModal;
  document.getElementById("ngSave").onclick = async () => {
    const name = document.getElementById("ngName").value.trim() || "Neue Gruppe";
    const members = document.getElementById("ngMembers").value.split(",").map((s) => s.trim()).filter(Boolean);
    const g = await window.zwdk.createGroup({
      name, fach: document.getElementById("ngFach").value.trim(),
      fachlehrkraft: document.getElementById("ngFachlehrkraft").value.trim(),
      thema: document.getElementById("ngThema").value.trim(),
      produkt: document.getElementById("ngProdukt").value.trim(),
      members,
    });
    closeModal();
    await refreshGroups();
    state.view = "group"; state.groupId = g.id; state.tab = "anmeldung"; state.student = 0;
    render();
  };
}

function openMilestoneModal() {
  openModal(`
    <h2>Meilenstein hinzufügen</h2>
    <div class="field-row"><label>Titel</label><input type="text" id="msTitel"></div>
    <div class="field-row"><label>Fällig bis</label><input type="text" id="msDue" placeholder="z.B. Herbstferien"></div>
    <div class="modal-actions"><button class="btn btn-ghost" id="msCancel">Abbrechen</button><button class="btn btn-primary" id="msSave">Hinzufügen</button></div>
  `);
  document.getElementById("msCancel").onclick = closeModal;
  document.getElementById("msSave").onclick = async () => {
    const g = findGroup(state.groupId);
    const list = [...g.anmeldung.meilensteine, { titel: document.getElementById("msTitel").value.trim() || "Neuer Meilenstein", due: document.getElementById("msDue").value.trim(), done: false }];
    await window.zwdk.updateGroup(g.id, { anmeldung: { meilensteine: list } });
    closeModal();
    await refreshGroups(); render();
  };
}

function openProtocolModal() {
  const today = new Date();
  const todayStr = `${String(today.getDate()).padStart(2, "0")}.${String(today.getMonth() + 1).padStart(2, "0")}.${today.getFullYear()}`;
  openModal(`
    <h2>Protokolleintrag hinzufügen</h2>
    <div class="field-row"><label>Datum</label><input type="text" id="peDatum" value="${todayStr}"></div>
    <div class="field-row"><label>Was wurde gemacht?</label><textarea id="peWas"></textarea></div>
    <div class="field-row"><label>Wer?</label><input type="text" id="peWer" placeholder="alle / Namen"></div>
    <div class="field-row"><label>Was hat geklappt / nicht?</label><textarea id="peNotiz"></textarea></div>
    <div class="modal-actions"><button class="btn btn-ghost" id="peCancel">Abbrechen</button><button class="btn btn-primary" id="peSave">Hinzufügen</button></div>
  `);
  document.getElementById("peCancel").onclick = closeModal;
  document.getElementById("peSave").onclick = async () => {
    const g = findGroup(state.groupId);
    const list = [...g.durchfuehrung.protokoll, {
      datum: document.getElementById("peDatum").value.trim() || todayStr,
      was: document.getElementById("peWas").value.trim(),
      wer: document.getElementById("peWer").value.trim() || "alle",
      notiz: document.getElementById("peNotiz").value.trim(),
    }];
    await window.zwdk.updateGroup(g.id, { durchfuehrung: { protokoll: list } });
    closeModal();
    await refreshGroups(); render();
  };
}

/* ---------------- Feldpfad-Utility ---------------- */
function setPath(obj, path, value) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    cur[parts[i]] = cur[parts[i]] || {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}
function patchFromPath(path, value) {
  const patch = {};
  setPath(patch, path, value);
  return patch;
}

/* ---------------- Router / Events ---------------- */
function render() {
  const content = document.getElementById("content");
  const crumb = document.getElementById("crumb");
  document.querySelectorAll(".nav-item[data-view]").forEach((n) => n.classList.toggle("active", n.dataset.view === state.view));

  if (state.view === "dashboard") { content.innerHTML = renderDashboard(); crumb.innerHTML = "Übersicht"; }
  else if (state.view === "group") {
    content.innerHTML = renderGroup();
    const g = findGroup(state.groupId);
    if (g) {
      const labels = { anmeldung: "Anmeldung", durchfuehrung: "Durchführung", praesentation: "Präsentation", reflexion: "Reflexion", bewertung: "Bewertung" };
      crumb.innerHTML = `Gruppen <span class="sep">/</span> <b>${esc(g.name)}</b> <span class="sep">/</span> ${labels[state.tab]}`;
    }
  }
  renderSubnav();
  bindEvents();
}

function bindEvents() {
  // Navigation
  document.querySelectorAll(".nav-item[data-view]").forEach((n) => (n.onclick = () => { state.view = n.dataset.view; render(); }));
  document.querySelectorAll("[data-tab]").forEach((n) => (n.onclick = () => { state.tab = n.dataset.tab; render(); }));
  document.querySelectorAll("[data-open]").forEach((n) => (n.onclick = (e) => {
    if (e.target.closest("[data-delete-group]")) return;
    state.view = "group"; state.groupId = n.dataset.open; state.tab = "anmeldung"; state.student = 0; render();
  }));
  document.querySelectorAll("[data-delete-group]").forEach((n) => (n.onclick = async (e) => {
    e.stopPropagation();
    if (!confirm("Diese Gruppe inklusive aller Daten wirklich löschen?")) return;
    await window.zwdk.deleteGroup(n.dataset.deleteGroup);
    await refreshGroups(); render();
  }));
  document.querySelectorAll("[data-stu]").forEach((n) => (n.onclick = () => { state.student = parseInt(n.dataset.stu); render(); }));

  // Modals
  const addMs = document.getElementById("addMilestone"); if (addMs) addMs.onclick = openMilestoneModal;
  const delMs = document.querySelectorAll("[data-del-ms]");
  delMs.forEach((n) => (n.onclick = async () => {
    const g = findGroup(state.groupId);
    const list = g.anmeldung.meilensteine.filter((_, i) => i !== parseInt(n.dataset.delMs));
    await window.zwdk.updateGroup(g.id, { anmeldung: { meilensteine: list } });
    await refreshGroups(); render();
  }));
  document.querySelectorAll("[data-toggle-ms]").forEach((n) => (n.onclick = async () => {
    const g = findGroup(state.groupId);
    const idx = parseInt(n.dataset.toggleMs);
    const list = g.anmeldung.meilensteine.map((m, i) => (i === idx ? { ...m, done: !m.done } : m));
    await window.zwdk.updateGroup(g.id, { anmeldung: { meilensteine: list } });
    await refreshGroups(); render();
  }));

  const addProto = document.getElementById("addProtocol"); if (addProto) addProto.onclick = openProtocolModal;
  document.querySelectorAll("[data-del-protokoll]").forEach((n) => (n.onclick = async () => {
    const g = findGroup(state.groupId);
    const list = g.durchfuehrung.protokoll.filter((_, i) => i !== parseInt(n.dataset.delProtokoll));
    await window.zwdk.updateGroup(g.id, { durchfuehrung: { protokoll: list } });
    await refreshGroups(); render();
  }));

  // Committing Textfelder / Selects (onchange = blur/enter, kein Re-Render pro Tastenanschlag)
  document.querySelectorAll("[data-field]").forEach((n) => (n.onchange = async () => {
    const g = findGroup(state.groupId);
    const val = n.type === "number" ? parseFloat(n.value || "0") : n.value;
    const patch = patchFromPath(n.dataset.field, val);
    await window.zwdk.updateGroup(g.id, patch);
    await refreshGroups(); render();
  }));

  // Regler: Live-Anzeige per input, Commit per change
  document.querySelectorAll("[data-slider-field]").forEach((n) => {
    n.oninput = () => { n.parentElement.querySelector(".slider-val").textContent = n.value; };
    n.onchange = async () => {
      const g = findGroup(state.groupId);
      const patch = patchFromPath(n.dataset.sliderField, parseFloat(n.value));
      await window.zwdk.updateGroup(g.id, patch);
      await refreshGroups(); render();
    };
  });

  // Reflexions-/Bewertungsfelder (pro Schüler:in)
  document.querySelectorAll("[data-refl-field]").forEach((n) => (n.onchange = async () => {
    const g = findGroup(state.groupId);
    const student = g.members[state.student];
    const val = n.type === "number" ? parseFloat(n.value || "0") : n.value;
    const rec = { ...(g.reflexion[student] || {}), [n.dataset.reflField]: val };
    await window.zwdk.updateGroup(g.id, { reflexion: { [student]: rec } });
    await refreshGroups(); render();
  }));

  // Ja/Mittel/Nein Toggles
  document.querySelectorAll("[data-jmn-group]").forEach((group) => {
    group.querySelectorAll("[data-jmn-set]").forEach((btn) => (btn.onclick = async () => {
      const g = findGroup(state.groupId);
      const student = g.members[state.student];
      const [side, key] = group.dataset.jmnGroup.split(".");
      const current = (g.reflexion[student] || {})[side] || {};
      const newVal = current[key] === btn.dataset.jmnSet ? "" : btn.dataset.jmnSet; // erneutes Klicken hebt Auswahl auf
      const rec = { ...(g.reflexion[student] || {}) };
      rec[side] = { ...current, [key]: newVal };
      await window.zwdk.updateGroup(g.id, { reflexion: { [student]: rec } });
      await refreshGroups(); render();
    }));
  });

  // Bescheinigung erzeugen
  const genCert = document.getElementById("genCertBtn");
  if (genCert) genCert.onclick = async () => {
    const g = findGroup(state.groupId);
    const student = g.members[state.student];
    const scores = computeScores(g, student);
    const rec = g.reflexion[student] || {};
    const note = rec.note ?? scores.noteVorschlag;
    const today = new Date();
    const datum = `${String(today.getDate()).padStart(2, "0")}.${String(today.getMonth() + 1).padStart(2, "0")}.${today.getFullYear()}`;
    await window.zwdk.generateCertificate({
      schule: cache.meta.lehrkraft.schule || "",
      schueler: student,
      titel: g.thema,
      staerken: rec.staerken || "",
      note,
      punkte: { anmeldung: scores.anmeldung, fach: scores.fach, produkt: scores.produkt, reflexion: scores.reflexion, gesamt: scores.gesamt },
      lehrkraft: cache.meta.lehrkraft.name || "",
      datum,
    });
  };
}

boot();
