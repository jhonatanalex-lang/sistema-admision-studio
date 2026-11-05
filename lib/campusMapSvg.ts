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
 * Calcula los puntos de la ruta peatonal principal desde la puerta hasta el pabellón
 */
function calculateRoutePoints(door: DoorInfo, target: Pavilion): string {
  const points: [number, number][] = [[door.x, door.y]];
  const centralY = 205;

  if (door.id === 'P1') {
    points.push([490, door.y]);
    if (target.code === 'MED') {
      points.push([target.entryX, target.entryY]);
    } else if (target.y < 150) {
      points.push([490, target.entryY]);
      points.push([target.entryX, target.entryY]);
    } else {
      points.push([490, centralY]);
      points.push([target.entryX, centralY]);
      points.push([target.entryX, target.entryY]);
    }
  } else if (door.id === 'P2') {
    points.push([door.x, 340]);
    if (target.y > 250) {
      points.push([target.entryX, 340]);
      points.push([target.entryX, target.entryY]);
    } else {
      points.push([door.x, centralY]);
      points.push([target.entryX, centralY]);
      points.push([target.entryX, target.entryY]);
    }
  } else if (door.id === 'P4') {
    points.push([door.x, 340]);
    if (target.y > 250) {
      points.push([target.entryX, 340]);
      points.push([target.entryX, target.entryY]);
    } else {
      points.push([door.x, centralY]);
      points.push([target.entryX, centralY]);
      points.push([target.entryX, target.entryY]);
    }
  } else if (door.id === 'P6') {
    points.push([90, door.y]);
    points.push([90, centralY]);
    points.push([target.entryX, centralY]);
    points.push([target.entryX, target.entryY]);
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
      return `De PUERTA N° 1 (${door.avenue}): Ingrese y avance hacia el interior. El pabellón de ${targetName} (N° ${target.num}) se encuentra en el sector ${target.x < 300 ? 'central-oeste' : 'este'}.`;
    case 'P2':
      return `De PUERTA N° 2 (${door.avenue}): Ingrese recto hacia la plaza central. Gire hacia ${target.x < 350 ? 'la izquierda' : 'la derecha'} para llegar a ${targetName} (N° ${target.num}).`;
    case 'P4':
      return `De PUERTA N° 4 (${door.avenue}): Ingrese y avance bordeando Idiomas. Diríjase recto hacia ${targetName} (N° ${target.num}).`;
    case 'P6':
      return `De PUERTA N° 6 (${door.avenue}): Ingrese y avance por la vía principal hacia el ${target.y > 180 ? 'sur' : 'este'} en dirección a ${targetName} (N° ${target.num}).`;
  }
}

/**
 * Genera el código SVG del croquis de Ciudad Universitaria Perayoc de alto contraste
 * optimizado para ticketeras térmicas de 80mm (ancho efectivo 72mm / 576 puntos).
 */
