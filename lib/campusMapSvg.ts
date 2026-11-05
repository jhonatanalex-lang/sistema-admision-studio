/**
 * Módulo de Croquis Vectorial de Ciudad Universitaria Perayoc (UNSAAC)
 * Diseñado para impresión térmica en blanco y negro (1-bit) de 80mm.
 * Basado en el Plano Oficial de Edificaciones Existentes de la Unidad Formuladora UNSAAC.
 */

export type DoorId = 'P1' | 'P2' | 'P4' | 'P6';

export interface DoorInfo {
  id: DoorId;
  number: number;
  label: string;
  avenue: string;
  reference: string;
  x: number;
  y: number;
}

export const OFFICIAL_DOORS: Record<DoorId, DoorInfo> = {
  P1: {
    id: 'P1',
    number: 1,
    label: 'PUERTA N° 1',
    avenue: 'Av. Haya de la Torre',
    reference: 'Altura del pabellón de Medicina Humana',
    x: 342,
    y: 110
  },
  P2: {
    id: 'P2',
    number: 2,
    label: 'PUERTA N° 2',
    avenue: 'Av. La Cultura',
    reference: 'Altura del pabellón de Enfermería',
    x: 245,
    y: 205
  },
  P4: {
    id: 'P4',
    number: 4,
    label: 'PUERTA N° 4',
    avenue: 'Av. La Cultura',
    reference: 'Altura del Pabellón del Centro de Idiomas',
    x: 75,
    y: 205
  },
  P6: {
    id: 'P6',
    number: 6,
    label: 'PUERTA N° 6',
    avenue: 'Av. Universitaria',
    reference: 'Costado de Urb. Mariscal Gamarra',
    x: 20,
    y: 75
  }
};

export interface Pavilion {
  code: string;
  num: number;
  name: string;
  short: string;
  x: number;
  y: number;
  w: number;
  h: number;
  entryX: number;
  entryY: number;
  keywords: string[];
}

