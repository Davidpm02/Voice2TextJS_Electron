// Referencias a los elementos principales del DOM
const toogleDisplayBtn = document.querySelector('.toogle_display_btn');
const microBtn = document.querySelector('.micro_btn');
const canvas = document.getElementById('visualizer');
const canvasCtx = canvas.getContext('2d');
const successSound = document.getElementById('success-sound');
const errorSound = document.getElementById('error-sound');

// Definir las rutas de los iconos
const lightModeIcon = window.electronAPI.pathJoin('src/icons/light_mode_ico.png');
const darkModeIcon = window.electronAPI.pathJoin('src/icons/dark_mode_ico.png');
const microOffDarkIcon = window.electronAPI.pathJoin('src/icons/micro_off_dark_ico.png');
const microOffLightIcon = window.electronAPI.pathJoin('src/icons/micro_off_light_ico.png');
const microOnDarkIcon = window.electronAPI.pathJoin('src/icons/micro_on_dark_ico.png');
const microOnLightIcon = window.electronAPI.pathJoin('src/icons/micro_on_light_ico.png');

// Estado del modo
let isDarkMode = true;

// Estado del microfono
let isMicroOff = true;

// Variables para el audio
let audioContext;
let analyser;
let microphone;
let animationId;
let dataArray;
let bufferLength;

// Variables para la grabación
let mediaRecorder;
let audioChunks = [];

// Variables para la animación de ondas
let waveAnimationId;
const waves = Array(3).fill().map((_, i) => ({
    amplitude: 20,
    frequency: 0.02,
    phase: i * Math.PI * 0.5,
    y: 0
}));

// Verificar si electronAPI está disponible
if (!window.electronAPI) {
    console.error('Error: electronAPI no está disponible. Asegúrate de que el preload script se está cargando correctamente.');
}

// Función unificada para mostrar notificaciones
function showNotification(message, duration = 2000) {
  const notificationContainer = document.getElementById('notification-container');
  if (!notificationContainer) {
    console.error('No se encontró el contenedor de notificaciones en el DOM.');
    return;
  }

  // Actualizar el contenido del mensaje
  notificationContainer.textContent = message;
  
  // Asegurarse de que el container es visible
  notificationContainer.style.display = 'block';
  notificationContainer.classList.remove('hidden');

  // Ocultar después del tiempo especificado
  setTimeout(() => {
    notificationContainer.classList.add('hidden');
  }, duration);
}

// Configurar el manejador de respuestas del proceso principal
if (window.electronAPI) {
    window.electronAPI.onSaveResponse((event, response) => {
        if (response && response.success) {
            console.log('Archivo guardado exitosamente en:', response.filePath);
        } else {
            const errorMsg = response && response.error ? response.error : 'Error desconocido';
            console.error('Error al guardar el archivo:', errorMsg);
        }
    });

    // Configurar el manejador de notificaciones
    window.electronAPI.onNotification((event, message) => {
        // Verificar si es la notificación de transcripción completada
        if (message === 'Se ha copiado la transcripción al portapapeles') {
            // Ocultar el estado de transcripción
            const status = document.getElementById('transcription-status');
            if (status && !status.classList.contains('hidden')) {
                hideTranscriptionStatus({
                    dotsInterval: window.transcriptionDotsInterval,
                    waveAnimationId: window.transcriptionWaveAnimationId
                });
            }

            // Reproducir sonido de éxito
            if (successSound) {
                successSound.currentTime = 0;
                successSound.volume = 0.5;
                successSound.play().catch((error) => {
                    console.error('Error al reproducir el sonido de alerta:', error);
                });
            }
        } else {
            // Para otros tipos de notificaciones
            if (errorSound) {
                errorSound.currentTime = 0;
                errorSound.volume = 0.7;
                errorSound.play().catch((error) => {
                    console.error('Error al reproducir el sonido de error:', error);
                });
            }
        }

        // Mostrar la notificación después de ocultar el estado de transcripción
        showNotification(message);
    });
}

// Función para obtener el nombre del archivo basado en la fecha y hora
function getFileName() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    return `recording_${year}${month}${day}_${hours}${minutes}${seconds}.wav`;
}

