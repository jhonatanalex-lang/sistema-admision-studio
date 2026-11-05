/**
 * Módulo de Croquis Vectorial de Ciudad Universitaria Perayoc (UNSAAC)
 * Diseñado para impresión térmica en blanco y negro (1-bit) de 80mm.
 * Escala 1:1 optimizada para cabezal térmico de 576 puntos (72mm imprimibles).
 * Tipografía ampliada de alta legibilidad, números oficiales y trazado grueso de rutas.
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
  badgeX: number;
  badgeY: number;
}

export const OFFICIAL_DOORS: Record<DoorId, DoorInfo> = {
  "P1": {
    "id": "P1",
    "number": 1,
    "label": "PUERTA N° 1",
    "avenue": "Av. Haya de la Torre",
    "reference": "Altura del pabellón de Medicina Humana",
    "x": 539,
    "y": 294,
    "badgeX": 520,
    "badgeY": 200
  },
  "P2": {
    "id": "P2",
    "number": 2,
    "label": "PUERTA N° 2",
    "avenue": "Av. La Cultura",
    "reference": "Altura del pabellón de Enfermería",
    "x": 390,
    "y": 384,
    "badgeX": 390,
    "badgeY": 366
  },
  "P4": {
    "id": "P4",
    "number": 4,
    "label": "PUERTA N° 4",
    "avenue": "Av. La Cultura",
    "reference": "Altura del Pabellón del Centro de Idiomas",
    "x": 201,
    "y": 389,
    "badgeX": 130,
    "badgeY": 366
  },
  "P6": {
    "id": "P6",
    "number": 6,
    "label": "PUERTA N° 6",
    "avenue": "Av. Universitaria",
    "reference": "Costado de Urb. Mariscal Gamarra",
    "x": 39,
    "y": 173,
    "badgeX": 58,
    "badgeY": 140
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
    "code": "ARQ",
    "num": 13,
    "name": "Arquitectura",
    "short": "ARQUITECTURA",
    "x": 125,
    "y": 74,
    "w": 85,
    "h": 55,
    "entryX": 167,
    "entryY": 129,
    "keywords": [
      "arquitectura",
      "arq"
    ]
  },
  {
    "code": "ECON",
    "num": 20,
    "name": "Economía",
    "short": "ECONOMÍA",
    "x": 274,
    "y": 241,
    "w": 75,
    "h": 41,
    "entryX": 311,
    "entryY": 241,
    "keywords": [
      "economia",
      "economía",
      "eco"
    ]
  },
  {
    "code": "CONTAB",
    "num": 19,
    "name": "Ciencias Contables",
    "short": "CONTABILIDAD",
    "x": 285,
    "y": 302,
    "w": 82,
    "h": 36,
    "entryX": 300,
    "entryY": 297,
    "keywords": [
      "contabilidad",
      "contables",
      "ciencias contables",
      "cont"
    ]
  },
  {
    "code": "DER",
    "num": 30,
    "name": "Derecho",
    "short": "DERECHO",
    "x": 307,
    "y": 118,
    "w": 72,
    "h": 36,
    "entryX": 342,
    "entryY": 157,
    "keywords": [
      "derecho",
      "der"
    ]
  },
  {
    "code": "ENF",
    "num": 34,
    "name": "Enfermería",
    "short": "ENFERMERÍA",
    "x": 386,
    "y": 293,
    "w": 75,
    "h": 35,
    "entryX": 388,
    "entryY": 314,
    "keywords": [
      "enfermeria",
      "enfermería",
      "enf"
    ]
  },
  {
    "code": "ELEC",
    "num": 43,
    "name": "Ing. Eléctrica y Electrónica",
    "short": "ING. ELÉCTRICA",
    "x": 417,
    "y": 163,
    "w": 80,
    "h": 35,
    "entryX": 407,
    "entryY": 187,
    "keywords": [
      "electrica",
      "eléctrica",
      "electronica",
      "electrónica"
    ]
  },
  {
    "code": "CIVIL",
    "num": 35,
    "name": "Ingeniería Civil",
    "short": "ING. CIVIL",
    "x": 228,
    "y": 82,
    "w": 72,
    "h": 48,
    "entryX": 266,
    "entryY": 130,
    "keywords": [
      "civil",
      "ing. civil",
      "octogonos",
      "octógonos"
    ]
  },
  {
    "code": "INF",
    "num": 44,
    "name": "Ingeniería Informática y Sistemas",
    "short": "INFORMÁTICA",
    "x": 394,
    "y": 335,
    "w": 75,
    "h": 35,
    "entryX": 420,
    "entryY": 331,
    "keywords": [
      "informatica",
      "informática",
      "sistemas",
      "computo",
      "cómputo"
    ]
  },
  {
    "code": "QUIM",
    "num": 5,
    "name": "Ing. Química y Química",
    "short": "ING. QUÍMICA",
    "x": 123,
    "y": 163,
    "w": 75,
    "h": 37,
    "entryX": 160,
    "entryY": 211,
    "keywords": [
      "quimica",
      "química",
      "ing. quimica"
    ]
  },
  {
    "code": "MEC",
    "num": 42,
    "name": "Ingeniería Mecánica",
    "short": "ING. MECÁNICA",
    "x": 404,
    "y": 200,
    "w": 85,
    "h": 30,
    "entryX": 444,
    "entryY": 191,
    "keywords": [
      "mecanica",
      "mecánica"
    ]
  },
  {
    "code": "MINAS",
    "num": 40,
    "name": "ING. MiNAS",
    "short": "ING. MiNAS",
    "x": 394,
    "y": 235,
    "w": 85,
    "h": 30,
    "entryX": 398,
    "entryY": 234,
    "keywords": [
      "minas",
      "metalurgica",
      "metalúrgica",
      "geologia",
      "geología",
      "geologica"
    ]
  },
  {
    "code": "PAB_C",
    "num": 16,
    "name": "Pabellón C (Aulas Generales)",
    "short": "BIOLOGIA",
    "x": 236,
    "y": 172,
    "w": 55,
    "h": 34,
    "entryX": 237,
    "entryY": 185,
    "keywords": [
      "pabellon c",
      "pabellón c",
      "pab-c",
      "pab c"
    ]
  },
  {
    "code": "SOC",
    "num": 3,
    "name": "Ciencias Sociales",
    "short": "CS. SOCIALES",
    "x": 116,
    "y": 227,
    "w": 75,
    "h": 35,
    "entryX": 153,
    "entryY": 227,
    "keywords": [
      "sociales",
      "ciencias sociales",
      "antropologia",
      "antropología",
      "arqueologia",
      "arqueología",
      "historia"
    ]
  },
  {
    "code": "FARM",
    "num": 18,
    "name": "Farmacia y Bioquímica",
    "short": "FARMACIA",
    "x": 217,
    "y": 311,
    "w": 68,
    "h": 34,
    "entryX": 251,
    "entryY": 311,
    "keywords": [
      "farmacia",
      "bioquimica",
      "bioquímica",
      "farmacia y bioquimica"
    ]
  },
  {
    "code": "COMUN",
    "num": 45,
    "name": "Ciencias de la Comunicación",
    "short": "COMUNICACIÓN",
    "x": 443,
    "y": 91,
    "w": 83,
    "h": 34,
    "entryX": 413,
    "entryY": 124,
    "keywords": [
      "comunicacion",
      "comunicación",
      "ciencias de la comunicacion"
    ]
  },
  {
    "code": "EDUC",
    "num": 21,
    "name": "Educación",
    "short": "EDUCACIÓN",
    "x": 308,
    "y": 174,
    "w": 68,
    "h": 38,
    "entryX": 308,
    "entryY": 189,
    "keywords": [
      "educacion",
      "educación",
      "pedagogia"
    ]
  },
  {
    "code": "CEPRU",
    "num": 28,
    "name": "CEPRU",
    "short": "CEPRU",
    "x": 351,
    "y": 88,
    "w": 75,
    "h": 26,
    "entryX": 388,
    "entryY": 114,
    "keywords": [
      "cepru",
      "aulas cepru"
    ]
  },
  {
    "code": "PAB_5284",
    "num": 46,
    "name": "Nuevo Pabellón 46",
    "short": "ING. ELECTRONICA",
    "x": 394,
    "y": 133,
    "w": 106,
    "h": 30,
    "entryX": 406,
    "entryY": 149,
    "keywords": [
      "nuevo",
      "pab_5284"
    ]
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
  if (!sede) return true;
  const s = sede.toLowerCase().trim();
  return s === 'cusco' || s.includes('cusco') || s === 'sede central' || s === 'perayoc' || s.includes('perayoc');
}

/**
 * Calcula los puntos de la ruta peatonal principal a través de los corredores oficiales
 * evitando en un 100% cruzar o atravesar cualquier pabellón existente.
 */
