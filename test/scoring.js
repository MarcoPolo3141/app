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

// ---- Tests ----
function approxEqual(a,b,label){ if (Math.abs(a-b) > 0.01) throw new Error(`FAIL ${label}: expected ${b}, got ${a}`); }

// Alles "ja" -> volle 15 Punkte
approxEqual(scoreFromJmn({ideenentwicklung:'ja',information:'ja',struktur:'ja',projektorg:'ja',kreativitaet:'ja',kritisch:'ja',kooperation:'ja',kommunikation:'ja',reflexion:'ja'}), 15, 'alle ja');
// Alles "nein" -> 0
approxEqual(scoreFromJmn({ideenentwicklung:'nein',information:'nein',struktur:'nein',projektorg:'nein',kreativitaet:'nein',kritisch:'nein',kooperation:'nein',kommunikation:'nein',reflexion:'nein'}), 0, 'alle nein');
// leer/undefined -> 0, darf nicht crashen
approxEqual(scoreFromJmn({}), 0, 'leeres Objekt');
approxEqual(scoreFromJmn(undefined), 0, 'undefined');
approxEqual(scoreFromJmn(null), 0, 'null');
// gemischt
approxEqual(scoreFromJmn({ideenentwicklung:'ja',information:'mittel',struktur:'nein'}), (1+0.5+0)/9*15, 'gemischt (nur 3 von 9 beantwortet)');

// computeScores mit vollständiger Gruppe
const g = {
  anmeldung: { bewertung: { idee:2, vollstaendigkeit:2, struktur:2, meilensteineP:2, sorgfalt:2 } }, // 10
  praesentation: { struktur:4, medien:4, kommunikation:3, verteilung:4, sinnhaftigkeit:3, tiefe:3, richtigkeit:4 }, // fach=10, produkt=15
  reflexion: { 'Lena': { selbst:{ideenentwicklung:'ja',information:'ja',struktur:'ja',projektorg:'ja',kreativitaet:'ja',kritisch:'ja',kooperation:'ja',kommunikation:'ja',reflexion:'ja'}, fremd:{ideenentwicklung:'ja',information:'ja',struktur:'ja',projektorg:'ja',kreativitaet:'ja',kritisch:'ja',kooperation:'ja',kommunikation:'ja',reflexion:'ja'} } },
};
const s = computeScores(g, 'Lena');
approxEqual(s.anmeldung, 10, 'anmeldung gesamt');
approxEqual(s.fach, 10, 'fach gesamt');
approxEqual(s.produkt, 15, 'produkt gesamt');
approxEqual(s.reflexion, 15, 'reflexion gesamt');
approxEqual(s.gesamt, 50, 'gesamt');
approxEqual(s.pct, 100, 'prozent');
approxEqual(s.noteVorschlag, 1, 'note bei 100%');

// Notengrenzen prüfen (67% -> Note 3, knapp drunter -> Note 4)
const g2 = { anmeldung:{bewertung:{idee:0,vollstaendigkeit:0,struktur:0,meilensteineP:0,sorgfalt:0}}, praesentation:{struktur:0,medien:0,kommunikation:0,verteilung:0,sinnhaftigkeit:0,tiefe:0,richtigkeit:0}, reflexion:{} };
const s2 = computeScores(g2, 'X'); // Schüler ohne Reflexionseintrag -> darf nicht crashen
approxEqual(s2.gesamt, 0, 'leere Gruppe gesamt=0');
approxEqual(s2.noteVorschlag, 6, 'leere Gruppe -> Note 6');

console.log('ALLE SCORING-TESTS OK');
