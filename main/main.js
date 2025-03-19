const { app, BrowserWindow, ipcMain } = require('electron');
const chokidar = require("chokidar");
const { transcribeLatestRecording } = require('./whisper');
const path = require('path');
const fs = require('fs');
const { convertToWav } = require('./audioConverter');

const outputDir = path.join(__dirname, '..', 'output');


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
    throw error;
  }
});
  

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
    
    // Ejecutar la transcripción
    transcribeLatestRecording()
      .then(transcription => {
        console.log('Transcripción completada y mostrada en consola');
      })
      .catch(error => {
        console.error('Error en la transcripción:', error);
      });
}


app.whenReady().then(() => {
  watchForNewRecordings();
});