// Eigenständige Kopie der Bewertungslogik aus src/renderer/renderer.js
// (Renderer läuft nur im Browser-Kontext, daher hier dupliziert für
// headless Tests ohne echtes Electron-Fenster.)

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
  return Math.round((sum / keys.length) * 15 * 2) / 2;
}

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

function computeScores(g, student, katalog = []) {
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

// ---- Tests ----
function approxEqual(a, b, label) { if (Math.abs(a - b) > 0.01) throw new Error(`FAIL ${label}: expected ${b}, got ${a}`); }

// Alles "ja" -> volle 15 Punkte
approxEqual(scoreFromJmn({ ideenentwicklung: 'ja', information: 'ja', struktur: 'ja', projektorg: 'ja', kreativitaet: 'ja', kritisch: 'ja', kooperation: 'ja', kommunikation: 'ja', reflexion: 'ja' }), 15, 'alle ja');
approxEqual(scoreFromJmn({ ideenentwicklung: 'nein', information: 'nein', struktur: 'nein', projektorg: 'nein', kreativitaet: 'nein', kritisch: 'nein', kooperation: 'nein', kommunikation: 'nein', reflexion: 'nein' }), 0, 'alle nein');
approxEqual(scoreFromJmn({}), 0, 'leeres Objekt');
approxEqual(scoreFromJmn(undefined), 0, 'undefined');
approxEqual(scoreFromJmn(null), 0, 'null');
approxEqual(scoreFromJmn({ ideenentwicklung: 'ja', information: 'mittel', struktur: 'nein' }), (1 + 0.5 + 0) / 9 * 15, 'gemischt (nur 3 von 9 beantwortet)');

// computeScores: volle Punktzahl für EINE Schülerin, ohne Zusatzkriterien -> Basis 50 P
const gFull = {
  anmeldung: { bewertungProSchueler: { Lena: { idee: 2, vollstaendigkeit: 2, struktur: 2, meilensteineP: 2, sorgfalt: 2 } } },
  praesentation: { bewertungProSchueler: { Lena: { struktur: 4, medien: 4, kommunikation: 3, verteilung: 4, sinnhaftigkeit: 3, tiefe: 3, richtigkeit: 4 } } },
  reflexion: { Lena: { selbst: { ideenentwicklung: 'ja', information: 'ja', struktur: 'ja', projektorg: 'ja', kreativitaet: 'ja', kritisch: 'ja', kooperation: 'ja', kommunikation: 'ja', reflexion: 'ja' }, fremd: { ideenentwicklung: 'ja', information: 'ja', struktur: 'ja', projektorg: 'ja', kreativitaet: 'ja', kritisch: 'ja', kooperation: 'ja', kommunikation: 'ja', reflexion: 'ja' } } },
  aktivKriterien: { anmeldung: [], praesentation: [], reflexion: [] },
};
const sFull = computeScores(gFull, 'Lena', []);
approxEqual(sFull.anmeldung, 10, 'anmeldung gesamt');
approxEqual(sFull.anmeldungMax, 10, 'anmeldung max ohne Zusatzkriterien');
approxEqual(sFull.fach, 10, 'fach gesamt');
approxEqual(sFull.produkt, 15, 'produkt gesamt');
approxEqual(sFull.reflexion, 15, 'reflexion gesamt');
approxEqual(sFull.gesamt, 50, 'gesamt');
approxEqual(sFull.gesamtMax, 50, 'gesamtMax ohne Zusatzkriterien bleibt bei 50');
approxEqual(sFull.pct, 100, 'prozent');
approxEqual(sFull.noteVorschlag, 1, 'note bei 100%');

// Zwei Schüler:innen derselben Gruppe müssen unabhängige Punktzahlen haben
const gTwo = {
  anmeldung: { bewertungProSchueler: { A: { idee: 2, vollstaendigkeit: 2, struktur: 2, meilensteineP: 2, sorgfalt: 2 }, B: { idee: 0, vollstaendigkeit: 0, struktur: 0, meilensteineP: 0, sorgfalt: 0 } } },
  praesentation: { bewertungProSchueler: {} },
  reflexion: {},
  aktivKriterien: { anmeldung: [], praesentation: [], reflexion: [] },
};
const sA = computeScores(gTwo, 'A', []);
const sB = computeScores(gTwo, 'B', []);
approxEqual(sA.anmeldung, 10, 'Schüler A individuell bewertet');
approxEqual(sB.anmeldung, 0, 'Schüler B individuell bewertet (unabhängig von A)');

// Eigene Bewertungsaspekte lassen die Gesamtpunktzahl mitwachsen
const katalog = [
  { id: 'k1', phase: 'praesentation', name: 'Umgang mit Rückfragen', max: 3 },
  { id: 'k2', phase: 'anmeldung', name: 'Kreativität der Idee', max: 2 },
];
const gCustom = {
  anmeldung: { bewertungProSchueler: { C: { idee: 2, vollstaendigkeit: 2, struktur: 2, meilensteineP: 2, sorgfalt: 2, zusatz: { k2: 2 } } } },
  praesentation: { bewertungProSchueler: { C: { struktur: 4, medien: 4, kommunikation: 3, verteilung: 4, sinnhaftigkeit: 3, tiefe: 3, richtigkeit: 4, zusatz: { k1: 3 } } } },
  reflexion: {},
  aktivKriterien: { anmeldung: ['k2'], praesentation: ['k1'], reflexion: [] },
};
const sCustom = computeScores(gCustom, 'C', katalog);
approxEqual(sCustom.anmeldung, 12, 'anmeldung inkl. Zusatzkriterium');
approxEqual(sCustom.anmeldungMax, 12, 'anmeldungMax wächst um Zusatzkriterium-Max');
approxEqual(sCustom.produkt, 18, 'produkt inkl. Zusatzkriterium');
approxEqual(sCustom.produktMax, 18, 'produktMax wächst um Zusatzkriterium-Max');
approxEqual(sCustom.gesamtMax, 55, 'gesamtMax = 50 + 3 (praesentation) + 2 (anmeldung)');

// Ein Zusatzkriterium, das für die Gruppe NICHT aktiviert wurde, darf nicht mitzählen
const gInactive = {
  anmeldung: { bewertungProSchueler: { D: { idee: 2, vollstaendigkeit: 2, struktur: 2, meilensteineP: 2, sorgfalt: 2 } } },
  praesentation: { bewertungProSchueler: {} },
  reflexion: {},
  aktivKriterien: { anmeldung: [], praesentation: [], reflexion: [] }, // k2 existiert im Katalog, ist hier aber nicht aktiv
};
const sInactive = computeScores(gInactive, 'D', katalog);
approxEqual(sInactive.anmeldungMax, 10, 'nicht aktivierte Katalog-Kriterien dürfen die Max-Punktzahl nicht erhöhen');

// leere Gruppe ohne jegliche Einträge -> darf nicht crashen, Note 6
const gEmpty = { anmeldung: { bewertungProSchueler: {} }, praesentation: { bewertungProSchueler: {} }, reflexion: {}, aktivKriterien: { anmeldung: [], praesentation: [], reflexion: [] } };
const sEmpty = computeScores(gEmpty, 'X', []);
approxEqual(sEmpty.gesamt, 0, 'leere Gruppe gesamt=0');
approxEqual(sEmpty.noteVorschlag, 6, 'leere Gruppe -> Note 6');

// Linearer Notenschlüssel: 50% der Punkte -> genau Note 3,5 (Mitte zwischen 1 und 6)
const jmnAlleMittel = { ideenentwicklung: 'mittel', information: 'mittel', struktur: 'mittel', projektorg: 'mittel', kreativitaet: 'mittel', kritisch: 'mittel', kooperation: 'mittel', kommunikation: 'mittel', reflexion: 'mittel' };
const gHalf = {
  anmeldung: { bewertungProSchueler: { E: { idee: 1, vollstaendigkeit: 1, struktur: 1, meilensteineP: 1, sorgfalt: 1 } } }, // 5/10
  praesentation: { bewertungProSchueler: { E: { struktur: 2, medien: 2, kommunikation: 1.5, verteilung: 2, sinnhaftigkeit: 1.5, tiefe: 1.5, richtigkeit: 2 } } }, // fach 5/10 + produkt 7.5/15
  reflexion: { E: { selbst: jmnAlleMittel, fremd: jmnAlleMittel } }, // 7.5/15
  aktivKriterien: { anmeldung: [], praesentation: [], reflexion: [] },
};
const sHalf = computeScores(gHalf, 'E', []);
approxEqual(sHalf.gesamt, 25, 'gHalf gesamt = 50% von 50');
approxEqual(sHalf.gesamtMax, 50, 'gHalf gesamtMax = 50');
approxEqual(sHalf.noteVorschlag, 3.5, 'linearer Notenschlüssel: 50% Punkte -> Note 3,5');

console.log('ALLE SCORING-TESTS OK');
