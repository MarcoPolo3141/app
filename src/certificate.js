// Erzeugt die "Bescheinigung" als PDF – angelehnt an das offizielle
// Anhang-Formular aus dem Leitfaden ("Bescheinigung.docx").
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

const YELLOW = rgb(1, 0.929, 0);
const INK = rgb(0.1, 0.1, 0.1);
const GREY = rgb(0.42, 0.42, 0.4);

async function buildCertificatePdf({ schule, schueler, titel, staerken, note, punkte, lehrkraft, datum }) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const { width, height } = page.getSize();
  let y = height - 70;

  // Kopfleiste
  page.drawRectangle({ x: 0, y: height - 18, width, height: 18, color: YELLOW });

  page.drawText("BESCHEINIGUNG", { x: 50, y, size: 11, font: bold, color: GREY });
  y -= 26;
  page.drawText('"Zeig, was du kannst!"', { x: 50, y, size: 26, font: bold, color: INK });
  y -= 40;

  page.drawText("Name der Schule", { x: 50, y, size: 9, font: bold, color: GREY });
  y -= 14;
  page.drawText(schule || "", { x: 50, y, size: 12, font: regular, color: INK });
  y -= 30;

  page.drawText("Vor- und Zuname der Schülerin / des Schülers", { x: 50, y, size: 9, font: bold, color: GREY });
  y -= 16;
  page.drawText(schueler || "", { x: 50, y, size: 15, font: bold, color: INK });
  y -= 34;

  page.drawText("Zielsetzung des Projekts", { x: 50, y, size: 9, font: bold, color: GREY });
  y -= 14;
  const zielText =
    'In "Zeig, was du kannst!" entwickeln Schülerinnen und Schüler in Kleingruppen ein authentisches ' +
    "Produkt, das einen Bezug zu ihrer Lebenswelt hat. Sie verknüpfen theoretisches Wissen mit " +
    "kreativer, problemlösender Arbeit in lebensweltorientierten Kontexten. Jede Schülerin bzw. jeder " +
    "Schüler erhält eine individuelle Note. Das Projekt umfasst die selbstständige Vorbereitung, die " +
    "Durchführung von mindestens acht Unterrichtsstunden, die Vorstellung des Produkts in einem " +
    "authentischen Kontext und ein Reflexionsgespräch.";
  y = drawWrapped(page, zielText, 50, y, width - 100, 10.5, regular, GREY, 14);
  y -= 22;

  page.drawText("Titel des Projekts", { x: 50, y, size: 9, font: bold, color: GREY });
  y -= 16;
  page.drawText(titel || "", { x: 50, y, size: 13, font: bold, color: INK });
  y -= 32;

  page.drawText("Im Projekt hat diese Stärken gezeigt:", { x: 50, y, size: 9, font: bold, color: GREY });
  y -= 18;
  const staerkenListe = (staerken || "").split(",").map((s) => s.trim()).filter(Boolean);
  let sx = 50;
  for (const s of staerkenListe) {
    const tw = regular.widthOfTextAtSize(s, 11) + 22;
    if (sx + tw > width - 50) { sx = 50; y -= 26; }
    page.drawRectangle({ x: sx, y: y - 6, width: tw, height: 22, color: INK, borderRadius: 11 });
    page.drawText(s, { x: sx + 11, y: y, size: 11, font: bold, color: YELLOW });
    sx += tw + 8;
  }
  y -= 46;

  // Punkteübersicht
  page.drawText("Punkteübersicht (max. 50 P)", { x: 50, y, size: 9, font: bold, color: GREY });
  y -= 16;
  const rows = [
    ["Anmeldeformular", punkte.anmeldung, 10],
    ["Fachlicher Teil", punkte.fach, 10],
    ["Produkt / Präsentation", punkte.produkt, 15],
    ["Reflexion", punkte.reflexion, 15],
  ];
  for (const [label, val, max] of rows) {
    page.drawText(label, { x: 50, y, size: 10.5, font: regular, color: INK });
    page.drawText(`${val} / ${max} P`, { x: width - 130, y, size: 10.5, font: bold, color: INK });
    y -= 16;
  }
  y -= 6;
  page.drawLine({ start: { x: 50, y: y + 12 }, end: { x: width - 50, y: y + 12 }, thickness: 1, color: GREY });
  page.drawText("Gesamt", { x: 50, y, size: 11, font: bold, color: INK });
  page.drawText(`${punkte.gesamt} / 50 P`, { x: width - 130, y, size: 11, font: bold, color: INK });
  y -= 50;

  // Note + Unterschrift
  page.drawRectangle({ x: width - 140, y: y - 40, width: 90, height: 60, borderColor: INK, borderWidth: 1 });
  page.drawText("Note", { x: width - 140, y: y + 24, size: 9, font: bold, color: GREY });
  page.drawText(String(note ?? ""), { x: width - 110, y: y - 15, size: 26, font: bold, color: INK });

  page.drawText("Datum, Unterschrift der Lehrkraft", { x: 50, y: y - 40, size: 9, font: bold, color: GREY });
  page.drawLine({ start: { x: 50, y: y - 46 }, end: { x: 280, y: y - 46 }, thickness: 1, color: GREY });
  page.drawText(`${datum || ""}    ${lehrkraft || ""}`, { x: 50, y: y - 58, size: 10, font: regular, color: INK });

  page.drawRectangle({ x: 0, y: 0, width, height: 10, color: YELLOW });

  return doc.save();
}

function drawWrapped(page, text, x, y, maxWidth, size, font, color, lineHeight) {
  const words = text.split(" ");
  let line = "";
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth) {
      page.drawText(line, { x, y, size, font, color });
      y -= lineHeight;
      line = word;
    } else {
      line = test;
    }
  }
  if (line) {
    page.drawText(line, { x, y, size, font, color });
    y -= lineHeight;
  }
  return y;
}

module.exports = { buildCertificatePdf };
