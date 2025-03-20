const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

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
    },
    onNotification: (callback) => ipcRenderer.on('show-notification', (event, ...args) => callback(event, ...args)),
    sendNotification: (message) => ipcRenderer.send('send-notification', message),
    pathJoin: (...args) => {
        // Construir la ruta absoluta
        const resolvedPath = path.join(__dirname, '..', ...args)
            .replace(/\\/g, '/'); // Reemplazar backslashes con forward slashes
        
        // Convertir a formato URL para uso en CSS
        const fileUrl = `file:///${resolvedPath}`;
        console.log('URL generada:', fileUrl); // Para depuración
        
        return fileUrl;
    }
});
