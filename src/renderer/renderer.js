/* ------------------------------------------------------------------
   Zeig, was du kannst! – Renderer
   Vanilla JS, keine Frameworks. Volle Re-Render-Architektur:
   Ein zentraler state + render() baut den sichtbaren Bereich neu auf.
   Texteingaben committen per "change" (Blur/Enter), damit der Cursor
   beim Tippen nicht durch Re-Renders springt. Regler committen per
   "change", zeigen den Wert aber live per "input" an.
------------------------------------------------------------------ */

let cache = { meta: null, groups: [], zertifikat: null, katalog: [] };
let state = { view: "dashboard", groupId: null, tab: "anmeldung", student: 0 };

const phaseNames = ["", "Themenwahl & Wissensaneignung", "Durchführung", "Vorstellung des Produkts", "Reflexion"];
const ampelLabel = { gruen: "im Plan", gelb: "Beratung fällig", rot: "braucht Aufmerksamkeit" };
const PHASE_LABEL = { anmeldung: "Anmeldung", praesentation: "Präsentation", reflexion: "Reflexion" };

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

// Vordefinierte Stärken-Kategorien + Textbausteine, die zu einem
// flüssigen Fließtext für die Bescheinigung zusammengesetzt werden.
const STAERKEN_KATALOG = [
  "Kreativität", "Teamarbeit", "Selbstständigkeit", "Sorgfalt", "Kommunikation",
  "Problemlösefähigkeit", "Fachliches Verständnis", "Präsentationsfähigkeit",
  "Ausdauer", "Verantwortungsbewusstsein",
];
const STAERKEN_BAUSTEINE = {
  "Kreativität": "eigene, kreative Ideen in die Umsetzung eingebracht",
  "Teamarbeit": "im Team zuverlässig und kooperativ mitgearbeitet",
  "Selbstständigkeit": "die Aufgaben weitgehend selbstständig organisiert und bearbeitet",
  "Sorgfalt": "sorgfältig und gewissenhaft gearbeitet",
  "Kommunikation": "sich klar und überzeugend ausgedrückt",
  "Problemlösefähigkeit": "auftretende Probleme eigenständig und lösungsorientiert angegangen",
  "Fachliches Verständnis": "ein fundiertes fachliches Verständnis gezeigt",
  "Präsentationsfähigkeit": "das Ergebnis überzeugend und anschaulich präsentiert",
  "Ausdauer": "auch bei Herausforderungen drangeblieben und durchgehalten",
  "Verantwortungsbewusstsein": "Verantwortung für die eigenen Aufgaben übernommen",
};

// Selbst-/Fremdeinschätzung (Reflexion) -> positive Formulierung je Kompetenz.
// Nur "ja"/"mittel" fließen ein, "nein" wird bewusst nicht erwähnt, damit der
// Bescheinigungstext durchgehend positiv bleibt.
const JMN_BAUSTEINE = {
  ideenentwicklung: "eigene Ideen in die Produktentwicklung eingebracht",
  information: "Informationen sinnvoll recherchiert und genutzt",
  struktur: "die Ergebnisse klar strukturiert dargestellt",
  projektorg: "das Projekt gut organisiert",
  kreativitaet: "kreative Lösungsansätze gefunden",
  kritisch: "kritisch und reflektiert gedacht",
  kooperation: "gut im Team zusammengearbeitet",
  kommunikation: "sich klar und verständlich ausgedrückt",
  reflexion: "das eigene Vorgehen reflektiert",
};
// Präsentationsbewertung -> nur gut bis sehr gut bewertete Aspekte (>= 75 % der
// erreichbaren Punktzahl) fließen als positive Erwähnung mit ein.
const PRAESENTATION_BAUSTEINE = {
  struktur: { label: "die Präsentation klar strukturiert aufgebaut", max: 4 },
  medien: { label: "Medien anschaulich eingesetzt", max: 4 },
  kommunikation: { label: "sicher und verständlich kommuniziert", max: 3 },
  verteilung: { label: "sich aktiv und verantwortungsbewusst eingebracht", max: 4 },
  sinnhaftigkeit: { label: "einen klaren fachlichen Bezug hergestellt", max: 3 },
  tiefe: { label: "das Thema inhaltlich vertieft bearbeitet", max: 3 },
  richtigkeit: { label: "die Inhalte fachlich korrekt dargestellt", max: 4 },
};

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function findGroup(id) { return cache.groups.find((g) => g.id === id); }
function formatNote(n) { return n === undefined || n === null || n === "" ? "" : String(n).replace(".", ","); }
function gradeBadgeClass(note) {
  const n = Number(note);
  if (!isFinite(n)) return "";
  if (n <= 2.5) return "top";
  if (n <= 4) return "mid";
  return "low";
}
// Kombiniert Stärken-Chips + Freitext, positiv bewertete Aspekte aus der
// Selbst-/Fremdeinschätzung, gut bewertete Präsentationskriterien und optional
// den Tipp (nur falls die Lehrkraft ihn explizit für die Bescheinigung
// freigegeben hat) zu einem zusammenhängenden, durchgehend positiven Fließtext.
function buildVollstaendigenFliesstext(g, student) {
  const rec = g.reflexion[student] || {};
  const vorname = (student || "").split(" ")[0];
  const teile = [];

  (rec.staerkenAuswahl || []).forEach((s) => { if (STAERKEN_BAUSTEINE[s]) teile.push(STAERKEN_BAUSTEINE[s]); });
  (rec.staerken || "").split(",").map((s) => s.trim()).filter(Boolean).forEach((s) => teile.push(s));

  const selbst = rec.selbst || {};
  const fremd = rec.fremd || {};
  Object.keys(JMN_BAUSTEINE).forEach((k) => {
    const positiv = selbst[k] === "ja" || selbst[k] === "mittel" || fremd[k] === "ja" || fremd[k] === "mittel";
    if (positiv) teile.push(JMN_BAUSTEINE[k]);
  });

  const pRec = (g.praesentation.bewertungProSchueler || {})[student] || {};
  Object.entries(PRAESENTATION_BAUSTEINE).forEach(([k, info]) => {
    const val = Number(pRec[k] || 0);
    if (info.max > 0 && val / info.max >= 0.75) teile.push(info.label);
  });

  const eindeutig = Array.from(new Set(teile));

  let satz = "";
  if (eindeutig.length > 0) {
    const liste = eindeutig.length === 1 ? eindeutig[0] : eindeutig.slice(0, -1).join(", ") + " und " + eindeutig[eindeutig.length - 1];
    satz = `${vorname} hat im Projekt vor allem ${liste} gezeigt.`;
  }

  if (rec.tippInBescheinigung && rec.tipp && rec.tipp.trim()) {
    satz += (satz ? " " : "") + `Als Impuls für die Weiterentwicklung: ${rec.tipp.trim()}`;
  }

  return satz;
}