export function generateCampusRouteSvg(doorId: DoorId, target: Pavilion): string {
  const door = OFFICIAL_DOORS[doorId] || OFFICIAL_DOORS.P2;
  const routePoints = calculateRoutePoints(door, target);

  // Renderizado de todos los pabellones con tipografía grande y nítida
  const pavilionsSvg = CAMPUS_PAVILIONS.map(p => {
    const isTarget = p.code === target.code;
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;

    if (isTarget) {
      // Pabellón Destino: Relleno Negro Sólido, Letras Blancas Grandes y Badge de Destino
      return `
        <g id="target-${p.code}">
          <!-- Sombra / Realce perimetral -->
          <rect x="${p.x - 3}" y="${p.y - 3}" width="${p.w + 6}" height="${p.h + 6}" fill="#000000" rx="4" />
          <rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="#000000" stroke="#ffffff" stroke-width="2.5" rx="3" />
          
          <!-- Badge Superior con Número de Pabellón -->
          <rect x="${p.x + p.w - 32}" y="${p.y - 12}" width="30" height="15" fill="#ffffff" stroke="#000000" stroke-width="2" rx="3" />
          <text x="${p.x + p.w - 17}" y="${p.y - 1}" fill="#000000" font-family="'Segoe UI', Arial, sans-serif" font-size="10.5" font-weight="900" text-anchor="middle">N°${p.num}</text>

          <!-- Nombre del Pabellón Destino en Letras Blancas Grandes -->
          <text x="${cx}" y="${cy + 4}" fill="#ffffff" font-family="'Segoe UI', Arial, sans-serif" font-size="11.5" font-weight="900" text-anchor="middle" letter-spacing="0.2">${p.short}</text>

          <!-- Pin Indicador de Entrada -->
          <circle cx="${p.entryX}" cy="${p.entryY}" r="7" fill="#000000" stroke="#ffffff" stroke-width="2.5" />
          <circle cx="${p.entryX}" cy="${p.entryY}" r="3" fill="#ffffff" />
          
          <!-- Cartel Flotante DESTINO AQUÍ -->
          <g transform="translate(${p.entryX}, ${p.entryY > 200 ? p.entryY + 12 : p.entryY - 14})">
            <rect x="-42" y="-9" width="84" height="17" fill="#000000" stroke="#ffffff" stroke-width="1.5" rx="3" />
            <text x="0" y="3" fill="#ffffff" font-family="'Segoe UI', Arial, sans-serif" font-size="8.5" font-weight="900" text-anchor="middle">🎯 DESTINO AQUÍ</text>
          </g>
        </g>
      `;
    } else {
      // Otros pabellones: Contorno Negro Nítido con texto grande en 10px bold
      return `
        <g id="pab-${p.code}">
          <rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="#ffffff" stroke="#000000" stroke-width="1.8" rx="2" />
          <text x="${p.x + 3}" y="${p.y + 10}" fill="#000000" font-family="'Segoe UI', Arial, sans-serif" font-size="8" font-weight="900">N°${p.num}</text>
          <text x="${cx}" y="${cy + 4}" fill="#000000" font-family="'Segoe UI', Arial, sans-serif" font-size="10" font-weight="800" text-anchor="middle">${p.short}</text>
        </g>
      `;
    }
  }).join('');

  // Renderizado de las 4 puertas oficiales
  const doorsSvg = (Object.keys(OFFICIAL_DOORS) as DoorId[]).map(id => {
    const d = OFFICIAL_DOORS[id];
    const isCurrent = d.id === door.id;

    if (isCurrent) {
      // Puerta Activa de Ingreso: Círculo Negro Grande con Letras Blancas y Cartel
      return `
        <g id="door-active-${d.id}">
          <circle cx="${d.x}" cy="${d.y}" r="14" fill="#000000" stroke="#ffffff" stroke-width="3" />
          <text x="${d.x}" y="${d.y + 5}" fill="#ffffff" font-family="'Segoe UI', Arial, sans-serif" font-size="12" font-weight="900" text-anchor="middle">P${d.number}</text>
          
          <g transform="translate(${d.badgeX}, ${d.badgeY})">
            <rect x="-35" y="-9" width="70" height="18" fill="#000000" stroke="#ffffff" stroke-width="1.5" rx="3" />
            <text x="0" y="4" fill="#ffffff" font-family="'Segoe UI', Arial, sans-serif" font-size="9" font-weight="900" text-anchor="middle">🚪 INGRESO</text>
          </g>
        </g>
      `;
    } else {
      // Otras puertas
      return `
        <g id="door-${d.id}">
          <circle cx="${d.x}" cy="${d.y}" r="11" fill="#ffffff" stroke="#000000" stroke-width="2" stroke-dasharray="3,2" />
          <text x="${d.x}" y="${d.y + 4}" fill="#000000" font-family="'Segoe UI', Arial, sans-serif" font-size="10" font-weight="900" text-anchor="middle">P${d.number}</text>
        </g>
      `;
    }
  }).join('');

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 420" width="100%" height="auto" style="background:#ffffff; display:block; margin:2px auto; max-width:72mm;">
  <defs>
    <!-- Flecha marcadora gruesa de fin de ruta -->
    <marker id="route-arrow" viewBox="0 0 12 12" refX="8" refY="6" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
      <path d="M 0 1 L 12 6 L 0 11 z" fill="#000000" />
    </marker>
  </defs>

  <!-- Borde Perimetral del Campus -->
  <rect x="38" y="34" width="500" height="352" fill="#ffffff" stroke="#000000" stroke-width="2.5" rx="6" />

  <!-- Veredas y Calzadas Peatonales Principales -->
  <g stroke="#000000" stroke-width="1.2" stroke-dasharray="3,3" opacity="0.45">
    <line x1="38" y1="205" x2="538" y2="205" />
    <line x1="38" y1="125" x2="538" y2="125" />
    <line x1="38" y1="340" x2="538" y2="340" />
    <line x1="290" y1="34" x2="290" y2="386" />
    <line x1="140" y1="34" x2="140" y2="386" />
    <line x1="440" y1="34" x2="440" y2="386" />
  </g>

  <!-- Glorieta / Plaza Central (Monumento Perayoc) -->
  <circle cx="290" cy="205" r="22" fill="#ffffff" stroke="#000000" stroke-width="2" />
  <circle cx="290" cy="205" r="8" fill="#000000" />
  <text x="290" y="240" fill="#000000" font-family="'Segoe UI', Arial, sans-serif" font-size="8" font-weight="900" text-anchor="middle">PLAZA CENTRAL</text>

  <!-- Nombres de Avenidas Limítrofes Grandes y Legibles -->
  <rect x="190" y="8" width="196" height="20" fill="#ffffff" stroke="#000000" stroke-width="1" rx="2" />
  <text x="288" y="22" fill="#000000" font-family="'Segoe UI', Arial, sans-serif" font-size="11" font-weight="900" text-anchor="middle" letter-spacing="1">▲ AV. COLLASUYO</text>

  <rect x="180" y="394" width="216" height="20" fill="#ffffff" stroke="#000000" stroke-width="1" rx="2" />
  <text x="288" y="408" fill="#000000" font-family="'Segoe UI', Arial, sans-serif" font-size="11" font-weight="900" text-anchor="middle" letter-spacing="1">▼ AV. LA CULTURA</text>

  <text x="18" y="210" fill="#000000" font-family="'Segoe UI', Arial, sans-serif" font-size="10.5" font-weight="900" text-anchor="middle" transform="rotate(-90 18,210)">◄ AV. UNIVERSITARIA</text>
  <text x="558" y="210" fill="#000000" font-family="'Segoe UI', Arial, sans-serif" font-size="10.5" font-weight="900" text-anchor="middle" transform="rotate(90 558,210)">AV. HAYA DE LA TORRE ►</text>

  <!-- Pabellones del Campus -->
  ${pavilionsSvg}

  <!-- LÍNEA DE RUTA ACTIVA (TRAZO GRUESO 4PX CON FLECHA) -->
  <polyline points="${routePoints}" fill="none" stroke="#000000" stroke-width="4" stroke-dasharray="7,4" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#route-arrow)" />

  <!-- Puertas Oficiales -->
  ${doorsSvg}

  <!-- Banner de Identificación de Entrada -->
  <g transform="translate(44, 40)">
    <rect x="0" y="0" width="135" height="18" fill="#ffffff" stroke="#000000" stroke-width="1.2" rx="3" />
    <circle cx="9" cy="9" r="4.5" fill="#000000" />
    <text x="18" y="13" fill="#000000" font-family="'Segoe UI', Arial, sans-serif" font-size="8.5" font-weight="900">DESDE ${door.label}</text>
  </g>
</svg>
`;
}
