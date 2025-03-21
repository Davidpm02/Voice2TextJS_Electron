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
let audioContext = new (window.AudioContext || window.webkitAudioContext)();
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

let currentStream = null; // Añadir esta variable global al inicio del archivo

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

    // Reproducir el sonido inmediatamente según el tipo de mensaje
    if (message === 'Se ha copiado la transcripción al portapapeles') {
        if (successSound) {
            successSound.currentTime = 0;
            successSound.volume = 0.5;
            successSound.play().catch(console.error);
        }
    } else {
        if (errorSound) {
            errorSound.currentTime = 0;
            errorSound.volume = 0.7;
            errorSound.play().catch(console.error);
        }
    }

    // Actualizar el contenido del mensaje
    notificationContainer.textContent = message;
    
    // Mostrar la notificación
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
        }

        // Mostrar la notificación (el sonido se reproducirá dentro de showNotification)
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

// Función optimizada para iniciar el audio
async function startAudio() {
    try {
        // Asegurarnos de que todo esté limpio antes de empezar
        stopAudio();

        // Crear nuevo contexto de audio si no existe o está cerrado
        if (!audioContext || audioContext.state === 'closed') {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        // Solicitar el stream con opciones optimizadas
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                latency: 0, // Solicitar mínima latencia
                sampleRate: 44100, // Tasa de muestreo estándar
                channelCount: 1 // Mono para reducir el procesamiento
            } 
        });

        // Guardar referencia al stream actual
        currentStream = stream;

        // Configurar MediaRecorder con codificación optimizada
        mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus',
            audioBitsPerSecond: 128000 // 128kbps es un buen balance
        });
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        // Iniciar la grabación inmediatamente
        mediaRecorder.start();

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

        // Configurar nuevo analyser
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);

        // Crear y conectar el micrófono
        microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(analyser);

        // Mostrar el visualizador (eliminamos la duplicación)
        const visualizer = document.getElementById('visualizer');
        visualizer.classList.remove('hidden');
        
        // Iniciar la visualización
        requestAnimationFrame(drawVisualizer);
        
        // Usar requestAnimationFrame para la siguiente actualización
        requestAnimationFrame(() => {
            drawVisualizer();
            isMicroOff = false;
            updateIcons();
        });

        return true;

    } catch (error) {
        console.error('Error al acceder al micrófono:', error);

        // Enviar notificación al proceso principal
        if (window.electronAPI) {
            window.electronAPI.sendNotification('No se ha detectado ningún micrófono.');
        }

        // Asegurarnos de que el micrófono esté apagado
        isMicroOff = true;
        updateIcons(); // Actualizamos los iconos para reflejar el estado de error

        return false; // Indicamos fallo
    }
}

// Función para detener la captura de audio
function stopAudio() {
    // Detener la grabación si está activa
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }
    
    // Desconectar el micrófono
    if (microphone) {
        microphone.disconnect();
        microphone = null;
    }

    // Detener todas las pistas del stream
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }

    // Limpiar el visualizador de manera más efectiva
    const visualizer = document.getElementById('visualizer');
    if (visualizer) {
        const ctx = visualizer.getContext('2d');
        ctx.clearRect(0, 0, visualizer.width, visualizer.height);
        visualizer.classList.add('hidden');
    }

    // Detener la animación
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    // Limpiar el analizador y el buffer
    if (analyser) {
        analyser.disconnect();
        analyser = null;
    }
    dataArray = null;
    bufferLength = null;
    
    // Suspender el contexto de audio
    if (audioContext && audioContext.state === 'running') {
        audioContext.suspend();
    }
}

// Función para dibujar el visualizador
function drawVisualizer() {
    // Verificar que tenemos todo lo necesario
    if (!analyser || !dataArray || !canvas || !canvasCtx) {
        console.log('Falta algún componente necesario para el visualizador');
        return;
    }

    animationId = requestAnimationFrame(drawVisualizer);
    
    // Volver a usar Uint8Array para mejor visualización
    analyser.getByteFrequencyData(dataArray);
    
    const width = canvas.width / window.devicePixelRatio;
    const height = canvas.height / window.devicePixelRatio;
    
    canvasCtx.clearRect(0, 0, width, height);
    
    const barWidth = (width / bufferLength) * 2.5;
    const gradient = canvasCtx.createLinearGradient(0, 0, width, 0);
    
    if (isDarkMode) {
        gradient.addColorStop(0, '#F49D96');
        gradient.addColorStop(1, '#F34235');
    } else {
        gradient.addColorStop(0, '#F34235');
        gradient.addColorStop(1, '#F49D96');
    }
    
    canvasCtx.fillStyle = gradient;
    canvasCtx.beginPath();

    // Dibujar barras con efecto suavizado
    for (let i = 0; i < bufferLength; i++) {
        const x = i * (barWidth + 1);
        // Ajustar la escala para una mejor visualización
        const barHeight = (dataArray[i] / 255) * (height / 1.5);
        
        const centerY = height / 2;
        
        // Dibujar barra superior
        canvasCtx.fillRect(x, centerY - barHeight, barWidth, barHeight);
        // Dibujar barra inferior (espejo)
        canvasCtx.fillRect(x, centerY, barWidth, barHeight);
    }

    // Añadir efecto de brillo
    canvasCtx.globalCompositeOperation = 'lighter';
    canvasCtx.fill();
    canvasCtx.globalCompositeOperation = 'source-over';
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
    if (isMicroOff) {
        microBtn.disabled = true; // Prevenir múltiples clicks
        const success = await startAudio();
        microBtn.disabled = false;
    } else {
        stopAudio();
        isMicroOff = true;
        updateIcons();
    }
}, { passive: true }); // Optimizar manejo de eventos

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
            const y = height / 2 + 
                     Math.sin(x * wave.frequency + wave.phase) * 
                     wave.amplitude * 
                     // Reducimos la velocidad ajustando el multiplicador de Date.now()
                     Math.sin(Date.now() * 0.0005); // Cambio de 0.001 a 0.0005

            if (x === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.stroke();
        
        // Reducir la velocidad de cambio de fase
        wave.phase += 0.02; // Cambio de 0.05 a 0.02
    });

    waveAnimationId = requestAnimationFrame(drawWaves);
}