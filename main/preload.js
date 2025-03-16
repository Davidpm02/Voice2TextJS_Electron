const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    saveAudio: (data) => ipcRenderer.send('save-audio', data),
    onSaveResponse: (callback) => ipcRenderer.on('save-audio-response', callback)
}); 