import React from 'react';

export interface StaffEmailData {
    nombres: string;
    dni: string;
    cargo: string;
    procesoNombre: string;
    fechaExamen: string;
    fechaLimite: string;
    customMessage: string;
    confirmUrl: string;
    declineUrl: string;
}

export function generateStaffNotificationHtml(data: StaffEmailData): string {
    const formattedLimite = data.fechaLimite 
        ? new Date(data.fechaLimite).toLocaleString('es-PE', { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
          })
        : 'Plazo especificado';

    // Calculate time left
    let daysLeft = 0;
    let hoursLeft = 0;
    let minutesLeft = 0;
    let hasTimeLeft = false;

    if (data.fechaLimite) {
        const diffMs = new Date(data.fechaLimite).getTime() - Date.now();
        if (diffMs > 0) {
            hasTimeLeft = true;
            daysLeft = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            hoursLeft = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            minutesLeft = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        }
    }

    // Clean user message paragraphs
    const paragraphs = data.customMessage
        .split('\n')
        .map(p => p.trim())
        .filter(p => p.length > 0)
        .map(p => {
            const formatted = p
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/{nombre}/g, data.nombres)
                .replace(/{cargo}/g, data.cargo)
                .replace(/{fecha_examen}/g, data.fechaExamen)
                .replace(/{fecha_limite}/g, formattedLimite);
            return `<p style="margin: 0 0 14px 0; font-size: 15px; line-height: 1.6; color: #334155;">${formatted}</p>`;
        })
        .join('');

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Convocatoria de Personal Sorteado - UNSAAC</title>
  <style>
    @keyframes pulse-dot {
      0% { transform: scale(0.95); opacity: 0.8; }
      50% { transform: scale(1.15); opacity: 1; }
      100% { transform: scale(0.95); opacity: 0.8; }
    }
    @keyframes glow-button {
      0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
      70% { box-shadow: 0 0 0 12px rgba(16, 185, 129, 0); }
      100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }
    .btn-pulse {
      animation: glow-button 2s infinite !important;
    }
    .dot-pulse {
      display: inline-block;
      animation: pulse-dot 1.5s infinite;
    }
    @media only screen and (max-width: 600px) {
      .btn-container {
        display: block !important;
        width: 100% !important;
      }
      .btn-cell {
        display: block !important;
        width: 100% !important;
        padding-right: 0 !important;
        margin-bottom: 12px !important;
      }
      .btn-cell a {
        display: block !important;
        text-align: center !important;
      }
      .time-col {
        padding: 6px 10px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">

  <!-- PREHEADER (Opción F: Texto de vista previa en la bandeja de entrada de Gmail) -->
  <div style="display: none; font-size: 1px; color: #f1f5f9; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all;">
    ⚡ URGENTE: Ha sido seleccionado para ${data.cargo} en el ${data.procesoNombre}. Confirme su asistencia antes del ${formattedLimite}.
    &#847; &zwnj; &nbsp; &#8199; &shy; &#847; &zwnj; &nbsp; &#8199; &shy; &#847; &zwnj; &nbsp; &#8199; &shy; &#847; &zwnj; &nbsp; &#8199; &shy;
  </div>

  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 25px 10px;">
    <tr>
      <td align="center">
        <!-- CONTENEDOR PRINCIPAL -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 620px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 25px rgba(0,0,0,0.07); border: 1px solid #e2e8f0;">
          
          <!-- CABECERA INSTITUCIONAL UNSAAC (Opción A) -->
          <tr>
            <td style="background: linear-gradient(135deg, #790000 0%, #540000 100%); background-color: #790000; padding: 26px 24px; text-align: center; border-bottom: 4px solid #D4AF37;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <p style="margin: 0; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; color: #fde047; text-transform: uppercase;">
                      UNIVERSIDAD NACIONAL DE SAN ANTONIO ABAD DEL CUSCO
                    </p>
                    <h1 style="margin: 6px 0 0 0; font-size: 19px; font-weight: 900; color: #ffffff; letter-spacing: 0.5px;">
                      DIRECCIÓN DE ADMISIÓN
                    </h1>
                    <p style="margin: 4px 0 0 0; font-size: 13px; color: #e2e8f0; font-weight: 500;">
                      CONVOCATORIA Y DESIGNACIÓN OFICIAL DE PERSONAL
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CUERPO DEL CORREO -->
          <tr>
            <td style="padding: 28px 24px;">

              <!-- MENSAJE PERSONALIZADO -->
              <div style="margin-bottom: 22px;">
                ${paragraphs}
              </div>

              <!-- TARJETA DE ACREDITACIÓN / CREDENCIAL (Opción A) -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 5px solid #790000; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 18px 20px;">
                    <p style="margin: 0 0 12px 0; font-size: 12px; font-weight: 800; letter-spacing: 1px; color: #790000; text-transform: uppercase;">
                      📋 FICHA DE ASIGNACIÓN DE PERSONAL
                    </p>
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 5px 0; font-size: 13px; color: #64748b; width: 35%;"><strong>Personal:</strong></td>
                        <td style="padding: 5px 0; font-size: 14px; color: #0f172a; font-weight: 700;">${data.nombres}</td>
                      </tr>
                      ${data.dni ? `
                      <tr>
                        <td style="padding: 5px 0; font-size: 13px; color: #64748b;"><strong>DNI:</strong></td>
                        <td style="padding: 5px 0; font-size: 14px; color: #0f172a; font-weight: 700;">${data.dni}</td>
                      </tr>` : ''}
                      <tr>
                        <td style="padding: 5px 0; font-size: 13px; color: #64748b;"><strong>Proceso:</strong></td>
                        <td style="padding: 5px 0; font-size: 13px; color: #0f172a; font-weight: 600;">${data.procesoNombre}</td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 0; font-size: 13px; color: #64748b;"><strong>Cargo Asignado:</strong></td>
                        <td style="padding: 5px 0;">
                          <span style="display: inline-block; background-color: #fef3c7; color: #92400e; font-weight: 800; font-size: 13px; padding: 4px 10px; border-radius: 6px; border: 1px solid #fde68a;">
                            ${data.cargo}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 0; font-size: 13px; color: #64748b;"><strong>Fecha del Examen:</strong></td>
                        <td style="padding: 5px 0; font-size: 14px; color: #1e293b; font-weight: 700;">${data.fechaExamen}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CONTADOR REGRESIVO Y PLAZO DE RESPUESTA (Opción D) -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px; margin-bottom: 26px; text-align: center;">
                <tr>
                  <td style="padding: 18px 16px;">
                    <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 800; color: #92400e; text-transform: uppercase; letter-spacing: 0.8px;">
                      ⏳ PLAZO LÍMITE PARA RESPONDER
                    </p>
                    <p style="margin: 0 0 14px 0; font-size: 14px; font-weight: 700; color: #b45309;">
                      ${formattedLimite}
                    </p>
                    
                    ${hasTimeLeft ? `
                    <!-- BLOQUES DE TIEMPO DIGITALES -->
                    <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto 10px auto;">
                      <tr>
                        <td class="time-col" style="padding: 8px 14px; background-color: #ffffff; border: 1px solid #fde68a; border-radius: 8px; text-align: center;">
                          <span style="font-size: 18px; font-weight: 900; color: #92400e; display: block;">${String(daysLeft).padStart(2, '0')}</span>
                          <span style="font-size: 9px; font-weight: 800; color: #b45309; text-transform: uppercase; letter-spacing: 0.5px;">DÍAS</span>
                        </td>
                        <td style="padding: 0 6px; font-size: 18px; font-weight: 900; color: #d97706;">:</td>
                        <td class="time-col" style="padding: 8px 14px; background-color: #ffffff; border: 1px solid #fde68a; border-radius: 8px; text-align: center;">
                          <span style="font-size: 18px; font-weight: 900; color: #92400e; display: block;">${String(hoursLeft).padStart(2, '0')}</span>
                          <span style="font-size: 9px; font-weight: 800; color: #b45309; text-transform: uppercase; letter-spacing: 0.5px;">HORAS</span>
                        </td>
                        <td style="padding: 0 6px; font-size: 18px; font-weight: 900; color: #d97706;">:</td>
                        <td class="time-col" style="padding: 8px 14px; background-color: #ffffff; border: 1px solid #fde68a; border-radius: 8px; text-align: center;">
                          <span style="font-size: 18px; font-weight: 900; color: #92400e; display: block;">${String(minutesLeft).padStart(2, '0')}</span>
                          <span style="font-size: 9px; font-weight: 800; color: #b45309; text-transform: uppercase; letter-spacing: 0.5px;">MINUTOS</span>
                        </td>
                      </tr>
                    </table>
                    ` : ''}

                    <div style="display: inline-block; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 20px; padding: 4px 12px; margin-top: 4px;">
                      <span class="dot-pulse" style="color: #ef4444; font-size: 10px; vertical-align: middle;">●</span>
                      <span style="font-size: 11px; font-weight: 700; color: #b91c1c; vertical-align: middle; margin-left: 4px;">
                        RESPUESTA OBLIGATORIA PARA CONFIRMACIÓN DE PLANILLA
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- SECCIÓN DE ACCIÓN REQUERIDA (BOTONES DINÁMICOS) -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 20px 0 10px 0; text-align: center;">
                <tr>
                  <td align="center">
                    <p style="margin: 0 0 16px 0; font-size: 14px; font-weight: 800; color: #0f172a;">
                      ⚡ INDIQUE SU DISPONIBILIDAD HACIENDO CLIC EN UNA OPCIÓN:
                    </p>
                    
                    <table role="presentation" border="0" cellspacing="0" cellpadding="0" class="btn-container" style="margin: 0 auto;">
                      <tr>
                        <!-- BOTÓN SÍ, CONFIRMO -->
                        <td class="btn-cell" align="center" style="padding-right: 14px;">
                          <a href="${data.confirmUrl}" target="_blank" class="btn-pulse"
                             style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #047857 100%); background-color: #059669; color: #ffffff; font-family: Arial, sans-serif; font-size: 15px; font-weight: 800; text-decoration: none; padding: 15px 28px; border-radius: 10px; border: 1px solid #047857; box-shadow: 0 4px 16px rgba(5, 150, 105, 0.4); text-align: center; min-width: 170px;">
                            <span class="dot-pulse" style="margin-right: 6px;">🟢</span> SÍ, CONFIRMO MI ASISTENCIA
                          </a>
                        </td>

                        <!-- BOTÓN NO PODRÉ (ABRE PESTAÑA PARA JUSTIFICAR) -->
                        <td class="btn-cell" align="center">
                          <a href="${data.declineUrl}" target="_blank"
                             style="display: inline-block; background-color: #ffffff; color: #dc2626; font-family: Arial, sans-serif; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 22px; border-radius: 10px; border: 1.5px solid #fca5a5; background-color: #fff1f2; text-align: center; min-width: 140px;">
                            ✕ No Podré Asistir
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin: 25px 0 0 0; font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.5;">
                * Al hacer clic en cualquiera de las opciones se abrirá una ventana segura del sistema oficial de admisión para registrar su decisión o justificación.
              </p>

            </td>
          </tr>

          <!-- PIE DE PÁGINA INSTITUCIONAL -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center;">
              <p style="margin: 0; font-size: 12px; font-weight: 700; color: #64748b;">
                Dirección de Admisión y Centro de Cómputo - UNSAAC
              </p>
              <p style="margin: 4px 0 0 0; font-size: 11px; color: #94a3b8;">
                Ciudad Universitaria de Perayoc, Av. de la Cultura 733, Cusco - Perú
              </p>
              <p style="margin: 8px 0 0 0; font-size: 10px; color: #cbd5e1;">
                Este correo fue generado automáticamente por el Sistema de Admisión UNSAAC.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}
