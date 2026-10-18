@echo off
title Kiosko UNSAAC - Impresion Termica Silenciosa
echo =====================================================================
echo  DIRECCION DE ADMISION UNSAAC - CONTROL DE INGRESO (KIOSKO)
echo  Iniciando Google Chrome con bandera --kiosk-printing...
echo =====================================================================
echo.
echo Con este modo:
echo  1. Chrome envia los tickets directamente a la ticketera POS-D 80mm.
echo  2. NO se muestra ventana de vista previa ni confirmacion de impresion.
echo  3. Tiempo de impresion: ~0.2 segundos por postulante.
echo.

:: Detectar ruta tipica de Google Chrome en 64-bit y 32-bit
set CHROME_PATH=""
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    set CHROME_PATH="%ProgramFiles%\Google\Chrome\Application\chrome.exe"
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    set CHROME_PATH="%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
) else if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
    set CHROME_PATH="%LocalAppData%\Google\Chrome\Application\chrome.exe"
)

if %CHROME_PATH%=="" (
    echo [ADVERTENCIA] No se encontro chrome.exe en las rutas estandar.
    echo Intentando comando generico 'start chrome'...
    start chrome --kiosk-printing "http://localhost:3000/#/entry-control"
) else (
    echo Iniciando Chrome desde %CHROME_PATH%...
    start "" %CHROME_PATH% --kiosk-printing "http://localhost:3000/#/entry-control"
)

echo Listo. La ventana de Kiosko esta activa.
