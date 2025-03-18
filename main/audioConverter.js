const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Convierte un archivo de audio al formato WAV requerido.
 * @param {string} inputPath - Ruta del archivo de entrada (por ejemplo, input.mp3).
 * @param {string} outputPath - Ruta del archivo de salida (por ejemplo, output.wav).
 */
function convertToWav(inputPath, outputPath) {
  // Asegurarse de que estamos trabajando con rutas absolutas
  const outputDir = path.join(__dirname, '..', 'output');
  const absoluteInputPath = path.isAbsolute(inputPath) ? inputPath : path.join(outputDir, inputPath);
  const outputFile = outputPath.replace('.wav', '_converted.wav');
  const absoluteOutputPath = path.isAbsolute(outputFile) ? outputFile : path.join(outputDir, outputFile);
  
  console.log(`Rutas de conversión:
  - Input: ${absoluteInputPath}
  - Output: ${absoluteOutputPath}`);

  // Verificar que el archivo de entrada existe
  if (!fs.existsSync(absoluteInputPath)) {
    return Promise.reject(new Error(`El archivo de entrada no existe: ${absoluteInputPath}`));
  }

  const command = `ffmpeg -i "${absoluteInputPath}" -ar 16000 -ac 1 -c:a pcm_s16le "${absoluteOutputPath}"`;
  
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error durante la conversión: ${error.message}`);
        reject(error);
      } else {
        console.log(`Conversión exitosa. Archivo convertido: ${absoluteOutputPath}`);
        resolve(absoluteOutputPath);
      }
    });
  });
}


module.exports = { convertToWav };