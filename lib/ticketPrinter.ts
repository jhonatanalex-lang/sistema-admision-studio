/**
 * Impresión de Ticket 80mm optimizada para impresoras térmicas (POS-D TP 300 PRO y compatibles ESC/POS).
 * Soporta doble vía:
 * 1. En App de Escritorio (Electron): Impresión 100% silenciosa directa al hardware sin cuadros de diálogo.
 * 2. En Navegadores Web (Chrome / Edge): Impresión vía iframe fuera de pantalla con compatibilidad Chromium y soporte para flag --kiosk-printing.
 * Incluye orientación con croquis vectorial monocromático (1-bit) para Ciudad Universitaria UNSAAC (Cusco).
 */

import {
  DoorId,
  DoorInfo,
  OFFICIAL_DOORS,
  Pavilion,
  resolvePavilion,
  isSedeCusco,
  generateCampusRouteSvg,
  generateRouteInstructions,
  loadLiveCampusMap,
  syncCampusMapFromCloud,
} from './campusMapSvg';

export type { DoorId, DoorInfo, Pavilion };
export {
  OFFICIAL_DOORS,
  resolvePavilion,
  isSedeCusco,
  generateCampusRouteSvg,
  generateRouteInstructions,
  loadLiveCampusMap,
  syncCampusMapFromCloud,
};

export interface TicketPostulanteData {
  dni: string;
  nombres_apellidos?: string;
  apellidos?: string;
  nombres?: string;
  sede?: string;
  aula?: string;
  carpeta?: string;
  carrera?: string;
  grupo?: string;
  hora_ingreso?: string | null;
  pabellon?: string;
  nombre_pabellon?: string;
  puerta_ingreso?: DoorId | string;
}

export function getSavedKioskDoor(): DoorId {
  if (typeof localStorage === 'undefined') return 'P2';
  try {
    const saved = localStorage.getItem('kiosk_current_door');
    if (saved && (saved === 'P1' || saved === 'P2' || saved === 'P4' || saved === 'P6')) {
      return saved as DoorId;
    }
  } catch (e) {}
  return 'P2';
}

export function saveKioskDoor(door: DoorId) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem('kiosk_current_door', door);
  } catch (e) {}
}

/**
 * Normaliza cualquier identificador o texto a un DoorId válido ('P1' | 'P2' | 'P4' | 'P6')
 */
export function normalizeDoorId(doorInput?: string | null): DoorId {
  if (!doorInput) return getSavedKioskDoor();
  const s = String(doorInput).toUpperCase().trim();
  if (s.includes('1') || s === 'P1') return 'P1';
  if (s.includes('4') || s === 'P4') return 'P4';
  if (s.includes('6') || s === 'P6') return 'P6';
  return 'P2'; // Predeterminado Puerta 2
}

