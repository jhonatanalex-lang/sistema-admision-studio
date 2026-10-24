-- =====================================================================================
-- MIGRACIÓN: MÓDULO DE CALIFICACIÓN Y RESULTADOS DE SIMULACROS
-- Universidad Nacional de San Antonio Abad del Cusco (UNSAAC) - Dirección de Admisión
-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.simulacro_calificaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    simulacro_id UUID NOT NULL REFERENCES public.simulacros(id) ON DELETE CASCADE,
    archivo_nombre TEXT,
    configuracion JSONB DEFAULT '{}'::jsonb,
    resultados JSONB DEFAULT '[]'::jsonb,
    fecha_calificacion TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_simulacro_calificacion UNIQUE (simulacro_id)
);

CREATE INDEX IF NOT EXISTS idx_simulacro_calificaciones_sim_id 
ON public.simulacro_calificaciones(simulacro_id);

ALTER TABLE public.simulacro_calificaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir select para todos en simulacro_calificaciones" ON public.simulacro_calificaciones;
DROP POLICY IF EXISTS "Permitir insert para todos en simulacro_calificaciones" ON public.simulacro_calificaciones;
DROP POLICY IF EXISTS "Permitir update para todos en simulacro_calificaciones" ON public.simulacro_calificaciones;
DROP POLICY IF EXISTS "Permitir delete para todos en simulacro_calificaciones" ON public.simulacro_calificaciones;

CREATE POLICY "Permitir select para todos en simulacro_calificaciones" ON public.simulacro_calificaciones FOR SELECT USING (true);
CREATE POLICY "Permitir insert para todos en simulacro_calificaciones" ON public.simulacro_calificaciones FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir update para todos en simulacro_calificaciones" ON public.simulacro_calificaciones FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Permitir delete para todos en simulacro_calificaciones" ON public.simulacro_calificaciones FOR DELETE USING (true);

GRANT ALL ON public.simulacro_calificaciones TO anon, authenticated, service_role;
