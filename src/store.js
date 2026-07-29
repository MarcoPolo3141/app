// Einfache, robuste lokale Datenhaltung als JSON-Datei.
// Bewusst ohne native Abhängigkeiten (kein SQLite o.ä.), damit das Paket
// ohne Neukompilierung auf Windows und macOS funktioniert.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const CURRENT_VERSION = 1;

function defaultData() {
  return {
    version: CURRENT_VERSION,
    schuljahr: schuljahrLabel(),
    lehrkraft: { name: "", schule: "" },
    groups: [],
  };
}

function schuljahrLabel(d = new Date()) {
  const y = d.getFullYear();
  const startNewYear = d.getMonth() >= 7; // ab August neues Schuljahr
  const a = startNewYear ? y : y - 1;
  const b = a + 1;
  return `${a}/${String(b).slice(2)}`;
}

class Store {
  constructor(userDataPath) {
    this.dir = userDataPath;
    this.file = path.join(this.dir, "daten.json");
    this.data = this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.file)) {
        const raw = fs.readFileSync(this.file, "utf-8");
        const parsed = JSON.parse(raw);
        return { ...defaultData(), ...parsed };
      }
    } catch (e) {
      // Beschädigte Datei: Backup wegsichern statt Daten zu verlieren
      try {
        fs.copyFileSync(this.file, this.file + `.korrupt-${Date.now()}.bak`);
      } catch (_) {}
      console.error("Konnte daten.json nicht lesen, starte mit leerem Datensatz:", e);
    }
    return defaultData();
  }

  save() {
    fs.mkdirSync(this.dir, { recursive: true });
    const tmp = this.file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), "utf-8");
    fs.renameSync(tmp, this.file); // atomarer Schreibvorgang
  }

  // ---------- Lehrkraft ----------
  setLehrkraft(info) {
    this.data.lehrkraft = { ...this.data.lehrkraft, ...info };
    this.save();
    return this.data.lehrkraft;
  }

  // ---------- Gruppen ----------
  listGroups() {
    return this.data.groups;
  }

  getGroup(id) {
    return this.data.groups.find((g) => g.id === id);
  }

  createGroup(payload) {
    const g = {
      id: crypto.randomUUID(),
      name: payload.name || "Neue Gruppe",
      fach: payload.fach || "",
      fachlehrkraft: payload.fachlehrkraft || "",
      thema: payload.thema || "",
      produkt: payload.produkt || "",
      members: payload.members || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      anmeldung: {
        beschreibung: "",
        meilensteine: [],
        bewertung: { idee: 0, vollstaendigkeit: 0, struktur: 0, meilensteineP: 0, sorgfalt: 0 },
      },
      durchfuehrung: {
        protokoll: [],
        stunden: 0,
        beratung: { status: "nicht_geplant", datum: "", notiz: "" },
      },
      praesentation: {
        termin: "", ort: "", zielgruppe: "",
        struktur: 0, medien: 0, kommunikation: 0, verteilung: 0,
        sinnhaftigkeit: 0, tiefe: 0, richtigkeit: 0,
        rueckfragenNotiz: "",
      },
      reflexion: {}, // je Mitgliedsname: { selbst:{}, fremd:{}, staerken, tipp, note, begruendung }
    };
    this.data.groups.push(g);
    this.save();
    return g;
  }

  updateGroup(id, patch) {
    const g = this.getGroup(id);
    if (!g) throw new Error("Gruppe nicht gefunden: " + id);
    deepMerge(g, patch);
    g.updatedAt = new Date().toISOString();
    this.save();
    return g;
  }

  deleteGroup(id) {
    this.data.groups = this.data.groups.filter((g) => g.id !== id);
    this.save();
  }

  // ---------- abgeleitete Kennzahlen ----------
  computeStatus(g) {
    const events = [];
    if (g.durchfuehrung.protokoll.length) {
      events.push(...g.durchfuehrung.protokoll.map((p) => parseDate(p.datum)));
    }
    events.push(new Date(g.createdAt));
    const last = new Date(Math.max(...events.map((d) => d.getTime())));
    const days = Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24));

    const phase = this.computePhase(g);
    let ampel = "gruen";
    if (phase >= 1 && phase <= 3 && days >= 21) ampel = "rot";
    else if (phase >= 1 && phase <= 3 && (days >= 10 || g.durchfuehrung.beratung.status === "ueberfaellig")) ampel = "gelb";
    return { letzteAktivitaetTage: days, ampel, phase };
  }

  computePhase(g) {
    // Monoton aufsteigend: eine spätere Phase setzt voraus, dass die
    // vorherige ebenfalls Aktivität zeigt (verhindert Sprünge, wenn z.B.
    // vereinzelt Reflexionsnotizen existieren, aber die Präsentation noch
    // gar nicht stattgefunden hat).
    const hatDurchfuehrung = g.durchfuehrung.protokoll.length > 0 || g.durchfuehrung.stunden > 0;
    const hatPraesentation = g.praesentation && Object.values(g.praesentation).some((v) => (typeof v === "number" ? v > 0 : String(v || "").trim() !== ""));
    const hatReflexion = g.reflexion && Object.keys(g.reflexion).length > 0;
    if (hatPraesentation && hatReflexion) return 4;
    if (hatDurchfuehrung && hatPraesentation) return 3;
    if (hatDurchfuehrung) return 2;
    return 1;
  }
}

function parseDate(s) {
  // erwartet TT.MM.JJJJ oder ISO
  if (!s) return new Date(0);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s);
  const m = s.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  return new Date(0);
}

function deepMerge(target, patch) {
  for (const key of Object.keys(patch)) {
    const val = patch[key];
    if (val && typeof val === "object" && !Array.isArray(val) && typeof target[key] === "object" && !Array.isArray(target[key])) {
      deepMerge(target[key], val);
    } else {
      target[key] = val;
    }
  }
  return target;
}

module.exports = { Store, schuljahrLabel };
