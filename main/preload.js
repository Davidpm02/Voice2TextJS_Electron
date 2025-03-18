const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    saveAudio: (data) => ipcRenderer.send('save-audio', data),
    onSaveResponse: (callback) => ipcRenderer.on('save-audio-response', callback),
    convertAudio: async (inputPath, outputPath) => {
        try {
            return await ipcRenderer.invoke('convert-audio', inputPath, outputPath);
        } catch (error) {
            console.error('Error al convertir audio:', error);
            throw error;
        }
    }
}); 