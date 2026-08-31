// Einfache, robuste lokale Datenhaltung als JSON-Datei.
// Bewusst ohne native Abhängigkeiten (kein SQLite o.ä.), damit das Paket
// ohne Neukompilierung auf Windows und macOS funktioniert.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const CURRENT_VERSION = 1;
const DEFAULT_WOCHEN = { 2: 3, 3: 6, 4: 9 };

function defaultData() {
  return {
    version: CURRENT_VERSION,
    schuljahr: schuljahrLabel(),
    lehrkraft: { name: "", schule: "" },
    zertifikat: { farbe: "#FFED00", layout: "klassisch", logoPath: "", ueberschrift: '"Zeig, was du kannst!"', unterschriftPath: "" },
    kriterienKatalog: [], // wiederverwendbare, selbst angelegte Bewertungsaspekte je Phase
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
        const merged = { ...defaultData(), ...parsed };
        // Verschachtelte Objekte gezielt zusammenführen, damit neu hinzugekommene
        // Standardwerte (z.B. neue Zertifikat-Einstellungen) nicht verloren gehen,
        // wenn eine ältere Datenbasis geladen wird.
        merged.lehrkraft = { ...defaultData().lehrkraft, ...(parsed.lehrkraft || {}) };
        merged.zertifikat = { ...defaultData().zertifikat, ...(parsed.zertifikat || {}) };
        merged.kriterienKatalog = Array.isArray(parsed.kriterienKatalog) ? parsed.kriterienKatalog : [];
        return merged;
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

  setSchuljahr(value) {
    this.data.schuljahr = String(value || "").trim() || schuljahrLabel();
    this.save();
    return this.data.schuljahr;
  }

  // ---------- Zertifikat / Bescheinigung ----------
  setZertifikatSettings(patch) {
    this.data.zertifikat = { ...this.data.zertifikat, ...patch };
    this.save();
    return this.data.zertifikat;
  }

  // ---------- Kriterienkatalog (eigene, wiederverwendbare Bewertungsaspekte) ----------
  listKriterien(phase) {
    return this.data.kriterienKatalog.filter((k) => !phase || k.phase === phase);
  }

  addKriterium(phase, name, max) {
    const k = {
      id: crypto.randomUUID(),
      phase, // "anmeldung" | "praesentation" | "reflexion"
      name: String(name || "Kriterium").trim() || "Kriterium",
      max: Math.max(0.5, Number(max) || 1),
    };
    this.data.kriterienKatalog.push(k);
    this.save();
    return k;
  }

  removeKriterium(id) {
    const k = this.data.kriterienKatalog.find((x) => x.id === id);
    this.data.kriterienKatalog = this.data.kriterienKatalog.filter((x) => x.id !== id);
    if (k) {
      // Aus allen Gruppen als "aktiv" entfernen, damit keine verwaisten Referenzen bleiben.
      for (const g of this.data.groups) {
        if (g.aktivKriterien && Array.isArray(g.aktivKriterien[k.phase])) {
          g.aktivKriterien[k.phase] = g.aktivKriterien[k.phase].filter((cid) => cid !== id);
        }
      }
    }
    this.save();
  }

  // ---------- Gruppen ----------
  listGroups() {
    return this.data.groups;
  }

  getGroup(id) {
    return this.data.groups.find((g) => g.id === id);
  }

  createGroup(payload) {
    const zpIn = payload.zeitplan || {};
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
      archived: false,
      zeitplan: {
        start: zpIn.start || new Date().toISOString(),
        abgabetermin: zpIn.abgabetermin || "",
        wochenBisPhase: { ...DEFAULT_WOCHEN, ...(zpIn.wochenBisPhase || {}) },
      },
      anmeldung: {
        beschreibung: "",
        meilensteine: [],
        // je Mitgliedsname: { idee, vollstaendigkeit, struktur, meilensteineP, sorgfalt, zusatz:{[kriteriumId]:wert} }
        bewertungProSchueler: {},
      },
      durchfuehrung: {
        protokoll: [],
        stunden: 0,
        beratung: { status: "nicht_geplant", datum: "", notiz: "" },
      },
      praesentation: {
        termin: "", ort: "", zielgruppe: "", rueckfragenNotiz: "",
        // je Mitgliedsname: { struktur, medien, kommunikation, verteilung, sinnhaftigkeit, tiefe, richtigkeit, zusatz:{[kriteriumId]:wert} }
        bewertungProSchueler: {},
      },
      // welche selbst angelegten Kriterien (aus dem globalen Katalog) für diese Gruppe je Phase aktiv sind
      aktivKriterien: { anmeldung: [], praesentation: [], reflexion: [] },
      reflexion: {}, // je Mitgliedsname: { selbst:{}, fremd:{}, staerken, staerkenAuswahl, staerkenText, tipp, note, begruendung, zusatz:{[kriteriumId]:wert} }
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

    // Erwartete Phase anhand des individuellen Zeitplans (falls konfiguriert).
    const zp = g.zeitplan || {};
    const wochen = zp.wochenBisPhase || {};
    const wochenEintraege = Object.entries(wochen).filter(
      ([, w]) => w !== "" && w !== null && w !== undefined && !isNaN(Number(w))
    );
    let erwartetePhase = null;
    if (wochenEintraege.length) {
      const start = zp.start ? parseDate(zp.start) : new Date(g.createdAt);
      const elapsedWeeks = (Date.now() - start.getTime()) / (1000 * 60 * 60 * 24 * 7);
      erwartetePhase = 1;
      for (const [ph, w] of wochenEintraege.sort((a, b) => Number(a[1]) - Number(b[1]))) {
        if (elapsedWeeks >= Number(w)) erwartetePhase = Math.max(erwartetePhase, Number(ph));
      }
    }

    // Tage bis zum individuellen Abgabetermin (falls gesetzt).
    let tageBisAbgabe = null;
    if (zp.abgabetermin) {
      const due = parseDate(zp.abgabetermin);
      if (due.getTime() > 0) {
        tageBisAbgabe = Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      }
    }

    let ampel = "gruen";
    if (erwartetePhase !== null) {
      const rueckstand = erwartetePhase - phase;
      if (rueckstand >= 2) ampel = "rot";
      else if (rueckstand === 1) ampel = "gelb";
    } else if (phase >= 1 && phase <= 3 && days >= 21) {
      ampel = "rot";
    } else if (phase >= 1 && phase <= 3 && (days >= 10 || g.durchfuehrung.beratung.status === "ueberfaellig")) {
      ampel = "gelb";
    }

    if (tageBisAbgabe !== null && phase < 4) {
      if (tageBisAbgabe <= 7) ampel = "rot";
      else if (tageBisAbgabe <= 14 && ampel === "gruen") ampel = "gelb";
    }

    return { letzteAktivitaetTage: days, ampel, phase, tageBisAbgabe, erwartetePhase };
  }

  computePhase(g) {
    // Monoton aufsteigend: eine spätere Phase setzt voraus, dass die
    // vorherige ebenfalls Aktivität zeigt (verhindert Sprünge, wenn z.B.
    // vereinzelt Reflexionsnotizen existieren, aber die Präsentation noch
    // gar nicht stattgefunden hat).
    const hatDurchfuehrung = g.durchfuehrung.protokoll.length > 0 || g.durchfuehrung.stunden > 0;
    const p = g.praesentation || {};
    const hatPraesentationAngaben = ["termin", "ort", "zielgruppe", "rueckfragenNotiz"].some((k) => String(p[k] || "").trim() !== "");
    const hatPraesentationPunkte = Object.values(p.bewertungProSchueler || {}).some(
      (rec) => rec && Object.entries(rec).some(([k, v]) => (k === "zusatz" ? Object.values(v || {}).some((zv) => Number(zv) > 0) : Number(v) > 0))
    );
    const hatPraesentation = hatPraesentationAngaben || hatPraesentationPunkte;
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