export function calculateRoutePoints(door: DoorInfo, target: Pavilion): [number, number][] {
  const points: [number, number][] = [[door.x, door.y]];

  if (door.id === 'P6') {
    // Puerta 6: Av. Universitaria (Oeste)
    points.push([75, door.y]); // Corredor interior de Av. Universitaria
    
    if (target.code === 'ARQ') {
      // Arquitectura: avanza al norte por corredor 75 hasta el callejón 140 (entre Química y Arquitectura)
      points.push([75, 140]);
      points.push([167, 140]);
      points.push([target.entryX, target.entryY]);
    } else if (target.code === 'QUIM' || target.code === 'SOC') {
      // Química o Sociales
      points.push([75, 215]);
      points.push([target.entryX, 215]);
      points.push([target.entryX, target.entryY]);
    } else if (target.code === 'CIVIL' || target.code === 'PAB_C') {
      // Civil o Pabellón C
      points.push([75, 215]);
      points.push([215, 215]);
      points.push([215, target.entryY]);
      points.push([target.entryX, target.entryY]);
    } else if (target.y > 220) {
      // Pabellones del Sur (Farmacia, Contabilidad, Economía)
      points.push([75, 360]);
      points.push([target.entryX, 360]);
      points.push([target.entryX, target.entryY]);
    } else {
      // Pabellones Central-Este / Norte (Derecho, CEPRU, Eléctrica, etc.)
      points.push([75, 215]);
      points.push([380, 215]);
      points.push([380, target.entryY]);
      points.push([target.entryX, target.entryY]);
    }
  } else if (door.id === 'P4') {
    // Puerta 4: Av. La Cultura (Sur-Oeste)
    points.push([door.x, 360]); // Corredor interior Av. La Cultura
    
    if (target.code === 'ARQ') {
      points.push([75, 360]);
      points.push([75, 140]);
      points.push([167, 140]);
      points.push([target.entryX, target.entryY]);
    } else if (target.x < 220) {
      points.push([75, 360]);
      points.push([75, 215]);
      points.push([target.entryX, 215]);
      points.push([target.entryX, target.entryY]);
    } else if (target.y > 220) {
      points.push([target.entryX, 360]);
      points.push([target.entryX, target.entryY]);
    } else {
      points.push([door.x, 215]);
      points.push([target.entryX, 215]);
      points.push([target.entryX, target.entryY]);
    }
  } else if (door.id === 'P2') {
    // Puerta 2: Av. La Cultura (Sur-Este)
    points.push([door.x, 360]);
    
    if (target.y > 250) {
      points.push([target.entryX, 360]);
      points.push([target.entryX, target.entryY]);
    } else if (target.x > 370) {
      points.push([380, 360]);
      points.push([380, target.entryY]);
      points.push([target.entryX, target.entryY]);
    } else {
      points.push([door.x, 215]);
      points.push([target.entryX, 215]);
      points.push([target.entryX, target.entryY]);
    }
  } else if (door.id === 'P1') {
    // Puerta 1: Av. Haya de la Torre (Este)
    points.push([505, door.y]); // Corredor interior Av. Haya de la Torre
    
    if (target.x > 370) {
      points.push([505, target.entryY]);
      points.push([target.entryX, target.entryY]);
    } else if (target.y > 240) {
      points.push([505, 360]);
      points.push([target.entryX, 360]);
      points.push([target.entryX, target.entryY]);
    } else {
      points.push([505, 215]);
      points.push([target.entryX, 215]);
      points.push([target.entryX, target.entryY]);
    }
  }

  // Eliminar puntos redundantes o duplicados seguidos
  const cleanPoints: [number, number][] = [];
  for (let i = 0; i < points.length; i++) {
    const cur = points[i];
    const prev = cleanPoints[cleanPoints.length - 1];
    if (!prev || Math.abs(cur[0] - prev[0]) > 1 || Math.abs(cur[1] - prev[1]) > 1) {
      cleanPoints.push(cur);
    }
  }
  return cleanPoints;
}