// Función para guardar el archivo de audio
async function saveAndConvertAudio(audioBlob, fileName) {
    try {
      if (!window.electronAPI) {
        throw new Error('electronAPI no está disponible');
      }
  
      // Guardar el archivo original
      const buffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);
      
      // Llamamos a saveAudio y esperamos la respuesta
      window.electronAPI.saveAudio({ buffer: Array.from(uint8Array), fileName });
      
      // Convertir el audio (solo se ejecutará cuando el archivo esté guardado)
      console.log(`Iniciando conversión del archivo: ${fileName}`);
      try {
        const convertedFilePath = await window.electronAPI.convertAudio(fileName, fileName);
        console.log('Archivo convertido correctamente:', convertedFilePath);
      } catch (conversionError) {
        console.error('Error en la conversión del audio:', conversionError);
      }
      
    } catch (error) {
      console.error('Error al guardar o convertir el archivo:', error);
    }
}

// Configuración inicial del canvas
function setupCanvas() {
    // Asegurarse de que el canvas tenga las dimensiones correctas
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    canvasCtx.scale(dpr, dpr);
    canvasCtx.translate(0.5, 0.5);
}

// Función para iniciar la captura de audio
async function startAudio() {
    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            } 
        });

        // Configurar el MediaRecorder para la grabación
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            const fileName = getFileName();
            
            // Mostrar el estado de transcripción
            const intervals = showTranscriptionStatus();
            
            try {
                // Guardar el archivo usando el proceso principal
                await saveAndConvertAudio(audioBlob, fileName);
                
                // No ocultamos aquí el estado de transcripción
                // Se ocultará cuando se reciba la notificación de éxito
                
                // Limpiar
                audioChunks = [];
            } catch (error) {
                // Si hay un error, ocultamos el estado y mostramos el error
                hideTranscriptionStatus(intervals);
                console.error('Error durante la transcripción:', error);
            }
        };

        // Iniciar la grabación
        mediaRecorder.start();

        if (!analyser) {
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            bufferLength = analyser.frequencyBinCount;
            dataArray = new Uint8Array(bufferLength);
        }

        if (microphone) {
            microphone.disconnect();
        }

        microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(analyser);
        
        // Mostrar el canvas del visualizador
        const visualizer = document.getElementById('visualizer');
        visualizer.classList.remove('hidden');
        
        // Iniciar la animación
        drawVisualizer();
        
        console.log('Audio iniciado correctamente');
    } catch (error) {
        console.error('Error al acceder al micrófono:', error);

        // Enviar notificación al proceso principal
        if (window.electronAPI) {
            window.electronAPI.sendNotification('No se ha detectado ningún micrófono.');
        }

        isMicroOff = true;
        microBtn.style.backgroundImage = isDarkMode ? 
            `url(${microOffDarkIcon})` : `url(${microOffLightIcon})`;
    }
}

// Función para detener la captura de audio
function stopAudio() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }
    
    if (microphone) {
        microphone.disconnect();
        microphone = null;
    }

    // Limpiar y ocultar el canvas
    const visualizer = document.getElementById('visualizer');
    const ctx = visualizer.getContext('2d');
    
    // Limpiar completamente el canvas
    ctx.clearRect(0, 0, visualizer.width, visualizer.height);
    
    // Ocultar el canvas
    visualizer.classList.add('hidden');

    // Detener la animación
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
}

// Función para dibujar el visualizador
function drawVisualizer() {
    if (!analyser) return;

    animationId = requestAnimationFrame(drawVisualizer);
    
    analyser.getByteFrequencyData(dataArray);
    
    const width = canvas.width / window.devicePixelRatio;
    const height = canvas.height / window.devicePixelRatio;
    
    canvasCtx.clearRect(0, 0, width, height);
    
    const barWidth = (width / bufferLength) * 2.5;
    let barHeight;
    let x = 0;
    
    const gradient = canvasCtx.createLinearGradient(0, 0, width, 0);
    if (isDarkMode) {
        gradient.addColorStop(0, '#F49D96');
        gradient.addColorStop(1, '#F34235');
    } else {
        gradient.addColorStop(0, '#F34235');
        gradient.addColorStop(1, '#F49D96');
    }
    
    for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] * 0.5;
        
        canvasCtx.fillStyle = gradient;
        canvasCtx.beginPath();
        
        // Dibuja una forma redondeada en lugar de un rectángulo
        const centerY = height / 2;
        const h = Math.max(1, barHeight);
        
        canvasCtx.moveTo(x, centerY - h);
        canvasCtx.quadraticCurveTo(
            x + barWidth / 2, centerY - h,
            x + barWidth, centerY - h
        );
        canvasCtx.lineTo(x + barWidth, centerY + h);
        canvasCtx.quadraticCurveTo(
            x + barWidth / 2, centerY + h,
            x, centerY + h
        );
        canvasCtx.closePath();
        canvasCtx.fill();
        
        x += barWidth + 1;
    }
}

