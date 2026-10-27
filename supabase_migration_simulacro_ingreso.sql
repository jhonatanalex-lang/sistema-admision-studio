-- =====================================================================================
-- MIGRACIÓN / ACTUALIZACIÓN: MÓDULO DE CONTROL DE INGRESO DE POSTULANTES
-- Universidad Nacional de San Antonio Abad del Cusco (UNSAAC) - Dirección de Admisión
-- =====================================================================================

-- =========================================================================
-- PARTE A: ACTUALIZACIÓN DE TABLA EXISTENTE (Ejecuta esto si ya creaste la tabla)
-- =========================================================================

-- 1. Asegurar campo carrera si aún no estuviera presente
ALTER TABLE public.simulacro_postulantes 
ADD COLUMN IF NOT EXISTS carrera TEXT DEFAULT '';

-- 2. Agregar campo unificado nombres_apellidos
ALTER TABLE public.simulacro_postulantes 
ADD COLUMN IF NOT EXISTS nombres_apellidos TEXT DEFAULT '';

-- 3. Migrar nombres y apellidos existentes al campo único nombres_apellidos
UPDATE public.simulacro_postulantes 
SET nombres_apellidos = TRIM(CONCAT(COALESCE(apellidos, ''), ' ', COALESCE(nombres, '')))
WHERE (nombres_apellidos IS NULL OR nombres_apellidos = '')
  AND (apellidos IS NOT NULL OR nombres IS NOT NULL);

-- 4. Hacer que apellidos y nombres sean opcionales para permitir guardar directamente en nombres_apellidos
ALTER TABLE public.simulacro_postulantes ALTER COLUMN apellidos DROP NOT NULL;
ALTER TABLE public.simulacro_postulantes ALTER COLUMN nombres DROP NOT NULL;


-- =========================================================================
-- PARTE B: DEFINICIÓN COMPLETA (Para nuevas instalaciones)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.simulacros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    estado TEXT NOT NULL DEFAULT 'Activo',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.simulacro_postulantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    simulacro_id UUID REFERENCES public.simulacros(id) ON DELETE CASCADE,
    dni TEXT NOT NULL,
    nombres_apellidos TEXT NOT NULL,
    apellidos TEXT DEFAULT '',
    nombres TEXT DEFAULT '',
    sede TEXT DEFAULT '',
    aula TEXT DEFAULT '',
    carpeta TEXT DEFAULT '',
    carrera TEXT DEFAULT '',
    grupo TEXT DEFAULT '',
    ingreso_registrado BOOLEAN DEFAULT FALSE,
    hora_ingreso TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_simulacro_dni UNIQUE (simulacro_id, dni)
);

CREATE INDEX IF NOT EXISTS idx_simulacro_postulantes_dni ON public.simulacro_postulantes(simulacro_id, dni);
CREATE INDEX IF NOT EXISTS idx_simulacro_postulantes_sede ON public.simulacro_postulantes(simulacro_id, sede);
CREATE INDEX IF NOT EXISTS idx_simulacro_postulantes_ingreso ON public.simulacro_postulantes(simulacro_id, ingreso_registrado);

ALTER TABLE public.simulacros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulacro_postulantes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir select para todos en simulacros" ON public.simulacros;
DROP POLICY IF EXISTS "Permitir insert para todos en simulacros" ON public.simulacros;
DROP POLICY IF EXISTS "Permitir update para todos en simulacros" ON public.simulacros;
DROP POLICY IF EXISTS "Permitir delete para todos en simulacros" ON public.simulacros;

DROP POLICY IF EXISTS "Permitir select para todos en simulacro_postulantes" ON public.simulacro_postulantes;
DROP POLICY IF EXISTS "Permitir insert para todos en simulacro_postulantes" ON public.simulacro_postulantes;
DROP POLICY IF EXISTS "Permitir update para todos en simulacro_postulantes" ON public.simulacro_postulantes;
DROP POLICY IF EXISTS "Permitir delete para todos en simulacro_postulantes" ON public.simulacro_postulantes;

CREATE POLICY "Permitir select para todos en simulacros" ON public.simulacros FOR SELECT USING (true);
CREATE POLICY "Permitir insert para todos en simulacros" ON public.simulacros FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir update para todos en simulacros" ON public.simulacros FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Permitir delete para todos en simulacros" ON public.simulacros FOR DELETE USING (true);

CREATE POLICY "Permitir select para todos en simulacro_postulantes" ON public.simulacro_postulantes FOR SELECT USING (true);
CREATE POLICY "Permitir insert para todos en simulacro_postulantes" ON public.simulacro_postulantes FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir update para todos en simulacro_postulantes" ON public.simulacro_postulantes FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Permitir delete para todos en simulacro_postulantes" ON public.simulacro_postulantes FOR DELETE USING (true);

GRANT ALL ON public.simulacros TO anon, authenticated, service_role;
GRANT ALL ON public.simulacro_postulantes TO anon, authenticated, service_role;
