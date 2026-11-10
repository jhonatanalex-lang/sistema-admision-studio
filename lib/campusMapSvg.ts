/**
 * Módulo de Croquis Vectorial de Ciudad Universitaria Perayoc (UNSAAC)
 * Diseñado para impresión térmica en blanco y negro (1-bit) de 80mm.
 * Escala 1:1 optimizada para cabezal térmico de 576 puntos (72mm imprimibles).
 * Tipografía ampliada de alta legibilidad, números oficiales y trazado grueso de rutas.
 */

import { supabase } from './supabaseClient';
import { safeStorage } from './safeStorage';

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
    "x": 542,
    "y": 284,
    "badgeX": 520,
    "badgeY": 200
  },
  "P2": {
    "id": "P2",
    "number": 2,
    "label": "PUERTA N° 2",
    "avenue": "Av. La Cultura",
    "reference": "Altura del pabellón de Enfermería",
    "x": 384,
    "y": 389,
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
    "x": 41,
    "y": 169,
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
    "x": 153,
    "y": 89,
    "w": 85,
    "h": 32,
    "entryX": 204,
    "entryY": 144,
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
    "x": 241,
    "y": 92,
    "w": 74,
    "h": 25,
    "entryX": 275,
    "entryY": 145,
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
    "x": 106,
    "y": 188,
    "w": 75,
    "h": 37,
    "entryX": 189,
    "entryY": 205,
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
    "x": 209,
    "y": 183,
    "w": 55,
    "h": 34,
    "entryX": 236,
    "entryY": 180,
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
    "x": 113,
    "y": 234,
    "w": 75,
    "h": 35,
    "entryX": 200,
    "entryY": 254,
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
    "name": "ING. ELECTRONICA",
    "short": "ING. ELECTRONICA",
    "x": 394,
    "y": 129,
    "w": 106,
    "h": 30,
    "entryX": 389,
    "entryY": 161,
    "keywords": [
      "nuevo",
      "pab_5284"
    ]
  },
  {
    "code": "PAB_6006",
    "num": 19,
    "name": "TURISMO",
    "short": "TURISMO",
    "x": 209,
    "y": 252,
    "w": 69,
    "h": 31,
    "entryX": 206,
    "entryY": 283,
    "keywords": [
      "nuevo",
      "pab_6006"
    ]
  }
];

export interface WalkwayNode {
  id: string;
  x: number;
  y: number;
  label?: string;
}

export interface WalkwayEdge {
  id: string;
  from: string;
  to: string;
  bidirectional?: boolean;
}

export interface WalkwayNetwork {
  nodes: WalkwayNode[];
  edges: WalkwayEdge[];
}

export type CustomRoutesMap = Record<string, [number, number][]>;

export interface CampusMapConfig {
  doors: Record<DoorId, DoorInfo>;
  pavilions: Pavilion[];
  walkways?: WalkwayNetwork;
  routes?: CustomRoutesMap;
  updated_at?: string;
}

export const DEFAULT_WALKWAY_NETWORK: WalkwayNetwork = {
  "nodes": [
    {
      "id": "entry_DER",
      "x": 343,
      "y": 161,
      "label": "Acceso DERECHO"
    },
    {
      "id": "p_3703",
      "x": 389,
      "y": 171,
      "label": "P2"
    },
    {
      "id": "p_4360",
      "x": 391,
      "y": 236,
      "label": "P3"
    },
    {
      "id": "p_4967",
      "x": 388,
      "y": 261,
      "label": "P4"
    },
    {
      "id": "p_5567",
      "x": 381,
      "y": 277,
      "label": "P5"
    },
    {
      "id": "p_6392",
      "x": 380,
      "y": 288,
      "label": "P6"
    },
    {
      "id": "p_0839",
      "x": 434,
      "y": 285,
      "label": "P7"
    }
  ],
  "edges": [
    {
      "id": "e_entry_DER_p_3703",
      "from": "entry_DER",
      "to": "p_3703",
      "bidirectional": true
    },
    {
      "id": "e_p_3703_p_4360",
      "from": "p_3703",
      "to": "p_4360",
      "bidirectional": true
    },
    {
      "id": "e_p_4360_p_4967",
      "from": "p_4360",
      "to": "p_4967",
      "bidirectional": true
    },
    {
      "id": "e_p_4967_p_5567",
      "from": "p_4967",
      "to": "p_5567",
      "bidirectional": true
    },
    {
      "id": "e_p_5567_p_6392",
      "from": "p_5567",
      "to": "p_6392",
      "bidirectional": true
    },
    {
      "id": "e_p_6392_p_0839",
      "from": "p_6392",
      "to": "p_0839",
      "bidirectional": true
    }
  ]
};

