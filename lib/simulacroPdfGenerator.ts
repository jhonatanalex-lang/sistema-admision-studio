import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SimulacroResultadoItem, SimulacroComisionMiembro, SimulacroCalificacionConfig } from '../types';

let cachedShieldBase64: string | null = null;

/**
 * Obtiene el Escudo Oficial UNSAAC en formato Base64 para jsPDF.
 * Prioriza el archivo local /escudo_unsaac_oficial.png (100% offline).
 */
export async function getShieldLogoBase64(): Promise<string | null> {
  if (cachedShieldBase64) return cachedShieldBase64;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          cachedShieldBase64 = canvas.toDataURL('image/png');
          resolve(cachedShieldBase64);
          return;
        }
      } catch (e) {
        console.warn('Error convirtiendo escudo a base64:', e);
      }
      resolve(null);
    };
    img.onerror = () => {
      const fallbackImg = new Image();
      fallbackImg.crossOrigin = 'Anonymous';
      fallbackImg.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = fallbackImg.width;
          canvas.height = fallbackImg.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(fallbackImg, 0, 0);
            cachedShieldBase64 = canvas.toDataURL('image/png');
            resolve(cachedShieldBase64);
            return;
          }
        } catch (e) {}
        resolve(null);
      };
      fallbackImg.onerror = () => resolve(null);
      fallbackImg.src = 'https://cnqpzyanmmwspvemcfeb.supabase.co/storage/v1/object/public/logos/escudo%20oficial-02%20(2).png';
    };
    img.src = '/escudo_unsaac_oficial.png';
  });
}

export interface EscuelaReporteData {
  escuela: string;
  area: string;
  filial?: string;
  vacantes?: number;
  resultados: SimulacroResultadoItem[];
  comision?: SimulacroComisionMiembro[];
}

/**
 * Renderiza una sección oficial de resultados para una Escuela Profesional
 * uniendo a todas las filiales (Quillabamba, Abancay, Andahuaylas) en un único cuadro de mérito.
 */
export function appendEscuelaPageToDoc(
  doc: jsPDF,
  esc: EscuelaReporteData,
  logoBase64: string | null,
  cfg: { NOMBRE_PROCESO?: string; DEPENDENCIA?: string; isFirstPage?: boolean }
) {
  if (!cfg.isFirstPage) {
    doc.addPage();
  }

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // 1. Escudo Oficial Top-Left
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', 15, 10, 16, 20);
    } catch (e) {
      console.warn('No se pudo incrustar imagen en PDF:', e);
    }
  }

  // 2. Encabezado Central Institucional Solemnizado
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text('UNIVERSIDAD NACIONAL DE SAN ANTONIO ABAD DEL CUSCO', pageWidth / 2, 14, { align: 'center' });

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  const dependenciaText = String(cfg.DEPENDENCIA || 'DIRECCIÓN DE ADMISIÓN').toUpperCase();
  doc.text(dependenciaText, pageWidth / 2, 18, { align: 'center' });

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  const procesoText = String(cfg.NOMBRE_PROCESO || 'SIMULACRO GENERAL DESCENTRALIZADO').toUpperCase();
  doc.text(procesoText, pageWidth / 2, 22, { align: 'center' });

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('RESULTADOS DE CALIFICACIÓN GENERAL', pageWidth / 2, 26, { align: 'center' });

  // 3. Área, Escuela Profesional y Encabezado de Filiales
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  const areaLetter = String(esc.area || 'A').toUpperCase();
  doc.text('AREA    "' + areaLetter + '"', 14, 33, { align: 'left' });

  doc.setFontSize(10);
  const escuelaNameText = 'ESCUELA PROFESIONAL: ' + String(esc.escuela || 'GENERAL').toUpperCase();
  doc.text(escuelaNameText, 14, 38, { align: 'left' });

  doc.setFontSize(8.5);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(70, 70, 70);
  if (esc.filial && esc.filial !== 'GENERAL' && esc.filial !== 'TODAS') {
    doc.text('FILIAL: ' + String(esc.filial).toUpperCase(), pageWidth - 14, 38, { align: 'right' });
  } else {
    doc.text('CONSOLIDADO TODAS LAS FILIALES', pageWidth - 14, 38, { align: 'right' });
  }
  doc.setTextColor(0, 0, 0);

  // 4. Construcción del Table Body con columna FILIAL / SEDE
  const tableBody = esc.resultados.map((p, idx) => {
    let obsVal = '';
    const obsUpper = String(p.observacion || '').toUpperCase();
    if (obsUpper.includes('INGRESANTE')) {
      obsVal = p.observacion;
    } else if (p.isNsp || p.notaFinal === 'NSP' || p.notaBase === 'NSP') {
      obsVal = 'NSP';
    } else {
      obsVal = ''; // En blanco si no ingresó
    }

    let notaFormatted = 'NSP';
    if (!p.isNsp && p.notaFinal !== 'NSP') {
      const numNota = typeof p.notaFinal === 'number' ? p.notaFinal : parseFloat(String(p.notaFinal));
      notaFormatted = isNaN(numNota) ? 'NSP' : numNota.toFixed(3);
    }

    return [
      p.num || idx + 1,
      p.dni,
      String(p.nombres || '').toUpperCase(),
      String(p.sede || 'SEDE CENTRAL').toUpperCase(),
      notaFormatted,
      obsVal
    ];
  });

  autoTable(doc, {
    startY: 42,
    margin: { left: 14, right: 14 },
    theme: 'plain',
    head: [['NRO', 'CODIGO', 'APELLIDOS Y NOMBRES', 'FILIAL / SEDE', 'PROM.', 'OBSERVACIÓN']],
    body: tableBody,
    headStyles: {
      fillColor: [60, 60, 60],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      cellPadding: 2
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 22 },
      2: { halign: 'left' }, // Ancho libre (~75mm)
      3: { halign: 'center', cellWidth: 28 }, // Filial / Sede
      4: { halign: 'center', cellWidth: 18 }, // Promedio
      5: { halign: 'center', cellWidth: 28 }  // Observación
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [0, 0, 0],
      cellPadding: 1.5,
      lineColor: [220, 220, 220],
      lineWidth: 0.1
    },
    alternateRowStyles: {
      fillColor: [248, 248, 248]
    },
    didParseCell: function (data: any) {
      if (data.section === 'body' && data.column.index === 5) {
        const txt = String(data.cell.text[0] || '');
        if (txt.includes('INGRESANTE')) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = [0, 0, 0];
        } else if (txt.includes('NSP')) {
          data.cell.styles.textColor = [160, 0, 0];
        }
      }
    }
  });
}

