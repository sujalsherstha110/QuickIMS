const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('quickimsDesktop', {
  isElectron: true,
  platform: process.platform,
  listPrinters: () => ipcRenderer.invoke('desktop:list-printers'),
  printHtmlSilent: (payload) => ipcRenderer.invoke('desktop:print-html-silent', payload),
  printRawSpooler: (payload) => ipcRenderer.invoke('desktop:print-raw-spooler', payload),
  sendRawTcp: (payload) => ipcRenderer.invoke('desktop:send-raw-tcp', payload),
  testTcpConnection: (payload) => ipcRenderer.invoke('desktop:test-tcp', payload),
  getAppInfo: () => ipcRenderer.invoke('desktop:app-info'),
  checkForUpdates: () => ipcRenderer.invoke('desktop:check-for-updates'),
  installUpdate: () => ipcRenderer.invoke('desktop:install-update'),
  refreshApp: () => ipcRenderer.invoke('desktop:refresh-app'),
});