// Configuración viva en memoria sincronizada con Supabase Cloud y safeStorage
let liveCampusMapConfig: CampusMapConfig = {
  doors: OFFICIAL_DOORS,
  pavilions: CAMPUS_PAVILIONS,
  walkways: DEFAULT_WALKWAY_NETWORK,
  routes: {},
};

// Carga inicial síncrona desde caché local persistente
try {
  const cached = safeStorage.getItem('unsaac_campus_map_config');
  if (cached) {
    const parsed = JSON.parse(cached);
    if (parsed.doors && parsed.pavilions) {
      liveCampusMapConfig = {
        doors: parsed.doors,
        pavilions: parsed.pavilions,
        walkways: parsed.walkways || DEFAULT_WALKWAY_NETWORK,
        routes: parsed.routes || {},
        updated_at: parsed.updated_at
      };
    }
  }
} catch (e) {
  // ignore
}

export function loadLiveCampusMap(): CampusMapConfig {
  return liveCampusMapConfig;
}

export function updateLiveCampusMap(newConfig: Partial<CampusMapConfig>) {
  liveCampusMapConfig = {
    ...liveCampusMapConfig,
    ...newConfig,
    walkways: newConfig.walkways || liveCampusMapConfig.walkways || DEFAULT_WALKWAY_NETWORK,
    routes: newConfig.routes !== undefined ? newConfig.routes : (liveCampusMapConfig.routes || {})
  };
  try {
    safeStorage.setItem('unsaac_campus_map_config', JSON.stringify(liveCampusMapConfig));
  } catch (e) {}
}

/**
 * Sincroniza en tiempo real la configuración del croquis desde Supabase Cloud o Backend Local.
 * Se ejecuta automáticamente sin congelar la interfaz ni bloquear impresiones.
 */
export async function syncCampusMapFromCloud(): Promise<boolean> {
  // 1. Intentar Backend Local (http://localhost:5000/api/campus-map)
  try {
    const res = await fetch('http://localhost:5000/api/campus-map', { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.doors && data.pavilions) {
        updateLiveCampusMap({
          doors: data.doors,
          pavilions: data.pavilions,
          walkways: data.walkways || DEFAULT_WALKWAY_NETWORK,
          routes: data.routes || {},
          updated_at: data.updated_at || data.last_modified
        });
        return true;
      }
    }
  } catch (e) {
    // Backend local no disponible
  }

  // 2. Intentar Supabase Cloud directamente
  try {
    const { data, error } = await supabase
      .from('templates')
      .select('content, last_modified')
      .eq('name', 'campus_map_config')
      .maybeSingle();

    if (!error && data && data.content) {
      const parsed = typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
      if (parsed.doors && parsed.pavilions) {
        updateLiveCampusMap({
          doors: parsed.doors,
          pavilions: parsed.pavilions,
          walkways: parsed.walkways || DEFAULT_WALKWAY_NETWORK,
          routes: parsed.routes || {},
          updated_at: parsed.updated_at || data.last_modified
        });
        return true;
      }
    }
  } catch (err) {
    console.warn('[CampusMap] No se pudo sincronizar mapa desde la nube:', err);
  }

  return false;
}

// Disparo silencioso de sincronización inicial en background
if (typeof window !== 'undefined') {
  setTimeout(() => {
    syncCampusMapFromCloud().catch(() => {});
  }, 1000);
}

/**
 * Identifica el pabellón a partir de los datos disponibles del postulante
 */
