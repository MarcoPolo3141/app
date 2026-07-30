const { Store } = require("../src/store");
const fs = require("fs");
const os = require("os");
const path = require("path");

// console.assert loggt bei Misserfolg nur, bricht aber nicht ab. Damit ein
// fehlgeschlagener Test die CI wirklich rot färbt statt still durchzulaufen,
// zählen wir Fehlschläge mit und beenden den Prozess am Ende mit Exit-Code 1.
let assertFailures = 0;
const origAssert = console.assert.bind(console);
console.assert = (cond, msg) => { if (!cond) assertFailures++; origAssert(cond, msg); };

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "zwdk-test-"));
const store = new Store(tmpDir);

// 1. Gruppe anlegen
const g = store.createGroup({
  name: "Team RoboArm", fach: "NWT", fachlehrkraft: "Hr. Kessler",
  thema: "Bau eines Roboterarms", produkt: "Modell + Vorführung",
  members: ["Lena Bauer", "Finn Weber", "Mia Hoffmann"],
});
console.assert(store.listGroups().length === 1, "Gruppe wurde nicht angelegt");
console.assert(store.getGroup(g.id).name === "Team RoboArm", "Name falsch");

// 2. Persistenz: neue Store-Instanz muss dieselben Daten laden
const store2 = new Store(tmpDir);
console.assert(store2.listGroups().length === 1, "Daten wurden nicht persistiert/geladen");
console.assert(store2.getGroup(g.id).fach === "NWT", "Feld nach Reload falsch");

// 3. Update / deepMerge
store2.updateGroup(g.id, { anmeldung: { bewertung: { idee: 1.5 } } });
const reloaded = store2.getGroup(g.id);
console.assert(reloaded.anmeldung.bewertung.idee === 1.5, "Verschachteltes Update fehlgeschlagen: " + reloaded.anmeldung.bewertung.idee);
console.assert(reloaded.anmeldung.bewertung.vollstaendigkeit === 0, "Update hat Geschwister-Felder überschrieben");

// 4. Meilensteine Array-Replace
store2.updateGroup(g.id, { anmeldung: { meilensteine: [{ titel: "Thema finden", due: "Herbstferien", done: true }] } });
console.assert(store2.getGroup(g.id).anmeldung.meilensteine.length === 1, "Meilensteine-Array wurde nicht ersetzt");

// 5. Reflexion pro Schüler
store2.updateGroup(g.id, { reflexion: { "Lena Bauer": { selbst: { ideenentwicklung: "ja" }, staerken: "Kreativität" } } });
const withRefl = store2.getGroup(g.id);
console.assert(withRefl.reflexion["Lena Bauer"].selbst.ideenentwicklung === "ja", "Reflexion nicht gespeichert");

// 6. computeStatus / computePhase
store2.updateGroup(g.id, { durchfuehrung: { stunden: 5, protokoll: [{ datum: "01.01.2026", was: "x", wer: "alle", notiz: "" }] } });
const status = store2.computeStatus(store2.getGroup(g.id));
console.assert(status.phase === 2, "Phase sollte 2 (Durchführung) sein, war: " + status.phase);
console.assert(["gruen","gelb","rot"].includes(status.ampel), "Ampel-Wert ungültig: " + status.ampel);

// 7. Gruppe löschen
store2.deleteGroup(g.id);
console.assert(store2.listGroups().length === 0, "Gruppe wurde nicht gelöscht");

// 8. Korrupte Datei -> darf nicht crashen
fs.writeFileSync(path.join(tmpDir, "daten.json"), "{ das ist kein json");
const store3 = new Store(tmpDir);
console.assert(Array.isArray(store3.listGroups()), "Store crasht bei korrupter Datei statt Fallback zu nutzen");
console.assert(fs.readdirSync(tmpDir).some(f => f.includes(".korrupt-")), "Kein Backup der korrupten Datei angelegt");

// 9. Neue Gruppe: Archiv-Flag & Zeitplan-Default
const tmpDir2 = fs.mkdtempSync(path.join(os.tmpdir(), "zwdk-test2-"));
const store4 = new Store(tmpDir2);
const g2 = store4.createGroup({ name: "Team Solar", members: ["Anna Klein"] });
console.assert(g2.archived === false, "Neue Gruppe sollte nicht archiviert sein");
console.assert(g2.zeitplan && g2.zeitplan.wochenBisPhase[2] === 3, "Zeitplan-Default fehlt/falsch");

// 10. Archivieren via updateGroup
store4.updateGroup(g2.id, { archived: true });
console.assert(store4.getGroup(g2.id).archived === true, "Archivieren über updateGroup fehlgeschlagen");
store4.updateGroup(g2.id, { archived: false });

// 11. Zertifikat-Einstellungen
const z = store4.setZertifikatSettings({ farbe: "#123456" });
console.assert(z.farbe === "#123456", "Zertifikat-Farbe wurde nicht gespeichert");
console.assert(z.layout === "klassisch", "Zertifikat-Layout-Default fehlt nach Teil-Update");
store4.setZertifikatSettings({ layout: "modern" });
console.assert(store4.data.zertifikat.layout === "modern", "Zertifikat-Layout wurde nicht gespeichert");

// 12. Dezimalnote über Reflexion speichern
store4.updateGroup(g2.id, { reflexion: { "Anna Klein": { note: 2.3, staerkenAuswahl: ["Kreativität"], staerkenText: "Anna hat ... gezeigt." } } });
const withNote = store4.getGroup(g2.id).reflexion["Anna Klein"];
console.assert(withNote.note === 2.3, "Dezimalnote wurde nicht korrekt gespeichert: " + withNote.note);
console.assert(withNote.staerkenAuswahl.includes("Kreativität"), "Stärken-Auswahl wurde nicht gespeichert");

// 13. computeStatus mit individuellem Zeitplan: weit hinter Plan -> rot
store4.updateGroup(g2.id, {
  zeitplan: { start: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(), wochenBisPhase: { 2: 1, 3: 2, 4: 3 } },
});
const stFarBehind = store4.computeStatus(store4.getGroup(g2.id)); // Phase ist noch 1 (nichts erfasst), erwartet wäre 4
console.assert(stFarBehind.ampel === "rot", "Gruppe weit hinter Zeitplan sollte rot sein, war: " + stFarBehind.ampel);
console.assert(stFarBehind.erwartetePhase === 4, "erwartetePhase falsch berechnet: " + stFarBehind.erwartetePhase);

// 14. computeStatus für Alt-Datensätze ohne "zeitplan"-Feld (Abwärtskompatibilität) ->
// alte Inaktivitäts-Logik greift weiterhin, kein Crash durch fehlendes Feld.
const store5 = new Store(fs.mkdtempSync(path.join(os.tmpdir(), "zwdk-test3-")));
const g3 = store5.createGroup({ name: "Ohne Zeitplan", members: ["Tim Nolte"] });
const g3raw = store5.getGroup(g3.id);
delete g3raw.zeitplan; // simuliert eine vor diesem Update angelegte Gruppe
const stNoPlan = store5.computeStatus(g3raw);
console.assert(stNoPlan.erwartetePhase === null, "erwartetePhase sollte null sein ohne Zeitplan-Feld");
console.assert(stNoPlan.ampel === "gruen", "Frisch angelegte Gruppe ohne Zeitplan sollte gruen sein");

if (assertFailures > 0) {
  console.error(`${assertFailures} Test-Assertion(s) fehlgeschlagen.`);
  process.exit(1);
}
console.log("ALLE STORE-TESTS OK");
