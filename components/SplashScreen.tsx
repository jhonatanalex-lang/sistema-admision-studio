import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  message?: string;
  subMessage?: string;
  onFinished?: () => void;
  minDurationMs?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  message = "Iniciando plataforma...",
  subMessage = "Dirección de Admisión · UNSAAC",
  onFinished,
  minDurationMs = 850,
}) => {
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsFadingOut(true);
      if (onFinished) {
        setTimeout(onFinished, 300);
      }
    }, minDurationMs);

    return () => clearTimeout(timer);
  }, [minDurationMs, onFinished]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center select-none transition-opacity duration-300 ease-out ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        backgroundColor: '#090d16',
      }}
    >
      {/* Contenedor central sobrio y minimalista */}
      <div className="flex flex-col items-center animate-[splashEnter_0.6s_cubic-bezier(0.16,1,0.3,1)_forwards]">
        {/* Emblema oficial enmarcado con sutileza */}
        <div className="relative mb-6 flex items-center justify-center">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center p-3.5 shadow-2xl backdrop-blur-sm">
            <img
              src="/logo_admision.png"
              onError={(e) => {
                // Fallback directo en caso de resolución de ruta relativa
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

        {/* Tipografía institucional sobria (estilo Disney / Spotify) */}
        <div className="flex flex-col items-center text-center px-4">
          <span className="text-[11px] font-medium tracking-[0.25em] text-slate-400 uppercase">
            UNSAAC
          </span>
          <h1 className="text-lg sm:text-xl font-semibold tracking-[0.14em] text-white uppercase mt-1">
            Dirección de Admisión
          </h1>
        </div>

        {/* Barra de progreso minimalista (Línea sobria de 2px) */}
        <div className="mt-8 flex flex-col items-center gap-2.5">
          <div className="w-32 h-[2px] bg-white/10 rounded-full overflow-hidden">
            <div className="h-full w-1/3 bg-white/80 rounded-full animate-[minimalLoader_1.2s_ease-in-out_infinite]" />
          </div>

          <p className="text-[11px] font-normal tracking-wide text-slate-500">
            {message}
          </p>
        </div>
      </div>

      {/* Pie de pantalla discreto */}
      <div className="absolute bottom-6 text-[10px] tracking-wider text-slate-600 font-mono">
        SISTEMA DE GESTIÓN DE ADMISIÓN
      </div>

      <style>{`
        @keyframes splashEnter {
          0% {
            opacity: 0;
            transform: scale(0.96);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes minimalLoader {
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

export default SplashScreen;
