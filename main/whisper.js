const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { clipboard, app } = require('electron'); 

const audioDir = path.join(__dirname, '../output'); // Directorio donde se guardan las grabaciones

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

async function transcribeLatestRecording(win, audioFilePath) {
    return new Promise((resolve, reject) => {
        console.log('Iniciando proceso de transcripción para:', audioFilePath);

        // Obtener las rutas según el modo de ejecución
        let whisperPath, modelPath, whisperDllPath;
        
        if (app.isPackaged) {
            // En producción, usar recursos desde la carpeta resources
            whisperPath = path.join(process.resourcesPath, 'whisper-cli.exe');
            modelPath = path.join(process.resourcesPath, 'ggml-small-q8_0.bin');
            whisperDllPath = path.join(process.resourcesPath, 'whisper.dll');
        } else {
            // En desarrollo, usar rutas relativas al proyecto
            whisperPath = path.join(__dirname, '..', 'whisper.cpp', 'build', 'bin', 'Release', 'whisper-cli.exe');
            modelPath = path.join(__dirname, '..', 'models', 'ggml-small-q8_0.bin');
            whisperDllPath = path.join(__dirname, '..', 'whisper.cpp', 'build', 'bin', 'Release', 'whisper.dll');
        }

        // Log de depuración detallado
        console.log('\n=== Información de depuración ===');
        console.log('Estado de la aplicación:');
        console.log('¿Empaquetada?:', app.isPackaged);
        console.log('Ruta de recursos:', process.resourcesPath);
        console.log('\nRutas completas:');
        console.log('- Ejecutable:', whisperPath);
        console.log('- DLL:', whisperDllPath);
        console.log('- Modelo:', modelPath);
        console.log('- Audio:', audioFilePath);
        console.log('\nVerificación de archivos:');
        console.log('- Ejecutable existe:', fs.existsSync(whisperPath));
        console.log('- DLL existe:', fs.existsSync(whisperDllPath));
        console.log('- Modelo existe:', fs.existsSync(modelPath));
        console.log('- Audio existe:', fs.existsSync(audioFilePath));

        // Verificaciones de archivos
        if (!fs.existsSync(whisperPath)) {
            const error = new Error('No se encuentra el ejecutable de whisper.cpp');
            console.error(error);
            reject(error);
            return;
        }

        if (!fs.existsSync(modelPath)) {
            const error = new Error('No se encuentra el modelo de whisper.cpp');
            console.error(error);
            reject(error);
            return;
        }

        if (!fs.existsSync(audioFilePath)) {
            const error = new Error('No se encuentra el archivo de audio');
            console.error(error);
            reject(error);
            return;
        }

        // Verificar DLL
        if (!fs.existsSync(whisperDllPath)) {
            const error = new Error('No se encuentra whisper.dll');
            console.error(error);
            reject(error);
            return;
        }

        // Asegurar que las rutas no tengan espacios sin comillas
        const quotedWhisperPath = `"${whisperPath}"`;
        const quotedModelPath = `"${modelPath}"`;
        const quotedAudioPath = `"${audioFilePath}"`;

        // Comando actualizado para ejecutar whisper.cpp
        const command = `${quotedWhisperPath} -m ${quotedModelPath} -f ${quotedAudioPath} -l es --no-timestamps`;
        
        console.log('\nEjecutando comando:');
        console.log(command);

        // Opciones para exec
        const options = {
            maxBuffer: 1024 * 1024 * 10, // 10MB buffer
            windowsHide: true
        };

        exec(command, options, (error, stdout, stderr) => {
            if (error) {
                console.error('\n=== Error en la ejecución ===');
                console.error('Código de error:', error.code);
                console.error('Señal:', error.signal);
                console.error('Mensaje de error:', error.message);
                console.error('stderr:', stderr);
                reject(error);
                return;
            }

            if (stderr) {
                console.log('\nMensajes de stderr (no necesariamente errores):');
                console.log(stderr);
            }

            console.log('\nSalida de whisper.cpp:', stdout);
            
            // Verificar que la salida no esté vacía
            if (!stdout.trim()) {
                const error = new Error('La transcripción está vacía');
                console.error(error);
                reject(error);
                return;
            }

            clipboard.writeText(stdout.trim());
            
            if (win) {
                win.webContents.send('show-notification', 
                    'Se ha copiado la transcripción al portapapeles');
            }

            resolve(stdout.trim());
        });
    });
}

module.exports = { transcribeLatestRecording };