export interface OutgoingDestinationMeta {
  tipo_documento?: string;
  estudiante_nombre?: string;
  estudiante_nombre_original?: string;
  estudiante_nombre_corregido?: string;
  estudiante_dni?: string;
  carrera?: string;
  modalidad?: string;
  semestre?: string;
  expediente_numero?: string;
  recibo_pago?: string;
  usuario_nombre?: string;
  usuario_iniciales?: string;
  fecha_emision?: string;
  codigo_verificacion?: string;
  destino_oficina?: string;
  [key: string]: any;
}

const extractRegexField = (source: string, fieldName: string): string => {
  const regex = new RegExp(`"${fieldName}"\\s*:\\s*"([^"]*)"`, 'i');
  const match = source.match(regex);
  return match?.[1]?.trim() || '';
};

/**
 * Detecta si el valor de `destination` en `expedientes_salida` contiene JSON serializado
 * (incluso si tiene espacios iniciales, mayúsculas forzadas o truncamiento parcial).
 */
export const isSerializedJsonDestination = (raw?: string | null): boolean => {
  if (!raw) return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return true;
  if (/\{\s*"(?:tipo_documento|estudiante_nombre|estudiante_dni|codigo_verificacion)"/i.test(trimmed)) {
    return true;
  }
  return false;
};

/**
 * Parsea de forma segura los metadatos estructurados almacenados en `expedientes_salida.destination`.
 * Soporta claves en minúsculas o mayúsculas e incluye respaldo por expresiones regulares si el JSON estuviese truncado.
 */
export const parseOutgoingDestinationMeta = (raw?: string | null): OutgoingDestinationMeta | null => {
  if (!raw || !isSerializedJsonDestination(raw)) return null;

  const trimmed = raw.trim();
  const jsonStart = trimmed.indexOf('{');
  const candidate = jsonStart >= 0 ? trimmed.slice(jsonStart) : trimmed;

  try {
    const parsed = JSON.parse(candidate);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const normalized: OutgoingDestinationMeta = { ...parsed };
      const getVal = (key: string): string => {
        const lower = parsed[key];
        const upper = parsed[key.toUpperCase()];
        const val = lower !== undefined ? lower : upper;
        return typeof val === 'string' ? val.trim() : val != null ? String(val).trim() : '';
      };

      normalized.tipo_documento = getVal('tipo_documento') || undefined;
      normalized.estudiante_nombre = getVal('estudiante_nombre') || undefined;
      normalized.estudiante_nombre_original = getVal('estudiante_nombre_original') || undefined;
      normalized.estudiante_nombre_corregido = getVal('estudiante_nombre_corregido') || undefined;
      normalized.estudiante_dni = getVal('estudiante_dni') || undefined;
      normalized.carrera = getVal('carrera') || undefined;
      normalized.modalidad = getVal('modalidad') || undefined;
      normalized.semestre = getVal('semestre') || undefined;
      normalized.expediente_numero = getVal('expediente_numero') || undefined;
      normalized.recibo_pago = getVal('recibo_pago') || undefined;
      normalized.usuario_nombre = getVal('usuario_nombre') || undefined;
      normalized.usuario_iniciales = getVal('usuario_iniciales') || undefined;
      normalized.fecha_emision = getVal('fecha_emision') || undefined;
      normalized.codigo_verificacion = getVal('codigo_verificacion') || undefined;
      normalized.destino_oficina = getVal('destino_oficina') || undefined;

      return normalized;
    }
  } catch {
    // Respaldo tolerante a fallos si algún registro antiguo tuviera JSON incompleto o mal escapado
    const fallbackMeta: OutgoingDestinationMeta = {
      tipo_documento: extractRegexField(candidate, 'tipo_documento') || undefined,
      estudiante_nombre:
        extractRegexField(candidate, 'estudiante_nombre') ||
        extractRegexField(candidate, 'estudiante_nombre_corregido') ||
        extractRegexField(candidate, 'estudiante_nombre_original') ||
        undefined,
      estudiante_dni: extractRegexField(candidate, 'estudiante_dni') || undefined,
      carrera: extractRegexField(candidate, 'carrera') || undefined,
      modalidad: extractRegexField(candidate, 'modalidad') || undefined,
      semestre: extractRegexField(candidate, 'semestre') || undefined,
      expediente_numero: extractRegexField(candidate, 'expediente_numero') || undefined,
      usuario_nombre: extractRegexField(candidate, 'usuario_nombre') || undefined,
      codigo_verificacion: extractRegexField(candidate, 'codigo_verificacion') || undefined,
      destino_oficina: extractRegexField(candidate, 'destino_oficina') || undefined
    };

    if (Object.values(fallbackMeta).some(Boolean)) {
      return fallbackMeta;
    }
  }

  return {};
};

/**
 * Convierte cualquier valor de `expedientes_salida.destination` en una etiqueta legible y limpia para interfaz,
 * reportes PDF y auditoría, garantizando que jamás se muestre código JSON crudo al usuario.
 */