/* ---------------- Kriterienkatalog: Hilfsfunktionen ---------------- */
function activeKriterien(g, phase, katalog) {
  const ids = new Set((g.aktivKriterien && g.aktivKriterien[phase]) || []);
  return (katalog || []).filter((k) => k.phase === phase && ids.has(k.id));
}
function zusatzScore(rec, list) {
  const z = (rec && rec.zusatz) || {};
  let sum = 0, max = 0;
  for (const k of list) { sum += Number(z[k.id] || 0); max += Number(k.max || 0); }
  return { sum, max };
}

/* ---------------- Boot ---------------- */
async function boot() {
  try {
    if (!window.zwdk) throw new Error("Die Verbindung zum Programm-Kern (zwdk) wurde nicht geladen. Preload-Skript prüfen.");
    cache.meta = await window.zwdk.getMeta();
    cache.zertifikat = await window.zwdk.getZertifikatSettings();
    cache.katalog = await window.zwdk.listKriterien();
    renderMetaLabels();
    document.getElementById("newGroupBtn").onclick = () => openGroupFormModal(null);
    const sidebarFoot = document.getElementById("sidebarFoot");
    if (sidebarFoot) sidebarFoot.onclick = openSettingsModal;
    await refreshGroups();
    render();
  } catch (err) {
    console.error("Fehler beim Start:", err);
    document.getElementById("content").innerHTML = `
      <div class="card" style="padding:24px; border-color:var(--red);">
        <div class="section-title" style="color:var(--red);">Fehler beim Laden</div>
        <p style="font-size:13px; color:var(--ink-soft);">Die App konnte nicht korrekt starten. Fehlermeldung:</p>
        <pre style="white-space:pre-wrap; background:var(--bg); border-radius:8px; padding:10px; font-size:12px;">${esc(String((err && err.stack) || err))}</pre>
      </div>`;
  }
}

function renderMetaLabels() {
  document.getElementById("schuljahrPill").textContent = `Schuljahr ${cache.meta.schuljahr}`;
  document.getElementById("lehrkraftName").textContent = cache.meta.lehrkraft.name || "Lehrkraft";
  document.getElementById("schuleLabel").textContent = cache.meta.lehrkraft.schule || "Schule hinterlegen";
  document.getElementById("avatarInitials").textContent = (cache.meta.lehrkraft.name || "L").slice(0, 2).toUpperCase();
}
async function refreshGroups() { cache.groups = await window.zwdk.listGroups(); }
async function refreshKatalog() { cache.katalog = await window.zwdk.listKriterien(); }

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
  const groups = cache.groups.filter((g) => !g.archived);
  const archivedCount = cache.groups.filter((g) => g.archived).length;
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
      ${groups.length === 0 ? `<div style="padding:40px; text-align:center;" class="empty-hint">Noch keine Gruppen angelegt. Klicke oben rechts auf „+ Neue Gruppe".</div>` : `
      <table class="glist">
        <thead><tr><th>Gruppe</th><th>Fach</th><th>Phase</th><th>Status</th><th>Abgabe</th><th></th></tr></thead>
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
            <td class="gmeta">${abgabeText(g.status)}</td>
            <td><span class="ms-del" data-delete-group="${g.id}" title="Gruppe löschen">✕</span></td>
          </tr>`).join("")}
        </tbody>
      </table>`}
      ${archivedCount > 0 ? `<div style="padding:12px 18px; border-top:1px solid var(--border);"><span data-view-link="archiv" style="cursor:pointer; font-size:12.5px; color:var(--ink-soft); text-decoration:underline;">Archiv ansehen (${archivedCount})</span></div>` : ""}
    </div>
  </div>`;
}

function abgabeText(status) {
  if (status.tageBisAbgabe === null || status.tageBisAbgabe === undefined) return "kein Termin";
  if (status.tageBisAbgabe < 0) return "Termin überschritten";
  if (status.tageBisAbgabe === 0) return "heute fällig";
  return `noch ${status.tageBisAbgabe} Tag${status.tageBisAbgabe === 1 ? "" : "e"}`;
}

