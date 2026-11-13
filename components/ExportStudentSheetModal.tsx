import React, { useState, useMemo } from 'react';
import { IntegratedStudentData, ApplicantApplicationRecord } from './IntegratedStudentModal';
import { fixCareerName, isApplicantAdmitted } from '../pages/StudentLookup';
import { getGatewayBaseUrl } from '../lib/fileGateway';

export interface ExportStudentSheetModalProps {
  data: IntegratedStudentData;
  gatewayUrl: string;
  onClose: () => void;
  onFallbackJsPDF?: () => void;
}

interface ExamItem {
  id: string;
  proceso: string;
  carrera: string;
  carrera2?: string;
  fecha_examen: string;
  nota: string;
  puesto: string;
  grupo: string;
  aula?: string;
  condicion: string;
  hasDocuments: boolean;
  docCount: number;
  foto_rel?: string;
  dni_rel?: string;
  cert_rel?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  isAdmitted: boolean;
}

const KNOWN_EXAM_DATES: Record<string, string> = {
  'ORDINARIO 2026-II': '18/07/2026',
  'ORDINARIO 2026-I': '07/02/2026',
  'PRIMERA OPORTUNIDAD 2026': '06/12/2025',
  'DIRIMENCIA 2026': '10/02/2026',
  'EXONERADOS 2026': '07/02/2026',
  'ORDINARIO 2025-II': '20/07/2025',
  'ORDINARIO 2025-I': '08/02/2025',
  'PRIMERA OPORTUNIDAD 2025': '08/12/2024',
  'DIRIMENCIA 2025': '11/02/2025',
  'ORDINARIO 2024-II': '21/07/2024',
  'ORDINARIO 2024-I': '10/02/2024',
  'PRIMERA OPORTUNIDAD 2024': '03/12/2023',
  'DIRIMENCIA 2024': '13/02/2024',
  'ORDINARIO 2023-II': '23/07/2023',
  'ORDINARIO 2023-I': '12/02/2023',
  'PRIMERA OPORTUNIDAD 2023': '04/12/2022',
  'ORDINARIO 2022-II': '29/09/2022',
  'ORDINARIO 2022-I': '13/02/2022',
};

function formatExamDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const clean = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    const [y, m, d] = clean.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  return clean;
}

function resolveExamDate(proceso: string, rawRow?: any, adm?: any): string {
  if (adm?.FECHAINGRESO) {
    const f = formatExamDate(adm.FECHAINGRESO);
    if (f) return f;
  }
  if (rawRow?.fecha_examen || rawRow?.FechaExamen || rawRow?.FECHAINGRESO || rawRow?.fecha_evaluacion) {
    const f = formatExamDate(rawRow.fecha_examen || rawRow.FechaExamen || rawRow.FECHAINGRESO || rawRow.fecha_evaluacion);
    if (f) return f;
  }
  const upper = (proceso || '').toUpperCase();
  for (const [key, d] of Object.entries(KNOWN_EXAM_DATES)) {
    if (upper.includes(key)) return d;
  }
  return '—';
}