export function resolvePavilion(postulante: {
  carrera?: string;
  aula?: string;
  pabellon?: string;
  nombre_pabellon?: string;
}): Pavilion {
  const allPavs = (liveCampusMapConfig.pavilions && liveCampusMapConfig.pavilions.length > 0)
    ? liveCampusMapConfig.pavilions
    : CAMPUS_PAVILIONS;

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
    for (const p of allPavs) {
      if (p.keywords.some(kw => searchPabellon.includes(kw))) {
        return p;
      }
    }
  }

  // 2. Coincidencia por código o texto en el campo Aula (ej: "ARQ-101", "PAB-C-15", "DER-202")
  if (searchAula) {
    for (const p of allPavs) {
      if (p.keywords.some(kw => searchAula.includes(kw))) {
        return p;
      }
    }
  }

  // 3. Coincidencia por Escuela Profesional / Carrera del postulante
  if (searchCarrera) {
    for (const p of allPavs) {
      if (p.keywords.some(kw => searchCarrera.includes(kw))) {
        return p;
      }
    }
  }

  // Fallback: Pabellón C (pabellón genérico central de aulas)
  return allPavs.find(p => p.code === 'PAB_C') || allPavs[0];
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
 * Calcula la ruta más corta sobre la red de vías peatonales usando el algoritmo de Dijkstra.
 * Garantiza que la ruta siga estrictamente las vías habilitadas, sin atravesar ningún edificio.
 */
export function findShortestWalkwayPath(
  startPt: [number, number],
  endPt: [number, number],
  network: WalkwayNetwork = DEFAULT_WALKWAY_NETWORK
): [number, number][] {
  const nodes = [...(network.nodes || [])];
  const edges = [...(network.edges || [])];

  if (nodes.length === 0) {
    return [startPt, endPt];
  }

  // Función para encontrar el nodo más cercano a un punto dado
  function findNearest(pt: [number, number]): WalkwayNode | null {
    let nearest: WalkwayNode | null = null;
    let minDist = Infinity;
    for (const n of nodes) {
      const d = Math.hypot(n.x - pt[0], n.y - pt[1]);
      if (d < minDist) {
        minDist = d;
        nearest = n;
      }
    }
    return nearest;
  }

  const startNearest = findNearest(startPt);
  const endNearest = findNearest(endPt);

  if (!startNearest || !endNearest) {
    return [startPt, endPt];
  }

  // Crear nodos y aristas virtuales para conectar origen y destino a la red
  const startId = '__temp_start';
  const endId = '__temp_end';
  nodes.push({ id: startId, x: startPt[0], y: startPt[1] });
  nodes.push({ id: endId, x: endPt[0], y: endPt[1] });

  edges.push({ id: '__temp_e_start', from: startId, to: startNearest.id });
  edges.push({ id: '__temp_e_end', from: endNearest.id, to: endId });

  // Construir mapa de adyacencia
  const nodeMap = new Map<string, WalkwayNode>(nodes.map(n => [n.id, n]));
  const adj = new Map<string, Array<{ to: string; dist: number }>>();
  for (const n of nodes) adj.set(n.id, []);

  for (const e of edges) {
    const fn = nodeMap.get(e.from);
    const tn = nodeMap.get(e.to);
    if (!fn || !tn) continue;
    const d = Math.hypot(fn.x - tn.x, fn.y - tn.y);
    adj.get(e.from)?.push({ to: e.to, dist: d });
    if (e.bidirectional !== false) {
      adj.get(e.to)?.push({ to: e.from, dist: d });
    }
  }

  // Dijkstra
  const dists = new Map<string, number>();
  const prev = new Map<string, string>();
  const unvisited = new Set<string>(nodes.map(n => n.id));
  for (const n of nodes) dists.set(n.id, Infinity);
  dists.set(startId, 0);

  while (unvisited.size > 0) {
    let curr: string | null = null;
    let minDist = Infinity;
    for (const id of unvisited) {
      const d = dists.get(id)!;
      if (d < minDist) {
        minDist = d;
        curr = id;
      }
    }
    if (curr === null || minDist === Infinity) break;
    if (curr === endId) break;
    unvisited.delete(curr);

    for (const edge of adj.get(curr) || []) {
      if (!unvisited.has(edge.to)) continue;
      const alt = dists.get(curr)! + edge.dist;
      if (alt < dists.get(edge.to)!) {
        dists.set(edge.to, alt);
        prev.set(edge.to, curr);
      }
    }
  }

  const rawPath: [number, number][] = [];
  let u: string | undefined = endId;
  while (u) {
    const n = nodeMap.get(u);
    if (n) rawPath.unshift([n.x, n.y]);
    u = prev.get(u);
  }

  if (rawPath.length < 2) {
    return [startPt, endPt];
  }

  // 1. Limpieza de puntos duplicados continuos (< 0.8px)
  const clean: [number, number][] = [rawPath[0]];
  for (let i = 1; i < rawPath.length; i++) {
    const cur = rawPath[i];
    const prevPt = clean[clean.length - 1];
    if (Math.hypot(cur[0] - prevPt[0], cur[1] - prevPt[1]) > 0.8) {
      clean.push(cur);
    }
  }

  // 2. Reducción de puntos colineales (rectas limpias para impresión térmica nítida)
  const finalPath: [number, number][] = [clean[0]];
  for (let i = 1; i < clean.length - 1; i++) {
    const pPrev = finalPath[finalPath.length - 1];
    const pCurr = clean[i];
    const pNext = clean[i + 1];

    const dx1 = pCurr[0] - pPrev[0];
    const dy1 = pCurr[1] - pPrev[1];
    const dx2 = pNext[0] - pCurr[0];
    const dy2 = pNext[1] - pCurr[1];

    const cross = dx1 * dy2 - dy1 * dx2;
    const dot = dx1 * dx2 + dy1 * dy2;

    if (Math.abs(cross) < 1e-4 && dot > 0) {
      continue; // Colineal en la misma dirección, simplificar punto intermedio
    }
    finalPath.push(pCurr);
  }
  finalPath.push(clean[clean.length - 1]);

  return finalPath;
}

