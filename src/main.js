const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const { Store } = require("./store");
const { buildCertificatePdf } = require("./certificate");

let mainWindow;
let store;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1040,
    minHeight: 680,
    backgroundColor: "#f6f5f1",
    title: "Zeig, was du kannst! – Projektbegleitung",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  mainWindow.once("ready-to-show", () => mainWindow.show());

  if (process.env.ZWDK_DEVTOOLS === "1") {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
}

function buildMenu() {
  const template = [
    {
      label: "Datei",
      submenu: [
        {
          label: "Datenordner öffnen",
          click: () => shell.openPath(app.getPath("userData")),
        },
        {
          label: "Datensicherung exportieren …",
          click: exportBackup,
        },
        { type: "separator" },
        { role: "quit", label: "Beenden" },
      ],
    },
    {
      label: "Ansicht",
      submenu: [{ role: "reload" }, { role: "toggledevtools" }, { role: "resetzoom" }, { role: "zoomin" }, { role: "zoomout" }, { role: "togglefullscreen" }],
    },
    {
      label: "Hilfe",
      submenu: [
        {
          label: "Kurzhandbuch öffnen",
          click: () => openBundledDoc("Kurzhandbuch.pdf"),
        },
        {
          label: "Installationsanleitung öffnen",
          click: () => openBundledDoc("Installationsanleitung.pdf"),
        },
        { type: "separator" },
        {
          label: "Über 'Zeig, was du kannst!'",
          click: () =>
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "Über diese App",
              message: "Zeig, was du kannst! – Projektbegleitung",
              detail: "Digitale Unterstützung für Lehrkräfte bei Dokumentation, Reflexion und Bewertung des Projekts.\n\nVersion " + app.getVersion(),
            }),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function openBundledDoc(filename) {
  // Im gepackten Zustand liegen die docs neben src/ (app.asar oder Ressourcenordner);
  // im Entwicklungsmodus liegen sie eine Ebene über src/.
  const candidates = [
    // Gepackte App: von electron-builder als "extraResources" neben app.asar abgelegt (echte Datei, öffenbar).
    path.join(process.resourcesPath || "", "docs", filename),
    // Entwicklungsmodus (npm start): liegt eine Ebene über src/ als echte Datei.
    path.join(__dirname, "..", "docs", filename),
  ];
  const found = candidates.find((p) => {
    try { return fs.existsSync(p); } catch (_) { return false; }
  });
  if (found) {
    shell.openPath(found);
  } else {
    dialog.showMessageBox(mainWindow, {
      type: "warning",
      title: "Dokument nicht gefunden",
      message: `${filename} konnte nicht gefunden werden.`,
    });
  }
}

async function exportBackup() {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: "Datensicherung speichern",
    defaultPath: `zwdk-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (canceled || !filePath) return;
  fs.copyFileSync(store.file, filePath);
}

app.whenReady().then(() => {
  store = new Store(app.getPath("userData"));
  buildMenu();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

/* ---------------------- IPC-API ---------------------- */

ipcMain.handle("app:getMeta", () => ({
  version: app.getVersion(),
  schuljahr: store.data.schuljahr,
  lehrkraft: store.data.lehrkraft,
}));

ipcMain.handle("app:setLehrkraft", (e, info) => store.setLehrkraft(info));

ipcMain.handle("app:setSchuljahr", (e, value) => store.setSchuljahr(value));

ipcMain.handle("app:getZertifikatSettings", () => store.data.zertifikat);
ipcMain.handle("app:setZertifikatFarbe", (e, farbe) => store.setZertifikatSettings({ farbe }));
ipcMain.handle("app:setZertifikatLayout", (e, layout) => store.setZertifikatSettings({ layout }));

ipcMain.handle("app:chooseLogo", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: "Schullogo auswählen",
    filters: [{ name: "Bilder", extensions: ["png", "jpg", "jpeg"] }],
    properties: ["openFile"],
  });
  if (canceled || !filePaths[0]) return store.data.zertifikat;
  try {
    const ext = path.extname(filePaths[0]).toLowerCase() || ".png";
    const destDir = path.join(app.getPath("userData"), "assets");
    fs.mkdirSync(destDir, { recursive: true });
    const dest = path.join(destDir, "schullogo" + ext);
    fs.copyFileSync(filePaths[0], dest);
    return store.setZertifikatSettings({ logoPath: dest });
  } catch (e) {
    dialog.showMessageBox(mainWindow, { type: "warning", title: "Logo konnte nicht übernommen werden", message: String(e) });
    return store.data.zertifikat;
  }
});

ipcMain.handle("app:removeLogo", () => store.setZertifikatSettings({ logoPath: "" }));

ipcMain.handle("groups:list", () => store.listGroups().map((g) => ({ ...g, status: store.computeStatus(g) })));

ipcMain.handle("groups:get", (e, id) => {
  const g = store.getGroup(id);
  return g ? { ...g, status: store.computeStatus(g) } : null;
});

ipcMain.handle("groups:create", (e, payload) => store.createGroup(payload));

ipcMain.handle("groups:update", (e, id, patch) => store.updateGroup(id, patch));

ipcMain.handle("groups:delete", (e, id) => {
  store.deleteGroup(id);
  return true;
});

ipcMain.handle("cert:generate", async (e, payload) => {
  const z = store.data.zertifikat || {};
  const bytes = await buildCertificatePdf({ ...payload, farbe: z.farbe, layout: z.layout, logoPath: z.logoPath });
  const safeName = (payload.schueler || "Bescheinigung").replace(/[\\/:*?"<>|]/g, "_");
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: "Bescheinigung speichern",
    defaultPath: `Bescheinigung_${safeName}.pdf`,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (canceled || !filePath) return { saved: false };
  fs.writeFileSync(filePath, bytes);
  shell.showItemInFolder(filePath);
  return { saved: true, filePath };
});
