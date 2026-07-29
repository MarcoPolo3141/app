const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("zwdk", {
  getMeta: () => ipcRenderer.invoke("app:getMeta"),
  setLehrkraft: (info) => ipcRenderer.invoke("app:setLehrkraft", info),

  listGroups: () => ipcRenderer.invoke("groups:list"),
  getGroup: (id) => ipcRenderer.invoke("groups:get", id),
  createGroup: (payload) => ipcRenderer.invoke("groups:create", payload),
  updateGroup: (id, patch) => ipcRenderer.invoke("groups:update", id, patch),
  deleteGroup: (id) => ipcRenderer.invoke("groups:delete", id),

  generateCertificate: (payload) => ipcRenderer.invoke("cert:generate", payload),
});
