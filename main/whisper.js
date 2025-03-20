const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { convertToWav } = require('./audioConverter');
const { clipboard } = require('electron'); 

const audioDir = path.join(__dirname, '../output'); // Directorio donde se guardan las grabaciones
const whisperPath = path.join(__dirname, '../whisper.cpp/build/bin/Release/whisper-cli.exe'); // Ruta al ejecutable de Whisper
const modelPath = path.join(__dirname, '../models/ggml-small-q8_0.bin');

// Función para obtener el archivo más reciente con el formato "recording_fecha_hora.wav"
function getLatestAudioFile(directory) {
    try {
        const files = fs.readdirSync(directory)
            .filter(file => file.startsWith('recording_') && file.endsWith('_converted.wav'))
            .map(file => ({ file, time: fs.statSync(path.join(directory, file)).mtime.getTime() }))
            .sort((a, b) => b.time - a.time);
        
        return files.length > 0 ? path.join(directory, files[0].file) : null;
    } catch (error) {
        console.error('Error leyendo el directorio:', error);
        return null;
    }
}

async function transcribeLatestRecording(mainWindow) {
  const convertedFilePath = getLatestAudioFile(audioDir);
  if (!convertedFilePath) {
    console.error('No se encontró ningún archivo de audio convertido reciente.');
    return;
  }

  console.log(`Procesando archivo para transcripción: ${convertedFilePath}`);

  try {
    if (!fs.existsSync(convertedFilePath)) {
      throw new Error(`El archivo convertido no existe: ${convertedFilePath}`);
    }

    return new Promise((resolve, reject) => {
      console.log(`Ejecutando Whisper.cpp con el archivo: ${convertedFilePath}`);
      exec(`"${whisperPath}" -m "${modelPath}" -f "${convertedFilePath}" -l es `, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error ejecutando Whisper.cpp: ${error.message}`);

          // Notificamos el usuario a través de la ventana principal       
          mainWindow.webContents.send('show-notification', 'No se ha encontrado ningún modelo de Whisper.cpp');
    
          reject(error);
          return;
        }

        if (stderr) {
          console.error(`stderr: ${stderr}`);
        }

        // Procesar la transcripción
        const processedTranscription = stdout
          .split('\n')
          .map(line => line.replace(/\[.*?\]/g, '').trim())
          .filter(line => line.length > 0)
          .join(' ');

        // Copiar al portapapeles
        clipboard.writeText(processedTranscription);
        console.log('La transcripción procesada se ha copiado al portapapeles.');

        // Notificamos el usuario a través de la ventana principal       
        mainWindow.webContents.send('show-notification', 'Se ha copiado la transcripción al portapapeles');
    
        resolve(processedTranscription);
      });
    });
  } catch (error) {
    console.error('Error durante la transcripción:', error);
    throw error;
  }
}

module.exports = { transcribeLatestRecording };