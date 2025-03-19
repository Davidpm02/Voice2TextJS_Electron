// Referencias a los elementos principales del DOM
const toogleDisplayBtn = document.querySelector('.toogle_display_btn');
const microBtn = document.querySelector('.micro_btn');
const canvas = document.getElementById('visualizer');
const canvasCtx = canvas.getContext('2d');

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
            
            // Guardar el archivo usando el proceso principal
            await saveAndConvertAudio(audioBlob, fileName);
            
            // Limpiar
            audioChunks = [];
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
        
        // Iniciar la animación
        drawVisualizer();
        
        console.log('Audio iniciado correctamente');
    } catch (error) {
        console.error('Error al acceder al micrófono:', error);
        isMicroOff = true;
        microBtn.style.backgroundImage = isDarkMode ? 
            'url(../../src/icons/micro_off_dark_ico.png)' : 
            'url(../../src/icons/micro_off_light_ico.png)';
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
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    if (audioContext) {
        audioContext.suspend();
    }
    // Limpiar el canvas
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    console.log('Audio detenido');
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

// Evento para el botón de cambio de modo
toogleDisplayBtn.addEventListener('click', () => {
    isDarkMode = !isDarkMode;
    
    document.body.classList.toggle('dark_mode', isDarkMode);
    document.body.classList.toggle('light_mode', !isDarkMode);
    
    toogleDisplayBtn.style.backgroundImage = isDarkMode ? 'url(../../src/icons/light_mode_ico.png)' : 'url(../../src/icons/dark_mode_ico.png)';
    
    if (isMicroOff) {
        microBtn.style.backgroundImage = isDarkMode ? 'url(../../src/icons/micro_off_dark_ico.png)' : 'url(../../src/icons/micro_off_light_ico.png)';
    } else {
        microBtn.style.backgroundImage = isDarkMode ? 'url(../../src/icons/micro_on_dark_ico.png)' : 'url(../../src/icons/micro_on_light_ico.png)';
    }
});

// Evento para el botón de micrófono
microBtn.addEventListener('click', async () => {
    isMicroOff = !isMicroOff;
    
    if (isDarkMode) {
        microBtn.style.backgroundImage = isMicroOff ? 'url(../../src/icons/micro_off_dark_ico.png)' : 'url(../../src/icons/micro_on_dark_ico.png)';
    } else {
        microBtn.style.backgroundImage = isMicroOff ? 'url(../../src/icons/micro_off_light_ico.png)' : 'url(../../src/icons/micro_on_light_ico.png)';
    }
    
    if (!isMicroOff) {
        await startAudio();
    } else {
        stopAudio();
    }
});

// Escuchar eventos personalizados de notificación
window.addEventListener('show-app-notification', (event) => {
    console.log('Evento show-app-notification recibido en renderer:', event.detail);
    showNotification(event.detail);
});

// Botón de prueba para notificaciones
const testNotificationBtn = document.getElementById('test-notification');
if (testNotificationBtn) {
    testNotificationBtn.addEventListener('click', () => {
        console.log('Botón de prueba de notificación clickeado');
        showNotification("Esta es una notificación de prueba", 3000);
    });
}