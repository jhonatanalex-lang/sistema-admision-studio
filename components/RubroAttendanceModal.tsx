import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../lib/supabaseClient';
import { safeStorage } from '../lib/safeStorage';
import { User, PersonalSorteo } from '../types';
import { isElectronApp, getGatewayBaseUrl } from '../lib/fileGateway';

export interface RubroAttendanceRecord {
  id: string;
  proceso_id: string;
  cargo: string;
  dni: string;
  nombre: string;
  tipo: 'INGRESO' | 'SALIDA';
  fecha: string; // YYYY-MM-DD
  hora: string;  // HH:MM:SS
  firma?: string; // base64 transparent PNG
  timestamp: string;
  manual?: boolean;
  metodo_validacion?: string;
  user_id?: string;
}

interface RubroAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  cargo: string;
  procesoName: string;
  procesoId: string;
  eligibleSorteos: PersonalSorteo[];
  user: User;
  notify: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const RubroAttendanceModal: React.FC<RubroAttendanceModalProps> = ({
  isOpen,
  onClose,
  cargo,
  procesoName,
  procesoId,
  eligibleSorteos,
  user,
  notify
}) => {
  const isAdmin = user?.role === 'Administrador' || user?.role === 'Director';
  const canManageSorteo = isAdmin || (user?.role === 'Operador' && user?.permissions?.includes('manage_sorteo_asistencia'));

  const [activeTab, setActiveTab] = useState<'kiosk' | 'history'>('kiosk');
  const [dniInput, setDniInput] = useState('');

  // 1:N Biometric Identification State (Huella Directa -> Firma)
  const [rubroTemplates, setRubroTemplates] = useState<{ id: string; template: string }[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [serviceOnline, setServiceOnline] = useState<boolean | null>(null);
  const [isListeningBiometric, setIsListeningBiometric] = useState(false);
  const [identifyStatus, setIdentifyStatus] = useState<'IDLE' | 'LISTENING' | 'SCANNING' | 'SUCCESS' | 'NO_MATCH' | 'ERROR'>('IDLE');
  const [identifyMessage, setIdentifyMessage] = useState<string>('Inicializando estación biométrica...');
  const identifyAbortController = useRef<AbortController | null>(null);
  const isLoopActive = useRef<boolean>(false);

  // Contingencia de DNI (Acceso Restringido Exclusivo a Administrador / Director)
  const [showAdminContingency, setShowAdminContingency] = useState(false);
  const [records, setRecords] = useState<RubroAttendanceRecord[]>([]);
  const recordsRef = useRef<RubroAttendanceRecord[]>([]);
  useEffect(() => {
    recordsRef.current = records;
  }, [records]);
  const [loading, setLoading] = useState(false);

  // Filters for Report tab
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('ALL');
  const [selectedPersonFilter, setSelectedPersonFilter] = useState<string>('ALL');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Signature modal state
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [pendingPerson, setPendingPerson] = useState<PersonalSorteo | null>(null);
  const [pendingTipo, setPendingTipo] = useState<'INGRESO' | 'SALIDA'>('INGRESO');
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Manual regularization state
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    dni: '',
    tipo: 'INGRESO' as 'INGRESO' | 'SALIDA',
    fecha: new Date().toISOString().split('T')[0],
    hora: new Date().toLocaleTimeString('en-GB', { hour12: false }).substring(0, 5)
  });
  const manualCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [manualIsDrawing, setManualIsDrawing] = useState(false);
  const [manualHasSignature, setManualHasSignature] = useState(false);

  // Setup/clear manual canvas
  useEffect(() => {
    if (manualModalOpen && manualCanvasRef.current) {
      const canvas = manualCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
      setManualHasSignature(false);
    }
  }, [manualModalOpen]);

  const startManualDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setManualIsDrawing(true);
    const canvas = manualCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const drawManual = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!manualIsDrawing) return;
    const canvas = manualCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
    setManualHasSignature(true);
  };

  const stopManualDrawing = () => {
    setManualIsDrawing(false);
  };

  const clearManualCanvas = () => {
    const canvas = manualCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setManualHasSignature(false);
  };

  const generateAdminStamp = (adminInfo: string, fecha: string, hora: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Draw rounded border
    ctx.strokeStyle = '#4f46e5';
    ctx.lineWidth = 2.5;
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(6, 6, 288, 88, 12);
    } else {
      ctx.rect(6, 6, 288, 88);
    }
    ctx.stroke();

    // Background fill
    ctx.fillStyle = '#f5f3ff';
    ctx.fill();

    // Stamp Header
    ctx.fillStyle = '#4338ca';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('REGULARIZACIÓN MANUAL', 150, 30);

    // Subtitle
    ctx.fillStyle = '#1e1b4b';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(`VALIDADO POR: ${adminInfo.toUpperCase()}`, 150, 52);

    // Date and time
    ctx.fillStyle = '#6366f1';
    ctx.font = '10px monospace';
    ctx.fillText(`FECHA/HORA: ${fecha} ${hora}`, 150, 72);

    return canvas.toDataURL('image/png');
  };

  const [selectedSignature, setSelectedSignature] = useState<{ id: string; personName: string; dni: string; tipo: string; hora: string; firma: string } | null>(null);

  // Biometric state
  const [modalStep, setModalStep] = useState<'BIOMETRIC' | 'SIGNATURE'>('SIGNATURE');
  const [biometricMethod, setBiometricMethod] = useState<'HUELLA_Y_FIRMA' | 'SOLO_FIRMA' | 'MANUAL_DNI_ADMIN'>('SOLO_FIRMA');
  const [fingerprintStatus, setFingerprintStatus] = useState<'IDLE' | 'SCANNING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const abortControllerRef = useRef<AbortController | null>(null);

  const getBiometricServerUrl = () => {
    if (isElectronApp()) {
      return 'http://localhost:8081';
    }
    const gatewayUrl = getGatewayBaseUrl();
    try {
      if (gatewayUrl && !gatewayUrl.includes('localhost') && !gatewayUrl.includes('127.0.0.1')) {
        const parsed = new URL(gatewayUrl);
        return `${parsed.protocol}//${parsed.hostname}:8081`;
      }
    } catch {
      // fallback
    }
    return 'http://localhost:8081';
  };

  const checkBiometricAndProceed = async (person: PersonalSorteo, type: 'INGRESO' | 'SALIDA') => {
    setPendingPerson(person);
    setPendingTipo(type);
    setBiometricMethod('SOLO_FIRMA');
    setModalStep('SIGNATURE'); // Default fallback
    setSignatureModalOpen(true);

    try {
      const cleanDni = person.dni ? person.dni.trim() : '';
      const { data: templates } = await supabase
        .from('fingerprint_templates')
        .select('template_base64, finger_name, created_at')
        .eq('dni', cleanDni)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (templates && templates.length > 0 && templates[0].template_base64) {
        const activeTemplate = templates[0].template_base64;
        const serverUrl = getBiometricServerUrl();
        const res = await fetch(`${serverUrl}/ping`, { method: 'GET', signal: AbortSignal.timeout(2000) });
        if (res.ok) {
           setModalStep('BIOMETRIC');
           setFingerprintStatus('SCANNING');
           
           if (abortControllerRef.current) abortControllerRef.current.abort();
           abortControllerRef.current = new AbortController();

           const verifyRes = await fetch(`${serverUrl}/verify`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ 
               template: activeTemplate,
               template_base64: activeTemplate,
               templateBase64: activeTemplate,
               expectedTemplate: activeTemplate
             }),
             signal: abortControllerRef.current.signal
           });
           
           const verifyData = await verifyRes.json();
           console.log('[Attendance Biometric Verify]:', verifyData);

           // Validación estricta 1 a 1: verifyData.success === true && verifyData.verified === true
           const isVerified = Boolean(
             verifyRes.ok && 
             verifyData &&
             verifyData.success === true &&
             verifyData.verified === true
           );

           if (isVerified) {
             setFingerprintStatus('SUCCESS');
             setBiometricMethod('HUELLA_Y_FIRMA');
             setTimeout(() => {
                setModalStep('SIGNATURE');
             }, 1200);
           } else {
             setFingerprintStatus('ERROR');
             notify('Huella no coincide con la plantilla registrada del titular', 'error');
           }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
         console.warn("Biometric check failed/skipped:", err);
      }
    }
  };

  // === FUNCIONES DE IDENTIFICACIÓN BIOMÉTRICA 1:N (HUELLA DIRECTA) ===
  const loadRubroTemplates = useCallback(async () => {
    if (!eligibleSorteos || eligibleSorteos.length === 0) {
      setRubroTemplates([]);
      return;
    }

    setLoadingTemplates(true);
    try {
      const dnis = Array.from(new Set(eligibleSorteos.map(s => (s.dni ? String(s.dni).trim() : '')).filter(Boolean)));
      if (dnis.length === 0) {
        setRubroTemplates([]);
        return;
      }

      const loaded: { id: string; template: string }[] = [];
      const chunkSize = 200;
      for (let i = 0; i < dnis.length; i += chunkSize) {
        const chunk = dnis.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from('fingerprint_templates')
          .select('dni, template_base64')
          .in('dni', chunk);
        if (!error && data) {
          data.forEach(item => {
            if (item.dni && item.template_base64) {
              loaded.push({
                id: String(item.dni).trim(),
                template: item.template_base64
              });
            }
          });
        }
      }
      setRubroTemplates(loaded);
    } catch (err) {
      console.error('Error cargando plantillas biométricas del rubro:', err);
    } finally {
      setLoadingTemplates(false);
    }
  }, [eligibleSorteos]);

  const checkServiceHealth = useCallback(async () => {
    const serverUrl = getBiometricServerUrl();
    try {
      const res = await fetch(`${serverUrl}/ping`, { method: 'GET', signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        setServiceOnline(true);
        return true;
      }
    } catch {
      // offline
    }
    setServiceOnline(false);
    return false;
  }, []);

  const stopBiometricListening = () => {
    isLoopActive.current = false;
    if (identifyAbortController.current) {
      identifyAbortController.current.abort();
      identifyAbortController.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsListeningBiometric(false);
    setIdentifyStatus('IDLE');
    setIdentifyMessage('Sensor en pausa.');
  };

  const startBiometricIdentification = async (templatesToUse?: { id: string; template: string }[]) => {
    if (isLoopActive.current) return;
    const tList = templatesToUse || rubroTemplates;
    if (!tList || tList.length === 0) {
      setIdentifyStatus('IDLE');
      setIdentifyMessage('No hay huellas enroladas para este rubro. El Administrador debe usar la contingencia.');
      return;
    }

    const serverUrl = getBiometricServerUrl();
    const isOnline = await checkServiceHealth();
    if (!isOnline) {
      setIdentifyStatus('ERROR');
      setIdentifyMessage('Sensor biométrico desconectado o aplicación puente inactiva en localhost:8081.');
      return;
    }

    isLoopActive.current = true;
    setIsListeningBiometric(true);
    setIdentifyStatus('LISTENING');
    setIdentifyMessage('Lector activo: coloque su dedo sobre el sensor biométrico...');

    listenNextFingerprint(tList);
  };

  const listenNextFingerprint = async (tList: { id: string; template: string }[]) => {
    if (!isLoopActive.current) return;

    const serverUrl = getBiometricServerUrl();
    try {
      if (identifyAbortController.current) {
        identifyAbortController.current.abort();
      }
      identifyAbortController.current = new AbortController();

      setIdentifyStatus('SCANNING');
      setIdentifyMessage('Sensor en espera. Apoye su huella en el lector...');

      const res = await fetch(`${serverUrl}/identify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templates: tList }),
        signal: identifyAbortController.current.signal
      });

      if (!isLoopActive.current) return;

      const data = await res.json();

      if (data && data.success && data.identified && data.matchedId) {
        // ¡Coincidencia encontrada!
        const cleanMatchedDni = String(data.matchedId).trim();
        const personMatch = eligibleSorteos.find(
          s => s.dni.trim() === cleanMatchedDni || s.dni.trim().padStart(8, '0') === cleanMatchedDni.padStart(8, '0')
        );

        if (personMatch) {
          setIdentifyStatus('SUCCESS');
          setIdentifyMessage(`¡Identificado: ${personMatch.nombres}! Abriendo firma...`);

          const todayStr = getTodayString();
          const todayPersonRecords = recordsRef.current.filter(r => r.dni === personMatch.dni && r.fecha === todayStr);

          let nextType: 'INGRESO' | 'SALIDA' = 'INGRESO';
          if (todayPersonRecords.length === 0) {
            nextType = 'INGRESO';
          } else if (todayPersonRecords.length === 1 && todayPersonRecords[0].tipo === 'INGRESO') {
            nextType = 'SALIDA';
          } else if (todayPersonRecords.length >= 2) {
            notify(`El personal ${personMatch.nombres} ya registró su INGRESO y SALIDA para el día de hoy.`, 'info');
            setIdentifyStatus('IDLE');
            setIdentifyMessage(`El personal ${personMatch.nombres} ya completó su asistencia de hoy.`);
            setTimeout(() => {
              if (isLoopActive.current) listenNextFingerprint(tList);
            }, 3000);
            return;
          } else {
            nextType = 'SALIDA';
          }

          // Pausar escucha mientras firma
          isLoopActive.current = false;
          setIsListeningBiometric(false);

          // Abrir modal de firma directamente
          setPendingPerson(personMatch);
          setPendingTipo(nextType);
          setBiometricMethod('HUELLA_Y_FIRMA');
          setModalStep('SIGNATURE');
          setSignatureModalOpen(true);
          return;
        } else {
          setIdentifyStatus('NO_MATCH');
          setIdentifyMessage(`Huella de DNI ${cleanMatchedDni} no pertenece a este rubro (${cargo}).`);
          notify(`DNI ${cleanMatchedDni} no está asignado a este cargo.`, 'warning');
        }
      } else {
        if (data && data.identified === false) {
          setIdentifyStatus('NO_MATCH');
          setIdentifyMessage('Huella no reconocida en este rubro o no asignada.');
          notify('Huella no reconocida en este rubro.', 'error');
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return;
      }
      console.warn('Error en escucha biométrica:', err);
      setIdentifyStatus('ERROR');
      setIdentifyMessage('Lector en pausa. Presione reanudar para volver a escuchar.');
      isLoopActive.current = false;
      setIsListeningBiometric(false);
      return;
    }

    if (isLoopActive.current) {
      setTimeout(() => {
        if (isLoopActive.current) {
          listenNextFingerprint(tList);
        }
      }, 2000);
    }
  };

  // Helper date
  const getTodayString = () => new Date().toISOString().split('T')[0];

  const handleDeleteRecord = async (id: string) => {
    if (!window.confirm("¿Está seguro de eliminar esta marca de asistencia? Esta acción no se puede deshacer.")) {
      return;
    }

    try {
      const { error } = await supabase.from('asistencia').delete().eq('id', id);
      if (error) throw error;
      
      if (notify) notify('Registro de asistencia eliminado exitosamente.', 'success');
      
      // Update local state
      const updatedRecords = records.filter(r => r.id !== id);
      setRecords(updatedRecords);
      safeStorage.setItem(storageKey, JSON.stringify(updatedRecords));
      
      setSelectedSignature(null);
    } catch (err: any) {
      console.error(err);
      if (notify) notify('Error eliminando registro: ' + err.message, 'error');
    }
  };

  const storageKey = `asistencia_rubro_${procesoId}_${cargo.replace(/\s+/g, '_')}`;

  // Fetch existing attendance records
  const fetchRecords = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('asistencia')
        .select('*')
        .eq('proceso_id', procesoId)
        .eq('cargo', cargo)
        .order('timestamp', { ascending: false });

      if (!error && data && data.length > 0) {
        setRecords(data as any);
      } else {
        const saved = safeStorage.getItem(storageKey);
        if (saved) {
          setRecords(JSON.parse(saved));
        } else {
          const dnis = eligibleSorteos.map(s => s.dni);
          if (dnis.length > 0) {
            const { data: fallbackData } = await supabase
              .from('asistencia')
              .select('*')
              .in('dni', dnis)
              .order('timestamp', { ascending: false });
            if (fallbackData && fallbackData.length > 0) {
              setRecords(fallbackData as any);
            } else {
              setRecords([]);
            }
          } else {
            setRecords([]);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching rubro attendance:', err);
      const saved = safeStorage.getItem(storageKey);
      if (saved) setRecords(JSON.parse(saved));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRecords();
      setDniInput('');
      loadRubroTemplates();
      checkServiceHealth();
    } else {
      stopBiometricListening();
    }
    return () => {
      stopBiometricListening();
    };
  }, [isOpen, procesoId, cargo]);

  // Iniciar automáticamente la escucha biométrica cuando las plantillas estén listas en la pestaña kiosk
  useEffect(() => {
    if (isOpen && activeTab === 'kiosk' && !signatureModalOpen && rubroTemplates.length > 0) {
      startBiometricIdentification(rubroTemplates);
    } else if (!isOpen || activeTab !== 'kiosk' || signatureModalOpen) {
      stopBiometricListening();
    }
  }, [isOpen, activeTab, signatureModalOpen, rubroTemplates.length]);

  // Sync to safeStorage whenever records change
  const saveRecordsLocallyAndRemote = async (newRecords: RubroAttendanceRecord[], newRecordToInsert?: RubroAttendanceRecord) => {
    setRecords(newRecords);
    safeStorage.setItem(storageKey, JSON.stringify(newRecords));

    if (newRecordToInsert) {
      try {
        const isValidUuid = (id?: string) => !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        const procesoIdClean = isValidUuid(newRecordToInsert.proceso_id) ? newRecordToInsert.proceso_id : null;

        const payload: any = {
          cargo: newRecordToInsert.cargo,
          dni: newRecordToInsert.dni,
          nombre: newRecordToInsert.nombre,
          tipo: newRecordToInsert.tipo,
          fecha: newRecordToInsert.fecha,
          hora: newRecordToInsert.hora,
          firma: newRecordToInsert.firma,
          timestamp: newRecordToInsert.timestamp,
          manual: newRecordToInsert.manual || false,
          metodo_validacion: newRecordToInsert.metodo_validacion || (newRecordToInsert.manual ? 'MANUAL' : 'SOLO_FIRMA')
        };

        if (procesoIdClean) {
          payload.proceso_id = procesoIdClean;
        }

        const { data, error } = await supabase.from('asistencia').insert([payload]);

        if (error) {
          console.error('Error insertando asistencia en Supabase:', error.message, error.details, error.hint);
          if (notify) {
            notify(`Guardado localmente. Advertencia de BD: ${error.message}`, 'warning');
          }
        } else {
          console.log('Asistencia guardada exitosamente en Supabase');
        }
      } catch (err: any) {
        console.warn('Could not persist to remote database, saved locally.', err);
        if (notify) {
          notify(`Guardado localmente. Error: ${err.message}`, 'warning');
        }
      }
    }
  };

  // Canvas setup for Signature Modal
  useEffect(() => {
    if (signatureModalOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
      setHasSignature(false);
    }
  }, [signatureModalOpen]);

  // Touch & Mouse Drawing Handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasSignature(false);
  };

  // Validate DNI and trigger Signature modal
  const handleAttemptMark = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const cleanDni = dniInput.trim();
    if (!cleanDni) {
      notify('Por favor ingrese o escanee un número de DNI.', 'warning');
      return;
    }

    const personMatch = eligibleSorteos.find(
      s => s.dni.trim() === cleanDni || s.dni.trim().padStart(8, '0') === cleanDni.padStart(8, '0')
    );

    if (!personMatch) {
      notify(`El DNI ${cleanDni} NO pertenece al personal sorteado y verificado para "${cargo}".`, 'error');
      setDniInput('');
      return;
    }

    const todayStr = getTodayString();
    const todayPersonRecords = recordsRef.current.filter(r => r.dni === personMatch.dni && r.fecha === todayStr);

    let nextType: 'INGRESO' | 'SALIDA' = 'INGRESO';

    if (todayPersonRecords.length === 0) {
      nextType = 'INGRESO';
    } else if (todayPersonRecords.length === 1 && todayPersonRecords[0].tipo === 'INGRESO') {
      nextType = 'SALIDA';
    } else if (todayPersonRecords.length >= 2) {
      notify(`El personal ${personMatch.nombres} ya registró su INGRESO y SALIDA para el día de hoy.`, 'info');
      setDniInput('');
      return;
    } else {
      nextType = 'SALIDA';
    }

    // Detener sensor biométrico y autorizar pase directo a firma bajo método auditado MANUAL_DNI_ADMIN
    stopBiometricListening();
    setPendingPerson(personMatch);
    setPendingTipo(nextType);
    setBiometricMethod('MANUAL_DNI_ADMIN');
    setModalStep('SIGNATURE');
    setSignatureModalOpen(true);
  };

  const handleCloseSignatureModal = () => {
    stopBiometricListening();
    setSignatureModalOpen(false);
    setPendingPerson(null);
    setDniInput('');

    // Reanudar automáticamente la escucha biométrica para la siguiente persona
    setTimeout(() => {
      if (activeTab === 'kiosk' && rubroTemplates.length > 0 && !isLoopActive.current) {
        startBiometricIdentification(rubroTemplates);
      }
    }, 400);
  };

  // Save confirmed mark with transparent signature
  const handleConfirmSignature = () => {
    if (!pendingPerson) return;
    if (!hasSignature) {
      notify('Por favor ingrese la firma en el recuadro antes de guardar.', 'warning');
      return;
    }

    const canvas = canvasRef.current;
    let signatureBase64 = '';
    if (canvas) {
      signatureBase64 = canvas.toDataURL('image/png');
    }

    const now = new Date();
    const todayStr = getTodayString();
    const timeStr = now.toLocaleTimeString('en-GB', { hour12: false });

    const newRecord: RubroAttendanceRecord = {
      id: 'att_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      proceso_id: procesoId,
      cargo: cargo,
      dni: pendingPerson.dni,
      nombre: pendingPerson.nombres,
      tipo: pendingTipo,
      fecha: todayStr,
      hora: timeStr,
      firma: signatureBase64,
      timestamp: now.toISOString(),
      manual: false,
      metodo_validacion: biometricMethod
    };

    const updatedRecords = [newRecord, ...records];
    saveRecordsLocallyAndRemote(updatedRecords, newRecord);

    notify(
      `¡Marca de ${pendingTipo} registrada con éxito para ${pendingPerson.nombres}!`,
      'success'
    );

    handleCloseSignatureModal();
    setPendingPerson(null);
    setDniInput('');
  };

  // Manual regularization save (Admin only)
  const handleSaveManualRecord = () => {
    if (!manualForm.dni) {
      notify('Seleccione o ingrese un DNI válido.', 'warning');
      return;
    }

    const personMatch = eligibleSorteos.find(s => s.dni.trim() === manualForm.dni.trim());
    const nombre = personMatch ? personMatch.nombres : 'PERSONAL REGULARIZADO';

    const timeBits = manualForm.hora.split(':');
    const formattedHora = `${(timeBits[0] || '00').padStart(2, '0')}:${(timeBits[1] || '00').padStart(2, '0')}:00`;
    const timestampIso = `${manualForm.fecha}T${formattedHora}Z`;

    let finalFirma = '';
    if (manualHasSignature && manualCanvasRef.current) {
      finalFirma = manualCanvasRef.current.toDataURL('image/png');
    } else {
      const adminInfo = user?.name || user?.role || 'ADMINISTRADOR';
      finalFirma = generateAdminStamp(adminInfo, manualForm.fecha, formattedHora);
    }

    const newRecord: RubroAttendanceRecord = {
      id: 'att_man_' + Date.now(),
      proceso_id: procesoId,
      cargo: cargo,
      dni: manualForm.dni,
      nombre: nombre,
      tipo: manualForm.tipo,
      fecha: manualForm.fecha,
      hora: formattedHora,
      firma: finalFirma,
      timestamp: timestampIso,
      manual: true,
      metodo_validacion: 'MANUAL'
    };

    const updatedRecords = [newRecord, ...records];
    saveRecordsLocallyAndRemote(updatedRecords, newRecord);

    notify(`Regularización manual guardada con constancia de firma/sello para ${nombre}.`, 'success');
    setManualModalOpen(false);
    setManualForm({
      dni: '',
      tipo: 'INGRESO',
      fecha: getTodayString(),
      hora: new Date().toLocaleTimeString('en-GB', { hour12: false }).substring(0, 5)
    });
  };

  // Extraer grupos disponibles en este rubro
  const availableGroups = useMemo(() => {
    const groupsSet = new Set<string>();
    eligibleSorteos.forEach(s => {
      if (s.horario_data && Array.isArray(s.horario_data)) {
        s.horario_data.forEach((shift: any) => {
          if (shift?.grupo) groupsSet.add(shift.grupo.trim());
        });
      }
    });
    return Array.from(groupsSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [eligibleSorteos]);

  // Helper para extraer información de turno y grupo de una persona
  const getPersonScheduleInfo = useCallback((s: PersonalSorteo, dateStr?: string) => {
    if (!s.horario_data || !Array.isArray(s.horario_data) || s.horario_data.length === 0) {
      return { grupo: 'Sin Grupo', turno: '', ordenPersona: 999 };
    }
    let shift = dateStr ? s.horario_data.find((d: any) => d && d.fecha === dateStr && d.grupo) : null;
    if (!shift) {
      shift = s.horario_data.find((d: any) => d && d.grupo) || s.horario_data[0];
    }
    const grupo = shift?.grupo ? shift.grupo.trim() : 'Sin Grupo';
    const turno = (shift?.hora_inicio && shift?.hora_fin) ? `${shift.hora_inicio} - ${shift.hora_fin}` : '';
    const ordenPersona = typeof shift?.orden_persona === 'number' ? shift.orden_persona : 999;
    return { grupo, turno, ordenPersona };
  }, []);

  // Conteo de integrantes por grupo
  const groupMemberCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    eligibleSorteos.forEach(s => {
      const info = getPersonScheduleInfo(s, selectedDateFilter === 'ALL' ? undefined : selectedDateFilter);
      counts[info.grupo] = (counts[info.grupo] || 0) + 1;
    });
    return counts;
  }, [eligibleSorteos, selectedDateFilter, getPersonScheduleInfo]);

  // Extract list of unique dates from records
  const getUniqueDates = (): string[] => {
    const datesSet = new Set<string>();
    records.forEach(r => {
      if (r.fecha) datesSet.add(r.fecha);
    });
    if (datesSet.size === 0) {
      datesSet.add(getTodayString());
    }
    return Array.from(datesSet).sort((a, b) => b.localeCompare(a)); // desc
  };

  // Helper to calculate total hours worked for a person across given dates
  const calculatePersonTotalMinutes = (dni: string, datesToEvaluate: string[]) => {
    let totalMinutes = 0;
    let daysAttended = 0;

    datesToEvaluate.forEach(dateStr => {
      const personRecords = records.filter(r => r.dni === dni && r.fecha === dateStr);
      const inRec = personRecords.find(r => r.tipo === 'INGRESO');
      const outRec = personRecords.find(r => r.tipo === 'SALIDA');
      if (inRec) daysAttended++;
      if (inRec && outRec) {
        try {
          const t1 = new Date(`${inRec.fecha}T${inRec.hora}`);
          const t2 = new Date(`${outRec.fecha}T${outRec.hora}`);
          const diffMs = t2.getTime() - t1.getTime();
          if (diffMs > 0) {
            totalMinutes += Math.floor(diffMs / (1000 * 60));
          }
        } catch (e) {}
      }
    });

    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const decimalHours = (totalMinutes / 60).toFixed(2);
    const formatted = `${hours.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m`;

    return {
      totalMinutes,
      hours,
      mins,
      decimalHours,
      formatted,
      formattedFull: `${formatted} (${decimalHours} hrs)`,
      daysAttended
    };
  };

  // Multi-dimensional calculation of attendance per person & date
  interface AttendanceRow {
    num: number;
    fecha: string;
    dni: string;
    nombre: string;
    cargo: string;
    grupo: string;
    turno: string;
    ordenPersona: number;
    ingreso: string;
    salida: string;
    ingresoRecord?: RubroAttendanceRecord;
    salidaRecord?: RubroAttendanceRecord;
    horasTrabajadas: string;
    totalHorasPersona: string;
    totalMinutes: number;
    estado: 'COMPLETO' | 'EN CURSO' | 'INASISTENTE';
  }

  const getFilteredAttendanceRows = (): AttendanceRow[] => {
    const datesToEvaluate = selectedDateFilter === 'ALL'
      ? getUniqueDates()
      : [selectedDateFilter];

    let filteredPersonnel = [...eligibleSorteos];

    if (selectedGroupFilter !== 'ALL') {
      filteredPersonnel = filteredPersonnel.filter(s => {
        const info = getPersonScheduleInfo(s, selectedDateFilter === 'ALL' ? undefined : selectedDateFilter);
        return info.grupo === selectedGroupFilter;
      });
    }

    if (selectedPersonFilter !== 'ALL') {
      filteredPersonnel = filteredPersonnel.filter(s => s.dni === selectedPersonFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filteredPersonnel = filteredPersonnel.filter(
        s => s.nombres.toLowerCase().includes(q) || s.dni.includes(q)
      );
    }

    // Ordenar rigurosamente por Grupo (Grupo 1, Grupo 2, Grupo 3), luego por orden_persona y alfabéticamente
    filteredPersonnel.sort((a, b) => {
      const infoA = getPersonScheduleInfo(a, selectedDateFilter === 'ALL' ? undefined : selectedDateFilter);
      const infoB = getPersonScheduleInfo(b, selectedDateFilter === 'ALL' ? undefined : selectedDateFilter);
      
      const grpComp = infoA.grupo.localeCompare(infoB.grupo, undefined, { numeric: true });
      if (grpComp !== 0) return grpComp;

      if (infoA.ordenPersona !== infoB.ordenPersona) {
        return infoA.ordenPersona - infoB.ordenPersona;
      }

      return a.nombres.localeCompare(b.nombres);
    });

    // Precompute person totals for evaluated dates
    const personTotalsMap = new Map<string, { formatted: string; formattedFull: string }>();
    filteredPersonnel.forEach(s => {
      const res = calculatePersonTotalMinutes(s.dni, datesToEvaluate);
      personTotalsMap.set(s.dni, {
        formatted: res.formatted,
        formattedFull: res.formattedFull
      });
    });

    const rows: AttendanceRow[] = [];
    let rowCounter = 1;

    // Loop through evaluated dates
    datesToEvaluate.forEach(dateStr => {
      filteredPersonnel.forEach(s => {
        const personRecords = records.filter(r => r.dni === s.dni && r.fecha === dateStr);

        const ingresoRecord = personRecords.find(r => r.tipo === 'INGRESO');
        const salidaRecord = personRecords.find(r => r.tipo === 'SALIDA');

        let horasTrabajadasStr = '00:00';
        let totalMinutes = 0;

        if (ingresoRecord && salidaRecord) {
          try {
            const t1 = new Date(`${ingresoRecord.fecha}T${ingresoRecord.hora}`);
            const t2 = new Date(`${salidaRecord.fecha}T${salidaRecord.hora}`);
            const diffMs = t2.getTime() - t1.getTime();
            if (diffMs > 0) {
              totalMinutes = Math.floor(diffMs / (1000 * 60));
              const hrs = Math.floor(totalMinutes / 60);
              const mins = totalMinutes % 60;
              horasTrabajadasStr = `${hrs.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m`;
            }
          } catch (e) {
            horasTrabajadasStr = 'Error';
          }
        }

        let estado: 'COMPLETO' | 'EN CURSO' | 'INASISTENTE' = 'INASISTENTE';
        if (ingresoRecord && salidaRecord) estado = 'COMPLETO';
        else if (ingresoRecord) estado = 'EN CURSO';

        const totals = personTotalsMap.get(s.dni) || { formatted: '00h 00m', formattedFull: '00h 00m (0.00 hrs)' };

        const schedInfo = getPersonScheduleInfo(s, dateStr);

        rows.push({
          num: rowCounter++,
          fecha: dateStr,
          dni: s.dni,
          nombre: s.nombres,
          cargo: s.cargo,
          grupo: schedInfo.grupo,
          turno: schedInfo.turno,
          ordenPersona: schedInfo.ordenPersona,
          ingreso: ingresoRecord ? ingresoRecord.hora : '-',
          salida: salidaRecord ? salidaRecord.hora : '-',
          ingresoRecord,
          salidaRecord,
          horasTrabajadas: horasTrabajadasStr,
          totalHorasPersona: totals.formatted,
          totalMinutes,
          estado
        });
      });
    });

    return rows;
  };

  // Export Hours Report to Excel in a SINGLE SHEET
  const handleExportExcel = () => {
    const workbook = XLSX.utils.book_new();
    const dates = selectedDateFilter === 'ALL' ? getUniqueDates() : [selectedDateFilter];

    let personnel = [...eligibleSorteos];
    if (selectedGroupFilter !== 'ALL') {
      personnel = personnel.filter(s => {
        const info = getPersonScheduleInfo(s, selectedDateFilter === 'ALL' ? undefined : selectedDateFilter);
        return info.grupo === selectedGroupFilter;
      });
    }
    if (selectedPersonFilter !== 'ALL') {
      personnel = personnel.filter(s => s.dni === selectedPersonFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      personnel = personnel.filter(s => s.nombres.toLowerCase().includes(q) || s.dni.includes(q));
    }

    personnel.sort((a, b) => {
      const infoA = getPersonScheduleInfo(a, selectedDateFilter === 'ALL' ? undefined : selectedDateFilter);
      const infoB = getPersonScheduleInfo(b, selectedDateFilter === 'ALL' ? undefined : selectedDateFilter);
      const grpComp = infoA.grupo.localeCompare(infoB.grupo, undefined, { numeric: true });
      if (grpComp !== 0) return grpComp;
      if (infoA.ordenPersona !== infoB.ordenPersona) return infoA.ordenPersona - infoB.ordenPersona;
      return a.nombres.localeCompare(b.nombres);
    });

    // Precalculate total hours per person across evaluated dates
    const personTotalsMap = new Map<string, { formatted: string; decimalHours: string; daysAttended: number }>();
    personnel.forEach(s => {
      const res = calculatePersonTotalMinutes(s.dni, dates);
      personTotalsMap.set(s.dni, {
        formatted: res.formatted,
        decimalHours: res.decimalHours,
        daysAttended: res.daysAttended
      });
    });

    const excelRows: any[] = [];
    let rowIdx = 1;

    dates.forEach(dateStr => {
      personnel.forEach(s => {
        const personRecords = records.filter(r => r.dni === s.dni && r.fecha === dateStr);
        const ingresoRecord = personRecords.find(r => r.tipo === 'INGRESO');
        const salidaRecord = personRecords.find(r => r.tipo === 'SALIDA');

        let horasJornadaStr = '00:00';
        if (ingresoRecord && salidaRecord) {
          try {
            const t1 = new Date(`${ingresoRecord.fecha}T${ingresoRecord.hora}`);
            const t2 = new Date(`${salidaRecord.fecha}T${salidaRecord.hora}`);
            const diffMs = t2.getTime() - t1.getTime();
            if (diffMs > 0) {
              const totalMinutes = Math.floor(diffMs / (1000 * 60));
              const hrs = Math.floor(totalMinutes / 60);
              const mins = totalMinutes % 60;
              horasJornadaStr = `${hrs.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m`;
            }
          } catch (e) {
            horasJornadaStr = 'Error';
          }
        }

        let estado = 'INASISTENTE';
        if (ingresoRecord && salidaRecord) estado = 'COMPLETO';
        else if (ingresoRecord) estado = 'EN CURSO';

        const totals = personTotalsMap.get(s.dni) || { formatted: '00h 00m', decimalHours: '0.00', daysAttended: 0 };

        const schedInfo = getPersonScheduleInfo(s, dateStr);
        excelRows.push({
          'N°': rowIdx++,
          'FECHA': dateStr,
          'GRUPO': schedInfo.grupo,
          'TURNO': schedInfo.turno || 'Sin turno',
          'DNI': s.dni,
          'NOMBRES Y APELLIDOS': s.nombres,
          'CARGO / RUBRO': s.cargo,
          'HORA INGRESO': ingresoRecord ? ingresoRecord.hora : '-',
          'FIRMA INGRESO': ingresoRecord?.firma ? 'REGISTRADA' : 'SIN FIRMA',
          'HORA SALIDA': salidaRecord ? salidaRecord.hora : '-',
          'FIRMA SALIDA': salidaRecord?.firma ? 'REGISTRADA' : 'SIN FIRMA',
          'HORAS CUMPLIDAS (JORNADA)': horasJornadaStr,
          'TOTAL HORAS CUMPLIDAS (PERSONA)': `${totals.formatted} (${totals.decimalHours} hrs)`,
          'ESTADO ASISTENCIA': estado
        });
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(excelRows);

    // Set clean column widths for single sheet
    worksheet['!cols'] = [
      { wch: 6 },  // N°
      { wch: 14 }, // FECHA
      { wch: 12 }, // DNI
      { wch: 36 }, // NOMBRES Y APELLIDOS
      { wch: 32 }, // CARGO / RUBRO
      { wch: 15 }, // HORA INGRESO
      { wch: 16 }, // FIRMA INGRESO
      { wch: 15 }, // HORA SALIDA
      { wch: 16 }, // FIRMA SALIDA
      { wch: 28 }, // HORAS CUMPLIDAS JORNADA
      { wch: 34 }, // TOTAL HORAS CUMPLIDAS PERSONA
      { wch: 20 }  // ESTADO
    ];

    // Single sheet append
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte_Asistencias');
    XLSX.writeFile(workbook, `Reporte_Asistencia_${cargo.replace(/\s+/g, '_')}.xlsx`);
    notify('Reporte generado en una sola hoja de Excel con el total de horas cumplidas por persona.', 'success');
  };

  // Export Hours Report to PDF with Signatures and Total Hours Completed per Person
  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const dates = selectedDateFilter === 'ALL' ? getUniqueDates() : [selectedDateFilter];

    let personnel = [...eligibleSorteos];
    if (selectedGroupFilter !== 'ALL') {
      personnel = personnel.filter(s => {
        const info = getPersonScheduleInfo(s, selectedDateFilter === 'ALL' ? undefined : selectedDateFilter);
        return info.grupo === selectedGroupFilter;
      });
    }
    if (selectedPersonFilter !== 'ALL') {
      personnel = personnel.filter(s => s.dni === selectedPersonFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      personnel = personnel.filter(s => s.nombres.toLowerCase().includes(q) || s.dni.includes(q));
    }

    personnel.sort((a, b) => {
      const infoA = getPersonScheduleInfo(a, selectedDateFilter === 'ALL' ? undefined : selectedDateFilter);
      const infoB = getPersonScheduleInfo(b, selectedDateFilter === 'ALL' ? undefined : selectedDateFilter);
      const grpComp = infoA.grupo.localeCompare(infoB.grupo, undefined, { numeric: true });
      if (grpComp !== 0) return grpComp;
      if (infoA.ordenPersona !== infoB.ordenPersona) return infoA.ordenPersona - infoB.ordenPersona;
      return a.nombres.localeCompare(b.nombres);
    });

    // Precalculate total hours per person across evaluated dates
    const personTotalsMap = new Map<string, { totalMinutes: number; formatted: string; decimalHours: string; daysAttended: number }>();
    personnel.forEach(s => {
      const res = calculatePersonTotalMinutes(s.dni, dates);
      personTotalsMap.set(s.dni, {
        totalMinutes: res.totalMinutes,
        formatted: res.formatted,
        decimalHours: res.decimalHours,
        daysAttended: res.daysAttended
      });
    });

    dates.forEach((dateStr, pageIndex) => {
      if (pageIndex > 0) {
        doc.addPage();
      }

      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(`REPORTE DE ASISTENCIA Y HORAS CUMPLIDAS - ${dateStr}`, 14, 14);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Proceso: ${procesoName} | Cargo: ${cargo} | Generado: ${new Date().toLocaleString()}`, 14, 20);

      const rowsMeta: { firmaIn?: string; firmaOut?: string }[] = [];

      const tableBody = personnel.map((s, index) => {
        const personRecords = records.filter(r => r.dni === s.dni && r.fecha === dateStr);
        const ingresoRecord = personRecords.find(r => r.tipo === 'INGRESO');
        const salidaRecord = personRecords.find(r => r.tipo === 'SALIDA');

        let horasJornadaStr = '00:00';
        if (ingresoRecord && salidaRecord) {
          try {
            const t1 = new Date(`${ingresoRecord.fecha}T${ingresoRecord.hora}`);
            const t2 = new Date(`${salidaRecord.fecha}T${salidaRecord.hora}`);
            const diffMs = t2.getTime() - t1.getTime();
            if (diffMs > 0) {
              const totalMinutes = Math.floor(diffMs / (1000 * 60));
              const hrs = Math.floor(totalMinutes / 60);
              const mins = totalMinutes % 60;
              horasJornadaStr = `${hrs.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m`;
            }
          } catch (e) {
            horasJornadaStr = 'Error';
          }
        }

        let estado = 'INASISTENTE';
        if (ingresoRecord && salidaRecord) estado = 'COMPLETO';
        else if (ingresoRecord) estado = 'EN CURSO';

        const totals = personTotalsMap.get(s.dni) || { totalMinutes: 0, formatted: '00h 00m', decimalHours: '0.00', daysAttended: 0 };

        rowsMeta.push({
          firmaIn: ingresoRecord?.firma,
          firmaOut: salidaRecord?.firma
        });

        const schedInfo = getPersonScheduleInfo(s, dateStr);
        const displayName = schedInfo.grupo && schedInfo.grupo !== 'Sin Grupo'
          ? `${s.nombres}\n[${schedInfo.grupo}${schedInfo.turno ? ` - ${schedInfo.turno}` : ''}]`
          : s.nombres;
        return [
          index + 1,
          s.dni,
          displayName,
          ingresoRecord ? ingresoRecord.hora : '-',
          ingresoRecord?.firma ? '' : '-', // Space for image
          salidaRecord ? salidaRecord.hora : '-',
          salidaRecord?.firma ? '' : '-',  // Space for image
          horasJornadaStr,
          totals.formatted,
          estado
        ];
      });

      autoTable(doc, {
        startY: 25,
        head: [['N°', 'DNI', 'Nombres y Apellidos', 'H. Ingreso', 'Firma IN', 'H. Salida', 'Firma OUT', 'Horas Día', 'Total Cumplidas', 'Estado']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 2, minCellHeight: 11, valign: 'middle' },
        columnStyles: {
          0: { halign: 'center', cellWidth: 8 },
          1: { halign: 'center', cellWidth: 20 },
          2: { cellWidth: 58 },
          3: { halign: 'center', cellWidth: 18 },
          4: { halign: 'center', cellWidth: 28 }, // Firma IN
          5: { halign: 'center', cellWidth: 18 },
          6: { halign: 'center', cellWidth: 28 }, // Firma OUT
          7: { halign: 'center', cellWidth: 22 },
          8: { halign: 'center', cellWidth: 26 }, // Total Horas Cumplidas
          9: { halign: 'center', cellWidth: 22 }
        },
        didDrawCell: (data) => {
          if (data.section === 'body') {
            const rowIdx = data.row.index;
            const meta = rowsMeta[rowIdx];
            if (!meta) return;

            // Column 4 is Firma IN
            if (data.column.index === 4 && meta.firmaIn) {
              try {
                doc.addImage(
                  meta.firmaIn,
                  'PNG',
                  data.cell.x + 3,
                  data.cell.y + 1,
                  22,
                  9
                );
              } catch (err) {
                console.warn('Error adding firmaIn to PDF cell:', err);
              }
            }

            // Column 6 is Firma OUT
            if (data.column.index === 6 && meta.firmaOut) {
              try {
                doc.addImage(
                  meta.firmaOut,
                  'PNG',
                  data.cell.x + 3,
                  data.cell.y + 1,
                  22,
                  9
                );
              } catch (err) {
                console.warn('Error adding firmaOut to PDF cell:', err);
              }
            }
          }
        }
      });
    });

    // Add a consolidated summary page if multiple dates or for complete executive overview
    if (dates.length > 1 || selectedDateFilter === 'ALL') {
      doc.addPage();
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(`RESUMEN CONSOLIDADO DE HORAS CUMPLIDAS POR PERSONAL`, 14, 14);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Proceso: ${procesoName} | Cargo: ${cargo} | Periodo evaluado: ${dates.length} fecha(s)`, 14, 20);

      const summaryBody = personnel.map((s, idx) => {
        const totals = personTotalsMap.get(s.dni) || { totalMinutes: 0, formatted: '00h 00m', decimalHours: '0.00', daysAttended: 0 };
        return [
          idx + 1,
          s.dni,
          s.nombres,
          s.cargo,
          `${totals.daysAttended} / ${dates.length}`,
          totals.formatted,
          `${totals.decimalHours} hrs`,
          totals.totalMinutes > 0 ? 'CON HORAS CUMPLIDAS' : 'SIN REGISTRO COMPLETO'
        ];
      });

      autoTable(doc, {
        startY: 25,
        head: [['N°', 'DNI', 'Nombres y Apellidos', 'Cargo Asignado', 'Días Asistidos', 'Horas Cumplidas', 'Horas Decimales', 'Condición']],
        body: summaryBody,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        styles: { fontSize: 8, cellPadding: 3, valign: 'middle' },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          1: { halign: 'center', cellWidth: 24 },
          2: { cellWidth: 70 },
          3: { cellWidth: 60 },
          4: { halign: 'center', cellWidth: 26 },
          5: { halign: 'center', cellWidth: 28 },
          6: { halign: 'center', cellWidth: 26 },
          7: { halign: 'center', cellWidth: 32 }
        }
      });
    }

    doc.save(`Planilla_Asistencia_Firmas_${cargo.replace(/\s+/g, '_')}.pdf`);
    notify('Planilla en PDF con firmas digitales y horas cumplidas por persona generada con éxito.', 'success');
  };

  if (!isOpen) return null;

  const todayStr = getTodayString();
  const todayMarks = records.filter(r => r.fecha === todayStr);
  const uniqueDates = getUniqueDates();
  const filteredRows = getFilteredAttendanceRows();

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-6xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* HEADER BAR */}
        <div className="bg-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 to-indigo-600 flex items-center justify-center text-white shadow-lg">
              <span className="material-symbols-outlined text-2xl">fingerprint</span>
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight leading-none text-white">
                Control de Asistencia
              </h2>
              <p className="text-xs text-slate-400 font-medium mt-1">
                REGISTRO DE INGRESOS Y SALIDAS DE PERSONAL - <span className="text-rose-400 font-bold uppercase">{cargo}</span> ({procesoName})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-800/80 p-1 rounded-2xl border border-slate-700">
            <button
              onClick={() => setActiveTab('kiosk')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'kiosk'
                  ? 'bg-white text-slate-900 shadow-md'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-sm">badge</span>
              MODO MARCADO
            </button>

            {canManageSorteo && (
              <button
                onClick={() => setActiveTab('history')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'history'
                    ? 'bg-white text-slate-900 shadow-md'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-sm">history_edu</span>
                REPORTES / PLANILLA
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-xl transition-colors ml-2"
              title="Cerrar"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50">
          
          {/* TAB 1: MODO MARCADO (KIOSK) */}
          {activeTab === 'kiosk' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* LEFT MAIN STATION: ESTACIÓN BIOMÉTRICA DE MARCADO DIRECTO (1:N) */}
              <div className="lg:col-span-8 flex flex-col gap-6">
                <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm text-center flex flex-col items-center justify-center relative overflow-hidden">
                  
                  {/* Decorative institutional bar */}
                  <div className="absolute top-0 left-0 right-0 h-2.5 bg-gradient-to-r from-rose-600 via-indigo-600 to-emerald-500" />

                  {/* Visual Sensor Hologram / LED Animation */}
                  <div className="relative my-3 flex items-center justify-center">
                    {(identifyStatus === 'SCANNING' || identifyStatus === 'LISTENING') && (
                      <div className="absolute w-28 h-28 rounded-full bg-emerald-500/20 animate-ping" />
                    )}
                    {identifyStatus === 'SUCCESS' && (
                      <div className="absolute w-28 h-28 rounded-full bg-emerald-500/30 animate-pulse" />
                    )}
                    {identifyStatus === 'NO_MATCH' && (
                      <div className="absolute w-28 h-28 rounded-full bg-rose-500/20 animate-pulse" />
                    )}

                    <div className={`w-24 h-24 rounded-3xl flex items-center justify-center border-2 transition-all duration-300 shadow-xl relative z-10 ${
                      identifyStatus === 'SUCCESS'
                        ? 'bg-emerald-500 border-emerald-600 text-white scale-105 shadow-emerald-500/30'
                        : identifyStatus === 'NO_MATCH'
                        ? 'bg-rose-500 border-rose-600 text-white shadow-rose-500/30'
                        : identifyStatus === 'ERROR'
                        ? 'bg-amber-500 border-amber-600 text-white shadow-amber-500/30'
                        : isListeningBiometric
                        ? 'bg-gradient-to-br from-emerald-600 to-teal-700 border-emerald-400 text-white ring-8 ring-emerald-100 shadow-emerald-500/20'
                        : 'bg-slate-100 border-slate-300 text-slate-400'
                    }`}>
                      <span className="material-symbols-outlined text-5xl">
                        {identifyStatus === 'SUCCESS'
                          ? 'check_circle'
                          : identifyStatus === 'NO_MATCH'
                          ? 'person_off'
                          : identifyStatus === 'ERROR'
                          ? 'sensors_off'
                          : 'fingerprint'}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mt-1">
                    Estación Biométrica de Marcado Rápido
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-1 mb-4 max-w-md">
                    {isListeningBiometric
                      ? 'Coloque su dedo sobre el sensor DigitalPersona. El sistema identificará su asignación automáticamente para firmar la planilla.'
                      : 'El sensor biométrico se encuentra en espera o desconectado.'}
                  </p>

                  {/* Estado en tiempo real del lector */}
                  <div className={`px-4 py-2.5 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2.5 max-w-md w-full transition-all ${
                    identifyStatus === 'SUCCESS'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : identifyStatus === 'NO_MATCH'
                      ? 'bg-rose-50 border-rose-300 text-rose-800'
                      : identifyStatus === 'ERROR'
                      ? 'bg-amber-50 border-amber-300 text-amber-800'
                      : isListeningBiometric
                      ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900 shadow-sm'
                      : 'bg-slate-100 border-slate-200 text-slate-600'
                  }`}>
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      isListeningBiometric ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'
                    }`} />
                    <span className="truncate">{identifyMessage}</span>
                  </div>

                  {/* Botones de control del sensor */}
                  <div className="flex items-center gap-3 mt-4">
                    {(!isListeningBiometric || identifyStatus === 'ERROR' || identifyStatus === 'IDLE') ? (
                      <button
                        type="button"
                        onClick={() => startBiometricIdentification(rubroTemplates)}
                        disabled={loadingTemplates}
                        className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-base">sensors</span>
                        {loadingTemplates ? 'Cargando plantillas...' : 'Reconectar / Activar Sensor'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={stopBiometricListening}
                        className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">pause</span>
                        Pausar Lector
                      </button>
                    )}
                  </div>

                  {/* Conteo de plantillas de este rubro */}
                  <div className="mt-6 px-4 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-[11px] font-bold text-slate-600 flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-emerald-600">fingerprint</span>
                    <span>Plantillas biométricas cargadas: <strong className="text-slate-900 font-black">{rubroTemplates.length} de {eligibleSorteos.length}</strong> personas con huella activa en este rubro</span>
                  </div>

                  {/* MECANISMO DE CONTINGENCIA: EXCLUSIVO DIRECTOR / ADMINISTRADOR */}
                  {isAdmin && (
                    <div className="w-full max-w-lg mt-6 pt-6 border-t border-slate-200/80 flex flex-col items-center">
                      <div className="w-full bg-amber-50/70 border border-amber-200/90 rounded-2xl p-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-left">
                            <span className="material-symbols-outlined text-amber-700 text-lg">admin_panel_settings</span>
                            <div>
                              <h4 className="text-xs font-black uppercase tracking-wider text-amber-950">
                                Mando de Contingencia Administrativa
                              </h4>
                              <p className="text-[10px] text-amber-800 font-medium">
                                Exclusivo Director / Administrador para casos de excepción
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setManualModalOpen(true)}
                              className="px-3 py-1.5 rounded-xl bg-white hover:bg-amber-100 text-amber-900 font-bold text-[10px] uppercase border border-amber-300 transition-all shadow-sm flex items-center gap-1"
                              title="Regularización Manual con Sello"
                            >
                              <span className="material-symbols-outlined text-xs text-indigo-600">edit_calendar</span>
                              Regularizar Manual
                            </button>

                            <button
                              type="button"
                              onClick={() => setShowAdminContingency(!showAdminContingency)}
                              className="px-3 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-[10px] uppercase transition-all shadow-sm flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-xs">
                                {showAdminContingency ? 'visibility_off' : 'pin'}
                              </span>
                              {showAdminContingency ? 'Ocultar DNI' : 'Digitar DNI'}
                            </button>
                          </div>
                        </div>

                        {showAdminContingency && (
                          <form onSubmit={handleAttemptMark} className="pt-2 border-t border-amber-200/60 flex flex-col gap-2.5 animate-in slide-in-from-top-2">
                            <div className="text-[10px] text-amber-900 bg-white/80 p-2 rounded-lg border border-amber-200 text-left">
                              ⚠️ <strong>Aviso de Auditoría:</strong> El ingreso manual por DNI se audita en la planilla como <code>MANUAL_DNI_ADMIN</code>.
                            </div>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={dniInput}
                                onChange={e => setDniInput(e.target.value)}
                                placeholder="Ingrese DNI de excepción..."
                                maxLength={12}
                                className="flex-1 text-center font-mono font-bold text-sm py-2 px-3 rounded-xl border border-amber-300 focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20 outline-none uppercase bg-white text-slate-900"
                              />
                              <button
                                type="submit"
                                className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white font-black text-[11px] uppercase tracking-wider rounded-xl shadow-sm transition-all flex items-center gap-1.5 shrink-0"
                              >
                                <span className="material-symbols-outlined text-sm">how_to_reg</span>
                                Marcar por DNI
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              </div>

              {/* RIGHT SIDEBAR: ACTIVIDAD DE HOY */}
              <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 flex flex-col h-full min-h-[420px]">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                    <span className="material-symbols-outlined text-rose-600 text-base">view_list</span>
                    ACTIVIDAD DE HOY
                  </div>
                  <span className="bg-rose-100 text-rose-700 text-[10px] font-black px-2.5 py-1 rounded-full uppercase">
                    {todayMarks.length} MARCAS
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[400px]">
                  {todayMarks.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
                      <span className="material-symbols-outlined text-4xl mb-2 opacity-50">search_off</span>
                      <p className="text-xs font-bold uppercase tracking-wider">SIN ACTIVIDAD AÚN</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Las marcas de asistencia del día aparecerán aquí en tiempo real.
                      </p>
                    </div>
                  ) : (
                    todayMarks.map(r => (
                      <div
                        key={r.id}
                        className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/60 flex items-center justify-between transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shadow-sm ${
                            r.tipo === 'INGRESO' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {r.tipo === 'INGRESO' ? 'IN' : 'OUT'}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900 leading-tight">
                              {r.nombre}
                            </p>
                            <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                              DNI: {r.dni}
                            </p>
                          </div>
                        </div>

                        <div className="text-right flex flex-col items-end">
                          <div className="flex items-center gap-1">
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                              r.tipo === 'INGRESO' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {r.tipo}
                            </span>
                            {r.metodo_validacion === 'HUELLA_Y_FIRMA' && (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-0.5" title="Validado con Huella Digital">
                                <span className="material-symbols-outlined text-[11px]">fingerprint</span>
                                Huella
                              </span>
                            )}
                            {r.metodo_validacion === 'MANUAL_DNI_ADMIN' && (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-0.5" title="Ingreso excepcional por DNI autorizado por Administrador">
                                <span className="material-symbols-outlined text-[11px]">admin_panel_settings</span>
                                DNI Admin
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-mono font-bold text-slate-700 mt-1">
                            {r.hora}
                          </span>
                          {r.firma && (
                            <button
                              onClick={() => setSelectedSignature({ id: r.id, personName: r.nombre, dni: r.dni, tipo: r.tipo, hora: r.hora, firma: r.firma! })}
                              className="text-[9px] text-indigo-600 hover:underline font-bold mt-1 flex items-center gap-0.5"
                            >
                              <span className="material-symbols-outlined text-[12px]">draw</span> Ver firma
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: REPORTES / HISTORIAL (ADMIN ONLY) */}
          {activeTab === 'history' && canManageSorteo && (
            <div className="flex flex-col gap-6">
              
              {/* Summary stat counters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                  <span className="text-xs font-bold text-slate-500 uppercase">Personal Sorteado</span>
                  <span className="text-2xl font-black text-slate-900 mt-1">
                    {selectedGroupFilter === 'ALL' ? eligibleSorteos.length : eligibleSorteos.filter(s => getPersonScheduleInfo(s, todayStr).grupo === selectedGroupFilter).length}
                  </span>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-emerald-200 shadow-sm flex flex-col bg-emerald-50/30">
                  <span className="text-xs font-bold text-emerald-700 uppercase">Asistieron Hoy (Ingresos)</span>
                  <span className="text-2xl font-black text-emerald-700 mt-1">
                    {new Set(todayMarks.filter(m => m.tipo === 'INGRESO').map(m => m.dni)).size}
                  </span>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-amber-200 shadow-sm flex flex-col bg-amber-50/30">
                  <span className="text-xs font-bold text-amber-700 uppercase">Salidas Registradas</span>
                  <span className="text-2xl font-black text-amber-700 mt-1">
                    {todayMarks.filter(m => m.tipo === 'SALIDA').length}
                  </span>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-rose-200 shadow-sm flex flex-col bg-rose-50/30">
                  <span className="text-xs font-bold text-rose-700 uppercase">Inasistentes Hoy</span>
                  <span className="text-2xl font-black text-rose-700 mt-1">
                    {eligibleSorteos.length - new Set(todayMarks.filter(m => m.tipo === 'INGRESO').map(m => m.dni)).size}
                  </span>
                </div>
              </div>

              {/* FILTERS & ACTION BAR */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h4 className="font-black text-sm text-slate-900 uppercase flex items-center gap-2">
                      <span className="material-symbols-outlined text-rose-600 text-lg">description</span>
                      Planilla de Asistencia y Firmas por Día
                    </h4>
                    <p className="text-xs text-slate-500">
                      Filtre por fecha o por persona específica y descargue reportes detallados con firma digital.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleExportExcel}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-base">table</span>
                      Exportar Excel (Hoja Única)
                    </button>
                    <button
                      onClick={handleExportPDF}
                      className="px-4 py-2 bg-slate-800 hover:bg-black text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                      Exportar PDF Con Firmas
                    </button>
                  </div>
                </div>

                {/* FILTER CONTROLS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Filtrar por Fecha (Día)
                    </label>
                    <select
                      value={selectedDateFilter}
                      onChange={e => setSelectedDateFilter(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 font-bold text-xs text-slate-800 bg-slate-50"
                    >
                      <option value="ALL">-- TODAS LAS FECHAS REGISTRADAS --</option>
                      {uniqueDates.map(d => (
                        <option key={d} value={d}>
                          Asistencia del {d} {d === todayStr ? '(HOY)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1 flex items-center justify-between">
                      <span>Filtrar por Grupo (Turno)</span>
                      {selectedGroupFilter !== 'ALL' && (
                        <span className="text-[9px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded">Activo</span>
                      )}
                    </label>
                    <select
                      value={selectedGroupFilter}
                      onChange={e => setSelectedGroupFilter(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs text-slate-800 bg-slate-50"
                    >
                      <option value="ALL">-- TODOS LOS GRUPOS ({availableGroups.length}) --</option>
                      {availableGroups.map(g => (
                        <option key={g} value={g}>
                          {g} ({groupMemberCounts[g] || 0} personas)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Filtrar por Persona
                    </label>
                    <select
                      value={selectedPersonFilter}
                      onChange={e => setSelectedPersonFilter(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 font-bold text-xs text-slate-800 bg-slate-50"
                    >
                      <option value="ALL">-- TODO EL PERSONAL ELIGIBLE --</option>
                      {eligibleSorteos.map(s => (
                        <option key={s.id} value={s.dni}>
                          {s.nombres} ({s.dni})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Buscar por Nombre o DNI
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Buscar personal..."
                        className="w-full p-2.5 pl-8 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 font-bold text-xs text-slate-800 bg-slate-50"
                      />
                      <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-base">
                        search
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Calculated hours table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-900 text-[10px] font-black text-slate-300 uppercase tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="p-3.5 text-center">N°</th>
                        <th className="p-3.5 text-center">Fecha</th>
                        <th className="p-3.5">Personal / DNI</th>
                        <th className="p-3.5 text-center">Hora Ingreso</th>
                        <th className="p-3.5 text-center">Firma Ingreso</th>
                        <th className="p-3.5 text-center">Hora Salida</th>
                        <th className="p-3.5 text-center">Firma Salida</th>
                        <th className="p-3.5 text-center">Horas Día</th>
                        <th className="p-3.5 text-center">Total Cumplidas</th>
                        <th className="p-3.5 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs text-slate-700 divide-y divide-slate-100">
                      {filteredRows.map((row, index) => {
                        const prevRow = index > 0 ? filteredRows[index - 1] : null;
                        const isNewGroup = !prevRow || prevRow.grupo !== row.grupo || prevRow.fecha !== row.fecha;
                        const hasGroups = availableGroups.length > 0 && row.grupo && row.grupo !== 'Sin Grupo';

                        return (
                          <React.Fragment key={`${row.fecha}_${row.dni}`}>
                            {isNewGroup && hasGroups && (
                              <tr className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border-y border-indigo-900/60 shadow-inner">
                                <td colSpan={10} className="py-2.5 px-4">
                                  <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div className="flex items-center gap-2.5">
                                      <span className="h-6 px-3 rounded-md bg-indigo-500 text-white flex items-center justify-center text-xs font-black tracking-wider uppercase shadow-sm">
                                        {row.grupo}
                                      </span>
                                      {row.turno && (
                                        <span className="text-[11px] font-bold text-indigo-200 bg-indigo-900/80 border border-indigo-700/80 px-2.5 py-0.5 rounded-md flex items-center gap-1.5 shadow-sm">
                                          <span className="material-symbols-outlined text-[13px] text-indigo-400">schedule</span>
                                          Turno / Horario Oficial: <strong className="text-white font-black">{row.turno}</strong>
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[10px] font-bold text-indigo-200/90 uppercase tracking-wider bg-white/5 border border-white/10 px-2 py-0.5 rounded">
                                      {groupMemberCounts[row.grupo] || ''} personas asignadas
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            )}
                            <tr className="hover:bg-slate-50 transition-colors">
                              <td className="p-3.5 text-center font-mono font-bold text-slate-400">{row.num}</td>
                              <td className="p-3.5 text-center font-mono font-bold text-indigo-900 bg-indigo-50/50 rounded-lg">{row.fecha}</td>
                              <td className="p-3.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="font-bold text-slate-900 leading-tight">{row.nombre}</p>
                                  {row.grupo && row.grupo !== 'Sin Grupo' && (
                                    <span className="text-[9px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded uppercase">
                                      {row.grupo}
                                    </span>
                                  )}
                                </div>
                                <p className="font-mono text-[10px] text-slate-500 mt-0.5">DNI: {row.dni}</p>
                              </td>
                          <td className="p-3.5 text-center font-mono font-bold text-emerald-700 bg-emerald-50/40">{row.ingreso}</td>
                          <td className="p-3.5 text-center">
                            {row.ingresoRecord?.firma ? (
                              <button
                                onClick={() => setSelectedSignature({ id: row.ingresoRecord!.id, personName: row.nombre, dni: row.dni, tipo: 'INGRESO', hora: row.ingresoRecord!.hora, firma: row.ingresoRecord!.firma! })}
                                className="group relative inline-block p-1 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl transition-all shadow-sm"
                                title="Click para ampliar firma de Ingreso"
                              >
                                <img src={row.ingresoRecord.firma} alt="Firma IN" className="h-7 w-20 object-contain mx-auto" />
                                <span className="text-[9px] font-bold text-emerald-700 block text-center mt-0.5">Firma IN</span>
                              </button>
                            ) : (
                              <span className="text-slate-400 font-mono text-[10px]">-</span>
                            )}
                          </td>
                          <td className="p-3.5 text-center font-mono font-bold text-amber-700 bg-amber-50/40">{row.salida}</td>
                          <td className="p-3.5 text-center">
                            {row.salidaRecord?.firma ? (
                              <button
                                onClick={() => setSelectedSignature({ id: row.salidaRecord!.id, personName: row.nombre, dni: row.dni, tipo: 'SALIDA', hora: row.salidaRecord!.hora, firma: row.salidaRecord!.firma! })}
                                className="group relative inline-block p-1 bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-300 rounded-xl transition-all shadow-sm"
                                title="Click para ampliar firma de Salida"
                              >
                                <img src={row.salidaRecord.firma} alt="Firma OUT" className="h-7 w-20 object-contain mx-auto" />
                                <span className="text-[9px] font-bold text-amber-700 block text-center mt-0.5">Firma OUT</span>
                              </button>
                            ) : (
                              <span className="text-slate-400 font-mono text-[10px]">-</span>
                            )}
                          </td>
                          <td className="p-3.5 text-center font-mono font-black text-slate-900">{row.horasTrabajadas}</td>
                          <td className="p-3.5 text-center font-mono font-black text-indigo-700 bg-indigo-50/40">{row.totalHorasPersona}</td>
                          <td className="p-3.5 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                              row.estado === 'COMPLETO' ? 'bg-emerald-100 text-emerald-700' :
                              row.estado === 'EN CURSO' ? 'bg-amber-100 text-amber-700' :
                              'bg-rose-100 text-rose-700'
                            }`}>
                              {row.estado}
                            </span>
                          </td>
                        </tr>
                          </React.Fragment>
                        );
                      })}
                      {filteredRows.length === 0 && (
                        <tr>
                          <td colSpan={10} className="p-8 text-center text-slate-400 font-bold uppercase text-xs">
                            No se encontraron registros de asistencia con los filtros seleccionados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>

      {/* SIGNATURE CANVAS MODAL */}
      {signatureModalOpen && pendingPerson && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col border border-slate-200">
            
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-rose-500 text-2xl">draw</span>
                <div>
                  <h3 className="font-black text-sm uppercase text-white">Firma Digital de Asistencia</h3>
                  <p className="text-xs text-slate-400 font-medium">REGISTRANDO: <span className={`font-black ${pendingTipo === 'INGRESO' ? 'text-emerald-400' : 'text-amber-400'}`}>{pendingTipo}</span></p>
                </div>
              </div>
              <button onClick={() => handleCloseSignatureModal()} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4 text-slate-800">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <p className="text-xs text-slate-500 font-bold uppercase">Personal</p>
                <p className="text-base font-black text-slate-900">{pendingPerson.nombres}</p>
                <p className="text-xs font-mono text-slate-600">DNI: {pendingPerson.dni} | {pendingPerson.cargo}</p>
              </div>

              <div>
                {/* TABS FOR CAPTURE METHOD (INDICATORS) */}
                <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
                  <div
                    className={`flex-1 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      modalStep === 'SIGNATURE' ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-500'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">draw</span> Firma Táctil
                  </div>
                  <div
                    className={`flex-1 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      modalStep === 'BIOMETRIC' ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-500'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">fingerprint</span> Huella Digital
                  </div>
                </div>

                {modalStep === 'SIGNATURE' ? (
                  <>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-slate-600 uppercase">Dibuje su firma abajo</label>
                      <button onClick={clearCanvas} className="text-xs font-bold text-rose-600 hover:underline flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-sm">cleaning_services</span> Limpiar
                      </button>
                    </div>

                    <div className="border-2 border-dashed border-slate-300 rounded-2xl bg-white p-1 relative touch-none shadow-inner">
                      <canvas
                        ref={canvasRef}
                        width={460}
                        height={180}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                        className="w-full h-[180px] bg-transparent cursor-crosshair rounded-xl"
                      />
                      {!hasSignature && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-300 text-xs font-bold uppercase tracking-wider">
                          Firme aquí usando mouse o pantalla táctil
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="border-2 border-dashed border-indigo-200 rounded-2xl bg-indigo-50/50 p-6 flex flex-col items-center justify-center text-center min-h-[220px]">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-all ${
                      fingerprintStatus === 'SUCCESS' ? 'bg-emerald-100 text-emerald-600' :
                      fingerprintStatus === 'ERROR' ? 'bg-rose-100 text-rose-600' :
                      fingerprintStatus === 'SCANNING' ? 'bg-indigo-200 text-indigo-700 animate-pulse' :
                      'bg-indigo-100 text-indigo-500'
                    }`}>
                      <span className="material-symbols-outlined text-4xl">
                        {fingerprintStatus === 'SUCCESS' ? 'check_circle' : fingerprintStatus === 'ERROR' ? 'error' : 'fingerprint'}
                      </span>
                    </div>
                    
                    <h4 className="font-black text-slate-800 text-sm uppercase">
                      Lector DigitalPersona U.are.U 4500
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 font-medium max-w-[280px]">
                      {fingerprintStatus === 'IDLE' && 'Presione el botón para inicializar la captura biométrica.'}
                      {fingerprintStatus === 'SCANNING' && 'Coloque su dedo sobre el lector ahora...'}
                      {fingerprintStatus === 'SUCCESS' && 'Huella capturada y validada correctamente.'}
                      {fingerprintStatus === 'ERROR' && 'La huella no coincide o lectura falló.'}
                    </p>

                    {fingerprintStatus === 'ERROR' && (
                      <div className="flex items-center gap-2 mt-4">
                        <button 
                          onClick={() => checkBiometricAndProceed(pendingPerson, pendingTipo)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3.5 rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">refresh</span>
                          Reintentar
                        </button>
                        <button 
                          onClick={() => {
                            setBiometricMethod('SOLO_FIRMA');
                            setModalStep('SIGNATURE');
                          }}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-3.5 rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">draw</span>
                          Continuar solo con Firma
                        </button>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => handleCloseSignatureModal()}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmSignature}
                disabled={!hasSignature}
                className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white shadow-lg transition-all flex items-center gap-2 ${
                  hasSignature ? 'bg-rose-600 hover:bg-rose-700 active:scale-95' : 'bg-slate-300 cursor-not-allowed'
                }`}
              >
                <span className="material-symbols-outlined text-base">save</span>
                Confirmar y Guardar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MANUAL REGULARIZATION MODAL */}
      {manualModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-black text-sm uppercase flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-400">edit_calendar</span>
                Regularización Manual
              </h3>
              <button onClick={() => setManualModalOpen(false)} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-600 uppercase mb-1">Personal Sorteado *</label>
                <select
                  value={manualForm.dni}
                  onChange={e => setManualForm({ ...manualForm, dni: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 font-bold text-slate-800"
                >
                  <option value="">-- SELECCIONAR PERSONAL --</option>
                  {eligibleSorteos.map(s => (
                    <option key={s.id} value={s.dni}>
                      {s.nombres} ({s.dni})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-600 uppercase mb-1">Tipo de Marca *</label>
                <select
                  value={manualForm.tipo}
                  onChange={e => setManualForm({ ...manualForm, tipo: e.target.value as any })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 font-bold text-slate-800"
                >
                  <option value="INGRESO">INGRESO</option>
                  <option value="SALIDA">SALIDA</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">Fecha</label>
                  <input
                    type="date"
                    value={manualForm.fecha}
                    onChange={e => setManualForm({ ...manualForm, fecha: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">Hora (HH:MM)</label>
                  <input
                    type="time"
                    value={manualForm.hora}
                    onChange={e => setManualForm({ ...manualForm, hora: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block font-bold text-slate-600 uppercase">Firma de Constancia (Opcional)</label>
                  <button onClick={clearManualCanvas} className="text-[11px] font-bold text-rose-600 hover:underline flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-xs">cleaning_services</span> Limpiar
                  </button>
                </div>
                <div className="border-2 border-dashed border-slate-300 rounded-2xl bg-white p-1 relative touch-none shadow-inner">
                  <canvas
                    ref={manualCanvasRef}
                    width={400}
                    height={120}
                    onMouseDown={startManualDrawing}
                    onMouseMove={drawManual}
                    onMouseUp={stopManualDrawing}
                    onMouseLeave={stopManualDrawing}
                    onTouchStart={startManualDrawing}
                    onTouchMove={drawManual}
                    onTouchEnd={stopManualDrawing}
                    className="w-full h-[120px] bg-transparent cursor-crosshair rounded-xl"
                  />
                  {!manualHasSignature && (
                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-slate-400 text-[10px] font-bold uppercase tracking-wider text-center p-2">
                      <span>Firme aquí si el personal está presente</span>
                      <span className="text-[9px] text-indigo-600 font-normal mt-0.5 normal-case">(o déjelo en blanco para generar un Sello de Validación Administrativa automático)</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setManualModalOpen(false)} className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-xl">
                Cancelar
              </button>
              <button onClick={handleSaveManualRecord} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md">
                Guardar Marca Manual
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW SIGNATURE POPUP MODAL */}
      {selectedSignature && (
        <div className="fixed inset-0 z-[350] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 flex flex-col items-center text-center">
            <h3 className="font-black text-sm uppercase text-slate-900">Firma Digital Registrada</h3>
            <p className="text-xs font-bold text-rose-600 mt-1">{selectedSignature.personName}</p>
            <p className="text-[10px] font-mono text-slate-500">DNI: {selectedSignature.dni} | {selectedSignature.tipo} - {selectedSignature.hora}</p>

            <div className="my-4 p-3 bg-slate-50 border border-slate-200 rounded-2xl w-full flex items-center justify-center">
              <img src={selectedSignature.firma} alt="Firma Digital" className="max-h-36 object-contain" />
            </div>

            <div className="w-full flex gap-2">
              <button
                onClick={() => setSelectedSignature(null)}
                className="flex-1 py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-black"
              >
                Cerrar
              </button>
              {canManageSorteo && (
                <button
                  onClick={() => handleDeleteRecord(selectedSignature.id)}
                  className="px-4 py-2.5 bg-rose-50 text-rose-600 font-bold text-xs rounded-xl hover:bg-rose-100 hover:text-rose-700 flex items-center justify-center gap-1 transition-colors"
                  title="Eliminar Asistencia"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