export const CAMPUS_PAVILIONS: Pavilion[] = [
  {
    code: 'ARQ',
    num: 13,
    name: 'Arquitectura',
    short: 'ARQ (13)',
    x: 105,
    y: 95,
    w: 36,
    h: 26,
    entryX: 123,
    entryY: 122,
    keywords: ['arquitectura', 'arq']
  },
  {
    code: 'ECON',
    num: 20,
    name: 'Economía',
    short: 'ECON (20)',
    x: 172,
    y: 155,
    w: 32,
    h: 26,
    entryX: 188,
    entryY: 154,
    keywords: ['economia', 'economía', 'eco']
  },
  {
    code: 'DER',
    num: 30,
    name: 'Derecho',
    short: 'DER (30)',
    x: 215,
    y: 105,
    w: 32,
    h: 22,
    entryX: 231,
    entryY: 128,
    keywords: ['derecho', 'der']
  },
  {
    code: 'MED',
    num: 37,
    name: 'Medicina Humana',
    short: 'MED (37)',
    x: 295,
    y: 105,
    w: 38,
    h: 24,
    entryX: 295,
    entryY: 117,
    keywords: ['medicina', 'medicina humana', 'med']
  },
  {
    code: 'ENF',
    num: 34,
    name: 'Enfermería',
    short: 'ENF (34)',
    x: 265,
    y: 165,
    w: 34,
    h: 24,
    entryX: 265,
    entryY: 177,
    keywords: ['enfermeria', 'enfermería', 'enf']
  },
  {
    code: 'ELEC',
    num: 43,
    name: 'Ing. Eléctrica y Electrónica',
    short: 'ELECT (43)',
    x: 300,
    y: 55,
    w: 34,
    h: 28,
    entryX: 300,
    entryY: 70,
    keywords: ['electrica', 'eléctrica', 'electronica', 'electrónica']
  },
  {
    code: 'CIVIL',
    num: 9,
    name: 'Ingeniería Civil',
    short: 'CIVIL (9)',
    x: 150,
    y: 95,
    w: 32,
    h: 24,
    entryX: 166,
    entryY: 120,
    keywords: ['civil', 'ing. civil', 'octogonos', 'octógonos']
  },
  {
    code: 'INF',
    num: 35,
    name: 'Ingeniería Informática y Sistemas',
    short: 'INFORM (35)',
    x: 195,
    y: 55,
    w: 34,
    h: 24,
    entryX: 212,
    entryY: 80,
    keywords: ['informatica', 'informática', 'sistemas', 'computo', 'cómputo']
  },
  {
    code: 'PAB_C',
    num: 16,
    name: 'Pabellón C',
    short: 'PAB-C (16)',
    x: 145,
    y: 130,
    w: 28,
    h: 20,
    entryX: 159,
    entryY: 130,
    keywords: ['pabellon c', 'pabellón c', 'pab-c', 'pab c']
  },
  {
    code: 'CONTAB',
    num: 19,
    name: 'Ciencias Contables',
    short: 'CONTAB (19)',
    x: 215,
    y: 165,
    w: 32,
    h: 24,
    entryX: 231,
    entryY: 164,
    keywords: ['contabilidad', 'contables', 'ciencias contables', 'cont']
  },
  {
    code: 'COMUN',
    num: 45,
    name: 'Ciencias de la Comunicación',
    short: 'COMUN (45)',
    x: 130,
    y: 160,
    w: 32,
    h: 22,
    entryX: 146,
    entryY: 160,
    keywords: ['comunicacion', 'comunicación', 'ciencias de la comunicacion']
  },
  {
    code: 'SOC',
    num: 3,
    name: 'Ciencias Sociales',
    short: 'SOCIAL (3)',
    x: 55,
    y: 145,
    w: 34,
    h: 24,
    entryX: 72,
    entryY: 144,
    keywords: ['sociales', 'ciencias sociales', 'antropologia', 'antropología', 'arqueologia', 'arqueología', 'historia']
  },
  {
    code: 'FARM',
    num: 18,
    name: 'Farmacia y Bioquímica',
    short: 'FARM (18)',
    x: 95,
    y: 165,
    w: 30,
    h: 22,
    entryX: 110,
    entryY: 164,
    keywords: ['farmacia', 'bioquimica', 'bioquímica', 'farmacia y bioquimica']
  },
  {
    code: 'EDUC',
    num: 21,
    name: 'Educación',
    short: 'EDUC (21)',
    x: 255,
    y: 135,
    w: 30,
    h: 22,
    entryX: 270,
    entryY: 134,
    keywords: ['educacion', 'educación', 'pedagogia']
  },
  {
    code: 'CEPRU',
    num: 28,
    name: 'CEPRU',
    short: 'CEPRU (28)',
    x: 155,
    y: 45,
    w: 32,
    h: 22,
    entryX: 171,
    entryY: 68,
    keywords: ['cepru', 'aulas cepru']
  },
  {
    code: 'MEC',
    num: 42,
    name: 'Ingeniería Mecánica',
    short: 'MECAN (42)',
    x: 255,
    y: 65,
    w: 32,
    h: 22,
    entryX: 271,
    entryY: 88,
    keywords: ['mecanica', 'mecánica']
  },
  {
    code: 'QUIM',
    num: 5,
    name: 'Ing. Química y Química',
    short: 'QUÍM (5)',
    x: 220,
    y: 45,
    w: 30,
    h: 20,
    entryX: 235,
    entryY: 66,
    keywords: ['quimica', 'química', 'ing. quimica']
  },
  {
    code: 'MINAS',
    num: 40,
    name: 'Minas / Metalúrgica / Geológica',
    short: 'MINAS (40)',
    x: 295,
    y: 30,
    w: 40,
    h: 22,
    entryX: 315,
    entryY: 53,
    keywords: ['minas', 'metalurgica', 'metalúrgica', 'geologia', 'geología', 'geologica']
  },
  {
    code: 'IDIOMAS',
    num: 1,
    name: 'Centro de Idiomas',
    short: 'IDIOM (1)',
    x: 45,
    y: 180,
    w: 32,
    h: 22,
    entryX: 61,
    entryY: 180,
    keywords: ['idiomas', 'centro de idiomas']
  },
  {
    code: 'BIBLIO',
    num: 31,
    name: 'Biblioteca Central',
    short: 'BIBLIO (31)',
    x: 260,
    y: 105,
    w: 28,
    h: 22,
    entryX: 274,
    entryY: 128,
    keywords: ['biblioteca', 'biblioteca central']
  }
];

