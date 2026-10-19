import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { User, Simulacro, SimulacroPostulante } from '../types';
import { printTicket80mm, getAvailablePrinters, getSavedPrinterName, savePrinterName } from '../lib/ticketPrinter';
import { playSuccessSound, playErrorSound, playWarningSound } from '../lib/kioskAudio';

interface PostulantEntryControlProps {
  user: User;
  notify?: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

type ScanStatus = 'idle' | 'success' | 'duplicate' | 'error';

interface ScanResult {
  status: ScanStatus;
  postulante?: SimulacroPostulante;
  scannedDni?: string;
  timestamp?: string;
  message?: string;
}

const LOCAL_SIMULACROS_KEY = 'unsaac_simulacros_cache';
const getKioskPadronKey = (id: string) => `kiosk_padron_${id}`;
const getKioskQueueKey = (id: string) => `kiosk_pending_sync_${id}`;

export const PostulantEntryControl: React.FC<PostulantEntryControlProps> = ({ user, notify }) => {
  // --- ESTADO GENERAL ---
  const [simulacros, setSimulacros] = useState<Simulacro[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSimulacro, setActiveSimulacro] = useState<Simulacro | null>(null);
  const [isKioskMode, setIsKioskMode] = useState(false);

  // --- MODALES GESTIÓN ---
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSimulacroNombre, setNewSimulacroNombre] = useState('');
  const [newSimulacroFecha, setNewSimulacroFecha] = useState(() => new Date().toISOString().split('T')[0]);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [selectedSimulacroForCsv, setSelectedSimulacroForCsv] = useState<string>('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);
  const [showPadronModal, setShowPadronModal] = useState(false);
  const [padronList, setPadronList] = useState<SimulacroPostulante[]>([]);
  const [padronFilter, setPadronFilter] = useState('');
  const [padronIngresoFilter, setPadronIngresoFilter] = useState<'all' | 'ingresados' | 'pendientes'>('all');
  const [padronSedeFilter, setPadronSedeFilter] = useState<string>('all');

  // --- ESTADO KIOSKO ---
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [padronMap, setPadronMap] = useState<Map<string, SimulacroPostulante>>(new Map());
  const [totalInscritos, setTotalInscritos] = useState(0);
  const [totalIngresados, setTotalIngresados] = useState(0);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [currentScan, setCurrentScan] = useState<ScanResult>({ status: 'idle' });
  const [recentScans, setRecentScans] = useState<SimulacroPostulante[]>([]);
  const [autoPrintTicket, setAutoPrintTicket] = useState(true);
  const [isManualInputOpen, setIsManualInputOpen] = useState(false);
  const [manualDni, setManualDni] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [kioskClock, setKioskClock] = useState(() => new Date().toLocaleTimeString('es-PE', { hour12: false }));
  const [showSedesDrawer, setShowSedesDrawer] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // --- CONFIGURACIÓN DE IMPRESORA TÉRMICA Y MODO KIOSKO ---
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [availablePrinters, setAvailablePrinters] = useState<Array<{ name: string; isDefault: boolean; displayName?: string }>>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>(() => getSavedPrinterName() || '');
  const [isTestingPrinter, setIsTestingPrinter] = useState(false);
  const [isElectronEnv, setIsElectronEnv] = useState(false);
  const [showTicketVisualPreview, setShowTicketVisualPreview] = useState(false);

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const focusIntervalRef = useRef<any>(null);

  // Detección inicial de entorno e impresoras
  useEffect(() => {
    const isElectron = typeof window !== 'undefined' && Boolean((window as any).electronAPI);
    setIsElectronEnv(isElectron);
    if (isElectron) {
      getAvailablePrinters().then(printers => {
        setAvailablePrinters(printers);
        const saved = getSavedPrinterName();
        if (!saved && printers.length > 0) {
          const thermal = printers.find(p => /pos|thermal|ticket|tp-?300|80mm/i.test(p.name));
          const def = printers.find(p => p.isDefault);
          const chosen = thermal?.name || def?.name || printers[0].name;
          if (chosen) {
            setSelectedPrinter(chosen);
            savePrinterName(chosen);
          }
        }
      });
    }
  }, []);

  const handleSelectPrinter = (name: string) => {
    setSelectedPrinter(name);
    savePrinterName(name);
    notify?.(`Impresora térmica asignada: ${name || 'Predeterminada de Windows'}`, 'success');
  };

  const handlePrintTestTicket = async () => {
    setIsTestingPrinter(true);
    try {
      await printTicket80mm(
        {
          dni: '00000000',
          nombres_apellidos: 'POSTULANTE DE PRUEBA 80MM',
          sede: 'SEDE CENTRAL',
          aula: 'AULA PILOTO 101',
          carpeta: '01',
          carrera: 'PRUEBA IMPRESIÓN TÉRMICA SILENCIOSA',
          grupo: 'A',
          hora_ingreso: new Date().toISOString()
        },
        activeSimulacro?.nombre || 'SIMULACRO TEST HARDWARE',
        selectedPrinter || undefined
      );
      notify?.('Ticket de prueba enviado a la impresora.', 'info');
    } catch (err: any) {
      notify?.(`Error en ticket de prueba: ${err.message}`, 'error');
    } finally {
      setIsTestingPrinter(false);
    }
  };

  const handleDownloadKioskBat = () => {
    const batContent = `@echo off\r\ntitle Kiosko UNSAAC - Impresion Termica Silenciosa\r\necho =====================================================================\r\necho  DIRECCION DE ADMISION UNSAAC - CONTROL DE INGRESO (KIOSKO)\r\necho  Iniciando Google Chrome con bandera --kiosk-printing...\r\necho =====================================================================\r\necho.\r\necho Con este modo:\r\necho  1. Chrome envia los tickets directamente a la ticketera POS-D 80mm.\r\necho  2. NO se muestra ventana de vista previa ni confirmacion de impresion.\r\necho  3. Tiempo de impresion: ~0.2 segundos por postulante.\r\necho.\r\n\r\nset CHROME_PATH=""\r\nif exist "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" (\r\n    set CHROME_PATH="%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe"\r\n) else if exist "%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe" (\r\n    set CHROME_PATH="%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe"\r\n) else if exist "%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe" (\r\n    set CHROME_PATH="%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe"\r\n)\r\n\r\nif %CHROME_PATH%=="" (\r\n    start chrome --kiosk-printing "http://localhost:3000/#/entry-control"\r\n) else (\r\n    start "" %CHROME_PATH% --kiosk-printing "http://localhost:3000/#/entry-control"\r\n)\r\n`;
    const blob = new Blob([batContent], { type: 'application/x-bat' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'iniciar_kiosko_web.bat';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify?.('Archivo iniciar_kiosko_web.bat generado y descargado.', 'success');
  };

  const executeTicketPrint = useCallback((postulante: SimulacroPostulante) => {
    if (!activeSimulacro) return;
    setIsPrinting(true);
    printTicket80mm(postulante, activeSimulacro.nombre, selectedPrinter || undefined)
      .catch(err => {
        console.error('Error al imprimir ticket:', err);
      })
      .finally(() => {
        setTimeout(() => setIsPrinting(false), 1200);
      });
  }, [activeSimulacro, selectedPrinter]);

  // =========================================================================
  // CARGA INICIAL Y DATOS DE SIMULACROS
  // =========================================================================

  const loadSimulacros = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Intentar backend service_role API
      const res = await fetch('/api/simulacros');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setSimulacros(json.data);
          try {
            localStorage.setItem(LOCAL_SIMULACROS_KEY, JSON.stringify(json.data));
          } catch (e) {}
          setLoading(false);
          return;
        }
      }
    } catch (e) {
      console.warn('Backend API /api/simulacros no disponible, probando cliente Supabase...');
    }

