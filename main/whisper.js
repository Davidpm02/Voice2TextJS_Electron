const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { convertToWav } = require('./audioConverter');

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

async function transcribeLatestRecording() {
  // Buscar el archivo convertido más reciente
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
      exec(`"${whisperPath}" -m "${modelPath}" -f "${convertedFilePath}" -l es`, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error ejecutando Whisper.cpp: ${error.message}`);
          reject(error);
          return;
        }
        
        if (stderr) {
          console.error(`stderr: ${stderr}`);
        }
        
        console.log(`\n=============================================`);
        console.log(`TRANSCRIPCIÓN COMPLETADA:`);
        console.log(`=============================================`);
        console.log(stdout);
        console.log(`=============================================\n`);
        
        resolve(stdout);
      });
    });
  } catch (error) {
    console.error('Error durante la transcripción:', error);
    throw error;
  }
}

module.exports = { transcribeLatestRecording };