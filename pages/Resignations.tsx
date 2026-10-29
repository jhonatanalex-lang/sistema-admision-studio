import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Resignation, User } from '../types';
import { ConcludeResignationModal } from '../components/ConcludeResignationModal';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

interface ResignationsProps {
  user: User;
  notify?: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

interface DuplicateCleanupPlan {
  primaryId: string;
  primaryPatch: Partial<Resignation>;
  redundantIds: string[];
}

const normalizeKeyPart = (val?: string | null) =>
  String(val || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

/**
 * Consolida registros duplicados de `renuncias` generados cuando un mismo expediente
 * fue atendido más de una vez (ej. emisión de borrador + carga posterior de PDF firmado
 * o corrección de correlativo de informe).
 *
 * - Agrupa por `(student_code + expediente_number)` cuando existe Nº de expediente.
 * - Si no tiene Nº de expediente, agrupa pendientes idénticos por `(student_code + school + semester)`.
 * - Si en el grupo ya existe un registro `'Finalizado'`, prevalece el `'Finalizado'`
 *   (evitando que una copia huérfana siga apareciendo como pendiente).
 */
function consolidateResignations(rows: Resignation[]): {
  consolidated: Resignation[];
  cleanupPlans: DuplicateCleanupPlan[];
  totalRedundantRows: number;
} {
  const groups = new Map<string, Resignation[]>();

  for (const row of rows) {
    const code = normalizeKeyPart(row.student_code);
    const exp = normalizeKeyPart(row.expediente_number);
    const school = normalizeKeyPart(row.school);
    const sem = normalizeKeyPart(row.semester);

    let key: string;
    if (code && exp) {
      key = `${code}__EXP__${exp}`;
    } else if (code && row.status !== 'Finalizado') {
      key = `${code}__PEND__${school}__${sem}`;
    } else {
      key = `ID__${row.id}`;
    }

    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(row);
    } else {
      groups.set(key, [row]);
    }
  }

  const consolidated: Resignation[] = [];
  const cleanupPlans: DuplicateCleanupPlan[] = [];
  let totalRedundantRows = 0;

  for (const groupRows of groups.values()) {
    if (groupRows.length === 1) {
      consolidated.push(groupRows[0]);
      continue;
    }

    // Ordenar del más reciente al más antiguo por created_at
    const sorted = [...groupRows].sort((a, b) => {
      const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tB - tA;
    });

    // Si alguno ya está Finalizado, ese es el registro canónico
    const finalizedRow = sorted.find(r => r.status === 'Finalizado');
    const primary = finalizedRow || sorted[0];
    const others = sorted.filter(r => r.id !== primary.id);

    // Recuperar el mejor número de informe (evitar que el bug previo "INFORME 136-2026"
    // pise un informe corregido en el mismo expediente)
    const isStuck136 = (inf?: string) => normalizeKeyPart(inf) === 'INFORME 136-2026';
    let bestInformeNumber = primary.informe_number || '';
    if ((!bestInformeNumber || isStuck136(bestInformeNumber)) && others.length > 0) {
      const explicitOther = others.find(
        r => r.informe_number && !isStuck136(r.informe_number)
      );
      if (explicitOther?.informe_number) {
        bestInformeNumber = explicitOther.informe_number;
      } else if (!bestInformeNumber) {
        const anyInf = others.find(r => r.informe_number);
        if (anyInf?.informe_number) bestInformeNumber = anyInf.informe_number;
      }
    }

    const bestInformePdf =
      primary.informe_pdf || others.find(r => r.informe_pdf)?.informe_pdf || '';
    const bestSemester =
      primary.semester || others.find(r => r.semester)?.semester || '';
    const bestExpediente =
      primary.expediente_number || others.find(r => r.expediente_number)?.expediente_number || '';

    const redundantIds = others.map(r => r.id);
    totalRedundantRows += redundantIds.length;

    const mergedItem: Resignation = {
      ...primary,
      informe_number: bestInformeNumber,
      informe_pdf: bestInformePdf || primary.informe_pdf,
      semester: bestSemester,
      expediente_number: bestExpediente,
      duplicateIds: redundantIds
    };

    const primaryPatch: Partial<Resignation> = {};
    if (bestInformeNumber && bestInformeNumber !== primary.informe_number) {
      primaryPatch.informe_number = bestInformeNumber;
    }
    if (bestInformePdf && bestInformePdf !== primary.informe_pdf) {
      primaryPatch.informe_pdf = bestInformePdf;
    }
    if (bestSemester && bestSemester !== primary.semester) {
      primaryPatch.semester = bestSemester;
    }
    if (bestExpediente && bestExpediente !== primary.expediente_number) {
      primaryPatch.expediente_number = bestExpediente;
    }

    cleanupPlans.push({
      primaryId: primary.id,
      primaryPatch,
      redundantIds
    });

    consolidated.push(mergedItem);
  }

  return { consolidated, cleanupPlans, totalRedundantRows };
}

export const Resignations: React.FC<ResignationsProps> = ({ user, notify }) => {
  const [allResignations, setAllResignations] = useState<Resignation[]>([]);
  const [cleanupPlans, setCleanupPlans] = useState<DuplicateCleanupPlan[]>([]);
  const [redundantCount, setRedundantCount] = useState(0);
  const [isCleaningDuplicates, setIsCleaningDuplicates] = useState(false);

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentFilter, setCurrentFilter] = useState('Pendiente Resolución');