export interface SmartViewport {
  vx: number;
  vy: number;
  vw: number;
  vh: number;
  scale: number;
  sectorName: string;
}

/**
 * Calcula el encuadre dinámico (Smart Zoom) ajustado a la puerta y al pabellón destino.
 * Enfoca el 100% del área relevante en tamaño 2x a 3x para máxima legibilidad.
 */
export function computeSmartViewport(
  door: DoorInfo,
  target: Pavilion,
  path: [number, number][]
): SmartViewport {
  const allX = path.map(p => p[0]).concat([target.x, target.x + target.w, door.x]);
  const allY = path.map(p => p[1]).concat([target.y, target.y + target.h, door.y]);

  const padX = 42;
  const padY = 32;
  let minX = Math.min(...allX) - padX;
  let maxX = Math.max(...allX) + padX;
  let minY = Math.min(...allY) - padY;
  let maxY = Math.max(...allY) + padY;

  // Garantizar un ancho y alto mínimos para que trayectos muy cortos mantengan contexto
  const minW = 210;
  const minH = 120;
  if (maxX - minX < minW) {
    const d = minW - (maxX - minX);
    minX -= d / 2;
    maxX += d / 2;
  }
  if (maxY - minY < minH) {
    const d = minH - (maxY - minY);
    minY -= d / 2;
    maxY += d / 2;
  }

  const rawW = maxX - minX;
  const rawH = maxY - minY;
  const targetRatio = 576.0 / 320.0; // 1.8 Proporción nativa de cabezal térmico
  const currRatio = rawW / rawH;

  if (currRatio < targetRatio) {
    const w = rawH * targetRatio;
    const diff = w - rawW;
    minX -= diff / 2;
    maxX += diff / 2;
  } else {
    const h = rawW / targetRatio;
    const diff = h - rawH;
    minY -= diff / 2;
    maxY += diff / 2;
  }

  // Determinar cuadrante oficial
  const cx = target.x + target.w / 2;
  const cy = target.y + target.h / 2;
  let sectorName = 'SECTOR CENTRAL';
  if (cx < 280 && cy < 210) sectorName = 'SECTOR NOR-OESTE';
  else if (cx >= 280 && cy < 210) sectorName = 'SECTOR NOR-ESTE';
  else if (cx < 280 && cy >= 210) sectorName = 'SECTOR SUR-OESTE';
  else if (cx >= 280 && cy >= 210) sectorName = 'SECTOR SUR-ESTE';

  const vw = Math.round(maxX - minX);
  const vh = Math.round(maxY - minY);

  return {
    vx: Math.round(minX),
    vy: Math.round(minY),
    vw,
    vh,
    scale: +(576 / vw).toFixed(2),
    sectorName
  };
}

