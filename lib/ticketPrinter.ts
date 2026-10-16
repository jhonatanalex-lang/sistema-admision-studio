/**
 * Impresión de Ticket 80mm optimizada para impresoras térmicas (POS-D TP 300 PRO y compatibles ESC/POS).
 * Genera un iframe temporal aislado con el layout exacto de 80mm y lanza el diálogo de impresión nativo.
 */

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
}

export const printTicket80mm = (postulante: TicketPostulanteData, simulacroNombre: string) => {
  try {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const horaActual = postulante.hora_ingreso 
      ? new Date(postulante.hora_ingreso).toLocaleTimeString('es-PE', { hour12: false })
      : new Date().toLocaleTimeString('es-PE', { hour12: false });
    const fechaActual = postulante.hora_ingreso
      ? new Date(postulante.hora_ingreso).toLocaleDateString('es-PE')
      : new Date().toLocaleDateString('es-PE');

    const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Ticket Ingreso - ${postulante.dni}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0;
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              width: 72mm;
              margin: 0 auto;
              padding: 4mm 2mm;
              color: #000;
              font-size: 12px;
              font-weight: bold;
              line-height: 1.25;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .title { font-size: 13px; font-weight: 900; margin: 0; letter-spacing: -0.5px; }
            .subtitle { font-size: 11px; margin: 2px 0; }
            .divider { border-top: 1px dashed #000; margin: 6px 0; }
            .row { display: flex; justify-content: space-between; margin: 3px 0; font-size: 11px; }
            .big-box { border: 2px solid #000; padding: 6px; margin: 6px 0; text-align: center; }
            .big-text { font-size: 18px; font-weight: 900; }
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
          <div style="font-size: 14px; font-weight: 900; margin-bottom: 4px;">
            ${postulante.nombres_apellidos || [postulante.apellidos, postulante.nombres].filter(Boolean).join(', ') || 'POSTULANTE'}
          </div>
          <div>DNI: <span style="font-size: 15px;">${postulante.dni}</span></div>
          <div class="divider"></div>
          <div class="big-box">
            <div>AULA DE EVALUACIÓN</div>
            <div class="big-text">${postulante.aula || 'S/A'}</div>
            <div>CARPETA Nº: <strong style="font-size: 16px;">${postulante.carpeta || 'S/N'}</strong></div>
          </div>
          <div class="row">
            <span>SEDE:</span>
            <span>${postulante.sede || 'SEDE CENTRAL'}</span>
          </div>
          <div class="row">
            <span>GRUPO:</span>
            <span>${postulante.grupo || 'ÚNICO'}</span>
          </div>
          <div style="margin-top: 4px;">
            <span>CARRERA:</span>
            <div style="font-size: 11px;">${postulante.carrera || 'NO ESPECIFICADA'}</div>
          </div>
          <div class="divider"></div>
          <div class="text-center" style="font-size: 10px; margin-top: 6px;">
            [ ✔ ] INGRESO VERIFICADO
            <br>
            Conserve este ticket para su ubicación
          </div>
          <br/><br/>
        </body>
      </html>
    `;
    iframe.contentWindow?.document.open();
    iframe.contentWindow?.document.write(content);
    iframe.contentWindow?.document.close();
    iframe.contentWindow?.focus();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (iframe.parentNode) {
          document.body.removeChild(iframe);
        }
      }, 1500);
    }, 250);
  } catch (err) {
    console.error('Error al imprimir ticket 80mm:', err);
  }
};