/* ---------------- Archiv ---------------- */
function renderArchiv() {
  const groups = cache.groups.filter((g) => g.archived);
  return `
  <div class="view">
    <div class="page-head">
      <div><h1>Archiv</h1><p>Abgeschlossene Gruppen aus vergangenen Schuljahren</p></div>
    </div>
    <div class="card">
      <div class="card-head"><h3>Archivierte Gruppen</h3></div>
      ${groups.length === 0 ? `<div style="padding:40px; text-align:center;" class="empty-hint">Noch keine Gruppen archiviert.</div>` : `
      <table class="glist">
        <thead><tr><th>Gruppe</th><th>Fach</th><th>Note(n)</th><th></th></tr></thead>
        <tbody>
          ${groups.map((g) => `
          <tr class="grow" data-open="${g.id}">
            <td><div class="gname">${esc(g.name)}</div><div class="gmeta">${esc(g.members.join(", "))}</div></td>
            <td><span class="fach-pill">${esc(g.fach || "–")}</span></td>
            <td class="gmeta">${g.members.map((m) => formatNote((g.reflexion[m] || {}).note)).filter(Boolean).join(", ") || "–"}</td>
            <td>
              <span class="ms-del" data-restore-group="${g.id}" title="Aus Archiv zurückholen">↺</span>
              <span class="ms-del" data-delete-group="${g.id}" title="Endgültig löschen">✕</span>
            </td>
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
      <div class="gp-actions">
        <button class="btn btn-ghost btn-sm" id="editGroupBtn">Bearbeiten</button>
        <button class="btn btn-ghost btn-sm" id="archiveGroupBtn">${g.archived ? "Aus Archiv zurückholen" : "Archivieren"}</button>
        ${g.status.tageBisAbgabe !== null && g.status.tageBisAbgabe !== undefined ? `<span class="fach-pill">${abgabeText(g.status)}</span>` : ""}
        <span class="ampel ${g.status.ampel}"><span class="dot"></span>${ampelLabel[g.status.ampel]}</span>
      </div>
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

/* ---------------- Gemeinsame Bausteine: Schüler-Bewertung ---------------- */
function critRowStu(phase, label, val, max, key, step = 0.5, desc = "") {
  return `<div class="criterion" style="padding:10px 0;">
    <div class="crit-top"><span class="crit-name" style="font-size:12.5px;">${esc(label)}</span><span class="crit-pts">${val} / ${max}</span></div>
    ${desc ? `<div class="crit-desc">${desc}</div>` : ""}
    <div class="slider-row">
      <input type="range" min="0" max="${max}" step="${step}" value="${val}" data-stu-slider-field="${phase}|${key}">
      <div class="slider-val">${val}</div>
    </div>
  </div>`;
}

function renderKriterienManager(phase, g, katalog) {
  const active = new Set((g.aktivKriterien && g.aktivKriterien[phase]) || []);
  const phaseKrit = (katalog || []).filter((k) => k.phase === phase);
  return `
  <div class="section-title" style="margin-top:20px;">Eigene Bewertungsaspekte<span class="btn btn-ghost btn-sm" data-add-kriterium="${phase}">+ Kriterium hinzufügen</span></div>
  ${phaseKrit.length === 0 ? '<div class="empty-hint">Noch keine eigenen Kriterien angelegt. Über „+ Kriterium hinzufügen" kannst du welche anlegen – sie stehen dann bei allen Gruppen zur Auswahl.</div>' : `
  <div class="staerken-chips">${phaseKrit.map((k) => `
    <span class="staerke-chip kriterium-chip ${active.has(k.id) ? "sel" : ""}" data-toggle-kriterium="${phase}|${k.id}">
      ${esc(k.name)} (${k.max} P)
      <span class="kriterium-del" data-del-kriterium="${k.id}" title="Kriterium endgültig löschen">✕</span>
    </span>`).join("")}</div>`}
  `;
}

function tabAnmeldung(g) {
  const katalog = cache.katalog;
  const student = g.members[state.student] || g.members[0];
  const rec = (g.anmeldung.bewertungProSchueler || {})[student] || {};
  const aKrit = activeKriterien(g, "anmeldung", katalog);
  const fixedKeys = [
    ["idee", "Projektidee & Beschreibung", 2],
    ["vollstaendigkeit", "Vollständigkeit der Angaben", 2],
    ["struktur", "Verständlichkeit & Zuständigkeiten", 2],
    ["meilensteineP", "Meilensteine / Zeitplanung", 2],
    ["sorgfalt", "Sorgfalt & Sprache", 2],
  ];
  const fixedTotal = fixedKeys.reduce((s, [k]) => s + Number(rec[k] || 0), 0);
  const zusatz = zusatzScore(rec, aKrit);
  const total = fixedTotal + zusatz.sum;
  const max = 10 + zusatz.max;
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
      <div class="student-switch" style="margin-bottom:14px;">${g.members.map((m, i) => `<span class="stu-pill ${state.student === i ? "sel" : ""}" data-stu="${i}">${esc(m)}</span>`).join("")}</div>
      <div class="section-title">Bewertung Anmeldebogen – ${esc(student || "")} <span style="color:var(--ink-faint); font-weight:500; text-transform:none;">(${max} P)</span></div>
      ${fixedKeys.map(([key, label, kmax]) => critRowStu("anmeldung", label, rec[key] || 0, kmax, key)).join("")}
      ${aKrit.map((k) => critRowStu("anmeldung", k.name, (rec.zusatz || {})[k.id] || 0, k.max, "zusatz." + k.id, k.max <= 3 ? 0.5 : 1)).join("")}
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:14px; padding-top:14px; border-top:1px solid var(--border);">
        <b style="font-size:13px;">Gesamt – ${esc(student || "")}</b><b style="font-size:16px;">${total} / ${max}</b>
      </div>
      ${renderKriterienManager("anmeldung", g, katalog)}
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
  const katalog = cache.katalog;
  const p = g.praesentation;
  const student = g.members[state.student] || g.members[0];
  const rec = (p.bewertungProSchueler || {})[student] || {};
  const pKrit = activeKriterien(g, "praesentation", katalog);
  const produktFixed = ["struktur", "medien", "kommunikation", "verteilung"].reduce((s, k) => s + Number(rec[k] || 0), 0);
  const zusatz = zusatzScore(rec, pKrit);
  const produkt = produktFixed + zusatz.sum;
  const produktMax = 15 + zusatz.max;
  const fach = ["sinnhaftigkeit", "tiefe", "richtigkeit"].reduce((s, k) => s + Number(rec[k] || 0), 0);
  const fachMax = 10;
  return `
  <div class="grid2">
    <div class="card" style="padding:20px;">
      <div class="section-title">Rahmen der Vorstellung</div>
      <div class="field-row"><label>Termin</label><input type="text" placeholder="TT.MM.JJJJ" value="${esc(p.termin)}" data-field="praesentation.termin"></div>
      <div class="field-row"><label>Ort</label><input type="text" value="${esc(p.ort)}" data-field="praesentation.ort"></div>
      <div class="field-row"><label>Zielgruppe</label><input type="text" value="${esc(p.zielgruppe)}" data-field="praesentation.zielgruppe"></div>
      <div class="section-title" style="margin-top:18px;">Rückfragen – Notizen</div>
      <textarea data-field="praesentation.rueckfragenNotiz" style="min-height:80px;">${esc(p.rueckfragenNotiz)}</textarea>
    </div>
    <div>
      <div class="card" style="padding:20px; margin-bottom:16px;">
        <div class="student-switch" style="margin-bottom:14px;">${g.members.map((m, i) => `<span class="stu-pill ${state.student === i ? "sel" : ""}" data-stu="${i}">${esc(m)}</span>`).join("")}</div>
        <div class="section-title">Produktpräsentation – ${esc(student || "")} <span style="color:var(--ink-faint); font-weight:500; text-transform:none;">(${produktMax} P)</span></div>
        ${critRowStu("praesentation", "Struktur & inhaltliche Darstellung", rec.struktur || 0, 4, "struktur", 1, "Ziel, Vorgehen und Ergebnis werden verständlich dargestellt.")}
        ${critRowStu("praesentation", "Anschaulichkeit / Medieneinsatz", rec.medien || 0, 4, "medien", 1, "Materialien und Visualisierungen unterstützen das Verständnis.")}
        ${critRowStu("praesentation", "Kommunikation & Auftreten", rec.kommunikation || 0, 3, "kommunikation", 1, "Verständliches Sprechen, adressatengerechte Darstellung.")}
        ${critRowStu("praesentation", "Sinnvolle Verteilung in der Gruppe", rec.verteilung || 0, 4, "verteilung", 1, "Jede/r beteiligt sich aktiv und übernimmt Verantwortung.")}
        ${pKrit.map((k) => critRowStu("praesentation", k.name, (rec.zusatz || {})[k.id] || 0, k.max, "zusatz." + k.id, k.max <= 3 ? 0.5 : 1)).join("")}
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:14px; padding-top:14px; border-top:1px solid var(--border);">
          <b style="font-size:13px;">Zwischensumme</b><b style="font-size:16px;">${produkt} / ${produktMax}</b>
        </div>
        ${renderKriterienManager("praesentation", g, katalog)}
      </div>
      <div class="card" style="padding:20px;">
        <div class="section-title">Fachliche Bewertung – ${esc(student || "")} <span style="color:var(--ink-faint); font-weight:500; text-transform:none;">(${fachMax} P)</span></div>
        ${critRowStu("praesentation", "Fachliche Sinnhaftigkeit", rec.sinnhaftigkeit || 0, 3, "sinnhaftigkeit", 1, "Thema & Umsetzung passen klar zum Unterrichtsfach.")}
        ${critRowStu("praesentation", "Inhaltliche Tiefe", rec.tiefe || 0, 3, "tiefe", 1, "Nachvollziehbare Bearbeitung mit fachlicher Tiefe.")}
        ${critRowStu("praesentation", "Fachliche Richtigkeit", rec.richtigkeit || 0, 4, "richtigkeit", 1, "Die dargestellten Inhalte sind fachlich korrekt.")}
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:14px; padding-top:14px; border-top:1px solid var(--border);">
          <b style="font-size:13px;">Zwischensumme</b><b style="font-size:16px;">${fach} / ${fachMax}</b>
        </div>
      </div>
    </div>
  </div>`;
}

function tabReflexion(g) {
  const katalog = cache.katalog;
  const student = g.members[state.student] || g.members[0];
  if (!student) return `<div class="card" style="padding:40px; text-align:center;"><div class="empty-hint">Diese Gruppe hat noch keine Mitglieder.</div></div>`;
  const rec = g.reflexion[student] || {};
  const selbst = rec.selbst || {};
  const fremd = rec.fremd || {};
  const auswahl = rec.staerkenAuswahl || [];
  const rKrit = activeKriterien(g, "reflexion", katalog);
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
    <div class="field-row"><label>Diesen Tipp gebe ich mit</label><textarea data-refl-field="tipp">${esc(rec.tipp)}</textarea></div>
    <label style="display:flex; align-items:center; gap:8px; font-size:12.5px; color:var(--ink-soft); font-weight:600; cursor:pointer;">
      <input type="checkbox" data-refl-field="tippInBescheinigung" ${rec.tippInBescheinigung ? "checked" : ""} style="width:auto;">
      In Bescheinigung aufnehmen (positiv umformuliert als Entwicklungsimpuls)
    </label>
  </div>
  ${rKrit.length > 0 ? `
  <div class="card" style="padding:20px; margin-top:16px;">
    <div class="section-title">Zusätzliche Bewertungskriterien – ${esc(student)}</div>
    ${rKrit.map((k) => critRowStu("reflexion", k.name, (rec.zusatz || {})[k.id] || 0, k.max, "zusatz." + k.id, k.max <= 3 ? 0.5 : 1)).join("")}
  </div>` : ""}
  <div class="card" style="padding:20px; margin-top:16px;">
    <div class="section-title">Stärken für die Bescheinigung</div>
    <div class="staerken-chips">${STAERKEN_KATALOG.map((s) => `<span class="staerke-chip ${auswahl.includes(s) ? "sel" : ""}" data-staerke-toggle="${esc(s)}">${esc(s)}</span>`).join("")}</div>
    <div class="field-row" style="margin-top:12px;"><label>Weitere Stärken (frei, komma-getrennt)</label><textarea data-refl-field="staerken">${esc(rec.staerken)}</textarea></div>
    <div class="field-row">
      <label>Fließtext für die Bescheinigung <span class="btn btn-ghost btn-sm" id="genStaerkenText" style="margin-left:8px;">Text automatisch erzeugen</span></label>
      <p style="font-size:11.5px; color:var(--ink-faint); margin:-2px 0 6px;">Berücksichtigt Stärken, Selbst-/Fremdeinschätzung, Präsentationsbewertung und ggf. den Tipp – immer positiv formuliert. Danach frei bearbeitbar (auch auf der Seite „Bewertung & Bescheinigung").</p>
      <textarea data-refl-field="staerkenText" style="min-height:90px;">${esc(rec.staerkenText)}</textarea>
    </div>
  </div>
  <div class="card" style="padding:20px; margin-top:16px;">
    ${renderKriterienManager("reflexion", g, katalog)}
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

function computeScores(g, student, katalog = cache.katalog) {
  const aRec = (g.anmeldung.bewertungProSchueler || {})[student] || {};
  const aFixed = ["idee", "vollstaendigkeit", "struktur", "meilensteineP", "sorgfalt"].reduce((s, k) => s + Number(aRec[k] || 0), 0);
  const aKrit = activeKriterien(g, "anmeldung", katalog);
  const aZusatz = zusatzScore(aRec, aKrit);
  const anmeldung = aFixed + aZusatz.sum;
  const anmeldungMax = 10 + aZusatz.max;

  const pRec = (g.praesentation.bewertungProSchueler || {})[student] || {};
  const fach = ["sinnhaftigkeit", "tiefe", "richtigkeit"].reduce((s, k) => s + Number(pRec[k] || 0), 0);
  const fachMax = 10;
  const produktFixed = ["struktur", "medien", "kommunikation", "verteilung"].reduce((s, k) => s + Number(pRec[k] || 0), 0);
  const pKrit = activeKriterien(g, "praesentation", katalog);
  const pZusatz = zusatzScore(pRec, pKrit);
  const produkt = produktFixed + pZusatz.sum;
  const produktMax = 15 + pZusatz.max;

  const rec = g.reflexion[student] || {};
  const reflexionSelbst = scoreFromJmn(rec.selbst);
  const reflexionFremd = scoreFromJmn(rec.fremd);
  const reflexionBasis = Math.round(((reflexionSelbst + reflexionFremd) / 2) * 2) / 2;
  const rKrit = activeKriterien(g, "reflexion", katalog);
  const rZusatz = zusatzScore(rec, rKrit);
  const reflexion = reflexionBasis + rZusatz.sum;
  const reflexionMax = 15 + rZusatz.max;

  const gesamt = anmeldung + fach + produkt + reflexion;
  const gesamtMax = anmeldungMax + fachMax + produktMax + reflexionMax;
  const pct = gesamtMax > 0 ? Math.round((gesamt / gesamtMax) * 100) : 0;
  // Linearer Notenschlüssel: 0 Punkte = Note 6, volle Punktzahl = Note 1,
  // dazwischen linear mit einer Nachkommastelle.
  const noteRaw = gesamtMax > 0 ? 6 - 5 * (gesamt / gesamtMax) : 6;
  const note = Math.min(6, Math.max(1, Math.round(noteRaw * 10) / 10));
  return { anmeldung, anmeldungMax, fach, fachMax, produkt, produktMax, reflexion, reflexionMax, gesamt, gesamtMax, pct, noteVorschlag: note };
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
      <div class="section-title">Punkteübersicht (${scores.gesamtMax} P gesamt)</div>
      <div class="score-donut-wrap">
        <div class="grade-badge ${gradeBadgeClass(note)}"><div class="g">${formatNote(note)}</div><div class="p">${scores.pct}%</div></div>
        <div class="score-bars">
          ${bar("Anmeldeformular", scores.anmeldung, scores.anmeldungMax)}
          ${bar("Fachlicher Teil", scores.fach, scores.fachMax)}
          ${bar("Produkt / Präsentation", scores.produkt, scores.produktMax)}
          ${bar("Reflexion", scores.reflexion, scores.reflexionMax)}
        </div>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:16px; padding-top:14px; border-top:1px solid var(--border);">
        <b>Gesamt</b><b style="font-size:17px;">${scores.gesamt} / ${scores.gesamtMax} P</b>
      </div>
      <div class="field-row" style="margin-top:14px;"><label>Note (Vorschlag: ${scores.noteVorschlag}) – anpassbar, Dezimalstellen möglich</label>
        <input type="number" min="1" max="6" step="0.1" value="${note}" data-refl-field="note" style="width:90px;">
      </div>
      <div class="field-row"><label>Begründung</label><textarea data-refl-field="begruendung">${esc(rec.begruendung)}</textarea></div>
      <div class="field-row">
        <label>Fließtext für die Bescheinigung <span class="btn btn-ghost btn-sm" id="genStaerkenText" style="margin-left:8px;">Text automatisch erzeugen</span></label>
        <textarea data-refl-field="staerkenText" style="min-height:90px;">${esc(rec.staerkenText)}</textarea>
      </div>
    </div>
    <div class="cert-preview">
      <div class="cert-inner">
        <div style="font-size:11px; text-transform:uppercase; letter-spacing:.05em; color:var(--ink-faint); font-weight:700;">Bescheinigung – Vorschau</div>
        <h2>${esc(student)}</h2>
        <div class="cert-sub">Projekt „Zeig, was du kannst!" ${g.thema ? "· " + esc(g.thema) : ""}</div>
        <div class="cert-line">Note</div>
        <div class="cert-value">${formatNote(note)} (${scores.gesamt} von ${scores.gesamtMax} Punkten)</div>
        <div class="cert-line">Gezeigte Stärken</div>
        <div class="cert-strengths">${(rec.staerken || "").split(",").map((s) => s.trim()).filter(Boolean).map((s) => `<span class="strength-tag">${esc(s)}</span>`).join("") || '<span class="empty-hint">Noch keine Stärken in Phase 4 eingetragen.</span>'}</div>
        ${rec.staerkenText ? `<div class="cert-line">Fließtext</div><div style="font-size:12.5px; color:var(--ink-soft); margin-top:4px; line-height:1.5;">${esc(rec.staerkenText)}</div>` : ""}
        <button class="btn btn-yellow" style="margin-top:22px;" id="genCertBtn">Bescheinigung als PDF erzeugen</button>
      </div>
    </div>
  </div>`;
}
function bar(label, val, max) {
  const p = max > 0 ? Math.round((val / max) * 100) : 0;
  const cls = p >= 80 ? "good" : p >= 50 ? "mid" : "low";
  return `<div class="sb-row"><div class="sb-top"><span>${label}</span><b>${val} / ${max}</b></div><div class="sb-track"><div class="sb-fill ${cls}" style="width:${p}%;"></div></div></div>`;
}

/* ---------------- Modals ---------------- */
function openModal(html) {
  document.getElementById("modalBody").innerHTML = html;
  const bd = document.getElementById("modalBackdrop");
  bd.classList.add("open");
  bd.onclick = (e) => { if (e.target === bd) closeModal(); };
}
function closeModal() { document.getElementById("modalBackdrop").classList.remove("open"); }

function openSettingsModal() {
  const m = cache.meta;
  const z = cache.zertifikat || { farbe: "#FFED00", layout: "klassisch", logoPath: "" };
  openModal(`
    <h2>Einstellungen</h2>
    <div class="field-row"><label>Name der Lehrkraft</label><input type="text" id="stName" value="${esc(m.lehrkraft.name)}"></div>
    <div class="field-row"><label>Name der Schule</label><input type="text" id="stSchule" value="${esc(m.lehrkraft.schule)}"></div>
    <div class="field-row"><label>Schuljahr</label><input type="text" id="stSchuljahr" value="${esc(m.schuljahr)}" placeholder="z.B. 2025/26"></div>
    <div class="section-title" style="margin-top:18px;">Bescheinigung / Zertifikat</div>
    <div class="field-row"><label>Überschrift</label><input type="text" id="stUeberschrift" value="${esc(z.ueberschrift || '"Zeig, was du kannst!"')}"></div>
    <div class="field-row"><label>Akzentfarbe</label><input type="color" id="stFarbe" value="${esc(z.farbe || "#FFED00")}" style="height:38px; padding:4px;"></div>
    <div class="field-row"><label>Layout</label>
      <select id="stLayout">
        <option value="klassisch" ${z.layout === "klassisch" ? "selected" : ""}>Klassisch</option>
        <option value="modern" ${z.layout === "modern" ? "selected" : ""}>Modern (Farbakzent groß)</option>
      </select>
    </div>
    <div class="field-row"><label>Schullogo</label>
      <div style="display:flex; align-items:center; gap:10px;">
        ${z.logoPath ? `<span class="fach-pill">Logo hinterlegt</span>` : `<span class="empty-hint" style="padding:0;">Kein Logo hinterlegt</span>`}
        <span class="btn btn-ghost btn-sm" id="stLogoChoose">Logo auswählen …</span>
        ${z.logoPath ? `<span class="btn btn-ghost btn-sm" id="stLogoRemove">Entfernen</span>` : ""}
      </div>
    </div>
    <div class="field-row"><label>Digitale Unterschrift</label>
      <p style="font-size:11.5px; color:var(--ink-faint); margin:-2px 0 6px;">Bild (z.B. Foto/Scan der Unterschrift) – wird automatisch auf jeder Bescheinigung im Unterschriftenfeld eingefügt.</p>
      <div style="display:flex; align-items:center; gap:10px;">
        ${z.unterschriftPath ? `<span class="fach-pill">Unterschrift hinterlegt</span>` : `<span class="empty-hint" style="padding:0;">Keine Unterschrift hinterlegt</span>`}
        <span class="btn btn-ghost btn-sm" id="stSigChoose">Bild auswählen …</span>
        ${z.unterschriftPath ? `<span class="btn btn-ghost btn-sm" id="stSigRemove">Entfernen</span>` : ""}
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="stCancel">Abbrechen</button>
      <button class="btn btn-primary" id="stSave">Speichern</button>
    </div>
  `);
  document.getElementById("stCancel").onclick = closeModal;
  const logoChoose = document.getElementById("stLogoChoose");
  if (logoChoose) logoChoose.onclick = async () => {
    cache.zertifikat = await window.zwdk.chooseLogo();
    openSettingsModal();
  };
  const logoRemove = document.getElementById("stLogoRemove");
  if (logoRemove) logoRemove.onclick = async () => {
    cache.zertifikat = await window.zwdk.removeLogo();
    openSettingsModal();
  };
  const sigChoose = document.getElementById("stSigChoose");
  if (sigChoose) sigChoose.onclick = async () => {
    cache.zertifikat = await window.zwdk.chooseUnterschrift();
    openSettingsModal();
  };
  const sigRemove = document.getElementById("stSigRemove");
  if (sigRemove) sigRemove.onclick = async () => {
    cache.zertifikat = await window.zwdk.removeUnterschrift();
    openSettingsModal();
  };
  document.getElementById("stSave").onclick = async () => {
    const name = document.getElementById("stName").value.trim();
    const schule = document.getElementById("stSchule").value.trim();
    const schuljahr = document.getElementById("stSchuljahr").value.trim();
    const ueberschrift = document.getElementById("stUeberschrift").value.trim();
    const farbe = document.getElementById("stFarbe").value;
    const layout = document.getElementById("stLayout").value;
    await window.zwdk.setLehrkraft({ name, schule });
    await window.zwdk.setSchuljahr(schuljahr);
    await window.zwdk.setZertifikatFarbe(farbe);
    await window.zwdk.setZertifikatUeberschrift(ueberschrift);
    cache.zertifikat = await window.zwdk.setZertifikatLayout(layout);
    cache.meta = await window.zwdk.getMeta();
    renderMetaLabels();
    closeModal();
  };
}

function openKriteriumModal(phase) {
  openModal(`
    <h2>Kriterium hinzufügen – ${esc(PHASE_LABEL[phase] || phase)}</h2>
    <p style="font-size:12.5px; color:var(--ink-soft); margin:-8px 0 16px;">Dieses Kriterium steht danach bei allen Gruppen zur Auswahl und zählt zur Gesamtpunktzahl dazu.</p>
    <div class="field-row"><label>Name des Kriteriums</label><input type="text" id="krName" placeholder="z.B. Umgang mit Rückfragen"></div>
    <div class="field-row"><label>Maximale Punktzahl</label><input type="number" id="krMax" min="0.5" step="0.5" value="2"></div>
    <div class="modal-actions"><button class="btn btn-ghost" id="krCancel">Abbrechen</button><button class="btn btn-primary" id="krSave">Hinzufügen</button></div>
  `);
  document.getElementById("krCancel").onclick = closeModal;
  document.getElementById("krSave").onclick = async () => {
    const name = document.getElementById("krName").value.trim();
    const max = parseFloat(document.getElementById("krMax").value || "1");
    if (!name) return;
    const k = await window.zwdk.addKriterium(phase, name, max);
    await refreshKatalog();
    const g = findGroup(state.groupId);
    if (g) {
      const list = new Set((g.aktivKriterien && g.aktivKriterien[phase]) || []);
      list.add(k.id);
      await window.zwdk.updateGroup(g.id, { aktivKriterien: { [phase]: Array.from(list) } });
      await refreshGroups();
    }
    closeModal();
    render();
  };
}

function openGroupFormModal(existing) {
  const g = existing || { name: "", fach: "", fachlehrkraft: "", thema: "", produkt: "", members: [], zeitplan: { abgabetermin: "", wochenBisPhase: { 2: 3, 3: 6, 4: 9 } } };
  const zp = g.zeitplan || { abgabetermin: "", wochenBisPhase: { 2: 3, 3: 6, 4: 9 } };
  const w = zp.wochenBisPhase || {};
  openModal(`
    <h2>${existing ? "Gruppe bearbeiten" : "Neue Gruppe anlegen"}</h2>
    <div class="field-row"><label>Gruppenname</label><input type="text" id="ngName" value="${esc(g.name)}" placeholder="z.B. Team RoboArm"></div>
    <div class="field-row"><label>Fach</label><input type="text" id="ngFach" value="${esc(g.fach)}" placeholder="z.B. NWT"></div>
    <div class="field-row"><label>Fachlehrkraft</label><input type="text" id="ngFachlehrkraft" value="${esc(g.fachlehrkraft)}"></div>
    <div class="field-row"><label>Thema</label><input type="text" id="ngThema" value="${esc(g.thema)}"></div>
    <div class="field-row"><label>Geplantes Produkt</label><input type="text" id="ngProdukt" value="${esc(g.produkt)}"></div>
    <div class="field-row"><label>Mitglieder (Komma-getrennt)</label><input type="text" id="ngMembers" value="${esc((g.members || []).join(", "))}" placeholder="Lena Bauer, Finn Weber, Mia Hoffmann"></div>
    <div class="section-title" style="margin-top:18px;">Zeitplan & Abgabetermin</div>
    <div class="field-row"><label>Abgabetermin dieser Gruppe</label><input type="text" id="ngAbgabe" value="${esc(zp.abgabetermin)}" placeholder="TT.MM.JJJJ"></div>
    <div class="field-row"><label>Nach wie vielen Wochen sollte Phase 2 (Durchführung) erreicht sein?</label><input type="number" min="0" step="1" id="ngW2" value="${w[2] ?? 3}"></div>
    <div class="field-row"><label>Nach wie vielen Wochen sollte Phase 3 (Präsentation) erreicht sein?</label><input type="number" min="0" step="1" id="ngW3" value="${w[3] ?? 6}"></div>
    <div class="field-row"><label>Nach wie vielen Wochen sollte Phase 4 (Reflexion) erreicht sein?</label><input type="number" min="0" step="1" id="ngW4" value="${w[4] ?? 9}"></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="ngCancel">Abbrechen</button>
      <button class="btn btn-primary" id="ngSave">${existing ? "Speichern" : "Anlegen"}</button>
    </div>
  `);
  document.getElementById("ngCancel").onclick = closeModal;
  document.getElementById("ngSave").onclick = async () => {
    const name = document.getElementById("ngName").value.trim() || "Neue Gruppe";
    const members = document.getElementById("ngMembers").value.split(",").map((s) => s.trim()).filter(Boolean);
    const payload = {
      name, fach: document.getElementById("ngFach").value.trim(),
      fachlehrkraft: document.getElementById("ngFachlehrkraft").value.trim(),
      thema: document.getElementById("ngThema").value.trim(),
      produkt: document.getElementById("ngProdukt").value.trim(),
      members,
    };
    const zeitplan = {
      abgabetermin: document.getElementById("ngAbgabe").value.trim(),
      wochenBisPhase: {
        2: parseFloat(document.getElementById("ngW2").value || "3"),
        3: parseFloat(document.getElementById("ngW3").value || "6"),
        4: parseFloat(document.getElementById("ngW4").value || "9"),
      },
    };
    if (existing) {
      await window.zwdk.updateGroup(existing.id, { ...payload, zeitplan });
      closeModal();
      await refreshGroups(); render();
    } else {
      const created = await window.zwdk.createGroup({ ...payload, zeitplan });
      closeModal();
      await refreshGroups();
      state.view = "group"; state.groupId = created.id; state.tab = "anmeldung"; state.student = 0;
      render();
    }
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
  else if (state.view === "archiv") { content.innerHTML = renderArchiv(); crumb.innerHTML = "Archiv"; }
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
  document.querySelectorAll("[data-view-link]").forEach((n) => (n.onclick = () => { state.view = n.dataset.viewLink; render(); }));
  document.querySelectorAll("[data-tab]").forEach((n) => (n.onclick = () => { state.tab = n.dataset.tab; render(); }));
  document.querySelectorAll("[data-open]").forEach((n) => (n.onclick = (e) => {
    if (e.target.closest("[data-delete-group]") || e.target.closest("[data-restore-group]")) return;
    state.view = "group"; state.groupId = n.dataset.open; state.tab = "anmeldung"; state.student = 0; render();
  }));
  document.querySelectorAll("[data-delete-group]").forEach((n) => (n.onclick = async (e) => {
    e.stopPropagation();
    if (!confirm("Diese Gruppe inklusive aller Daten wirklich löschen?")) return;
    await window.zwdk.deleteGroup(n.dataset.deleteGroup);
    await refreshGroups(); render();
  }));
  document.querySelectorAll("[data-restore-group]").forEach((n) => (n.onclick = async (e) => {
    e.stopPropagation();
    await window.zwdk.updateGroup(n.dataset.restoreGroup, { archived: false });
    await refreshGroups(); render();
  }));
  document.querySelectorAll("[data-stu]").forEach((n) => (n.onclick = () => { state.student = parseInt(n.dataset.stu); render(); }));

  // Gruppenkopf: Bearbeiten / Archivieren
  const editBtn = document.getElementById("editGroupBtn");
  if (editBtn) editBtn.onclick = () => openGroupFormModal(findGroup(state.groupId));
  const archBtn = document.getElementById("archiveGroupBtn");
  if (archBtn) archBtn.onclick = async () => {
    const g = findGroup(state.groupId);
    await window.zwdk.updateGroup(g.id, { archived: !g.archived });
    await refreshGroups(); render();
  };

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

  // Bewertungs-Regler pro Schüler:in (Anmeldung / Präsentation / Reflexion-Zusatzkriterien)
  document.querySelectorAll("[data-stu-slider-field]").forEach((n) => {
    n.oninput = () => { n.parentElement.querySelector(".slider-val").textContent = n.value; };
    n.onchange = async () => {
      const g = findGroup(state.groupId);
      const student = g.members[state.student];
      const [phase, key] = n.dataset.stuSliderField.split("|");
      const val = parseFloat(n.value);
      let inner;
      if (key.startsWith("zusatz.")) {
        inner = { zusatz: { [key.slice("zusatz.".length)]: val } };
      } else {
        inner = { [key]: val };
      }
      let patch;
      if (phase === "reflexion") {
        patch = { reflexion: { [student]: inner } };
      } else {
        patch = { [phase]: { bewertungProSchueler: { [student]: inner } } };
      }
      await window.zwdk.updateGroup(g.id, patch);
      await refreshGroups(); render();
    };
  });

  // Kriterienkatalog: hinzufügen / an-/abwählen / löschen
  document.querySelectorAll("[data-add-kriterium]").forEach((n) => (n.onclick = () => openKriteriumModal(n.dataset.addKriterium)));
  document.querySelectorAll("[data-toggle-kriterium]").forEach((n) => (n.onclick = async (e) => {
    if (e.target.closest("[data-del-kriterium]")) return;
    const g = findGroup(state.groupId);
    const [phase, id] = n.dataset.toggleKriterium.split("|");
    const list = new Set((g.aktivKriterien && g.aktivKriterien[phase]) || []);
    if (list.has(id)) list.delete(id); else list.add(id);
    await window.zwdk.updateGroup(g.id, { aktivKriterien: { [phase]: Array.from(list) } });
    await refreshGroups(); render();
  }));
  document.querySelectorAll("[data-del-kriterium]").forEach((n) => (n.onclick = async (e) => {
    e.stopPropagation();
    if (!confirm("Dieses eigene Kriterium endgültig löschen? Es wird dann bei allen Gruppen entfernt.")) return;
    await window.zwdk.removeKriterium(n.dataset.delKriterium);
    await refreshKatalog();
    await refreshGroups(); render();
  }));

  // Reflexions-/Bewertungsfelder (pro Schüler:in)
  document.querySelectorAll("[data-refl-field]").forEach((n) => (n.onchange = async () => {
    const g = findGroup(state.groupId);
    const student = g.members[state.student];
    const val = n.type === "checkbox" ? n.checked : n.type === "number" ? parseFloat(n.value || "0") : n.value;
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

  // Stärken-Kategorien (Chips) + Fließtext-Generator
  document.querySelectorAll("[data-staerke-toggle]").forEach((n) => (n.onclick = async () => {
    const g = findGroup(state.groupId);
    const student = g.members[state.student];
    const rec = { ...(g.reflexion[student] || {}) };
    const list = new Set(rec.staerkenAuswahl || []);
    const s = n.dataset.staerkeToggle;
    if (list.has(s)) list.delete(s); else list.add(s);
    rec.staerkenAuswahl = Array.from(list);
    await window.zwdk.updateGroup(g.id, { reflexion: { [student]: rec } });
    await refreshGroups(); render();
  }));
  const genStaerkenBtn = document.getElementById("genStaerkenText");
  if (genStaerkenBtn) genStaerkenBtn.onclick = async () => {
    const g = findGroup(state.groupId);
    const student = g.members[state.student];
    const rec = { ...(g.reflexion[student] || {}) };
    rec.staerkenText = buildVollstaendigenFliesstext(g, student);
    await window.zwdk.updateGroup(g.id, { reflexion: { [student]: rec } });
    await refreshGroups(); render();
  };

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
      staerkenText: rec.staerkenText || "",
      note,
      punkte: {
        anmeldung: scores.anmeldung, anmeldungMax: scores.anmeldungMax,
        fach: scores.fach, fachMax: scores.fachMax,
        produkt: scores.produkt, produktMax: scores.produktMax,
        reflexion: scores.reflexion, reflexionMax: scores.reflexionMax,
        gesamt: scores.gesamt, gesamtMax: scores.gesamtMax,
      },
      lehrkraft: cache.meta.lehrkraft.name || "",
      datum,
    });
  };
}

boot();