export const ExportStudentSheetModal: React.FC<ExportStudentSheetModalProps> = ({
  data,
  gatewayUrl,
  onClose,
  onFallbackJsPDF
}) => {
  const [exportMode, setExportMode] = useState<'single' | 'consolidated' | 'separated'>('consolidated');
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [includeAttachments, setIncludeAttachments] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Extract all exams from admissions and applications
  const availableExams = useMemo<ExamItem[]>(() => {
    const list: ExamItem[] = [];
    const matchedAppIds = new Set<string>();

    // 1. Admissions (participantes)
    data.admissions.forEach((adm, idx) => {
      const proceso = adm.MODALIDAD 
        ? (adm.MODALIDAD.includes(adm.ANIO || '') ? adm.MODALIDAD : `${adm.MODALIDAD} ${adm.ANIO || ''}-${adm.SEMESTRE || ''}`.trim())
        : `INGRESO OFICIAL ${adm.ANIO || ''}-${adm.SEMESTRE || ''}`.trim();
      
      const carrera = fixCareerName(adm.CARRERA) || 'CARRERA UNIVERSITARIA';
      const fechaExamen = resolveExamDate(proceso, null, adm);
      const nota = String(adm.NOTA || '').trim() || '—';
      const puesto = adm.OMERITO ? String(adm.OMERITO).trim() : '—';

      // Match documents
      const docsForAdm = data.documents.filter(d => {
        const p = (d.path || d.relativePath || '').toUpperCase();
        return (adm.ANIO && p.includes(adm.ANIO)) || (adm.SEMESTRE && p.includes(`-${adm.SEMESTRE}`)) || p.includes('INGRESO');
      });

      const foto = docsForAdm.find(d => d.category === 'FOTO' || (d.name || d.filename).startsWith('1_1_'));
      const dniDoc = docsForAdm.find(d => d.category === 'DNI' || (d.name || d.filename).startsWith('2_1_'));
      const certDoc = docsForAdm.find(d => d.category === 'CERTIFICADO' || (d.name || d.filename).startsWith('3_1_'));

      list.push({
        id: `adm-${adm.id || idx}`,
        proceso: proceso.toUpperCase(),
        carrera,
        fecha_examen: fechaExamen,
        nota,
        puesto,
        grupo: '—',
        condicion: 'INGRESANTE OFICIAL',
        hasDocuments: docsForAdm.length > 0,
        docCount: docsForAdm.length,
        foto_rel: foto ? (foto.relativePath || foto.path) : undefined,
        dni_rel: dniDoc ? (dniDoc.relativePath || dniDoc.path) : undefined,
        cert_rel: certDoc ? (certDoc.relativePath || certDoc.path) : undefined,
        telefono: adm.telefono,
        email: adm.email,
        direccion: adm.direccion,
        isAdmitted: true
      });
    });

    // 2. Applications (pre_revision_archivos)
    data.applications.forEach((app, idx) => {
      if (matchedAppIds.has(app.id)) return;

      const isAdmitted = isApplicantAdmitted(app.condicion, app.rawRow);
      const proceso = String(app.modalidad || 'PROCESO DE ADMISIÓN').toUpperCase();
      const carrera = fixCareerName(isAdmitted ? (app.carreraIngreso || app.carrera1 || app.carrera2) : (app.carrera1 || app.carrera2 || app.carreraIngreso)) || 'CARRERA UNIVERSITARIA';
      const carrera2 = app.carrera2 ? fixCareerName(app.carrera2) : undefined;
      const fechaExamen = resolveExamDate(proceso, app.rawRow, null);
      const nota = String(app.nota || '0.00').trim();
      const puesto = app.puesto ? String(app.puesto).trim() : '—';
      const grupo = app.grupo ? String(app.grupo).trim() : '—';
      const aula = app.aula ? String(app.aula).trim() : undefined;
      const condicion = String(app.condicion || (isAdmitted ? 'INGRESANTE' : 'NO ALCANZÓ VACANTE')).trim().toUpperCase();

      // Find documents for this application
      const docsForApp = data.documents.filter(d => {
        const p = (d.path || d.relativePath || '').toUpperCase();
        const procClean = proceso.replace(/CONCURSO DE ADMISIÓN\s*/i, '').trim();
        return p.includes(procClean) || (app.rawRow?._anio && p.includes(app.rawRow._anio)) || (app.rawRow?.anio && p.includes(app.rawRow.anio));
      });

      const foto = docsForApp.find(d => d.category === 'FOTO' || (d.name || d.filename).startsWith('1_1_'));
      const dniDoc = docsForApp.find(d => d.category === 'DNI' || (d.name || d.filename).startsWith('2_1_'));
      const certDoc = docsForApp.find(d => d.category === 'CERTIFICADO' || (d.name || d.filename).startsWith('3_1_'));

      list.push({
        id: `app-${app.id || idx}`,
        proceso,
        carrera,
        carrera2,
        fecha_examen: fechaExamen,
        nota,
        puesto,
        grupo,
        aula,
        condicion,
        hasDocuments: docsForApp.length > 0,
        docCount: docsForApp.length,
        foto_rel: foto ? (foto.relativePath || foto.path) : undefined,
        dni_rel: dniDoc ? (dniDoc.relativePath || dniDoc.path) : undefined,
        cert_rel: certDoc ? (certDoc.relativePath || certDoc.path) : undefined,
        telefono: app.rawRow?.telefono || app.rawRow?.Telefono || app.rawRow?.celular,
        email: app.rawRow?.email || app.rawRow?.Email,
        direccion: app.rawRow?.direccion || app.rawRow?.Direccion,
        isAdmitted
      });
    });

    return list;
  }, [data]);

  // Set default selected exam if not selected
  React.useEffect(() => {
    if (availableExams.length > 0 && !selectedExamId) {
      setSelectedExamId(availableExams[0].id);
    }
  }, [availableExams, selectedExamId]);

  // Identify latest attachments across all documents
  const latestAttachments = useMemo(() => {
    const foto = data.documents.find(d => d.category === 'FOTO' || (d.name || d.filename).startsWith('1_1_'));
    const dniDoc = data.documents.find(d => d.category === 'DNI' || (d.name || d.filename).startsWith('2_1_'));
    const certDoc = data.documents.find(d => d.category === 'CERTIFICADO' || (d.name || d.filename).startsWith('3_1_'));

    return {
      foto: foto ? (foto.relativePath || foto.path) : undefined,
      dni: dniDoc ? (dniDoc.relativePath || dniDoc.path) : undefined,
      cert: certDoc ? (certDoc.relativePath || certDoc.path) : undefined
    };
  }, [data.documents]);

  const handleGeneratePDF = async () => {
    setIsGenerating(true);
    setErrorMessage(null);

    const baseUrl = gatewayUrl || getGatewayBaseUrl() || 'http://localhost:5000';
    const chosenExam = availableExams.find(e => e.id === selectedExamId) || availableExams[0];

    const payload: any = {
      dni: data.dni,
      nombre: data.fullName,
      fecha_nac: data.birthDate || '—',
      sexo: data.gender || '—',
      ubigeo_nac: data.birthPlace || data.currentUbigeo || '—',
      nacionalidad: data.nationality || 'PERUANA',
      telefono: data.phone || '—',
      email: data.email || '—',
      direccion: data.address || '—',
      colegio: data.schoolInfo?.nombre_ie || data.schoolName || '—',
      gestion_col: data.schoolInfo?.tipo_gestion || '—',
      cod_modular: data.schoolCode || '—',
      mode: exportMode,
      includeAttachments: includeAttachments,
      selectedExam: chosenExam ? {
        proceso: chosenExam.proceso,
        fecha_examen: chosenExam.fecha_examen,
        carrera: chosenExam.carrera,
        carrera2: chosenExam.carrera2 || '—',
        grupo: chosenExam.grupo || '—',
        aula: chosenExam.aula || '—',
        puesto: chosenExam.puesto || '—',
        nota: chosenExam.nota || '0.00',
        condicion: chosenExam.condicion || '—',
        foto_rel: chosenExam.foto_rel || latestAttachments.foto,
        dni_rel: chosenExam.dni_rel || latestAttachments.dni,
        cert_rel: chosenExam.cert_rel || latestAttachments.cert
      } : undefined,
      allExams: availableExams.map(ex => ({
        proceso: ex.proceso,
        fecha_examen: ex.fecha_examen,
        carrera: ex.carrera,
        carrera2: ex.carrera2 || '—',
        grupo: ex.grupo || '—',
        puesto: ex.puesto || '—',
        nota: ex.nota || '0.00',
        condicion: ex.condicion || '—',
        foto_rel: ex.foto_rel || latestAttachments.foto,
        dni_rel: ex.dni_rel || latestAttachments.dni,
        cert_rel: ex.cert_rel || latestAttachments.cert,
        telefono: ex.telefono,
        email: ex.email,
        direccion: ex.direccion
      })),
      latestAttachments
    };

    try {
      const response = await fetch(`${baseUrl}/api/files/student-sheet-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `Error HTTP ${response.status} en servidor backend`);
      }

      // Download blob
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const safeName = data.fullName.replace(/[^a-zA-Z0-9_-]/g, '_');
      link.download = `Ficha_Oficial_${data.dni}_${safeName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      // Close modal after success
      onClose();
    } catch (err: any) {
      console.error('[ExportStudentSheetModal] Error al generar PDF:', err);
      setErrorMessage(err.message || 'No se pudo conectar con el generador PDF del servidor local.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 text-slate-100 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#800000] to-[#500000] border-b border-red-900/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <span className="material-symbols-outlined text-amber-300 text-2xl">picture_as_pdf</span>
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-wide uppercase">
                Exportar Ficha Oficial del Postulante
              </h3>
              <p className="text-xs text-amber-200 font-medium">
                UNSAAC • Dirección de Admisión — Formato Ejecutivo Institucional
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="size-8 rounded-lg bg-black/20 hover:bg-black/40 text-white flex items-center justify-center transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Student Mini Badge */}
        <div className="px-6 py-3 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-slate-400 text-base">person</span>
            <span className="font-bold text-white uppercase">{data.fullName}</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-slate-300">
            <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[11px] font-bold">
              DNI: {data.dni}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-primary/20 border border-primary/30 text-primary-light text-[11px] font-bold">
              {availableExams.length} {availableExams.length === 1 ? 'Examen' : 'Exámenes'}
            </span>
          </div>
        </div>

        {/* Body content */}
        <div className="p-6 overflow-y-auto max-h-[65vh] space-y-5">

          {/* Selector: ¿De qué exámenes desea la información? */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-300 mb-2">
              ¿De qué exámenes desea la información en el PDF?
            </label>

            <div className="grid grid-cols-1 gap-2.5">
              
              {/* Option 1: Consolidated */}
              <div 
                onClick={() => setExportMode('consolidated')}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3.5 ${
                  exportMode === 'consolidated'
                    ? 'bg-amber-950/20 border-amber-500/60 ring-1 ring-amber-500/40'
                    : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800/70 hover:border-slate-700'
                }`}
              >
                <div className={`size-5 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${
                  exportMode === 'consolidated' ? 'border-amber-400 bg-amber-400 text-slate-950' : 'border-slate-600 bg-slate-800'
                }`}>
                  {exportMode === 'consolidated' && <div className="size-2 rounded-full bg-slate-950" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-sm text-white">Todos los exámenes (Ficha Consolidada)</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Recomendado
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Genera una hoja ejecutiva unificada con tabla comparativa de todos los procesos rendidos ({availableExams.length} exámenes), fechas oficiales, notas y méritos.
                  </p>
                </div>
              </div>

              {/* Option 2: Single exam */}
              <div 
                onClick={() => setExportMode('single')}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col gap-3 ${
                  exportMode === 'single'
                    ? 'bg-amber-950/20 border-amber-500/60 ring-1 ring-amber-500/40'
                    : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800/70 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className={`size-5 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${
                    exportMode === 'single' ? 'border-amber-400 bg-amber-400 text-slate-950' : 'border-slate-600 bg-slate-800'
                  }`}>
                    {exportMode === 'single' && <div className="size-2 rounded-full bg-slate-950" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-bold text-sm text-white">Un examen específico</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Genera la ficha enfocada exclusivamente en un proceso de admisión con todos sus detalles técnicos.
                    </p>
                  </div>
                </div>

                {/* Sub-list of exams when 'single' is active */}
                {exportMode === 'single' && (
                  <div className="pl-8 pt-2 space-y-2 border-t border-slate-800/80">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Selecciona el examen a exportar:
                    </span>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {availableExams.map(ex => (
                        <div
                          key={ex.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedExamId(ex.id);
                          }}
                          className={`p-2.5 rounded-xl border cursor-pointer text-xs flex items-center justify-between gap-3 transition-colors ${
                            selectedExamId === ex.id
                              ? 'bg-primary/20 border-primary/50 text-white'
                              : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-slate-100 truncate flex items-center gap-2">
                              {ex.proceso}
                              {ex.isAdmitted && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                  Ingreso
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate mt-0.5 flex items-center gap-3">
                              <span>Carrera: <strong className="text-slate-300">{ex.carrera}</strong></span>
                              <span>• Fecha: <strong className="text-amber-300">{ex.fecha_examen}</strong></span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-bold text-slate-200">Nota: {ex.nota}</span>
                            <div className="text-[10px] text-slate-400">Puesto: #{ex.puesto}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Option 3: Separated sheets */}
              <div 
                onClick={() => setExportMode('separated')}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3.5 ${
                  exportMode === 'separated'
                    ? 'bg-amber-950/20 border-amber-500/60 ring-1 ring-amber-500/40'
                    : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800/70 hover:border-slate-700'
                }`}
              >
                <div className={`size-5 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${
                  exportMode === 'separated' ? 'border-amber-400 bg-amber-400 text-slate-950' : 'border-slate-600 bg-slate-800'
                }`}>
                  {exportMode === 'separated' && <div className="size-2 rounded-full bg-slate-950" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-sm text-white">Todos los exámenes (Fichas Separadas)</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Genera una ficha completa independiente de 1 página por cada proceso ({availableExams.length} fichas), respetando números de teléfono, correos y domicilios específicos registrados en cada postulación.
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* Attachments Checkbox */}
          <div className="pt-2 border-t border-slate-800">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeAttachments}
                onChange={e => setIncludeAttachments(e.target.checked)}
                className="mt-0.5 size-4 rounded text-amber-500 bg-slate-800 border-slate-700 focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-200 block">
                  Adjuntar documentos digitalizados en alta resolución
                </span>
                <span className="text-slate-400 leading-relaxed block mt-0.5">
                  Incluye la Fotografía reglamentaria centrada, el Documento de Identidad (DNI) y el Certificado de Educación Secundaria encontrados en el repositorio.
                </span>
              </div>
            </label>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-950/50 border border-red-800/80 text-red-200 text-xs flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-red-400 text-lg">error</span>
                <span className="font-bold">Error al generar PDF:</span>
              </div>
              <p className="pl-6 text-[11px] text-red-300 font-mono">{errorMessage}</p>
              {onFallbackJsPDF && (
                <div className="pt-1 pl-6">
                  <button
                    type="button"
                    onClick={onFallbackJsPDF}
                    className="px-3 py-1 bg-red-900/60 hover:bg-red-800 text-white rounded-lg text-xs font-bold transition-colors"
                  >
                    Descargar versión ligera de emergencia (Navegador)
                  </button>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleGeneratePDF}
            disabled={isGenerating}
            className="px-5 py-2.5 bg-gradient-to-r from-red-700 to-[#800000] hover:from-red-600 hover:to-red-800 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg shadow-red-950/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Generando Documento Oficial...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">download</span>
                <span>Generar y Descargar PDF</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
