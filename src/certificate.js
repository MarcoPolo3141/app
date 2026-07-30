// Erzeugt die "Bescheinigung" als PDF – angelehnt an das offizielle
// Anhang-Formular aus dem Leitfaden ("Bescheinigung.docx").
const fs = require("fs");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

const INK = rgb(0.1, 0.1, 0.1);
const GREY = rgb(0.42, 0.42, 0.4);
const WHITE = rgb(1, 1, 1);

function hexToTuple(hex) {
  const h = String(hex || "#FFED00").replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const num = parseInt(full, 16) || 0xffed00;
  return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
}
function luminance([r, g, b]) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
function formatNote(note) {
  return note === undefined || note === null || note === "" ? "" : String(note).replace(".", ",");
}

async function buildCertificatePdf({ schule, schueler, titel, staerken, staerkenText, note, punkte, lehrkraft, datum, farbe, layout, logoPath }) {
  const tuple = hexToTuple(farbe);
  const ACCENT = rgb(...tuple);
  const ON_ACCENT = luminance(tuple) > 0.6 ? INK : WHITE;
  const modern = layout === "modern";

  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const { width, height } = page.getSize();

  // Optionales Schullogo einbetten (robust gegen fehlende/kaputte Datei).
  let logoImg = null;
  if (logoPath) {
    try {
      const bytes = fs.readFileSync(logoPath);
      logoImg = /\.png$/i.test(logoPath) ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    } catch (_) {
      logoImg = null;
    }
  }

  let y = height - 70;

  if (modern) {
    // "Modern": großzügiger Farbblock im Kopfbereich.
    const headH = 110;
    page.drawRectangle({ x: 0, y: height - headH, width, height: headH, color: ACCENT });
    page.drawText("BESCHEINIGUNG", { x: 50, y: height - 38, size: 11, font: bold, color: ON_ACCENT });
    page.drawText('"Zeig, was du kannst!"', { x: 50, y: height - 74, size: 26, font: bold, color: ON_ACCENT });
    if (logoImg) {
      const h = 60, w = (logoImg.width / logoImg.height) * h;
      page.drawImage(logoImg, { x: width - 50 - w, y: height - headH + (headH - h) / 2, width: w, height: h });
    }
    y = height - headH - 40;
  } else {
    // "Klassisch": dünne Kopfleiste, Logo rechts daneben.
    page.drawRectangle({ x: 0, y: height - 18, width, height: 18, color: ACCENT });
    if (logoImg) {
      const h = 42, w = (logoImg.width / logoImg.height) * h;
      page.drawImage(logoImg, { x: width - 50 - w, y: height - 70, width: w, height: h });
    }
    page.drawText("BESCHEINIGUNG", { x: 50, y, size: 11, font: bold, color: GREY });
    y -= 26;
    page.drawText('"Zeig, was du kannst!"', { x: 50, y, size: 26, font: bold, color: INK });
    y -= 40;
  }

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
    page.drawText(s, { x: sx + 11, y: y, size: 11, font: bold, color: ACCENT });
    sx += tw + 8;
  }
  if (staerkenListe.length) y -= 26;
  y -= 8;

  // Frei formulierter Fließtext zu den gezeigten Stärken.
  if (staerkenText && staerkenText.trim()) {
    y = drawWrapped(page, staerkenText.trim(), 50, y, width - 100, 10.5, regular, INK, 14);
    y -= 10;
  }
  y -= 12;

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
  if (modern) {
    page.drawRectangle({ x: width - 140, y: y - 40, width: 90, height: 60, color: ACCENT });
    page.drawText("Note", { x: width - 140, y: y + 24, size: 9, font: bold, color: GREY });
    page.drawText(formatNote(note), { x: width - 110, y: y - 15, size: 26, font: bold, color: ON_ACCENT });
  } else {
    page.drawRectangle({ x: width - 140, y: y - 40, width: 90, height: 60, borderColor: INK, borderWidth: 1 });
    page.drawText("Note", { x: width - 140, y: y + 24, size: 9, font: bold, color: GREY });
    page.drawText(formatNote(note), { x: width - 110, y: y - 15, size: 26, font: bold, color: INK });
  }

  page.drawText("Datum, Unterschrift der Lehrkraft", { x: 50, y: y - 40, size: 9, font: bold, color: GREY });
  page.drawLine({ start: { x: 50, y: y - 46 }, end: { x: 280, y: y - 46 }, thickness: 1, color: GREY });
  page.drawText(`${datum || ""}    ${lehrkraft || ""}`, { x: 50, y: y - 58, size: 10, font: regular, color: INK });

  page.drawRectangle({ x: 0, y: 0, width, height: 10, color: ACCENT });

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
