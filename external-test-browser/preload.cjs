const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("testBrowser", {
  getState: () => ipcRenderer.invoke("test-browser:get-state"),
  select: (index) => ipcRenderer.send("test-browser:select", index),
  reload: (index) => ipcRenderer.send("test-browser:reload", index),
  enable: (index) => ipcRenderer.send("test-browser:enable", index),
  setMode: (mode) => ipcRenderer.send("test-browser:mode", mode),
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("test-browser:state", listener);
    return () => ipcRenderer.removeListener("test-browser:state", listener);
  },
});
