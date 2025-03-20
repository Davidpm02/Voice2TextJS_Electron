const { app, BrowserWindow, ipcMain } = require('electron');
const chokidar = require("chokidar");
const { transcribeLatestRecording } = require('./whisper');
const path = require('path');
const fs = require('fs');
const { convertToWav } = require('./audioConverter');

const outputDir = path.join(__dirname, '..', 'output');


let win;

function createWindow() {
    win = new BrowserWindow({
        width: 450,
        height: 710,
        maxWidth: 450,
        maxHeight: 710,
        minWidth: 450,
        minHeight: 710,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.resolve(__dirname, 'preload.js'),
            sandbox: false
        }
    });

    // Abro las devtools
    win.webContents.openDevTools();
    
    win.loadFile('renderer/index.html');
    win.webContents.on('did-finish-load', () => {
      console.log('La ventana ha terminado de cargar');
  });
}





// Manejador de eventos para convert-audio
ipcMain.handle('convert-audio', async (event, inputPath, outputPath) => {
  try {
    console.log(`Solicitud de conversión recibida:
    - Input: ${inputPath}
    - Output: ${outputPath}`);
    
    // Asegurarse de que el directorio de salida existe
    ensureOutputDirectory();
    
    const convertedFile = await convertToWav(inputPath, outputPath);
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
              error: err ? err.message : 'Error desconocido al guardar el archivo'
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
  console.log(`Watching for new recordings in: ${outputDir}`);
  const watcher = chokidar.watch(outputDir, {
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
  
  // Pasamos la ventana principal a la función
  transcribeLatestRecording(win)
    .then(transcription => {
      console.log('Transcripción completada y mostrada en consola');
    })
    .catch(error => {
      console.error('Error en la transcripción:', error);
      if (win) {
          win.webContents.send('show-notification', 'No se ha podido transcribir el archivo de audio');
      }
    });
}


app.whenReady().then(() => {
  watchForNewRecordings();
});

module.exports = { win };