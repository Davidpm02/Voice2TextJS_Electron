# Voice2TextJS - Transcriptor de Audio con Whisper.cpp

<img src="https://i.imgur.com/DgJZx6h.png">

Aplicación de escritorio desarrollada con Electron que permite transcribir audio a texto utilizando Whisper.cpp.

## 🚀 Características

- Grabación de audio en tiempo real.
- Visualizador de ondas de audio.
- Transcripción automática usando Whisper.cpp.
- Soporte para idioma español.
- Copia automática al portapapeles.
- Interfaz minimalista y fácil de usar.

## 📋 Prerrequisitos

- [Node.js](https://nodejs.org/) (versión 20 o superior)
- [Git](https://git-scm.com/)
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (para compilar Whisper.cpp)
- [CMake](https://cmake.org/download/) (para compilar Whisper.cpp)

## 🔧 Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/Davidpm02/Voice2TextJS_Electron.git
cd Voice2TextJS_Electron
```

### 2. Configurar Whisper.cpp

1. Clonar el repositorio de Whisper.cpp:
```bash
git clone https://github.com/ggerganov/whisper.cpp.git
```

2. Compilar Whisper.cpp:
```bash
cd whisper.cpp
mkdir build
cd build
cmake ..
cmake --build . --config Release
```

3. Copiar los archivos necesarios:
   - Crear el directorio `whisper.cpp/build/bin/Release` en el proyecto Voice2TextJS
   - Copiar de `whisper.cpp/build/bin/Release` los siguientes archivos:
     - whisper-cli.exe
     - whisper.dll
     - ggml-base.dll
     - ggml-cpu.dll
     - ggml.dll

### 3. Configurar el modelo

1. Crear el directorio `models` en la raíz del proyecto.
2. Descargar el modelo deseado desde [Hugging Face](https://huggingface.co/ggerganov/whisper.cpp).
3. Colocar el modelo (por ejemplo, `ggml-small-q8_0.bin`) en el directorio `models`.

### 4. Instalar dependencias

```bash
npm install
```

### 5. Probar la aplicación en desarrollo

```bash
npm start
```

## 📦 Crear el instalador

Para crear el instalador de Windows:

```bash
npm run make
```

El instalador se generará en:
```
out/make/squirrel.windows/x64/Voice2TextJS_Electron-1.0.0 Setup.exe
```

## 📂 Estructura de directorios necesaria

```
Voice2TextJS_Electron/
├── whisper.cpp/
│   └── build/
│       └── bin/
│           └── Release/
│               ├── whisper-cli.exe
│               ├── whisper.dll
│               ├── ggml-base.dll
│               ├── ggml-cpu.dll
│               └── ggml.dll
├── models/
│   └── ggml-small-q8_0.bin
└── ...
```

## 🎙️ Grabación y Transcripción de Audio

### Sistema de Grabación
- **Grabación en Tiempo Real**: Captura de audio mediante Web Audio API.
- **Visualización de Ondas**: Representación visual del input de audio en tiempo real.
- **Control de Calidad**: 
  - Muestreo a 44.1kHz.
  - Canal mono para optimizar el procesamiento.
  - Codificación optimizada a 128kbps.
  - Reducción de ruido y cancelación de eco integrados.

### Proceso de Transcripción
1. **Grabación**: 
   - Pulse el botón del micrófono para iniciar.
   - Las ondas de audio se visualizarán en tiempo real.
   - Vuelva a pulsar para detener la grabación.

2. **Procesamiento**:
   - El audio se guarda temporalmente.
   - Se convierte al formato requerido por Whisper.cpp.
   - Se muestra un modal con animación durante el proceso.

3. **Resultado**:
   - La transcripción se copia automáticamente al portapapeles.
   - Se muestra una notificación de éxito.
   - El texto está listo para usar inmediatamente.

### Optimizaciones
- Procesamiento asíncrono para evitar bloqueos.
- Buffer optimizado para reducir el uso de memoria.
- Limpieza automática de archivos temporales.
- Sistema de notificaciones integrado.

## 🎨 Temas y Personalización

### Modo Oscuro
- Fondo oscuro suave (#1e1e1e).
- Acentos en tonos rosa suave (#F49D96).
- Textos en blanco para máximo contraste.
- Notificaciones con fondo semi-transparente.
- Ideal para uso nocturno o ambientes con poca luz.

<img src="https://i.imgur.com/V4hWiru.png">

### Modo Claro
- Fondo blanco limpio.
- Acentos en rojo (#F34235).
- Textos en negro para mejor legibilidad.
- Notificaciones con fondo oscuro para contraste.
- Perfecto para uso diurno o ambientes brillantes.

<img src="https://i.imgur.com/JFFh5MJ.png">

### Cambio de Tema
- Botón dedicado en la esquina inferior derecha.
- Transición suave entre modos (0.3s).
- Persistencia del tema elegido.
- Actualización inmediata de todos los elementos.

## 🔄 Actualizaciones

La aplicación incluye un sistema de actualización automática. Cuando haya una nueva versión disponible:
1. Se notificará al usuario.
2. La actualización se descargará automáticamente.
3. Se instalará al reiniciar la aplicación.

## 🛠️ Solución de problemas

### Error común 1: No se encuentra whisper.dll
- Verificar que todas las DLLs necesarias están en el directorio correcto.
- Recompilar Whisper.cpp si es necesario.

### Error común 2: No se encuentra el modelo
- Verificar que el modelo está en el directorio `models`.
- Comprobar que el nombre del modelo coincide con el configurado.

## Tecnologías utilizadas

- ElectronJS
- JavaScript (ES6+)
- HTML5
- CSS3

## ✍️ Contacto

Si tienes preguntas, comentarios, o deseas discutir sobre posibles colaboraciones, no dudes en contactarme.

- Autor: David Padilla Muñoz
- Email: padish_dev@proton.me
- LinkedIn: https://www.linkedin.com/in/david-padilla-mu%C3%B1oz-52126725a/
