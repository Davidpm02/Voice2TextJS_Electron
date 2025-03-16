// Referencias a los elementos principales del DOM
const toogleDisplayBtn = document.querySelector('.toogle_display_btn');
const microBtn = document.querySelector('.micro_btn');

// Estado del modo
let isDarkMode = true;

// Estado del microfono
let isMicroOff = true;

// Evento para el botón de cambio de modo
toogleDisplayBtn.addEventListener('click', () => {

    // Lógica para cambiar el modo
    isDarkMode = !isDarkMode;

    // Aplicar el nuevo modo
    document.body.classList.toggle('dark_mode', isDarkMode);
    document.body.classList.toggle('light_mode', !isDarkMode);

    // Reseteo el estado del micrófono a apagado
    isMicroOff = true;

    // Modifico el icono de los botones
    toogleDisplayBtn.style.backgroundImage = isDarkMode ? 'url(../../src/icons/light_mode_ico.png)' : 'url(../../src/icons/dark_mode_ico.png)';
    microBtn.style.backgroundImage = isDarkMode ? 'url(../../src/icons/micro_off_dark_ico.png)' : 'url(../../src/icons/micro_off_light_ico.png)';
});

// Evento para el botón de microfono
microBtn.addEventListener('click', () => {
    // Lógica para cambiar el estado del microfono
    isMicroOff = !isMicroOff;

    // Modifico el icono del botón
    if (isDarkMode) {
        microBtn.style.backgroundImage = isMicroOff ? 'url(../../src/icons/micro_off_dark_ico.png)' : 'url(../../src/icons/micro_on_dark_ico.png)';
    } else {
        microBtn.style.backgroundImage = isMicroOff ? 'url(../../src/icons/micro_off_light_ico.png)' : 'url(../../src/icons/micro_on_light_ico.png)';
    }
});
