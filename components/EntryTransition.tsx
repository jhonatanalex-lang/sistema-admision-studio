import React, { useEffect, useState } from 'react';

export interface EntryTransitionProps {
  /**
   * Cuando es `true`, indica que la aplicación o verificación de sesión está lista
   * e inicia el desvanecimiento suave (fade-out) nativo.
   */
  isReady: boolean;
  /**
   * Callback ejecutado una vez culminada la animación de desvanecimiento
   * para desmontar completamente el componente del DOM.
   */
  onComplete?: () => void;
  message?: string;
  subMessage?: string;
  /**
   * Duración en milisegundos de la animación de fade-out (por defecto 500ms).
   */
  fadeDurationMs?: number;
}

export const EntryTransition: React.FC<EntryTransitionProps> = ({
  isReady,
  onComplete,
  message = 'Verificando sesión institucional...',
  subMessage = 'Dirección de Admisión · UNSAAC',
  fadeDurationMs = 450,
}) => {
  const [isExiting, setIsExiting] = useState(false);
  const [isRendered, setIsRendered] = useState(true);

  // Sincronización transparente con el preloader nativo de HTML
  useEffect(() => {
    const staticEl = document.getElementById('unsaac-static-preloader');
    if (staticEl) {
      staticEl.remove();
    }
  }, []);

  // Manejar el inicio del desvanecimiento cuando isReady pasa a true
  useEffect(() => {
    if (isReady && !isExiting) {
      setIsExiting(true);
      const timer = setTimeout(() => {
        setIsRendered(false);
        if (onComplete) {
          onComplete();
        }
      }, fadeDurationMs);

      return () => clearTimeout(timer);
    }
  }, [isReady, isExiting, fadeDurationMs, onComplete]);

  if (!isRendered) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center select-none bg-[#090d16] transition-opacity ease-out ${
        isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
      }`}
      style={{
        transitionDuration: `${fadeDurationMs}ms`,
        willChange: 'opacity',
      }}
    >
      {/* Contenedor central continuo (sin reinicio abrupto de animación a 0) */}
      <div className="flex flex-col items-center">
        {/* Emblema oficial enmarcado con sobriedad y elegancia */}
        <div className="relative mb-6 flex items-center justify-center">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center p-3.5 shadow-2xl backdrop-blur-sm">
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
        </div>

        {/* Tipografía institucional sobria (estilo minimalista Spotify / Disney+) */}
        <div className="flex flex-col items-center text-center px-4">
          <span className="text-[11px] font-medium tracking-[0.28em] text-slate-400 uppercase">
            UNSAAC
          </span>
          <h1 className="text-lg sm:text-xl font-semibold tracking-[0.14em] text-white uppercase mt-1">
            Dirección de Admisión
          </h1>
        </div>

        {/* Micro-indicador lineal de progreso (2px de espesor) */}
        <div className="mt-8 flex flex-col items-center gap-2.5">
          <div className="w-32 h-[2px] bg-white/10 rounded-full overflow-hidden">
            <div className="h-full w-1/3 bg-white/85 rounded-full animate-[entryMinimalBar_1.2s_ease-in-out_infinite]" />
          </div>

          <p className="text-[11px] font-normal tracking-wide text-slate-500">
            {message}
          </p>
        </div>
      </div>

      {/* Pie de pantalla institucional discreto */}
      <div className="absolute bottom-6 text-[10px] tracking-widest text-slate-600 font-mono">
        SISTEMA DE GESTIÓN DE ADMISIÓN
      </div>

      <style>{`
        @keyframes entryMinimalBar {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(100%);
          }
          100% {
            transform: translateX(300%);
          }
        }
      `}</style>
    </div>
  );
};

export default EntryTransition;