/**
 * Genera el texto explicativo de orientación paso a paso
 */
export function generateRouteInstructions(doorId: DoorId, target: Pavilion): string {
  const door = OFFICIAL_DOORS[doorId] || OFFICIAL_DOORS.P2;
  const targetName = target.short.toUpperCase();

  switch (door.id) {
    case 'P1':
      return `De PUERTA N° 1 (${door.avenue}): Ingrese al campus por la calzada principal este. El pabellón de ${targetName} (N° ${target.num}) se ubica en el ${target.x < 300 ? 'sector central' : 'sector este'}.`;
    case 'P2':
      return `De PUERTA N° 2 (${door.avenue}): Ingrese recto hacia la plaza central. Siga la vía peatonal señalizada hacia ${targetName} (N° ${target.num}).`;
    case 'P4':
      return `De PUERTA N° 4 (${door.avenue}): Ingrese y avance por la vía peatonal sur bordeando las facultades hacia ${targetName} (N° ${target.num}).`;
    case 'P6':
      if (target.code === 'ARQ') {
        return `De PUERTA N° 6 (${door.avenue}): Ingrese, avance recto por el corredor izquierdo pasando frente a Ing. Química, y gire a la derecha hacia ARQUITECTURA (N° ${target.num}).`;
      }
      return `De PUERTA N° 6 (${door.avenue}): Ingrese y avance por el corredor peatonal principal hacia ${targetName} (N° ${target.num}).`;
  }
}

/**
 * Genera el código SVG del croquis con Smart Zoom (Enfoque Dinámico 2x a 3x)
 * y filtrado inteligente de pabellones para eliminar ruido visual en el ticket.
 */
