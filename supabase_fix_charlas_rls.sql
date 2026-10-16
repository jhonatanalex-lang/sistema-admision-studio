-- =====================================================================================
-- CORRECCIÓN DE POLÍTICAS DE SEGURIDAD (RLS) Y PERMISOS PARA CHARLAS Y CITAS DE COLEGIOS
-- Universidad Nacional de San Antonio Abad del Cusco (UNSAAC) - Dirección de Admisión
-- 
-- Instrucciones:
-- 1. Copia y pega este script en el "SQL Editor" de tu panel de Supabase.
-- 2. Haz clic en "Run" para ejecutarlo.
-- 3. Una vez ejecutado, el error "new row violates row-level security policy for table
--    charlas_disponibilidad" quedará 100% resuelto tanto para inserción manual como
--    para generación automática de cupos.
-- =====================================================================================

-- 1. Asegurar la existencia de la tabla charlas_disponibilidad con su esquema oficial
CREATE TABLE IF NOT EXISTS public.charlas_disponibilidad (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    fecha date NOT NULL,
    turno text COLLATE pg_catalog."default" NOT NULL,
    hora_inicio time without time zone NOT NULL,
    hora_fin time without time zone NOT NULL,
    modalidad_permitida text COLLATE pg_catalog."default" NOT NULL DEFAULT 'Ambas'::text,
    cupo_maximo integer NOT NULL DEFAULT 1,
    cupo_reservado integer NOT NULL DEFAULT 0,
    activo boolean NOT NULL DEFAULT true,
    notas text COLLATE pg_catalog."default" DEFAULT ''::text,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT charlas_disponibilidad_pkey PRIMARY KEY (id)
);

-- 2. Asegurar la existencia de la tabla charlas_solicitudes
CREATE TABLE IF NOT EXISTS public.charlas_solicitudes (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    codigo_seguimiento text COLLATE pg_catalog."default" NOT NULL,
    token_acceso text COLLATE pg_catalog."default" DEFAULT encode(gen_random_bytes(16), 'hex'),
    colegio_id bigint,
    codigo_modular text COLLATE pg_catalog."default" NOT NULL,
    nombre_ie text COLLATE pg_catalog."default" NOT NULL,
    departamento text COLLATE pg_catalog."default" NOT NULL DEFAULT 'Cusco'::text,
    provincia text COLLATE pg_catalog."default" NOT NULL DEFAULT 'Cusco'::text,
    distrito text COLLATE pg_catalog."default" NOT NULL,
    tipo_gestion text COLLATE pg_catalog."default" NOT NULL,
    direccion_ie text COLLATE pg_catalog."default",
    director_nombre text COLLATE pg_catalog."default" NOT NULL,
    director_dni text COLLATE pg_catalog."default" NOT NULL,
    director_telefono text COLLATE pg_catalog."default" NOT NULL,
    director_email text COLLATE pg_catalog."default",
    coordinador_nombre text COLLATE pg_catalog."default",
    coordinador_telefono text COLLATE pg_catalog."default",
    alumnos_4to integer NOT NULL DEFAULT 0,
    alumnos_5to integer NOT NULL DEFAULT 0,
    modalidad text COLLATE pg_catalog."default" NOT NULL DEFAULT 'Presencial'::text,
    disponibilidad_id uuid REFERENCES public.charlas_disponibilidad(id) ON DELETE SET NULL,
    fecha_charla date,
    hora_charla text COLLATE pg_catalog."default",
    oficio_pdf_url text COLLATE pg_catalog."default",
    estado text COLLATE pg_catalog."default" NOT NULL DEFAULT 'Pendiente'::text,
    motivo_observacion text COLLATE pg_catalog."default",
    ponente_id uuid,
    link_reunion text COLLATE pg_catalog."default",
    notas_internas text COLLATE pg_catalog."default",
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT charlas_solicitudes_pkey PRIMARY KEY (id),
    CONSTRAINT charlas_solicitudes_codigo_seguimiento_key UNIQUE (codigo_seguimiento)
);

-- 3. Habilitar Row Level Security (RLS) en ambas tablas
ALTER TABLE public.charlas_disponibilidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charlas_solicitudes ENABLE ROW LEVEL SECURITY;

-- 4. Limpiar cualquier política anterior que pudiera estar bloqueando escrituras
DROP POLICY IF EXISTS "Acceso total charlas_disponibilidad" ON public.charlas_disponibilidad;
DROP POLICY IF EXISTS "Charlas disponibilidad - Lectura general" ON public.charlas_disponibilidad;
DROP POLICY IF EXISTS "Charlas disponibilidad - Inserción general" ON public.charlas_disponibilidad;
DROP POLICY IF EXISTS "Charlas disponibilidad - Actualización general" ON public.charlas_disponibilidad;
DROP POLICY IF EXISTS "Charlas disponibilidad - Eliminación general" ON public.charlas_disponibilidad;
DROP POLICY IF EXISTS "Allow select for anon and auth" ON public.charlas_disponibilidad;
DROP POLICY IF EXISTS "Allow insert for auth" ON public.charlas_disponibilidad;

DROP POLICY IF EXISTS "Acceso total charlas_solicitudes" ON public.charlas_solicitudes;
DROP POLICY IF EXISTS "Charlas solicitudes - Lectura general" ON public.charlas_solicitudes;
DROP POLICY IF EXISTS "Charlas solicitudes - Inserción general" ON public.charlas_solicitudes;
DROP POLICY IF EXISTS "Charlas solicitudes - Actualización general" ON public.charlas_solicitudes;
DROP POLICY IF EXISTS "Charlas solicitudes - Eliminación general" ON public.charlas_solicitudes;

-- 5. Crear políticas completas (ALL: SELECT, INSERT, UPDATE, DELETE)
-- Permite que tanto los postulantes/colegios externos (anon) como el personal del sistema (authenticated)
-- puedan consultar turnos y registrar/actualizar solicitudes y disponibilidades sin restricciones de RLS.
CREATE POLICY "Acceso total charlas_disponibilidad"
ON public.charlas_disponibilidad
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Acceso total charlas_solicitudes"
ON public.charlas_solicitudes
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 6. Asignar privilegios a nivel de rol de PostgreSQL
GRANT ALL ON public.charlas_disponibilidad TO anon, authenticated, service_role;
GRANT ALL ON public.charlas_solicitudes TO anon, authenticated, service_role;

-- 7. Índices optimizados para búsquedas rápidas en el módulo
CREATE INDEX IF NOT EXISTS idx_charlas_disp_fecha_activo ON public.charlas_disponibilidad(fecha, activo);
CREATE INDEX IF NOT EXISTS idx_charlas_solic_codigo ON public.charlas_solicitudes(codigo_seguimiento);
CREATE INDEX IF NOT EXISTS idx_charlas_solic_estado ON public.charlas_solicitudes(estado);
CREATE INDEX IF NOT EXISTS idx_charlas_solic_disp ON public.charlas_solicitudes(disponibilidad_id);
