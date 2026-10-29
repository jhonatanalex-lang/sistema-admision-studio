import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Resignation, User } from '../types';
import { logAuditEvent } from '../lib/auditLogger';

export interface ConcludeResignationResult {
  resolutionNumber: string;
  resolutionDate: string;
  resolutionPdfUrl: string;
  resignation: Resignation;
}

interface ConcludeResignationModalProps {
  isOpen: boolean;
  resignation: Resignation | null;
  user: User;
  initialResolutionNumber?: string;
  initialResolutionDate?: string;
  outgoingFileId?: string;
  contextLabel?: string;
  onClose: () => void;
  onConcluded: (result: ConcludeResignationResult) => Promise<void> | void;
  notify?: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ConcludeResignationModal: React.FC<ConcludeResignationModalProps> = ({
  isOpen,
  resignation,
  user,
  initialResolutionNumber = '',
  initialResolutionDate = '',
  outgoingFileId,
  contextLabel,
  onClose,
  onConcluded,
  notify
}) => {
  const [resNumber, setResNumber] = useState('');
  const [resDate, setResDate] = useState('');
  const [resDriveUrl, setResDriveUrl] = useState('');
  const [resFile, setResFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && resignation) {
      setResNumber(initialResolutionNumber || resignation.resolution_number || '');
      setResDate(initialResolutionDate || resignation.resolution_date || '');
      setResDriveUrl('');
      setResFile(null);
    }
  }, [isOpen, resignation, initialResolutionNumber, initialResolutionDate]);

  if (!isOpen || !resignation) return null;

  const showNotice = (msg: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    if (notify) {
      notify(msg, type);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setResFile(null);
    setResDriveUrl('');
    onClose();
  };

  const handleFinalize = async () => {
    if (!resignation || !resNumber.trim() || !resDate || (!resFile && !resDriveUrl.trim())) return;
    setIsSubmitting(true);

    try {
      let finalUrl = resDriveUrl.trim();

      if (resFile) {
        const sanitizedName = resFile.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const fileName = `${Date.now()}-${sanitizedName}`;
        const { error: uploadError } = await supabase.storage
          .from('documentos')
          .upload(`resoluciones/${fileName}`, resFile, {
            contentType: 'application/pdf',
            upsert: true
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('documentos')
          .getPublicUrl(`resoluciones/${fileName}`);

        finalUrl = urlData.publicUrl;
      }

      const cleanResNumber = resNumber.trim().toUpperCase();
      let updatedResignation: Resignation = {
        ...resignation,
        status: 'Finalizado',
        resolution_number: cleanResNumber,
        resolution_date: resDate,
        resolution_pdf: finalUrl
      };

      if (resignation.id) {
        const { error: updateError } = await supabase
          .from('renuncias')
          .update({
            status: 'Finalizado',
            resolution_number: cleanResNumber,
            resolution_date: resDate,
            resolution_pdf: finalUrl,
            expediente_number: resignation.expediente_number || '',
            informe_number: resignation.informe_number || '',
            informe_pdf: resignation.informe_pdf || ''
          })
          .eq('id', resignation.id);

        if (updateError) throw updateError;

        // Depurar posibles copias pendientes duplicadas del mismo expediente
        if (resignation.duplicateIds && resignation.duplicateIds.length > 0) {
          await supabase
            .from('renuncias')
            .delete()
            .in('id', resignation.duplicateIds);
        }
      } else {
        // Respaldo para informes de renuncia antiguos en expedientes_salida que aún no tenían fila en `renuncias`
        const { data: insertedData, error: insertError } = await supabase
          .from('renuncias')
          .insert([
            {
              student_name: resignation.student_name,
              student_code: resignation.student_code,
              school: resignation.school || '',
              semester: resignation.semester || '',
              expediente_number: resignation.expediente_number || '',
              informe_number: resignation.informe_number || '',
              informe_pdf: resignation.informe_pdf || '',
              status: 'Finalizado',
              resolution_number: cleanResNumber,
              resolution_date: resDate,
              resolution_pdf: finalUrl
            }
          ])
          .select('*')
          .single();

        if (insertError) throw insertError;
        if (insertedData) {
          updatedResignation = insertedData as Resignation;
        }
      }

      // Registrar trazabilidad en auditoría central
      try {
        await logAuditEvent({
          action_type: 'Estado',
          module: 'Mesa de Partes',
          description: `Concluyó trámite de renuncia de ${resignation.student_name} (Cód/DNI: ${resignation.student_code}) mediante ${cleanResNumber}${
            resignation.expediente_number ? ` [Exp. Nº ${resignation.expediente_number}]` : ''
          }.`,
          user_name: user?.name,
          user_role: user?.role,
          expediente_id: outgoingFileId && UUID_REGEX.test(outgoingFileId) ? outgoingFileId : undefined,
          reference_id: cleanResNumber
        });
      } catch (auditErr) {
        console.warn('Advertencia al registrar auditoría de conclusión de renuncia:', auditErr);
      }

      await onConcluded({
        resolutionNumber: cleanResNumber,
        resolutionDate: resDate,
        resolutionPdfUrl: finalUrl,
        resignation: updatedResignation
      });

      setResFile(null);
      setResDriveUrl('');
    } catch (err: any) {
      console.error(err);
      showNotice(`Error al finalizar renuncia: ${err.message || 'Error desconocido'}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95">
        <h3 className="font-black text-slate-900 uppercase text-xl mb-1.5 text-center">
          Concluir Renuncia
        </h3>
        <p className="text-xs text-slate-500 text-center uppercase font-bold tracking-tight">
          ALUMNO: {resignation.student_name}
        </p>

        {(resignation.school || resignation.expediente_number || resignation.informe_number || contextLabel) && (
          <div className="mt-3 mb-5 px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col items-center gap-1 text-center">
            {contextLabel && (
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                {contextLabel}
              </span>
            )}
            <p className="text-[10px] font-bold text-slate-500 uppercase">
              {[
                resignation.student_code ? `DNI/CÓD: ${resignation.student_code}` : '',
                resignation.school || '',
                resignation.semester || ''
              ]
                .filter(Boolean)
                .join(' • ')}
            </p>
            {(resignation.expediente_number || resignation.informe_number) && (
              <p className="text-[10px] font-mono font-bold text-indigo-600 uppercase">
                {[
                  resignation.expediente_number ? `EXP. ${resignation.expediente_number}` : '',
                  resignation.informe_number || ''
                ]
                  .filter(Boolean)
                  .join(' • ')}
              </p>
            )}
          </div>
        )}

        {!resignation.school && !resignation.expediente_number && !resignation.informe_number && !contextLabel && (
          <div className="mb-6" />
        )}

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-slate-500 uppercase">Nº Resolución VRAC</span>
            <input
              value={resNumber}
              onChange={e => setResNumber(e.target.value.toUpperCase())}
              className="h-12 px-4 rounded-xl border-2 border-slate-100 bg-slate-50 font-bold outline-none focus:border-indigo-300 focus:bg-white transition-all text-sm"
              placeholder="RESOLUCIÓN N° 001-2026-VRAC-UNSAAC"
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-slate-500 uppercase">Fecha Emisión</span>
            <input
              type="date"
              value={resDate}
              onChange={e => setResDate(e.target.value)}
              className="h-12 px-4 rounded-xl border-2 border-slate-100 bg-slate-50 font-bold outline-none focus:border-indigo-300 focus:bg-white transition-all text-sm"
            />
          </label>

          <div className="flex flex-col gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Documento de Resolución
            </span>

            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Subir Archivo PDF</span>
              <div className="relative">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      setResFile(e.target.files[0]);
                      setResDriveUrl('');
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  disabled={!!resDriveUrl}
                />
                <div
                  className={`h-12 px-4 rounded-xl border-2 border-dashed flex items-center justify-between transition-all ${
                    resDriveUrl
                      ? 'bg-slate-100 border-slate-200 opacity-50'
                      : resFile
                      ? 'bg-indigo-50 border-indigo-200'
                      : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30'
                  }`}
                >
                  <span
                    className={`text-xs font-bold truncate pr-4 ${
                      resFile ? 'text-indigo-700' : 'text-slate-400'
                    }`}
                  >
                    {resFile ? resFile.name : 'Seleccionar archivo PDF...'}
                  </span>
                  <span
                    className={`material-symbols-outlined text-lg ${
                      resFile ? 'text-indigo-500' : 'text-slate-300'
                    }`}
                  >
                    {resFile ? 'check_circle' : 'upload_file'}
                  </span>
                </div>
              </div>
            </label>

            <div className="flex items-center gap-3 my-1">
              <div className="h-px bg-slate-200 flex-1"></div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">O</span>
              <div className="h-px bg-slate-200 flex-1"></div>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Enlace de Drive</span>
              <input
                value={resDriveUrl}
                onChange={e => {
                  setResDriveUrl(e.target.value);
                  if (e.target.value) setResFile(null);
                }}
                className="h-12 px-4 rounded-xl border-2 border-slate-100 bg-white text-xs font-mono outline-none focus:border-indigo-300 transition-all disabled:opacity-50 disabled:bg-slate-100"
                placeholder="https://drive.google.com/..."
                disabled={!!resFile}
              />
            </label>
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex-1 font-black text-slate-400 hover:text-slate-600 uppercase text-xs transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleFinalize}
            disabled={isSubmitting || !resNumber.trim() || !resDate || (!resFile && !resDriveUrl.trim())}
            className="flex-[2] py-4 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'PROCESANDO...' : 'FINALIZAR TRÁMITE'}
          </button>
        </div>
      </div>
    </div>
  );
};