/**
 * Identifica el pabellón a partir de los datos disponibles del postulante
 */
export function resolvePavilion(postulante: {
  carrera?: string;
  aula?: string;
  pabellon?: string;
  nombre_pabellon?: string;
}): Pavilion {
  const normalize = (s?: string) =>
    (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const searchPabellon = normalize(postulante.pabellon || postulante.nombre_pabellon);
  const searchAula = normalize(postulante.aula);
  const searchCarrera = normalize(postulante.carrera);

  // 1. Prioridad: Coincidencia por nombre de pabellón explícito
  if (searchPabellon) {
    for (const p of CAMPUS_PAVILIONS) {
      if (p.keywords.some(kw => searchPabellon.includes(kw))) {
        return p;
      }
    }
  }

  // 2. Coincidencia por código o texto en el campo Aula (ej: "ARQ-101", "PAB-C-15", "DER-202")
  if (searchAula) {
    for (const p of CAMPUS_PAVILIONS) {
      if (p.keywords.some(kw => searchAula.includes(kw))) {
        return p;
      }
    }
  }

  // 3. Coincidencia por Escuela Profesional / Carrera del postulante
  if (searchCarrera) {
    for (const p of CAMPUS_PAVILIONS) {
      if (p.keywords.some(kw => searchCarrera.includes(kw))) {
        return p;
      }
    }
  }

  // Fallback: Pabellón C (pabellón genérico central de aulas)
  return CAMPUS_PAVILIONS.find(p => p.code === 'PAB_C') || CAMPUS_PAVILIONS[0];
}

/**
 * Determina si la sede corresponde a Cusco / Sede Central
 */
export function isSedeCusco(sede?: string): boolean {
  if (!sede) return true; // Por defecto si no se especifica se asume Sede Central
  const s = sede.toLowerCase().trim();
  return s === 'cusco' || s === 'sede central' || s === 'perayoc' || s.includes('central');
}

/**
 * Calcula los puntos de la polilínea de ruta desde la puerta hasta el pabellón
 */
function calculateRoutePoints(door: DoorInfo, target: Pavilion): string {
  const points: [number, number][] = [];
  points.push([door.x, door.y]);

  // Ejes viales principales del croquis (coordenadas de pasajes internos)
  const ejeCentralY = 135;
  const ejeNorteY = 88;
  const ejeSurY = 190;
  const ejeOesteX = 45;
  const ejeEsteX = 320;
  const ejeCentroX = 188;

  if (door.id === 'P1') {
    // Entra por Av. Haya de la Torre (este)
    points.push([320, door.y]);
    if (target.entryY < ejeCentralY) {
      points.push([320, target.entryY]);
      points.push([target.entryX, target.entryY]);
    } else {
      points.push([320, ejeCentralY]);
      points.push([target.entryX, ejeCentralY]);
      points.push([target.entryX, target.entryY]);
    }
  } else if (door.id === 'P2') {
    // Entra por Av. La Cultura (sur / Enfermería)
    points.push([door.x, ejeSurY]);
    if (target.x > 210) {
      points.push([target.entryX, ejeSurY]);
      points.push([target.entryX, target.entryY]);
    } else {
      points.push([ejeCentroX, ejeSurY]);
      points.push([ejeCentroX, target.entryY]);
      points.push([target.entryX, target.entryY]);
    }
  } else if (door.id === 'P4') {
    // Entra por Av. La Cultura (sur / Idiomas)
    points.push([door.x, ejeSurY]);
    if (target.x < 130) {
      points.push([target.entryX, ejeSurY]);
      points.push([target.entryX, target.entryY]);
    } else {
      points.push([ejeCentroX, ejeSurY]);
      points.push([ejeCentroX, target.entryY]);
      points.push([target.entryX, target.entryY]);
    }
  } else if (door.id === 'P6') {
    // Entra por Av. Universitaria (oeste / Mariscal Gamarra)
    points.push([ejeOesteX, door.y]);
    if (target.y < ejeCentralY) {
      points.push([ejeOesteX, ejeNorteY]);
      points.push([target.entryX, ejeNorteY]);
      points.push([target.entryX, target.entryY]);
    } else {
      points.push([ejeOesteX, ejeCentralY]);
      points.push([target.entryX, ejeCentralY]);
      points.push([target.entryX, target.entryY]);
    }
  }

  return points.map(p => `${Math.round(p[0])},${Math.round(p[1])}`).join(' ');
}

/**
 * Genera el texto explicativo de orientación paso a paso
 */
export function generateRouteInstructions(doorId: DoorId, target: Pavilion): string {
  const door = OFFICIAL_DOORS[doorId] || OFFICIAL_DOORS.P2;
  const targetName = target.name.toUpperCase();

  switch (door.id) {
    case 'P1':
      return `De PUERTA N° 1 (${door.avenue}): Ingrese y avance hacia el interior. El pabellón de ${targetName} se encuentra en el sector ${target.x < 200 ? 'central-oeste' : 'este'}.`;
    case 'P2':
      return `De PUERTA N° 2 (${door.avenue}): Ingrese recto hacia la plaza central. Gire hacia ${target.x < 240 ? 'la izquierda' : 'la derecha'} para llegar a ${targetName}.`;
    case 'P4':
      return `De PUERTA N° 4 (${door.avenue}): Ingrese y avance bordeando Idiomas. Diríjase recto hacia ${targetName}.`;
    case 'P6':
      return `De PUERTA N° 6 (${door.avenue}): Ingrese y avance por la vía principal hacia el ${target.y > 120 ? 'sur' : 'este'} en dirección a ${targetName}.`;
  }
}

/**
 * Genera el código SVG del croquis de Ciudad Universitaria Perayoc de alto contraste
 * optimizado para ticketeras térmicas de 80mm (ancho efectivo 72mm).
 */
export function generateCampusRouteSvg(doorId: DoorId, target: Pavilion): string {
  const door = OFFICIAL_DOORS[doorId] || OFFICIAL_DOORS.P2;
  const routePoints = calculateRoutePoints(door, target);

  // Renderizado de todos los pabellones
  const pavilionsSvg = CAMPUS_PAVILIONS.map(p => {
    const isTarget = p.code === target.code;
    if (isTarget) {
      // Pabellón Destino: Relleno Negro Sólido con texto invertido en blanco
      return `
        <g id="target-${p.code}">
          <rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="#000000" stroke="#000000" stroke-width="2" rx="2" />
          <text x="${p.x + p.w / 2}" y="${p.y + p.h / 2 + 3}" fill="#ffffff" font-family="'Segoe UI', Arial, sans-serif" font-size="7" font-weight="900" text-anchor="middle">${p.short}</text>
          <!-- Indicador Pin Destino -->
          <circle cx="${p.entryX}" cy="${p.entryY}" r="4" fill="#000000" stroke="#ffffff" stroke-width="1.5" />
          <circle cx="${p.entryX}" cy="${p.entryY}" r="1.5" fill="#ffffff" />
        </g>
      `;
    } else {
      // Otros pabellones: Contorno Negro Nítido con fondo blanco
      return `
        <g id="pab-${p.code}">
          <rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="#ffffff" stroke="#000000" stroke-width="1" rx="1.5" />
          <text x="${p.x + p.w / 2}" y="${p.y + p.h / 2 + 2.5}" fill="#000000" font-family="'Segoe UI', Arial, sans-serif" font-size="6" font-weight="700" text-anchor="middle">${p.short}</text>
        </g>
      `;
    }
  }).join('');

  // Renderizado de las 4 puertas oficiales
  const doorsSvg = (Object.keys(OFFICIAL_DOORS) as DoorId[]).map(id => {
    const d = OFFICIAL_DOORS[id];
    const isCurrent = d.id === door.id;

    if (isCurrent) {
      // Puerta Activa de Ingreso: Círculo Negro con Letra Blanca
      return `
        <g id="door-active-${d.id}">
          <circle cx="${d.x}" cy="${d.y}" r="8" fill="#000000" stroke="#000000" stroke-width="1.5" />
          <text x="${d.x}" y="${d.y + 3}" fill="#ffffff" font-family="'Segoe UI', Arial, sans-serif" font-size="7.5" font-weight="900" text-anchor="middle">P${d.number}</text>
        </g>
      `;
    } else {
      // Otras puertas: Contorno
      return `
        <g id="door-${d.id}">
          <circle cx="${d.x}" cy="${d.y}" r="6" fill="#ffffff" stroke="#000000" stroke-width="1" stroke-dasharray="2,1" />
          <text x="${d.x}" y="${d.y + 2.5}" fill="#000000" font-family="'Segoe UI', Arial, sans-serif" font-size="6.5" font-weight="700" text-anchor="middle">P${d.number}</text>
        </g>
      `;
    }
  }).join('');

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 235" width="100%" height="auto" style="background:#ffffff; display:block; margin:4px auto; max-width:72mm;">
      <defs>
        <!-- Flecha marcadora de fin de ruta -->
        <marker id="route-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#000000" />
        </marker>
      </defs>

      <!-- Borde Perimetral del Campus -->
      <rect x="25" y="22" width="315" height="182" fill="#ffffff" stroke="#000000" stroke-width="1.5" rx="4" />

      <!-- Veredas y Pasajes Internos (Líneas finas de circulación) -->
      <g stroke="#000000" stroke-width="0.75" stroke-dasharray="1.5,1.5" opacity="0.6">
        <!-- Eje horizontal principal -->
        <line x1="25" y1="135" x2="340" y2="135" />
        <!-- Eje secundario norte -->
        <line x1="25" y1="88" x2="340" y2="88" />
        <!-- Eje sur de acceso -->
        <line x1="25" y1="190" x2="340" y2="190" />
        <!-- Conectores verticales -->
        <line x1="188" y1="22" x2="188" y2="204" />
        <line x1="90" y1="22" x2="90" y2="204" />
        <line x1="280" y1="22" x2="280" y2="204" />
      </g>

      <!-- Nombres de Avenidas Limítrofes (Rotulación en Negro Puro) -->
      <text x="180" y="14" fill="#000000" font-family="'Segoe UI', Arial, sans-serif" font-size="8" font-weight="900" text-anchor="middle" letter-spacing="0.5">AV. COLLASUYO</text>
      <text x="180" y="224" fill="#000000" font-family="'Segoe UI', Arial, sans-serif" font-size="8" font-weight="900" text-anchor="middle" letter-spacing="0.5">AV. LA CULTURA</text>
      
      <text x="12" y="125" fill="#000000" font-family="'Segoe UI', Arial, sans-serif" font-size="7" font-weight="900" text-anchor="middle" transform="rotate(-90 12,125)">AV. UNIVERSITARIA</text>
      <text x="352" y="125" fill="#000000" font-family="'Segoe UI', Arial, sans-serif" font-size="7" font-weight="900" text-anchor="middle" transform="rotate(90 352,125)">AV. HAYA DE LA TORRE</text>

      <!-- Pabellones del Campus -->
      ${pavilionsSvg}

      <!-- Línea de Ruta Activa desde Puerta hasta Pabellón -->
      <polyline points="${routePoints}" fill="none" stroke="#000000" stroke-width="2.5" stroke-dasharray="4,2.5" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#route-arrow)" />

      <!-- Puertas Oficiales -->
      ${doorsSvg}

      <!-- Leyenda Rápida en la esquina superior izquierda -->
      <g transform="translate(30, 26)">
        <rect x="0" y="0" width="85" height="15" fill="#ffffff" stroke="#000000" stroke-width="0.75" />
        <circle cx="8" cy="7.5" r="3.5" fill="#000000" />
        <text x="16" y="10.5" fill="#000000" font-family="'Segoe UI', Arial, sans-serif" font-size="6" font-weight="900">INGRESO: ${door.label}</text>
      </g>
    </svg>
  `;
}
