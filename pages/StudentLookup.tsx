import React, { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Participant, ToastMessage, User } from '../types';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  StudentDocument, 
  getGatewayBaseUrl, 
  testGatewayHealth, 
  fetchStudentDocumentsFromGateway, 
  getDocumentStreamUrl, 
  parseDocumentInfo,
  isElectronApp 
} from '../lib/fileGateway';
import { FileGatewayModal } from '../components/FileGatewayModal';
import { DocumentViewerModal } from '../components/DocumentViewerModal';
import { 
  IntegratedStudentModal, 
  IntegratedStudentData, 
  ApplicantApplicationRecord 
} from '../components/IntegratedStudentModal';
import { parseBatchResolution } from './VacancyReservation';

type SearchMode = 'individual' | 'batch' | 'import';

interface BatchResult {
    originalCode: string;
    originalName: string;
    studentCode?: string;
    found: boolean;
    status: 'EXACT' | 'PROBABLE' | 'NOT_FOUND';
    allMatches: Participant[];
}

// Helpers for decoding and value parsing
export const fixEncoding = (text: string | undefined | null) => {
    if (!text) return '';
    let fixed = String(text);
    fixed = fixed.replace(/INGENIER[\uFFFD?]A/g, 'INGENIERÍA'); 
    fixed = fixed.replace(/EL[\uFFFD?]CTRICA/g, 'ELÉCTRICA');   
    fixed = fixed.replace(/MEC[\uFFFD?]NICA/g, 'MECÁNICA');
    fixed = fixed.replace(/INFORM[\uFFFD?]TICA/g, 'INFORMÁTICA');
    fixed = fixed.replace(/MATEM[\uFFFD?]TICA/g, 'MATEMÁTICA');
    fixed = fixed.replace(/EDUCACI[\uFFFD?]N/g, 'EDUCACIÓN');
    fixed = fixed.replace(/COMUNICACI[\uFFFD?]N/g, 'COMUNICACIÓN');
    fixed = fixed.replace(/ADMINISTRACI[\uFFFD?]N/g, 'ADMINISTRACIÓN');
    fixed = fixed.replace(/BIOLOG[\uFFFD?]A/g, 'BIOLOGÍA');
    fixed = fixed.replace(/ARQUEOLOG[\uFFFD?]A/g, 'ARQUEOLOGÍA');
    fixed = fixed.replace(/ANTROPOLOG[\uFFFD?]A/g, 'ANTROPOLOGÍA');
    fixed = fixed.replace(/PSICOLOG[\uFFFD?]A/g, 'PSICOLOGÍA');
    fixed = fixed.replace(/OBSTETRICI[\uFFFD?]A/g, 'OBSTETRICIA');
    fixed = fixed.replace(/ENFERMER[\uFFFD?]A/g, 'ENFERMERÍA');
    fixed = fixed.replace(/NU[\uFFFD?]EZ/g, 'NUÑEZ').replace(/MU[\uFFFD?]OZ/g, 'MUÑOZ').replace(/ZU[\uFFFD?]IGA/g, 'ZUÑIGA');
    return fixed;
};

// Diccionario y Mapeo Oficial de Códigos de Carreras de la UNSAAC
export const CAREER_CODE_MAP: Record<string, string> = {
    // Área A - Ingeniería y Ciencias Básicas
    '101': 'ARQUITECTURA',
    '102': 'INGENIERÍA ELÉCTRICA',
    '103': 'INGENIERÍA GEOLÓGICA',
    '104': 'INGENIERÍA METALÚRGICA',
    '105': 'INGENIERÍA DE MINAS',
    '106': 'INGENIERÍA MECÁNICA',
    '107': 'INGENIERÍA QUÍMICA',
    '108': 'INGENIERÍA CIVIL',
    '109': 'QUÍMICA',
    '110': 'FÍSICA',
    '111': 'MATEMÁTICA',
    '112': 'INGENIERÍA ELECTRÓNICA',
    '113': 'INGENIERÍA INFORMÁTICA Y DE SISTEMAS',
    '114': 'INGENIERÍA PETROQUÍMICA',
    '115': 'INGENIERÍA AGROINDUSTRIAL',
    '116': 'INGENIERÍA FORESTAL',
    '117': 'MATEMÁTICA CON MENCIÓN EN ESTADÍSTICA',
    '118': 'INGENIERÍA AGROAMBIENTAL',
    '119': 'INGENIERÍA AGROPECUARIA',
    '120': 'INGENIERÍA CIVIL',

    // Área B - Ciencias de la Salud y Biológicas
    '201': 'AGRONOMÍA',
    '202': 'BIOLOGÍA',
    '203': 'ENFERMERÍA',
    '204': 'FARMACIA Y BIOQUÍMICA',
    '205': 'MEDICINA HUMANA',
    '206': 'ZOOTECNIA',
    '207': 'ODONTOLOGÍA',
    '208': 'INGENIERÍA FORESTAL',
    '209': 'INGENIERÍA AGROAMBIENTAL',
    '210': 'MEDICINA VETERINARIA',
    '211': 'OBSTETRICIA',
    '212': 'ENFERMERÍA',

    // Área C - Ciencias Económicas y Empresariales
    '301': 'CIENCIAS ADMINISTRATIVAS',
    '302': 'CONTABILIDAD',
    '303': 'ECONOMÍA',
    '304': 'TURISMO',
    '305': 'CIENCIAS ADMINISTRATIVAS',
    '306': 'CONTABILIDAD',

    // Área D - Ciencias Sociales y Humanidades
    '401': 'ANTROPOLOGÍA',
    '402': 'ARQUEOLOGÍA',
    '403': 'DERECHO',
    '404': 'HISTORIA',
    '405': 'CIENCIAS DE LA COMUNICACIÓN',
    '406': 'PSICOLOGÍA',
    '407': 'FILOSOFÍA',
    '408': 'EDUCACIÓN INICIAL',
    '409': 'EDUCACIÓN PRIMARIA',
    '410': 'EDUCACIÓN SECUNDARIA: MATEMÁTICA Y FÍSICA',
    '411': 'EDUCACIÓN SECUNDARIA: CIENCIAS NATURALES',
    '412': 'EDUCACIÓN SECUNDARIA: LENGUA Y LITERATURA',
    '413': 'EDUCACIÓN SECUNDARIA: CIENCIAS SOCIALES',
    '414': 'EDUCACIÓN SECUNDARIA: EDUCACIÓN FÍSICA',
    '415': 'EDUCACIÓN SECUNDARIA: LENGUAS EXTRANJERAS',
    '416': 'EDUCACIÓN SECUNDARIA: FILOSOFÍA Y CIENCIAS SOCIALES'
};

export const fixCareerName = (codeOrName: string | undefined | null): string => {
    if (!codeOrName) return '';
    const str = String(codeOrName).trim();
    if (!str) return '';
    const upper = str.toUpperCase();
    if (upper === 'NULL' || upper === 'NONE' || upper === 'UNDEFINED' || upper === 'N/A' || upper === 'NA' || upper === '-') {
        return '';
    }

    // Si es puramente numérico (ej. "117", "0117", "204")
    if (/^\d+$/.test(str)) {
        const unpadded = str.replace(/^0+/, '');
        if (CAREER_CODE_MAP[unpadded]) return CAREER_CODE_MAP[unpadded];
        if (CAREER_CODE_MAP[str]) return CAREER_CODE_MAP[str];
        return ''; // Nunca devolver código numérico crudo
    }

    // Si viene con formato "117 - NOMBRE" o "117: NOMBRE"
    const codeMatch = str.match(/^(\d{2,4})\s*[-–—:]\s*(.*)$/);
    if (codeMatch) {
        const code = codeMatch[1].replace(/^0+/, '');
        const rest = codeMatch[2].trim();
        if (CAREER_CODE_MAP[code]) return CAREER_CODE_MAP[code];
        if (rest && rest.toUpperCase() !== 'NULL') return fixEncoding(rest);
    }

    return fixEncoding(str);
};

export const isApplicantAdmitted = (obsOrCondicion?: string | null, rawRow?: any): boolean => {
    const rawObs = String(
        obsOrCondicion ??
        rawRow?.OBSERVACION ??
        rawRow?.observacion ??
        rawRow?.Condicion ??
        rawRow?.condicion ??
        rawRow?.ESTADO ??
        ''
    ).trim();

    const normalizedObs = rawObs
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase();

    if (
        normalizedObs.includes('NO INGRESA') ||
        normalizedObs.includes('NO INGRESO') ||
        normalizedObs.includes('NO INGRESANTE') ||
        normalizedObs.includes('NO ADMITIDO') ||
        normalizedObs.includes('NO_INGRESA') ||
        normalizedObs.includes('NO ALCANZ') ||
        normalizedObs.includes('SIN VACANTE') ||
        normalizedObs.includes('NO SE PRESENTO') ||
        normalizedObs === 'NSP' ||
        normalizedObs.startsWith('NSP ') ||
        normalizedObs.includes('AUSENTE') ||
        normalizedObs.includes('DESCALIFICADO')
    ) {
        return false;
    }

    if (rawRow) {
        const ingFlag = rawRow.Ingresante ?? rawRow.ingresante;
        if (ingFlag === 0 || ingFlag === '0' || ingFlag === false) {
            return false;
        }
        if (ingFlag === 1 || ingFlag === '1' || ingFlag === true) {
            return true;
        }
    }

    return (
        normalizedObs.includes('INGRESA') ||
        normalizedObs.includes('INGRESO') ||
        normalizedObs.includes('ADMITIDO') ||
        normalizedObs === 'SI'
    );
};

interface PreRevisionBatchMeta {
    id: string;
    modalidad_id: string;
    modalidadNombre: string;
    semestre: string;
    anio: string;
}

let preRevisionIndexCache: { fetchedAt: number; batches: PreRevisionBatchMeta[] } | null = null;
const parsedBatchRowsCache = new Map<string, { fetchedAt: number; rows: any[] }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

const normalizeForSearch = (val: string): string =>
    val
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z0-9\s]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();

const getPreRevisionBatchIndex = async (): Promise<PreRevisionBatchMeta[]> => {
    const now = Date.now();
    if (preRevisionIndexCache && now - preRevisionIndexCache.fetchedAt < CACHE_TTL_MS) {
        return preRevisionIndexCache.batches;
    }

    const [archivosRes, modsRes, cuadrosRes] = await Promise.all([
        supabase.from('pre_revision_archivos').select('id, modalidad_id'),
        supabase.from('cv_modalidades').select('id, nombre, semestre, cuadro_id'),
        supabase.from('cv_cuadros_anuales').select('id, anio')
    ]);

    const cuadrosMap = new Map<string, string>();
    (cuadrosRes.data || []).forEach((c: any) => {
        if (c?.id) cuadrosMap.set(String(c.id), String(c.anio || ''));
    });

    const modsMap = new Map<string, { nombre: string; semestre: string; anio: string }>();
    (modsRes.data || []).forEach((m: any) => {
        if (m?.id) {
            modsMap.set(String(m.id), {
                nombre: String(m.nombre || ''),
                semestre: String(m.semestre || ''),
                anio: m.cuadro_id ? (cuadrosMap.get(String(m.cuadro_id)) || '') : ''
            });
        }
    });

    const batches: PreRevisionBatchMeta[] = (archivosRes.data || []).map((a: any) => {
        const modInfo = a?.modalidad_id ? modsMap.get(String(a.modalidad_id)) : undefined;
        return {
            id: String(a.id),
            modalidad_id: String(a.modalidad_id || ''),
            modalidadNombre: modInfo?.nombre || '',
            semestre: modInfo?.semestre || '',
            anio: modInfo?.anio || ''
        };
    });

    preRevisionIndexCache = { fetchedAt: now, batches };
    return batches;
};

const extractRowsFromBatchPayload = (csvData: any): any[] => {
    if (!csvData) return [];
    let parsed = csvData;
    if (typeof csvData === 'string') {
        try {
            parsed = JSON.parse(csvData);
        } catch (_) {
            return [];
        }
    }
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.postulantes)) return parsed.postulantes;
        if (Array.isArray(parsed.data)) return parsed.data;
        if (Array.isArray(parsed.rows)) return parsed.rows;
    }
    return [];
};

const fetchBatchRowsById = async (batchId: string): Promise<any[]> => {
    const now = Date.now();
    const cached = parsedBatchRowsCache.get(batchId);
    if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
        return cached.rows;
    }

    const { data, error } = await supabase
        .from('pre_revision_archivos')
        .select('id, csv_data')
        .eq('id', batchId)
        .single();

    if (error || !data) return [];
    const rows = extractRowsFromBatchPayload(data.csv_data);

    if (parsedBatchRowsCache.size >= 8) {
        const oldestKey = parsedBatchRowsCache.keys().next().value;
        if (oldestKey) parsedBatchRowsCache.delete(oldestKey);
    }
    parsedBatchRowsCache.set(batchId, { fetchedAt: now, rows });
    return rows;
};

const runWithConcurrency = async <T,>(
    items: T[],
    concurrency: number,
    worker: (item: T) => Promise<void>
): Promise<void> => {
    if (items.length === 0) return;
    const queue = [...items];
    const workersCount = Math.min(concurrency, queue.length);
    await Promise.all(
        Array.from({ length: workersCount }, async () => {
            while (queue.length > 0) {
                const next = queue.shift();
                if (next !== undefined) {
                    await worker(next);
                }
            }
        })
    );
};

const searchPreRevisionApplicants = async (rawTerm: string): Promise<any[]> => {
    const term = rawTerm.trim();
    if (!term) return [];
    const isNumeric = /^\d+$/.test(term);
    if (!isNumeric && term.length < 3) return [];

    try {
        const batches = await getPreRevisionBatchIndex();
        if (batches.length === 0) return [];

        const batchMap = new Map<string, PreRevisionBatchMeta>();
        batches.forEach(b => batchMap.set(b.id, b));

        const searchWords = isNumeric
            ? [term]
            : term
                .split(/[\s,\-/]+/)
                .map(w => w.trim())
                .filter(w => w.length >= 2);

        if (searchWords.length === 0) return [];

        const buildFilterQuery = (ids: string[]) => {
            let q = supabase.from('pre_revision_archivos').select('id').in('id', ids);
            if (isNumeric) {
                // LIKE (case-sensitive) es mucho más rápido que ILIKE para dígitos en columnas TOAST grandes
                q = q.like('csv_data', `%${term}%`);
            } else {
                searchWords.forEach(word => {
                    const agnostic = word.replace(/[aeiouáéíóúüAEIOUÁÉÍÓÚÜ]/g, '_');
                    q = q.ilike('csv_data', `%${agnostic}%`);
                });
            }
            return q;
        };

        // Escanear los lotes en bloques de 6 con concurrencia máxima de 3 para no saturar vCPU de Postgres ni disparar 57014
        const CHUNK_SIZE = 6;
        const chunks: string[][] = [];
        const allIds = batches.map(b => b.id);
        for (let i = 0; i < allIds.length; i += CHUNK_SIZE) {
            chunks.push(allIds.slice(i, i + CHUNK_SIZE));
        }

        const matchedBatchIds = new Set<string>();
        await runWithConcurrency(chunks, 3, async chunkIds => {
            const { data, error } = await buildFilterQuery(chunkIds);
            if (!error && data) {
                data.forEach((row: any) => {
                    if (row?.id) matchedBatchIds.add(String(row.id));
                });
            } else if (error) {
                // Fallback individual con concurrencia controlada si un lote pesado demoró el bloque
                await runWithConcurrency(chunkIds, 2, async singleId => {
                    const { data: singleData } = await buildFilterQuery([singleId]);
                    if (singleData && singleData.length > 0) {
                        matchedBatchIds.add(singleId);
                    }
                });
            }
        });

        if (matchedBatchIds.size === 0) return [];

        const targetIds = Array.from(matchedBatchIds);
        const normalizedWords = isNumeric ? [] : searchWords.map(normalizeForSearch).filter(Boolean);
        const matchedApplicants: any[] = [];

        await runWithConcurrency(targetIds, 2, async batchId => {
            if (!isNumeric && matchedApplicants.length >= 60) return;
            const meta = batchMap.get(batchId);
            const rows = await fetchBatchRowsById(batchId);
            for (let i = 0; i < rows.length; i++) {
                const elem = rows[i];
                if (!elem || typeof elem !== 'object') continue;

                if (isNumeric) {
                    const docNum = String(
                        elem.NroDocumento ??
                        elem.alumno ??
                        elem.dni ??
                        elem.DNI ??
                        elem.CODPOSTULANTE ??
                        elem.DOCUMENTO ??
                        ''
                    ).trim();
                    if (docNum !== term) continue;
                } else {
                    const rawCandidateName = String(
                        elem.nombre ??
                        elem.Nombre ??
                        elem.NOMBRE ??
                        elem.POSTULANTE ??
                        ''
                    );
                    if (!rawCandidateName) continue;
                    const normCandidateName = normalizeForSearch(rawCandidateName);
                    const allWordsMatch = normalizedWords.every(w => normCandidateName.includes(w));
                    if (!allWordsMatch) continue;
                }

                matchedApplicants.push({
                    ...elem,
                    _preRevisionId: batchId,
                    _modalidadId: meta?.modalidad_id || '',
                    _modalidadNombre: meta?.modalidadNombre || '',
                    _semestre: meta?.semestre || '',
                    _anio: meta?.anio || ''
                });

                if (!isNumeric && matchedApplicants.length >= 60) break;
            }
        });

        return matchedApplicants;
    } catch (err) {
        console.error('Error en búsqueda multi-lote pre_revision_archivos:', err);
        return [];
    }
};

const fetchAnnulledExamApplicants = async (rawTerm: string): Promise<any[]> => {
    const term = rawTerm.trim();
    if (!term) return [];
    const isNumeric = /^\d+$/.test(term);
    if (!isNumeric && term.length < 3) return [];

    try {
        let q = supabase.from('postulantes_examenes_anulados').select('*');
        if (isNumeric) {
            q = q.eq('dni', term).limit(20);
        } else {
            const words = term.split(/[\s,\-/]+/).filter(Boolean);
            words.forEach(word => {
                const agnostic = word.replace(/[aeiouáéíóúüAEIOUÁÉÍÓÚÜ]/g, '_');
                q = q.ilike('nombre_completo', `%${agnostic}%`);
            });
            q = q.limit(30);
        }

        const { data, error } = await q;
        if (error || !data) return [];

        return data.map((row: any) => {
            const admittedDefinitive = row.ingresante_reprogramado === 1 || row.ingresante_reprogramado === '1' || row.ingresante_reprogramado === true;
            const condicionDefinitiva = String(
                row.condicion_final || (admittedDefinitive ? 'INGRESANTE' : 'NO INGRESA (EXAMEN REPROGRAMADO)')
            );
            return {
                NroDocumento: String(row.dni || '').trim(),
                nombre: String(row.nombre_completo || '').trim(),
                carrera_nombre: row.carrera_nombre || row.codigo_carrera || '',
                carrera_ingreso_nombre: admittedDefinitive ? (row.carrera_ingreso_reprogramado || row.carrera_nombre || '') : '',
                notavigesimal: row.nota_reprogramado ?? row.nota_anulada ?? '',
                POS: row.omerito_reprogramado ?? row.omerito_anulado ?? '',
                OBSERVACION: condicionDefinitiva,
                Ingresante: admittedDefinitive ? 1 : 0,
                _modalidadId: String(row.modalidad_id || ''),
                _modalidadNombre: String(row.modalidad_origen || 'CONCURSO DE ADMISIÓN ORDINARIO'),
                _semestre: String(row.semestre || ''),
                _anio: String(row.anio || ''),
                _fromAnnulledTable: true,
                examen_anulado: {
                    resolucion: row.resolucion_anulacion,
                    motivo: row.motivo_anulacion,
                    fecha_examen_anulado: row.fecha_examen_anulado,
                    nota_anulada: row.nota_anulada,
                    omerito_anulado: row.omerito_anulado,
                    ingresante_anulado: row.ingresante_anulado,
                    fecha_segundo_examen: row.fecha_segundo_examen,
                    nota_reprogramado: row.nota_reprogramado,
                    omerito_reprogramado: row.omerito_reprogramado,
                    ingresante_reprogramado: row.ingresante_reprogramado,
                    condicion_final: row.condicion_final
                }
            };
        });
    } catch (err) {
        console.debug('Aviso consultando postulantes_examenes_anulados:', err);
        return [];
    }
};

