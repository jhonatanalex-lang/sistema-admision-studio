import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  Simulacro, 
  SimulacroPostulante, 
  SimulacroResultadoItem, 
  SimulacroComisionMiembro, 
  SimulacroCalificacionConfig 
} from '../types';
import { 
  generarPDFPorEscuela, 
  generarPDFFilial, 
  generarPDFConsolidadoGeneral,
  EscuelaReporteData 
} from '../lib/simulacroPdfGenerator';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

interface SimulacroCalificacionModalProps {
  simulacro: Simulacro;
  isOpen: boolean;
  onClose: () => void;
  notify?: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

interface PostulanteNoRegistrado {
  dni: string;
  nombres_apellidos: string;
  sede: string;
  carrera: string;
  grupo: string;
  nota: any;
}

const getStorageKey = (simId: string) => `unsaac_simulacro_calificaciones_${simId}`;

/**
 * Deduce automáticamente el Área (A, B, C, D) de la carrera basado en el padrón y catálogo UNSAAC.
 */
const deducirAreaDeCarrera = (carreraStr: string, padronList: SimulacroPostulante[]): string => {
  if (!carreraStr) return 'A';
  const norm = carreraStr.trim().toUpperCase();
  
  // 1. Buscar coincidencia en el padrón cargado
  const found = padronList.find(p => p.carrera && (
    p.carrera.trim().toUpperCase() === norm ||
    norm.includes(p.carrera.trim().toUpperCase()) ||
    p.carrera.trim().toUpperCase().includes(norm)
  ));
  if (found && found.grupo) return found.grupo.trim().toUpperCase();

  // 2. Mapeo estándar institucional UNSAAC
  if (norm.includes('INGENIER') || norm.includes('ARQUITECTURA') || norm.includes('FISICA') || norm.includes('MATEMATICA') || norm.includes('QUIMICA') || norm.includes('METALURGIA') || norm.includes('MINAS')) {
    return 'A';
  }
  if (norm.includes('MEDICINA') || norm.includes('FARMACIA') || norm.includes('ENFERMERIA') || norm.includes('ODONTOLOG') || norm.includes('BIOLOG') || norm.includes('AGRONOM') || norm.includes('ZOOTECNIA') || norm.includes('OBSTETRICIA')) {
    return 'B';
  }
  if (norm.includes('ECONOM') || norm.includes('ADMINISTRA') || norm.includes('CONTAB') || norm.includes('TURISMO')) {
    return 'C';
  }
  if (norm.includes('DERECHO') || norm.includes('PSICOLOG') || norm.includes('EDUCAC') || norm.includes('HISTORIA') || norm.includes('ANTROPOLOG') || norm.includes('ARQUEOLOG') || norm.includes('FILOSOF') || norm.includes('COMUNICAC')) {
    return 'D';
  }
  return 'A';
};

/**
 * Normaliza y extrae el código del área académica (A, B, C, D) limpiando prefijos como "Área ", "Grupo ", etc.
 */
const normalizarArea = (rawArea: string): string => {
  if (!rawArea) return '';
  const trimmed = rawArea.trim().toUpperCase();
  const match = trimmed.match(/\b([ABCD])\b/) || trimmed.match(/([ABCD])/);
  if (match) {
    return match[1];
  }
  return trimmed;
};

export const SimulacroCalificacionModal: React.FC<SimulacroCalificacionModalProps> = ({
  simulacro,
  isOpen,
  onClose,
  notify
}) => {
  // Tabs activos: 'upload' | 'ajustes' | 'resultados' | 'reportes'
  const [activeTab, setActiveTab] = useState<'upload' | 'ajustes' | 'resultados' | 'reportes'>('upload');

  // Padrón oficial cargado desde simulacro_postulantes
  const [padron, setPadron] = useState<SimulacroPostulante[]>([]);
  const [loadingPadron, setLoadingPadron] = useState(false);

  // Archivo cargado
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [rawUploadedRows, setRawUploadedRows] = useState<any[]>([]);
  const [expectedSede, setExpectedSede] = useState<string>('AUTO');

  // Control de Postulantes NO registrados detectados en el archivo
  const [unregisteredPostulantes, setUnregisteredPostulantes] = useState<PostulanteNoRegistrado[]>([]);
  const [showUnregisteredModal, setShowUnregisteredModal] = useState<boolean>(false);
  const [isRegisteringPending, setIsRegisteringPending] = useState<boolean>(false);

  // Configuración de Calificación
  const [config, setConfig] = useState<SimulacroCalificacionConfig>({
    simulacro_id: simulacro.id,
    proceso_nombre: simulacro.nombre,
    dependencia: 'DIRECCIÓN DE ADMISIÓN',
    bono_general: 0,
    bono_areas: { A: 0, B: 0, C: 0, D: 0 },
    tratar_cero_como_nsp: true,
    bono_umbral_activo: false,
    bono_umbral_corte: 4,
    bono_umbral_puntos: 0,
    comision: [
      { nombre: 'Dr. Presidente de Comisión de Admisión', cargo: 'Presidente' },
      { nombre: 'Dr. Secretario de Comisión de Admisión', cargo: 'Secretario' },
      { nombre: 'Dr. Miembro de Comisión de Admisión', cargo: 'Vocal' }
    ],
    fecha_calificacion: new Date().toISOString()
  });

  // Resultados procesados y consolidados
  const [resultados, setResultados] = useState<SimulacroResultadoItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [savingState, setSavingState] = useState(false);

  // Filtros de visualización
  const [filterSede, setFilterSede] = useState<string>('TODOS');
  const [filterArea, setFilterArea] = useState<string>('TODOS');
  const [filterEscuela, setFilterEscuela] = useState<string>('TODOS');
  const [filterCondicion, setFilterCondicion] = useState<'TODOS' | 'EVALUADOS' | 'NSP' | 'INGRESANTES'>('TODOS');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Generación de PDFs
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // 1. Cargar padrón oficial y caché previo al abrir
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchPadronAndCache = async () => {
      setLoadingPadron(true);
      try {
        // Cargar postulantes de la BD
        const { data, error } = await supabase
          .from('simulacro_postulantes')
          .select('*')
          .eq('simulacro_id', simulacro.id);

        if (!error && data && data.length > 0 && isMounted) {
          const normalized = data.map((p: any) => ({
            ...p,
            nombres_apellidos: p.nombres_apellidos || [p.apellidos, p.nombres].filter(Boolean).join(' ') || 'SIN NOMBRE'
          }));
          setPadron(normalized);
        } else {
          // Intentar fallback localStorage
          const localPadron = localStorage.getItem(`kiosk_padron_${simulacro.id}`);
          if (localPadron && isMounted) {
            setPadron(JSON.parse(localPadron));
          }
        }
      } catch (err) {
        console.error('Error cargando padrón para calificación:', err);
      } finally {
        if (isMounted) setLoadingPadron(false);
      }

      // 0. Cargar primero desde la base de datos formal de Supabase (tablas simulacro_calificaciones y simulacro_resultados)
      let cargadoPreviamente = false;
      try {
        const { data: dbCalif, error: errCalif } = await supabase
          .from('simulacro_calificaciones')
          .select('*')
          .eq('simulacro_id', simulacro.id)
          .maybeSingle();

        if (dbCalif && isMounted) {
          if (dbCalif.configuracion) setConfig(dbCalif.configuracion);
          if (dbCalif.archivo_nombre) setUploadedFileName(dbCalif.archivo_nombre);

          // Obtener los resultados detallados fila por fila
          const { data: dbResultados, error: errRes } = await supabase
            .from('simulacro_resultados')
            .select('*')
            .eq('simulacro_id', simulacro.id)
            .order('merito_general', { ascending: true, nullsFirst: false });

          if (Array.isArray(dbResultados) && dbResultados.length > 0 && isMounted) {
            const mappedResultados: SimulacroResultadoItem[] = dbResultados.map((r: any, idx: number) => ({
              num: r.merito_general || (idx + 1),
              dni: r.dni,
              nombres: r.nombres,
              sede: r.sede || 'SEDE CENTRAL',
              area: r.area || 'A',
              carrera: r.carrera || 'SIN CARRERA',
              aula: r.aula || '',
              carpeta: r.carpeta || '',
              notaBase: r.is_nsp || r.nota_base === null ? 'NSP' : Number(r.nota_base),
              bono: Number(r.bono || 0),
              notaFinal: r.is_nsp || r.nota_final === null ? 'NSP' : Number(r.nota_final),
              isNsp: Boolean(r.is_nsp),
              observacion: r.observacion || '',
              vacanteAsignada: Boolean(r.vacante_asignada),
              merito_carrera: r.merito_carrera || undefined,
              merito_area: r.merito_area || undefined
            }));

            setResultados(mappedResultados);
            setActiveTab('resultados');
            cargadoPreviamente = true;
          }
        }
      } catch (errDb) {
        console.warn('Error recuperando calificaciones de Supabase DB:', errDb);
      }

      // 1. Si no estaba en Supabase DB, buscar en caché local
      if (!cargadoPreviamente) {
        try {
          const cached = localStorage.getItem(getStorageKey(simulacro.id));
          if (cached && isMounted) {
            const parsed = JSON.parse(cached);
            if (parsed.configuracion) setConfig(parsed.configuracion);
            if (Array.isArray(parsed.resultados) && parsed.resultados.length > 0) {
              setResultados(parsed.resultados);
              setUploadedFileName(parsed.archivo_nombre || 'Archivo guardado previamente');
              setActiveTab('resultados');
              cargadoPreviamente = true;
            }
          }
        } catch (e) {}
      }

      // 2. Si no estaba en localStorage, recuperar desde el backend local (puerto 5000)
      if (!cargadoPreviamente) {
        try {
          const res = await fetch(`/api/simulacros/${simulacro.id}/calificaciones`);
          if (res.ok) {
            const json = await res.json();
            if (json.success && json.data && isMounted) {
              if (json.data.configuracion) setConfig(json.data.configuracion);
              if (Array.isArray(json.data.resultados) && json.data.resultados.length > 0) {
                setResultados(json.data.resultados);
                setUploadedFileName(json.data.archivo_nombre || 'Archivo recuperado del servidor local');
                setActiveTab('resultados');
                localStorage.setItem(getStorageKey(simulacro.id), JSON.stringify(json.data));
                cargadoPreviamente = true;
              }
            }
          }
        } catch (e) {}
      }

      // 3. Si no estaba en local, recuperar desde Supabase Storage en la nube
      if (!cargadoPreviamente) {
        try {
          const storagePath = `simulacros/calificaciones_${simulacro.id}.json`;
          const { data: blob } = await supabase.storage.from('archivos').download(storagePath);
          if (blob && isMounted) {
            const text = await blob.text();
            const parsed = JSON.parse(text);
            if (parsed.configuracion) setConfig(parsed.configuracion);
            if (Array.isArray(parsed.resultados) && parsed.resultados.length > 0) {
              setResultados(parsed.resultados);
              setUploadedFileName(parsed.archivo_nombre || 'Archivo sincronizado de Supabase');
              setActiveTab('resultados');
              localStorage.setItem(getStorageKey(simulacro.id), text);
              cargadoPreviamente = true;
            }
          }
        } catch (e) {}
      }

      if (!cargadoPreviamente && isMounted) {
        setActiveTab('upload');
      }
    };

    fetchPadronAndCache();

    return () => {
      isMounted = false;
    };
  }, [isOpen, simulacro.id]);

  // Lista única de sedes/filiales existentes
  const sedesDisponibles = useMemo(() => {
    const set = new Set<string>();
    padron.forEach(p => {
      if (p.sede) set.add(p.sede.trim().toUpperCase());
    });
    resultados.forEach(r => {
      if (r.sede) set.add(r.sede.trim().toUpperCase());
    });
    return Array.from(set).sort();
  }, [padron, resultados]);

  // Lista única de áreas disponibles
  const areasDisponibles = useMemo(() => {
    const set = new Set<string>();
    resultados.forEach(r => {
      if (r.area) set.add(r.area.trim().toUpperCase());
    });
    if (set.size === 0) return ['A', 'B', 'C', 'D'];
    return Array.from(set).sort();
  }, [resultados]);

  // Lista de escuelas según la sede y área seleccionada
  const escuelasDisponibles = useMemo(() => {
    const set = new Set<string>();
    resultados.forEach(r => {
      const matchSede = filterSede === 'TODOS' || r.sede.toUpperCase() === filterSede.toUpperCase();
      const matchArea = filterArea === 'TODOS' || r.area.toUpperCase() === filterArea.toUpperCase();
      if (matchSede && matchArea && r.carrera) {
        set.add(r.carrera.trim().toUpperCase());
      }
    });
    return Array.from(set).sort();
  }, [resultados, filterSede, filterArea]);

  // Cantidad de postulantes evaluados con nota menor al umbral delimitado
  const postulantesAfectadosPorUmbral = useMemo(() => {
    if (!config.bono_umbral_corte || config.bono_umbral_corte <= 0) return 0;
    return resultados.filter(r => {
      if (r.isNsp || r.notaBase === 'NSP') return false;
      const b = typeof r.notaBase === 'number' ? r.notaBase : parseFloat(String(r.notaBase)) || 0;
      return b > 0 && b < (config.bono_umbral_corte || 0);
    }).length;
  }, [resultados, config.bono_umbral_corte]);

  // -------------------------------------------------------------
  // PARSER DE ARCHIVOS (CSV / EXCEL)
  // -------------------------------------------------------------
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setIsProcessing(true);

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const firstSheet = wb.Sheets[wb.SheetNames[0]];
          const data: any[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
          inspeccionarYProcesarFilas(data, file.name);
        } catch (err: any) {
          notify?.('Error leyendo archivo Excel: ' + err.message, 'error');
          setIsProcessing(false);
        }
      };
      reader.readAsBinaryString(file);
    } else {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          inspeccionarYProcesarFilas(results.data as any[], file.name);
        },
        error: (err) => {
          notify?.('Error procesando CSV: ' + err.message, 'error');
          setIsProcessing(false);
        }
      });
    }
  };

  /**
   * Paso 1: Inspecciona las filas, detecta sede, y compara contra el padrón oficial.
   * Si hay postulantes no registrados, solicita confirmación antes de calificar.
   */
  const inspeccionarYProcesarFilas = (rows: any[], fileName: string) => {
    setRawUploadedRows(rows);

    if (rows.length === 0) {
      notify?.('El archivo está vacío o no contiene filas con datos válidos.', 'warning');
      setIsProcessing(false);
      return;
    }

    // Mapa de padrón por DNI
    const padronMap = new Map<string, SimulacroPostulante>();
    padron.forEach(p => {
      const cleanDni = String(p.dni || '').trim().replace(/^0+/, '');
      if (cleanDni) {
        padronMap.set(cleanDni, p);
        padronMap.set(String(p.dni || '').trim(), p);
      }
    });

    const noRegistradosList: PostulanteNoRegistrado[] = [];

    rows.forEach(row => {
      let dniVal = '';
      let notaRaw: any = null;
      let nombreVal = '';
      let carreraVal = '';
      let areaVal = '';
      let sedeVal = '';

      Object.entries(row).forEach(([rawKey, val]) => {
        const key = rawKey.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const cleanKey = key.replace(/[\s\-_]/g, '');
        const strVal = String(val).trim();

        if (['dni', 'codigo', 'codpostulante', 'documento', 'doc', 'identificacion'].includes(cleanKey)) {
          dniVal = strVal;
        } else if (['nota', 'puntaje', 'promedio', 'score', 'notafinal', 'puntos', 'calificacion'].includes(cleanKey)) {
          notaRaw = strVal;
        } else if (['nombres', 'nombre', 'postulante', 'apellidosnombres', 'nombrecompleto', 'datos', 'alumno'].includes(cleanKey)) {
          nombreVal = strVal;
        } else if (['carrera', 'escuela', 'programa', 'especialidad', 'escuelaprofesional'].includes(cleanKey)) {
          carreraVal = strVal;
        } else if (['area', 'grupo', 'grupoacademico', 'areaacademica', 'areapostulacion', 'areaestudio', 'bloque', 'canal'].includes(cleanKey)) {
          areaVal = strVal;
        } else if (['sede', 'filial', 'lugar', 'local', 'campus', 'ciudad', 'sedeexamen', 'filialpostulacion'].includes(cleanKey)) {
          sedeVal = strVal.toUpperCase();
        }
      });

      if (!dniVal) return;

      const cleanDni = dniVal.replace(/^0+/, '');
      const postulantePadron = padronMap.get(cleanDni) || padronMap.get(dniVal);

      // Si no existe en el padrón, registrarlo como no registrado
      if (!postulantePadron) {
        const sedeAsignada = (expectedSede !== 'AUTO' ? expectedSede : (sedeVal || 'SEDE CENTRAL')).toUpperCase();
        const carreraAsignada = carreraVal || 'SIN CARRERA';
        const areaAsignada = normalizarArea(areaVal) || (postulantePadron?.grupo ? normalizarArea(postulantePadron.grupo) : '') || deducirAreaDeCarrera(carreraAsignada, padron);

        noRegistradosList.push({
          dni: dniVal,
          nombres_apellidos: nombreVal || `POSTULANTE ${dniVal}`,
          sede: sedeAsignada,
          carrera: carreraAsignada,
          grupo: areaAsignada,
          nota: notaRaw
        });
      }
    });

    // ¿Hay postulantes no registrados en el padrón?
    if (noRegistradosList.length > 0) {
      setUnregisteredPostulantes(noRegistradosList);
      setShowUnregisteredModal(true);
      setIsProcessing(false);
      return;
    }

    // Si todos ya están registrados, compilar directamente
    compilarCalificaciones(rows, padron);
  };

  /**
   * Paso 2: Ejecuta la calificación, cruce de sedes y orden de méritos.
   */
  const compilarCalificaciones = (rows: any[], padronActivo: SimulacroPostulante[], omitirNoRegistrados: boolean = false) => {
    setIsProcessing(true);

    const padronMap = new Map<string, SimulacroPostulante>();
    padronActivo.forEach(p => {
      const cleanDni = String(p.dni || '').trim().replace(/^0+/, '');
      if (cleanDni) {
        padronMap.set(cleanDni, p);
        padronMap.set(String(p.dni || '').trim(), p);
      }
    });

    const parsedItems: SimulacroResultadoItem[] = [];
    const dniEncontradosEnArchivo = new Set<string>();

    rows.forEach(row => {
      let dniVal = '';
      let notaRaw: any = null;
      let nombreVal = '';
      let carreraVal = '';
      let areaVal = '';
      let sedeVal = '';

      Object.entries(row).forEach(([rawKey, val]) => {
        const key = rawKey.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const cleanKey = key.replace(/[\s\-_]/g, '');
        const strVal = String(val).trim();

        if (['dni', 'codigo', 'codpostulante', 'documento', 'doc', 'identificacion'].includes(cleanKey)) {
          dniVal = strVal;
        } else if (['nota', 'puntaje', 'promedio', 'score', 'notafinal', 'puntos', 'calificacion'].includes(cleanKey)) {
          notaRaw = strVal;
        } else if (['nombres', 'nombre', 'postulante', 'apellidosnombres', 'nombrecompleto', 'datos', 'alumno'].includes(cleanKey)) {
          nombreVal = strVal;
        } else if (['carrera', 'escuela', 'programa', 'especialidad', 'escuelaprofesional'].includes(cleanKey)) {
          carreraVal = strVal;
        } else if (['area', 'grupo', 'grupoacademico', 'areaacademica', 'areapostulacion', 'areaestudio', 'bloque', 'canal'].includes(cleanKey)) {
          areaVal = strVal;
        } else if (['sede', 'filial', 'lugar', 'local', 'campus', 'ciudad', 'sedeexamen', 'filialpostulacion'].includes(cleanKey)) {
          sedeVal = strVal.toUpperCase();
        }
      });

      if (!dniVal) return;

      const cleanDni = dniVal.replace(/^0+/, '');
      const postulantePadron = padronMap.get(cleanDni) || padronMap.get(dniVal);

      // Si el usuario eligió omitir los no registrados y este DNI no estaba en el padrón, se salta
      if (omitirNoRegistrados && !postulantePadron) {
        return;
      }

      dniEncontradosEnArchivo.add(cleanDni);
      dniEncontradosEnArchivo.add(dniVal);

      // La sede viene de: 1. Columna 'sede' del CSV, o 2. Padrón oficial, o 3. Sede esperada si no es AUTO
      const sedeFinal = (
        sedeVal ||
        (expectedSede !== 'AUTO' ? expectedSede : (postulantePadron?.sede || 'SEDE CENTRAL'))
      ).toUpperCase();

      const carreraFinal = carreraVal || postulantePadron?.carrera || 'SIN CARRERA';
      const areaFinal = normalizarArea(areaVal) || (postulantePadron?.grupo ? normalizarArea(postulantePadron.grupo) : '') || deducirAreaDeCarrera(carreraFinal, padronActivo);
      const nombreFinal = nombreVal || postulantePadron?.nombres_apellidos || 'POSTULANTE';

      // Interpretación de la nota
      let isNsp = false;
      let notaNum: number | 'NSP' = 0;

      const notaStrUpper = String(notaRaw || '').toUpperCase();
      if (
        notaRaw === null ||
        notaRaw === undefined ||
        notaStrUpper === '' ||
        notaStrUpper.includes('NSP') ||
        notaStrUpper.includes('AUSENTE') ||
        notaStrUpper === '-1' ||
        (config.tratar_cero_como_nsp && (notaStrUpper === '0' || notaStrUpper === '0.0' || notaStrUpper === '0.00' || parseFloat(notaStrUpper) === 0))
      ) {
        isNsp = true;
        notaNum = 'NSP';
      } else {
        const parsed = parseFloat(notaStrUpper.replace(',', '.'));
        if (isNaN(parsed)) {
          isNsp = true;
          notaNum = 'NSP';
        } else {
          notaNum = parsed;
        }
      }

      parsedItems.push({
        dni: dniVal,
        nombres: nombreFinal,
        sede: sedeFinal,
        area: areaFinal,
        carrera: carreraFinal,
        aula: postulantePadron?.aula,
        carpeta: postulantePadron?.carpeta,
        notaBase: notaNum,
        bono: 0,
        notaFinal: notaNum,
        isNsp: isNsp,
        observacion: isNsp ? 'NSP' : ''
      });
    });

    // Postulantes en el padrón oficial que no aparecieron en el archivo de notas se agregan automáticamente como NSP
    padronActivo.forEach(p => {
      const cleanDni = String(p.dni || '').trim().replace(/^0+/, '');
      if (!dniEncontradosEnArchivo.has(cleanDni) && !dniEncontradosEnArchivo.has(String(p.dni || '').trim())) {
        parsedItems.push({
          dni: p.dni,
          nombres: p.nombres_apellidos || 'SIN NOMBRE',
          sede: p.sede || 'SEDE CENTRAL',
          area: p.grupo || 'A',
          carrera: p.carrera || 'SIN CARRERA',
          aula: p.aula,
          carpeta: p.carpeta,
          notaBase: 'NSP',
          bono: 0,
          notaFinal: 'NSP',
          isNsp: true,
          observacion: 'NSP'
        });
      }
    });

    // Calcular orden de méritos
    const clasificados = calcularOrdenMerito(parsedItems, config);
    setResultados(clasificados);
    setIsProcessing(false);
    setActiveTab('resultados');
    // AUTO-GUARDADO INMEDIATO (Local Storage + Backend Local + Supabase)
    persistirCalificaciones(clasificados, uploadedFileName || 'Archivo procesado', config, false);
    notify?.(`Calificación completada: ${clasificados.length} postulantes evaluados y guardados automáticamente.`, 'success');
  };

  /**
   * Registra formalmente a los postulantes nuevos en simulacro_postulantes (Supabase + Local).
   */
  const handleConfirmarRegistroNuevosPostulantes = async () => {
    if (unregisteredPostulantes.length === 0) return;
    setIsRegisteringPending(true);

    try {
      const recordsToInsert = unregisteredPostulantes.map(p => ({
        simulacro_id: simulacro.id,
        dni: p.dni,
        nombres_apellidos: p.nombres_apellidos,
        sede: p.sede,
        carrera: p.carrera,
        grupo: p.grupo,
        aula: 'REGISTRO CALIFICACIÓN',
        carpeta: '1',
        ingreso_registrado: false
      }));

      // 1. Guardar en Supabase tabla simulacro_postulantes
      try {
        await supabase
          .from('simulacro_postulantes')
          .upsert(recordsToInsert, { onConflict: 'simulacro_id,dni' });
      } catch (err) {
        console.warn('Error upserting nuevos postulantes a Supabase:', err);
      }

      // 2. Actualizar padrón en estado y localStorage
      const nuevoPadronCompleto = [...padron, ...recordsToInsert];
      setPadron(nuevoPadronCompleto);
      try {
        localStorage.setItem(`kiosk_padron_${simulacro.id}`, JSON.stringify(nuevoPadronCompleto));
      } catch (e) {}

      // 3. Proceder con la compilación completa integrando a los nuevos
      setShowUnregisteredModal(false);
      setUnregisteredPostulantes([]);
      compilarCalificaciones(rawUploadedRows, nuevoPadronCompleto, false);
      notify?.(`${recordsToInsert.length} postulantes nuevos incorporados formalmente al padrón oficial.`, 'success');
    } catch (err: any) {
      notify?.('Error registrando nuevos postulantes: ' + err.message, 'error');
    } finally {
      setIsRegisteringPending(false);
    }
  };

  /**
   * Omite los postulantes no registrados y califica solo a los ya registrados.
   */
  const handleOmitirNoRegistrados = () => {
    setShowUnregisteredModal(false);
    setUnregisteredPostulantes([]);
    compilarCalificaciones(rawUploadedRows, padron, true);
    notify?.('Se omitieron los postulantes no registrados. Calificando solo el padrón oficial.', 'info');
  };

  /**
   * Cancela la carga para revisar el archivo.
   */
  const handleCancelarCarga = () => {
    setShowUnregisteredModal(false);
    setUnregisteredPostulantes([]);
    setRawUploadedRows([]);
    setUploadedFileName('');
    setIsProcessing(false);
  };

  /**
   * Aplica bonificaciones y calcula el orden de mérito por Escuela Profesional.
   */
  const calcularOrdenMerito = (items: SimulacroResultadoItem[], cfg: SimulacroCalificacionConfig) => {
    // 1. Recalcular notas finales con bonificación
    const conNotasRecalculadas = items.map(item => {
      // Discriminación 1: Postulante ausente (NSP)
      if (item.isNsp || item.notaBase === 'NSP') {
        return {
          ...item,
          isNsp: true,
          bono: 0,
          notaFinal: 'NSP' as const,
          observacion: 'NSP'
        };
      }

      const base = typeof item.notaBase === 'number' ? item.notaBase : parseFloat(String(item.notaBase)) || 0;

      // Discriminación 2: Postulante con nota 0 o menor (NO recibe bonificación bajo ninguna circunstancia)
      if (base <= 0) {
        if (cfg.tratar_cero_como_nsp) {
          return {
            ...item,
            isNsp: true,
            bono: 0,
            notaFinal: 'NSP' as const,
            observacion: 'NSP'
          };
        }
        return {
          ...item,
          bono: 0,
          notaFinal: 0,
          observacion: item.observacion === 'INGRESANTE' ? '' : item.observacion
        };
      }

      // Solo postulantes evaluados con nota > 0 reciben bonificación de preguntas o de escala
      const bonoArea = cfg.bono_areas[item.area.toUpperCase()] || 0;
      const bonoGen = cfg.bono_general || 0;

      // Bonificación focalizada para personas con nota menor al umbral delimitado (ej. nota menor a 4)
      let bonoUmbral = 0;
      if (
        cfg.bono_umbral_activo &&
        (cfg.bono_umbral_puntos || 0) > 0 &&
        (cfg.bono_umbral_corte || 0) > 0 &&
        base < (cfg.bono_umbral_corte || 0)
      ) {
        bonoUmbral = cfg.bono_umbral_puntos || 0;
      }

      const bonoTotal = bonoGen + bonoArea + bonoUmbral;
      const final = Math.max(0, base + bonoTotal);

      return {
        ...item,
        bono: bonoTotal,
        notaFinal: final
      };
    });

    // 2. Agrupar por Área y Escuela (uniendo a todas las filiales para orden de mérito general)
    const gruposEscuela = new Map<string, SimulacroResultadoItem[]>();
    conNotasRecalculadas.forEach(item => {
      const key = `${item.area}___${item.carrera}`.toUpperCase();
      if (!gruposEscuela.has(key)) gruposEscuela.set(key, []);
      gruposEscuela.get(key)!.push(item);
    });

    const resultadoFinal: SimulacroResultadoItem[] = [];

    gruposEscuela.forEach(lista => {
      // Orden: mayor nota final primero, NSP al final
      lista.sort((a, b) => {
        if (a.isNsp && !b.isNsp) return 1;
        if (!a.isNsp && b.isNsp) return -1;
        if (a.isNsp && b.isNsp) return 0;
        return (Number(b.notaFinal) || 0) - (Number(a.notaFinal) || 0);
      });

      // Asignar orden de mérito numérico correlativo (1..N)
      lista.forEach((p, idx) => {
        p.num = idx + 1;
        const vacantesEscuela = cfg.vacantes_por_escuela?.[p.carrera.toUpperCase()] || 0;
        if (!p.isNsp && vacantesEscuela > 0 && p.num <= vacantesEscuela) {
          p.observacion = 'INGRESANTE';
          p.vacanteAsignada = true;
        } else if (p.isNsp) {
          p.observacion = 'NSP';
          p.vacanteAsignada = false;
        } else {
          p.observacion = ''; // Dejar en blanco según formato oficial UNSAAC
          p.vacanteAsignada = false;
        }
        resultadoFinal.push(p);
      });
    });

    return resultadoFinal;
  };

  /**
   * Recalcula con la configuración de bonos actualizada
   */
  const handleRecalcularBonos = () => {
    if (resultados.length === 0) return;
    const recal = calcularOrdenMerito(resultados, config);
    setResultados(recal);
    // AUTO-GUARDADO INMEDIATO
    persistirCalificaciones(recal, uploadedFileName, config, false);
    notify?.('Bonificaciones aplicadas, orden de mérito actualizado y guardado permanentemente.', 'success');
  };

  // -------------------------------------------------------------
  // PERSISTENCIA AUTOMÁTICA Y PERMANENTE (TRIPLE RESPALDO)
  // -------------------------------------------------------------
  const persistirCalificaciones = async (
    itemsAGuardar: SimulacroResultadoItem[],
    fileNameAGuardar: string,
    cfgAGuardar: SimulacroCalificacionConfig,
    showToast: boolean = false
  ) => {
    if (!itemsAGuardar || itemsAGuardar.length === 0) return;
    setSavingState(true);

    const payload = {
      simulacro_id: simulacro.id,
      archivo_nombre: fileNameAGuardar || uploadedFileName || 'Archivo procesado',
      configuracion: cfgAGuardar,
      resultados: itemsAGuardar,
      updated_at: new Date().toISOString()
    };

    // 1. Guardar en Base de Datos formal de Supabase (simulacro_calificaciones y simulacro_resultados)
    try {
      const totalEvaluados = itemsAGuardar.filter(i => !i.isNsp && i.notaFinal !== 'NSP').length;
      const totalNsp = itemsAGuardar.filter(i => i.isNsp || i.notaFinal === 'NSP').length;
      const totalIngresantes = itemsAGuardar.filter(i => i.vacanteAsignada || i.observacion === 'INGRESANTE').length;
      const notasNumericas = itemsAGuardar
        .map(i => typeof i.notaFinal === 'number' ? i.notaFinal : (typeof i.notaBase === 'number' ? i.notaBase : null))
        .filter((n): n is number => n !== null);
      const notaMaxima = notasNumericas.length > 0 ? Math.max(...notasNumericas) : 0;
      const notaMinima = notasNumericas.length > 0 ? Math.min(...notasNumericas) : 0;
      const notaPromedio = notasNumericas.length > 0 
        ? Number((notasNumericas.reduce((acc, curr) => acc + curr, 0) / notasNumericas.length).toFixed(3)) 
        : 0;

      const { data: califRow, error: califErr } = await supabase
        .from('simulacro_calificaciones')
        .upsert({
          simulacro_id: simulacro.id,
          archivo_nombre: payload.archivo_nombre,
          configuracion: cfgAGuardar,
          total_evaluados: totalEvaluados,
          total_nsp: totalNsp,
          total_ingresantes: totalIngresantes,
          nota_maxima: notaMaxima,
          nota_minima: notaMinima,
          nota_promedio: notaPromedio,
          fecha_calificacion: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'simulacro_id' })
        .select('id')
        .single();

      if (califErr) {
        console.warn('Error guardando cabecera en simulacro_calificaciones:', califErr);
      }

      const calificacionId = califRow?.id;
      const rowsToInsert = itemsAGuardar.map((item, idx) => ({
        simulacro_id: simulacro.id,
        calificacion_id: calificacionId || null,
        dni: String(item.dni || '').trim(),
        nombres: item.nombres || '',
        sede: item.sede || '',
        area: item.area || '',
        carrera: item.carrera || '',
        aula: item.aula || '',
        carpeta: item.carpeta || '',
        nota_base: typeof item.notaBase === 'number' ? item.notaBase : null,
        bono: typeof item.bono === 'number' ? item.bono : 0,
        nota_final: typeof item.notaFinal === 'number' ? item.notaFinal : null,
        is_nsp: Boolean(item.isNsp || item.notaBase === 'NSP' || item.notaFinal === 'NSP'),
        observacion: item.observacion || '',
        vacante_asignada: Boolean(item.vacanteAsignada),
        merito_general: item.num || (idx + 1),
        merito_carrera: item.merito_carrera || null,
        merito_area: item.merito_area || null,
        updated_at: new Date().toISOString()
      }));

      // Inserción en lotes de 200 filas para máxima velocidad
      const chunkSize = 200;
      for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
        const chunk = rowsToInsert.slice(i, i + chunkSize);
        const { error: upsertErr } = await supabase
          .from('simulacro_resultados')
          .upsert(chunk, { onConflict: 'simulacro_id,dni' });
        if (upsertErr) {
          console.warn(`Error guardando lote ${i}-${i + chunkSize} en simulacro_resultados:`, upsertErr);
        }
      }
    } catch (dbErr) {
      console.warn('Error persistiendo en base de datos formal Supabase:', dbErr);
    }

    // 2. Guardar en localStorage inmediatamente (Caché de sesión)
    try {
      localStorage.setItem(getStorageKey(simulacro.id), JSON.stringify(payload));
    } catch (e) {
      console.warn('Error guardando en localStorage:', e);
    }

    // 3. Guardar en backend local (puerto 5000)
    try {
      await fetch(`/api/simulacros/${simulacro.id}/calificaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.warn('Error guardando en backend local:', e);
    }

    // 4. Guardar copia de seguridad en Supabase Storage
    try {
      const storagePath = `simulacros/calificaciones_${simulacro.id}.json`;
      await supabase.storage
        .from('archivos')
        .upload(storagePath, JSON.stringify(payload), {
          contentType: 'application/json',
          upsert: true
        });
    } catch (e) {
      console.warn('Error guardando en Supabase storage:', e);
    }

    setSavingState(false);
    if (showToast) {
      notify?.('Resultados guardados permanentemente en el servidor local y en la nube.', 'success');
    }
  };

  const handleGuardarEnSistema = () => {
    persistirCalificaciones(resultados, uploadedFileName, config, true);
  };

  const handleLimpiarCalificaciones = async () => {
    if (window.confirm('¿Deseas limpiar las calificaciones actuales para subir un nuevo archivo de notas?')) {
      setResultados([]);
      setUploadedFileName('');
      setRawUploadedRows([]);
      try {
        localStorage.removeItem(getStorageKey(simulacro.id));
      } catch (e) {}
      try {
        await fetch(`/api/simulacros/${simulacro.id}/calificaciones`, { method: 'DELETE' });
      } catch (e) {}
      try {
        await supabase.from('simulacro_resultados').delete().eq('simulacro_id', simulacro.id);
        await supabase.from('simulacro_calificaciones').delete().eq('simulacro_id', simulacro.id);
      } catch (e) {}
      try {
        await supabase.storage.from('archivos').remove([`simulacros/calificaciones_${simulacro.id}.json`]);
      } catch (e) {}
      setActiveTab('upload');
      notify?.('Calificaciones anteriores limpiadas. Ya puedes subir un nuevo archivo.', 'info');
    }
  };

  // -------------------------------------------------------------
  // GENERACIÓN DE REPORTES PDF (FORMATO OFICIAL UNSAAC)
  // -------------------------------------------------------------
  const estructurarDatosParaPDF = useCallback((itemsFiltrados: SimulacroResultadoItem[]): EscuelaReporteData[] => {
    const mapa = new Map<string, EscuelaReporteData>();

    itemsFiltrados.forEach(item => {
      // Agrupación unificada: Área y Carrera (uniendo a todas las filiales)
      const key = `${item.area}___${item.carrera}`.toUpperCase();
      if (!mapa.has(key)) {
        mapa.set(key, {
          escuela: item.carrera,
          area: item.area,
          filial: filterSede !== 'TODOS' ? filterSede : 'GENERAL',
          vacantes: config.vacantes_por_escuela?.[item.carrera.toUpperCase()] || 0,
          resultados: [],
          comision: config.comision
        });
      }
      mapa.get(key)!.resultados.push(item);
    });

    mapa.forEach(esc => {
      esc.resultados.sort((a, b) => {
        if (a.isNsp && !b.isNsp) return 1;
        if (!a.isNsp && b.isNsp) return -1;
        if (a.isNsp && b.isNsp) return 0;
        return (Number(b.notaFinal) || 0) - (Number(a.notaFinal) || 0);
      });
      esc.resultados.forEach((p, idx) => {
        p.num = idx + 1;
      });
    });

    return Array.from(mapa.values()).sort((a, b) => {
      if (a.area !== b.area) return a.area.localeCompare(b.area);
      return a.escuela.localeCompare(b.escuela);
    });
  }, [config]);

  // Generar PDF de una única escuela
  const handleExportarEscuelaPDF = async (escuelaData: EscuelaReporteData) => {
    try {
      setGeneratingPdf(true);
      await generarPDFPorEscuela(escuelaData, config);
      notify?.(`PDF generado para ${escuelaData.escuela}`, 'success');
    } catch (err: any) {
      notify?.('Error generando PDF: ' + err.message, 'error');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Generar PDF por Filial
  const handleExportarFilialPDF = async (sedeNombre: string) => {
    try {
      setGeneratingPdf(true);
      const itemsFilial = resultados.filter(r => r.sede.toUpperCase() === sedeNombre.toUpperCase());
      if (itemsFilial.length === 0) {
        notify?.(`No hay postulantes en la filial ${sedeNombre}`, 'warning');
        return;
      }
      const escuelasFilial = estructurarDatosParaPDF(itemsFilial);
      await generarPDFFilial(sedeNombre, escuelasFilial, config);
      notify?.(`PDF oficial generado para la Filial ${sedeNombre}`, 'success');
    } catch (err: any) {
      notify?.('Error generando PDF de filial: ' + err.message, 'error');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Generar PDF Consolidado General
  const handleExportarConsolidadoGeneral = async () => {
    try {
      setGeneratingPdf(true);
      const escuelas = estructurarDatosParaPDF(resultados);
      if (escuelas.length === 0) {
        notify?.('No hay datos para generar el PDF consolidado.', 'warning');
        return;
      }
      await generarPDFConsolidadoGeneral(escuelas, config);
      notify?.('PDF Consolidado General generado con éxito.', 'success');
    } catch (err: any) {
      notify?.('Error generando PDF Consolidado: ' + err.message, 'error');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Exportar Excel Consolidado
  const handleExportarExcel = () => {
    if (resultados.length === 0) {
      notify?.('No hay resultados para exportar.', 'warning');
      return;
    }

    const dataExcel = resultados.map(r => ({
      'ORDEN': r.num,
      'DNI': r.dni,
      'APELLIDOS Y NOMBRES': r.nombres,
      'SEDE / FILIAL': r.sede,
      'ÁREA': r.area,
      'ESCUELA PROFESIONAL': r.carrera,
      'AULA': r.aula || '',
      'CARPETA': r.carpeta || '',
      'NOTA BASE': r.isNsp ? 'NSP' : r.notaBase,
      'BONO (+)': r.bono,
      'NOTA FINAL': r.isNsp ? 'NSP' : (typeof r.notaFinal === 'number' ? Number(r.notaFinal.toFixed(3)) : r.notaFinal),
      'CONDICIÓN': r.isNsp ? 'NSP' : (r.observacion || 'EVALUADO')
    }));

    const ws = XLSX.utils.json_to_sheet(dataExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Resultados');
    XLSX.writeFile(wb, `Resultados_${simulacro.nombre.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
    notify?.('Excel exportado correctamente.', 'success');
  };

  // -------------------------------------------------------------
  // FILTRADO DINÁMICO DE RESULTADOS PARA LA TABLA
  // -------------------------------------------------------------
  const resultadosFiltrados = useMemo(() => {
    return resultados.filter(item => {
      if (filterSede !== 'TODOS' && item.sede.toUpperCase() !== filterSede.toUpperCase()) return false;
      if (filterArea !== 'TODOS' && item.area.toUpperCase() !== filterArea.toUpperCase()) return false;
      if (filterEscuela !== 'TODOS' && item.carrera.toUpperCase() !== filterEscuela.toUpperCase()) return false;
      if (filterCondicion === 'EVALUADOS' && item.isNsp) return false;
      if (filterCondicion === 'NSP' && !item.isNsp) return false;
      if (filterCondicion === 'INGRESANTES' && (!item.observacion || !item.observacion.includes('INGRESANTE'))) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const dniMatch = item.dni.toLowerCase().includes(q);
        const nomMatch = item.nombres.toLowerCase().includes(q);
        const aulaMatch = item.aula && item.aula.toLowerCase().includes(q);
        const carreraMatch = item.carrera.toLowerCase().includes(q);
        if (!dniMatch && !nomMatch && !aulaMatch && !carreraMatch) return false;
      }

      return true;
    });
  }, [resultados, filterSede, filterArea, filterEscuela, filterCondicion, searchQuery]);

  // Estadísticas del conjunto filtrado
  const statsFiltradas = useMemo(() => {
    const total = resultadosFiltrados.length;
    const nspCount = resultadosFiltrados.filter(r => r.isNsp).length;
    const evaluados = total - nspCount;
    const notasNum = resultadosFiltrados
      .filter(r => !r.isNsp && typeof r.notaFinal === 'number')
      .map(r => r.notaFinal as number);
    
    const maxNota = notasNum.length > 0 ? Math.max(...notasNum) : 0;
    const sumNota = notasNum.reduce((acc, val) => acc + val, 0);
    const avgNota = evaluados > 0 ? sumNota / evaluados : 0;

    return { total, nspCount, evaluados, maxNota, avgNota };
  }, [resultadosFiltrados]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-7xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh] animate-scale-up relative">
        
        {/* ========================================================= */}
        {/* HEADER MODAL INSTITUCIONAL (UNSAAC Merlot & Gold) */}
        {/* ========================================================= */}
        <div className="bg-gradient-to-r from-[#66101c] via-[#7b1523] to-[#9b192d] text-white p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-rose-900/40 relative">
          <div className="flex items-center gap-4">
            <div className="size-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-2 flex items-center justify-center shrink-0 shadow-inner">
              <img 
                src="/escudo_unsaac_oficial.png" 
                alt="Escudo UNSAAC" 
                className="max-h-full max-w-full object-contain"
                onError={(e) => {
                  (e.target as any).style.display = 'none';
                }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-extrabold text-[10px] uppercase tracking-wider border border-amber-300/30">
                  Módulo de Calificación
                </span>
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/90 font-bold text-[10px] uppercase">
                  {simulacro.fecha}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-white drop-shadow-sm">
                {simulacro.nombre}
              </h2>
              <p className="text-xs text-rose-100 font-medium">
                Padrón oficial: <strong className="text-white">{padron.length}</strong> postulantes registrados
                {uploadedFileName && <> • Archivo activo: <strong className="text-amber-200">{uploadedFileName}</strong></>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {resultados.length > 0 && (
              <>
                <button
                  onClick={handleLimpiarCalificaciones}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-rose-500/30 text-white font-extrabold text-xs uppercase tracking-wider transition-all border border-white/20 shadow-sm active:scale-95"
                  title="Limpiar calificaciones actuales para cargar un archivo nuevo"
                >
                  <span className="material-symbols-outlined text-base">restart_alt</span>
                  <span>Limpiar / Cargar otro</span>
                </button>
                <button
                  onClick={handleGuardarEnSistema}
                  disabled={savingState}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white font-extrabold text-xs uppercase tracking-wider transition-all border border-white/20 shadow-sm active:scale-95"
                  title="Guardar notas y bonificaciones en la nube de Supabase y en el backend local"
                >
                  <span className="material-symbols-outlined text-base">cloud_upload</span>
                  <span>{savingState ? 'Guardando...' : 'Guardar en BD'}</span>
                </button>
              </>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all border border-white/10"
              title="Cerrar ventana"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* NAVEGACIÓN POR PESTAÑAS (TABS) */}
        {/* ========================================================= */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 flex items-center justify-between gap-4 overflow-x-auto">
          <div className="flex items-center gap-2 py-2">
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${
                activeTab === 'upload'
                  ? 'bg-white text-[#7b1523] shadow-sm border border-slate-200 ring-2 ring-[#7b1523]/10'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span className="material-symbols-outlined text-lg">upload_file</span>
              <span>1. Carga y Cruce</span>
            </button>

            <button
              onClick={() => setActiveTab('ajustes')}
              disabled={resultados.length === 0}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${
                activeTab === 'ajustes'
                  ? 'bg-white text-[#7b1523] shadow-sm border border-slate-200 ring-2 ring-[#7b1523]/10'
                  : resultados.length === 0
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span className="material-symbols-outlined text-lg">tune</span>
              <span>2. Ajuste de Puntos</span>
              {((config.bono_general || 0) > 0 ||
                Object.values(config.bono_areas).some(v => Number(v) > 0) ||
                (config.bono_umbral_activo && (config.bono_umbral_puntos || 0) > 0)) && (
                <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('resultados')}
              disabled={resultados.length === 0}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${
                activeTab === 'resultados'
                  ? 'bg-white text-[#7b1523] shadow-sm border border-slate-200 ring-2 ring-[#7b1523]/10'
                  : resultados.length === 0
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span className="material-symbols-outlined text-lg">format_list_numbered</span>
              <span>3. Resultados y Méritos</span>
              {resultados.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-black">
                  {resultados.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('reportes')}
              disabled={resultados.length === 0}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${
                activeTab === 'reportes'
                  ? 'bg-white text-[#7b1523] shadow-sm border border-slate-200 ring-2 ring-[#7b1523]/10'
                  : resultados.length === 0
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
              <span>4. Reportes Oficiales</span>
            </button>
          </div>

          {resultados.length > 0 && (
            <div className="hidden lg:flex items-center gap-3 text-xs text-slate-500">
              <span>Evaluados: <strong className="text-emerald-700">{resultados.filter(r => !r.isNsp).length}</strong></span>
              <span>NSP: <strong className="text-rose-700">{resultados.filter(r => r.isNsp).length}</strong></span>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* CONTENIDO PRINCIPAL SEGÚN TAB ACTIVO */}
        {/* ========================================================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">

          {/* --------------------------------------------------------- */}
          {/* TAB 1: CARGA Y CRUCE AUTOMÁTICO CON SEDE */}
          {/* --------------------------------------------------------- */}
          {activeTab === 'upload' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="size-10 rounded-2xl bg-[#7b1523]/10 text-[#7b1523] flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined">upload_file</span>
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase text-slate-800">
                      Cargar Archivo de Calificaciones con Sede (CSV o Excel)
                    </h3>
                    <p className="text-xs text-slate-500">
                      El sistema comparará cada DNI y <strong>sede</strong> con el padrón oficial (<strong>{padron.length}</strong> postulantes). Si hay postulantes no registrados, te consultará para incorporarlos antes de continuar.
                    </p>
                  </div>
                </div>

                {/* Modo de Carga General Descentralizado */}
                <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-rose-50/60 via-amber-50/40 to-slate-50 border border-rose-200/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-2xl bg-[#7b1523]/10 text-[#7b1523] flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-xl">hub</span>
                    </div>
                    <div>
                      <span className="text-xs font-black uppercase text-[#7b1523] flex items-center gap-1.5">
                        <span>Carga General Descentralizada (Todas las Filiales)</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                          Unificado
                        </span>
                      </span>
                      <p className="text-[11px] text-slate-600">
                        El archivo puede contener postulantes de <strong>Quillabamba, Abancay, Andahuaylas</strong> y demás sedes. Se unificarán y agruparán por <strong>Área</strong> y <strong>Carrera</strong> en un cuadro de mérito general.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-bold text-slate-500 uppercase">Sede por defecto:</span>
                    <select
                      value={expectedSede}
                      onChange={(e) => setExpectedSede(e.target.value)}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-bold text-xs text-slate-800 uppercase focus:outline-none focus:border-[#7b1523]"
                    >
                      <option value="AUTO">🔍 AUTO (De columna 'sede' o padrón)</option>
                      <option value="QUILLABAMBA">QUILLABAMBA</option>
                      <option value="ABANCAY">ABANCAY</option>
                      <option value="ANDAHUAYLAS">ANDAHUAYLAS</option>
                    </select>
                  </div>
                </div>

                {/* Dropzone */}
                <div className="border-2 border-dashed border-slate-300 hover:border-[#7b1523] rounded-3xl p-8 sm:p-12 text-center transition-all bg-slate-50/50 hover:bg-rose-50/20 group cursor-pointer relative">
                  <input
                    type="file"
                    accept=".csv, .xlsx, .xls"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div className="size-16 rounded-full bg-[#7b1523]/10 text-[#7b1523] flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-3xl">cloud_upload</span>
                  </div>
                  <h4 className="text-sm font-black text-slate-700 uppercase mb-1">
                    Arrastra tu archivo aquí o haz clic para explorar
                  </h4>
                  <p className="text-xs text-slate-400 mb-4">
                    Columnas soportadas: <code>dni</code>, <code>nombres</code>, <code>sede</code> (filial), <strong className="text-amber-300"><code>area</code> (A, B, C, D)</strong>, <code>carrera</code>, <code>nota</code>
                  </p>
                  <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 text-white font-bold text-xs uppercase tracking-wider group-hover:bg-[#7b1523] transition-colors shadow-sm">
                    <span className="material-symbols-outlined text-base">file_open</span>
                    <span>Seleccionar Archivo</span>
                  </span>
                </div>

                {isProcessing && (
                  <div className="mt-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-3 text-amber-800 text-xs font-bold">
                    <div className="size-5 border-2 border-amber-700 border-t-transparent rounded-full animate-spin shrink-0" />
                    <span>Cruzando datos con el padrón oficial y validando sedes y áreas...</span>
                  </div>
                )}

                {/* Parámetros de detección */}
                <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={config.tratar_cero_como_nsp}
                      onChange={(e) => setConfig({ ...config, tratar_cero_como_nsp: e.target.checked })}
                      className="mt-0.5 rounded text-[#7b1523] focus:ring-[#7b1523]"
                    />
                    <div>
                      <span className="text-xs font-black text-slate-700 uppercase block">Tratar nota 0.00 como NSP</span>
                      <span className="text-[11px] text-slate-500">
                        En el sistema de la UNSAAC, la nota 0.00 o en blanco representa a un postulante ausente (No Se Presentó).
                      </span>
                    </div>
                  </label>

                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-xs font-black text-slate-700 uppercase block mb-1">Columnas reconocidas del CSV:</span>
                    <ul className="text-[11px] text-slate-500 space-y-0.5 list-disc list-inside">
                      <li><strong>DNI:</strong> dni, codigo, cod_postulante, documento</li>
                      <li><strong>Área:</strong> area, grupo, area_academica (A, B, C o D)</li>
                      <li><strong>Sede:</strong> sede, filial, local, campus, sede_examen</li>
                      <li><strong>Carrera:</strong> carrera, escuela, especialidad</li>
                      <li><strong>Nota:</strong> nota, puntaje, promedio, score</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Resumen del Padrón Cargado */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600 text-base">verified</span>
                  <span>Distribución del Padrón de Postulantes Oficial ({padron.length} total)</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {sedesDisponibles.map(sede => {
                    const count = padron.filter(p => p.sede && p.sede.toUpperCase() === sede).length;
                    return (
                      <div key={sede} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase text-slate-400">Sede / Filial</p>
                          <p className="text-sm font-black text-slate-800 uppercase">{sede}</p>
                        </div>
                        <span className="text-lg font-black text-[#7b1523]">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------- */}
          {/* TAB 2: AJUSTE DE PUNTOS Y BONIFICACIÓN */}
          {/* --------------------------------------------------------- */}
          {activeTab === 'ajustes' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="size-10 rounded-2xl bg-amber-500/10 text-amber-700 flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined">tune</span>
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase text-slate-800">
                      Ajuste de Puntos y Bonificación
                    </h3>
                    <p className="text-xs text-slate-500">
                      Permite otorgar bonificación de puntos por preguntas anuladas, reajuste de escala o asignación formal de la Comisión. No afecta a postulantes con condición NSP ni con nota 0.000.
                    </p>
                  </div>
                </div>

                {/* Banner de Discriminación Institucional */}
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-amber-500 text-white mt-0.5 shadow-sm">
                      <span className="material-symbols-outlined text-lg">verified_user</span>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase text-amber-950">
                        Discriminación Obligatoria (NSP y Nota 0.000)
                      </p>
                      <p className="text-[11px] text-amber-900/80 mt-0.5">
                        Postulantes ausentes (<strong>NSP</strong>) o con nota base menor o igual a cero (<strong>0.000</strong>) <strong>no reciben ningún incremento</strong> de bonificación (Bono = 0.000) para proteger la legalidad del orden de mérito.
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none bg-white px-3 py-2 rounded-xl border border-amber-200 hover:border-amber-400 shrink-0 shadow-sm">
                    <input
                      type="checkbox"
                      checked={config.tratar_cero_como_nsp}
                      onChange={(e) => setConfig({ ...config, tratar_cero_como_nsp: e.target.checked })}
                      className="rounded text-[#7b1523] focus:ring-[#7b1523] size-4"
                    />
                    <span className="text-[11px] font-bold text-slate-700">Tratar Nota 0 como NSP</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                  {/* Bono General */}
                  <div className="p-5 rounded-2xl bg-amber-50/50 border border-amber-200/60">
                    <label className="block text-xs font-black uppercase text-amber-900 mb-1">
                      Bonificación General (Todos los evaluados)
                    </label>
                    <p className="text-[11px] text-amber-700/80 mb-3">
                      Suma este puntaje a todos los postulantes evaluados sin importar el área.
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.05"
                        min="0"
                        value={config.bono_general}
                        onChange={(e) => setConfig({ ...config, bono_general: parseFloat(e.target.value) || 0 })}
                        className="w-full px-4 py-2.5 rounded-xl border border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-black bg-white"
                        placeholder="0.000"
                      />
                      <span className="text-xs font-black text-amber-900 uppercase">Pts</span>
                    </div>
                  </div>

                  {/* Bonificación por Áreas Académicas */}
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
                    <label className="block text-xs font-black uppercase text-slate-800 mb-1">
                      Bonificación por Área Específica
                    </label>
                    <p className="text-[11px] text-slate-500 mb-3">
                      Ajuste diferenciado para preguntas de un área particular.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {(['A', 'B', 'C', 'D'] as const).map(area => (
                        <div key={area} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200">
                          <span className="px-2 py-1 rounded-lg bg-slate-800 text-white text-[10px] font-black">
                            {area}
                          </span>
                          <input
                            type="number"
                            step="0.05"
                            min="0"
                            value={config.bono_areas[area] || 0}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setConfig({
                                ...config,
                                bono_areas: { ...config.bono_areas, [area]: val }
                              });
                            }}
                            className="w-full text-xs font-black focus:outline-none text-right pr-1"
                            placeholder="0"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3. Bonificación Focalizada por Delimitación de Umbral (Notas Menores) */}
                <div className={`p-6 rounded-2xl border transition-all mb-6 ${
                  config.bono_umbral_activo 
                    ? 'bg-gradient-to-br from-indigo-50/90 via-white to-purple-50/50 border-indigo-300 shadow-md ring-2 ring-indigo-500/15' 
                    : 'bg-slate-50/80 border-slate-200'
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`size-10 rounded-xl flex items-center justify-center font-bold shadow-sm transition-colors ${
                        config.bono_umbral_activo ? 'bg-indigo-600 text-white' : 'bg-slate-300 text-slate-600'
                      }`}>
                        <span className="material-symbols-outlined text-xl">vertical_align_bottom</span>
                      </div>
                      <div>
                        <h4 className="text-sm font-black uppercase text-slate-800 flex items-center gap-2">
                          <span>Bonificación Dirigida a Notas Menores</span>
                          {config.bono_umbral_activo ? (
                            <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-wider">
                              Activa
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-wider">
                              Inactiva
                            </span>
                          )}
                        </h4>
                        <p className="text-xs text-slate-500">
                          Aumenta puntos exclusivamente a postulantes cuya nota base sea menor al límite configurado (todos los grupos, excluyendo 0 y NSP).
                        </p>
                      </div>
                    </div>

                    <label className="flex items-center gap-2.5 cursor-pointer select-none bg-white px-4 py-2 rounded-xl border border-slate-300 hover:border-indigo-400 shadow-sm transition-all self-start sm:self-auto">
                      <input
                        type="checkbox"
                        checked={!!config.bono_umbral_activo}
                        onChange={(e) => setConfig({ ...config, bono_umbral_activo: e.target.checked })}
                        className="rounded text-indigo-600 focus:ring-indigo-500 size-4"
                      />
                      <span className="text-xs font-black uppercase tracking-wide text-slate-700">
                        {config.bono_umbral_activo ? 'Función Activada' : 'Activar Función'}
                      </span>
                    </label>
                  </div>

                  <div className="space-y-4 pt-3 border-t border-indigo-100">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Parámetro 1: Nota límite de delimitación */}
                      <div className={`p-4 rounded-xl border transition-all ${
                        config.bono_umbral_activo ? 'bg-white border-indigo-200 shadow-sm' : 'bg-white/60 border-slate-200'
                      }`}>
                        <label className="block text-[11px] font-black uppercase text-indigo-950 mb-1">
                          1. Delimitar Notas Menores A:
                        </label>
                        <p className="text-[10px] text-slate-500 mb-2">
                          Aplica a notas base mayores a 0 y menores a este límite (ej. 4.000).
                        </p>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            max="20"
                            value={config.bono_umbral_corte ?? 4}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setConfig({ ...config, bono_umbral_corte: val, bono_umbral_activo: true });
                            }}
                            className={`w-full px-3 py-2 rounded-lg border text-sm font-black focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                              config.bono_umbral_activo 
                                ? 'border-indigo-300 text-indigo-950 bg-indigo-50/20' 
                                : 'border-slate-200 text-slate-600 bg-slate-50'
                            }`}
                            placeholder="4.000"
                          />
                          <span className="text-xs font-black text-indigo-900 uppercase">Pts</span>
                        </div>
                      </div>

                      {/* Parámetro 2: Puntaje a aumentar */}
                      <div className={`p-4 rounded-xl border transition-all ${
                        config.bono_umbral_activo ? 'bg-white border-indigo-200 shadow-sm' : 'bg-white/60 border-slate-200'
                      }`}>
                        <label className="block text-[11px] font-black uppercase text-indigo-950 mb-1">
                          2. Puntaje a Aumentar (+Pts):
                        </label>
                        <p className="text-[10px] text-slate-500 mb-2">
                          Puntos que se sumarán exclusivamente a los postulantes delimitados.
                        </p>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.05"
                            min="0"
                            max="20"
                            value={config.bono_umbral_puntos ?? 0}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setConfig({ ...config, bono_umbral_puntos: val, bono_umbral_activo: true });
                            }}
                            className={`w-full px-3 py-2 rounded-lg border text-sm font-black focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                              config.bono_umbral_activo 
                                ? 'border-indigo-300 text-indigo-950 bg-indigo-50/20' 
                                : 'border-slate-200 text-slate-600 bg-slate-50'
                            }`}
                            placeholder="1.000"
                          />
                          <span className="text-xs font-black text-indigo-900 uppercase">Pts</span>
                        </div>
                      </div>
                    </div>

                    {/* Notificador / Contador en tiempo real */}
                    <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2.5 ${
                      config.bono_umbral_activo
                        ? postulantesAfectadosPorUmbral > 0 
                          ? 'bg-indigo-100 text-indigo-950 border border-indigo-200 shadow-sm' 
                          : 'bg-amber-50 text-amber-900 border border-amber-200'
                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}>
                      <span className="material-symbols-outlined text-base text-indigo-600">
                        {config.bono_umbral_activo ? 'info' : 'toggle_off'}
                      </span>
                      <span>
                        {!config.bono_umbral_activo ? (
                          <>Para aplicar este ajuste, marca la casilla <strong>"Activar Función"</strong> arriba o ingresa los valores deseados.</>
                        ) : postulantesAfectadosPorUmbral > 0 ? (
                          <>
                            Se detectaron <strong className="text-indigo-950 font-black">{postulantesAfectadosPorUmbral}</strong> postulantes evaluados con nota mayor a 0 y menor a <strong className="font-black">{config.bono_umbral_corte}</strong> que recibirán <strong className="text-indigo-950 font-black">+{Number(config.bono_umbral_puntos || 0).toFixed(3)} pts</strong> adicionales.
                          </>
                        ) : (
                          <>Ningún postulante evaluado tiene nota entre 0 y {config.bono_umbral_corte} pts.</>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
                  <div className="text-xs text-slate-500">
                    Total evaluados con puntaje &gt; 0 aptos para bonificación:{' '}
                    <strong className="text-slate-800">
                      {resultados.filter(r => !r.isNsp && r.notaBase !== 'NSP' && (typeof r.notaBase === 'number' ? r.notaBase > 0 : (parseFloat(String(r.notaBase)) || 0) > 0)).length}
                    </strong> postulantes de {resultados.length}.
                  </div>
                  <button
                    onClick={handleRecalcularBonos}
                    className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-[#7b1523] hover:bg-[#66101c] text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-rose-900/20 active:scale-95 transition-all"
                  >
                    <span className="material-symbols-outlined text-base">refresh</span>
                    <span>Recalcular Méritos con Bonificación</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------- */}
          {/* TAB 3: RESULTADOS Y ORDEN DE MÉRITO */}
          {/* --------------------------------------------------------- */}
          {activeTab === 'resultados' && (
            <div className="space-y-4">
              
              {/* Tarjetas de Métricas Resumen */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
                  <p className="text-[10px] font-black uppercase text-slate-400">Total Postulantes</p>
                  <p className="text-xl font-black text-slate-800">{statsFiltradas.total}</p>
                </div>
                <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200/70 shadow-sm text-center">
                  <p className="text-[10px] font-black uppercase text-emerald-600">Evaluados</p>
                  <p className="text-xl font-black text-emerald-800">{statsFiltradas.evaluados}</p>
                </div>
                <div className="bg-rose-50/60 p-4 rounded-2xl border border-rose-200/70 shadow-sm text-center">
                  <p className="text-[10px] font-black uppercase text-rose-600">Ausentes (NSP)</p>
                  <p className="text-xl font-black text-rose-800">{statsFiltradas.nspCount}</p>
                </div>
                <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200/70 shadow-sm text-center">
                  <p className="text-[10px] font-black uppercase text-amber-600">Nota Máxima</p>
                  <p className="text-xl font-black text-amber-800">{statsFiltradas.maxNota.toFixed(3)}</p>
                </div>
                <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-200/70 shadow-sm text-center col-span-2 sm:col-span-1">
                  <p className="text-[10px] font-black uppercase text-blue-600">Promedio General</p>
                  <p className="text-xl font-black text-blue-800">{statsFiltradas.avgNota.toFixed(3)}</p>
                </div>
              </div>

              {/* Barra de Filtros Interactivos */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Sede / Filial</label>
                    <select
                      value={filterSede}
                      onChange={(e) => {
                        setFilterSede(e.target.value);
                        setFilterEscuela('TODOS');
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold text-xs uppercase focus:bg-white focus:outline-none focus:border-[#7b1523]"
                    >
                      <option value="TODOS">TODAS LAS SEDES ({sedesDisponibles.length})</option>
                      {sedesDisponibles.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Área Académica</label>
                    <select
                      value={filterArea}
                      onChange={(e) => {
                        setFilterArea(e.target.value);
                        setFilterEscuela('TODOS');
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold text-xs uppercase focus:bg-white focus:outline-none focus:border-[#7b1523]"
                    >
                      <option value="TODOS">TODAS LAS ÁREAS</option>
                      {areasDisponibles.map(a => (
                        <option key={a} value={a}>ÁREA "{a}"</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Escuela Profesional</label>
                    <select
                      value={filterEscuela}
                      onChange={(e) => setFilterEscuela(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold text-xs uppercase focus:bg-white focus:outline-none focus:border-[#7b1523]"
                    >
                      <option value="TODOS">TODAS LAS ESCUELAS ({escuelasDisponibles.length})</option>
                      {escuelasDisponibles.map(e => (
                        <option key={e} value={e}>{e}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Condición</label>
                    <select
                      value={filterCondicion}
                      onChange={(e) => setFilterCondicion(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold text-xs uppercase focus:bg-white focus:outline-none focus:border-[#7b1523]"
                    >
                      <option value="TODOS">TODOS LOS POSTULANTES</option>
                      <option value="EVALUADOS">SOLO EVALUADOS</option>
                      <option value="NSP">SOLO AUSENTES (NSP)</option>
                      <option value="INGRESANTES">SOLO INGRESANTES</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Buscar Postulante</label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-2 text-slate-400 text-base">search</span>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="DNI, Nombres, Carrera..."
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold text-xs uppercase focus:bg-white focus:outline-none focus:border-[#7b1523]"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                  <span className="text-slate-500 font-bold">
                    Mostrando <strong className="text-slate-900">{resultadosFiltrados.length}</strong> de {resultados.length} postulantes
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab('ajustes')}
                      className={`px-3 py-1.5 rounded-lg font-bold text-[11px] uppercase tracking-wider border flex items-center gap-1.5 transition-colors ${
                        (config.bono_general || 0) > 0 ||
                        Object.values(config.bono_areas).some(v => Number(v) > 0) ||
                        (config.bono_umbral_activo && (config.bono_umbral_puntos || 0) > 0)
                          ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                          : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border-indigo-200'
                      }`}
                      title="Ir a configurar bonificaciones generales, por área o delimitadas a notas menores"
                    >
                      <span className="material-symbols-outlined text-sm">tune</span>
                      <span>Configurar Bonificaciones</span>
                      {((config.bono_general || 0) > 0 ||
                        Object.values(config.bono_areas).some(v => Number(v) > 0) ||
                        (config.bono_umbral_activo && (config.bono_umbral_puntos || 0) > 0)) && (
                        <span className="size-2 rounded-full bg-amber-600 animate-pulse" />
                      )}
                    </button>
                    <button
                      onClick={handleLimpiarCalificaciones}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 font-bold text-[11px] uppercase tracking-wider border border-slate-200 hover:border-rose-300 flex items-center gap-1.5 transition-colors"
                      title="Limpiar calificaciones guardadas y cargar un nuevo archivo CSV/Excel"
                    >
                      <span className="material-symbols-outlined text-sm">restart_alt</span>
                      <span>Cargar otro archivo</span>
                    </button>
                    <button
                      onClick={handleExportarExcel}
                      className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px] uppercase tracking-wider border border-emerald-200 flex items-center gap-1.5 transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">table_view</span>
                      <span>Exportar Excel</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('reportes')}
                      className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-[#7b1523] font-bold text-[11px] uppercase tracking-wider border border-rose-200 flex items-center gap-1.5 transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
                      <span>Generar PDF Oficial</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabla de Resultados Oficiales */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto max-h-[500px]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-[#3c3c3c] text-white text-[10px] font-black uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th className="py-3 px-3 text-center w-12">Nro</th>
                        <th className="py-3 px-3 text-center w-28">Código / DNI</th>
                        <th className="py-3 px-4">Apellidos y Nombres</th>
                        <th className="py-3 px-3 text-center">Filial / Sede</th>
                        <th className="py-3 px-3 text-center">Área</th>
                        <th className="py-3 px-4">Escuela Profesional</th>
                        <th className="py-3 px-3 text-center">Nota Base</th>
                        <th className="py-3 px-3 text-center">Bono</th>
                        <th className="py-3 px-3 text-center font-black">Prom. Final</th>
                        <th className="py-3 px-4 text-center">Observación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {resultadosFiltrados.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-12 text-center text-slate-400 font-bold uppercase text-xs">
                            No se encontraron postulantes que coincidan con los filtros seleccionados.
                          </td>
                        </tr>
                      ) : (
                        resultadosFiltrados.map((item, idx) => {
                          const isEven = idx % 2 === 0;
                          const isIngresante = item.observacion && item.observacion.includes('INGRESANTE');

                          return (
                            <tr
                              key={`${item.dni}-${idx}`}
                              className={`transition-colors hover:bg-rose-50/30 ${
                                isEven ? 'bg-white' : 'bg-slate-50/60'
                              } ${isIngresante ? 'bg-emerald-50/50' : ''}`}
                            >
                              <td className="py-2 px-3 text-center font-black text-slate-700">
                                {item.num || idx + 1}
                              </td>
                              <td className="py-2 px-3 text-center font-mono font-bold text-slate-900">
                                {item.dni}
                              </td>
                              <td className="py-2 px-4 font-bold text-slate-800 uppercase">
                                {item.nombres}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                                  item.sede.includes('QUILLA') 
                                    ? 'bg-emerald-100 text-emerald-800' 
                                    : item.sede.includes('ABANCAY') 
                                    ? 'bg-blue-100 text-blue-800' 
                                    : 'bg-purple-100 text-purple-800'
                                }`}>
                                  {item.sede}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center">
                                <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-800 font-black text-[10px]">
                                  {item.area}
                                </span>
                              </td>
                              <td className="py-2 px-4 text-slate-700 font-semibold uppercase truncate max-w-[220px]" title={item.carrera}>
                                {item.carrera}
                              </td>
                              <td className="py-2 px-3 text-center font-mono text-slate-600">
                                {item.isNsp ? 'NSP' : typeof item.notaBase === 'number' ? item.notaBase.toFixed(3) : item.notaBase}
                              </td>
                              <td className="py-2 px-3 text-center font-mono text-amber-700 font-bold">
                                {item.bono > 0 ? `+${item.bono.toFixed(3)}` : '-'}
                              </td>
                              <td className="py-2 px-3 text-center font-mono font-black text-slate-900">
                                {item.isNsp ? (
                                  <span className="text-rose-600 font-bold">NSP</span>
                                ) : typeof item.notaFinal === 'number' ? (
                                  item.notaFinal.toFixed(3)
                                ) : (
                                  item.notaFinal
                                )}
                              </td>
                              <td className="py-2 px-4 text-center">
                                {isIngresante ? (
                                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white font-black text-[10px] uppercase shadow-sm">
                                    INGRESANTE
                                  </span>
                                ) : item.isNsp ? (
                                  <span className="text-rose-700 font-bold text-[10px]">NSP</span>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------- */}
          {/* TAB 4: REPORTES Y PDFS OFICIALES */}
          {/* --------------------------------------------------------- */}
          {activeTab === 'reportes' && (
            <div className="max-w-5xl mx-auto space-y-6">
              
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="size-10 rounded-2xl bg-[#7b1523]/10 text-[#7b1523] flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined">print</span>
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase text-slate-800">
                      Emisión de Reportes Oficiales en PDF (UNSAAC)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Genera los documentos solemnes con el escudo institucional, cabeceras oficiales, columna de filial y notas con 3 decimales.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div className="p-5 rounded-2xl bg-rose-50/40 border border-rose-200/70 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2 text-[#7b1523]">
                        <span className="material-symbols-outlined text-2xl">menu_book</span>
                        <h4 className="text-sm font-black uppercase">Consolidado General (Todas las Sedes)</h4>
                      </div>
                      <p className="text-xs text-slate-600 mb-4">
                        Genera un PDF íntegro paginado que incluye todas las filiales ({sedesDisponibles.join(', ')}) ordenadas por Área y Escuela Profesional con sus respectivos cuadros de méritos.
                      </p>
                    </div>
                    <button
                      onClick={handleExportarConsolidadoGeneral}
                      disabled={generatingPdf}
                      className="w-full py-3 px-4 rounded-xl bg-[#7b1523] hover:bg-[#66101c] text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all"
                    >
                      <span className="material-symbols-outlined text-base">download</span>
                      <span>{generatingPdf ? 'Generando PDF...' : 'Descargar Consolidado General (PDF)'}</span>
                    </button>
                  </div>

                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2 text-slate-800">
                        <span className="material-symbols-outlined text-2xl">table_chart</span>
                        <h4 className="text-sm font-black uppercase">Exportación a Hoja de Cálculo</h4>
                      </div>
                      <p className="text-xs text-slate-600 mb-4">
                        Descarga la matriz íntegra de postulantes con nota base, bonificación, nota final, condición y orden de mérito en formato Microsoft Excel (.xlsx).
                      </p>
                    </div>
                    <button
                      onClick={handleExportarExcel}
                      className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all"
                    >
                      <span className="material-symbols-outlined text-base">file_download</span>
                      <span>Descargar Libro Excel (.xlsx)</span>
                    </button>
                  </div>
                </div>

                <div className="mb-6">
                  <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider mb-3">
                    Reporte Individual por Filial / Sede
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {sedesDisponibles.map(sede => {
                      const count = resultados.filter(r => r.sede.toUpperCase() === sede).length;
                      return (
                        <div key={sede} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between hover:border-[#7b1523] transition-colors">
                          <div className="mb-3">
                            <span className="text-[10px] font-black uppercase text-slate-400">Filial</span>
                            <h5 className="text-sm font-black text-slate-800 uppercase">{sede}</h5>
                            <p className="text-xs text-slate-500">{count} postulantes</p>
                          </div>
                          <button
                            onClick={() => handleExportarFilialPDF(sede)}
                            disabled={generatingPdf || count === 0}
                            className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-[#7b1523] hover:text-white text-slate-700 font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                            <span>Descargar PDF</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ========================================================= */}
        {/* MODAL DIÁLOGO: POSTULANTES NO REGISTRADOS DETECTADOS */}
        {/* ========================================================= */}
        {showUnregisteredModal && (
          <div className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-amber-300 animate-scale-up space-y-6">
              
              <div className="flex items-start gap-4">
                <div className="size-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-3xl">warning</span>
                </div>
                <div>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-extrabold text-[10px] uppercase tracking-wider">
                    Comparación con Padrón Oficial
                  </span>
                  <h3 className="text-base sm:text-lg font-black uppercase text-slate-900 mt-1">
                    Se detectaron {unregisteredPostulantes.length} postulantes no registrados en el padrón
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    El archivo contiene postulantes evaluados con DNI y Sede que <strong>NO figuran en la lista de inscritos</strong> de este simulacro. Para que la calificación sea oficial, ¿deseas registrarlos formalmente en el padrón (<code>simulacro_postulantes</code>)?
                  </p>
                </div>
              </div>

              {/* Lista previa de los postulantes no registrados */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wider sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">DNI</th>
                      <th className="py-2.5 px-3">Apellidos y Nombres</th>
                      <th className="py-2.5 px-3">Sede Confirmada</th>
                      <th className="py-2.5 px-3">Carrera</th>
                      <th className="py-2.5 px-3 text-center">Área</th>
                      <th className="py-2.5 px-3 text-center">Nota</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {unregisteredPostulantes.map((p, idx) => (
                      <tr key={idx} className="hover:bg-amber-50/40">
                        <td className="py-2 px-3 font-mono font-bold text-slate-900">{p.dni}</td>
                        <td className="py-2 px-3 font-bold uppercase text-slate-800">{p.nombres_apellidos}</td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold text-[10px] uppercase">
                            {p.sede}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-600 uppercase truncate max-w-[150px]">{p.carrera}</td>
                        <td className="py-2 px-3 text-center font-bold">{p.grupo}</td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-emerald-700">{p.nota}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Botones de decisión */}
              <div className="space-y-3 pt-2">
                <button
                  onClick={handleConfirmarRegistroNuevosPostulantes}
                  disabled={isRegisteringPending}
                  className="w-full py-3.5 px-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/20 active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-lg">how_to_reg</span>
                  <span>
                    {isRegisteringPending 
                      ? 'Registrando en padrón oficial...' 
                      : `1. Registrar ${unregisteredPostulantes.length} postulantes en el Padrón Oficial y Calificar`
                    }
                  </span>
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={handleOmitirNoRegistrados}
                    className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">filter_alt</span>
                    <span>Omitir (Calificar solo el padrón de {padron.length})</span>
                  </button>

                  <button
                    onClick={handleCancelarCarga}
                    className="py-2.5 px-4 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">close</span>
                    <span>Cancelar Carga</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
