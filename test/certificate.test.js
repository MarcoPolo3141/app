const { buildCertificatePdf } = require("../src/certificate");
const fs = require("fs");

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

  console.log("ALLE CERTIFICATE-TESTS OK");
})().catch((e) => { console.error("FEHLER:", e); process.exit(1); });
