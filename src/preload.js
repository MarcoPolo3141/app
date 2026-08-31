const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("zwdk", {
  getMeta: () => ipcRenderer.invoke("app:getMeta"),
  setLehrkraft: (info) => ipcRenderer.invoke("app:setLehrkraft", info),
  setSchuljahr: (value) => ipcRenderer.invoke("app:setSchuljahr", value),

  getZertifikatSettings: () => ipcRenderer.invoke("app:getZertifikatSettings"),
  setZertifikatFarbe: (farbe) => ipcRenderer.invoke("app:setZertifikatFarbe", farbe),
  setZertifikatLayout: (layout) => ipcRenderer.invoke("app:setZertifikatLayout", layout),
  setZertifikatUeberschrift: (value) => ipcRenderer.invoke("app:setZertifikatUeberschrift", value),
  chooseLogo: () => ipcRenderer.invoke("app:chooseLogo"),
  removeLogo: () => ipcRenderer.invoke("app:removeLogo"),
  chooseUnterschrift: () => ipcRenderer.invoke("app:chooseUnterschrift"),
  removeUnterschrift: () => ipcRenderer.invoke("app:removeUnterschrift"),

  listKriterien: (phase) => ipcRenderer.invoke("kriterien:list", phase),
  addKriterium: (phase, name, max) => ipcRenderer.invoke("kriterien:add", phase, name, max),
  removeKriterium: (id) => ipcRenderer.invoke("kriterien:remove", id),

  listGroups: () => ipcRenderer.invoke("groups:list"),
  getGroup: (id) => ipcRenderer.invoke("groups:get", id),
  createGroup: (payload) => ipcRenderer.invoke("groups:create", payload),
  updateGroup: (id, patch) => ipcRenderer.invoke("groups:update", id, patch),
  deleteGroup: (id) => ipcRenderer.invoke("groups:delete", id),

  generateCertificate: (payload) => ipcRenderer.invoke("cert:generate", payload),
});