export function normalizeProcessKey(modalidad: string = '', semestre: string = '', anio: string | number = '', rawRow?: any): string {
    let combined = `${modalidad} ${semestre} ${anio}`;
    if (rawRow && typeof rawRow === 'object') {
        const extra = `${rawRow._modalidadNombre || ''} ${rawRow.nombremodalidad || ''} ${rawRow.Modalidad || ''} ${rawRow.modalidad || ''} ${rawRow.proceso || ''} ${rawRow.Proceso || ''} ${rawRow.archivo || ''} ${rawRow.filename || ''} ${rawRow._anio || ''} ${rawRow.Anio || ''} ${rawRow.anio || ''} ${rawRow._semestre || ''} ${rawRow.Semestre || ''} ${rawRow.semestre || ''} ${rawRow._modalidadId || ''}`;
        combined += ` ${extra}`;
    }
    const text = combined.toUpperCase();
    
    // 1. Extraer Año (ej. 2024, 2025, 2026)
    const yearMatch = text.match(/\b(202\d|20\d\d)\b/);
    const year = yearMatch ? yearMatch[1] : (String(anio).match(/\b(202\d|20\d\d)\b/) ? String(anio).match(/\b(202\d|20\d\d)\b/)![1] : '2026');
    
    // 2. Extraer Semestre (I, II o PO)
    let sem = 'I';
    if (
        text.includes('2026-II') || 
        text.includes('2025-II') || 
        text.includes('2024-II') || 
        text.includes('2023-II') || 
        text.includes('-II') || 
        /\bII\b/.test(text) || 
        text.includes('SEGUNDA OPORTUNIDAD') || 
        text.includes('SEGUNDO EXAMEN') || 
        text.includes('SEMESTRE: II') || 
        text.includes('SEMESTRE II') || 
        text.includes('SEM II')
    ) {
        sem = 'II';
    } else if (
        text.includes('PO') || 
        text.includes('PRIMERA OPORTUNIDAD') || 
        text.includes('PRIMERA OP') || 
        text.includes('1RA OPORTUNIDAD') || 
        text.includes('1ERA OPORTUNIDAD')
    ) {
        sem = 'I'; // Primera Oportunidad 2026 corresponde al periodo 2026-I
    }
    
    // 3. Extraer Tipo de Examen Principal (Homologación Dirimencia / Exonerados 1er y 2do puesto)
    let type = 'ORDINARIO';
    if (
        text.includes('DIRIMENCIA') || 
        text.includes('DIRIM') ||
        text.includes('EXONERACION') || 
        text.includes('EXONERACIÓN') || 
        text.includes('1ER Y 2DO') || 
        text.includes('1RO Y 2DO') || 
        text.includes('1ER Y 2DO PUESTO') || 
        text.includes('PRIMER Y SEGUNDO') ||
        text.includes('PRIMEROS PUESTOS') ||
        text.includes('PRIMER PUESTO')
    ) {
        type = 'DIRIMENCIA';
        if (!text.includes('2026-II') && !text.includes('2025-II') && !text.includes('-II') && !/\bII\b/.test(text) && !text.includes('SEGUNDA')) {
            sem = 'I'; // Dirimencia 2026 pertenece a 2026-I
        }
    } else if (text.includes('FILIAL') || text.includes('SEDES') || text.includes('SEDE') || text.includes('CANCHIS') || text.includes('ESPINAR') || text.includes('ANDAHUAYLAS') || text.includes('SICUANI') || text.includes('SANTO TOMAS') || text.includes('PUERTO MALDONADO')) {
        type = 'FILIALES';
    } else if (text.includes('CEPRU') && (text.includes('PRIMERA OPORTUNIDAD') || text.includes('PO') || text.includes('PRIMERA OP') || text.includes('1RA OPORTUNIDAD'))) {
        type = 'CEPRU_PO';
    } else if (text.includes('PRIMERA OPORTUNIDAD') || text.includes('PO') || text.includes('PRIMERA OP') || text.includes('1RA OPORTUNIDAD')) {
        type = 'PO';
    } else if (text.includes('CEPRU')) {
        type = 'CEPRU';
    } else if (text.includes('GRADUADOS') || text.includes('TITULADOS')) {
        type = 'GRADUADOS';
    } else if (text.includes('TRASLADO') || text.includes('EXTERNO') || text.includes('INTERNO')) {
        type = 'TRASLADOS';
    } else if (text.includes('DEPORTISTA') || text.includes('PROMETEDOR') || text.includes('CALIFICADO')) {
        type = 'DEPORTISTAS';
    } else if (text.includes('VICTIMA') || text.includes('PIR') || text.includes('TERRORISMO')) {
        type = 'VICTIMAS';
    } else if (text.includes('PERSONAS CON DISCAPACIDAD') || text.includes('DISCAPACIDAD') || text.includes('CONADIS')) {
        type = 'DISCAPACIDAD';
    }
    
    return `${year}-${sem}_${type}`;
}

export interface TimelineItem {
    id: string;
    tipo: 'INGRESO' | 'POSTULACION';
    carrera: string;
    modalidad: string;
    anio: string | number;
    semestre: string;
    puntaje?: string | number;
    puesto?: string | number;
    grupo?: string;
    sede?: string;
    fecha?: string;
    carpetaDocs?: string;
    documentosCount?: number;
    condicion?: string;
    rawAdm?: Participant;
    rawApp?: ApplicantApplicationRecord;
}

export function getModalityAndSemesterFromPath(docPath: string): { label: string; year?: string; semester?: string; modality?: string } {
    if (!docPath) return { label: 'PROCESO DE ADMISIÓN' };
    
    const parts = docPath.replace(/\\/g, '/').split('/').filter(Boolean);
    let folderName = parts.length > 1 ? parts[parts.length - 2] : parts[0] || '';
    folderName = folderName.replace(/^[A-Za-z]:\/?/g, '').replace(/_/g, ' ').trim();
    if (!folderName || folderName.toLowerCase() === 'h:') {
        folderName = 'EXPEDIENTE DIGITAL';
    }
    
    let year = '';
    const yMatch = folderName.match(/\b(20\d\d)\b/);
    if (yMatch) year = yMatch[1];
    
    let semester = 'I';
    const upper = folderName.toUpperCase();
    if (
        upper.includes('2026-II') || 
        upper.includes('2025-II') || 
        upper.includes('2024-II') || 
        upper.includes('-II') || 
        /\bII\b/.test(upper) || 
        upper.includes('SEGUNDA OPORTUNIDAD') || 
        upper.includes('SEGUNDO EXAMEN') ||
        upper.includes('SEMESTRE: II') || 
        upper.includes('SEMESTRE II')
    ) {
        semester = 'II';
    } else if (upper.includes('PO') || upper.includes('PRIMERA OP') || upper.includes('PRIMERA')) {
        semester = 'I';
    } else if (upper.includes('DIRIMENCIA') || upper.includes('DIRIM') || upper.includes('1ER Y 2DO') || upper.includes('EXONERACION') || upper.includes('EXONERACIÓN')) {
        semester = 'I';
    }

    return {
        label: folderName,
        year,
        semester,
        modality: folderName
    };
}

export function getGroupedDocuments(documents: StudentDocument[] = []): Record<string, StudentDocument[]> {
    const groups: Record<string, StudentDocument[]> = {};
    documents.forEach(doc => {
        const rawPath = doc.relativePath || doc.path || '';
        const { label } = getModalityAndSemesterFromPath(rawPath);
        if (!groups[label]) groups[label] = [];
        groups[label].push(doc);
    });
    return groups;
}

