const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const audioDir = path.join(__dirname, '../output'); // Directorio donde se guardan las grabaciones
const whisperPath = path.join(__dirname, '../whisper.cpp/build/bin/Release/whisper-cli.exe'); // Ruta al ejecutable de Whisper
const modelPath = path.join(__dirname, '../models/ggml-small-q8_0.bin')

// Función para obtener el archivo más reciente con el formato "recording_fecha_hora.wav"
function getLatestAudioFile(directory) {
    try {
        const files = fs.readdirSync(directory)
            .filter(file => file.startsWith('recording_') && file.endsWith('.wav'))
            .map(file => ({ file, time: fs.statSync(path.join(directory, file)).mtime.getTime() }))
            .sort((a, b) => b.time - a.time);
        
        return files.length > 0 ? path.join(directory, files[0].file) : null;
    } catch (error) {
        console.error('Error leyendo el directorio:', error);
        return null;
    }
}

async function transcribeLatestRecording() {
  const audioFilePath = getLatestAudioFile(audioDir);
  if (!audioFilePath) {
    console.error('No se encontró ningún archivo de audio reciente.');
    return;
  }

  const convertedFilePath = audioFilePath.replace('.wav', '_converted.wav');
  console.log(`Procesando archivo: ${convertedFilePath}`);

  try {
    await window.electronAPI.convertAudio(audioFilePath, convertedFilePath);
    
    if (!fs.existsSync(convertedFilePath)) {
      throw new Error(`El archivo convertido no existe: ${convertedFilePath}`);
    }

    exec(`"${whisperPath}" -m "${modelPath}" -f "${convertedFilePath}" -l es`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error ejecutando Whisper.cpp: ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`stderr: ${stderr}`);
      }
      console.log(`Transcripción completada:\n${stdout}`);
    });
  } catch (error) {
    console.error('Error durante la conversión o transcripción:', error);
  }
}

  

module.exports = { transcribeLatestRecording };