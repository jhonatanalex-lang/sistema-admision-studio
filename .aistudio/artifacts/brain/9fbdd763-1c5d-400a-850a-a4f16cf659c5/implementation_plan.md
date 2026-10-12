# Plan de Implementación: Transición de Carga y Ensamblado de Silueta del Escudo UNSAAC

## 1. Visión General
Reemplazar los textos e íconos de carga genéricos por una experiencia visual institucional de primer nivel: una pantalla de carga y bienvenida (*Splash Screen*) que muestra el escudo de Admisión UNSAAC ensamblándose mediante el trazado progresivo de su silueta vectorial dorada, culminando en la revelación del escudo oficial con efectos de luz, tipografía *Cinzel* y una transición de salida fluida.

---

## 2. Objetivos y Criterios del Usuario
- **Efecto Visual:** Escudo ensamblándose con efecto de dibujo de silueta vectorial (*SVG stroke drawing*), halos de luz dorados/institucionales y revelado cromático del emblema de Admisión.
- **Puntos de Activación:**
  1. **Carga inicial nativa (`index.html`):** Inmediata desde el milisegundo 0 antes de que el bundle de JavaScript/React se descargue, evitando pantallas blancas o parpadeos.
  2. **Verificación de sesión en React (`App.tsx`):** Sustituyendo el spinner simple de `isCheckingAuth` por el componente de transición interactivo.
  3. **Reutilizable:** Componente desacoplado `SplashScreen.tsx` con soporte para desvanecimiento suave (*fade-out*) hacia la aplicación o pantalla de inicio de sesión.

---

## 3. Arquitectura Técnica

### A. Preloader de Arranque en `index.html`
- Insertar dentro de `<div id="root">` un contenedor estilizado con CSS embebido crítico y puro (cero dependencias externas).
- Contendrá los trazados vectoriales (`<svg>`) del escudo institucional con animación de trazo continuo (`stroke-dasharray` y `stroke-dashoffset`), reflejando la heráldica y silueta del escudo de San Antonio Abad y Admisión.
- Cuando React monta el componente raíz en `#root`, reemplaza suavemente el contenido del HTML nativo.

### B. Componente React `SplashScreen.tsx`
- Componente de alta fidelidad con estados de ensamblado:
  1. **Fase 1 (0ms - 1.2s):** Trazado y dibujo perimétrico de la silueta en líneas doradas luminosas.
  2. **Fase 2 (1.2s - 2.0s):** Fusión y llenado del escudo oficial en alta resolución (`logo_admision.png` / emblema oficial) con halo radial y resplandor.
  3. **Fase 3 (2.0s+):** Subtítulos institucionales animados (*"UNIVERSIDAD NACIONAL DE SAN ANTONIO ABAD DEL CUSCO"*, *"DIRECCIÓN DE ADMISIÓN"* y microbarra de sincronización).
  4. **Fase de salida:** Desvanecimiento suave (*fade-out opacity 0 / scale 105%*) al completarse la autenticación.

### C. Integración en `App.tsx`
- Reemplazar el bloque condicional de carga:
  ```tsx
  if (isCheckingAuth) {
    return <SplashScreen message="Verificando credenciales del sistema..." />;
  }
  ```
- Permitir una experiencia visual sin saltos bruscos hacia el Dashboard o Login.

---

## 4. Archivos a Modificar / Crear
1. **`index.html`**: Estructura de preloader estático con animación CSS de dibujo vectorial directo.
2. **`components/SplashScreen.tsx`** *(Nuevo)*: Componente React para la animación de ensamblado y transición.
3. **`App.tsx`**: Integración del SplashScreen en la verificación de sesión.
4. **`index.css`** o definiciones de animación en Tailwind: Reglas de animación clave (`@keyframes assembleShield`, `@keyframes strokeDraw`).

---

## 5. Verificación y Pruebas
1. Comprobación del ciclo de vida en recarga completa (Cold Start en el navegador).
2. Verificación de compilación limpia con `compile_applet`.
3. Verificación de fluidez a 60 fps y adaptación a modo móvil y escritorio.
