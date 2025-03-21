# Voice2TextJS - Transcriptor de Audio con Whisper.cpp

<img src="https://i.imgur.com/DgJZx6h.png">

Aplicación de escritorio desarrollada con Electron que permite transcribir audio a texto utilizando Whisper.cpp.

## 🚀 Características

- Grabación de audio en tiempo real
- Visualizador de ondas de audio
- Transcripción automática usando Whisper.cpp
- Soporte para idioma español
- Copia automática al portapapeles
- Interfaz minimalista y fácil de usar

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

1. Crear el directorio `models` en la raíz del proyecto
2. Descargar el modelo deseado desde [Hugging Face](https://huggingface.co/ggerganov/whisper.cpp)
3. Colocar el modelo (por ejemplo, `ggml-small-q8_0.bin`) en el directorio `models`

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

## 🔄 Actualizaciones

La aplicación incluye un sistema de actualización automática. Cuando haya una nueva versión disponible:
1. Se notificará al usuario
2. La actualización se descargará automáticamente
3. Se instalará al reiniciar la aplicación

## 🛠️ Solución de problemas

### Error común 1: No se encuentra whisper.dll
- Verificar que todas las DLLs necesarias están en el directorio correcto
- Recompilar Whisper.cpp si es necesario

### Error común 2: No se encuentra el modelo
- Verificar que el modelo está en el directorio `models`
- Comprobar que el nombre del modelo coincide con el configurado

## 📄 Licencia

Este proyecto está bajo la Licencia ISC. Ver el archivo `LICENSE` para más detalles.

## ✍️ Autor

David Padilla Muñoz
