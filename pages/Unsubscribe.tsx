import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export const Unsubscribe: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const id = searchParams.get('id');

  useEffect(() => {
    if (!id) {
      setStatus('error');
      setErrorMessage('Enlace inválido o no se proporcionó el ID del prospecto.');
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [id]);

  const handleUnsubscribe = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('prospectos_vocacionales')
        .update({ suscrito: false })
        .eq('id', id);

      if (error) throw error;
      
      setStatus('success');
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMessage('Ocurrió un error al procesar tu solicitud. Intenta nuevamente o contacta a soporte.');
    } finally {
      setLoading(false);
    }
  };

  if (loading && status === 'idle') {
    return (
      <div className="min-h-screen bg-[#090d16] flex flex-col items-center justify-center p-4 select-none">
        <div className="flex flex-col items-center animate-pulse">
          <div className="w-20 h-20 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center p-3 shadow-2xl mb-4">
            <img
              src="/logo_admision.png"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (!target.src.includes('googleusercontent')) {
                  target.src = 'https://lh3.googleusercontent.com/d/1yN0_dziHYCbHPOnDb1Y7qYvHno-mUY7M';
                }
              }}
              alt="Admisión UNSAAC"
              className="w-full h-full object-contain filter drop-shadow-md"
            />
          </div>
          <span className="text-[10px] font-medium tracking-[0.25em] text-slate-400 uppercase">
            UNSAAC
          </span>
          <h1 className="text-sm font-semibold tracking-[0.14em] text-white uppercase mt-1">
            Dirección de Admisión
          </h1>
          <div className="mt-6 flex flex-col items-center gap-2">
            <div className="w-32 h-[2px] bg-white/10 rounded-full overflow-hidden">
              <div className="h-full w-1/3 bg-white/85 rounded-full animate-pulse" />
            </div>
            <p className="text-[11px] font-normal tracking-wide text-slate-400">
              Gestionando suscripción...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white p-8 md:p-12 rounded-2xl shadow-xl max-w-lg w-full text-center border border-slate-100">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-3xl">unsubscribe</span>
        </div>
        
        <h1 className="text-2xl font-black text-slate-800 mb-4 tracking-tight">Darse de Baja</h1>
        
        {status === 'success' ? (
          <div>
            <p className="text-emerald-600 bg-emerald-50 p-4 rounded-xl text-sm font-medium border border-emerald-100 mb-6">
              Tu correo electrónico ha sido dado de baja exitosamente. Ya no recibirás más notificaciones automatizadas.
            </p>
            <p className="text-sm text-slate-500">
              Esperamos verte pronto en la UNSAAC.
            </p>
          </div>
        ) : status === 'error' ? (
          <div>
            <p className="text-red-600 bg-red-50 p-4 rounded-xl text-sm font-medium border border-red-100 mb-6">
              {errorMessage}
            </p>
          </div>
        ) : (
          <div>
            <p className="text-slate-600 mb-8 leading-relaxed">
              ¿Estás seguro de que deseas cancelar tu suscripción? Dejarás de recibir notificaciones, recordatorios, y novedades sobre nuestros procesos de admisión.
            </p>
            <button
              onClick={handleUnsubscribe}
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 px-6 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-xl">block</span>
              )}
              {loading ? 'Procesando...' : 'Sí, Darse de Baja'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