// Configuración inicial
setupCanvas();

// Manejar redimensionamiento de ventana
window.addEventListener('resize', setupCanvas);

// Función para actualizar los iconos
function updateIcons() {
    console.log('Actualizando iconos. Modo oscuro:', isDarkMode);
    
    // Actualizar icono del botón de modo
    const modeIcon = isDarkMode ? lightModeIcon : darkModeIcon;
    console.log('Nuevo icono de modo:', modeIcon);
    toogleDisplayBtn.style.backgroundImage = `url("${modeIcon}")`;
    
    // Actualizar icono del micrófono
    const microIcon = isMicroOff ? 
        (isDarkMode ? microOffDarkIcon : microOffLightIcon) :
        (isDarkMode ? microOnDarkIcon : microOnLightIcon);
    console.log('Nuevo icono de micrófono:', microIcon);
    microBtn.style.backgroundImage = `url("${microIcon}")`;
}

// Evento para el botón de cambio de modo
toogleDisplayBtn.addEventListener('click', () => {
    isDarkMode = !isDarkMode;
    
    document.body.classList.toggle('dark_mode', isDarkMode);
    document.body.classList.toggle('light_mode', !isDarkMode);
    
    // Actualizar los iconos
    updateIcons();
});

// Actualizar los iconos al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    updateIcons();
});

// Evento para el botón de micrófono
microBtn.addEventListener('click', async () => {
    try {
        if (isMicroOff) {
            // Intentar iniciar el audio antes de cambiar el estado
            await startAudio();
            // Si startAudio fue exitoso, actualizamos el estado y los iconos
            isMicroOff = false;
        } else {
            stopAudio();
            isMicroOff = true;
        }

        // Actualizar los iconos usando la función centralizada
        updateIcons();
        
    } catch (error) {
        console.error('Error al manejar el evento del micrófono:', error);
        // Si hay un error, asegurarse de que el estado sea coherente
        isMicroOff = true;
        updateIcons();
    }
});

// Escuchar eventos personalizados de notificación
window.addEventListener('show-app-notification', (event) => {
    console.log('Evento show-app-notification recibido en renderer:', event.detail);
    showNotification(event.detail);
});

// Función para actualizar el texto de transcripción
function updateTranscriptionText() {
    const textElement = document.querySelector('.transcription-text');
    if (!textElement) return;

    let dots = textElement.textContent.split('.').length - 1;
    dots = (dots % 3) + 1;
    textElement.textContent = 'Transcribiendo' + '.'.repeat(dots);
}

// Función para mostrar el estado de transcripción
function showTranscriptionStatus() {
    const status = document.getElementById('transcription-status');
    status.classList.remove('hidden');
    
    // Iniciar las animaciones
    drawWaves();
    const dotsInterval = setInterval(updateTranscriptionText, 500);
    
    // Guardar referencias globalmente
    window.transcriptionDotsInterval = dotsInterval;
    window.transcriptionWaveAnimationId = waveAnimationId;
    
    return {
        dotsInterval,
        waveAnimationId
    };
}

// Función para ocultar el estado de transcripción
function hideTranscriptionStatus(intervals) {
    const status = document.getElementById('transcription-status');
    status.classList.add('hidden');
    
    // Detener las animaciones
    clearInterval(intervals.dotsInterval);
    cancelAnimationFrame(intervals.waveAnimationId);
}

// Función para dibujar las ondas
function drawWaves() {
    const canvas = document.getElementById('waves-animation');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Limpiar el canvas
    ctx.clearRect(0, 0, width, height);

    // Definir colores según el modo
    const waveColors = isDarkMode ? [
        'rgba(74, 144, 226, 0.3)',
        'rgba(74, 144, 226, 0.5)',
        'rgba(74, 144, 226, 0.7)'
    ] : [
        'rgba(255, 255, 255, 0.3)',
        'rgba(255, 255, 255, 0.5)',
        'rgba(255, 255, 255, 0.7)'
    ];

    // Actualizar y dibujar cada onda
    waves.forEach((wave, index) => {
        ctx.beginPath();
        ctx.strokeStyle = waveColors[index];
        ctx.lineWidth = 2;

        // Dibujar la onda
        for (let x = 0; x < width; x++) {
            const y = height/2 + 
                     Math.sin(x * wave.frequency + wave.phase) * 
                     wave.amplitude * 
                     Math.sin(Date.now() * 0.001);

            if (x === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.stroke();
        
        // Actualizar la fase para la animación
        wave.phase += 0.05;
    });

    waveAnimationId = requestAnimationFrame(drawWaves);
}