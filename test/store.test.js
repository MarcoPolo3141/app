const { Store } = require("../src/store");
const fs = require("fs");
const os = require("os");
const path = require("path");

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

console.log("ALLE STORE-TESTS OK");