export function generateTicketHtml(
  postulante: TicketPostulanteData,
  simulacroNombre: string,
  selectedDoor?: DoorId | string
): string {
  const horaActual = postulante.hora_ingreso
    ? new Date(postulante.hora_ingreso).toLocaleTimeString('es-PE', { hour12: false })
    : new Date().toLocaleTimeString('es-PE', { hour12: false });
  const fechaActual = postulante.hora_ingreso
    ? new Date(postulante.hora_ingreso).toLocaleDateString('es-PE')
    : new Date().toLocaleDateString('es-PE');

  const nombreCompleto =
    postulante.nombres_apellidos ||
    [postulante.apellidos, postulante.nombres].filter(Boolean).join(', ') ||
    'POSTULANTE';

  // Determinación de Sede Central (Cusco) vs Filiales
  const isCusco = isSedeCusco(postulante.sede);

  // Normalizar Puerta de Ingreso
  const liveMap = loadLiveCampusMap();
  const doorKey = normalizeDoorId(selectedDoor || postulante.puerta_ingreso);
  const doorInfo = (liveMap.doors && liveMap.doors[doorKey]) || OFFICIAL_DOORS[doorKey] || OFFICIAL_DOORS.P2;

  // En Cusco calculamos el pabellón de destino y croquis de ruta
  let targetPavilion: Pavilion | null = null;
  let croquisSvgHtml = '';
  let routeInstructions = '';

  if (isCusco) {
    targetPavilion = resolvePavilion(postulante);
    croquisSvgHtml = generateCampusRouteSvg(doorKey, targetPavilion);
    routeInstructions = generateRouteInstructions(doorKey, targetPavilion);
  }

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Ticket Ingreso - ${postulante.dni}</title>
    <style>
      @page {
        size: 80mm auto;
        margin: 0mm;
      }
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      html, body {
        width: 72mm;
        max-width: 72mm;
        margin: 0;
        padding: 1.5mm 1.5mm 6mm 1.5mm;
        color: #000000 !important;
        background-color: #ffffff !important;
        font-family: 'Courier New', Courier, monospace, 'Segoe UI', Arial, sans-serif;
        font-size: 11px;
        font-weight: 700;
        line-height: 1.2;
        visibility: visible !important;
        opacity: 1 !important;
      }
      @media print {
        html, body {
          width: 72mm !important;
          max-width: 72mm !important;
          margin: 0 !important;
          padding: 1.5mm 1mm 6mm 1mm !important;
          color: #000000 !important;
          background: #ffffff !important;
          visibility: visible !important;
          opacity: 1 !important;
          display: block !important;
        }
        * {
          color: #000000 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
      .text-center { text-align: center; }
      .text-right { text-align: right; }
      .title { font-size: 12px; font-weight: 900; margin: 0; letter-spacing: -0.5px; line-height: 1.15; }
      .subtitle { font-size: 10.5px; margin: 1px 0; font-weight: 700; }
      .divider { border-top: 1px dashed #000000; margin: 4px 0; }
      .row { display: flex; justify-content: space-between; margin: 2.5px 0; font-size: 10.5px; font-weight: 700; }
      .big-box { border: 2px solid #000000; padding: 4px; margin: 5px 0; text-align: center; }
      .big-text { font-size: 18px; font-weight: 900; letter-spacing: -0.5px; }
      .route-box {
        border: 1px solid #000000;
        padding: 4px;
        margin: 4px 0;
        font-size: 9px;
        line-height: 1.25;
        background-color: #ffffff;
      }
    </style>
  </head>
  <body>
    <div class="text-center">
      <p class="title">UNIVERSIDAD NACIONAL DE SAN ANTONIO ABAD DEL CUSCO</p>
      <p class="subtitle">DIRECCIÓN DE ADMISIÓN</p>
      <div class="divider"></div>
      <p class="subtitle" style="text-transform: uppercase;">${simulacroNombre}</p>
      <div class="divider"></div>
    </div>

    <div class="row">
      <span>FECHA: ${fechaActual}</span>
      <span>HORA: ${horaActual}</span>
    </div>
    
    <div class="divider"></div>
    <div>POSTULANTE:</div>
    <div style="font-size: 13px; font-weight: 900; margin-bottom: 3px; word-break: break-word;">
      ${nombreCompleto}
    </div>
    <div class="row" style="font-size: 12px;">
      <span>DNI:</span>
      <span style="font-size: 14px; font-weight: 900;">${postulante.dni}</span>
    </div>
    <div class="divider"></div>

    <div class="big-box">
      <div style="font-size: 10px; font-weight: 900; letter-spacing: 0.5px;">AULA DE EVALUACIÓN</div>
      <div class="big-text">${postulante.aula || 'S/A'}</div>
      <div>CARPETA Nº: <strong style="font-size: 17px;">${postulante.carpeta || 'S/N'}</strong></div>
      ${targetPavilion ? `
      <div style="margin-top: 2px; padding-top: 2px; border-top: 1px dotted #000000; font-size: 10px; font-weight: 900;">
        PABELLÓN N° ${targetPavilion.num} - ${targetPavilion.name.toUpperCase()}
      </div>` : ''}
    </div>

    <div class="row">
      <span>SEDE:</span>
      <span>${postulante.sede || 'SEDE CENTRAL'}</span>
    </div>
    <div class="row">
      <span>GRUPO / ÁREA:</span>
      <span>${postulante.grupo || 'ÚNICO'}</span>
    </div>
    <div style="margin-top: 2px;">
      <span>ESCUELA PROFESIONAL:</span>
      <div style="font-size: 10.5px; font-weight: 800; word-break: break-word;">
        ${postulante.carrera || 'NO ESPECIFICADA'}
      </div>
    </div>

    ${isCusco && targetPavilion ? `
      <div class="divider"></div>
      <div class="text-center" style="margin: 2px 0;">
        <div style="font-size: 10px; font-weight: 900; letter-spacing: -0.3px; text-transform: uppercase;">
          🗺️ CROQUIS DE RUTA A SU PABELLÓN
        </div>
        <div style="font-size: 9px; font-weight: 800;">
          INGRESO: ${doorInfo.label} (${doorInfo.avenue})
        </div>
      </div>

      <!-- Croquis Monocromático de Alto Contraste para Ticketera Térmica -->
      ${croquisSvgHtml}

      <div class="route-box">
        <strong>ORIENTACIÓN:</strong> ${routeInstructions}
      </div>
    ` : ''}

    <div class="divider"></div>
    <div class="text-center" style="font-size: 9.5px; margin-top: 4px;">
      [ ✔ ] INGRESO VERIFICADO Y CONFORME
      <br>
      Conserve este ticket para su ubicación y control
    </div>
    <br/><br/>
  </body>
</html>`;
}

export async function getAvailablePrinters(): Promise<Array<{ name: string; isDefault: boolean; displayName?: string }>> {
  try {
    const electronAPI = typeof window !== 'undefined' ? (window as any).electronAPI : undefined;
    if (electronAPI?.getPrinters) {
      return await electronAPI.getPrinters();
    }
  } catch (e) {
    console.warn('No se pudieron obtener impresoras:', e);
  }
  return [];
}

export function getSavedPrinterName(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem('kiosk_printer_name');
}

export function savePrinterName(printerName: string) {
  if (typeof localStorage === 'undefined') return;
  if (!printerName) {
    localStorage.removeItem('kiosk_printer_name');
  } else {
    localStorage.setItem('kiosk_printer_name', printerName);
  }
}

export const printTicket80mm = async (
  postulante: TicketPostulanteData,
  simulacroNombre: string,
  printerName?: string,
  selectedDoor?: DoorId | string
) => {
  try {
    const htmlContent = generateTicketHtml(postulante, simulacroNombre, selectedDoor);
    const chosenPrinter = printerName || getSavedPrinterName() || undefined;

    // 1. VÍA ESCRITORIO (ELECTRON): Impresión 100% silenciosa por IPC
    const electronAPI = typeof window !== 'undefined' ? (window as any).electronAPI : undefined;
    if (electronAPI?.printTicket80mm) {
      console.log(`[Print] Enviando a ticketera térmica mediante canal Electron... ${chosenPrinter ? `(Impresora: ${chosenPrinter})` : '(Impresora predeterminada)'}`);
      const result = await electronAPI.printTicket80mm({ htmlContent, printerName: chosenPrinter });
      if (result?.success) {
        return;
      }
      console.warn('[Print] Falló impresión nativa de Electron, recurriendo a modo web:', result?.error);
    }

    // 2. VÍA WEB (CHROME / EDGE): Iframe visible para Chromium con viewport real pero fuera de pantalla
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '-9999px';
    iframe.style.width = '350px';
    iframe.style.height = '600px';
    iframe.style.border = '0';
    iframe.style.zIndex = '-9999';
    iframe.style.visibility = 'visible';
    iframe.style.opacity = '1';
    iframe.setAttribute('title', 'ticket-print-frame');
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      return;
    }

    doc.open();
    doc.write(htmlContent);
    doc.close();

    // Esperar 400ms para asegurar que el motor de renderizado y fuentes estén listos
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) {
        console.error('Error al invocar iframe.print():', e);
      }

      // Remover del DOM con margen suficiente para que el spooler de Windows procese el trabajo
      setTimeout(() => {
        if (iframe.parentNode) {
          document.body.removeChild(iframe);
        }
      }, 4000);
    }, 400);
  } catch (err) {
    console.error('Error general en printTicket80mm:', err);
  }
};