/**
 * Añade la numeración y pie de página institucional a todas las páginas del documento.
 */
export function applyFootersToAllPages(doc: jsPDF) {
  const totalPages = (doc.internal as any).getNumberOfPages();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const dateStr = new Date().toLocaleDateString('es-PE') + ' ' + new Date().toLocaleTimeString('es-PE');

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);

    doc.text('Dirección de Admisión - UNSAAC', 14, pageHeight - 7);
    doc.text(dateStr, pageWidth / 2, pageHeight - 7, { align: 'center' });
    doc.text('Página: ' + i + ' de ' + totalPages, pageWidth - 14, pageHeight - 7, { align: 'right' });
  }
}

/**
 * Genera y descarga el PDF Oficial para una Escuela Profesional uniendo a todas las filiales.
 */
export async function generarPDFPorEscuela(esc: EscuelaReporteData, cfg: SimulacroCalificacionConfig) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const logoBase64 = await getShieldLogoBase64();

  appendEscuelaPageToDoc(doc, esc, logoBase64, {
    NOMBRE_PROCESO: cfg.proceso_nombre,
    DEPENDENCIA: cfg.dependencia,
    isFirstPage: true
  });

  applyFootersToAllPages(doc);

  const cleanFileName = `Resultados_General_${String(esc.escuela || 'Escuela').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  doc.save(cleanFileName);
}

/**
 * Genera y descarga un PDF por Filial específica (si se aplica filtro de sede).
 */
export async function generarPDFFilial(
  filialNombre: string,
  escuelas: EscuelaReporteData[],
  cfg: SimulacroCalificacionConfig
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const logoBase64 = await getShieldLogoBase64();

  escuelas.forEach((esc, idx) => {
    appendEscuelaPageToDoc(doc, esc, logoBase64, {
      NOMBRE_PROCESO: cfg.proceso_nombre,
      DEPENDENCIA: cfg.dependencia,
      isFirstPage: idx === 0
    });
  });

  applyFootersToAllPages(doc);

  const cleanFileName = `Resultados_FILIAL_${filialNombre.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  doc.save(cleanFileName);
}

/**
 * Genera y descarga el PDF Consolidado General (todas las filiales agrupadas por Área y Escuela).
 */
export async function generarPDFConsolidadoGeneral(
  escuelas: EscuelaReporteData[],
  cfg: SimulacroCalificacionConfig
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const logoBase64 = await getShieldLogoBase64();

  escuelas.forEach((esc, idx) => {
    appendEscuelaPageToDoc(doc, esc, logoBase64, {
      NOMBRE_PROCESO: cfg.proceso_nombre,
      DEPENDENCIA: cfg.dependencia,
      isFirstPage: idx === 0
    });
  });

  applyFootersToAllPages(doc);

  const cleanFileName = `Resultados_CONSOLIDADO_GENERAL_${cfg.proceso_nombre.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  doc.save(cleanFileName);
}
