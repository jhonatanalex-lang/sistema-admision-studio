# Plan de Implementación: Solución Integral de Impresión Térmica 80mm (Web y Escritorio Electron)

## 1. Diagnóstico del Problema y Restricciones Técnicas

### ¿Por qué no imprime actualmente?
1. **En Navegadores Web (Chrome / Edge):**
   - El script actual crea un `<iframe>` con `width: 0; height: 0;`. Los motores Chromium modernos consideran los elementos de tamaño cero como *no renderizables* y descartan silenciosamente la llamada a `.print()`.
   - Adicionalmente, los navegadores exigen que el documento dentro del iframe termine de parsear sus estilos antes de imprimir, y por defecto requieren interacción o el flag `--kiosk-printing` para no pausar en la ventana de previsualización.
2. **En la Aplicación de Escritorio (Electron):**
   - `desktop/main.js` y `desktop/preload.js` no tienen configurado ningún canal IPC para impresión térmica nativa. Al ejecutarse dentro de Electron, el `iframe.print()` queda atrapado en el sandbox del renderizador sin salida directa al hardware de Windows.

---

## 2. Solución de Doble Vía (Híbrida Web + Desktop)

### A. Para la Aplicación de Escritorio (Electron): Impresión 100% Silenciosa Directa
- **En `desktop/main.js`:**
  - Crear un manejador IPC `print-ticket-80mm` que utiliza una ventana secundaria oculta (`BrowserWindow` off-screen).
  - Cargar el contenido HTML del ticket de 80mm e invocar `webContents.print({ silent: true, printBackground: true, margins: { marginType: 'none' } })`.
  - Imprime directamente a la impresora térmica predeterminada de Windows (POS-D TP 300 PRO) en menos de 0.5 segundos **sin mostrar ninguna ventana ni confirmación**.
- **En `desktop/preload.js`:**
  - Exponer `window.electronAPI.printTicket80mm(htmlContent)` y `window.electronAPI.getPrinters()`.

### B. Para el Navegador Web (Google Chrome / Edge): Impresión Robusta y Modo Kiosk
- **En `lib/ticketPrinter.ts`:**
  - Detectar automáticamente si la aplicación corre en Electron (`window.electronAPI?.printTicket80mm`). Si es así, enviar el ticket por IPC silencioso.
  - Si corre en la Web (Chrome/Edge):
    - Configurar el iframe con dimensiones válidas en el árbol DOM (`width: 320px; height: 400px; position: fixed; top: -9999px; left: -9999px; opacity: 0; pointer-events: none;`) para que el motor Chromium jamás descarte la impresión.
    - Utilizar eventos de ciclo de vida (`iframe.onload` + `requestAnimationFrame`) antes de disparar `contentWindow.print()`.
  - Añadir soporte para el modo de acceso rápido Kiosko de Chrome/Edge (`--kiosk-printing`), el cual permite que en la web también imprima directo sin abrir la vista previa.

---

## 3. Archivos a Modificar
1. **`desktop/main.js`**: Implementar los manejadores IPC `print-ticket-80mm` y `get-printers` con impresión silenciosa en segundo plano.
2. **`desktop/preload.js`**: Exponer las funciones de impresión a través del puente de contexto seguro (`contextBridge`).
3. **`lib/ticketPrinter.ts`**:
   - Agregar detección automática de entorno (Electron vs Web).
   - Generar el HTML compatible e invocar IPC en escritorio o iframe visible fuera de pantalla en web.
   - Mejorar compatibilidad de formato térmico 80mm con márgenes exactos.
4. **`pages/PostulantEntryControl.tsx`**:
   - Indicar visualmente en pantalla el estado de impresión (ej. *"🖨️ Imprimiendo ticket..."*) y garantizar que el botón manual "Reimprimir" funcione en ambas plataformas.
5. **`desktop/package.json`**:
   - Mantener la versión actualizada para el empaquetado de producción.

---

## 4. Verificación y Pruebas
1. Prueba de compilación general (`compile_applet`) y verificación de tipos (`lint_applet`).
2. Comprobación del disparo de impresión en entorno web sin errores de consola.
3. Validación de las APIs nativas de Electron para asegurar compatibilidad con compilaciones de Windows.