  // Filtros adicionales para Finalizados
  const [semesterFilter, setSemesterFilter] = useState('Todos');
  const [modalityFilter, setModalityFilter] = useState('Todos');

  // Estado Modal Finalizar
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);
  const [targetResignation, setTargetResignation] = useState<Resignation | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canManageResignations =
    user.role === 'Administrador' ||
    (user.role === 'Operador' && Boolean(user.permissions?.includes('view_renuncias')));

  // Estado Modal Eliminar Registro
  const [itemToDelete, setItemToDelete] = useState<Resignation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Estado Modal Importar CSV
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const showNotice = (msg: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    if (notify) {
      notify(msg, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${msg}`);
    }
  };

  useEffect(() => {
    fetchResignations();
  }, [searchQuery]);

  const fetchResignations = async () => {
    try {
      setLoading(true);
      let query = supabase.from('renuncias').select('*');
      if (searchQuery.trim()) {
        const term = searchQuery.trim();
        query = query.or(
          `student_name.ilike.%${term}%,student_code.ilike.%${term}%,expediente_number.ilike.%${term}%,informe_number.ilike.%${term}%`
        );
      }

      const { data, error } = await query
        .order('resolution_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const { consolidated, cleanupPlans: plans, totalRedundantRows } = consolidateResignations(
          data as Resignation[]
        );
        setCleanupPlans(plans);
        setRedundantCount(totalRedundantRows);

        const studentCodes = Array.from(
          new Set(consolidated.map(r => r.student_code).filter(Boolean))
        );

        if (studentCodes.length > 0) {
          const { data: partData } = await supabase
            .from('participantes')
            .select('CODPOSTULANTE, CARRERA, SEMESTRE, MODALIDAD')
            .in('CODPOSTULANTE', studentCodes);

          const byCodeSchoolSem = new Map<string, string>();
          const byCodeSem = new Map<string, string>();
          const byCodeSchool = new Map<string, string>();
          const byCode = new Map<string, string>();

          if (partData) {
            partData.forEach(p => {
              const c = normalizeKeyPart(p.CODPOSTULANTE);
              const s = normalizeKeyPart(p.CARRERA);
              const sem = normalizeKeyPart(p.SEMESTRE);
              if (p.MODALIDAD) {
                if (c && s && sem) byCodeSchoolSem.set(`${c}__${s}__${sem}`, p.MODALIDAD);
                if (c && sem && !byCodeSem.has(`${c}__${sem}`)) byCodeSem.set(`${c}__${sem}`, p.MODALIDAD);
                if (c && s && !byCodeSchool.has(`${c}__${s}`)) byCodeSchool.set(`${c}__${s}`, p.MODALIDAD);
                if (c && !byCode.has(c)) byCode.set(c, p.MODALIDAD);
              }
            });
          }

          const enrichedData = consolidated.map(r => {
            const c = normalizeKeyPart(r.student_code);
            const s = normalizeKeyPart(r.school);
            const sem = normalizeKeyPart(r.semester);
            const matchedModality =
              byCodeSchoolSem.get(`${c}__${s}__${sem}`) ||
              byCodeSem.get(`${c}__${sem}`) ||
              byCodeSchool.get(`${c}__${s}`) ||
              byCode.get(c) ||
              'NO REGISTRADA';

            return {
              ...r,
              modality: matchedModality
            };
          });
          setAllResignations(enrichedData);
        } else {
          setAllResignations(consolidated);
        }
      }
    } catch (err: any) {
      console.error(err);
      showNotice(`Error al cargar renuncias: ${err.message || 'Error desconocido'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCleanDatabaseDuplicates = async () => {
    if (cleanupPlans.length === 0) return;
    setIsCleaningDuplicates(true);
    try {
      let deletedTotal = 0;
      for (const plan of cleanupPlans) {
        if (Object.keys(plan.primaryPatch).length > 0) {
          const { error: patchErr } = await supabase
            .from('renuncias')
            .update(plan.primaryPatch)
            .eq('id', plan.primaryId);
          if (patchErr) throw patchErr;
        }
        if (plan.redundantIds.length > 0) {
          const { error: delErr } = await supabase
            .from('renuncias')
            .delete()
            .in('id', plan.redundantIds);
          if (delErr) throw delErr;
          deletedTotal += plan.redundantIds.length;
        }
      }

      showNotice(
        `Base de datos depurada: se eliminaron ${deletedTotal} registro(s) duplicado(s) conservando el expediente principal.`,
        'success'
      );
      await fetchResignations();
    } catch (err: any) {
      console.error(err);
      showNotice(`No se pudieron depurar duplicados en BD: ${err.message}`, 'error');
    } finally {
      setIsCleaningDuplicates(false);
    }
  };

  const handleDeleteResignation = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      const idsToRemove = [itemToDelete.id, ...(itemToDelete.duplicateIds || [])];
      const { error } = await supabase.from('renuncias').delete().in('id', idsToRemove);
      if (error) throw error;

      showNotice(`Trámite de ${itemToDelete.student_name} eliminado correctamente.`, 'success');
      setItemToDelete(null);
      await fetchResignations();
    } catch (err: any) {
      console.error(err);
      showNotice(`Error al eliminar trámite: ${err.message}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleResignationConcluded = async (resignation: Resignation) => {
    if (resignation.expediente_number) {
      try {
        await supabase
          .from('expedientes_salida')
          .update({ status: 'Finalizado' })
          .eq('ref_number', resignation.expediente_number.trim())
          .neq('status', 'Finalizado');
      } catch (e) {
        console.warn('No se pudo sincronizar estado de salida:', e);
      }
    }
    showNotice(`Renuncia de ${resignation.student_name} finalizada con éxito.`, 'success');
    setIsFinalizeModalOpen(false);
    setTargetResignation(null);
    fetchResignations();
  };

  const handleImportCSV = () => {
    if (!csvFile) return;
    setIsSubmitting(true);

    Papa.parse(csvFile, {
      header: true,
      skipEmptyLines: true,
      complete: async results => {
        try {
          const recordsToInsert = results.data.map((row: any) => {
            const getVal = (possibleKeys: string[]) => {
              const foundKey = Object.keys(row).find(k =>
                possibleKeys.some(pk => pk.toLowerCase() === k.toLowerCase().trim())
              );
              return foundKey ? row[foundKey] : '';
            };

            return {
              student_name: (getVal(['ESTUDIANTE', 'NOMBRE', 'STUDENT_NAME']) || '').toUpperCase().trim(),
              student_code: String(getVal(['CODIGO', 'COD', 'STUDENT_CODE']) || '').trim(),
              school: (getVal(['ESCUELA', 'SCHOOL', 'FACULTAD']) || '').toUpperCase().trim(),
              semester: String(getVal(['SEMESTRE', 'SEMESTER']) || '').trim(),
              expediente_number: String(getVal(['EXPEDIENTE', 'EXPEDIENTE_NUMBER', 'EXP']) || '').trim(),
              informe_number: String(getVal(['INFORME_NUM', 'INFORME_NUMBER', 'NRO_INFORME']) || '').trim(),
              status: getVal(['ESTADO', 'STATUS']) || 'Pendiente Resolución',
              informe_pdf: getVal(['INFORME_PDF', 'LINK_INFORME']),
              resolution_pdf: getVal(['RESOLUCION_PDF', 'LINK_RESOLUCION', 'RES_PDF']),
              resolution_number: getVal(['RESOLUCION_NUM', 'RESOLUTION_NUMBER', 'NRO_RESOLUCION']),
              resolution_date: getVal(['RESOLUCION_FECHA', 'RESOLUTION_DATE', 'FECHA_RESOLUCION']) || null
            };
          });

          const validRecords = recordsToInsert.filter(r => r.student_name && r.student_code);

          if (validRecords.length === 0) {
            throw new Error(
              'No se encontraron registros válidos. Verifique las columnas (ESTUDIANTE, CODIGO, ESCUELA, SEMESTRE, EXPEDIENTE, INFORME_NUM, RESOLUCION_NUM).'
            );
          }

          // Evitar insertar duplicados ya existentes en BD o repetidos dentro del propio CSV
          const existingExpKeys = new Set<string>();
          const existingPendKeys = new Set<string>();
          for (const existing of allResignations) {
            const c = normalizeKeyPart(existing.student_code);
            const exp = normalizeKeyPart(existing.expediente_number);
            const s = normalizeKeyPart(existing.school);
            const sem = normalizeKeyPart(existing.semester);
            if (c && exp) existingExpKeys.add(`${c}__EXP__${exp}`);
            if (c && s) existingPendKeys.add(`${c}__PEND__${s}__${sem}`);
          }

          const deduplicatedBatch = validRecords.filter(rec => {
            const c = normalizeKeyPart(rec.student_code);
            const exp = normalizeKeyPart(rec.expediente_number);
            const s = normalizeKeyPart(rec.school);
            const sem = normalizeKeyPart(rec.semester);

            if (c && exp) {
              const expKey = `${c}__EXP__${exp}`;
              if (existingExpKeys.has(expKey)) return false;
              existingExpKeys.add(expKey);
              return true;
            }
            const pendKey = `${c}__PEND__${s}__${sem}`;
            if (existingPendKeys.has(pendKey)) return false;
            existingPendKeys.add(pendKey);
            return true;
          });

          const skipped = validRecords.length - deduplicatedBatch.length;
          if (deduplicatedBatch.length > 0) {
            const { error } = await supabase.from('renuncias').insert(deduplicatedBatch);
            if (error) throw error;
          }

          showNotice(
            skipped > 0
              ? `Se importaron ${deduplicatedBatch.length} registro(s) nuevos (${skipped} duplicado(s) omitidos).`
              : `Se importaron ${deduplicatedBatch.length} registro(s) correctamente.`,
            'success'
          );
          setIsImportModalOpen(false);
          setCsvFile(null);
          fetchResignations();
        } catch (err: any) {
          showNotice(`Error al importar: ${err.message}`, 'error');
        } finally {
          setIsSubmitting(false);
        }
      },
      error: error => {
        showNotice(`Error al leer CSV: ${error.message}`, 'error');
        setIsSubmitting(false);
      }
    });
  };

  const pendingCount = useMemo(
    () => allResignations.filter(r => r.status === 'Pendiente Resolución').length,
    [allResignations]
  );

  const finalizedCount = useMemo(
    () => allResignations.filter(r => r.status === 'Finalizado').length,
    [allResignations]
  );

  const filteredResignations = useMemo(() => {
    return allResignations.filter(r => {
      if (currentFilter !== 'Todos' && r.status !== currentFilter) return false;
      if (currentFilter === 'Finalizado') {
        if (semesterFilter !== 'Todos' && r.semester !== semesterFilter) return false;
        if (modalityFilter !== 'Todos' && r.modality !== modalityFilter) return false;
      }
      return true;
    });
  }, [allResignations, currentFilter, semesterFilter, modalityFilter]);

  const uniqueSemesters = useMemo(() => {
    const sems = new Set(
      allResignations
        .filter(r => currentFilter === 'Todos' || r.status === currentFilter)
        .map(r => r.semester)
        .filter(Boolean)
    );
    return Array.from(sems).sort();
  }, [allResignations, currentFilter]);

  const uniqueModalities = useMemo(() => {
    const mods = new Set(
      allResignations
        .filter(r => currentFilter === 'Todos' || r.status === currentFilter)
        .map(r => r.modality)
        .filter(Boolean)
    );
    return Array.from(mods).sort();
  }, [allResignations, currentFilter]);

  const handleExportExcel = () => {
    const dataToExport = filteredResignations.map(r => ({
      ESTADO: r.status,
      ESTUDIANTE: r.student_name,
      CÓDIGO: r.student_code,
      ESCUELA: r.school,
      SEMESTRE: r.semester,
      MODALIDAD: r.modality || 'NO REGISTRADA',
      'Nº EXPEDIENTE': r.expediente_number,
      'Nº INFORME': r.informe_number,
      'Nº RESOLUCIÓN': r.resolution_number || '',
      'FECHA RESOLUCIÓN': r.resolution_date || '',
      'FECHA REGISTRO': r.created_at ? new Date(r.created_at).toLocaleDateString() : ''
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Renuncias');
    XLSX.writeFile(wb, `Reporte_Renuncias_${new Date().getTime()}.xlsx`);
  };

  return (
    <div className="w-full max-w-[1400px] mx-auto flex flex-col gap-6 p-6 md:p-8 h-full overflow-hidden">
      {/* MODAL FINALIZAR (CONCLUIR TRÁMITE) */}
      <ConcludeResignationModal
        isOpen={isFinalizeModalOpen}
        resignation={targetResignation}
        user={user}
        notify={notify}
        onClose={() => {
          setIsFinalizeModalOpen(false);
          setTargetResignation(null);
        }}
        onConcluded={({ resignation }) => handleResignationConcluded(resignation)}
      />

      {/* MODAL CONFIRMAR ELIMINACIÓN */}
      {itemToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined">delete_forever</span>
            </div>
            <h3 className="font-black text-slate-900 uppercase text-lg mb-2 text-center">
              ¿Eliminar trámite pendiente?
            </h3>
            <p className="text-xs text-slate-500 text-center leading-relaxed mb-6">
              Se eliminará el registro de renuncia de{' '}
              <strong className="text-slate-800">{itemToDelete.student_name}</strong>
              {itemToDelete.expediente_number ? ` (Exp. ${itemToDelete.expediente_number})` : ''}.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setItemToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-500 font-black uppercase text-xs hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteResignation}
                disabled={isDeleting}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white font-black uppercase text-xs shadow-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? 'Eliminando...' : 'Sí, Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6 shrink-0">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl sm:text-4xl font-black leading-tight tracking-tight text-slate-900">
            Trámite de Renuncias
          </h1>
          <p className="text-slate-500 text-base font-normal">
            Gestión integral de desvinculación académica.
          </p>
        </div>
        {(user.role === 'Administrador' ||
          (user.role === 'Operador' && user.permissions?.includes('upload_csv'))) && (
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 bg-white border-2 border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 h-12 px-6 rounded-xl font-black text-xs uppercase transition-all active:scale-95"
          >
            <span className="material-symbols-outlined">upload_file</span>
            Importar CSV
          </button>
        )}
      </div>

      {/* BANNER DE DEPURACIÓN SI EXISTEN COPIAS DUPLICADAS EN LA TABLA */}
      {user.role === 'Administrador' && redundantCount > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 shrink-0">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-amber-600">cleaning_services</span>
            <div className="text-xs">
              <p className="font-black uppercase tracking-tight">
                {redundantCount} copia(s) duplicada(s) unificada(s) automáticamente en pantalla
              </p>
              <p className="text-amber-700">
                Originadas por re-atención o recarga de informe sobre un mismo expediente. Puede depurarlas definitivamente de la base de datos.
              </p>
            </div>
          </div>
          <button
            onClick={handleCleanDatabaseDuplicates}
            disabled={isCleaningDuplicates}
            className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-black text-[11px] uppercase whitespace-nowrap transition-colors disabled:opacity-50"
          >
            {isCleaningDuplicates ? 'Depurando...' : 'Depurar Duplicados en BD'}
          </button>
        </div>
      )}

      {/* IMPORT MODAL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in zoom-in-95">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-8 py-6 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-black text-slate-900 uppercase tracking-tight">IMPORTAR RENUNCIAS (CSV)</h3>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setCsvFile(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-8 flex flex-col gap-6">
              <div className="bg-blue-50 text-blue-800 p-4 rounded-xl border border-blue-100 text-sm">
                <p className="font-bold mb-2">Instrucciones:</p>
                <p className="mb-2">
                  El archivo CSV debe contener los siguientes encabezados (no importa si son mayúsculas o minúsculas):
                </p>
                <code className="block bg-white p-2 rounded border border-blue-200 font-mono text-[10px] font-bold text-blue-900 leading-relaxed">
                  ESTUDIANTE, CODIGO, ESCUELA, SEMESTRE, EXPEDIENTE, INFORME_NUM, ESTADO, INFORME_PDF, RESOLUCION_NUM, RESOLUCION_FECHA, RESOLUCION_PDF
                </code>
                <ul className="list-disc pl-5 mt-2 text-[10px] space-y-1">
                  <li>
                    <strong>ESTADO:</strong> "Pendiente Resolución" o "Finalizado" (Opcional)
                  </li>
                  <li>
                    <strong>RESOLUCION_NUM:</strong> Solo si el estado es "Finalizado"
                  </li>
                  <li>
                    <strong>RESOLUCION_PDF:</strong> Enlace de Drive/PDF
                  </li>
                </ul>
              </div>

              <div className="relative">
                <input
                  type="file"
                  ref={csvInputRef}
                  onChange={e => setCsvFile(e.target.files?.[0] || null)}
                  className="hidden"
                  accept=".csv"
                />
                <button
                  onClick={() => csvInputRef.current?.click()}
                  className={`w-full h-16 border-2 border-dashed rounded-2xl flex items-center justify-center gap-3 text-sm font-black uppercase transition-all ${
                    csvFile
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-slate-300 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <span className="material-symbols-outlined">
                    {csvFile ? 'verified' : 'upload_file'}
                  </span>
                  {csvFile ? csvFile.name : 'SELECCIONAR ARCHIVO CSV'}
                </button>
              </div>
            </div>
            <div className="px-8 py-6 bg-slate-50 border-t flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setCsvFile(null);
                }}
                className="px-6 py-2 text-xs font-black uppercase text-slate-400"
              >
                Cancelar
              </button>
              <button
                onClick={handleImportCSV}
                disabled={isSubmitting || !csvFile}
                className="px-10 py-4 bg-primary text-white rounded-2xl text-xs font-black uppercase shadow-xl shadow-primary/30"
              >
                {isSubmitting ? 'IMPORTANDO...' : 'INICIAR IMPORTACIÓN'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm shrink-0">
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-center">
          <div className="w-full lg:w-96 relative">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400">search</span>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:bg-white outline-none"
              placeholder="Buscar por nombre, DNI, expediente o informe..."
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'Todos', label: `Todos (${allResignations.length})` },
              { id: 'Pendiente Resolución', label: `Pendientes (${pendingCount})` },
              { id: 'Finalizado', label: `Finalizado (${finalizedCount})` }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setCurrentFilter(f.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                  currentFilter === f.id
                    ? 'bg-slate-800 text-white shadow-md'
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {currentFilter === 'Finalizado' && (
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between pt-4 border-t border-slate-100">
            <div className="flex gap-4 w-full sm:w-auto">
              <label className="flex flex-col gap-1 w-full sm:w-48">
                <span className="text-[10px] font-black text-slate-500 uppercase">Semestre</span>
                <select
                  value={semesterFilter}
                  onChange={e => setSemesterFilter(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold outline-none"
                >
                  <option value="Todos">Todos los semestres</option>
                  {uniqueSemesters.map(s => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 w-full sm:w-48">
                <span className="text-[10px] font-black text-slate-500 uppercase">Modalidad</span>
                <select
                  value={modalityFilter}
                  onChange={e => setModalityFilter(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold outline-none"
                >
                  <option value="Todos">Todas las modalidades</option>
                  {uniqueModalities.map(m => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 h-9 px-4 rounded-lg font-black text-xs uppercase transition-all whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              Exportar Excel
            </button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm flex-1 flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-primary animate-spin">
              progress_activity
            </span>
          </div>
        ) : filteredResignations.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2 p-12">
            <span className="material-symbols-outlined text-4xl">inbox</span>
            <p className="text-xs font-bold uppercase">No se encontraron trámites en esta vista</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm border-b">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Estudiante</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Expediente / Informe</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Documentación</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Estado</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 text-right pr-10">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredResignations.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900 text-sm uppercase">{item.student_name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">
                        {item.student_code} • {item.school}
                        {item.semester ? ` • ${item.semester}` : ''}
                      </p>
                      {item.modality && item.modality !== 'NO REGISTRADA' && (
                        <p
                          className="text-[9px] text-indigo-500 font-black uppercase mt-1 truncate max-w-[300px]"
                          title={item.modality}
                        >
                          {item.modality}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-bold text-slate-700 font-mono">
                          {item.expediente_number ? `Exp. ${item.expediente_number}` : 'S/N Exp.'}
                        </span>
                        {item.informe_number && (
                          <span className="text-[10px] font-bold text-slate-400 uppercase">
                            {item.informe_number}
                          </span>
                        )}
                        {item.resolution_number && (
                          <span className="text-[10px] font-bold text-emerald-600 uppercase">
                            {item.resolution_number}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {item.informe_pdf && (
                          <a
                            href={item.informe_pdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded text-[9px] font-black border border-blue-100 uppercase transition-colors"
                          >
                            Ver Informe
                          </a>
                        )}
                        {item.resolution_pdf && (
                          <a
                            href={item.resolution_pdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-0.5 bg-red-50 hover:bg-red-100 text-red-600 rounded text-[9px] font-black border border-red-100 uppercase transition-colors"
                          >
                            Ver Res.
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${
                          item.status === 'Finalizado'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-orange-50 text-orange-700 border-orange-200 animate-pulse'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right pr-10">
                      {item.status !== 'Finalizado' && canManageResignations && (
                        <div className="inline-flex items-center gap-2 justify-end">
                          <button
                            onClick={() => {
                              setTargetResignation(item);
                              setIsFinalizeModalOpen(true);
                            }}
                            className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase hover:scale-105 transition-transform"
                          >
                            Finalizar
                          </button>
                          {user.role === 'Administrador' && (
                            <button
                              onClick={() => setItemToDelete(item)}
                              title="Eliminar trámite"
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <span className="material-symbols-outlined text-base leading-none">delete</span>
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
