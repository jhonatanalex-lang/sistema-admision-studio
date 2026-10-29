import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { VacancyReservationBatch, User } from '../types';
import { logAuditEvent } from '../lib/auditLogger';

export interface ConcludeReservationResult {
  resolutionNumber: string;
  resolutionDate: string;
  resolutionPdfUrl: string;
  batch: VacancyReservationBatch;
}

interface ConcludeReservationModalProps {
  isOpen: boolean;
  batch: VacancyReservationBatch | null;
  studentCount?: number | null;
  user: User;
  initialResolutionNumber?: string;
  initialResolutionDate?: string;
  outgoingFileId?: string;
  contextLabel?: string;
  onClose: () => void;
  onConcluded: (result: ConcludeReservationResult) => Promise<void> | void;
  notify?: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ConcludeReservationModal: React.FC<ConcludeReservationModalProps> = ({
  isOpen,
  batch,
  studentCount,
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
  const [resPdf, setResPdf] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && batch) {
      setResNumber(initialResolutionNumber || batch.resolution_number || '');
      setResDate(initialResolutionDate || batch.resolution_date || '');
      setResPdf(batch.resolution_pdf || '');
      setUploadedFileName('');
    }
  }, [isOpen, batch, initialResolutionNumber, initialResolutionDate]);

  if (!isOpen || !batch) return null;

  const showNotice = (msg: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    if (notify) {
      notify(msg, type);
    }
  };

  const handleClose = () => {
    if (isSubmitting || uploadingPdf) return;
    setUploadedFileName('');
    onClose();
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPdf(true);
    try {
      const fileExt = file.name.split('.').pop() || 'pdf';
      const fileName = `reserva_${Date.now()}.${fileExt}`;
      const filePath = `resoluciones_reservas/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documentos')
        .upload(filePath, file, {
          contentType: 'application/pdf',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl }
      } = supabase.storage.from('documentos').getPublicUrl(filePath);

      setResPdf(publicUrl);
      setUploadedFileName(file.name);
      showNotice('PDF de resolución subido correctamente', 'success');
    } catch (err: any) {
      console.error(err);
      showNotice(`Error al subir PDF: ${err.message || 'Error desconocido'}`, 'error');
    } finally {
      setUploadingPdf(false);
      if (pdfInputRef.current) {
        pdfInputRef.current.value = '';
      }
    }
  };

  const handleFinalize = async () => {
    if (!batch || !resNumber.trim() || uploadingPdf) return;
    setIsSubmitting(true);

    try {
      const cleanResNumber = resNumber.trim().toUpperCase();
      const cleanResPdf = resPdf.trim();

      const { error: updateError } = await supabase
        .from('reserva_vacantes_bloques')
        .update({
          resolution_number: cleanResNumber,
          resolution_date: resDate || null,
          resolution_pdf: cleanResPdf || null,
          status: 'Finalizado'
        })
        .eq('id', batch.id);

      if (updateError) throw updateError;

      const updatedBatch: VacancyReservationBatch = {
        ...batch,
        status: 'Finalizado',
        resolution_number: cleanResNumber,
        resolution_date: resDate || undefined,
        resolution_pdf: cleanResPdf || undefined
      };

      try {
        await logAuditEvent({
          action_type: 'Estado',
          module: 'Mesa de Partes',
          description: `Concluyó bloque de Reserva de Vacante (${batch.report_code}) mediante ${cleanResNumber}${
            batch.expediente_number ? ` [Exp. Nº ${batch.expediente_number}]` : ''
          }.`,
          user_name: user?.name,
          user_role: user?.role,
          expediente_id: outgoingFileId && UUID_REGEX.test(outgoingFileId) ? outgoingFileId : undefined,
          reference_id: cleanResNumber
        });
      } catch (auditErr) {
        console.warn('Advertencia al registrar auditoría de reserva de vacante:', auditErr);
      }

      await onConcluded({
        resolutionNumber: cleanResNumber,
        resolutionDate: resDate,
        resolutionPdfUrl: cleanResPdf,
        batch: updatedBatch
      });

      setUploadedFileName('');
    } catch (err: any) {
      console.error(err);
      showNotice(`Error al finalizar bloque de reserva: ${err.message || 'Error desconocido'}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-10 animate-in zoom-in-95">
        <h3 className="font-black text-slate-900 uppercase text-xl mb-3">
          Adjuntar Resolución
        </h3>

        <div className="mb-6 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col gap-1">
          {contextLabel && (
            <span className="w-fit text-[9px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full mb-0.5">
              {contextLabel}
            </span>
          )}
          <p className="text-xs font-black text-slate-800 uppercase break-words">
            {batch.report_code || 'BLOQUE DE RESERVA DE VACANTE'}
          </p>
          <p className="text-[10px] font-mono font-bold text-indigo-600 uppercase">
            {[
              batch.expediente_number ? `EXP: ${batch.expediente_number}` : '',
              typeof studentCount === 'number' && studentCount > 0
                ? `${studentCount} ${studentCount === 1 ? 'ESTUDIANTE' : 'ESTUDIANTES'}`
                : ''
            ]
              .filter(Boolean)
              .join(' • ')}
          </p>
        </div>

        <div className="flex flex-col gap-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
              Nº Resolución
            </span>
            <input
              value={resNumber}
              onChange={e => setResNumber(e.target.value.toUpperCase())}
              className="h-14 px-5 rounded-2xl border-2 border-slate-100 bg-slate-50 font-bold focus:border-primary focus:bg-white outline-none transition-all text-sm"
              placeholder="R-2026-..."
              autoFocus
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
              Fecha
            </span>
            <input
              type="date"
              value={resDate}
              onChange={e => setResDate(e.target.value)}
              className="h-14 px-5 rounded-2xl border-2 border-slate-100 bg-slate-50 font-bold focus:border-primary focus:bg-white outline-none transition-all text-sm"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
              Link Drive / PDF
            </span>
            <div className="flex gap-2">
              <input
                value={resPdf}
                onChange={e => {
                  setResPdf(e.target.value);
                  setUploadedFileName('');
                }}
                className="flex-1 h-14 px-5 rounded-2xl border-2 border-slate-100 bg-slate-50 text-xs font-mono focus:border-primary focus:bg-white outline-none transition-all"
                placeholder="https://drive.google.com/..."
              />
              <input
                type="file"
                accept=".pdf"
                ref={pdfInputRef}
                className="hidden"
                onChange={handlePdfUpload}
              />
              <button
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                disabled={uploadingPdf || isSubmitting}
                className="h-14 px-4 bg-slate-900 text-white rounded-2xl flex items-center justify-center hover:bg-slate-800 transition-all disabled:opacity-50 shrink-0"
                title="Subir archivo PDF"
              >
                <span className={`material-symbols-outlined ${uploadingPdf ? 'animate-spin' : ''}`}>
                  {uploadingPdf ? 'sync' : 'upload_file'}
                </span>
              </button>
            </div>
            {uploadedFileName && (
              <span className="text-[10px] font-bold text-emerald-600 ml-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">check_circle</span>
                Archivo cargado: {uploadedFileName}
              </span>
            )}
          </label>
        </div>

        <div className="mt-10 flex gap-4">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting || uploadingPdf}
            className="flex-1 font-black text-slate-400 hover:text-slate-600 uppercase text-xs tracking-widest transition-colors"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={handleFinalize}
            disabled={isSubmitting || uploadingPdf || !resNumber.trim()}
            className="flex-[2] py-4 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'PROCESANDO...' : 'FINALIZAR TRÁMITE'}
          </button>
        </div>
      </div>
    </div>
  );
};
