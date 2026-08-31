const { buildCertificatePdf } = require("../src/certificate");
const fs = require("fs");
const os = require("os");
const path = require("path");

let assertFailures = 0;
const origAssert = console.assert.bind(console);
console.assert = (cond, msg) => { if (!cond) assertFailures++; origAssert(cond, msg); };

// Minimales gültiges 1x1-PNG (schwarz) als Test-Fixture für Logo/Unterschrift,
// ohne eine Bilddatei im Repo mitführen zu müssen.
const MINI_PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

(async () => {
  const bytes = await buildCertificatePdf({
    schule: "Realschule Musterstadt",
    schueler: "Lena Bauer",
    titel: "Bau eines Roboterarms aus Recyclingmaterial",
    staerken: "Kreativität, Teamfähigkeit, Sorgfalt",
    note: 2,
    punkte: { anmeldung: 9, fach: 8, produkt: 13, reflexion: 12, gesamt: 42 },
    lehrkraft: "S. Vetter",
    datum: "28.07.2026",
  });
  console.assert(bytes.length > 1000, "PDF wirkt zu klein/leer: " + bytes.length + " bytes");
  const header = Buffer.from(bytes.slice(0, 5)).toString("ascii");
  console.assert(header === "%PDF-", "Kein gültiger PDF-Header: " + header);
  fs.writeFileSync("test/Bescheinigung_Testlauf.pdf", bytes);

  // Edge case: leere/fehlende Felder dürfen nicht crashen
  const bytes2 = await buildCertificatePdf({ schule: "", schueler: "", titel: "", staerken: "", note: undefined, punkte: { anmeldung: 0, fach: 0, produkt: 0, reflexion: 0, gesamt: 0 }, lehrkraft: "", datum: "" });
  console.assert(bytes2.length > 500, "Leerer Fall erzeugt kein valides PDF");

  // Layout "modern" + individuelle Akzentfarbe + Fließtext
  const bytes3 = await buildCertificatePdf({
    schule: "Realschule Musterstadt", schueler: "Finn Weber", titel: "Bau eines Roboterarms",
    staerken: "Teamarbeit, Ausdauer", staerkenText: "Finn hat vor allem im Team zuverlässig mitgearbeitet und drangeblieben.",
    note: 2.3, punkte: { anmeldung: 8, fach: 9, produkt: 12, reflexion: 11, gesamt: 40 },
    lehrkraft: "S. Vetter", datum: "29.07.2026", farbe: "#2f6fed", layout: "modern",
  });
  console.assert(bytes3.length > 1000, "Modern-Layout erzeugt kein valides PDF");
  const header3 = Buffer.from(bytes3.slice(0, 5)).toString("ascii");
  console.assert(header3 === "%PDF-", "Modern-Layout: kein gültiger PDF-Header");

  // Ungültiger/fehlender Logo-Pfad darf nicht crashen (Datei existiert nicht)
  const bytes4 = await buildCertificatePdf({
    schule: "Test", schueler: "Test Schüler", titel: "Test", staerken: "", note: 4,
    punkte: { anmeldung: 5, fach: 5, produkt: 5, reflexion: 5, gesamt: 20 }, lehrkraft: "", datum: "",
    farbe: "#FFED00", layout: "klassisch", logoPath: "/pfad/existiert/nicht.png",
  });
  console.assert(bytes4.length > 500, "Fehlender Logo-Pfad hätte nicht crashen dürfen");

  // Eigene Überschrift + echte (kleine) digitale Unterschrift werden übernommen
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "zwdk-cert-test-"));
  const sigPath = path.join(tmpDir, "unterschrift.png");
  fs.writeFileSync(sigPath, Buffer.from(MINI_PNG_B64, "base64"));
  const bytes5 = await buildCertificatePdf({
    schule: "Realschule Musterstadt", schueler: "Mia Hoffmann", titel: "Test", staerken: "Sorgfalt",
    note: 1.7, punkte: { anmeldung: 10, fach: 10, produkt: 15, reflexion: 15, gesamt: 50 },
    lehrkraft: "S. Vetter", datum: "31.08.2026", farbe: "#FFED00", layout: "klassisch",
    ueberschrift: "Unser Schulprojekt", unterschriftPath: sigPath,
  });
  console.assert(bytes5.length > 1000, "Eigene Überschrift + Unterschrift erzeugen kein valides PDF");
  const header5 = Buffer.from(bytes5.slice(0, 5)).toString("ascii");
  console.assert(header5 === "%PDF-", "Eigene Überschrift/Unterschrift: kein gültiger PDF-Header");

  // Fehlender/kaputter Unterschrift-Pfad darf nicht crashen
  const bytes6 = await buildCertificatePdf({
    schule: "Test", schueler: "Test Schüler", titel: "Test", staerken: "", note: 3,
    punkte: { anmeldung: 5, fach: 5, produkt: 5, reflexion: 5, gesamt: 20 }, lehrkraft: "", datum: "",
    unterschriftPath: "/pfad/existiert/nicht.png",
  });
  console.assert(bytes6.length > 500, "Fehlender Unterschrift-Pfad hätte nicht crashen dürfen");

  if (assertFailures > 0) {
    console.error(`${assertFailures} Test-Assertion(s) fehlgeschlagen.`);
    process.exit(1);
  }
  console.log("ALLE CERTIFICATE-TESTS OK");
})().catch((e) => { console.error("FEHLER:", e); process.exit(1); });