    // 2. Fallback cliente Supabase
    try {
      const { data: dbSims, error } = await supabase
        .from('simulacros')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && dbSims) {
        // Enriquecer con conteos y desglose de sede si es posible
        const enriched = await Promise.all(
          dbSims.map(async (s: any) => {
            try {
              const { data: postulantes } = await supabase
                .from('simulacro_postulantes')
                .select('sede, ingreso_registrado')
                .eq('simulacro_id', s.id);

              const sedesStats: Record<string, { total: number; ingresados: number }> = {};
              let tot = 0;
              let ing = 0;

              (postulantes || []).forEach((p: any) => {
                tot++;
                const sName = String(p.sede || 'SEDE CENTRAL').trim().toUpperCase() || 'SEDE CENTRAL';
                if (!sedesStats[sName]) {
                  sedesStats[sName] = { total: 0, ingresados: 0 };
                }
                sedesStats[sName].total++;
                if (p.ingreso_registrado) {
                  ing++;
                  sedesStats[sName].ingresados++;
                }
              });

              return {
                ...s,
                total_postulantes: tot,
                total_ingresados: ing,
                sedes_stats: sedesStats,
              };
            } catch (err) {
              return { ...s, total_postulantes: 0, total_ingresados: 0, sedes_stats: {} };
            }
          })
        );
        setSimulacros(enriched);
        try {
          localStorage.setItem(LOCAL_SIMULACROS_KEY, JSON.stringify(enriched));
        } catch (e) {}
        setLoading(false);
        return;
      }
    } catch (e) {
      console.warn('Supabase client error:', e);
    }

    // 3. Fallback Almacenamiento Local
    try {
      const saved = localStorage.getItem(LOCAL_SIMULACROS_KEY);
      if (saved) {
        setSimulacros(JSON.parse(saved));
      }
    } catch (e) {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSimulacros();
  }, [loadSimulacros]);

  // Listener para estado de conexión
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (activeSimulacro) {
        triggerSyncQueue(activeSimulacro.id);
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [activeSimulacro]);

  // Reloj de la barra de Kiosko
  useEffect(() => {
    if (!isKioskMode) return;
    const timer = setInterval(() => {
      setKioskClock(new Date().toLocaleTimeString('es-PE', { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, [isKioskMode]);

  // Desglose reactivo por sedes calculado en tiempo real en memoria RAM (< 1ms)
  const kioskSedesStats = useMemo(() => {
    const stats: Record<string, { total: number; ingresados: number }> = {};
    padronMap.forEach(p => {
      const sName = String(p.sede || 'SEDE CENTRAL').trim().toUpperCase() || 'SEDE CENTRAL';
      if (!stats[sName]) {
        stats[sName] = { total: 0, ingresados: 0 };
      }
      stats[sName].total++;
      if (p.ingreso_registrado) {
        stats[sName].ingresados++;
      }
    });
    return stats;
  }, [padronMap]);

  // =========================================================================
  // GESTIÓN DE SIMULACROS (CREACIÓN / EDICIÓN / ELIMINACIÓN)
  // =========================================================================

  const handleCreateSimulacro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSimulacroNombre.trim()) {
      notify?.('Por favor ingresa el nombre del simulacro', 'warning');
      return;
    }

    const payload = {
      nombre: newSimulacroNombre.trim().toUpperCase(),
      fecha: newSimulacroFecha,
      estado: 'Activo' as const,
    };

    let created: Simulacro | null = null;

    try {
      const res = await fetch('/api/simulacros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) created = json.data;
      }
    } catch (e) {}

    if (!created) {
      try {
        const { data, error } = await supabase.from('simulacros').insert([payload]).select().single();
        if (!error && data) created = { ...data, total_postulantes: 0, total_ingresados: 0, sedes_stats: {} };
      } catch (e) {}
    }

    if (!created) {
      created = {
        id: 'local_' + Date.now(),
        nombre: payload.nombre,
        fecha: payload.fecha,
        estado: 'Activo',
        created_at: new Date().toISOString(),
        total_postulantes: 0,
        total_ingresados: 0,
        sedes_stats: {},
      };
    }

    setSimulacros(prev => [created!, ...prev]);
    try {
      const current = JSON.parse(localStorage.getItem(LOCAL_SIMULACROS_KEY) || '[]');
      localStorage.setItem(LOCAL_SIMULACROS_KEY, JSON.stringify([created, ...current]));
    } catch (e) {}

    notify?.(`Simulacro "${created.nombre}" creado exitosamente`, 'success');
    setNewSimulacroNombre('');
    setShowCreateModal(false);
  };

  const handleDeleteSimulacro = async (sim: Simulacro) => {
    if (!confirm(`¿Estás seguro de eliminar el simulacro "${sim.nombre}" y todos sus postulantes?`)) return;

    try {
      await fetch(`/api/simulacros/${sim.id}`, { method: 'DELETE' });
    } catch (e) {}
    try {
      await supabase.from('simulacro_postulantes').delete().eq('simulacro_id', sim.id);
      await supabase.from('simulacros').delete().eq('id', sim.id);
    } catch (e) {}

    try {
      localStorage.removeItem(getKioskPadronKey(sim.id));
      localStorage.removeItem(getKioskQueueKey(sim.id));
    } catch (e) {}

    setSimulacros(prev => prev.filter(s => s.id !== sim.id));
    notify?.('Simulacro eliminado', 'info');
  };

  const handleToggleEstado = async (sim: Simulacro) => {
    const nextEstado: Simulacro['estado'] =
      sim.estado === 'Activo' ? 'En Curso' : sim.estado === 'En Curso' ? 'Finalizado' : 'Activo';

    try {
      await fetch(`/api/simulacros/${sim.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nextEstado }),
      });
    } catch (e) {}
    try {
      await supabase.from('simulacros').update({ estado: nextEstado }).eq('id', sim.id);
    } catch (e) {}

    setSimulacros(prev => prev.map(s => (s.id === sim.id ? { ...s, estado: nextEstado } : s)));
    notify?.(`Estado actualizado a: ${nextEstado}`, 'info');
  };

  // =========================================================================
  // CARGA Y PARSEO DE CSV (CON CAMPO UNIFICADO NOMBRES_APELLIDOS Y CARRERA)
  // =========================================================================

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = event => {
      const text = event.target?.result as string;
      if (!text) return;
      const parsed = parseCsvContent(text);
      setCsvPreview(parsed.slice(0, 5));
    };
    reader.readAsText(file);
  };

  const parseCsvContent = (text: string): SimulacroPostulante[] => {
    const lines = text.split(/\r\n|\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) return [];

    const headerLine = lines[0];
    const separator = headerLine.includes(';') ? ';' : ',';

    const headers = headerLine
      .split(separator)
      .map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, '').replace(/[\s_-]+/g, '_'));

    const findIndex = (aliases: string[]) => {
      return headers.findIndex(h => aliases.some(a => h === a || h.includes(a)));
    };

    const idxDni = findIndex(['dni', 'documento', 'identidad', 'doc', 'codigo']);
    // Detección de campo único de nombres y apellidos
    const idxNombresApellidos = findIndex([
      'nombres_apellidos',
      'apellidos_y_nombres',
      'apellidos_nombres',
      'nombres_y_apellidos',
      'nombre_completo',
      'postulante',
      'estudiante',
      'alumno',
      'datos'
    ]);
    const idxApellidos = findIndex(['apellidos', 'apellido', 'paterno']);
    const idxNombres = findIndex(['nombres', 'nombre']);
    const idxSede = findIndex(['sede', 'local', 'campus', 'filial']);
    const idxAula = findIndex(['aula', 'salon', 'ambiente', 'salon_evaluacion']);
    const idxCarpeta = findIndex(['carpeta', 'asiento', 'mesa', 'nro_carpeta', 'n_carpeta', 'ubicacion']);
    // Detección robusta de carrera a la que postula
    const idxCarrera = findIndex([
      'carrera',
      'carreras',
      'carrera_postula',
      'carrera_profesional',
      'programa',
      'especialidad',
      'escuela',
      'opcion',
      'profesion'
    ]);
    const idxGrupo = findIndex(['grupo', 'area', 'canal']);

    const postulantes: SimulacroPostulante[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols: string[] = [];
      let inQuotes = false;
      let cur = '';
      for (let c = 0; c < line.length; c++) {
        const char = line[c];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === separator && !inQuotes) {
          cols.push(cur.trim().replace(/^["']|["']$/g, ''));
          cur = '';
        } else {
          cur += char;
        }
      }
      cols.push(cur.trim().replace(/^["']|["']$/g, ''));

      const dni = (idxDni >= 0 ? cols[idxDni] : cols[0])?.trim() || '';
      if (!dni || dni.length < 5) continue;

      // Obtener nombre unificado
      let fullNombre = '';
      if (idxNombresApellidos >= 0 && cols[idxNombresApellidos]?.trim()) {
        fullNombre = cols[idxNombresApellidos].trim().toUpperCase();
      } else {
        const ap = (idxApellidos >= 0 ? cols[idxApellidos] : '')?.trim().toUpperCase() || '';
        const nom = (idxNombres >= 0 ? cols[idxNombres] : '')?.trim().toUpperCase() || '';
        fullNombre = [ap, nom].filter(Boolean).join(' ') || 'SIN NOMBRE';
      }

      // Obtener carrera
      const carrera = (idxCarrera >= 0 ? cols[idxCarrera] : '')?.trim().toUpperCase() || '';

      postulantes.push({
        simulacro_id: selectedSimulacroForCsv,
        dni: dni,
        nombres_apellidos: fullNombre,
        apellidos: fullNombre, // Compatibilidad con BD si aún tiene columna apellidos
        nombres: '',
        sede: (idxSede >= 0 ? cols[idxSede] : 'SEDE CENTRAL')?.trim().toUpperCase() || 'SEDE CENTRAL',
        aula: (idxAula >= 0 ? cols[idxAula] : '')?.trim().toUpperCase() || '',
        carpeta: (idxCarpeta >= 0 ? cols[idxCarpeta] : '')?.trim().toUpperCase() || '',
        carrera: carrera,
        grupo: (idxGrupo >= 0 ? cols[idxGrupo] : 'ÚNICO')?.trim().toUpperCase() || 'ÚNICO',
        ingreso_registrado: false,
        hora_ingreso: null,
      });
    }

    return postulantes;
  };

  const handleProcessCsvUpload = async () => {
    if (!selectedSimulacroForCsv) {
      notify?.('Selecciona el simulacro de destino', 'warning');
      return;
    }
    if (!csvFile) {
      notify?.('Selecciona un archivo CSV', 'warning');
      return;
    }

    setIsUploadingCsv(true);
    try {
      const text = await csvFile.text();
      const postulantes = parseCsvContent(text).map(p => ({
        ...p,
        simulacro_id: selectedSimulacroForCsv,
      }));

      if (postulantes.length === 0) {
        notify?.('No se encontraron registros válidos con DNI en el archivo CSV', 'error');
        setIsUploadingCsv(false);
        return;
      }

      let uploadedSuccessfully = false;

      // 1. Intentar API backend bulk
      try {
        const res = await fetch(`/api/simulacros/${selectedSimulacroForCsv}/postulantes/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postulantes }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success) uploadedSuccessfully = true;
        }
      } catch (e) {
        console.warn('Backend bulk upload no disponible, intentando Supabase directo...');
      }

      // 2. Intentar Supabase en chunks
      if (!uploadedSuccessfully) {
        try {
          const chunkSize = 200;
          for (let i = 0; i < postulantes.length; i += chunkSize) {
            const chunk = postulantes.slice(i, i + chunkSize);
            const { error } = await supabase.from('simulacro_postulantes').upsert(chunk, {
              onConflict: 'simulacro_id,dni',
            });
            if (error) {
              // Si la columna nombres_apellidos aún no fue agregada en Supabase, reintentar sin ella
              if (error.message?.includes('nombres_apellidos')) {
                const fallbackChunk = chunk.map(({ nombres_apellidos, ...rest }: any) => rest);
                await supabase.from('simulacro_postulantes').upsert(fallbackChunk, {
                  onConflict: 'simulacro_id,dni',
                });
              } else {
                throw error;
              }
            }
          }
          uploadedSuccessfully = true;
        } catch (e) {
          console.warn('Supabase direct upload warning:', e);
        }
      }

      // 3. Almacenar siempre en caché local de Kiosko
      try {
        const existingKey = getKioskPadronKey(selectedSimulacroForCsv);
        const map = new Map<string, SimulacroPostulante>();
        const prevData = localStorage.getItem(existingKey);
        if (prevData) {
          const parsed = JSON.parse(prevData);
          if (Array.isArray(parsed)) {
            parsed.forEach((p: SimulacroPostulante) => map.set(p.dni.trim(), p));
          }
        }
        postulantes.forEach(p => map.set(p.dni.trim(), p));
        localStorage.setItem(existingKey, JSON.stringify(Array.from(map.values())));
      } catch (e) {}

      notify?.(`¡Se cargaron ${postulantes.length} postulantes exitosamente con su carrera y sede!`, 'success');
      setShowCsvModal(false);
      setCsvFile(null);
      setCsvPreview([]);
      loadSimulacros();
    } catch (err: any) {
      console.error(err);
      notify?.(`Error al procesar el archivo CSV: ${err.message}`, 'error');
    } finally {
      setIsUploadingCsv(false);
    }
  };

  // =========================================================================
  // VER PADRÓN DE UN SIMULACRO
  // =========================================================================

  const handleOpenPadronModal = async (sim: Simulacro) => {
    setActiveSimulacro(sim);
    setShowPadronModal(true);
    setPadronList([]);
    setPadronSedeFilter('all');

    // 1. Intentar API backend
    try {
      const res = await fetch(`/api/simulacros/${sim.id}/postulantes`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setPadronList(json.data);
          return;
        }
      }
    } catch (e) {}

    // 2. Intentar Supabase
    try {
      const { data, error } = await supabase
        .from('simulacro_postulantes')
        .select('*')
        .eq('simulacro_id', sim.id)
        .order('dni', { ascending: true });

      if (!error && data && data.length > 0) {
        const normalized = data.map((p: any) => ({
          ...p,
          nombres_apellidos: p.nombres_apellidos || [p.apellidos, p.nombres].filter(Boolean).join(' ') || 'SIN NOMBRE',
        }));
        setPadronList(normalized);
        return;
      }
    } catch (e) {}

    // 3. Fallback caché local
    try {
      const saved = localStorage.getItem(getKioskPadronKey(sim.id));
      if (saved) {
        setPadronList(JSON.parse(saved));
      }
    } catch (e) {}
  };

  // Extraer sedes únicas del padrón actual
  const padronUniqueSedes = useMemo(() => {
    const sSet = new Set<string>();
    padronList.forEach(p => {
      sSet.add(String(p.sede || 'SEDE CENTRAL').trim().toUpperCase() || 'SEDE CENTRAL');
    });
    return Array.from(sSet).sort();
  }, [padronList]);

  const filteredPadron = useMemo(() => {
    return padronList.filter(p => {
      const fullName = p.nombres_apellidos || [p.apellidos, p.nombres].filter(Boolean).join(' ');
      const matchesSearch =
        !padronFilter ||
        p.dni.toLowerCase().includes(padronFilter.toLowerCase()) ||
        fullName.toLowerCase().includes(padronFilter.toLowerCase()) ||
        (p.aula && p.aula.toLowerCase().includes(padronFilter.toLowerCase())) ||
        (p.carrera && p.carrera.toLowerCase().includes(padronFilter.toLowerCase())) ||
        (p.sede && p.sede.toLowerCase().includes(padronFilter.toLowerCase()));

      const matchesStatus =
        padronIngresoFilter === 'all' ||
        (padronIngresoFilter === 'ingresados' && p.ingreso_registrado) ||
        (padronIngresoFilter === 'pendientes' && !p.ingreso_registrado);

      const pSede = String(p.sede || 'SEDE CENTRAL').trim().toUpperCase() || 'SEDE CENTRAL';
      const matchesSede = padronSedeFilter === 'all' || pSede === padronSedeFilter;

      return matchesSearch && matchesStatus && matchesSede;
    });
  }, [padronList, padronFilter, padronIngresoFilter, padronSedeFilter]);

  const handleExportPadronCsv = () => {
    if (!activeSimulacro || padronList.length === 0) return;
    const headers = ['DNI', 'NOMBRES_APELLIDOS', 'SEDE', 'AULA', 'CARPETA', 'CARRERA', 'GRUPO', 'INGRESO_REGISTRADO', 'HORA_INGRESO'];
    const rows = padronList.map(p => [
      `"${p.dni}"`,
      `"${p.nombres_apellidos || [p.apellidos, p.nombres].filter(Boolean).join(' ')}"`,
      `"${p.sede || 'SEDE CENTRAL'}"`,
      `"${p.aula || ''}"`,
      `"${p.carpeta || ''}"`,
      `"${p.carrera || ''}"`,
      `"${p.grupo || ''}"`,
      p.ingreso_registrado ? 'SI' : 'NO',
      `"${p.hora_ingreso || ''}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PADRON_${activeSimulacro.nombre.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClearPadron = async () => {
    if (!activeSimulacro) return;
    if (!confirm(`¿Estás seguro de ELIMINAR TODO EL PADRÓN de "${activeSimulacro.nombre}"?`)) return;

    try {
      await fetch(`/api/simulacros/${activeSimulacro.id}/postulantes`, { method: 'DELETE' });
    } catch (e) {}
    try {
      await supabase.from('simulacro_postulantes').delete().eq('simulacro_id', activeSimulacro.id);
    } catch (e) {}

    localStorage.removeItem(getKioskPadronKey(activeSimulacro.id));
    setPadronList([]);
    setSimulacros(prev =>
      prev.map(s => (s.id === activeSimulacro.id ? { ...s, total_postulantes: 0, total_ingresados: 0, sedes_stats: {} } : s))
    );
    notify?.('Padrón vaciado correctamente', 'info');
  };

  // =========================================================================
  // VISTA 2: MODO KIOSKO DE ACCESO
  // =========================================================================

  const startKioskMode = async (sim: Simulacro) => {
    setActiveSimulacro(sim);
    setCurrentScan({ status: 'idle' });
    setBarcodeInput('');
    setRecentScans([]);
    setShowSedesDrawer(false);

    let list: SimulacroPostulante[] = [];

    // 1. Intentar backend
    try {
      const res = await fetch(`/api/simulacros/${sim.id}/postulantes`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          list = json.data;
        }
      }
    } catch (e) {}

    // 2. Intentar Supabase
    if (list.length === 0) {
      try {
        const { data, error } = await supabase
          .from('simulacro_postulantes')
          .select('*')
          .eq('simulacro_id', sim.id);
        if (!error && data && data.length > 0) {
          list = data.map((p: any) => ({
            ...p,
            nombres_apellidos: p.nombres_apellidos || [p.apellidos, p.nombres].filter(Boolean).join(' ') || 'SIN NOMBRE',
          }));
        }
      } catch (e) {}
    }

    // 3. Fallback caché local
    if (list.length === 0) {
      try {
        const saved = localStorage.getItem(getKioskPadronKey(sim.id));
        if (saved) {
          list = JSON.parse(saved);
        }
      } catch (e) {}
    }

    try {
      localStorage.setItem(getKioskPadronKey(sim.id), JSON.stringify(list));
    } catch (e) {}

    // Estructurar Map en memoria RAM para búsqueda < 1ms
    const newMap = new Map<string, SimulacroPostulante>();
    let enteredCount = 0;
    const initialRecents: SimulacroPostulante[] = [];

    list.forEach(p => {
      const key = String(p.dni || '').trim();
      const normalizedP = {
        ...p,
        nombres_apellidos: p.nombres_apellidos || [p.apellidos, p.nombres].filter(Boolean).join(' ') || 'SIN NOMBRE',
        carrera: p.carrera || '',
        sede: String(p.sede || 'SEDE CENTRAL').trim().toUpperCase() || 'SEDE CENTRAL',
      };
      newMap.set(key, normalizedP);
      if (normalizedP.ingreso_registrado) {
        enteredCount++;
        initialRecents.push(normalizedP);
      }
    });

    setPadronMap(newMap);
    setTotalInscritos(list.length);
    setTotalIngresados(enteredCount);
    setRecentScans(
      initialRecents
        .sort((a, b) => new Date(b.hora_ingreso || 0).getTime() - new Date(a.hora_ingreso || 0).getTime())
        .slice(0, 8)
    );

    try {
      const queueRaw = localStorage.getItem(getKioskQueueKey(sim.id));
      if (queueRaw) {
        const queue = JSON.parse(queueRaw);
        setPendingSyncCount(Array.isArray(queue) ? queue.length : 0);
      } else {
        setPendingSyncCount(0);
      }
    } catch (e) {
      setPendingSyncCount(0);
    }

    setIsKioskMode(true);
  };

  const exitKioskMode = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    setIsFullscreen(false);
    setIsKioskMode(false);
    setCurrentScan({ status: 'idle' });
    loadSimulacros();
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Mantener autofocus permanente en el input de código de barras
  useEffect(() => {
    if (!isKioskMode) return;

    const focusInput = () => {
      if (!isManualInputOpen && barcodeInputRef.current) {
        barcodeInputRef.current.focus();
      }
    };

    focusInput();
    focusIntervalRef.current = setInterval(focusInput, 200);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isManualInputOpen) {
          setIsManualInputOpen(false);
        } else {
          exitKioskMode();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      if (focusIntervalRef.current) clearInterval(focusIntervalRef.current);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isKioskMode, isManualInputOpen]);

  // Sincronización asíncrona periódica de la cola offline
  useEffect(() => {
    if (!isKioskMode || !activeSimulacro) return;

    const syncInterval = setInterval(() => {
      if (navigator.onLine) {
        triggerSyncQueue(activeSimulacro.id);
      }
    }, 5000);

    return () => clearInterval(syncInterval);
  }, [isKioskMode, activeSimulacro]);

  const triggerSyncQueue = async (simulacroId: string) => {
    try {
      const queueKey = getKioskQueueKey(simulacroId);
      const queueRaw = localStorage.getItem(queueKey);
      if (!queueRaw) return;
      const queue: { dni: string; hora_ingreso: string }[] = JSON.parse(queueRaw);
      if (!Array.isArray(queue) || queue.length === 0) {
        setPendingSyncCount(0);
        return;
      }

      let synced = false;
      try {
        const res = await fetch(`/api/simulacros/${simulacroId}/postulantes/sync-batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entries: queue }),
        });
        if (res.ok) {
          synced = true;
        }
      } catch (e) {}

      if (!synced) {
        try {
          for (const item of queue) {
            await supabase
              .from('simulacro_postulantes')
              .update({ ingreso_registrado: true, hora_ingreso: item.hora_ingreso })
              .eq('simulacro_id', simulacroId)
              .eq('dni', item.dni);
          }
          synced = true;
        } catch (e) {}
      }

      if (synced) {
        localStorage.removeItem(queueKey);
        setPendingSyncCount(0);
      }
    } catch (e) {
      console.warn('Sync queue error:', e);
    }
  };

  // =========================================================================
  // NÚCLEO DE PROCESAMIENTO DE ESCANEO / LECTURA DE DNI (< 1ms)
  // =========================================================================

  const processScannedDni = (rawDni: string) => {
    if (!activeSimulacro) return;

    const cleanDni = rawDni.trim().replace(/[^0-9a-zA-Z]/g, '');
    if (!cleanDni) return;

    const now = new Date();
    const isoString = now.toISOString();

    // 1. BÚSQUEDA INSTANTÁNEA EN RAM (< 1ms)
    const postulante = padronMap.get(cleanDni);

    if (!postulante) {
      playErrorSound();
      setCurrentScan({
        status: 'error',
        scannedDni: cleanDni,
        timestamp: now.toLocaleTimeString('es-PE', { hour12: false }),
        message: 'NO ES UN POSTULANTE INSCRITO',
      });
      return;
    }

    if (postulante.ingreso_registrado) {
      playWarningSound();
      const prevHora = postulante.hora_ingreso
        ? new Date(postulante.hora_ingreso).toLocaleTimeString('es-PE', { hour12: false })
        : 'HORA NO REGISTRADA';

      setCurrentScan({
        status: 'duplicate',
        postulante: postulante,
        scannedDni: cleanDni,
        timestamp: prevHora,
        message: `YA INGRESÓ A LAS ${prevHora}`,
      });
      return;
    }

    // ✔ INGRESO EXITOSO Y VÁLIDO
    postulante.ingreso_registrado = true;
    postulante.hora_ingreso = isoString;

    // Actualizar Map en RAM
    padronMap.set(cleanDni, { ...postulante });
    setPadronMap(new Map(padronMap));
    setTotalIngresados(prev => prev + 1);

    // Actualizar copia local en localStorage
    try {
      localStorage.setItem(getKioskPadronKey(activeSimulacro.id), JSON.stringify(Array.from(padronMap.values())));
    } catch (e) {}

    // Agregar a la cola de sincronización asíncrona
    try {
      const queueKey = getKioskQueueKey(activeSimulacro.id);
      const queue: { dni: string; hora_ingreso: string }[] = JSON.parse(localStorage.getItem(queueKey) || '[]');
      queue.push({ dni: cleanDni, hora_ingreso: isoString });
      localStorage.setItem(queueKey, JSON.stringify(queue));
      setPendingSyncCount(queue.length);
    } catch (e) {}

    // Disparar sincronización inmediata en segundo plano
    if (navigator.onLine) {
      (async () => {
        try {
          const res = await fetch(`/api/simulacros/${activeSimulacro.id}/postulantes/${cleanDni}/ingreso`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hora_ingreso: isoString }),
          });
          if (res.ok) {
            const queueKey = getKioskQueueKey(activeSimulacro.id);
            const q: any[] = JSON.parse(localStorage.getItem(queueKey) || '[]');
            const updatedQ = q.filter(item => item.dni !== cleanDni);
            localStorage.setItem(queueKey, JSON.stringify(updatedQ));
            setPendingSyncCount(updatedQ.length);
            return;
          }
        } catch (e) {}

        try {
          await supabase
            .from('simulacro_postulantes')
            .update({ ingreso_registrado: true, hora_ingreso: isoString })
            .eq('simulacro_id', activeSimulacro.id)
            .eq('dni', cleanDni);
          const queueKey = getKioskQueueKey(activeSimulacro.id);
          const q: any[] = JSON.parse(localStorage.getItem(queueKey) || '[]');
          const updatedQ = q.filter(item => item.dni !== cleanDni);
          localStorage.setItem(queueKey, JSON.stringify(updatedQ));
          setPendingSyncCount(updatedQ.length);
        } catch (e) {}
      })();
    }

    playSuccessSound();

    setCurrentScan({
      status: 'success',
      postulante: { ...postulante },
      scannedDni: cleanDni,
      timestamp: now.toLocaleTimeString('es-PE', { hour12: false }),
      message: 'INGRESO REGISTRADO EXITOSAMENTE',
    });

    setRecentScans(prev => [postulante, ...prev.filter(p => p.dni !== cleanDni)].slice(0, 8));

    if (autoPrintTicket) {
      executeTicketPrint(postulante);
    }
  };

  const handleBarcodeInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = barcodeInput.trim();
      if (code) {
        processScannedDni(code);
        setBarcodeInput('');
      }
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualDni.trim()) return;
    processScannedDni(manualDni.trim());
    setManualDni('');
    setIsManualInputOpen(false);
  };

  const attendancePercentage = useMemo(() => {
    if (!totalInscritos || totalInscritos === 0) return 0;
    return Math.round((totalIngresados / totalInscritos) * 1000) / 10;
  }, [totalInscritos, totalIngresados]);

  // =========================================================================
  // RENDER: VISTA KIOSKO DE PANTALLA COMPLETA
  // =========================================================================

  if (isKioskMode && activeSimulacro) {
    // Estadísticas de la sede del postulante actual escaneado
    const currentPostulanteSede = currentScan.postulante?.sede || 'SEDE CENTRAL';
    const currentSedeStat = kioskSedesStats[currentPostulanteSede] || { total: 0, ingresados: 0 };
    const currentSedePct =
      currentSedeStat.total > 0
        ? Math.round((currentSedeStat.ingresados / currentSedeStat.total) * 1000) / 10
        : 0;

    return (
      <div className="fixed inset-0 z-50 bg-[#0a0f1d] text-white flex flex-col font-sans select-none overflow-hidden">
        {/* INPUT INVISIBLE CON AUTOFOCUS PERMANENTE PARA EL LECTOR USB */}
        <input
          ref={barcodeInputRef}
          type="text"
          value={barcodeInput}
          onChange={e => setBarcodeInput(e.target.value)}
          onKeyDown={handleBarcodeInputKeyDown}
          className="opacity-0 absolute pointer-events-none -top-96 left-0"
          autoFocus
          autoComplete="off"
          tabIndex={-1}
        />

        {/* 1. BARRA SUPERIOR DE ESTADO Y MONITOR MULTI-SEDE */}
        <header className="h-16 bg-[#131b2e] border-b border-slate-800 px-6 flex items-center justify-between shrink-0 shadow-lg">
          <div className="flex items-center gap-4">
            <div className="bg-primary/20 text-primary border border-primary/40 size-10 rounded-xl flex items-center justify-center font-black">
              <span className="material-symbols-outlined text-2xl">barcode_scanner</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-black tracking-wider uppercase text-white truncate max-w-xs md:max-w-md">
                  {activeSimulacro.nombre}
                </h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  MODO KIOSKO
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
                <span>{activeSimulacro.fecha}</span>
                <span>•</span>
                <span className="text-amber-400 font-bold">{kioskClock}</span>
              </p>
            </div>
          </div>

          {/* MONITOR EN VIVO: GENERAL Y DESGLOSE POR SEDE */}
          <div className="flex items-center gap-4 md:gap-6">
            {/* Monitor General */}
            <div className="bg-slate-900/80 px-4 py-1.5 rounded-xl border border-slate-700/80 flex items-center gap-3">
              <div className="text-right">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Avance Total</p>
                <p className="text-base font-black text-white font-mono leading-none">
                  <span className="text-emerald-400">{totalIngresados}</span>
                  <span className="text-slate-500"> / </span>
                  <span>{totalInscritos}</span>
                  <span className="text-amber-400 ml-1.5 text-xs font-bold">({attendancePercentage}%)</span>
                </p>
              </div>

              {/* Botón para ver desglose por Sedes */}
              <button
                onClick={() => setShowSedesDrawer(!showSedesDrawer)}
                className="pl-3 border-l border-slate-700 flex items-center gap-1.5 text-xs font-bold text-sky-400 hover:text-sky-300 py-1"
                title="Ver avance por cada Sede"
              >
                <span className="material-symbols-outlined text-[16px]">location_on</span>
                <span className="hidden sm:inline">Por Sedes ({Object.keys(kioskSedesStats).length})</span>
                <span className="material-symbols-outlined text-[14px]">
                  {showSedesDrawer ? 'expand_less' : 'expand_more'}
                </span>
              </button>
            </div>

            {/* ESTADO DE CONEXIÓN */}
            <div className="flex items-center gap-2">
              {isOnline ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 text-xs font-black">
                  <span className="size-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="hidden sm:inline">ONLINE</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-400 text-xs font-black">
                  <span className="size-2.5 rounded-full bg-amber-400"></span>
                  <span>MODO LOCAL</span>
                </div>
              )}

              {pendingSyncCount > 0 && (
                <div className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-sky-950/60 border border-sky-500/40 text-sky-400 text-xs font-bold" title="Pendientes de sincronizar">
                  <span className="material-symbols-outlined text-[15px] animate-spin">sync</span>
                  <span>{pendingSyncCount}</span>
                </div>
              )}
            </div>

            {/* CONTROLES DE KIOSKO */}
            <div className="flex items-center gap-2">
              {isPrinting && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black animate-pulse">
                  <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>
                  <span className="hidden sm:inline">Imprimiendo...</span>
                </div>
              )}

              <button
                onClick={() => setAutoPrintTicket(!autoPrintTicket)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                  autoPrintTicket
                    ? 'bg-primary/20 text-primary border-primary/50'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                }`}
                title="Alternar impresión automática de ticket 80mm al escanear"
              >
                <span className="material-symbols-outlined text-[18px]">print</span>
                <span className="hidden md:inline">Auto-Ticket {autoPrintTicket ? 'ON' : 'OFF'}</span>
              </button>

              <button
                onClick={() => setShowPrinterModal(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                  selectedPrinter
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/60'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                }`}
                title={`Impresora: ${selectedPrinter || 'Predeterminada de Windows'} - Clic para configurar`}
              >
                <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                <span className="hidden xl:inline max-w-[130px] truncate">{selectedPrinter || 'Ticketera'}</span>
              </button>

              <button
                onClick={() => setIsManualInputOpen(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all border border-slate-700"
                title="Ingresar DNI manualmente con el teclado"
              >
                <span className="material-symbols-outlined text-[18px]">keyboard</span>
                <span className="hidden sm:inline">Manual</span>
              </button>

              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all border border-slate-700"
                title="Pantalla completa"
              >
                <span className="material-symbols-outlined text-[20px]">
                  {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
                </span>
              </button>

              <button
                onClick={exitKioskMode}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/40 text-xs font-black transition-all"
                title="Salir del modo Kiosko (ESC)"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                <span>Salir (ESC)</span>
              </button>
            </div>
          </div>
        </header>

        {/* TIRA DESPLEGABLE DE AVANCE POR SEDES */}
        {showSedesDrawer && (
          <div className="bg-[#111827] border-b border-slate-800 px-6 py-2.5 flex items-center gap-3 overflow-x-auto hide-scrollbar shadow-inner animate-fade-in">
            <span className="text-[10px] font-black uppercase text-slate-400 shrink-0 flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-sky-400">domain</span>
              <span>Avance por Sede:</span>
            </span>
            <div className="flex items-center gap-2 flex-1 overflow-x-auto hide-scrollbar">
              {Object.entries(kioskSedesStats).map(([sName, sStat]) => {
                const sPct = sStat.total > 0 ? Math.round((sStat.ingresados / sStat.total) * 1000) / 10 : 0;
                return (
                  <div
                    key={sName}
                    className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1 text-xs font-mono shrink-0 flex items-center gap-2"
                  >
                    <span className="font-black text-slate-200">{sName}:</span>
                    <span className="text-emerald-400 font-bold">
                      {sStat.ingresados}/{sStat.total}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-amber-400 font-bold">
                      {sPct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. ÁREA CENTRAL: FEEDBACK VISUAL DE ALTO IMPACTO */}
        <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-8 relative overflow-y-auto">
          {/* ESTADO: EN ESPERA DE LECTURA */}
          {currentScan.status === 'idle' && (
            <div className="text-center max-w-xl animate-fade-in">
              <div className="relative inline-flex mb-6">
                <div className="size-32 rounded-3xl bg-slate-800/60 border-2 border-dashed border-slate-600 flex items-center justify-center text-slate-400">
                  <span className="material-symbols-outlined text-6xl animate-pulse text-primary">
                    barcode_scanner
                  </span>
                </div>
                <span className="absolute -top-2 -right-2 flex size-6">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full size-6 bg-emerald-500 text-[10px] text-white font-black items-center justify-center">
                    ✓
                  </span>
                </span>
              </div>
              <h2 className="text-3xl font-black text-white tracking-tight uppercase mb-2">
                Escanee el Código de Barras (DNI)
              </h2>
              <p className="text-slate-400 text-sm md:text-base mb-6">
                Acerque el DNI del postulante al lector óptico USB. La detección, verificación de carrera e impresión de ticket son instantáneas.
              </p>

              {/* Resumen rápido de sedes activas */}
              <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
                {Object.entries(kioskSedesStats).map(([sName, sStat]) => (
                  <span key={sName} className="px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300">
                    📍 {sName}: <strong className="text-emerald-400">{sStat.ingresados}</strong> / {sStat.total}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ESTADO: VERDE (ÉXITO - INGRESO REGISTRADO) */}
          {currentScan.status === 'success' && currentScan.postulante && (
            <div className="w-full max-w-4xl bg-emerald-950/40 border-4 border-emerald-500/80 rounded-3xl p-6 md:p-8 shadow-2xl shadow-emerald-950/80 animate-fade-in text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-3 bg-emerald-500 animate-pulse" />

              <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-emerald-500 text-slate-950 font-black text-base uppercase tracking-wider mb-4 shadow-lg shadow-emerald-500/30">
                <span className="material-symbols-outlined text-xl">check_circle</span>
                <span>INGRESO VERIFICADO Y REGISTRADO</span>
              </div>

              {/* NOMBRES Y APELLIDOS GIGANTES (UN SOLO CAMPO) */}
              <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight uppercase leading-tight mb-2">
                {currentScan.postulante.nombres_apellidos || [currentScan.postulante.apellidos, currentScan.postulante.nombres].filter(Boolean).join(' ')}
              </h2>

              <p className="text-lg md:text-xl font-mono text-emerald-300 font-bold tracking-widest mb-4">
                DNI: <span className="bg-emerald-900/60 px-4 py-1 rounded-xl border border-emerald-500/40 text-white">{currentScan.postulante.dni}</span>
              </p>

              {/* CARRERA A LA QUE POSTULA (DESTACADA) */}
              <div className="bg-slate-900/90 border-2 border-emerald-500/60 rounded-2xl p-4 my-4 max-w-2xl mx-auto shadow-inner">
                <p className="text-[11px] font-black uppercase text-emerald-400 tracking-widest mb-1 flex items-center justify-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">school</span>
                  <span>Carrera Profesional a la que Postula:</span>
                </p>
                <p className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">
                  {currentScan.postulante.carrera || <span className="text-slate-400 italic font-normal text-base">(No asignada en el padrón)</span>}
                </p>
              </div>

              {/* TARJETÓN DESTACADO: AULA Y CARPETA */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
                <div className="bg-slate-900/90 border-2 border-emerald-500/50 rounded-2xl p-5 text-center shadow-inner">
                  <p className="text-xs uppercase font-black text-emerald-400 tracking-widest mb-1">Aula de Evaluación</p>
                  <p className="text-4xl md:text-5xl font-black text-white font-mono tracking-tight">
                    {currentScan.postulante.aula || 'S/A'}
                  </p>
                  <p className="text-xs text-slate-300 mt-2 font-bold uppercase">
                    SEDE: {currentPostulanteSede}
                  </p>
                </div>

                <div className="bg-slate-900/90 border-2 border-emerald-500/50 rounded-2xl p-5 text-center shadow-inner">
                  <p className="text-xs uppercase font-black text-emerald-400 tracking-widest mb-1">Carpeta Nº</p>
                  <p className="text-4xl md:text-5xl font-black text-amber-400 font-mono tracking-tight">
                    {currentScan.postulante.carpeta || 'S/N'}
                  </p>
                  <p className="text-xs text-slate-300 mt-2 font-bold uppercase">
                    GRUPO: {currentScan.postulante.grupo || 'ÚNICO'}
                  </p>
                </div>
              </div>

              {/* ESTADÍSTICA DE LA SEDE DEL POSTULANTE */}
              <div className="bg-slate-900/60 rounded-2xl p-4 border border-emerald-900/60 flex flex-wrap items-center justify-between gap-4 text-left">
                <div className="flex items-center gap-2 text-xs">
                  <span className="material-symbols-outlined text-emerald-400 text-lg">domain</span>
                  <div>
                    <p className="font-bold text-slate-300">
                      Avance en Sede <span className="text-emerald-300 font-black">{currentPostulanteSede}</span>:
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {currentSedeStat.ingresados} de {currentSedeStat.total} ingresaron ({currentSedePct}%)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Hora de Ingreso</p>
                    <p className="text-sm font-mono text-emerald-300 font-bold">{currentScan.timestamp}</p>
                  </div>
                  <button
                    onClick={() => executeTicketPrint(currentScan.postulante!)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-all shadow-md active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[18px]">print</span>
                    <span>Reimprimir Ticket</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ESTADO: AMARILLO (DUPLICADO - YA INGRESÓ) */}
          {currentScan.status === 'duplicate' && currentScan.postulante && (
            <div className="w-full max-w-3xl bg-amber-950/40 border-4 border-amber-500/90 rounded-3xl p-6 md:p-8 shadow-2xl shadow-amber-950/80 animate-fade-in text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-3 bg-amber-500 animate-pulse" />

              <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-amber-500 text-slate-950 font-black text-base uppercase tracking-wider mb-4 shadow-lg shadow-amber-500/30">
                <span className="material-symbols-outlined text-xl">warning</span>
                <span>POSTULANTE YA INGRESÓ ANTERIORMENTE</span>
              </div>

              <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight uppercase leading-tight mb-2">
                {currentScan.postulante.nombres_apellidos || [currentScan.postulante.apellidos, currentScan.postulante.nombres].filter(Boolean).join(' ')}
              </h2>

              <p className="text-base md:text-lg font-mono text-amber-300 font-bold tracking-widest mb-3">
                DNI: <span className="bg-amber-900/60 px-4 py-1 rounded-xl border border-amber-500/40 text-white">{currentScan.postulante.dni}</span>
              </p>

              {/* Carrera */}
              <div className="bg-amber-900/30 border border-amber-500/40 rounded-xl px-4 py-2 max-w-md mx-auto mb-3">
                <p className="text-[11px] font-black uppercase text-amber-300">Carrera a la que postula:</p>
                <p className="text-sm font-black text-white uppercase">{currentScan.postulante.carrera || 'NO ESPECIFICADA'}</p>
              </div>

              <div className="bg-amber-900/40 border border-amber-500/50 rounded-2xl p-4 my-3 max-w-lg mx-auto">
                <p className="text-amber-200 text-sm font-bold">
                  ⚠️ Este postulante ya fue verificado a las <span className="font-mono text-white text-base underline">{currentScan.timestamp}</span> en la sede <span className="font-bold text-white">{currentPostulanteSede}</span>.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 max-w-md mx-auto my-3 text-center">
                <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-700">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Aula</p>
                  <p className="text-2xl font-black text-white font-mono">{currentScan.postulante.aula || 'S/A'}</p>
                </div>
                <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-700">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Carpeta</p>
                  <p className="text-2xl font-black text-amber-400 font-mono">{currentScan.postulante.carpeta || 'S/N'}</p>
                </div>
              </div>

              <button
                onClick={() => executeTicketPrint(currentScan.postulante!)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm uppercase tracking-wide transition-all shadow-xl active:scale-95"
              >
                <span className="material-symbols-outlined text-xl">print</span>
                <span>Reimprimir Ticket (80mm)</span>
              </button>
            </div>
          )}

          {/* ESTADO: ROJO (ERROR - NO ENCONTRADO EN PADRÓN) */}
          {currentScan.status === 'error' && (
            <div className="w-full max-w-3xl bg-rose-950/50 border-4 border-rose-600 rounded-3xl p-8 md:p-10 shadow-2xl shadow-rose-950/90 animate-shake text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-3 bg-rose-600 animate-pulse" />

              <div className="size-24 rounded-full bg-rose-600/30 border-2 border-rose-500 flex items-center justify-center mx-auto mb-4 text-rose-400">
                <span className="material-symbols-outlined text-6xl">cancel</span>
              </div>

              <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight uppercase mb-3">
                ❌ NO ES UN POSTULANTE INSCRITO
              </h2>

              <div className="bg-slate-900/90 border-2 border-rose-500/60 rounded-2xl p-6 max-w-md mx-auto my-4">
                <p className="text-xs uppercase font-black text-rose-400 tracking-widest mb-1">Documento Escaneado</p>
                <p className="text-3xl font-black text-white font-mono tracking-wider">
                  DNI: {currentScan.scannedDni || 'DESCONOCIDO'}
                </p>
              </div>

              <p className="text-rose-200 text-sm md:text-base max-w-lg mx-auto font-medium">
                El número de documento no figura en la nómina oficial cargada para este simulacro. Solicite al usuario acercarse a la mesa de verificación o jefatura de admisión.
              </p>
            </div>
          )}
        </main>

        {/* 3. TIRA INFERIOR: HISTORIAL DE ÚLTIMOS INGRESOS */}
        <footer className="h-24 bg-[#111827] border-t border-slate-800 px-6 flex items-center gap-4 shrink-0 overflow-x-auto hide-scrollbar">
          <div className="text-xs font-black uppercase tracking-wider text-slate-400 shrink-0 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]">history</span>
            <span>Últimos Ingresos:</span>
          </div>

          <div className="flex items-center gap-3 flex-1 overflow-x-auto hide-scrollbar py-2">
            {recentScans.length === 0 ? (
              <span className="text-xs text-slate-500 italic">No hay ingresos registrados en esta sesión</span>
            ) : (
              recentScans.map(p => (
                <div
                  key={p.dni}
                  className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/50 rounded-xl px-3 py-2 flex items-center gap-3 shrink-0 transition-all text-xs"
                >
                  <div className="size-2 rounded-full bg-emerald-400" />
                  <div>
                    <p className="font-black text-white truncate max-w-[180px] leading-tight">
                      {p.nombres_apellidos || [p.apellidos, p.nombres].filter(Boolean).join(' ')}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono">
                      DNI: {p.dni} • AULA: {p.aula || 'S/A'} • {p.sede || 'SEDE CENTRAL'}
                    </p>
                  </div>
                  <button
                    onClick={() => executeTicketPrint(p)}
                    className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-emerald-400 transition-all"
                    title="Reimprimir ticket"
                  >
                    <span className="material-symbols-outlined text-[16px]">print</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </footer>

        {/* MODAL PARA INGRESO MANUAL DE DNI */}
        {isManualInputOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-[#131b2e] border-2 border-slate-700 rounded-3xl p-6 w-full max-w-md shadow-2xl text-white">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black uppercase text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">keyboard</span>
                  <span>Ingreso Manual de DNI</span>
                </h3>
                <button onClick={() => setIsManualInputOpen(false)} className="text-slate-400 hover:text-white">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <form onSubmit={handleManualSubmit}>
                <p className="text-xs text-slate-400 mb-3">
                  Ingrese el número de DNI del postulante si el código de barras está deteriorado o no se puede escanear.
                </p>
                <input
                  type="text"
                  value={manualDni}
                  onChange={e => setManualDni(e.target.value)}
                  placeholder="Número de DNI (8 dígitos)"
                  className="w-full bg-slate-900 border-2 border-primary/50 rounded-2xl px-4 py-3 text-2xl font-mono font-black text-center text-white focus:outline-none focus:border-primary mb-4"
                  autoFocus
                  maxLength={12}
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsManualInputOpen(false)}
                    className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-black text-xs uppercase shadow-lg shadow-primary/30"
                  >
                    Verificar Ingreso
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // RENDER: VISTA 1 - GESTIÓN DE SIMULACROS (ADMINISTRADOR / OPERADOR)
  // =========================================================================

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* 1. CABECERA INSTITUCIONAL */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-primary/10 text-primary p-3 rounded-2xl border border-primary/20">
              <span className="material-symbols-outlined text-2xl">barcode_scanner</span>
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                Control de Ingreso de Postulantes
              </h1>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Kiosko con Lector de Barras (DNI) e Impresión Térmica 80mm
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-600 max-w-2xl mt-1">
            Módulo de acceso veloz en tiempo real (<span className="font-semibold text-emerald-600">&lt; 10ms</span>) con tolerancia offline y monitoreo simultáneo por sedes para simulacros y concursos de admisión de la UNSAAC.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowPrinterModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs uppercase tracking-wider transition-all border border-slate-300 shadow-sm active:scale-95"
            title="Configurar impresora térmica 80mm (POS-D TP 300 PRO) y opciones de impresión silenciosa"
          >
            <span className="material-symbols-outlined text-[18px] text-emerald-600">print</span>
            <span>Ticketera 80mm</span>
          </button>

          <button
            onClick={() => {
              setSelectedSimulacroForCsv('');
              setShowCsvModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">upload_file</span>
            <span>Subir CSV de Postulantes</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-primary/20 active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Nuevo Simulacro</span>
          </button>
        </div>
      </div>

      {/* 2. LISTADO DE SIMULACROS */}
      {loading ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center">
          <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Cargando simulacros...</p>
        </div>
      ) : simulacros.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border-2 border-dashed border-slate-200 text-center max-w-xl mx-auto">
          <div className="size-20 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-4xl">how_to_reg</span>
          </div>
          <h3 className="text-lg font-black text-slate-800 uppercase mb-2">No hay simulacros registrados</h3>
          <p className="text-sm text-slate-500 mb-6">
            Crea tu primer simulacro para habilitar la carga masiva del padrón de postulantes y lanzar el Modo Kiosko con lector de barras.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-primary/20"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            <span>Crear Primer Simulacro</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {simulacros.map(sim => {
            const total = sim.total_postulantes || 0;
            const ingresados = sim.total_ingresados || 0;
            const pct = total > 0 ? Math.round((ingresados / total) * 1000) / 10 : 0;
            const sedesEntries = Object.entries(sim.sedes_stats || {});

            return (
              <div
                key={sim.id}
                className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span
                      onClick={() => handleToggleEstado(sim)}
                      className={`text-[10px] font-black uppercase px-3 py-1 rounded-full cursor-pointer transition-all border ${
                        sim.estado === 'Activo'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          : sim.estado === 'En Curso'
                          ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                      title="Clic para alternar estado"
                    >
                      ● {sim.estado}
                    </span>

                    <button
                      onClick={() => handleDeleteSimulacro(sim)}
                      className="text-slate-300 hover:text-rose-500 transition-colors p-1"
                      title="Eliminar simulacro"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>

                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-1 group-hover:text-primary transition-colors">
                    {sim.nombre}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono flex items-center gap-1.5 mb-5">
                    <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                    <span>Fecha: {sim.fecha}</span>
                  </p>

                  {/* PROGRESO GENERAL DE AFLUENCIA */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-4">
                    <div className="flex items-center justify-between text-xs font-bold mb-2">
                      <span className="text-slate-500 uppercase tracking-wider text-[10px]">Total General Ingresados</span>
                      <span className="font-mono text-slate-900 font-black">
                        {ingresados} / {total} <span className="text-primary font-bold">({pct}%)</span>
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-primary h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>

                  {/* DESGLOSE POR SEDE */}
                  {sedesEntries.length > 0 && (
                    <div className="mb-4">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px] text-sky-500">domain</span>
                        <span>Avance por Sede:</span>
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {sedesEntries.map(([sName, sStat]) => {
                          const sPct = sStat.total > 0 ? Math.round((sStat.ingresados / sStat.total) * 100) : 0;
                          return (
                            <div
                              key={sName}
                              className="bg-slate-100/90 border border-slate-200/90 rounded-xl px-2.5 py-1 text-[11px] font-mono flex items-center gap-1.5"
                            >
                              <span className="font-bold text-slate-700">{sName}:</span>
                              <span className="text-emerald-700 font-black">{sStat.ingresados}/{sStat.total}</span>
                              <span className="text-[10px] text-primary font-black">({sPct}%)</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-100">
                  {/* BOTÓN PRINCIPAL MODO KIOSKO */}
                  <button
                    onClick={() => startKioskMode(sim)}
                    disabled={total === 0}
                    className={`w-full py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg ${
                      total > 0
                        ? 'bg-slate-950 hover:bg-primary text-white shadow-slate-900/20 active:scale-[0.98]'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px] text-emerald-400">play_circle</span>
                    <span>INICIAR MODO KIOSKO</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleOpenPadronModal(sim)}
                      className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px]">group</span>
                      <span>Ver Padrón</span>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedSimulacroForCsv(sim.id);
                        setShowCsvModal(true);
                      }}
                      className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px]">upload</span>
                      <span>Cargar CSV</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREAR SIMULACRO */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-scale-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-slate-900 uppercase flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">add_circle</span>
                <span>Nuevo Simulacro</span>
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-700">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateSimulacro} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">Nombre del Simulacro</label>
                <input
                  type="text"
                  value={newSimulacroNombre}
                  onChange={e => setNewSimulacroNombre(e.target.value)}
                  placeholder="Ej: I SIMULACRO GENERAL DE ADMISIÓN 2026-I"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-primary text-xs font-bold uppercase"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">Fecha de Ejecución</label>
                <input
                  type="date"
                  value={newSimulacroFecha}
                  onChange={e => setNewSimulacroFecha(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-primary text-xs font-bold"
                  required
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-black text-xs uppercase shadow-md shadow-primary/20"
                >
                  Guardar Simulacro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SUBIR CSV DE POSTULANTES */}
      {/* ========================================================================= */}
      {showCsvModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 animate-scale-up max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900 uppercase flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">upload_file</span>
                <span>Cargar Padrón de Postulantes (CSV)</span>
              </h3>
              <button onClick={() => setShowCsvModal(false)} className="text-slate-400 hover:text-slate-700">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto flex-1 pr-1">
              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">Simulacro de Destino</label>
                <select
                  value={selectedSimulacroForCsv}
                  onChange={e => setSelectedSimulacroForCsv(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-primary text-xs font-bold"
                  required
                >
                  <option value="">-- Selecciona el simulacro --</option>
                  {simulacros.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.nombre} ({s.fecha})
                    </option>
                  ))}
                </select>
              </div>

              <div className="border-2 border-dashed border-slate-300 hover:border-primary rounded-2xl p-6 text-center transition-colors bg-slate-50/50">
                <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">cloud_upload</span>
                <p className="text-xs font-black text-slate-700 uppercase mb-1">
                  Arrastra tu archivo CSV o haz clic para examinar
                </p>
                <p className="text-[11px] text-slate-500 mb-4">
                  Cabeceras admitidas: <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800 font-bold">dni,nombres_apellidos,carrera,sede,aula,carpeta,grupo</code>
                  <br />
                  <span className="text-[10px] text-slate-400 italic">
                    (También admite nombres y apellidos juntos en una sola columna: "postulante", "apellidos_y_nombres", etc.)
                  </span>
                </p>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleCsvFileChange}
                  className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-primary file:text-white hover:file:bg-primary/90 cursor-pointer"
                />
              </div>

              {csvPreview.length > 0 && (
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50">
                  <p className="text-xs font-black text-slate-700 uppercase mb-2 flex items-center justify-between">
                    <span>Vista Previa de Filas Detectadas</span>
                    <span className="text-[10px] text-emerald-600 font-bold">✓ Formato reconocido</span>
                  </p>
                  <div className="overflow-x-auto text-[11px]">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-slate-300 text-left font-black text-slate-600">
                          <th className="p-1">DNI</th>
                          <th className="p-1">Nombres y Apellidos</th>
                          <th className="p-1">Carrera</th>
                          <th className="p-1">Sede</th>
                          <th className="p-1">Aula</th>
                          <th className="p-1">Carpeta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.map((p, idx) => (
                          <tr key={idx} className="border-b border-slate-200 text-slate-700 font-mono">
                            <td className="p-1 font-bold">{p.dni}</td>
                            <td className="p-1 font-black">{p.nombres_apellidos}</td>
                            <td className="p-1 text-primary">{p.carrera || '-'}</td>
                            <td className="p-1">{p.sede || 'SEDE CENTRAL'}</td>
                            <td className="p-1">{p.aula || '-'}</td>
                            <td className="p-1 font-bold text-amber-600">{p.carpeta || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-100 mt-4">
              <button
                type="button"
                onClick={() => setShowCsvModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs uppercase"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleProcessCsvUpload}
                disabled={isUploadingCsv || !csvFile || !selectedSimulacroForCsv}
                className={`flex-1 py-2.5 rounded-xl font-black text-xs uppercase shadow-md flex items-center justify-center gap-2 ${
                  isUploadingCsv || !csvFile || !selectedSimulacroForCsv
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'bg-primary hover:bg-primary/90 text-white shadow-primary/20'
                }`}
              >
                {isUploadingCsv ? (
                  <>
                    <span className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Cargando en Lotes...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">publish</span>
                    <span>Procesar e Importar Padrón</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VER PADRÓN DE POSTULANTES CON FILTRO MULTI-SEDE */}
      {/* ========================================================================= */}
      {showPadronModal && activeSimulacro && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-5xl w-full p-6 shadow-2xl border border-slate-100 animate-scale-up max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                  Padrón Oficial: {activeSimulacro.nombre}
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Total: <strong>{padronList.length}</strong> postulantes •{' '}
                  <strong className="text-emerald-600">{padronList.filter(p => p.ingreso_registrado).length}</strong> ingresados
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportPadronCsv}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">file_download</span>
                  <span>Exportar CSV</span>
                </button>

                <button
                  onClick={handleClearPadron}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold uppercase transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
                  <span>Vaciar Padrón</span>
                </button>

                <button onClick={() => setShowPadronModal(false)} className="text-slate-400 hover:text-slate-700 p-1">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            {/* BARRA DE FILTROS Y SELECTOR DE SEDE */}
            <div className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="relative flex-1 min-w-[200px]">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">
                  search
                </span>
                <input
                  type="text"
                  value={padronFilter}
                  onChange={e => setPadronFilter(e.target.value)}
                  placeholder="Buscar por DNI, nombres, carrera, aula..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-primary text-xs font-bold"
                />
              </div>

              {/* Selector de Sede */}
              {padronUniqueSedes.length > 1 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-500 font-black uppercase text-[10px]">Sede:</span>
                  <select
                    value={padronSedeFilter}
                    onChange={e => setPadronSedeFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-primary text-xs font-bold bg-white"
                  >
                    <option value="all">Todas las Sedes ({padronList.length})</option>
                    {padronUniqueSedes.map(s => {
                      const count = padronList.filter(
                        p => (String(p.sede || 'SEDE CENTRAL').trim().toUpperCase() || 'SEDE CENTRAL') === s
                      ).length;
                      return (
                        <option key={s} value={s}>
                          {s} ({count})
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPadronIngresoFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    padronIngresoFilter === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Todos ({padronList.length})
                </button>
                <button
                  onClick={() => setPadronIngresoFilter('ingresados')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    padronIngresoFilter === 'ingresados'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  Ingresados ({padronList.filter(p => p.ingreso_registrado).length})
                </button>
                <button
                  onClick={() => setPadronIngresoFilter('pendientes')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    padronIngresoFilter === 'pendientes'
                      ? 'bg-amber-600 text-white'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  Pendientes ({padronList.filter(p => !p.ingreso_registrado).length})
                </button>
              </div>
            </div>

            {/* TABLA DE POSTULANTES */}
            <div className="overflow-y-auto flex-1 border border-slate-200 rounded-2xl">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-black uppercase text-[10px] sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">DNI</th>
                    <th className="p-3">Nombres y Apellidos</th>
                    <th className="p-3">Carrera a la que Postula</th>
                    <th className="p-3">Sede</th>
                    <th className="p-3">Aula</th>
                    <th className="p-3">Carpeta</th>
                    <th className="p-3">Estado Ingreso</th>
                    <th className="p-3">Hora Ingreso</th>
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredPadron.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400 italic">
                        No se encontraron postulantes con los filtros seleccionados
                      </td>
                    </tr>
                  ) : (
                    filteredPadron.map((p, idx) => (
                      <tr key={p.dni} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                        <td className="p-3 font-mono font-bold text-slate-900">{p.dni}</td>
                        <td className="p-3 font-black text-slate-800 uppercase">
                          {p.nombres_apellidos || [p.apellidos, p.nombres].filter(Boolean).join(' ')}
                        </td>
                        <td className="p-3 font-black text-primary truncate max-w-[200px]">
                          {p.carrera || <span className="text-slate-400 font-normal italic">Sin carrera</span>}
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-700">
                          {p.sede || 'SEDE CENTRAL'}
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-900">{p.aula || '-'}</td>
                        <td className="p-3 font-mono font-black text-amber-600">{p.carpeta || '-'}</td>
                        <td className="p-3">
                          {p.ingreso_registrado ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800">
                              <span className="size-1.5 rounded-full bg-emerald-500"></span>
                              <span>Ingresó</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-500">
                              <span>Pendiente</span>
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-mono text-[11px] text-slate-600">
                          {p.hora_ingreso
                            ? new Date(p.hora_ingreso).toLocaleTimeString('es-PE', { hour12: false })
                            : '-'}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => executeTicketPrint(p)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 transition-colors"
                            title="Imprimir ticket 80mm"
                          >
                            <span className="material-symbols-outlined text-[16px]">print</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONFIGURACIÓN DE IMPRESORA TÉRMICA 80MM Y LANZADOR KIOSKO SILENCIOSO */}
      {/* ========================================================================= */}
      {showPrinterModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden animate-scale-up">
            {/* Header */}
            <div className="bg-slate-900 text-white p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">print</span>
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight uppercase">
                    Configuración de Ticketera 80mm
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    POS-D TP 300 PRO • Impresión Silenciosa de Alta Velocidad (&lt; 0.2s)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPrinterModal(false)}
                className="size-9 rounded-xl bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Contenido */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* 1. Indicador de Entorno Activo */}
              <div className="p-4 rounded-2xl border flex items-start gap-3 bg-slate-50 border-slate-200">
                <span className="material-symbols-outlined text-2xl text-primary mt-0.5">
                  {isElectronEnv ? 'desktop_windows' : 'language'}
                </span>
                <div className="flex-1 text-xs">
                  <p className="font-bold text-slate-900 uppercase">
                    Entorno detectado: {isElectronEnv ? 'App de Escritorio (Electron)' : 'Navegador Web (Google Chrome / Edge)'}
                  </p>
                  <p className="text-slate-600 mt-1 leading-relaxed">
                    {isElectronEnv
                      ? 'La app de escritorio gestiona la impresión en segundo plano vía USB con 1 segundo de margen de spooler para garantizar el vaciado de buffer.'
                      : 'En entorno web, Chromium envía los tickets al driver de 80mm. Para suprimir la ventana previa de impresión usa el lanzador con --kiosk-printing.'}
                  </p>
                </div>
              </div>

              {/* 2. Selección de Impresora en Escritorio */}
              {isElectronEnv && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-emerald-600">settings</span>
                      <span>Impresora Destino (Desktop)</span>
                    </label>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {availablePrinters.length} impresoras detectadas
                    </span>
                  </div>

                  {availablePrinters.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {availablePrinters.map(printer => {
                        const isSelected = selectedPrinter === printer.name || (!selectedPrinter && printer.isDefault);
                        const isPos = /pos|thermal|ticket|tp-?300|80mm/i.test(printer.name);

                        return (
                          <div
                            key={printer.name}
                            onClick={() => handleSelectPrinter(printer.name)}
                            className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                              isSelected
                                ? 'bg-emerald-50 border-emerald-500 shadow-sm'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className={`material-symbols-outlined text-xl ${isSelected ? 'text-emerald-600' : 'text-slate-400'}`}>
                                {isSelected ? 'radio_button_checked' : 'radio_button_unchecked'}
                              </span>
                              <div>
                                <p className={`text-xs font-black ${isSelected ? 'text-emerald-950' : 'text-slate-800'}`}>
                                  {printer.name}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {printer.isDefault && (
                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                                      Predeterminada
                                    </span>
                                  )}
                                  {isPos && (
                                    <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                                      POS-D Térmica
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {isSelected && (
                              <span className="material-symbols-outlined text-emerald-600 text-lg">check_circle</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={selectedPrinter}
                        onChange={e => handleSelectPrinter(e.target.value)}
                        placeholder="Ej. POS-D TP 300 PRO (dejar vacío para predeterminada)"
                        className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-primary"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Vista Previa del Diseño del Ticket (80mm) */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setShowTicketVisualPreview(!showTicketVisualPreview)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                      <span className="material-symbols-outlined text-xl">receipt</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase text-slate-800">
                        Diseño y Formato del Ticket 80mm
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        {showTicketVisualPreview ? 'Ocultar visualización en pantalla' : 'Ver maqueta visual exacta que se envía a la ticketera'}
                      </p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-slate-400">
                    {showTicketVisualPreview ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {showTicketVisualPreview && (
                  <div className="p-5 bg-slate-900 border-t border-slate-200 flex flex-col items-center">
                    <p className="text-[10px] text-slate-400 font-mono mb-3 uppercase tracking-wider text-center">
                      Vista a escala de impresión térmica (72mm imprimibles / rollo 80mm)
                    </p>
                    <div className="bg-white border-2 border-slate-400 shadow-2xl p-4 w-[280px] font-mono text-[11px] text-black leading-tight select-none">
                      <div className="text-center font-black text-[12px] leading-tight">
                        UNIVERSIDAD NACIONAL DE SAN ANTONIO ABAD DEL CUSCO
                      </div>
                      <div className="text-center text-[10px] text-slate-600 mt-1">
                        DIRECCIÓN DE ADMISIÓN
                      </div>
                      <div className="border-t border-dashed border-black my-2" />
                      <div className="text-center font-black uppercase text-[10px]">
                        {activeSimulacro?.nombre || 'SIMULACRO GENERAL DE ADMISIÓN'}
                      </div>
                      <div className="border-t border-dashed border-black my-2" />
                      <div className="flex justify-between text-[10px]">
                        <span>FECHA: {new Date().toLocaleDateString('es-PE')}</span>
                        <span>HORA: {new Date().toLocaleTimeString('es-PE', { hour12: false })}</span>
                      </div>
                      <div className="border-t border-dashed border-black my-2" />
                      <div className="text-[10px] text-slate-600">POSTULANTE:</div>
                      <div className="font-black text-[13px] leading-tight mt-0.5">
                        QUISPE MAMANI, CARLOS DANIEL
                      </div>
                      <div className="mt-1">
                        DNI: <span className="font-black text-[14px]">72849102</span>
                      </div>
                      <div className="border-t border-dashed border-black my-2" />
                      <div className="border-2 border-black p-2 my-2 text-center bg-slate-50">
                        <div className="text-[10px]">AULA DE EVALUACIÓN</div>
                        <div className="text-[18px] font-black">AULA 204</div>
                        <div className="text-[11px]">CARPETA Nº: <strong className="text-[14px]">18</strong></div>
                      </div>
                      <div className="flex justify-between my-1 text-[10px]">
                        <span>SEDE:</span>
                        <span className="font-bold">SEDE CENTRAL</span>
                      </div>
                      <div className="flex justify-between my-1 text-[10px]">
                        <span>GRUPO:</span>
                        <span className="font-bold">GRUPO A</span>
                      </div>
                      <div className="my-1 text-[10px]">
                        <span>CARRERA:</span>
                        <div className="font-bold">INGENIERÍA DE SISTEMAS</div>
                      </div>
                      <div className="border-t border-dashed border-black my-2" />
                      <div className="text-center text-[9px] mt-1">
                        [ ✔ ] INGRESO VERIFICADO
                        <br />
                        Conserve este ticket para su ubicación
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Botón de Ticket de Prueba */}
              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-black uppercase text-emerald-950 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px] text-emerald-600">verified</span>
                    <span>Test de Ticket Físico (80mm)</span>
                  </h4>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    Envía un ticket demo a la ticketera para validar guillotina, alineación y velocidad.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handlePrintTestTicket}
                  disabled={isTestingPrinter}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {isTestingPrinter ? 'refresh' : 'print'}
                  </span>
                  <span>{isTestingPrinter ? 'Imprimiendo...' : 'Probar Impresora'}</span>
                </button>
              </div>

              {/* 3. Lanzador Silencioso Web (--kiosk-printing) */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-sky-600">rocket_launch</span>
                    <span>Lanzador para Impresión Silenciosa en Web (Chrome)</span>
                  </label>
                  <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full">
                    Sin Ventana Previa
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Si vas a operar en laptops desde el navegador <strong>Google Chrome</strong> en lugar de la app instalada, la bandera <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-mono text-[11px]">--kiosk-printing</code> desactiva la ventana emergente de Chrome y envía el ticket directo al hardware en <strong>0.2 segundos</strong>.
                </p>

                {/* Comando para copiar */}
                <div className="bg-slate-900 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-white font-mono text-xs">
                  <span className="text-emerald-400 truncate select-all">
                    chrome.exe --kiosk-printing "http://localhost:3000/#/entry-control"
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText('chrome.exe --kiosk-printing "http://localhost:3000/#/entry-control"');
                      notify?.('Comando copiado al portapapeles.', 'success');
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1 shrink-0 text-[11px] font-sans font-bold"
                    title="Copiar comando"
                  >
                    <span className="material-symbols-outlined text-[14px]">content_copy</span>
                    <span>Copiar</span>
                  </button>
                </div>

                {/* Botón de descarga de archivo .bat */}
                <button
                  type="button"
                  onClick={handleDownloadKioskBat}
                  className="w-full py-3 rounded-2xl bg-sky-600 hover:bg-sky-700 active:scale-98 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">download</span>
                  <span>Descargar Acceso Directo (iniciar_kiosko_web.bat)</span>
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPrinterModal(false)}
                className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-wider transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