export const formatOutgoingDestination = (raw?: string | null, fallback = '-'): string => {
  if (!raw) return fallback;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '-') return fallback;

  if (isSerializedJsonDestination(trimmed)) {
    const meta = parseOutgoingDestinationMeta(trimmed);
    if (meta) {
      const office = (meta.destino_oficina || '').trim().toUpperCase();
      const student = (
        meta.estudiante_nombre ||
        meta.estudiante_nombre_corregido ||
        meta.estudiante_nombre_original ||
        ''
      ).trim();
      const dni = (meta.estudiante_dni || '').trim();
      const docType = (meta.tipo_documento || '').trim();

      if (office && office !== 'ESTUDIANTE' && student) {
        return `${office} • ESTUDIANTE: ${student}${dni ? ` (DNI: ${dni})` : ''}`;
      }
      if (student) {
        return `ESTUDIANTE: ${student}${dni ? ` (DNI: ${dni})` : ''}`;
      }
      if (office) {
        return office;
      }
      if (docType) {
        return `TRÁMITE: ${docType}`;
      }
    }
    return 'ESTUDIANTE / DIRECCIÓN DE ADMISIÓN';
  }

  return trimmed;
};

/**
 * Obtiene el nombre limpio de oficina para poblar selectores/inputs al editar un expediente de salida,
 * evitando inyectar JSON crudo o etiquetas compuestas "ESTUDIANTE: ..." como oficinas nuevas.
 */
export const extractOutgoingOfficeDestination = (raw?: string | null): string => {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '-') return '';

  if (isSerializedJsonDestination(trimmed)) {
    const meta = parseOutgoingDestinationMeta(trimmed);
    return (meta?.destino_oficina || 'ESTUDIANTE').trim().toUpperCase();
  }

  if (trimmed.toUpperCase().startsWith('ESTUDIANTE:')) {
    return 'ESTUDIANTE';
  }

  return trimmed.toUpperCase();
};

/**
 * Al actualizar un expediente de salida cuyos metadatos provienen de una plantilla oficial (JSON),
 * conserva intactos todos los metadatos de verificación QR/auditoría y actualiza únicamente `destino_oficina`.
 */
export const mergeOutgoingDestinationOffice = (
  existingRaw: string | null | undefined,
  selectedOffice: string
): string => {
  const cleanOffice = selectedOffice.trim().toUpperCase() || 'UNIDAD DE ADMISIÓN';

  if (existingRaw && isSerializedJsonDestination(existingRaw)) {
    try {
      const trimmed = existingRaw.trim();
      const jsonStart = trimmed.indexOf('{');
      const parsed = JSON.parse(jsonStart >= 0 ? trimmed.slice(jsonStart) : trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return JSON.stringify({
          ...parsed,
          destino_oficina: cleanOffice
        });
      }
    } catch {
      const meta = parseOutgoingDestinationMeta(existingRaw);
      if (meta && Object.keys(meta).length > 0) {
        return JSON.stringify({
          ...meta,
          destino_oficina: cleanOffice
        });
      }
    }
  }

  return cleanOffice;
};

/**
 * Formatea limpiamente la combinación de `doc_type` y `doc_number` evitando redundancias como
 * "INFORME DE RENUNCIA INFORME 136-2026" -> "INFORME DE RENUNCIA • N° 136-2026".
 */
export const formatOutgoingDocTitle = (docType?: string | null, docNumber?: string | null): string => {
  const t = (docType || '').trim();
  const n = (docNumber || '').trim();

  if (!t && !n) return 'DOCUMENTO';
  if (!t) return n;
  if (!n) return t;

  const tUpper = t.toUpperCase();
  const nUpper = n.toUpperCase();

  if (tUpper === nUpper) return t;

  if (tUpper === 'INFORME' && /^INFORME\b/i.test(n)) {
    const cleanNum = n.replace(/^INFORME\s*(?:N[°º.]?\s*)?/i, '').trim();
    return cleanNum ? `INFORME N° ${cleanNum}` : n.toUpperCase();
  }

  if (tUpper.includes('INFORME') && /^INFORME\s+/i.test(n)) {
    const cleanNum = n.replace(/^INFORME\s*(?:N[°º.]?\s*)?/i, '').trim();
    return cleanNum ? `${t} • N° ${cleanNum}` : t;
  }

  if (tUpper === 'OFICIO' && /^OFICIO\b/i.test(n)) {
    const cleanNum = n.replace(/^OFICIO\s*(?:N[°º.]?\s*)?/i, '').trim();
    return cleanNum ? `OFICIO N° ${cleanNum}` : n.toUpperCase();
  }

  if (tUpper.includes('OFICIO') && /^OFICIO\s+/i.test(n)) {
    const cleanNum = n.replace(/^OFICIO\s*(?:N[°º.]?\s*)?/i, '').trim();
    return cleanNum ? `${t} • N° ${cleanNum}` : t;
  }

  if (tUpper.includes('CONSTANCIA') && nUpper.startsWith('UNSAAC-')) {
    return `${t} • ${n}`;
  }

  return `${t} ${n}`;
};
