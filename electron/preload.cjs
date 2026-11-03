'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  openFolder: value => ipcRenderer.invoke('desktop:open-folder', value),
  chooseFolder: () => ipcRenderer.invoke('desktop:choose-folder'),
  getStartup: () => ipcRenderer.invoke('desktop:get-startup'),
  setStartup: enabled => ipcRenderer.invoke('desktop:set-startup', enabled),
  copyText: text => ipcRenderer.invoke('desktop:copy-text', text)
});