export const StudentLookup: React.FC<{ user: User; notify?: (message: string, type?: ToastMessage['type']) => void }> = ({ user, notify }) => {
  const navigate = useNavigate();
  const [activeMode, setActiveMode] = useState<SearchMode>('individual');
  
  // File Gateway connection state
  const [gatewayUrl, setGatewayUrl] = useState(() => getGatewayBaseUrl());
  const [gatewayStatus, setGatewayStatus] = useState<{
    connected: boolean;
    latency?: number;
    checking: boolean;
    url: string;
  }>({
    connected: false,
    checking: true,
    url: getGatewayBaseUrl()
  });
  const [isGatewayModalOpen, setIsGatewayModalOpen] = useState(false);
  const [selectedDocForViewer, setSelectedDocForViewer] = useState<StudentDocument | null>(null);
  const [isFichaModalOpen, setIsFichaModalOpen] = useState(false);
  
  // State for toggling individual folders in local documents
  const [expandedFolders, setExpandedFolders] = useState<{[key: string]: boolean}>({});

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [lastSearchedTerm, setLastSearchedTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<React.ReactNode | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Candidate list & selected unified profile
  const [candidatesList, setCandidatesList] = useState<IntegratedStudentData[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<IntegratedStudentData | null>(null);

  // Batch Search State
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchStatusText, setBatchStatusText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Import State
  const [importData, setImportData] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  // Modal State for Batch Detail
  const [selectedBatchHistory, setSelectedBatchHistory] = useState<Participant[] | null>(null);

  // Edit / Add Ingreso Records (tabla oficial participantes)
  const [isEditing, setIsEditing] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Participant | null>(null);
  const [editForm, setEditForm] = useState<Partial<Participant>>({});
  const [showSyncNameOption, setShowSyncNameOption] = useState(false);
  const [syncNameChecked, setSyncNameChecked] = useState(false);

  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newStudentForm, setNewStudentForm] = useState<Partial<Participant>>({});
  const [participantWizardStep, setParticipantWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [showContingencySection, setShowContingencySection] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [duplicateExistingRecord, setDuplicateExistingRecord] = useState<Participant | null>(null);

  // Catálogos oficiales para autocompletado y estandarización (AGENTS.md Regla 1)
  const [officialModalidades, setOfficialModalidades] = useState<string[]>([]);
  const [officialEscuelas, setOfficialEscuelas] = useState<Array<{ nombre: string; codigo_carrera: string; filial: string }>>([]);

  const notifyUser = useCallback((msg: string, type: ToastMessage['type'] = 'info') => {
    if (notify) {
      notify(msg, type);
    }
  }, [notify]);

  useEffect(() => {
    let active = true;
    const loadCatalogs = async () => {
      try {
        // Pre-calentar índice ligero de lotes de pre-revisión en paralelo
        getPreRevisionBatchIndex().catch(() => {});
        const [modsRes, escRes] = await Promise.all([
          supabase.from('cv_modalidades').select('nombre').order('orden', { ascending: true }),
          supabase.from('cv_escuelas').select('nombre, codigo_carrera, filial, is_hidden').order('orden', { ascending: true })
        ]);
        if (!active) return;
        if (modsRes.data) {
          const uniqueMods = Array.from(
            new Set(
              modsRes.data
                .map((m: any) => String(m.nombre || '').trim().toUpperCase())
                .filter(Boolean)
            )
          );
          setOfficialModalidades(uniqueMods);
        }
        if (escRes.data) {
          const cleanEscuelas = escRes.data
            .filter((e: any) => !e.is_hidden && e.nombre)
            .map((e: any) => ({
              nombre: String(e.nombre || '').trim().toUpperCase(),
              codigo_carrera: String(e.codigo_carrera || '').trim(),
              filial: String(e.filial || 'CUSCO').trim().toUpperCase()
            }));
          setOfficialEscuelas(cleanEscuelas);
        }
      } catch (e) {
        console.debug('No se pudieron cargar catálogos auxiliares:', e);
      }
    };
    loadCatalogs();
    return () => { active = false; };
  }, []);

  // Local Documents State
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);

  // Check gateway health
  const checkGateway = useCallback(async (targetUrl?: string) => {
    const url = targetUrl || getGatewayBaseUrl();
    setGatewayStatus(prev => ({ ...prev, checking: true, url }));
    try {
      const result = await testGatewayHealth(url);
      setGatewayStatus({
        connected: result.ok,
        latency: result.latency,
        checking: false,
        url: result.url
      });
    } catch {
      setGatewayStatus({
        connected: false,
        checking: false,
        url
      });
    }
  }, []);

  useEffect(() => {
    checkGateway();

    const handleGatewayChanged = (e: any) => {
      const newUrl = e.detail?.url || getGatewayBaseUrl();
      setGatewayUrl(newUrl);
      checkGateway(newUrl);
    };

    window.addEventListener('gateway-url-changed', handleGatewayChanged);
    return () => {
      window.removeEventListener('gateway-url-changed', handleGatewayChanged);
    };
  }, [checkGateway]);

  // Fetch full details, school, gateway docs, renuncias and reservas for a profile
  const fetchProfileExtraInfo = async (profile: IntegratedStudentData) => {
      setExpandedFolders({});
      setLoadingDocs(true);
      setDocsError(null);

      const dni = profile.dni;
      let updatedSchoolInfo = profile.schoolInfo;
      let updatedDocuments: StudentDocument[] = [];
      let updatedPhoto: StudentDocument | null = null;
      let updatedRenuncias: any[] = [];
      let updatedReservas: any[] = [];

      // 1. Fetch Gateway Documents from port 5000
      try {
          const resDocs = await fetchStudentDocumentsFromGateway(dni, gatewayUrl);
          if (!resDocs.ok) {
              setDocsError(resDocs.error || 'No se pudo consultar el servidor de archivos.');
              setGatewayStatus(prev => ({ ...prev, connected: false }));
          } else {
              updatedDocuments = resDocs.documents || [];
              if (updatedDocuments.length > 0) {
                  setGatewayStatus(prev => ({ ...prev, connected: true }));
                  // Find photo doc (e.g. 1_1_{dni}.jpg or image)
                  const photoMatch = updatedDocuments.find(d => 
                      d.isImage || (d.filename && d.filename.toLowerCase().startsWith(`1_1_${dni.toLowerCase()}`))
                  );
                  if (photoMatch) updatedPhoto = photoMatch;
              }
          }
      } catch (err: any) {
          setDocsError(err.message || 'Servidor de archivos fuera de línea');
          setGatewayStatus(prev => ({ ...prev, connected: false }));
      } finally {
          setLoadingDocs(false);
      }

      // 2. Fetch Colegio details if schoolCode exists
      if (profile.schoolCode) {
          try {
              const rawCode = profile.schoolCode.trim();
              const unpadded = rawCode.replace(/^0+/, '');
              const padded7 = rawCode.padStart(7, '0');
              const { data: cols } = await supabase
                  .from('colegios')
                  .select('*')
                  .or(`codigo_modular.eq.${rawCode},codigo_modular.eq.${unpadded},codigo_modular.eq.${padded7}`)
                  .limit(1);
              if (cols && cols.length > 0) {
                  updatedSchoolInfo = cols[0];
              }
          } catch (e) {
              console.error('Error fetching colegio:', e);
          }
      }

      // 3. Fetch Renuncias and Reservas
      try {
          const [renReq, resReq] = await Promise.all([
              supabase.from('renuncias').select('*').eq('student_code', dni).eq('status', 'Finalizado'),
              supabase.from('reserva_vacantes_detalles').select('*, batch:reserva_vacantes_bloques(*)').eq('student_code', dni)
          ]);
          updatedRenuncias = renReq.data || [];
          updatedReservas = resReq.data || [];
      } catch (err) {
          console.error("Error fetching renuncias/reservas:", err);
      }

      // 4. Si el postulante no tiene applications cargadas, consultar sus aplicaciones por DNI en todos los lotes
      let updatedApplications = [...profile.applications];
      if (updatedApplications.length === 0 && dni) {
          try {
              const appList = await searchPreRevisionApplicants(dni);
              if (Array.isArray(appList) && appList.length > 0) {
                  appList.forEach(r => {
                      const rawCarrera1 = r.carrera_nombre || r['Carrera 1'] || r.Carrera1 || r.carrera1 || r.Escuela1 || r.escuela1 || r.Carrera || r.carrera || r.COD_CARRERA || r.codigo_carrera || r.CARRERA || r.ESCUELA || r.escuela;
                      const rawCarrera2 = r['Carrera 2'] || r.Carrera2 || r.carrera2 || r.Escuela2 || r.escuela2;
                      const rawCarreraIngreso = r.carrera_ingreso_nombre || r.CarreraIngreso || r.carreraIngreso || r.carrera_ingreso || r.CARRERA_INGRESO || r.ESCUELA_INGRESO || r.escuelaIngreso || r.escuela_ingreso || r.carrera_admitida || r.CarreraAdmitida;
                      const modName = r._modalidadNombre || r.nombremodalidad || r.Modalidad || r.modalidad || r.proceso || 'PROCESO DE ADMISIÓN';
                      const rawNota = r.notavigesimal || r.Nota || r.nota || r.PUNTAJE || r.puntaje || r.NOTA || '';
                      const rawPuesto = r.POS || r.pos || r.PUESTO || r.puesto || r.OMERITO || r.omerito || '';
                      const obs = String(r.OBSERVACION || r.observacion || r.Condicion || r.condicion || r.ESTADO || '').toUpperCase();
                      const isAdmittedInProcess = isApplicantAdmitted(obs, r);

                      const appRec: ApplicantApplicationRecord = {
                          id: `${dni}-${updatedApplications.length}`,
                          modalidad: String(modName).toUpperCase(),
                          carrera1: fixCareerName(rawCarrera1),
                          carrera2: fixCareerName(rawCarrera2),
                          carreraIngreso: fixCareerName(rawCarreraIngreso),
                          nota: String(rawNota).trim(),
                          puesto: String(rawPuesto).trim(),
                          condicion: obs || (isAdmittedInProcess ? 'INGRESANTE' : 'PARTICIPANTE'),
                          grupo: String(r.grupo || r.Grupo || '').trim(),
                          aula: String(r.aula || r.Aula || '').trim(),
                          rawRow: r
                      };
                      updatedApplications.push(appRec);
                  });
              }
          } catch (e) {
              console.debug('Detalle de pre-revisión no disponible por DNI:', e);
          }
      }

      // Set complete profile
      const hasRen = updatedRenuncias.length > 0;
      const hasRes = updatedReservas.length > 0;
      const hasRet = updatedReservas.some(r => r.is_withdrawn);

      setSelectedProfile(prev => {
          if (!prev || prev.dni !== dni) return prev;
          return {
              ...prev,
              schoolInfo: updatedSchoolInfo,
              documents: updatedDocuments,
              photoDoc: updatedPhoto,
              renuncias: updatedRenuncias,
              reservas: updatedReservas,
              hasRenuncia: hasRen,
              hasReserva: hasRes,
              hasRetiroReserva: hasRet,
              applications: updatedApplications
          };
      });
  };

  const getModalityAndSemesterFromPath = (pathStr: string | undefined | null) => {
      if (!pathStr || typeof pathStr !== 'string') {
          return 'EXPEDIENTE GENERAL';
      }
      const segments = pathStr.split(/[\/\\]/).map(s => s.trim()).filter(Boolean);
      let targetFolder = '';
      
      for (let i = segments.length - 2; i >= 0; i--) {
          const seg = segments[i];
          const isNumeric = /^\d+$/.test(seg);
          const isDrive = /^[a-zA-Z]:$/.test(seg);
          const isGenericRoot = seg.toUpperCase() === 'FOTOS_ARCHIVOS_ADMISION_CEPRU' || seg.toUpperCase() === 'FOTOS_ARCHIVOS_ADMISION';
          const isSystem = ['API', 'FILES', 'STUDENT-DOCUMENTS', 'STUDENT_DOCUMENTS'].includes(seg.toUpperCase());
          
          if (!isNumeric && !isDrive && !isGenericRoot && !isSystem) {
              targetFolder = seg;
              break;
          }
      }
      
      if (!targetFolder) {
          if (segments.length >= 2) {
              targetFolder = segments[segments.length - 2];
          } else {
              targetFolder = 'EXPEDIENTE GENERAL';
          }
      }
      
      let displayName = targetFolder.toUpperCase().replace(/_/g, ' ').trim();
      displayName = displayName
          .replace(/^DOCUMENTOS ADMISION DE EL /g, '')
          .replace(/^DOCUMENTOS ADMISION DE LA /g, '')
          .replace(/^DOCUMENTOS ADMISION DE /g, '')
          .replace(/^DOCUMENTOS DE ADMISION /g, '')
          .replace(/^DOCUMENTOS ADMISION /g, '')
          .replace(/^DOCUMENTOS /g, '')
          .replace(/^ARCHIVOS ADMISION /g, '')
          .trim();
          
      displayName = displayName.replace(/(\d{4})\s+(I+|X+)/g, "$1-$2");
      displayName = displayName.replace(/(\d{4})-(I+|X+)/g, "$1-$2");
      
      return displayName;
  };

  const getGroupedDocuments = (docs: any[]) => {
      const groups: { [key: string]: StudentDocument[] } = {};
      if (!docs || !Array.isArray(docs)) return groups;
      
      docs.forEach(doc => {
          if (!doc) return;
          const rawPath = typeof doc === 'string' ? doc : (doc.relativePath || doc.path || doc.file_path || doc.url || '');
          
          let cleanPath = rawPath;
          if (rawPath.includes('?path=')) {
              try {
                  const match = rawPath.match(/[?&]path=([^&]+)/);
                  if (match) cleanPath = decodeURIComponent(match[1]);
              } catch (e) {
                  console.error("Error decoding path parameter:", e);
              }
          }
          
          const groupLabel = getModalityAndSemesterFromPath(cleanPath);
          const parsedDoc = parseDocumentInfo(doc, cleanPath);
          parsedDoc.concursoLabel = groupLabel;
          
          if (!groups[groupLabel]) {
              groups[groupLabel] = [];
          }
          groups[groupLabel].push(parsedDoc);
      });

      Object.keys(groups).forEach(groupLabel => {
          groups[groupLabel].sort((a, b) => (a.filename || '').localeCompare(b.filename || ''));
      });
      
      return groups;
  };

  // MULTI-LAYER UNIVERSAL SEARCH
  const handleSearch = async (overrideQuery?: string) => {
    const rawTerm = typeof overrideQuery === 'string' ? overrideQuery : searchQuery;
    if (!rawTerm.trim()) return;
    setLoading(true); 
    setError(null); 
    setSelectedProfile(null);
    setCandidatesList([]); 
    setHasSearched(true);
    
    try {
      const term = rawTerm.trim();
      setLastSearchedTerm(term);
      const isNumeric = /^\d+$/.test(term);
      
      // 1. Layer 1: Query 'participantes' (Ingresantes oficiales)
      let partQuery = supabase.from('participantes').select('*');
      if (isNumeric) {
          partQuery = partQuery.eq('CODPOSTULANTE', term).limit(50);
      } else {
          const words = term.split(/[\s,\-/]+/).filter(Boolean);
          words.forEach(word => {
            const agnostic = word.replace(/[aeiouáéíóúüAEIOUÁÉÍÓÚÜ]/g, '_');
            partQuery = partQuery.ilike('NOMBRE', `%${agnostic}%`);
          });
          partQuery = partQuery.limit(60);
      }

      // 1, 2 & 3: Ejecutar en paralelo Ingresantes oficiales, Lotes de Pre-Revisión (sin timeout 57014) y Exámenes Anulados
      const [partRes, preData, annulledData] = await Promise.all([
          partQuery.order('ANIO', { ascending: false }).order('SEMESTRE', { ascending: false }),
          searchPreRevisionApplicants(term),
          fetchAnnulledExamApplicants(term)
      ]);

      if (partRes.error) {
          console.warn('Advertencia en consulta participantes:', partRes.error);
      }
      const partData = partRes.data || [];

      // Combinar resultados de pre_revision_archivos con evidencia histórica de postulantes_examenes_anulados sin duplicar
      const preMatches: any[] = [...preData];
      annulledData.forEach(annRow => {
          const annDni = String(annRow.NroDocumento || '').trim();
          const annModId = String(annRow._modalidadId || '').trim();
          const existing = preMatches.find(r => {
              const rDni = String(r.NroDocumento || r.alumno || r.dni || r.DNI || r.CODPOSTULANTE || r.DOCUMENTO || '').trim();
              const rModId = String(r._modalidadId || '').trim();
              return rDni === annDni && ((annModId && rModId === annModId) || String(r._modalidadNombre || '').toUpperCase() === String(annRow._modalidadNombre || '').toUpperCase());
          });
          if (existing) {
              if (!existing.examen_anulado && annRow.examen_anulado) {
                  existing.examen_anulado = annRow.examen_anulado;
              }
          } else {
              preMatches.push(annRow);
          }
      });

      // 3. Assemble Unified Person Map
      const personMap = new Map<string, IntegratedStudentData>();

      // Populate from participantes (Admissions)
      partData.forEach(p => {
          const dni = String(p.CODPOSTULANTE).trim();
          if (!dni) return;
          if (!personMap.has(dni)) {
              personMap.set(dni, {
                  dni,
                  fullName: fixEncoding(p.NOMBRE),
                  isIngresanteOficial: true,
                  isSoloPostulante: false,
                  hasRenuncia: false,
                  hasReserva: false,
                  hasRetiroReserva: false,
                  admissions: [],
                  applications: [],
                  documents: [],
                  renuncias: [],
                  reservas: []
              });
          }
          const profile = personMap.get(dni)!;
          profile.admissions.push(p);

          // Enriquecer datos personales y de colegio desde participantes si existen
          if (!profile.phone && p.telefono) profile.phone = String(p.telefono).trim();
          if (!profile.email && p.email) profile.email = String(p.email).trim();
          if (!profile.address && p.direccion) profile.address = String(p.direccion).trim();
          if (!profile.currentUbigeo && p.ubigeo) profile.currentUbigeo = String(p.ubigeo).trim();
          if (!profile.birthDate && p.fecha_nacimiento) profile.birthDate = String(p.fecha_nacimiento).trim();
          if (!profile.gender && p.sexo) profile.gender = String(p.sexo).trim();
          if (!profile.disability && p.discapacidad) profile.disability = String(p.discapacidad).trim();
          if (p.colegio) {
              const colStr = String(p.colegio).trim();
              if (/^\d+$/.test(colStr)) {
                  if (!profile.schoolCode) profile.schoolCode = colStr;
              } else {
                  if (!profile.schoolName) profile.schoolName = colStr;
              }
          }
      });

      // Populate & Enrich from pre_revision_archivos & postulantes_examenes_anulados
      preMatches.forEach(r => {
          const dni = String(r.NroDocumento || r.alumno || r.dni || r.DNI || r.CODPOSTULANTE || r.DOCUMENTO || '').trim();
          if (!dni) return;
          
          const rawName = String(r.nombre || r.Nombre || r.NOMBRE || r.POSTULANTE || '').trim();
          const obs = String(r.OBSERVACION || r.observacion || r.Condicion || r.condicion || r.ESTADO || '').toUpperCase();
          const isAdmittedInProcess = isApplicantAdmitted(obs, r);

          if (!personMap.has(dni)) {
              personMap.set(dni, {
                  dni,
                  fullName: fixEncoding(rawName) || `POSTULANTE DNI ${dni}`,
                  isIngresanteOficial: isAdmittedInProcess,
                  isSoloPostulante: !isAdmittedInProcess,
                  hasRenuncia: false,
                  hasReserva: false,
                  hasRetiroReserva: false,
                  admissions: [],
                  applications: [],
                  documents: [],
                  renuncias: [],
                  reservas: []
              });
          }

          const profile = personMap.get(dni)!;
          if ((!profile.fullName || profile.fullName.startsWith('POSTULANTE DNI')) && rawName) {
              profile.fullName = fixEncoding(rawName);
          }
          if (isAdmittedInProcess) {
              profile.isIngresanteOficial = true;
              profile.isSoloPostulante = false;
          }

          // Contact details
          if (!profile.phone && (r.telefono || r.Telefono || r.celular)) profile.phone = String(r.telefono || r.Telefono || r.celular).trim();
          if (!profile.email && (r.email || r.Email || r.CorreoPersonal)) profile.email = String(r.email || r.Email || r.CorreoPersonal).trim();
          if (!profile.address && (r.Direccion || r.Direccion_1 || r.direccion)) profile.address = String(r.Direccion || r.Direccion_1 || r.direccion).trim();
          if (!profile.birthDate && r.FechaNacimiento) profile.birthDate = String(r.FechaNacimiento).trim();
          if (!profile.birthPlace && r.LugarNacimiento) profile.birthPlace = String(r.LugarNacimiento).trim();
          if (!profile.currentUbigeo && (r.Ubigeo_Domicilio_Actual || r.Ubigeo)) profile.currentUbigeo = String(r.Ubigeo_Domicilio_Actual || r.Ubigeo).trim();
          if (!profile.gender && (r.Sexo || r.sexo)) profile.gender = String(r.Sexo || r.sexo).trim();
          if (!profile.disability && r.Discapacidad) profile.disability = String(r.Discapacidad).trim();
          if (!profile.nationality && r.Nacionalidad) profile.nationality = String(r.Nacionalidad).trim();

          // School
          if (!profile.schoolCode && (r.colegio || r.Colegio)) profile.schoolCode = String(r.colegio || r.Colegio).trim();
          if (!profile.schoolName && (r.nombrecolegio || r.nombreColegio)) profile.schoolName = String(r.nombrecolegio || r.nombreColegio).trim();

          // Application Record
          const rawCarrera1 = r.carrera_nombre || r['Carrera 1'] || r.Carrera1 || r.carrera1 || r.Escuela1 || r.escuela1 || r.Carrera || r.carrera || r.COD_CARRERA || r.codigo_carrera || r.CARRERA || r.ESCUELA || r.escuela;
          const rawCarrera2 = r['Carrera 2'] || r.Carrera2 || r.carrera2 || r.Escuela2 || r.escuela2;
          const rawCarreraIngreso = r.carrera_ingreso_nombre || r.CarreraIngreso || r.carreraIngreso || r.carrera_ingreso || r.CARRERA_INGRESO || r.ESCUELA_INGRESO || r.escuelaIngreso || r.escuela_ingreso || r.carrera_admitida || r.CarreraAdmitida;
          const modName = r._modalidadNombre || r.nombremodalidad || r.Modalidad || r.modalidad || r.proceso || 'PROCESO DE ADMISIÓN';
          const rawNota = r.notavigesimal || r.Nota || r.nota || r.PUNTAJE || r.puntaje || r.NOTA || '';
          const rawPuesto = r.POS || r.pos || r.PUESTO || r.puesto || r.OMERITO || r.omerito || '';

          const appRec: ApplicantApplicationRecord = {
              id: `${dni}-${profile.applications.length}`,
              modalidad: String(modName).toUpperCase(),
              carrera1: fixCareerName(rawCarrera1),
              carrera2: fixCareerName(rawCarrera2),
              carreraIngreso: fixCareerName(rawCarreraIngreso),
              nota: String(rawNota).trim(),
              puesto: String(rawPuesto).trim(),
              condicion: obs || (isAdmittedInProcess ? 'INGRESANTE' : 'PARTICIPANTE'),
              grupo: String(r.grupo || r.Grupo || '').trim(),
              aula: String(r.aula || r.Aula || '').trim(),
              rawRow: r
          };
          profile.applications.push(appRec);
      });

      const uniqueList = Array.from(personMap.values());

      if (uniqueList.length === 1) {
          const single = uniqueList[0];
          setSelectedProfile(single);
          setCandidatesList([]);
          fetchProfileExtraInfo(single);
      } else if (uniqueList.length > 1) {
          setCandidatesList(uniqueList);
          setSelectedProfile(null);
      } else {
          setCandidatesList([]);
          setSelectedProfile(null);
      }
    } catch (err: any) {
      console.error(err);
      setError('Error al consultar las bases de datos de postulantes e ingresantes.');
    } finally { 
      setLoading(false); 
    }
  };

  const handleSelectCandidate = (candidate: IntegratedStudentData) => {
      setSelectedProfile(candidate);
      setCandidatesList([]);
      fetchProfileExtraInfo(candidate);
  };

  const resolveCareerMetadata = (careerInput?: string, codeInput?: string, currentFilial?: string) => {
    const cleanCareer = (careerInput || '').trim().toUpperCase();
    const cleanCode = (codeInput || '').trim();

    if (cleanCareer) {
      const exactSchool = officialEscuelas.find(e => e.nombre === cleanCareer);
      if (exactSchool) {
        return {
          CARRERA: exactSchool.nombre,
          codigo_carrera: cleanCode || exactSchool.codigo_carrera || null,
          FILIAL: (currentFilial || '').trim().toUpperCase() || exactSchool.filial || 'CUSCO'
        };
      }
      const mapEntry = Object.entries(CAREER_CODE_MAP).find(([, name]) => name.toUpperCase() === cleanCareer);
      if (mapEntry && !cleanCode) {
        return {
          CARRERA: cleanCareer,
          codigo_carrera: mapEntry[0],
          FILIAL: (currentFilial || '').trim().toUpperCase() || 'CUSCO'
        };
      }
    } else if (cleanCode) {
      const unpadded = cleanCode.replace(/^0+/, '');
      const schoolByCode = officialEscuelas.find(
        e => e.codigo_carrera === cleanCode || e.codigo_carrera.replace(/^0+/, '') === unpadded
      );
      if (schoolByCode) {
        return {
          CARRERA: schoolByCode.nombre,
          codigo_carrera: schoolByCode.codigo_carrera,
          FILIAL: (currentFilial || '').trim().toUpperCase() || schoolByCode.filial || 'CUSCO'
        };
      }
      const mappedCareer = CAREER_CODE_MAP[unpadded] || CAREER_CODE_MAP[cleanCode];
      if (mappedCareer) {
        return {
          CARRERA: mappedCareer,
          codigo_carrera: cleanCode,
          FILIAL: (currentFilial || '').trim().toUpperCase() || 'CUSCO'
        };
      }
    }

    return {
      CARRERA: cleanCareer,
      codigo_carrera: cleanCode || null,
      FILIAL: (currentFilial || '').trim().toUpperCase() || 'CUSCO'
    };
  };

  const buildParticipantPayload = (form: Partial<Participant>) => {
    const toNullIfEmpty = (val: string | null | undefined) => {
      const s = String(val ?? '').trim();
      return s === '' ? null : s;
    };
    const resolved = resolveCareerMetadata(form.CARRERA, form.codigo_carrera || '', form.FILIAL);
    return {
      CODPOSTULANTE: String(form.CODPOSTULANTE || '').trim(),
      NOMBRE: String(form.NOMBRE || '').trim().toUpperCase(),
      CARRERA: resolved.CARRERA,
      codigo_carrera: toNullIfEmpty(form.codigo_carrera ?? resolved.codigo_carrera),
      FILIAL: resolved.FILIAL,
      MODALIDAD: String(form.MODALIDAD || '').trim().toUpperCase(),
      SEMESTRE: String(form.SEMESTRE || '').trim().toUpperCase(),
      ANIO: String(form.ANIO || '').trim(),
      NOTA: String(form.NOTA ?? '').trim(),
      OMERITO: String(form.OMERITO ?? '').trim(),
      FECHAINGRESO: String(form.FECHAINGRESO || '').trim(),
      telefono: toNullIfEmpty(form.telefono),
      email: toNullIfEmpty(form.email),
      direccion: toNullIfEmpty(form.direccion),
      colegio: toNullIfEmpty(form.colegio),
      promedio_colegio: toNullIfEmpty(form.promedio_colegio),
      ubigeo: toNullIfEmpty(form.ubigeo),
      fecha_nacimiento: toNullIfEmpty(form.fecha_nacimiento),
      sexo: toNullIfEmpty(form.sexo),
      discapacidad: toNullIfEmpty(form.discapacidad),
      nota_examen_anulado: toNullIfEmpty(form.nota_examen_anulado),
      resolucion_anulacion: toNullIfEmpty(form.resolucion_anulacion),
      fecha_examen_anulado: toNullIfEmpty(form.fecha_examen_anulado)
    };
  };

  const openEditRecordModal = (record: Participant) => {
    setEditingRecord(record);
    setEditForm({ ...record });
    setParticipantWizardStep(1);
    setShowSyncNameOption(false);
    setSyncNameChecked(false);
    setModalError(null);
    setDuplicateExistingRecord(null);
    setShowContingencySection(
      Boolean(record.nota_examen_anulado || record.resolucion_anulacion || record.fecha_examen_anulado)
    );
    setIsEditing(true);
  };

  const openAddParticipantModal = (prefillFromProfile: boolean = true, timelineHint?: TimelineItem) => {
    setParticipantWizardStep(1);
    setModalError(null);
    setDuplicateExistingRecord(null);
    setShowContingencySection(false);

    if (prefillFromProfile && selectedProfile) {
      const latestApp = timelineHint?.rawApp || selectedProfile.applications[0];
      const hintCareer = timelineHint?.carrera && timelineHint.carrera !== timelineHint.modalidad
        ? timelineHint.carrera
        : fixCareerName(latestApp?.carreraIngreso || latestApp?.carrera1 || '');
      const hintModality = timelineHint?.modalidad || latestApp?.modalidad || '';
      const hintYear = timelineHint?.anio ? String(timelineHint.anio) : (hintModality.match(/\b(20\d\d)\b/)?.[1] || new Date().getFullYear().toString());
      const rawSem = timelineHint?.semestre ? String(timelineHint.semestre) : '';
      const hintSem = rawSem
        ? (rawSem.includes('20') ? rawSem : (hintYear && (rawSem === 'I' || rawSem === 'II') ? `${hintYear}-${rawSem}` : rawSem))
        : '';
      const resolvedMeta = resolveCareerMetadata(hintCareer, '', timelineHint?.sede || 'CUSCO');

      setNewStudentForm({
        CODPOSTULANTE: selectedProfile.dni || '',
        NOMBRE: selectedProfile.fullName || '',
        ANIO: hintYear === 'Histórico' ? '' : hintYear,
        SEMESTRE: hintSem,
        MODALIDAD: hintModality.toUpperCase(),
        CARRERA: resolvedMeta.CARRERA,
        codigo_carrera: resolvedMeta.codigo_carrera || '',
        FILIAL: resolvedMeta.FILIAL || 'CUSCO',
        NOTA: timelineHint?.puntaje ? String(timelineHint.puntaje) : (latestApp?.nota || ''),
        OMERITO: timelineHint?.puesto ? String(timelineHint.puesto) : (latestApp?.puesto || ''),
        FECHAINGRESO: timelineHint?.fecha || '',
        telefono: selectedProfile.phone || '',
        email: selectedProfile.email || '',
        direccion: selectedProfile.address || '',
        ubigeo: selectedProfile.currentUbigeo || '',
        fecha_nacimiento: selectedProfile.birthDate || '',
        sexo: selectedProfile.gender || '',
        discapacidad: selectedProfile.disability || 'Ninguna',
        colegio: selectedProfile.schoolCode || selectedProfile.schoolInfo?.nombre_ie || selectedProfile.schoolName || '',
        promedio_colegio: ''
      });
    } else {
      setNewStudentForm({
        FILIAL: 'CUSCO',
        ANIO: new Date().getFullYear().toString(),
        discapacidad: 'Ninguna'
      });
    }
    setIsAddingNew(true);
  };

  const applyProfilePersonalDataToForm = (
    currentForm: Partial<Participant>,
    setter: React.Dispatch<React.SetStateAction<Partial<Participant>>>
  ) => {
    if (!selectedProfile) return;
    setter({
      ...currentForm,
      telefono: currentForm.telefono || selectedProfile.phone || '',
      email: currentForm.email || selectedProfile.email || '',
      direccion: currentForm.direccion || selectedProfile.address || '',
      ubigeo: currentForm.ubigeo || selectedProfile.currentUbigeo || '',
      fecha_nacimiento: currentForm.fecha_nacimiento || selectedProfile.birthDate || '',
      sexo: currentForm.sexo || selectedProfile.gender || '',
      discapacidad: currentForm.discapacidad || selectedProfile.disability || 'Ninguna',
      colegio: currentForm.colegio || selectedProfile.schoolCode || selectedProfile.schoolInfo?.nombre_ie || selectedProfile.schoolName || ''
    });
    notifyUser('Datos personales y de colegio completados desde el expediente.', 'info');
  };

  const handleUpdateRecord = async (syncName: boolean = false) => {
    if (!editingRecord) return;
    if (!editForm.CODPOSTULANTE?.trim() || !editForm.NOMBRE?.trim()) {
      setModalError('El Código / DNI y el Nombre Completo son obligatorios.');
      return;
    }
    setModalError(null);
    setLoading(true);
    try {
      const payload = buildParticipantPayload(editForm);

      const { data: updatedRow, error } = await supabase
        .from('participantes')
        .update(payload)
        .eq('id', editingRecord.id)
        .select('*')
        .single();
      
      if (error) throw error;

      if (syncName && editingRecord.NOMBRE !== payload.NOMBRE) {
        await supabase
          .from('participantes')
          .update({ NOMBRE: payload.NOMBRE })
          .eq('CODPOSTULANTE', payload.CODPOSTULANTE);
      }
      
      const savedParticipant = (updatedRow || { ...editingRecord, ...payload }) as Participant;

      // Update state immediately including personal/contact preview
      setSelectedProfile(prev => {
        if (!prev) return prev;
        const updatedAdms = prev.admissions.map(s => {
          if (s.id === editingRecord.id) {
            return savedParticipant;
          }
          if (syncName && s.CODPOSTULANTE === payload.CODPOSTULANTE) {
            return { ...s, NOMBRE: payload.NOMBRE } as Participant;
          }
          return s;
        });
        return {
          ...prev,
          dni: payload.CODPOSTULANTE || prev.dni,
          fullName: (syncName || prev.admissions.length <= 1) ? payload.NOMBRE : prev.fullName,
          phone: payload.telefono || prev.phone,
          email: payload.email || prev.email,
          address: payload.direccion || prev.address,
          currentUbigeo: payload.ubigeo || prev.currentUbigeo,
          birthDate: payload.fecha_nacimiento || prev.birthDate,
          gender: payload.sexo || prev.gender,
          disability: payload.discapacidad || prev.disability,
          schoolCode: payload.colegio && /^\d+$/.test(payload.colegio) ? payload.colegio : prev.schoolCode,
          schoolName: payload.colegio && !/^\d+$/.test(payload.colegio) ? payload.colegio : prev.schoolName,
          admissions: updatedAdms
        };
      });
      
      setIsEditing(false);
      setEditingRecord(null);
      setShowSyncNameOption(false);
      setSyncNameChecked(false);
      notifyUser('Registro de ingresante actualizado correctamente en participantes.', 'success');
    } catch (err: any) {
      setModalError('Error al actualizar en participantes: ' + (err.message || 'Error desconocido'));
      notifyUser('Error al actualizar: ' + (err.message || 'Error desconocido'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStudent = async () => {
    if (!newStudentForm.NOMBRE?.trim() || !newStudentForm.CODPOSTULANTE?.trim()) {
      setModalError('El Código / DNI y el Nombre Completo son campos obligatorios.');
      return;
    }
    if (!newStudentForm.CARRERA?.trim() || !newStudentForm.MODALIDAD?.trim()) {
      setModalError('La Modalidad Oficial y la Escuela Profesional / Carrera son obligatorias para el padrón de ingresantes.');
      return;
    }

    setModalError(null);
    setDuplicateExistingRecord(null);
    setLoading(true);
    try {
      const payload = buildParticipantPayload(newStudentForm);

      // Protección AGENTS.md Regla 3: 1 fila oficial por proceso de admisión para cada ingresante
      let dupQuery = supabase
        .from('participantes')
        .select('*')
        .eq('CODPOSTULANTE', payload.CODPOSTULANTE)
        .eq('MODALIDAD', payload.MODALIDAD);
      if (payload.ANIO) dupQuery = dupQuery.eq('ANIO', payload.ANIO);
      if (payload.SEMESTRE) dupQuery = dupQuery.eq('SEMESTRE', payload.SEMESTRE);

      const { data: existingRows } = await dupQuery.limit(1);
      if (existingRows && existingRows.length > 0) {
        setDuplicateExistingRecord(existingRows[0] as Participant);
        setModalError(
          `Este ingresante (DNI ${payload.CODPOSTULANTE}) ya cuenta con un registro oficial en participantes para el proceso ${payload.MODALIDAD} (${payload.SEMESTRE || payload.ANIO}). Según las directivas de auditoría, no se deben duplicar filas en un mismo proceso.`
        );
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('participantes')
        .insert([payload])
        .select('*')
        .single();
      if (error) throw error;
      
      notifyUser('Ingresante registrado con éxito en la tabla oficial participantes.', 'success');
      setIsAddingNew(false);
      setNewStudentForm({});
      setSearchQuery(data.CODPOSTULANTE);
      await handleSearch(data.CODPOSTULANTE);
    } catch (err: any) {
      setModalError('Error al registrar en participantes: ' + (err.message || 'Error desconocido'));
      notifyUser('Error al agregar ingresante: ' + (err.message || 'Error desconocido'), 'error');
    } finally {
      setLoading(false);
    }
  };

  // Batch Processing
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      const fileName = file.name.toLowerCase();
      const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
      const reader = new FileReader();

      reader.onload = async (evt) => {
          try {
              let rows: any[][] = [];

              if (isExcel) {
                  const data = new Uint8Array(evt.target?.result as ArrayBuffer);
                  const workbook = XLSX.read(data, { type: 'array' });
                  const firstSheetName = workbook.SheetNames[0];
                  const worksheet = workbook.Sheets[firstSheetName];
                  const rawExcelRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
                  rows = rawExcelRows.filter(r => r && r.some(cell => String(cell ?? '').trim() !== ''));
              } else {
                  const content = evt.target?.result as string;
                  const lines = content.split(/\r?\n/).filter(line => line.trim());
                  if (lines.length === 0) return;

                  const firstLine = lines[0];
                  let delimiter = ',';
                  if (firstLine.includes(';') && (firstLine.split(';').length >= firstLine.split(',').length)) {
                      delimiter = ';';
                  } else if (firstLine.includes('\t')) {
                      delimiter = '\t';
                  }

                  rows = lines.map(line => {
                      return line.split(delimiter).map(p => p.trim().replace(/^"|"$/g, ''));
                  }).filter(r => r && r.some(cell => String(cell ?? '').trim() !== ''));
              }

              if (rows.length === 0) {
                  alert("El archivo no contiene registros válidos.");
                  return;
              }

              setIsProcessingBatch(true);
              setBatchProgress(0);
              setBatchStatusText('Analizando archivo...');

              const firstRow = rows[0].map(c => String(c ?? '').trim().toUpperCase());
              const isHeader = firstRow.some(c => 
                  c.includes('DNI') || c.includes('NOMBRE') || c.includes('POSTULANTE') || 
                  c.includes('ESTUD') || c.includes('ALUM') || c.includes('CODIGO')
              );

              let codeIdx = 0;
              let nameIdx = 1;
              let studentCodeIdx = -1;
              let dataStartIndex = isHeader ? 1 : 0;

              if (isHeader) {
                  const sIdx = firstRow.findIndex(c => 
                      c.includes('ESTUD') || c.includes('ALUM') || c.includes('MATRICULA')
                  );
                  if (sIdx !== -1) studentCodeIdx = sIdx;

                  const dIdx = firstRow.findIndex((c, idx) => 
                      idx !== studentCodeIdx && (c.includes('DNI') || c.includes('DOC') || c.includes('POSTULANTE') || c.includes('CODIGO'))
                  );
                  if (dIdx !== -1) codeIdx = dIdx;

                  const nIdx = firstRow.findIndex((c, idx) => 
                      idx !== studentCodeIdx && idx !== codeIdx && (c.includes('NOMBRE') || c.includes('APELLIDO'))
                  );
                  if (nIdx !== -1) nameIdx = nIdx;
              }

              const rawData = rows.slice(dataStartIndex).map(parts => {
                  const code = String(parts[codeIdx] ?? '').trim();
                  const name = String(parts[nameIdx] ?? '').trim().toUpperCase();
                  const studentCode = studentCodeIdx >= 0 ? String(parts[studentCodeIdx] ?? '').trim() : '';
                  return { code, name, studentCode };
              }).filter(item => item.code !== '' || item.name !== '');

              const exactCodes = Array.from(new Set(rawData.map(d => d.code).filter(Boolean)));
              const exactNames = Array.from(new Set(rawData.map(d => d.name).filter(Boolean)));
              
              let dbMatches: any[] = [];
              const chunkSize = 200;
              
              setBatchStatusText('Consultando base de datos oficial...');
              for (let i = 0; i < exactCodes.length; i += chunkSize) {
                  const chunk = exactCodes.slice(i, i + chunkSize);
                  const { data } = await supabase
                      .from('participantes')
                      .select('*')
                      .in('CODPOSTULANTE', chunk);
                  if (data) dbMatches = dbMatches.concat(data);
                  setBatchProgress(Math.round(((i + chunkSize) / (exactCodes.length || 1)) * 50));
              }

              for (let i = 0; i < exactNames.length; i += chunkSize) {
                  const chunk = exactNames.slice(i, i + chunkSize);
                  const { data } = await supabase
                      .from('participantes')
                      .select('*')
                      .in('NOMBRE', chunk);
                  if (data) {
                      const newMatches = data.filter(d => !dbMatches.some(dm => dm.id === d.id));
                      dbMatches = dbMatches.concat(newMatches);
                  }
                  setBatchProgress(50 + Math.round(((i + chunkSize) / (exactNames.length || 1)) * 40));
              }

              const codeMap = new Map<string, Participant[]>();
              const nameMap = new Map<string, Participant[]>();

              dbMatches.forEach(m => {
                  const codeKey = String(m.CODPOSTULANTE).trim();
                  const nameKey = String(m.NOMBRE).trim();
                  if (codeKey) {
                      if (!codeMap.has(codeKey)) codeMap.set(codeKey, []);
                      codeMap.get(codeKey)!.push(m);
                  }
                  if (nameKey) {
                      if (!nameMap.has(nameKey)) nameMap.set(nameKey, []);
                      nameMap.get(nameKey)!.push(m);
                  }
              });

              const results: BatchResult[] = rawData.map(item => {
                  const codeMatches = item.code ? (codeMap.get(item.code) || []) : [];
                  const nameMatches = item.name ? (nameMap.get(item.name) || []) : [];
                  
                  let exactMatches: Participant[] = [];
                  let probableMatches: Participant[] = [];

                  if (item.code && item.name) {
                      const nameMatchesSet = new Set(nameMatches.map(m => m.id));
                      codeMatches.forEach(m => {
                          if (nameMatchesSet.has(m.id)) exactMatches.push(m);
                          else probableMatches.push(m);
                      });
                      nameMatches.forEach(m => {
                          if (!probableMatches.some(pm => pm.id === m.id) && !exactMatches.some(em => em.id === m.id)) {
                              probableMatches.push(m);
                          }
                      });
                  } else if (item.name) {
                      exactMatches = nameMatches;
                  } else if (item.code) {
                      exactMatches = codeMatches;
                  }

                  const finalMatches = exactMatches.length > 0 ? exactMatches : probableMatches;
                  let s: 'EXACT' | 'PROBABLE' | 'NOT_FOUND' = 'NOT_FOUND';
                  if (exactMatches.length > 0) s = 'EXACT';
                  else if (probableMatches.length > 0) s = 'PROBABLE';

                  return {
                      originalCode: item.code,
                      originalName: item.name,
                      studentCode: item.studentCode,
                      found: finalMatches.length > 0,
                      status: s,
                      allMatches: finalMatches
                  };
              });

              setBatchResults(results);
              setBatchProgress(100);
              setIsProcessingBatch(false);
          } catch (err: any) {
              alert("Error al procesar archivo: " + err.message);
              setIsProcessingBatch(false);
          }
      };

      if (isExcel) reader.readAsArrayBuffer(file);
      else reader.readAsText(file);
  };

  const handleExportCruceExcel = () => {
      if (batchResults.length === 0) return;
      const dataToExport = batchResults.map(res => ({
          'Código/DNI': res.originalCode,
          'Cód. Estudiante': res.studentCode || '',
          'Nombre Buscado': res.originalName,
          'Estado': res.status === 'EXACT' ? 'CONFIRMADO' : (res.status === 'PROBABLE' ? 'PROBABLE' : 'NO REGISTRADO'),
          'Carrera': res.allMatches.length > 0 ? fixEncoding(res.allMatches[0].CARRERA) : '',
          'Semestre-Año': res.allMatches.length > 0 ? `${res.allMatches[0].SEMESTRE}-${res.allMatches[0].ANIO}` : '',
          'Modalidad': res.allMatches.length > 0 ? res.allMatches[0].MODALIDAD : '',
          'Nota': res.allMatches.length > 0 ? res.allMatches[0].NOTA : '',
          'Puesto': res.allMatches.length > 0 ? res.allMatches[0].OMERITO : ''
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Cruce_Masivo');
      XLSX.writeFile(wb, `Cruce_Masivo_${new Date().getTime()}.xlsx`);
  };

  const handleExportCrucePdf = () => {
      if (batchResults.length === 0) return;
      const doc = new jsPDF();
      doc.setFontSize(14);
      doc.text('REPORTE DE CRUCE MASIVO DE INGRESANTES', 14, 15);
      doc.setFontSize(9);
      doc.text(`Fecha: ${new Date().toLocaleDateString('es-PE')} ${new Date().toLocaleTimeString('es-PE')}`, 14, 22);

      const tableData = batchResults.map(res => [
          res.originalCode,
          res.studentCode || '-',
          res.originalName,
          res.status === 'EXACT' ? 'CONFIRMADO' : (res.status === 'PROBABLE' ? 'PROBABLE' : 'NO REGISTRADO'),
          res.allMatches.length > 0 ? `${fixEncoding(res.allMatches[0].CARRERA)} (${res.allMatches[0].SEMESTRE}-${res.allMatches[0].ANIO})` : '-'
      ]);

      autoTable(doc, {
          startY: 28,
          head: [['Código/DNI', 'Cód. Est.', 'Nombre Buscado', 'Estado', 'Carrera y Proceso']],
          body: tableData,
          theme: 'striped',
          headStyles: { fillColor: [15, 23, 42] },
          styles: { fontSize: 8 }
      });

      doc.save(`Cruce_Masivo_${new Date().getTime()}.pdf`);
  };

  // Import Logic
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
          const content = evt.target?.result as string;
          const lines = content.split(/\r?\n/).filter(line => line.trim());
          if (lines.length <= 1) return;

          const delimiter = lines[0].includes(';') ? ';' : ',';
          const parsed = lines.slice(1).map(line => {
              const cols = line.split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''));
              return {
                  CODPOSTULANTE: cols[0] || '',
                  NOMBRE: (cols[1] || '').toUpperCase(),
                  CARRERA: (cols[2] || '').toUpperCase(),
                  FILIAL: (cols[3] || 'CUSCO').toUpperCase(),
                  MODALIDAD: (cols[4] || '').toUpperCase(),
                  SEMESTRE: cols[5] || '',
                  ANIO: cols[6] || '',
                  NOTA: cols[7] || '0',
                  OMERITO: cols[8] || '0',
                  FECHAINGRESO: cols[9] || ''
              };
          }).filter(item => item.CODPOSTULANTE !== '');

          setImportData(parsed);
      };
      reader.readAsText(file);
  };

  const processImport = async () => {
      if (importData.length === 0) return;
      setIsImporting(true);
      setImportProgress(0);
      const CHUNK_SIZE = 100;
      let successCount = 0;

      try {
          for (let i = 0; i < importData.length; i += CHUNK_SIZE) {
              const chunk = importData.slice(i, i + CHUNK_SIZE);
              const { error } = await supabase.from('participantes').insert(chunk);
              if (error) throw error;
              successCount += chunk.length;
              setImportProgress(Math.round((successCount / importData.length) * 100));
          }
          alert(`✅ Importación exitosa: ${successCount} registros ingresados.`);
          setImportData([]);
          setActiveMode('individual');
      } catch (err: any) {
          alert(`Error durante la importación: ${err.message}`);
      } finally {
          setIsImporting(false);
          setImportProgress(0);
      }
  };

  // Build unified timeline events for selected profile with strict deduplication
  const getUnifiedTimelineEvents = (): TimelineItem[] => {
      if (!selectedProfile) return [];
      const items: TimelineItem[] = [];
      const matchedAppIds = new Set<string>();
      const matchedFolderLabels = new Set<string>();

      // PASO A: INGRESOS OFICIALES (participantes)
      selectedProfile.admissions.forEach((adm, idx) => {
          let carreraName = fixCareerName(adm.CARRERA);
          const admAnio = String(adm.ANIO || '').trim();
          const admSem = String(adm.SEMESTRE || 'I').trim();
          const admMod = String(adm.MODALIDAD || 'ORDINARIO').trim();
          const pKey = normalizeProcessKey(admMod, admSem, admAnio);

          let puntaje: string | number | undefined = adm.NOTA && String(adm.NOTA) !== '0' ? adm.NOTA : undefined;
          let puesto: string | number | undefined = adm.OMERITO && String(adm.OMERITO) !== '0' ? adm.OMERITO : undefined;
          let grupo: string | undefined = undefined;
          let matchedFolder: string | undefined = undefined;
          let matchedDocCount = 0;

          // Buscar TODAS las coincidencias en pre_revision_archivos (applications) para este mismo proceso y fusionar
          const matchingApps = selectedProfile.applications.filter(app => {
              if (matchedAppIds.has(app.id)) return false;
              const prKey = normalizeProcessKey(
                  app.modalidad, 
                  String(app.rawRow?._semestre || app.rawRow?.semestre || app.rawRow?.Semestre || ''), 
                  String(app.rawRow?._anio || app.rawRow?.anio || app.rawRow?.Anio || admAnio),
                  app.rawRow
              );
              
              // 1. Coincidencia exacta por clave normalizada (ej. 2026-I_ORDINARIO === 2026-I_ORDINARIO)
              if (pKey && prKey && pKey === prKey) return true;

              // 2. Coincidencia por año, semestre y tipo de examen (ej. 2026-I y ORDINARIO)
              const [pYearSem, pRest] = pKey.split('_');
              const [prYearSem, prRest] = prKey.split('_');
              if (pYearSem && prYearSem && pYearSem === prYearSem && pRest === prRest) return true;

              // 3. Coincidencia por carrera de ingreso real y año
              const appRealCareer = fixCareerName(app.carreraIngreso || (app.condicion?.includes('INGRESA') ? app.carrera1 : ''));
              const sameCareer = (carreraName && appRealCareer && (carreraName.includes(appRealCareer) || appRealCareer.includes(carreraName)));
              const sameYear = admAnio && (String(app.modalidad).includes(admAnio) || String(app.rawRow?.anio || '').includes(admAnio));
              if (sameCareer && sameYear && pRest === prRest) return true;

              return false;
          });

          matchingApps.forEach(matchingApp => {
              matchedAppIds.add(matchingApp.id);
              if (!puntaje && matchingApp.nota) puntaje = matchingApp.nota;
              if (!puesto && matchingApp.puesto) puesto = matchingApp.puesto;
              if (!grupo && matchingApp.grupo) grupo = matchingApp.grupo;
              
              // Si la carrera en participantes es genérica o código, usar carreraIngreso de pre-revisión
              const candidateCareer = fixCareerName(matchingApp.carreraIngreso || adm.CARRERA);
              if ((!carreraName || carreraName === 'CARRERA UNIVERSITARIA') && candidateCareer) {
                  carreraName = candidateCareer;
              }
          });

          // Buscar documentos en disco H:\ asociados a este ingreso
          const groupedDocs = getGroupedDocuments(selectedProfile.documents);
          Object.entries(groupedDocs).forEach(([folderLabel, docs]) => {
              const folderKey = normalizeProcessKey(folderLabel, '', admAnio);
              if (folderKey === pKey || (admAnio && folderLabel.includes(admAnio) && (admSem === 'I' ? !folderLabel.includes('-II') : folderLabel.includes('-II')))) {
                  matchedFolder = folderLabel;
                  matchedDocCount = docs.length;
                  matchedFolderLabels.add(folderLabel);
              }
          });

          items.push({
              id: `ingreso-${adm.id || idx}`,
              tipo: 'INGRESO',
              carrera: carreraName || 'CARRERA UNIVERSITARIA',
              modalidad: adm.MODALIDAD || 'ORDINARIO',
              anio: adm.ANIO || '',
              semestre: adm.SEMESTRE || 'I',
              puntaje,
              puesto,
              grupo,
              sede: adm.FILIAL || 'CUSCO',
              fecha: adm.FECHAINGRESO || '',
              carpetaDocs: matchedFolder,
              documentosCount: matchedDocCount,
              rawAdm: adm
          });
      });

      // PASO B: PROCESAR PRE-REVISIÓN (pre_revision_archivos)
      selectedProfile.applications.forEach((app, idx) => {
          if (matchedAppIds.has(app.id)) return; // Ya fusionada en el ingreso oficial

          const prKey = normalizeProcessKey(
              app.modalidad, 
              String(app.rawRow?._semestre || app.rawRow?.semestre || app.rawRow?.Semestre || ''), 
              String(app.rawRow?._anio || app.rawRow?.anio || app.rawRow?.Anio || ''),
              app.rawRow
          );

          // Verificar si ya existe un evento (INGRESO o POSTULACION) para este mismo proceso exacto
          const matchingItem = items.find(it => {
              const itKey = normalizeProcessKey(it.modalidad, it.semestre, it.anio);
              
              // 1. Clave de proceso idéntica (ej. 2026-I_DIRIMENCIA === 2026-I_DIRIMENCIA)
              if (itKey && prKey && itKey === prKey) return true;

              // 2. Mismo año-semestre y mismo tipo de examen
              const [itYearSem, itRest] = itKey.split('_');
              const [prYearSem, prRest] = prKey.split('_');
              if (itYearSem && prYearSem && itYearSem === prYearSem && itRest === prRest) return true;

              return false;
          });

          if (matchingItem) {
              // SI YA EXISTE UN EVENTO EN ESTE MISMO PROCESO: NO crear una segunda tarjeta.
              // Inyectar datos faltantes en la tarjeta existente
              matchedAppIds.add(app.id);
              if (!matchingItem.puntaje && app.nota) matchingItem.puntaje = app.nota;
              if (!matchingItem.puesto && app.puesto) matchingItem.puesto = app.puesto;
              if (!matchingItem.grupo && app.grupo) matchingItem.grupo = app.grupo;
              return;
          }

          // SI NO EXISTE UN EVENTO EN ESTE PROCESO:
          const obs = String(app.condicion || app.rawRow?.OBSERVACION || app.rawRow?.ESTADO || '').toUpperCase();
          const isIngresante = isApplicantAdmitted(obs, app.rawRow);

          let extractedAnio = String(app.rawRow?._anio || app.rawRow?.anio || app.rawRow?.Anio || '').trim();
          if (!extractedAnio) {
              const yMatch = (String(app.modalidad) + ' ' + String(app.rawRow?.nombremodalidad || '')).match(/\b(202\d|20\d\d)\b/);
              if (yMatch) extractedAnio = yMatch[1];
          }
          if (!extractedAnio) extractedAnio = '2026';

          let extractedSem = String(app.rawRow?._semestre || app.rawRow?.semestre || app.rawRow?.Semestre || '').trim();
          if (extractedSem.includes('-II') || extractedSem === 'II' || extractedSem === '2') {
              extractedSem = 'II';
          } else if (extractedSem.includes('-I') || extractedSem === 'I' || extractedSem === '1') {
              extractedSem = 'I';
          } else {
              const modUpper = (String(app.modalidad) + ' ' + String(app.rawRow?.nombremodalidad || '')).toUpperCase();
              if (
                  modUpper.includes('2026-II') || 
                  modUpper.includes('2025-II') || 
                  modUpper.includes('2024-II') || 
                  modUpper.includes('-II') || 
                  /\bII\b/.test(modUpper) || 
                  modUpper.includes('SEGUNDA OPORTUNIDAD') || 
                  modUpper.includes('SEGUNDO EXAMEN') ||
                  modUpper.includes('SEMESTRE: II') || 
                  modUpper.includes('SEMESTRE II')
              ) {
                  extractedSem = 'II';
              } else {
                  extractedSem = 'I';
              }
          }

          // REGLA CRÍTICA:
          // Si es ingresante, la carrera real es carreraIngreso (segunda opción o primera opción adjudicada).
          // Si no es ingresante, la carrera postulada es carrera1 (primera opción) o carrera2.
          let appCareer = '';
          if (isIngresante) {
              appCareer = fixCareerName(app.carreraIngreso) || fixCareerName(app.carrera1) || fixCareerName(app.carrera2);
          } else {
              appCareer = fixCareerName(app.carrera1) || fixCareerName(app.carrera2) || fixCareerName(app.carreraIngreso);
          }

          if (!appCareer || /^\d+$/.test(appCareer)) {
              appCareer = app.modalidad || 'POSTULACIÓN REGISTRADA';
          }

          const appSede = app.rawRow?.sede || app.rawRow?.Sede || app.rawRow?.SEDE || app.rawRow?.filial || app.rawRow?.Filial || app.rawRow?.FILIAL || 'CUSCO';

          // Buscar si hay carpeta local de documentos para esta postulación
          let matchedFolder = '';
          let matchedDocCount = 0;
          const groupedDocs = getGroupedDocuments(selectedProfile.documents);
          Object.entries(groupedDocs).forEach(([folderLabel, docs]) => {
              const folderKey = normalizeProcessKey(folderLabel, '', extractedAnio);
              if (folderKey === prKey || (extractedAnio && folderLabel.includes(extractedAnio) && (extractedSem === 'I' ? !folderLabel.includes('-II') : folderLabel.includes('-II')))) {
                  matchedFolder = folderLabel;
                  matchedDocCount = docs.length;
                  matchedFolderLabels.add(folderLabel);
              }
          });

          items.push({
              id: `postulacion-app-${app.id || idx}`,
              tipo: isIngresante ? 'INGRESO' : 'POSTULACION',
              carrera: appCareer,
              modalidad: app.modalidad || 'PROCESO DE ADMISIÓN',
              anio: extractedAnio,
              semestre: extractedSem,
              puntaje: app.nota,
              puesto: app.puesto,
              grupo: app.grupo,
              sede: appSede,
              carpetaDocs: matchedFolder,
              documentosCount: matchedDocCount,
              condicion: isIngresante ? 'Ingresante adjudicado en proceso' : (app.condicion || 'No alcanzó vacante'),
              rawApp: app
          });
      });

      // B2: Desde Carpetas del Disco H:\ (File Gateway) que no correspondan a un ingreso oficial
      const groupedDocs = getGroupedDocuments(selectedProfile.documents);
      Object.entries(groupedDocs).forEach(([folderLabel, docs]) => {
          if (matchedFolderLabels.has(folderLabel)) return;

          const folderKey = normalizeProcessKey(folderLabel, '', '');
          
          // Verificar si ya está cubierta por algún evento
          const matchingEvent = items.find(it => {
              const itKey = normalizeProcessKey(it.modalidad, it.semestre, it.anio);
              return itKey === folderKey || it.carpetaDocs === folderLabel;
          });

          if (matchingEvent) {
              if (!matchingEvent.carpetaDocs) {
                  matchingEvent.carpetaDocs = folderLabel;
                  matchingEvent.documentosCount = docs.length;
              }
              matchedFolderLabels.add(folderLabel);
              return;
          }

          let extractedAnio = '';
          const yMatch = folderLabel.match(/\b(20\d\d)\b/);
          if (yMatch) extractedAnio = yMatch[1];

          let extractedSem = 'I';
          const labelUpper = folderLabel.toUpperCase();
          if (
              labelUpper.includes('2026-II') || 
              labelUpper.includes('2025-II') || 
              labelUpper.includes('2024-II') || 
              labelUpper.includes('-II') || 
              /\bII\b/.test(labelUpper) || 
              labelUpper.includes('SEGUNDA OPORTUNIDAD') || 
              labelUpper.includes('SEGUNDO EXAMEN') ||
              labelUpper.includes('SEMESTRE: II') || 
              labelUpper.includes('SEMESTRE II')
          ) {
              extractedSem = 'II';
          } else if (labelUpper.includes('PO') || labelUpper.includes('PRIMERA OP') || labelUpper.includes('PRIMERA')) {
              extractedSem = 'I';
          } else if (labelUpper.includes('DIRIMENCIA') || labelUpper.includes('DIRIM') || labelUpper.includes('1ER Y 2DO') || labelUpper.includes('EXONERACION') || labelUpper.includes('EXONERACIÓN')) {
              extractedSem = 'I';
          }

          items.push({
              id: `postulacion-folder-${folderLabel}`,
              tipo: 'POSTULACION',
              carrera: folderLabel,
              modalidad: folderLabel,
              anio: extractedAnio || 'Histórico',
              semestre: extractedSem,
              carpetaDocs: folderLabel,
              documentosCount: docs.length,
              condicion: 'Expediente digital en disco local • Rindió examen / No figura en padrón de ingresantes'
          });
      });

      // PASO C: ORDENAMIENTO CRONOLÓGICO DESCENDENTE
      const getSortScore = (item: TimelineItem) => {
          let yearNum = 0;
          const yMatch = String(item.anio).match(/\b(20\d\d|\d{4})\b/);
          if (yMatch) {
              yearNum = parseInt(yMatch[1], 10);
          } else {
              const modMatch = String(item.modalidad).match(/\b(20\d\d|\d{4})\b/);
              if (modMatch) yearNum = parseInt(modMatch[1], 10);
          }

          let semScore = 1;
          const semText = (String(item.semestre) + ' ' + String(item.modalidad)).toUpperCase();
          if (semText.includes('II') || semText.includes('-2') || semText.includes('SEGUNDA')) {
              semScore = 3;
          } else if (semText.includes('I') || semText.includes('-1')) {
              semScore = 2;
          } else if (semText.includes('PO') || semText.includes('PRIMERA')) {
              semScore = 1;
          }

          const typePriority = item.tipo === 'INGRESO' ? 0.2 : 0.0;
          return yearNum * 10 + semScore + typePriority;
      };

      items.sort((a, b) => getSortScore(b) - getSortScore(a));

      return items;
  };

  const timelineEvents = getUnifiedTimelineEvents();

  // Photo URL
  const candidatePhotoUrl = selectedProfile?.photoDoc 
    ? getDocumentStreamUrl(selectedProfile.photoDoc.path, gatewayUrl) 
    : null;

  return (
    <div className="flex-1 w-full max-w-[1600px] mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-6 h-full overflow-hidden">
      
      {/* DATALISTS DE CATÁLOGOS OFICIALES (AGENTS.md Regla 1) */}
      <datalist id="official-modalidades-list">
        {officialModalidades.map((mod, idx) => (
          <option key={idx} value={mod} />
        ))}
      </datalist>
      <datalist id="official-carreras-list">
        {Array.from(
          new Set([
            ...officialEscuelas.map(e => e.nombre),
            ...Object.values(CAREER_CODE_MAP)
          ])
        )
          .sort()
          .map((car, idx) => (
            <option key={idx} value={car} />
          ))}
      </datalist>
      <datalist id="official-filiales-list">
        {Array.from(
          new Set([
            'CUSCO',
            'ANDAHUAYLAS',
            'SICUANI',
            'ESPINAR',
            'SANTO TOMAS',
            'PUERTO MALDONADO',
            'QUILLABAMBA',
            'CURAHUASI',
            'VILCABAMBA',
            'CANAS',
            ...officialEscuelas.map(e => e.filial).filter(Boolean)
          ])
        ).map((fil, idx) => (
          <option key={idx} value={fil} />
        ))}
      </datalist>
      <datalist id="official-semestres-list">
        {['2026-I', '2026-II', '2025-I', '2025-II', '2024-I', '2024-II', '2023-I', '2023-II', '2022-I', '2022-II', 'I', 'II'].map((sem, idx) => (
          <option key={idx} value={sem} />
        ))}
      </datalist>
      <datalist id="official-discapacidad-list">
        {['Ninguna', 'Física / Motora', 'Visual', 'Auditiva', 'Intelectual', 'CONADIS'].map((d, idx) => (
          <option key={idx} value={d} />
        ))}
      </datalist>

      {/* MODAL POR PASOS (WIZARD) DE EDICIÓN / REGISTRO EN TABLA PARTICIPANTES */}
      {((isEditing && editingRecord) || isAddingNew) && (() => {
        const isEditMode = Boolean(isEditing && editingRecord);
        const currentForm = isEditMode ? editForm : newStudentForm;
        const updateCurrentForm = (patch: Partial<Participant>) => {
          if (modalError) setModalError(null);
          if (isEditMode) {
            setEditForm(prev => ({ ...prev, ...patch }));
          } else {
            setNewStudentForm(prev => ({ ...prev, ...patch }));
          }
        };
        const closeParticipantModal = () => {
          setIsEditing(false);
          setEditingRecord(null);
          setShowSyncNameOption(false);
          setSyncNameChecked(false);
          setIsAddingNew(false);
          setNewStudentForm({});
          setParticipantWizardStep(1);
          setModalError(null);
          setDuplicateExistingRecord(null);
        };

        const wizardSteps: Array<{ step: 1 | 2 | 3 | 4; shortTitle: string; title: string; subtitle: string; icon: string }> = [
          {
            step: 1,
            shortTitle: 'Identificación',
            title: 'Identificación y Proceso',
            subtitle: 'Datos básicos del estudiante y proceso de admisión al que corresponde.',
            icon: 'badge'
          },
          {
            step: 2,
            shortTitle: 'Carrera y Nota',
            title: 'Carrera, Sede y Resultados',
            subtitle: 'Escuela profesional adjudicada, filial, puntaje oficial y orden de mérito.',
            icon: 'school'
          },
          {
            step: 3,
            shortTitle: 'Contacto',
            title: 'Contacto y Datos Personales',
            subtitle: ' Medios de comunicación, domicilio actual y datos demográficos.',
            icon: 'contact_phone'
          },
          {
            step: 4,
            shortTitle: 'Colegio y Cierre',
            title: 'Colegio y Confirmación Final',
            subtitle: 'Procedencia escolar, contingencias opcionales y resumen previo al guardado.',
            icon: 'fact_check'
          }
        ];

        const validateBeforeStep = (targetStep: 1 | 2 | 3 | 4): boolean => {
          if (targetStep > 1) {
            if (!currentForm.CODPOSTULANTE?.trim() || !currentForm.NOMBRE?.trim()) {
              setModalError('Complete el Código / DNI y los Apellidos y Nombres antes de continuar.');
              return false;
            }
            if (!isEditMode && !currentForm.MODALIDAD?.trim()) {
              setModalError('Indique la Modalidad Oficial del proceso antes de pasar al siguiente paso.');
              return false;
            }
          }
          if (targetStep > 2 && !isEditMode && !currentForm.CARRERA?.trim()) {
            setModalError('Seleccione o escriba la Escuela Profesional / Carrera antes de continuar.');
            return false;
          }
          setModalError(null);
          return true;
        };

        const handleGoToStep = (targetStep: 1 | 2 | 3 | 4) => {
          if (targetStep <= participantWizardStep || validateBeforeStep(targetStep)) {
            setParticipantWizardStep(targetStep);
          }
        };

        const handleNextStep = () => {
          if (participantWizardStep < 4) {
            const next = (participantWizardStep + 1) as 1 | 2 | 3 | 4;
            if (validateBeforeStep(next)) {
              setParticipantWizardStep(next);
            }
          }
        };

        const handlePrevStep = () => {
          if (participantWizardStep > 1) {
            setModalError(null);
            setParticipantWizardStep((participantWizardStep - 1) as 1 | 2 | 3 | 4);
          }
        };

        const handleModalityChange = (val: string) => {
          const upper = val.toUpperCase();
          const patch: Partial<Participant> = { MODALIDAD: val };
          const yMatch = upper.match(/\b(20\d\d|19\d\d)\b/);
          if (yMatch && !currentForm.ANIO) {
            patch.ANIO = yMatch[1];
          }
          if (!currentForm.SEMESTRE && yMatch) {
            if (upper.includes(`${yMatch[1]}-II`) || /\bII\b/.test(upper)) {
              patch.SEMESTRE = `${yMatch[1]}-II`;
            } else if (upper.includes(`${yMatch[1]}-I`) || upper.includes('PRIMERA OPORTUNIDAD') || upper.includes('EXONERACIÓN') || upper.includes('EXONERACION')) {
              patch.SEMESTRE = `${yMatch[1]}-I`;
            }
          }
          updateCurrentForm(patch);
        };

        const handleCareerChange = (val: string) => {
          const clean = val.trim().toUpperCase();
          const matchedEsc = officialEscuelas.find(e => e.nombre === clean);
          if (matchedEsc) {
            updateCurrentForm({
              CARRERA: val,
              codigo_carrera: matchedEsc.codigo_carrera || currentForm.codigo_carrera || '',
              FILIAL: matchedEsc.filial || currentForm.FILIAL || 'CUSCO'
            });
            return;
          }
          const mapMatch = Object.entries(CAREER_CODE_MAP).find(([, name]) => name.toUpperCase() === clean);
          if (mapMatch) {
            updateCurrentForm({
              CARRERA: val,
              codigo_carrera: currentForm.codigo_carrera || mapMatch[0]
            });
            return;
          }
          updateCurrentForm({ CARRERA: val });
        };

        const handleCareerCodeChange = (val: string) => {
          const cleanCode = val.trim();
          const unpadded = cleanCode.replace(/^0+/, '');
          const matchedEsc = officialEscuelas.find(
            e => e.codigo_carrera === cleanCode || (unpadded && e.codigo_carrera.replace(/^0+/, '') === unpadded)
          );
          if (matchedEsc && !currentForm.CARRERA?.trim()) {
            updateCurrentForm({
              codigo_carrera: val,
              CARRERA: matchedEsc.nombre,
              FILIAL: matchedEsc.filial || currentForm.FILIAL || 'CUSCO'
            });
            return;
          }
          const mappedName = CAREER_CODE_MAP[unpadded] || CAREER_CODE_MAP[cleanCode];
          if (mappedName && !currentForm.CARRERA?.trim()) {
            updateCurrentForm({
              codigo_carrera: val,
              CARRERA: mappedName
            });
            return;
          }
          updateCurrentForm({ codigo_carrera: val });
        };

        const canAutofillFromProfile = Boolean(
          selectedProfile &&
          (!currentForm.CODPOSTULANTE || currentForm.CODPOSTULANTE.trim() === selectedProfile.dni) &&
          (selectedProfile.phone || selectedProfile.email || selectedProfile.address || selectedProfile.schoolCode || selectedProfile.schoolName || selectedProfile.birthDate)
        );

        const activeStepMeta = wizardSteps[participantWizardStep - 1];

        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-900/65 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 border border-slate-200">
              {/* Header fijo */}
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`size-11 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-sm ${isEditMode ? 'bg-primary' : 'bg-emerald-600'}`}>
                    <span className="material-symbols-outlined text-[22px]">{isEditMode ? 'edit_square' : 'person_add'}</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-black text-slate-900 uppercase truncate">
                      {isEditMode ? 'Editar Ingresante Oficial' : 'Nuevo Ingresante Oficial'}
                    </h3>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
                      {currentForm.NOMBRE ? `${currentForm.NOMBRE.toUpperCase()}${currentForm.CODPOSTULANTE ? ` • DNI ${currentForm.CODPOSTULANTE}` : ''}` : 'Tabla oficial: participantes'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!isEditMode && selectedProfile && (
                    <button
                      type="button"
                      onClick={() => {
                        setNewStudentForm({ FILIAL: 'CUSCO', ANIO: new Date().getFullYear().toString(), discapacidad: 'Ninguna' });
                        setParticipantWizardStep(1);
                      }}
                      className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-slate-200/70 hover:bg-slate-200 text-slate-600 transition-colors"
                      title="Limpiar formulario para registrar una persona distinta"
                    >
                      Limpiar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closeParticipantModal}
                    className="size-9 rounded-full hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
              </div>

              {/* Barra de Pasos (Stepper) */}
              <div className="px-6 py-3.5 bg-white border-b border-slate-100 shrink-0">
                <div className="grid grid-cols-4 gap-2">
                  {wizardSteps.map((s) => {
                    const isActive = participantWizardStep === s.step;
                    const isCompleted = participantWizardStep > s.step;
                    return (
                      <button
                        key={s.step}
                        type="button"
                        onClick={() => handleGoToStep(s.step)}
                        className={`flex flex-col items-center sm:items-start p-2 rounded-xl border text-left transition-all ${
                          isActive
                            ? isEditMode
                              ? 'bg-primary/5 border-primary/40 text-primary shadow-2xs'
                              : 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-2xs'
                            : isCompleted
                              ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                              : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200 hover:text-slate-600'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 w-full justify-center sm:justify-start">
                          <span className={`size-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 ${
                            isActive
                              ? isEditMode ? 'bg-primary text-white' : 'bg-emerald-600 text-white'
                              : isCompleted
                                ? 'bg-emerald-500 text-white'
                                : 'bg-slate-200 text-slate-500'
                          }`}>
                            {isCompleted ? '✓' : s.step}
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-tight truncate hidden sm:inline">
                            {s.shortTitle}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cuerpo compacto por paso */}
              <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">
                {/* Encabezado del paso activo */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="size-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[20px]">{activeStepMeta.icon}</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                        Paso {participantWizardStep}: {activeStepMeta.title}
                      </h4>
                      <p className="text-xs text-slate-500">{activeStepMeta.subtitle}</p>
                    </div>
                  </div>
                  {participantWizardStep === 3 && canAutofillFromProfile && (
                    <button
                      type="button"
                      onClick={() => applyProfilePersonalDataToForm(currentForm, isEditMode ? setEditForm : setNewStudentForm)}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[14px]">auto_fix_high</span>
                      Tomar datos de ficha
                    </button>
                  )}
                </div>

                {modalError && (
                  <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 flex flex-col gap-2">
                    <div className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-red-600 text-[18px] shrink-0 mt-0.5">warning</span>
                      <p className="text-xs font-bold text-red-800 leading-relaxed">{modalError}</p>
                    </div>
                    {duplicateExistingRecord && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingNew(false);
                            openEditRecordModal(duplicateExistingRecord);
                          }}
                          className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all"
                        >
                          <span className="material-symbols-outlined text-[15px]">edit</span>
                          Editar Registro Existente
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* PASO 1: IDENTIFICACIÓN Y PROCESO */}
                {participantWizardStep === 1 && (
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 animate-in fade-in duration-150">
                    <div className="sm:col-span-4">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">
                        Código / DNI *
                      </label>
                      <input
                        autoFocus
                        value={currentForm.CODPOSTULANTE || ''}
                        onChange={e => updateCurrentForm({ CODPOSTULANTE: e.target.value })}
                        placeholder="Ej. 74125896"
                        className="w-full h-11 px-3.5 rounded-xl border-2 border-slate-200 bg-slate-50/60 focus:bg-white outline-none font-mono font-bold text-sm focus:border-primary transition-all mt-1"
                      />
                    </div>

                    <div className="sm:col-span-8">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">
                        Apellidos y Nombres Completos *
                      </label>
                      <input
                        value={currentForm.NOMBRE || ''}
                        onChange={e => {
                          const val = e.target.value;
                          updateCurrentForm({ NOMBRE: val });
                          if (isEditMode && editingRecord) {
                            const changed = val.trim().toUpperCase() !== (editingRecord.NOMBRE || '').trim().toUpperCase();
                            setShowSyncNameOption(changed);
                            if (!changed) setSyncNameChecked(false);
                          }
                        }}
                        placeholder="APELLIDO PATERNO APELLIDO MATERNO NOMBRES"
                        className="w-full h-11 px-3.5 rounded-xl border-2 border-slate-200 bg-slate-50/60 focus:bg-white outline-none font-bold text-sm focus:border-primary transition-all mt-1 uppercase"
                      />
                    </div>

                    {isEditMode && showSyncNameOption && (
                      <div className="sm:col-span-12 bg-amber-50 border border-amber-200 p-3 rounded-xl">
                        <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-amber-900">
                          <input
                            type="checkbox"
                            checked={syncNameChecked}
                            onChange={e => setSyncNameChecked(e.target.checked)}
                            className="size-4 rounded border-amber-400 text-primary focus:ring-primary"
                          />
                          <span>Sincronizar este nombre corregido en sus demás ingresos con el mismo DNI</span>
                        </label>
                      </div>
                    )}

                    <div className="sm:col-span-12">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">
                        Modalidad Oficial {!isEditMode && '*'}
                      </label>
                      <input
                        list="official-modalidades-list"
                        value={currentForm.MODALIDAD || ''}
                        onChange={e => handleModalityChange(e.target.value)}
                        placeholder="Ej. CONCURSO DE ADMISIÓN ORDINARIO 2026-I"
                        className="w-full h-11 px-3.5 rounded-xl border-2 border-slate-200 bg-slate-50/60 focus:bg-white outline-none font-bold text-sm focus:border-primary transition-all mt-1 uppercase"
                      />
                      <p className="text-[10px] text-slate-400 mt-1 ml-1">
                        Escriba para filtrar del catálogo oficial del Cuadro de Vacantes.
                      </p>
                    </div>

                    <div className="sm:col-span-6">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">
                        Año de Proceso
                      </label>
                      <input
                        value={currentForm.ANIO || ''}
                        onChange={e => updateCurrentForm({ ANIO: e.target.value })}
                        placeholder="Ej. 2026"
                        className="w-full h-11 px-3.5 rounded-xl border-2 border-slate-200 bg-slate-50/60 focus:bg-white outline-none font-mono font-bold text-sm focus:border-primary transition-all mt-1"
                      />
                    </div>

                    <div className="sm:col-span-6">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">
                        Semestre de Ingreso
                      </label>
                      <input
                        list="official-semestres-list"
                        value={currentForm.SEMESTRE || ''}
                        onChange={e => updateCurrentForm({ SEMESTRE: e.target.value.toUpperCase() })}
                        placeholder="Ej. 2026-I"
                        className="w-full h-11 px-3.5 rounded-xl border-2 border-slate-200 bg-slate-50/60 focus:bg-white outline-none font-mono font-bold text-sm focus:border-primary transition-all mt-1 uppercase"
                      />
                    </div>
                  </div>
                )}

                {/* PASO 2: CARRERA, SEDE Y RESULTADOS */}
                {participantWizardStep === 2 && (
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 animate-in fade-in duration-150">
                    <div className="sm:col-span-9">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">
                        Escuela Profesional / Carrera {!isEditMode && '*'}
                      </label>
                      <input
                        autoFocus
                        list="official-carreras-list"
                        value={currentForm.CARRERA || ''}
                        onChange={e => handleCareerChange(e.target.value)}
                        placeholder="Ej. MEDICINA HUMANA"
                        className="w-full h-11 px-3.5 rounded-xl border-2 border-slate-200 bg-slate-50/60 focus:bg-white outline-none font-bold text-sm focus:border-primary transition-all mt-1 uppercase"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">
                        Código Carrera
                      </label>
                      <input
                        value={currentForm.codigo_carrera || ''}
                        onChange={e => handleCareerCodeChange(e.target.value)}
                        placeholder="Ej. 205"
                        className="w-full h-11 px-3.5 rounded-xl border-2 border-slate-200 bg-slate-50/60 focus:bg-white outline-none font-mono font-bold text-sm focus:border-primary transition-all mt-1"
                      />
                    </div>

                    <div className="sm:col-span-6">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">
                        Sede / Filial
                      </label>
                      <input
                        list="official-filiales-list"
                        value={currentForm.FILIAL || ''}
                        onChange={e => updateCurrentForm({ FILIAL: e.target.value.toUpperCase() })}
                        placeholder="CUSCO"
                        className="w-full h-11 px-3.5 rounded-xl border-2 border-slate-200 bg-slate-50/60 focus:bg-white outline-none font-bold text-sm focus:border-primary transition-all mt-1 uppercase"
                      />
                    </div>

                    <div className="sm:col-span-6">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">
                          Fecha de Ingreso
                        </label>
                        <button
                          type="button"
                          onClick={() => updateCurrentForm({ FECHAINGRESO: new Date().toISOString().slice(0, 10) })}
                          className="text-[10px] font-black text-primary hover:underline uppercase mr-1"
                        >
                          Usar Hoy
                        </button>
                      </div>
                      <input
                        value={currentForm.FECHAINGRESO || ''}
                        onChange={e => updateCurrentForm({ FECHAINGRESO: e.target.value })}
                        placeholder="AAAA-MM-DD o DD/MM/AAAA"
                        className="w-full h-11 px-3.5 rounded-xl border-2 border-slate-200 bg-slate-50/60 focus:bg-white outline-none font-mono font-bold text-sm focus:border-primary transition-all mt-1"
                      />
                    </div>

                    <div className="sm:col-span-6">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">
                        Puntaje / Nota Oficial
                      </label>
                      <input
                        value={currentForm.NOTA || ''}
                        onChange={e => updateCurrentForm({ NOTA: e.target.value })}
                        placeholder="Ej. 15.450"
                        className="w-full h-11 px-3.5 rounded-xl border-2 border-slate-200 bg-slate-50/60 focus:bg-white outline-none font-mono font-bold text-sm focus:border-primary transition-all mt-1"
                      />
                    </div>

                    <div className="sm:col-span-6">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">
                        Orden de Mérito (Puesto)
                      </label>
                      <input
                        value={currentForm.OMERITO || ''}
                        onChange={e => updateCurrentForm({ OMERITO: e.target.value })}
                        placeholder="Ej. 1"
                        className="w-full h-11 px-3.5 rounded-xl border-2 border-slate-200 bg-slate-50/60 focus:bg-white outline-none font-mono font-bold text-sm focus:border-primary transition-all mt-1"
                      />
                    </div>
                  </div>
                )}

                {/* PASO 3: CONTACTO Y DATOS PERSONALES */}
                {participantWizardStep === 3 && (
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 animate-in fade-in duration-150">
                    <div className="sm:col-span-5">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">
                        Teléfono / Celular
                      </label>
                      <input
                        autoFocus
                        value={currentForm.telefono || ''}
                        onChange={e => updateCurrentForm({ telefono: e.target.value })}
                        placeholder="Ej. 984123456"
                        className="w-full h-11 px-3.5 rounded-xl border-2 border-slate-200 bg-slate-50/60 focus:bg-white outline-none font-mono font-bold text-sm focus:border-primary transition-all mt-1"
                      />
                    </div>

                    <div className="sm:col-span-7">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">
                        Correo Electrónico
                      </label>
                      <input
                        type="email"
                        value={currentForm.email || ''}
                        onChange={e => updateCurrentForm({ email: e.target.value })}
                        placeholder="correo@ejemplo.com"
                        className="w-full h-11 px-3.5 rounded-xl border-2 border-slate-200 bg-slate-50/60 focus:bg-white outline-none font-bold text-sm focus:border-primary transition-all mt-1"
                      />
                    </div>

                    <div className="sm:col-span-4">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">
                        Fecha de Nacimiento
                      </label>
                      <input
                        value={currentForm.fecha_nacimiento || ''}
                        onChange={e => updateCurrentForm({ fecha_nacimiento: e.target.value })}
                        placeholder="AAAA-MM-DD"
                        className="w-full h-11 px-3.5 rounded-xl border-2 border-slate-200 bg-slate-50/60 focus:bg-white outline-none font-mono font-bold text-sm focus:border-primary transition-all mt-1"
                      />
                    </div>

                    <div className="sm:col-span-4">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">
                        Sexo / Género
                      </label>
                      <select
                        value={currentForm.sexo || ''}
                        onChange={e => updateCurrentForm({ sexo: e.target.value })}
                        className="w-full h-11 px-3.5 rounded-xl border-2 border-slate-200 bg-slate-50/60 focus:bg-white outline-none font-bold text-sm focus:border-primary transition-all mt-1"
                      >
                        <option value="">-- Seleccionar --</option>
                        <option value="Masculino">Masculino</option>
                        <option value="Femenino">Femenino</option>
                        <option value="No especificado">No especificado</option>
                        {currentForm.sexo && !['Masculino', 'Femenino', 'No especificado'].includes(currentForm.sexo) && (
                          <option value={currentForm.sexo}>{currentForm.sexo}</option>
                        )}
                      </select>
                    </div>

                    <div className="sm:col-span-4">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">
                        Discapacidad
                      </label>
                      <input
                        list="official-discapacidad-list"
                        value={currentForm.discapacidad || ''}
                        onChange={e => updateCurrentForm({ discapacidad: e.target.value })}
                        placeholder="Ninguna"
                        className="w-full h-11 px-3.5 rounded-xl border-2 border-slate-200 bg-slate-50/60 focus:bg-white outline-none font-bold text-sm focus:border-primary transition-all mt-1"
                      />
                    </div>

                    <div className="sm:col-span-8">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">
                        Dirección de Domicilio
                      </label>
                      <input
                        value={currentForm.direccion || ''}
                        onChange={e => updateCurrentForm({ direccion: e.target.value })}
                        placeholder="Ej. AV. LA CULTURA N° 733 - CUSCO"
                        className="w-full h-11 px-3.5 rounded-xl border-2 border-slate-200 bg-slate-50/60 focus:bg-white outline-none font-bold text-sm focus:border-primary transition-all mt-1 uppercase"
                      />
                    </div>

                    <div className="sm:col-span-4">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">
                        Ubigeo Domicilio
                      </label>
                      <input
                        value={currentForm.ubigeo || ''}
                        onChange={e => updateCurrentForm({ ubigeo: e.target.value })}
                        placeholder="Ej. 080101"
                        className="w-full h-11 px-3.5 rounded-xl border-2 border-slate-200 bg-slate-50/60 focus:bg-white outline-none font-mono font-bold text-sm focus:border-primary transition-all mt-1"
                      />
                    </div>
                  </div>
                )}

                {/* PASO 4: COLEGIO, CONTINGENCIA Y CONFIRMACIÓN */}
                {participantWizardStep === 4 && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                      <div className="sm:col-span-8">
                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">
                          Colegio / Código Modular
                        </label>
                        <input
                          autoFocus
                          value={currentForm.colegio || ''}
                          onChange={e => updateCurrentForm({ colegio: e.target.value })}
                          placeholder="Ej. 0236653 o NOMBRE DE LA I.E."
                          className="w-full h-11 px-3.5 rounded-xl border-2 border-slate-200 bg-slate-50/60 focus:bg-white outline-none font-bold text-sm focus:border-primary transition-all mt-1 uppercase"
                        />
                      </div>

                      <div className="sm:col-span-4">
                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">
                          Promedio Escolar
                        </label>
                        <input
                          value={currentForm.promedio_colegio || ''}
                          onChange={e => updateCurrentForm({ promedio_colegio: e.target.value })}
                          placeholder="Ej. 16.40"
                          className="w-full h-11 px-3.5 rounded-xl border-2 border-slate-200 bg-slate-50/60 focus:bg-white outline-none font-mono font-bold text-sm focus:border-primary transition-all mt-1"
                        />
                      </div>
                    </div>

                    {/* Contingencia opcional desplegable */}
                    <div className="border border-amber-200/90 bg-amber-50/40 rounded-2xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setShowContingencySection(prev => !prev)}
                        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-amber-50/80 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-amber-600 text-[18px]">gavel</span>
                          <div>
                            <h5 className="text-[11px] font-black text-amber-950 uppercase tracking-wider">
                              Contingencia de Examen Anulado (Opcional)
                            </h5>
                            <p className="text-[10px] text-amber-800/80">
                              Solo si el concurso tuvo un examen previo anulado por Consejo Universitario.
                            </p>
                          </div>
                        </div>
                        <span className="material-symbols-outlined text-amber-700 text-[18px]">
                          {showContingencySection ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>

                      {showContingencySection && (
                        <div className="px-4 pb-4 pt-2 border-t border-amber-200/60 grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="text-[10px] font-black text-amber-900 uppercase tracking-widest ml-1">
                              Nota Ex. Anulado
                            </label>
                            <input
                              value={currentForm.nota_examen_anulado || ''}
                              onChange={e => updateCurrentForm({ nota_examen_anulado: e.target.value })}
                              placeholder="Ej. 16.200"
                              className="w-full h-10 px-3 rounded-xl border-2 border-amber-200 bg-white outline-none font-mono font-bold text-xs focus:border-amber-500 transition-all mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-amber-900 uppercase tracking-widest ml-1">
                              Resolución CU
                            </label>
                            <input
                              value={currentForm.resolucion_anulacion || ''}
                              onChange={e => updateCurrentForm({ resolucion_anulacion: e.target.value })}
                              placeholder="Res. CU-224-2022"
                              className="w-full h-10 px-3 rounded-xl border-2 border-amber-200 bg-white outline-none font-bold text-xs focus:border-amber-500 transition-all mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-amber-900 uppercase tracking-widest ml-1">
                              Fecha Ex. Anulado
                            </label>
                            <input
                              value={currentForm.fecha_examen_anulado || ''}
                              onChange={e => updateCurrentForm({ fecha_examen_anulado: e.target.value })}
                              placeholder="AAAA-MM-DD"
                              className="w-full h-10 px-3 rounded-xl border-2 border-amber-200 bg-white outline-none font-mono font-bold text-xs focus:border-amber-500 transition-all mt-1"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Resumen compacto antes de guardar */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Resumen previo al guardado
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">DNI / Código</span>
                          <span className="font-mono font-black text-slate-800">{currentForm.CODPOSTULANTE || '—'}</span>
                        </div>
                        <div className="col-span-1 sm:col-span-2">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Estudiante</span>
                          <span className="font-black text-slate-800 uppercase truncate block">{currentForm.NOMBRE || '—'}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Carrera / Sede</span>
                          <span className="font-bold text-slate-700 uppercase truncate block">
                            {currentForm.CARRERA || '—'} ({currentForm.FILIAL || 'CUSCO'})
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Nota / Mérito</span>
                          <span className="font-mono font-bold text-emerald-700">
                            {currentForm.NOTA || '—'} / #{currentForm.OMERITO || '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer fijo con navegación Anterior / Siguiente / Guardar */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={closeParticipantModal}
                    className="px-4 py-2 font-bold text-xs uppercase tracking-wider text-slate-500 hover:bg-slate-200 rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <span className="text-[11px] font-bold text-slate-400 hidden sm:inline">
                    Paso {participantWizardStep} de 4
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  {participantWizardStep > 1 && (
                    <button
                      type="button"
                      onClick={handlePrevStep}
                      disabled={loading}
                      className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-1 transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                      Anterior
                    </button>
                  )}

                  {isEditMode && participantWizardStep < 4 && (
                    <button
                      type="button"
                      onClick={() => handleUpdateRecord(syncNameChecked)}
                      disabled={loading}
                      className="px-3.5 py-2.5 text-primary hover:bg-primary/10 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all disabled:opacity-50"
                      title="Guardar cambios directamente sin pasar por los demás pasos"
                    >
                      {loading ? 'Guardando...' : 'Guardar directo'}
                    </button>
                  )}

                  {participantWizardStep < 4 ? (
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className={`px-6 py-2.5 text-white rounded-xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all shadow-md flex items-center gap-1.5 ${
                        isEditMode ? 'bg-primary hover:bg-merlot shadow-primary/20' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                      }`}
                    >
                      Siguiente
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => (isEditMode ? handleUpdateRecord(syncNameChecked) : handleCreateStudent())}
                      disabled={loading}
                      className={`px-7 py-2.5 text-white rounded-xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all shadow-lg disabled:opacity-50 flex items-center gap-2 ${
                        isEditMode ? 'bg-primary shadow-primary/20 hover:bg-merlot' : 'bg-emerald-600 shadow-emerald-600/20 hover:bg-emerald-700'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[17px]">{isEditMode ? 'save' : 'how_to_reg'}</span>
                      {loading
                        ? 'Guardando...'
                        : isEditMode
                          ? 'Guardar Cambios'
                          : 'Guardar Ingresante'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Top Header Bar */}
      <div className="flex flex-wrap justify-between items-end gap-4 shrink-0">
        <div className="flex flex-col gap-1">
            <h1 className="text-slate-900 text-3xl font-black leading-tight">Consulta Integral de Postulantes e Ingresantes</h1>
            <p className="text-slate-500 text-sm font-medium">Búsqueda universal en bases de datos históricas, procesos recientes y servidor local de expedientes.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* File Gateway Server Status Button */}
            <button
                type="button"
                onClick={() => setIsGatewayModalOpen(true)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm active:scale-95 ${
                    gatewayStatus.connected
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                        : gatewayStatus.checking
                            ? 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                }`}
                title={`Servidor de Archivos: ${gatewayStatus.url} (${gatewayStatus.connected ? 'Conectado' : 'Sin conexión'}). Clic para configurar.`}
            >
                <span className={`size-2.5 rounded-full shrink-0 ${
                    gatewayStatus.connected 
                        ? 'bg-emerald-500 animate-pulse' 
                        : gatewayStatus.checking 
                            ? 'bg-slate-400 animate-spin' 
                            : 'bg-amber-500'
                }`} />
                <span className="material-symbols-outlined text-[16px]">dns</span>
                <span className="hidden sm:inline">
                    {gatewayStatus.connected
                        ? `File Gateway Conectado${gatewayStatus.latency !== undefined ? ` (${gatewayStatus.latency}ms)` : ''}`
                        : gatewayStatus.checking
                            ? 'Verificando Servidor...'
                            : 'Servidor File Gateway Offline'}
                </span>
                <span className="material-symbols-outlined text-[14px] text-slate-400">tune</span>
            </button>

            <div className="flex bg-slate-200 p-1 rounded-xl shadow-inner shrink-0">
                {[
                    {id: 'individual', label: 'Búsqueda Individual', icon: 'person_search'},
                    {id: 'batch', label: 'Cruce Masivo', icon: 'compare_arrows'},
                    {id: 'import', label: 'Importar Datos', icon: 'upload_file', adminOnly: true}
                ].filter(m => !m.adminOnly || user.role === 'Administrador' || (user.role === 'Operador' && user.permissions?.includes('upload_csv'))).map((m) => (
                    <button 
                        key={m.id}
                        onClick={() => setActiveMode(m.id as any)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeMode === m.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <span className="material-symbols-outlined text-[18px]">{m.icon}</span>
                        {m.label}
                    </button>
                ))}
            </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeMode === 'individual' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start h-full overflow-y-auto pr-1">
                
                {/* Left Search & Profile Overview */}
                <aside className="lg:col-span-4 flex flex-col gap-6 w-full">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-black flex items-center gap-2 text-slate-900 uppercase tracking-tight">
                                <span className="material-symbols-outlined text-primary">search</span>
                                Búsqueda Universal
                            </h3>
                            <button onClick={() => openAddParticipantModal(false)} className="flex items-center gap-1 text-xs font-bold text-primary hover:text-merlot transition-colors bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg">
                                <span className="material-symbols-outlined text-[16px]">person_add</span>
                                Nuevo
                            </button>
                        </div>
                        <div className="flex flex-col gap-3">
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-3 top-3 text-slate-400">badge</span>
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    className="w-full rounded-xl border border-slate-300 bg-slate-50 text-slate-900 h-11 pl-10 pr-14 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-slate-400 uppercase font-medium text-sm"
                                    placeholder="DNI O APELLIDOS Y NOMBRES..."
                                />
                                <button onClick={() => handleSearch()} disabled={loading} className="absolute right-1 top-1 h-9 w-9 bg-primary hover:bg-merlot text-white rounded-lg flex items-center justify-center transition-colors shadow-sm">
                                    {loading ? <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span> : <span className="material-symbols-outlined text-[18px]">search</span>}
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-400 font-medium">
                                Busca automáticamente en la tabla oficial de ingresantes (<code className="font-mono">participantes</code>) y en expedientes de postulantes (<code className="font-mono">pre_revision_archivos</code>).
                            </p>
                        </div>
                    </div>

                    {/* Error Banner */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3 animate-in fade-in">
                            <span className="material-symbols-outlined text-red-600 text-xl shrink-0">error</span>
                            <div className="text-xs text-red-800 font-medium">{error}</div>
                        </div>
                    )}

                    {/* Empty State when searched and 0 matches in both Ingresantes & Postulantes */}
                    {hasSearched && !loading && !error && !selectedProfile && candidatesList.length === 0 && (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col items-center text-center gap-2.5 animate-in fade-in slide-in-from-bottom-2">
                            <div className="size-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                                <span className="material-symbols-outlined text-2xl">person_off</span>
                            </div>
                            <div>
                                <h4 className="font-black text-slate-800 text-xs uppercase tracking-wider">
                                    Sin coincidencias para «{lastSearchedTerm}»
                                </h4>
                                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                    No registra ingreso oficial en <code className="font-mono text-slate-700">participantes</code> ni postulaciones en los lotes cargados de <code className="font-mono text-slate-700">pre_revision_archivos</code>.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setNewStudentForm({
                                        CODPOSTULANTE: /^\d+$/.test(lastSearchedTerm) ? lastSearchedTerm : '',
                                        NOMBRE: !/^\d+$/.test(lastSearchedTerm) ? lastSearchedTerm.toUpperCase() : '',
                                        ANIO: String(new Date().getFullYear()),
                                        SEMESTRE: '2026-I',
                                        FILIAL: 'CUSCO'
                                    });
                                    setParticipantWizardStep(1);
                                    setShowContingencySection(false);
                                    setModalError(null);
                                    setDuplicateExistingRecord(null);
                                    setIsAddingNew(true);
                                }}
                                className="mt-1 px-3.5 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                            >
                                <span className="material-symbols-outlined text-[15px]">person_add</span>
                                Registrar manualmente en Participantes
                            </button>
                        </div>
                    )}

                    {/* Candidate Results List (if multiple results found) */}
                    {candidatesList.length > 0 && !selectedProfile && (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                                <h4 className="font-black text-slate-700 text-xs uppercase tracking-wider">
                                    Postulantes Encontrados ({candidatesList.length})
                                </h4>
                            </div>
                            <div className="max-h-[450px] overflow-y-auto divide-y divide-slate-100">
                                {candidatesList.map((c, i) => (
                                    <button 
                                        key={i} 
                                        onClick={() => handleSelectCandidate(c)} 
                                        className="w-full text-left p-4 hover:bg-slate-50 transition-colors flex items-center gap-3 group"
                                    >
                                        <div className={`size-11 rounded-xl flex items-center justify-center shrink-0 ${
                                            c.isIngresanteOficial ? 'bg-emerald-100 text-emerald-700 font-bold' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                            <span className="material-symbols-outlined text-xl">
                                                {c.isIngresanteOficial ? 'verified' : 'school'}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className={`text-[8px] font-black uppercase px-1.5 py-0.2 rounded ${
                                                    c.isIngresanteOficial ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                                                }`}>
                                                    {c.isIngresanteOficial ? 'INGRESANTE' : 'SOLO POSTULANTE'}
                                                </span>
                                            </div>
                                            <p className="font-black text-slate-900 text-sm truncate uppercase group-hover:text-primary transition-colors mt-0.5">
                                                {c.fullName}
                                            </p>
                                            <p className="text-[10px] text-slate-500 font-mono truncate">
                                                DNI: {c.dni} {c.applications[0]?.modalidad ? `• ${c.applications[0].modalidad}` : ''}
                                            </p>
                                        </div>
                                        <span className="material-symbols-outlined text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all">chevron_right</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Selected Student / Applicant Profile Card */}
                    {selectedProfile && (
                        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">
                            
                            {/* Card Top Banner */}
                            <div className="h-24 bg-gradient-to-r from-slate-900 to-indigo-950 relative p-4 flex justify-between items-start">
                                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border shadow-sm ${
                                    selectedProfile.isIngresanteOficial 
                                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30' 
                                        : 'bg-blue-500/20 text-blue-300 border-blue-400/30'
                                }`}>
                                    {selectedProfile.isIngresanteOficial ? '🟢 INGRESANTE OFICIAL' : '⚪ SOLO POSTULANTE'}
                                </span>
                                
                                <button 
                                    onClick={() => { setSelectedProfile(null); setCandidatesList([]); setSearchQuery(''); }} 
                                    className="size-8 bg-white/20 text-white rounded-lg flex items-center justify-center hover:bg-white/40 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[18px]">close</span>
                                </button>
                            </div>

                            <div className="px-6 pb-6 relative">
                                
                                {/* Photo / Avatar */}
                                <div className="flex items-end justify-between -mt-10 mb-4">
                                    {candidatePhotoUrl ? (
                                        <div className="size-20 rounded-2xl border-4 border-white bg-slate-800 overflow-hidden shadow-md shrink-0">
                                            <img 
                                                src={candidatePhotoUrl} 
                                                alt={selectedProfile.fullName}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    (e.target as HTMLElement).style.display = 'none';
                                                }}
                                            />
                                        </div>
                                    ) : (
                                        <div className="size-20 rounded-2xl border-4 border-white bg-slate-100 text-slate-400 flex items-center justify-center shadow-md shrink-0">
                                            <span className="material-symbols-outlined text-4xl">person</span>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (selectedProfile.admissions.length > 0) {
                                                    openEditRecordModal(selectedProfile.admissions[0]);
                                                } else {
                                                    openAddParticipantModal(true);
                                                }
                                            }}
                                            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center justify-center transition-all active:scale-95"
                                            title={selectedProfile.admissions.length > 0 ? 'Editar registro en tabla participantes' : 'Agregar estudiante a tabla participantes'}
                                        >
                                            <span className="material-symbols-outlined text-[17px]">edit</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsFichaModalOpen(true)}
                                            className="px-3.5 py-2 bg-primary hover:bg-merlot text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-primary/20 transition-all active:scale-95"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">account_box</span>
                                            Ficha Integral
                                        </button>
                                    </div>
                                </div>

                                <h3 className="text-xl font-black text-slate-900 uppercase leading-tight truncate">
                                    {selectedProfile.fullName}
                                </h3>
                                
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-primary font-mono font-bold text-xs">
                                        DNI: {selectedProfile.dni}
                                    </span>
                                    <button 
                                        onClick={() => {
                                            navigator.clipboard.writeText(selectedProfile.dni);
                                            notifyUser(`DNI ${selectedProfile.dni} copiado al portapapeles`, 'success');
                                        }}
                                        className="text-slate-400 hover:text-slate-600 p-0.5"
                                        title="Copiar DNI"
                                    >
                                        <span className="material-symbols-outlined text-[14px]">content_copy</span>
                                    </button>
                                </div>

                                {/* Status Badges */}
                                <div className="flex flex-wrap gap-1.5 mt-3">
                                    {selectedProfile.isIngresanteOficial && (
                                        <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[9px] font-black uppercase">
                                            INGRESANTE OFICIAL
                                        </span>
                                    )}
                                    {selectedProfile.isSoloPostulante && (
                                        <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-[9px] font-black uppercase">
                                            SOLO POSTULANTE
                                        </span>
                                    )}
                                    {selectedProfile.hasRenuncia && (
                                        <span className="bg-red-50 text-red-800 border border-red-200 px-2 py-0.5 rounded text-[9px] font-black uppercase">
                                            RENUNCIA REGISTRADA
                                        </span>
                                    )}
                                    {selectedProfile.hasReserva && (
                                        <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded text-[9px] font-black uppercase">
                                            RESERVA DE VACANTE
                                        </span>
                                    )}
                                </div>

                                {/* Contact and School Preview */}
                                <div className="mt-5 pt-5 border-t border-slate-100 flex flex-col gap-4">
                                    
                                    {/* Contact Section */}
                                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Canales de Contacto</p>
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 text-xs">
                                                    <span className="material-symbols-outlined text-[16px] text-slate-500">call</span>
                                                    <span className="font-bold text-slate-700 font-mono">
                                                        {selectedProfile.phone || 'No registrado'}
                                                    </span>
                                                </div>
                                                {selectedProfile.phone && (
                                                    <a 
                                                        href={`https://wa.me/51${selectedProfile.phone.replace(/\D/g, '').slice(-9)}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-black uppercase flex items-center gap-1 transition-all"
                                                    >
                                                        <span className="material-symbols-outlined text-[12px]">chat</span>
                                                        WhatsApp
                                                    </a>
                                                )}
                                            </div>

                                            {selectedProfile.email && (
                                                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                                                    <div className="flex items-center gap-2 truncate">
                                                        <span className="material-symbols-outlined text-[16px] text-slate-500">mail</span>
                                                        <span className="text-slate-700 truncate font-medium">{selectedProfile.email}</span>
                                                    </div>
                                                    <a 
                                                        href={`mailto:${selectedProfile.email}`}
                                                        className="text-primary hover:underline font-bold text-[10px] uppercase shrink-0"
                                                    >
                                                        Enviar
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* School Section */}
                                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Procedencia Escolar (Colegio)</p>
                                        <div className="text-xs">
                                            <p className="font-bold text-slate-800 uppercase">
                                                {selectedProfile.schoolInfo?.nombre_ie || selectedProfile.schoolName || 'Colegio no especificado'}
                                            </p>
                                            {selectedProfile.schoolInfo?.tipo_gestion && (
                                                <span className="inline-block mt-1 bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-[9px] font-black uppercase">
                                                    {selectedProfile.schoolInfo.tipo_gestion}
                                                </span>
                                            )}
                                            {selectedProfile.schoolInfo?.distrito && (
                                                <p className="text-[10px] text-slate-500 mt-1">
                                                    {selectedProfile.schoolInfo.departamento} / {selectedProfile.schoolInfo.provincia} / {selectedProfile.schoolInfo.distrito}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Digital Documents & Photos from File Gateway */}
                                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                                        <div className="flex justify-between items-center mb-2.5">
                                            <div className="flex items-center gap-1.5">
                                                <span className="material-symbols-outlined text-primary text-[18px]">folder_special</span>
                                                <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">
                                                    Expedientes Gateway (Puerto 5000)
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => fetchProfileExtraInfo(selectedProfile)}
                                                disabled={loadingDocs}
                                                className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
                                                title="Recargar archivos"
                                            >
                                                <span className={`material-symbols-outlined text-[15px] ${loadingDocs ? 'animate-spin' : ''}`}>sync</span>
                                            </button>
                                        </div>

                                        {loadingDocs ? (
                                            <div className="flex items-center justify-center py-4 gap-2 text-slate-500 text-xs font-bold bg-white rounded-lg border border-slate-200">
                                                <span className="material-symbols-outlined text-[16px] text-primary animate-spin">sync</span>
                                                Consultando disco local...
                                            </div>
                                        ) : docsError ? (
                                            <div className="p-2.5 bg-amber-50 text-amber-900 rounded-lg border border-amber-200 text-[10px]">
                                                <p className="font-bold">File Gateway no accesible:</p>
                                                <p className="text-amber-800 mt-0.5">{docsError}</p>
                                            </div>
                                        ) : selectedProfile.documents.length > 0 ? (
                                            <div className="flex flex-col gap-2">
                                                {Object.entries(getGroupedDocuments(selectedProfile.documents)).map(([folderLabel, docsInFolder], gIdx) => {
                                                    const isExpanded = expandedFolders[folderLabel] !== false;
                                                    return (
                                                        <div key={gIdx} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                                                            <button
                                                                onClick={() => setExpandedFolders(prev => ({ ...prev, [folderLabel]: !isExpanded }))}
                                                                type="button"
                                                                className="w-full flex items-center justify-between p-2 bg-slate-100 hover:bg-slate-200 transition-colors"
                                                            >
                                                                <div className="flex items-center gap-1.5 text-left min-w-0">
                                                                    <span className="material-symbols-outlined text-amber-500 text-[16px] shrink-0">folder</span>
                                                                    <span className="text-[10px] font-black text-slate-800 uppercase truncate">
                                                                        {folderLabel}
                                                                    </span>
                                                                    <span className="bg-slate-200 text-slate-700 text-[8px] font-black px-1 rounded-full">
                                                                        {docsInFolder.length}
                                                                    </span>
                                                                </div>
                                                                <span className="material-symbols-outlined text-slate-500 text-[14px]">
                                                                    {isExpanded ? 'expand_less' : 'expand_more'}
                                                                </span>
                                                            </button>

                                                            {isExpanded && (
                                                                <div className="p-1.5 flex flex-col gap-1.5 bg-slate-50/50">
                                                                    {docsInFolder.map((doc, docIdx) => (
                                                                        <div key={docIdx} className="p-1.5 bg-white rounded border border-slate-200 flex items-center justify-between gap-2 text-xs">
                                                                            <div className="flex items-center gap-1.5 min-w-0">
                                                                                <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">
                                                                                    {doc.icon || (doc.isPdf ? 'picture_as_pdf' : doc.isImage ? 'image' : 'description')}
                                                                                </span>
                                                                                <span className="text-[10px] font-bold text-slate-800 truncate">
                                                                                    {doc.friendlyName}
                                                                                </span>
                                                                            </div>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setSelectedDocForViewer(doc)}
                                                                                className="px-2 py-0.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded text-[9px] font-black uppercase transition-all shrink-0"
                                                                            >
                                                                                Ver
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="p-3 text-center bg-white rounded-lg border border-slate-200">
                                                <p className="text-[10px] font-bold text-slate-400">Sin archivos digitales en el disco local.</p>
                                            </div>
                                        )}
                                    </div>

                                </div>
                            </div>
                        </div>
                    )}
                </aside>

                {/* Right Academic Trajectory & History */}
                <section className={`lg:col-span-8 h-full transition-all duration-500 ${!selectedProfile && !(hasSearched && !loading && candidatesList.length === 0) ? 'opacity-30 grayscale' : 'opacity-100'}`}>
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm h-full p-6 md:p-8 flex flex-col overflow-hidden">
                        {!selectedProfile ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
                                <span className="material-symbols-outlined text-6xl text-slate-200 mb-4">
                                    {loading ? 'manage_search' : hasSearched && candidatesList.length === 0 ? 'search_off' : 'history_edu'}
                                </span>
                                <h3 className="text-slate-500 font-black uppercase tracking-widest text-sm">
                                    {loading
                                        ? 'Consultando Padrón Oficial y Lotes de Postulantes...'
                                        : hasSearched && candidatesList.length === 0
                                            ? `No se encontraron ingresos ni postulaciones para «${lastSearchedTerm}»`
                                            : 'Historial Académico y Procesos de Admisión'}
                                </h3>
                                <p className="text-slate-400 text-xs mt-1 max-w-md">
                                    {loading
                                        ? 'Verificando en paralelo la tabla oficial de ingresantes (participantes), los lotes de postulación (pre_revision_archivos) y procesos reprogramados.'
                                        : hasSearched && candidatesList.length === 0
                                            ? 'Verifique que el DNI o los apellidos estén bien escritos. Si pertenece a un proceso antiguo aún no cargado en Pre-Revisión, no figurará como postulante.'
                                            : 'Ingrese un DNI o nombres para consultar la trayectoria completa del postulante o ingresante.'}
                                </p>
                            </div>
                        ) : (
                            <div className="w-full text-left flex flex-col h-full">
                                <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-100 shrink-0">
                                    <div>
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                                            Trayectoria de Admisiones y Postulaciones UNSAAC
                                        </h4>
                                        <p className="text-xs font-bold text-slate-700 mt-0.5">
                                            {selectedProfile.admissions.length} Ingresos Oficiales • {selectedProfile.applications.length} Postulaciones Registradas
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => openAddParticipantModal(true)}
                                            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-2xs transition-all"
                                            title="Agregar nuevo registro de ingreso oficial en la tabla participantes"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">person_add</span>
                                            Agregar Ingreso
                                        </button>
                                        <button
                                            onClick={() => setIsFichaModalOpen(true)}
                                            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">visibility</span>
                                            Ver Ficha Completa
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto pr-3 space-y-6 relative">
                                    <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-100 hidden md:block"></div>
                                    
                                    {/* Alert for Renuncias or Reservas */}
                                    {selectedProfile.renuncias.length > 0 && (
                                        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
                                            <span className="material-symbols-outlined text-red-600 text-2xl shrink-0">cancel</span>
                                            <div>
                                                <p className="text-xs font-black uppercase text-red-900">
                                                    Renuncia de Vacante Registrada ({selectedProfile.renuncias.length})
                                                </p>
                                                {selectedProfile.renuncias.map((ren, rIdx) => (
                                                    <p key={rIdx} className="text-xs text-red-700 mt-0.5">
                                                        • Escuela: <strong>{ren.school}</strong> • Semestre: <strong>{ren.semester}</strong> • Resolución: <strong>{ren.resolution_number}</strong> ({ren.resolution_date || 'Sin fecha'})
                                                    </p>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {selectedProfile.reservas.length > 0 && (
                                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                                            <span className="material-symbols-outlined text-amber-600 text-2xl shrink-0">bookmark</span>
                                            <div>
                                                <p className="text-xs font-black uppercase text-amber-900">
                                                    Reserva de Vacante ({selectedProfile.reservas.length})
                                                </p>
                                                {selectedProfile.reservas.map((res, rIdx) => (
                                                    <p key={rIdx} className="text-xs text-amber-700 mt-0.5">
                                                        • Carrera: <strong>{res.carrera}</strong> • Semestre Retorno: <strong>{res.starting_semester}</strong> {res.is_withdrawn ? '(Retiro Definitivo Registrado)' : ''}
                                                    </p>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {timelineEvents.map((item, idx) => {
                                        if (item.tipo === 'INGRESO') {
                                            return (
                                                <div key={item.id} className="flex gap-4 md:gap-6 relative group items-start">
                                                    <div className="size-10 rounded-full flex items-center justify-center shrink-0 z-10 bg-emerald-600 text-white shadow-md shadow-emerald-200">
                                                        <span className="material-symbols-outlined text-xl">verified</span>
                                                    </div>
                                                    
                                                    {/* Card Ingreso Oficial - Alineado a la izquierda con borde verde */}
                                                    <div className="flex-1 bg-emerald-50/40 rounded-2xl p-5 border-2 border-emerald-500/80 hover:border-emerald-600 transition-all shadow-sm">
                                                        <div className="flex justify-between items-start gap-3">
                                                            <div>
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                                                                        🎓 INGRESO OFICIAL
                                                                    </span>
                                                                    {!item.rawAdm && (
                                                                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                                                            Pendiente en Participantes
                                                                        </span>
                                                                    )}
                                                                    {item.carpetaDocs && (
                                                                        <span className="text-[9px] font-bold bg-white text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                                                                            <span className="material-symbols-outlined text-[13px] text-amber-500">folder</span>
                                                                            {item.carpetaDocs} {item.documentosCount ? `(${item.documentosCount} docs)` : ''}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <h4 className="font-black text-lg uppercase text-slate-900 mt-1.5 leading-snug">
                                                                    {item.carrera}
                                                                </h4>
                                                                <p className="text-[11px] font-bold text-emerald-950/70 uppercase tracking-wide mt-0.5">
                                                                    ADMISIÓN: {item.semestre?.includes('20') ? item.semestre : (item.anio ? `${item.anio}-${item.semestre}` : item.semestre)} • MODALIDAD: {item.modalidad} {item.sede ? `• SEDE: ${item.sede}` : '• SEDE: CUSCO'}
                                                                </p>
                                                            </div>
                                                            {item.rawAdm ? (
                                                                <button 
                                                                    onClick={() => openEditRecordModal(item.rawAdm!)}
                                                                    className="p-2 text-emerald-700 hover:text-emerald-900 transition-colors rounded-lg hover:bg-emerald-100/60 shrink-0"
                                                                    title="Editar registro completo en tabla participantes"
                                                                >
                                                                    <span className="material-symbols-outlined text-[18px]">edit</span>
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => openAddParticipantModal(true, item)}
                                                                    className="px-2.5 py-1.5 text-emerald-800 bg-emerald-100/80 hover:bg-emerald-200/80 transition-colors rounded-lg shrink-0 flex items-center gap-1 text-[10px] font-black uppercase"
                                                                    title="Registrar en tabla oficial participantes"
                                                                >
                                                                    <span className="material-symbols-outlined text-[15px]">person_add</span>
                                                                    Registrar
                                                                </button>
                                                            )}
                                                        </div>

                                                        <div className="mt-3.5 flex flex-wrap gap-2 text-xs">
                                                            {item.puntaje && (
                                                                <span className="bg-white text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg text-[10px] font-black shadow-2xs">
                                                                    Puntaje: {item.puntaje}
                                                                </span>
                                                            )}
                                                            {item.puesto && (
                                                                <span className="bg-white text-slate-700 border border-slate-200 px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-2xs">
                                                                    Puesto: #{item.puesto}
                                                                </span>
                                                            )}
                                                            {item.rawAdm?.codigo_carrera && (
                                                                <span className="bg-white text-slate-700 border border-slate-200 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold shadow-2xs">
                                                                    Cód. Carrera: {item.rawAdm.codigo_carrera}
                                                                </span>
                                                            )}
                                                            {item.grupo && (
                                                                <span className="bg-white text-slate-700 border border-slate-200 px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-2xs">
                                                                    Grupo: {item.grupo}
                                                                </span>
                                                            )}
                                                            {item.fecha && (
                                                                <span className="bg-white text-slate-700 border border-slate-200 px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-2xs">
                                                                    Fecha: {item.fecha}
                                                                </span>
                                                            )}
                                                            {item.rawAdm?.nota_examen_anulado && (
                                                                <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-2xs">
                                                                    Nota Ex. Anulado: {item.rawAdm.nota_examen_anulado}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        if (item.tipo === 'POSTULACION') {
                                            return (
                                                <div key={item.id} className="flex gap-4 md:gap-6 relative group items-start">
                                                    <div className="size-10 rounded-full flex items-center justify-center shrink-0 z-10 bg-slate-200 text-slate-600">
                                                        <span className="material-symbols-outlined text-xl">history_edu</span>
                                                    </div>
                                                    
                                                    {/* Card Postulación sin Ingreso - Alineado a la derecha con borde punteado/gris */}
                                                    <div className="flex-1 bg-slate-50/70 rounded-2xl p-5 border-2 border-dashed border-slate-300 hover:border-slate-400 transition-all md:ml-6">
                                                        <div className="flex justify-between items-start gap-3">
                                                            <div>
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 border border-slate-300 inline-flex items-center gap-1">
                                                                        👥 POSTULACIÓN (Sin Ingreso)
                                                                    </span>
                                                                    {item.carpetaDocs && (
                                                                        <span className="text-[9px] font-bold bg-white text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                                                                            <span className="material-symbols-outlined text-[13px] text-amber-500">folder</span>
                                                                            {item.carpetaDocs} {item.documentosCount ? `(${item.documentosCount} docs)` : ''}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <h4 className="font-bold text-base uppercase text-slate-700 mt-1.5 leading-snug">
                                                                    {item.carrera}
                                                                </h4>
                                                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mt-0.5">
                                                                    ADMISIÓN: {item.semestre?.includes('20') ? item.semestre : (item.anio ? `${item.anio}-${item.semestre}` : item.semestre)} • MODALIDAD: {item.modalidad} • SEDE: {item.sede || 'CUSCO'}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="mt-3.5 flex flex-wrap gap-2 text-xs">
                                                            {item.puntaje && (
                                                                <span className="bg-white text-slate-800 border border-slate-200 px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-2xs">
                                                                    Puntaje: {item.puntaje}
                                                                </span>
                                                            )}
                                                            {item.puesto && (
                                                                <span className="bg-white text-slate-800 border border-slate-200 px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-2xs">
                                                                    Puesto: #{item.puesto}
                                                                </span>
                                                            )}
                                                            {item.grupo && (
                                                                <span className="bg-white text-slate-800 border border-slate-200 px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-2xs">
                                                                    Grupo: {item.grupo}
                                                                </span>
                                                            )}
                                                            {item.condicion && (
                                                                <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-1 rounded-lg text-[10px] font-medium">
                                                                    {item.condicion}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return null;
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        ) : activeMode === 'batch' ? (
            /* Batch Search Mode */
            <div className="h-full flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 overflow-hidden">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm shrink-0">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="size-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shrink-0 border border-amber-100 shadow-sm">
                                <span className="material-symbols-outlined text-3xl">view_timeline</span>
                            </div>
                            <div>
                                <h3 className="font-black text-slate-800 uppercase text-sm tracking-tight">Verificación Multi-Ingreso (Cruce Masivo)</h3>
                                <p className="text-xs text-slate-500 font-medium">Contraste listas con la base de datos oficial. Formato CSV o Excel (.xlsx, .csv): Columna 1 = DNI/Código, Columna 2 = Nombres.</p>
                            </div>
                        </div>
                        <input type="file" accept=".csv,.xlsx,.xls" ref={fileInputRef} className="hidden" onChange={handleFileUpload}/>
                        <div className="flex flex-wrap gap-2 justify-end">
                             {batchResults.length > 0 && (
                                 <>
                                     <button onClick={handleExportCruceExcel} className="px-5 h-12 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-black uppercase hover:bg-emerald-100 transition-colors flex items-center gap-2 shadow-sm">
                                         <span className="material-symbols-outlined text-sm">table_view</span> Excel
                                     </button>
                                     <button onClick={handleExportCrucePdf} className="px-5 h-12 bg-red-50 text-red-700 rounded-xl text-xs font-black uppercase hover:bg-red-100 transition-colors flex items-center gap-2 shadow-sm">
                                         <span className="material-symbols-outlined text-sm">picture_as_pdf</span> PDF
                                     </button>
                                     <button onClick={() => setBatchResults([])} className="px-5 h-12 rounded-xl text-xs font-black uppercase text-slate-400 hover:bg-slate-100 transition-colors">Limpiar</button>
                                 </>
                             )}
                             <button onClick={() => fileInputRef.current?.click()} disabled={isProcessingBatch} className="px-8 h-12 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-900/20 active:scale-95 transition-all flex items-center gap-2">
                                 {isProcessingBatch ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : <span className="material-symbols-outlined">upload_file</span>}
                                 {isProcessingBatch ? 'BUSCANDO...' : 'PROCESAR ARCHIVO'}
                             </button>
                        </div>
                    </div>
                </div>
                
                <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    {isProcessingBatch && (
                         <div className="p-4 border-b border-slate-100 bg-blue-50/50">
                             <div className="flex justify-between items-center mb-2">
                                 <p className="text-xs font-bold text-blue-800">{batchStatusText}</p>
                                 <p className="text-xs font-black text-blue-900">{batchProgress}%</p>
                             </div>
                             <div className="w-full bg-blue-100 h-2 rounded-full overflow-hidden">
                                 <div className="bg-blue-600 h-full transition-all duration-300 ease-out" style={{ width: `${batchProgress}%` }}></div>
                             </div>
                         </div>
                    )}
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10 shadow-sm">
                                <tr>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-36">Código / DNI</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre Buscado</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-32 text-center">Estatus</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Carrera / Semestre</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {batchResults.length === 0 ? (
                                    <tr><td colSpan={4} className="py-20 text-center text-slate-400 italic font-bold">Sin datos procesados. Cargue un archivo CSV o Excel.</td></tr>
                                ) : (
                                    batchResults.map((res, i) => (
                                        <tr key={i} className={`hover:bg-slate-50 transition-colors ${!res.found ? 'bg-red-50/20' : ''}`}>
                                            <td className="px-6 py-4 font-mono text-xs font-bold text-slate-700">{res.originalCode}</td>
                                            <td className="px-6 py-4 font-black text-slate-800 text-xs uppercase">{res.originalName}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-black uppercase border ${
                                                    res.status === 'EXACT' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                                                    (res.status === 'PROBABLE' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                                                    'bg-red-50 text-red-700 border-red-200')
                                                }`}>
                                                    {res.status === 'EXACT' ? 'CONFIRMADO' : (res.status === 'PROBABLE' ? 'PROBABLE' : 'NO REGISTRADO')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {res.found ? (
                                                    <div className="flex flex-col">
                                                        <p className="font-bold text-xs uppercase text-slate-900">{fixEncoding(res.allMatches[0].CARRERA)}</p>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase">{res.allMatches[0].SEMESTRE}-{res.allMatches[0].ANIO}</p>
                                                    </div>
                                                ) : '--'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        ) : (
            /* Data Import Mode */
            <div className="h-full flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 overflow-hidden">
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm shrink-0 flex flex-col items-center text-center gap-6">
                    <div className="size-20 bg-primary/10 text-primary rounded-full flex items-center justify-center border border-primary/20">
                        <span className="material-symbols-outlined text-4xl">upload_file</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 uppercase">Cargar Nuevos Ingresantes</h2>
                        <p className="text-slate-500 text-sm max-w-lg mt-1">Suba un archivo CSV con el formato: <br/><code className="bg-slate-100 px-2 rounded font-bold">CÓDIGO, NOMBRE, CARRERA, FILIAL, MODALIDAD, SEMESTRE, AÑO, NOTA, OMÉRITO, FECHA_INGRESO</code></p>
                    </div>
                    <input type="file" accept=".csv" ref={importFileInputRef} className="hidden" onChange={handleImportFile}/>
                    <div className="flex gap-4">
                        <button onClick={() => importFileInputRef.current?.click()} className="px-10 h-14 bg-white border-2 border-slate-900 text-slate-900 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95">Seleccionar Archivo</button>
                        {importData.length > 0 && (
                            <button onClick={processImport} disabled={isImporting} className="px-10 h-14 bg-primary text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/30 hover:bg-merlot transition-all active:scale-95 flex items-center gap-2">
                                {isImporting ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : <span className="material-symbols-outlined">save</span>}
                                {isImporting ? 'PROCESANDO...' : `GUARDAR ${importData.length} REGISTROS`}
                            </button>
                        )}
                    </div>
                    {isImporting && (
                        <div className="w-full max-w-md">
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-primary transition-all duration-300" style={{width: `${importProgress}%`}}></div>
                            </div>
                            <p className="text-[10px] font-black text-slate-400 mt-2 uppercase tracking-widest">Progreso de Carga: {importProgress}%</p>
                        </div>
                    )}
                </div>

                <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vista Previa de Importación</h4>
                        {importData.length > 0 && <button onClick={() => setImportData([])} className="text-[10px] font-black text-red-600 uppercase hover:underline">Cancelar Carga</button>}
                    </div>
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-white border-b border-slate-200 z-10 shadow-sm">
                                <tr>
                                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Código</th>
                                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Ingresante</th>
                                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">E. Profesional</th>
                                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Modalidad</th>
                                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Proceso</th>
                                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right pr-6">Ptje/OM</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {importData.length === 0 ? (
                                    <tr><td colSpan={6} className="py-20 text-center text-slate-300 italic text-sm">Cargue un archivo para previsualizar.</td></tr>
                                ) : (
                                    importData.slice(0, 50).map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50">
                                            <td className="px-6 py-3 font-mono text-[10px] font-bold text-slate-700">{row.CODPOSTULANTE}</td>
                                            <td className="px-6 py-3 font-black text-slate-800 text-xs uppercase">{row.NOMBRE}</td>
                                            <td className="px-6 py-3 text-xs uppercase text-slate-500 font-medium">{row.CARRERA}</td>
                                            <td className="px-6 py-3 text-[10px] uppercase font-bold text-slate-400">{row.MODALIDAD}</td>
                                            <td className="px-6 py-3 text-[10px] font-black text-slate-600">{row.SEMESTRE}-{row.ANIO}</td>
                                            <td className="px-6 py-3 text-right pr-6 font-bold text-xs text-primary">{row.NOTA} / {row.OMERITO}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* Comprehensive Ficha Integral Modal */}
      {isFichaModalOpen && selectedProfile && (
        <IntegratedStudentModal
          data={selectedProfile}
          gatewayUrl={gatewayUrl}
          onClose={() => setIsFichaModalOpen(false)}
        />
      )}

      {/* File Gateway Settings Modal */}
      <FileGatewayModal
        isOpen={isGatewayModalOpen}
        onClose={() => setIsGatewayModalOpen(false)}
        onGatewayUpdated={(newUrl) => {
          setGatewayUrl(newUrl);
          checkGateway(newUrl);
          if (selectedProfile) {
            fetchProfileExtraInfo(selectedProfile);
          }
        }}
      />

      {/* Document In-App Viewer Modal */}
      {selectedDocForViewer && (
        <DocumentViewerModal
          document={selectedDocForViewer}
          streamUrl={getDocumentStreamUrl(selectedDocForViewer.path, gatewayUrl)}
          onClose={() => setSelectedDocForViewer(null)}
        />
      )}
    </div>
  );
};
