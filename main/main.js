const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.resolve(__dirname, 'preload.js'),
            sandbox: false
        }
    });

    // Para depuración
    win.webContents.openDevTools();
    
    win.loadFile('renderer/index.html');
}

// Asegurarse de que el directorio output existe
function ensureOutputDirectory() {
    const outputDir = path.join(__dirname, '..', 'output');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    return outputDir;
}

app.whenReady().then(() => {
    ensureOutputDirectory();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Manejamos la solicitud de guardado de archivo .wav
ipcMain.on('save-audio', (event, { buffer, fileName }) => {
    const outputDir = ensureOutputDirectory();
    const filePath = path.join(outputDir, fileName);
    
    // Convertir el array buffer a Buffer
    const fileBuffer = Buffer.from(buffer);
    
    // Guardar el archivo
    fs.writeFile(filePath, fileBuffer, (err) => {
        if (err) {
            console.error('Error al guardar el archivo:', err);
            event.reply('save-audio-response', { success: false, error: err.message });
        } else {
            console.log('Archivo guardado exitosamente:', filePath);
            event.reply('save-audio-response', { success: true, filePath });
        }
    });
});