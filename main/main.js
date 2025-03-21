const { app, BrowserWindow, ipcMain } = require('electron');
const chokidar = require("chokidar");
const { transcribeLatestRecording } = require('./whisper');
const path = require('path');
const fs = require('fs');
const { convertToWav } = require('./audioConverter');
const { autoUpdater } = require('electron-updater');

const outputDir = path.join(app.getPath('userData'), 'output');


let win;

function createWindow() {
    win = new BrowserWindow({
        width: 450,
        height: 710,
        maxWidth: 450,
        maxHeight: 710,
        minWidth: 450,
        minHeight: 710,
        frame: false, // Elimina la barra de título
        titleBarStyle: 'hidden', // Oculta la barra de título
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.resolve(__dirname, 'preload.js'),
            sandbox: false
        }
    });

    win.loadFile('renderer/index.html');
    win.webContents.on('did-finish-load', () => {
      console.log('La ventana ha terminado de cargar');
  });

    // Configurar el auto-actualizador
    if (app.isPackaged) {
        autoUpdater.checkForUpdatesAndNotify();

        // Eventos del auto-actualizador
        autoUpdater.on('checking-for-update', () => {
            console.log('Buscando actualizaciones...');
        });

        autoUpdater.on('update-available', (info) => {
            win.webContents.send('show-notification', 'Hay una actualización disponible. Descargando...');
            console.log('Actualización disponible:', info);
        });

        autoUpdater.on('update-not-available', () => {
            console.log('No hay actualizaciones disponibles.');
        });

        autoUpdater.on('download-progress', (progressObj) => {
            let message = `Velocidad: ${progressObj.bytesPerSecond} - Descargado ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
            console.log(message);
        });

        autoUpdater.on('update-downloaded', () => {
            win.webContents.send('show-notification', 'Actualización descargada. Se instalará al reiniciar.');
            console.log('Actualización descargada');
        });

        autoUpdater.on('error', (err) => {
            console.error('Error en actualización:', err);
        });
    }
}





// Manejador de eventos para convert-audio
ipcMain.handle('convert-audio', async (event, inputPath, outputPath) => {
  try {
    const baseFileName = path.basename(inputPath);
    const newInputPath = path.join(outputDir, baseFileName);
    const newOutputPath = path.join(outputDir, path.basename(outputPath));

    console.log(`Solicitud de conversión recibida:
    - Input: ${newInputPath}
    - Output: ${newOutputPath}`);
    
    // Asegurarse de que el directorio de salida existe
    ensureOutputDirectory();
    
    const convertedFile = await convertToWav(newInputPath, newOutputPath);
    console.log(`Archivo convertido exitosamente: ${convertedFile}`);
    
    // Iniciar el proceso de transcripción automáticamente
    handleConversionCompleted(convertedFile);
    
    return convertedFile;
  } catch (error) {
    console.error('Error en la conversión:', error);
    if (win) {
        win.webContents.send('show-notification', 'No se ha podido convertir el archivo de audio');
    }
    throw error;
  }
});


// Asegurarse de que el directorio output existe
function ensureOutputDirectory() {
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    console.log('Directorio de salida:', outputDir);
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
          event.reply('save-audio-response', { 
              success: false, 
              error: err.message || 'Error desconocido al guardar el archivo'
          });
      } else {
          console.log('Archivo guardado exitosamente:', filePath);
          event.reply('save-audio-response', { success: true, filePath });
      }
  });
});

ipcMain.on('send-notification', (event, message) => {
  if (win) {
      win.webContents.send('show-notification', message);
  }
});


// Reviso la generación de un nuevo fichero .wav en el directorio 'output/'.
function watchForNewRecordings() {
    const dirToWatch = outputDir;
    console.log(`Watching for new recordings in: ${dirToWatch}`);
    
    const watcher = chokidar.watch(dirToWatch, {
        persistent: true,
        ignoreInitial: true,
        depth: 0,
        awaitWriteFinish: {
            stabilityThreshold: 500,
            pollInterval: 100,
        },
    });

    watcher.on("add", (filePath) => {
        if (filePath.endsWith("_converted.wav")) {
            console.log(`Nuevo archivo convertido detectado: ${filePath}`);
            // No iniciamos transcripción aquí, ya que se maneja en handleConversionCompleted
        }
    });

    watcher.on("error", (error) => console.error(`Error en el watcher: ${error}`));
}


function handleConversionCompleted(convertedFilePath) {
    console.log(`Proceso de conversión completado: ${convertedFilePath}`);
    console.log(`Iniciando transcripción automática...`);
    
    // Asegurarnos de que el archivo existe
    if (!fs.existsSync(convertedFilePath)) {
        console.error('Error: El archivo convertido no existe:', convertedFilePath);
        if (win) {
            win.webContents.send('show-notification', 'Error: Archivo de audio no encontrado');
        }
        return;
    }
    
    // Pasamos la ruta completa del archivo convertido
    transcribeLatestRecording(win, convertedFilePath)
        .then(transcription => {
            console.log('Transcripción completada:', transcription);
            // No es necesario enviar notificación aquí, se maneja en whisper.js
        })
        .catch(error => {
            console.error('Error detallado en la transcripción:', error);
            if (win) {
                win.webContents.send('show-notification', 
                    `Error en la transcripción: ${error.message || 'Error desconocido'}`);
            }
        });
}


app.whenReady().then(() => {
  watchForNewRecordings();
});

module.exports = { win };