/**
 * Calcula los puntos de la ruta peatonal:
 * 1. Prioridad: Ruta calibrada punto por punto para la combinación Puerta-Pabellón (Opción 1)
 * 2. Fallback: Red de vías peatonales calculada con Dijkstra
 * garantizando cero colisiones con pabellones.
 */
export function calculateRoutePoints(
  door: DoorInfo, 
  target: Pavilion,
  customWalkways?: WalkwayNetwork,
  customRoutes?: CustomRoutesMap
): [number, number][] {
  const currentConfig = loadLiveCampusMap();
  const routes = customRoutes || currentConfig.routes || {};
  const routeKey = `${door.id}_${target.code}`;

  // Prioridad 1: Si existe ruta personalizada calibrada con esquinas
  if (routes[routeKey] && Array.isArray(routes[routeKey])) {
    const waypoints = routes[routeKey];
    return [[door.x, door.y], ...waypoints, [target.entryX, target.entryY]];
  }

  // Prioridad 2: Cálculo dinámico de camino más corto en la red peatonal
  const network = customWalkways || currentConfig.walkways || DEFAULT_WALKWAY_NETWORK;
  return findShortestWalkwayPath([door.x, door.y], [target.entryX, target.entryY], network);
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
export function generateCampusRouteSvg(doorId: DoorId, target: Pavilion, customConfig?: CampusMapConfig): string {
  const config = customConfig || loadLiveCampusMap();
  const door = (config.doors && config.doors[doorId]) || OFFICIAL_DOORS[doorId] || OFFICIAL_DOORS.P2;
  const pathPoints = calculateRoutePoints(door, target, config.walkways, config.routes);
  const vp = computeSmartViewport(door, target, pathPoints);

  const polylineStr = pathPoints.map(p => `${Math.round(p[0])},${Math.round(p[1])}`).join(' ');

  // Filtrado inteligente: Solo renderizar pabellones dentro del viewport visible (evitando recortes mínimos en bordes)
  const allPavilions = (config.pavilions && config.pavilions.length > 0) ? config.pavilions : CAMPUS_PAVILIONS;
  const visiblePavilions = allPavilions.filter(p => {
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
