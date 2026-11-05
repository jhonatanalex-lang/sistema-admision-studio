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
    "entryX": 266,
    "entryY": 261,
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
    "entryX": 308,
    "entryY": 290,
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
    "entryX": 343,
    "entryY": 161,
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
    "entryX": 377,
    "entryY": 308,
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
    "entryX": 406,
    "entryY": 183,
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
    "entryX": 262,
    "entryY": 134,
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
    "entryX": 385,
    "entryY": 335,
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
    "x": 122,
    "y": 177,
    "w": 75,
    "h": 37,
    "entryX": 205,
    "entryY": 194,
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
    "entryX": 388,
    "entryY": 209,
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
    "entryX": 385,
    "entryY": 230,
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
    "entryX": 203,
    "entryY": 247,
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
    "entryX": 235,
    "entryY": 294,
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
    "entryX": 389,
    "entryY": 121,
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
    "entryX": 382,
    "entryY": 158,
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
 * garantizando cero colisiones con pabellones existentes.
 */
export function calculateRoutePoints(door: DoorInfo, target: Pavilion): [number, number][] {
  const points: [number, number][] = [[door.x, door.y]];

  if (door.id === 'P4') {
    // Puerta 4 (x=201, y=389): Eje vertebral peatonal 201
    if (target.code === 'ARQ' || target.code === 'CIVIL') {
      points.push([201, 145]);
      points.push([target.entryX, 145]);
      points.push([target.entryX, target.entryY]);
    } else if (target.code === 'PAB_C') {
      points.push([201, 215]);
      points.push([target.entryX, 215]);
      points.push([target.entryX, target.entryY]);
    } else if (target.code === 'EDUC') {
      points.push([201, 215]);
      points.push([300, 215]);
      points.push([300, target.entryY]);
      points.push([target.entryX, target.entryY]);
    } else if (target.code === 'ECON' || target.code === 'CONTAB' || target.code === 'FARM' || target.code === 'QUIM' || target.code === 'SOC') {
      points.push([201, target.entryY]);
      points.push([target.entryX, target.entryY]);
    } else {
      // Sector Este: sube al eje 215, cruza al bulevar 380 y avanza al destino
      points.push([201, 215]);
      points.push([380, 215]);
      points.push([380, target.entryY]);
      points.push([target.entryX, target.entryY]);
    }
  } else if (door.id === 'P2') {
    // Puerta 2 (x=390, y=384): Conecta al bulevar peatonal 380
    points.push([380, 360]);
    if (['INF', 'ENF', 'MINAS', 'MEC', 'ELEC', 'PAB_5284', 'DER', 'CEPRU', 'COMUN'].includes(target.code)) {
      points.push([380, target.entryY]);
      points.push([target.entryX, target.entryY]);
    } else if (target.code === 'CONTAB') {
      points.push([380, target.entryY]);
      points.push([target.entryX, target.entryY]);
    } else if (target.code === 'EDUC') {
      points.push([380, 215]);
      points.push([300, 215]);
      points.push([300, target.entryY]);
      points.push([target.entryX, target.entryY]);
    } else if (target.code === 'ECON') {
      points.push([380, 215]);
      points.push([target.entryX, 215]);
      points.push([target.entryX, target.entryY]);
    } else if (target.code === 'FARM') {
      points.push([380, 360]);
      points.push([201, 360]);
      points.push([201, target.entryY]);
      points.push([target.entryX, target.entryY]);
    } else if (target.code === 'CIVIL' || target.code === 'ARQ') {
      points.push([380, 215]);
      points.push([201, 215]);
      points.push([201, 145]);
      points.push([target.entryX, 145]);
      points.push([target.entryX, target.entryY]);
    } else {
      // PAB_C, QUIM, SOC
      points.push([380, 215]);
      points.push([201, 215]);
      points.push([201, target.entryY]);
      points.push([target.entryX, target.entryY]);
    }
  } else if (door.id === 'P6') {
    // Puerta 6 (x=39, y=173): Corredor Oeste 75
    points.push([75, door.y]);
    if (target.code === 'ARQ' || target.code === 'CIVIL') {
      points.push([75, 145]);
      points.push([target.entryX, 145]);
      points.push([target.entryX, target.entryY]);
    } else if (target.code === 'QUIM' || target.code === 'SOC') {
      points.push([75, target.entryY]);
      points.push([target.entryX, target.entryY]);
    } else if (target.code === 'FARM' || target.code === 'CONTAB') {
      points.push([75, 290]);
      points.push([201, 290]);
      points.push([target.entryX, target.entryY]);
    } else if (target.code === 'ECON') {
      points.push([75, 215]);
      points.push([target.entryX, 215]);
      points.push([target.entryX, target.entryY]);
    } else if (target.code === 'EDUC') {
      points.push([75, 215]);
      points.push([300, 215]);
      points.push([300, target.entryY]);
      points.push([target.entryX, target.entryY]);
    } else if (target.code === 'PAB_C') {
      points.push([75, 215]);
      points.push([target.entryX, 215]);
      points.push([target.entryX, target.entryY]);
    } else {
      // Sector Este
      points.push([75, 215]);
      points.push([380, 215]);
      points.push([380, target.entryY]);
      points.push([target.entryX, target.entryY]);
    }
  } else if (door.id === 'P1') {
    // Puerta 1 (x=539, y=294): Corredor Este 505
    points.push([505, door.y]);
    if (target.code === 'COMUN') {
      points.push([505, target.entryY]);
      points.push([target.entryX, target.entryY]);
    } else if (['ELEC', 'MEC', 'MINAS', 'INF', 'ENF', 'PAB_5284'].includes(target.code)) {
      points.push([505, 280]);
      points.push([380, 280]);
      points.push([380, target.entryY]);
      points.push([target.entryX, target.entryY]);
    } else {
      points.push([505, 280]);
      points.push([380, 280]);
      if (['DER', 'CEPRU'].includes(target.code)) {
        points.push([380, target.entryY]);
        points.push([target.entryX, target.entryY]);
      } else if (target.code === 'EDUC') {
        points.push([380, 215]);
        points.push([300, 215]);
        points.push([300, target.entryY]);
        points.push([target.entryX, target.entryY]);
      } else if (target.code === 'ECON') {
        points.push([380, 215]);
        points.push([target.entryX, 215]);
        points.push([target.entryX, target.entryY]);
      } else if (target.code === 'CIVIL' || target.code === 'ARQ') {
        points.push([380, 215]);
        points.push([201, 215]);
        points.push([201, 145]);
        points.push([target.entryX, 145]);
        points.push([target.entryX, target.entryY]);
      } else {
        points.push([380, 215]);
        points.push([201, 215]);
        points.push([201, target.entryY]);
        points.push([target.entryX, target.entryY]);
      }
    }
  }

  // Eliminar puntos redundantes o duplicados seguidos
  const cleanPoints: [number, number][] = [];
  for (let i = 0; i < points.length; i++) {
    const cur = points[i];
    const prev = cleanPoints[cleanPoints.length - 1];
    if (!prev || Math.abs(cur[0] - prev[0]) > 0.5 || Math.abs(cur[1] - prev[1]) > 0.5) {
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
}

/**
 * Calcula el encuadre dinámico (Smart Zoom) ajustado a la puerta y al pabellón destino.
 * Enfoca el trayecto con altura vertical generosa para formato de ticket continuo.
 */
export function computeSmartViewport(
  door: DoorInfo,
  target: Pavilion,
  path: [number, number][]
): SmartViewport {
  const allX = path.map(p => p[0]).concat([target.x, target.x + target.w, door.x]);
  const allY = path.map(p => p[1]).concat([target.y, target.y + target.h, door.y]);

  const padX = 35;
  const padY = 32;
  let minX = Math.min(...allX) - padX;
  let maxX = Math.max(...allX) + padX;
  let minY = Math.min(...allY) - padY;
  let maxY = Math.max(...allY) + padY;

  // Viewport verticalmente espacioso para el rollo térmico
  const minW = 210;
  const minH = 170;
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
  // Proporción vertical optimizada: 576 ancho por ~440 alto (ratio ~1.31)
  const targetRatio = 576.0 / 440.0;
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

  const vw = Math.round(maxX - minX);
  const vh = Math.round(maxY - minY);

  return {
    vx: Math.round(minX),
    vy: Math.round(minY),
    vw,
    vh,
    scale: +(576 / vw).toFixed(2)
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
      return `De PUERTA N° 4 (${door.avenue}): Ingrese y avance por la vía peatonal principal norte bordeando hacia ${targetName} (N° ${target.num}).`;
    case 'P6':
      if (target.code === 'ARQ') {
        return `De PUERTA N° 6 (${door.avenue}): Ingrese, avance recto por el corredor izquierdo pasando frente a Ing. Química, y gire a la derecha hacia ARQUITECTURA (N° ${target.num}).`;
      }
      return `De PUERTA N° 6 (${door.avenue}): Ingrese y avance por el corredor peatonal principal hacia ${targetName} (N° ${target.num}).`;
  }
}

/**
 * Genera el código SVG del croquis con Smart Zoom
 * Optimizado para impresión térmica 80mm de alta legibilidad, sin saturación visual.
 */
export function generateCampusRouteSvg(doorId: DoorId, target: Pavilion): string {
  const door = OFFICIAL_DOORS[doorId] || OFFICIAL_DOORS.P2;
  const pathPoints = calculateRoutePoints(door, target);
  const vp = computeSmartViewport(door, target, pathPoints);

  const polylineStr = pathPoints.map(p => `${Math.round(p[0])},${Math.round(p[1])}`).join(' ');

  // Filtrado inteligente: Solo renderizar pabellones dentro del viewport visible (evitando recortes mínimos en bordes)
  const visiblePavilions = CAMPUS_PAVILIONS.filter(p => {
    if (p.code === target.code) return true;
    const overlapX = Math.max(0, Math.min(p.x + p.w, vp.vx + vp.vw) - Math.max(p.x, vp.vx));
    const overlapY = Math.max(0, Math.min(p.y + p.h, vp.vy + vp.vh) - Math.max(p.y, vp.vy));
    return (overlapX >= 14 && overlapY >= 14);
  });

  const pavilionsSvg = visiblePavilions.map(p => {
    const isTarget = p.code === target.code;
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;

    if (isTarget) {
      // Pabellón Destino: Relleno Negro Sólido, Letras Blancas Grandes y Badge Oficial
      return `
        <g id="target-${p.code}">
          <!-- Caja Destino Sólida con borde exterior nítido -->
          <rect x="${p.x - 2}" y="${p.y - 2}" width="${p.w + 4}" height="${p.h + 4}" fill="#000000" rx="4" />
          <rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="#000000" stroke="#ffffff" stroke-width="2" rx="3" />
          
          <!-- Badge Superior con Número Oficial de Pabellón -->
          <rect x="${p.x + p.w - 38}" y="${p.y - 13}" width="36" height="15" fill="#ffffff" stroke="#000000" stroke-width="1.8" rx="3" />
          <text x="${p.x + p.w - 20}" y="${p.y - 2}" fill="#000000" font-family="'Segoe UI', Arial, sans-serif" font-size="10.5" font-weight="900" text-anchor="middle">N°${p.num}</text>

          <!-- Nombre del Pabellón Destino en Letras Blancas Grandes y Claras -->
          <text x="${cx}" y="${cy + 5}" fill="#ffffff" font-family="'Segoe UI', Arial, sans-serif" font-size="12" font-weight="900" text-anchor="middle" letter-spacing="0.3">${p.short}</text>

          <!-- Pin Indicador de Entrada -->
          <circle cx="${p.entryX}" cy="${p.entryY}" r="5.5" fill="#000000" stroke="#ffffff" stroke-width="2" />
          <circle cx="${p.entryX}" cy="${p.entryY}" r="2" fill="#ffffff" />
        </g>
      `;
    } else {
      // Pabellón de Referencia de paso: Contorno claro y subtítulo de referencia
      return `
        <g id="pab-ref-${p.code}" opacity="0.85">
          <rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="#ffffff" stroke="#000000" stroke-width="1.4" rx="2" />
          <text x="${p.x + 3}" y="${p.y + 10}" fill="#000000" font-family="'Segoe UI', Arial, sans-serif" font-size="8.5" font-weight="900">N°${p.num}</text>
          <text x="${cx}" y="${cy + 2}" fill="#000000" font-family="'Segoe UI', Arial, sans-serif" font-size="9" font-weight="800" text-anchor="middle">${p.short}</text>
          <text x="${cx}" y="${cy + 10}" fill="#555555" font-family="'Segoe UI', Arial, sans-serif" font-size="6.8" font-weight="700" text-anchor="middle">(Referencia)</text>
        </g>
      `;
    }
  }).join('');

  // Posicionamiento de la etiqueta de la puerta de ingreso
  let badgeX = door.x;
  let badgeY = door.y > 300 ? door.y - 14 : door.y + 14;
  if (door.id === 'P4') {
    badgeX = door.x - 45;
    badgeY = door.y - 12;
  } else if (door.id === 'P2') {
    badgeX = door.x + 45;
    badgeY = door.y - 12;
  } else if (door.id === 'P6') {
    badgeX = door.x + 45;
    badgeY = door.y - 14;
  } else if (door.id === 'P1') {
    badgeX = door.x - 45;
    badgeY = door.y - 14;
  }

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vp.vx} ${vp.vy} ${vp.vw} ${vp.vh}" width="100%" height="auto" style="background:#ffffff; display:block; margin:2px auto; max-width:72mm;">
  <defs>
    <!-- Flecha elegante y nítida de tamaño fijo (no afectada por stroke-width) -->
    <marker id="route-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto">
      <path d="M 0 1.5 L 9 5 L 0 8.5 L 2.5 5 z" fill="#000000" />
    </marker>
  </defs>

  <!-- Cuadrícula tenue de calzadas principales -->
  <g stroke="#000000" stroke-width="1" stroke-dasharray="3,3" opacity="0.22">
    <line x1="-100" y1="215" x2="700" y2="215" />
    <line x1="-100" y1="145" x2="700" y2="145" />
    <line x1="-100" y1="360" x2="700" y2="360" />
    <line x1="75" y1="-50" x2="75" y2="450" />
    <line x1="201" y1="-50" x2="201" y2="450" />
    <line x1="380" y1="-50" x2="380" y2="450" />
    <line x1="505" y1="-50" x2="505" y2="450" />
  </g>

  <!-- Pabellones visibles filtrados (Destino + Referencias) -->
  ${pavilionsSvg}

  <!-- LÍNEA DE RUTA PEATONAL GUÍA (TRAZO NÍTIDO Y FLECHA PROPORCIONAL) -->
  <polyline points="${polylineStr}" fill="none" stroke="#000000" stroke-width="4" stroke-dasharray="8,4" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#route-arrow)" />

  <!-- Puerta de Ingreso de Origen -->
  <g id="door-active">
    <circle cx="${door.x}" cy="${door.y}" r="13" fill="#000000" stroke="#ffffff" stroke-width="2.5" />
    <text x="${door.x}" y="${door.y + 4.5}" fill="#ffffff" font-family="'Segoe UI', Arial, sans-serif" font-size="11" font-weight="900" text-anchor="middle">P${door.number}</text>
    
    <!-- Cartel flotante de puerta -->
    <g transform="translate(${badgeX}, ${badgeY})">
      <rect x="-42" y="-9" width="84" height="18" fill="#000000" stroke="#ffffff" stroke-width="1.4" rx="3" />
      <text x="0" y="3.5" fill="#ffffff" font-family="'Segoe UI', Arial, sans-serif" font-size="9" font-weight="900" text-anchor="middle">🚪 INGRESO P${door.number}</text>
    </g>
  </g>
</svg>
`;
}