export function generateCampusRouteSvg(doorId: DoorId, target: Pavilion): string {
  const door = OFFICIAL_DOORS[doorId] || OFFICIAL_DOORS.P2;
  const pathPoints = calculateRoutePoints(door, target);
  const vp = computeSmartViewport(door, target, pathPoints);

  const polylineStr = pathPoints.map(p => `${Math.round(p[0])},${Math.round(p[1])}`).join(' ');

  // Filtrado inteligente: Solo renderizar pabellones dentro o en contacto con el viewport visible
  const visiblePavilions = CAMPUS_PAVILIONS.filter(p => {
    if (p.code === target.code) return true;
    const inView = !(
      p.x + p.w < vp.vx ||
      p.x > vp.vx + vp.vw ||
      p.y + p.h < vp.vy ||
      p.y > vp.vy + vp.vh
    );
    return inView;
  });

  const pavilionsSvg = visiblePavilions.map(p => {
    const isTarget = p.code === target.code;
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;

    if (isTarget) {
      // Pabellón Destino: Relleno Negro Sólido, Letras Blancas Grandes y Badge de Destino
      return `
        <g id="target-${p.code}">
          <!-- Sombra / Realce perimetral grueso -->
          <rect x="${p.x - 3}" y="${p.y - 3}" width="${p.w + 6}" height="${p.h + 6}" fill="#000000" rx="4" />
          <rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="#000000" stroke="#ffffff" stroke-width="2.5" rx="3" />
          
          <!-- Badge Superior con Número de Pabellón -->
          <rect x="${p.x + p.w - 36}" y="${p.y - 14}" width="34" height="16" fill="#ffffff" stroke="#000000" stroke-width="2" rx="3" />
          <text x="${p.x + p.w - 19}" y="${p.y - 2}" fill="#000000" font-family="'Segoe UI', Arial, sans-serif" font-size="11" font-weight="900" text-anchor="middle">N°${p.num}</text>

          <!-- Nombre del Pabellón Destino en Letras Blancas Grandes -->
          <text x="${cx}" y="${cy + 5}" fill="#ffffff" font-family="'Segoe UI', Arial, sans-serif" font-size="12" font-weight="900" text-anchor="middle" letter-spacing="0.2">${p.short}</text>

          <!-- Pin Indicador de Entrada -->
          <circle cx="${p.entryX}" cy="${p.entryY}" r="7" fill="#000000" stroke="#ffffff" stroke-width="2.5" />
          <circle cx="${p.entryX}" cy="${p.entryY}" r="3" fill="#ffffff" />
          
          <!-- Cartel Flotante DESTINO AQUÍ -->
          <g transform="translate(${p.entryX}, ${p.entryY > 200 ? p.entryY + 14 : p.entryY - 14})">
            <rect x="-48" y="-10" width="96" height="19" fill="#000000" stroke="#ffffff" stroke-width="1.8" rx="3" />
            <text x="0" y="4" fill="#ffffff" font-family="'Segoe UI', Arial, sans-serif" font-size="9.5" font-weight="900" text-anchor="middle">🎯 DESTINO AQUÍ</text>
          </g>
        </g>
      `;
    } else {
      // Pabellón de Referencia de paso: Contorno claro y subtítulo de referencia
      return `
        <g id="pab-ref-${p.code}" opacity="0.85">
          <rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="#ffffff" stroke="#000000" stroke-width="1.5" rx="2" />
          <text x="${p.x + 4}" y="${p.y + 11}" fill="#000000" font-family="'Segoe UI', Arial, sans-serif" font-size="9" font-weight="900">N°${p.num}</text>
          <text x="${cx}" y="${cy + 2}" fill="#000000" font-family="'Segoe UI', Arial, sans-serif" font-size="9.5" font-weight="800" text-anchor="middle">${p.short}</text>
          <text x="${cx}" y="${cy + 11}" fill="#555555" font-family="'Segoe UI', Arial, sans-serif" font-size="7" font-weight="700" text-anchor="middle">(Referencia)</text>
        </g>
      `;
    }
  }).join('');

  // Posición del Mini-Radar: Elegir esquina opuesta a la ubicación del destino
  const isTargetRight = target.x > (vp.vx + vp.vw / 2);
  const isTargetBottom = target.y > (vp.vy + vp.vh / 2);
  const radarX = isTargetRight ? vp.vx + 10 : vp.vx + vp.vw - 75;
  const radarY = isTargetBottom ? vp.vy + 10 : vp.vy + vp.vh - 55;

  // Cuadrante para el mini radar (4 cajas 2x2)
  const isNorth = target.y < 210;
  const isWest = target.x < 280;

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vp.vx} ${vp.vy} ${vp.vw} ${vp.vh}" width="100%" height="auto" style="background:#ffffff; display:block; margin:2px auto; max-width:72mm;">
  <defs>
    <!-- Flecha marcadora gruesa de llegada -->
    <marker id="route-arrow" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="9" markerHeight="9" orient="auto">
      <path d="M 0 1 L 12 6 L 0 11 z" fill="#000000" />
    </marker>
  </defs>

  <!-- Cuadrícula tenue de calzadas principales -->
  <g stroke="#000000" stroke-width="1" stroke-dasharray="3,3" opacity="0.25">
    <line x1="-100" y1="215" x2="700" y2="215" />
    <line x1="-100" y1="140" x2="700" y2="140" />
    <line x1="-100" y1="360" x2="700" y2="360" />
    <line x1="75" y1="-50" x2="75" y2="450" />
    <line x1="215" y1="-50" x2="215" y2="450" />
    <line x1="380" y1="-50" x2="380" y2="450" />
    <line x1="505" y1="-50" x2="505" y2="450" />
  </g>

  <!-- Pabellones visibles filtrados (Destino + Referencias) -->
  ${pavilionsSvg}

  <!-- LÍNEA DE RUTA PEATONAL GUÍA (TRAZO GRUESO SIN OBSTÁCULOS) -->
  <polyline points="${polylineStr}" fill="none" stroke="#000000" stroke-width="4.5" stroke-dasharray="8,4" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#route-arrow)" />

  <!-- Puerta de Ingreso de Origen -->
  <g id="door-active">
    <circle cx="${door.x}" cy="${door.y}" r="15" fill="#000000" stroke="#ffffff" stroke-width="3" />
    <text x="${door.x}" y="${door.y + 5}" fill="#ffffff" font-family="'Segoe UI', Arial, sans-serif" font-size="12" font-weight="900" text-anchor="middle">P${door.number}</text>
    
    <!-- Cartel flotante de puerta -->
    <g transform="translate(${door.x < 150 ? door.x + 44 : door.x - 44}, ${door.y > 300 ? door.y - 18 : door.y + 18})">
      <rect x="-44" y="-10" width="88" height="20" fill="#000000" stroke="#ffffff" stroke-width="1.5" rx="3" />
      <text x="0" y="4" fill="#ffffff" font-family="'Segoe UI', Arial, sans-serif" font-size="9.5" font-weight="900" text-anchor="middle">🚪 INGRESO P${door.number}</text>
    </g>
  </g>

  <!-- Mini-Radar de Cuadrante (Orientación General) -->
  <g transform="translate(${radarX}, ${radarY})" opacity="0.9">
    <rect x="0" y="0" width="65" height="42" fill="#ffffff" stroke="#000000" stroke-width="1.5" rx="3" />
    <text x="32.5" y="9" fill="#000000" font-family="'Segoe UI', Arial, sans-serif" font-size="6.5" font-weight="900" text-anchor="middle">${vp.sectorName}</text>
    
    <!-- Miniatura Campus 2x2 Cuadrantes -->
    <g transform="translate(17, 12)">
      <!-- Cuadrante Nor-Oeste -->
      <rect x="0" y="0" width="14" height="11" fill="${isNorth && isWest ? '#000000' : '#ffffff'}" stroke="#000000" stroke-width="1" />
      <!-- Cuadrante Nor-Este -->
      <rect x="16" y="0" width="14" height="11" fill="${isNorth && !isWest ? '#000000' : '#ffffff'}" stroke="#000000" stroke-width="1" />
      <!-- Cuadrante Sur-Oeste -->
      <rect x="0" y="13" width="14" height="11" fill="${!isNorth && isWest ? '#000000' : '#ffffff'}" stroke="#000000" stroke-width="1" />
      <!-- Cuadrante Sur-Este -->
      <rect x="16" y="13" width="14" height="11" fill="${!isNorth && !isWest ? '#000000' : '#ffffff'}" stroke="#000000" stroke-width="1" />
    </g>
  </g>
</svg>
`;
}
