/* Servicio PokéAPI: caché en memoria + normalización + concurrencia limitada.
   Todo texto que llega de la API se escapa aquí, porque la UI lo pinta con innerHTML. */

const cache = new Map();
const API_ROOT = "https://pokeapi.co/api/v2/";
const API = `${API_ROOT}pokemon/`;

function esc(s = "") {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* Solo URLs https: una imagen se pinta dentro de un atributo src. */
function safeUrl(url) {
  return typeof url === "string" && url.startsWith("https://") ? esc(url) : "";
}

/* Tipos en la generación del juego: past_types guarda los anteriores a cada cambio
   (p. ej. Clefairy era Normal hasta que llegó el tipo Hada). En la 9.ª valen los actuales. */
function gameTypes(raw) {
  if (GAME.gen >= 9) return (raw.types || []).map((t) => esc(t.type.name));
  const past = (raw.past_types || [])
    .map((p) => ({ gen: dexIdFromUrl(p.generation && p.generation.url), types: p.types }))
    .filter((p) => p.gen >= 3)
    .sort((a, b) => a.gen - b.gen)[0];
  return ((past ? past.types : raw.types) || []).map((t) => esc(t.type.name));
}

function normalize(raw) {
  const art =
    raw?.sprites?.other?.["official-artwork"]?.front_default ||
    raw?.sprites?.other?.home?.front_default ||
    raw?.sprites?.front_default ||
    "";
  return {
    id: Number(raw.id),
    name: esc(raw.name),
    sprite: safeUrl(art),
    types: gameTypes(raw),
    height: Number(raw.height) / 10, // m
    weight: Number(raw.weight) / 10, // kg
    abilities: (raw.abilities || []).map((a) => esc(a.ability.name)),
    stats: (raw.stats || []).map((s) => ({ name: esc(s.stat.name), value: Number(s.base_stat) })),
    baseExp: raw.base_experience == null ? null : Number(raw.base_experience),
    moves: extractGameMoves(raw.moves),
  };
}

async function fetchPokemon(idOrSlug, { signal } = {}) {
  const key = String(idOrSlug).toLowerCase();
  if (cache.has(key)) return cache.get(key);
  const res = await fetch(`${API}${key}`, { signal });
  if (!res.ok) throw new Error(`PokéAPI error ${res.status} para ${key}`);
  const raw = await res.json();
  const data = normalize(raw);
  cache.set(key, data);
  cache.set(String(data.id), data);
  return data;
}

/* Carga por lotes sin saturar la API (6 en paralelo). Devuelve { ok, fail }. */
async function loadAll(list, { concurrency = 6 } = {}) {
  const ok = [];
  const fail = [];
  let i = 0;
  async function worker() {
    while (i < list.length) {
      const item = list[i++];
      try {
        // Las formas regionales (Vulpix de Alola...) se piden por su nombre, pero conservan el nº de especie.
        const live = await fetchPokemon(item.form || item.id);
        ok.push({ ...item, ...live, id: item.id, name: item.slug });
      } catch {
        fail.push(item);
        ok.push({ ...item, name: item.slug, sprite: "", live: false });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, worker));
  ok.sort((a, b) => a.id - b.id);
  return { ok, fail };
}

function artworkUrl(id) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
}

/* ---------- Pokédex: evoluciones y movimientos del juego actual ---------- */

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return res.json();
}

function pretty(slug = "") {
  return esc(slug).split("-").map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(" ");
}

function esName(entry) {
  const n = ((entry && entry.names) || []).find((x) => x.language && x.language.name === "es");
  return n ? esc(n.name) : null;
}

function dexIdFromUrl(url = "") {
  const m = String(url).match(/\/(\d+)\/?$/);
  return m ? Number(m[1]) : null;
}

/* Movimientos aprendibles en el juego (GAME.versionGroups), sacados del detalle crudo. */
function extractGameMoves(moves = []) {
  const level = new Map();
  const machine = new Set();
  const tutor = new Set();
  for (const m of moves || []) {
    const slug = m.move && m.move.name;
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) continue; // también va en URLs y en el HTML
    for (const d of m.version_group_details || []) {
      if (!d.version_group || !GAME.versionGroups.includes(d.version_group.name)) continue;
      const method = d.move_learn_method && d.move_learn_method.name;
      if (method === "level-up" && d.level_learned_at > 0) {
        if (!level.has(slug) || d.level_learned_at < level.get(slug)) level.set(slug, d.level_learned_at);
      } else if (method === "machine") {
        machine.add(slug);
      } else if (method === "tutor") {
        tutor.add(slug);
      }
    }
  }
  return {
    level: [...level.entries()].map(([s, lv]) => ({ slug: s, level: lv })).sort((a, b) => a.level - b.level),
    machine: [...machine].sort(),
    tutor: [...tutor].sort(),
  };
}

/* Movimientos del juego cuando solo tenemos los datos locales (sin normalize). */
const rawCache = new Map();
async function fetchGameMoves(idOrSlug) {
  if (rawCache.has(idOrSlug)) return rawCache.get(idOrSlug);
  const raw = await fetchJSON(`${API}${idOrSlug}`);
  const moves = extractGameMoves(raw.moves);
  rawCache.set(idOrSlug, moves);
  return moves;
}

const ITEM_ES = {
  "leaf-stone": "Piedra Hoja", "fire-stone": "Piedra Fuego", "water-stone": "Piedra Agua",
  "thunder-stone": "Piedra Trueno", "moon-stone": "Piedra Luna", "sun-stone": "Piedra Solar",
  "shiny-stone": "Piedra Día", "dusk-stone": "Piedra Noche", "dawn-stone": "Piedra Alba",
  "oval-stone": "Piedra Oval", "metal-coat": "Revestimiento Metálico", "kings-rock": "Roca del Rey",
  "dragon-scale": "Escama Dragón", "upgrade": "Mejora", "dubious-disc": "Disco Extraño",
  "electirizer": "Electrizador", "magmarizer": "Magmatizador", "protector": "Protector",
  "razor-claw": "Garra Afilada", "razor-fang": "Colmillo Agudo", "reaper-cloth": "Tela Terrible",
  "deep-sea-tooth": "Diente Marino", "deep-sea-scale": "Escama Marina",
};
function itemEs(slug) {
  return ITEM_ES[slug] || pretty(slug);
}

function evoEdgeEs(d = {}) {
  const item = d.item ? d.item.name : null;
  const trigger = d.trigger ? d.trigger.name : "";
  if (trigger === "trade") return item ? `Intercambio (${itemEs(item)})` : "Intercambio";
  if (trigger === "use-item") return item ? itemEs(item) : "Objeto";
  if (trigger === "level-up") {
    if (d.min_level) return `Nv ${Number(d.min_level)}`;
    if (d.min_happiness != null) return "Amistad";
    if (d.min_beauty) return "Belleza";
    return "Nivel";
  }
  if (trigger === "shed") return "Especial";
  return pretty(trigger);
}

function parseEvoNode(node) {
  return {
    id: dexIdFromUrl(node.species.url),
    name: esc(node.species.name),
    children: (node.evolves_to || []).map((c) => ({
      edge: evoEdgeEs((c.evolution_details || [])[0] || {}),
      node: parseEvoNode(c),
    })),
  };
}

/* Árbol evolutivo completo del nº id (incluye pre-evoluciones y ramas). */
const chainCache = new Map();
async function fetchEvoChain(id) {
  if (chainCache.has(id)) return chainCache.get(id);
  const sp = await fetchJSON(`${API_ROOT}pokemon-species/${id}/`);
  const url = sp.evolution_chain && sp.evolution_chain.url;
  const tree = url ? parseEvoNode((await fetchJSON(url)).chain) : null;
  chainCache.set(id, tree);
  return tree;
}

/* PokéAPI sirve los valores actuales (los de la 9.ª generación); past_values guarda
   los anteriores a cada cambio. El valor de FRLG (grupo 7) es el del primer cambio
   posterior a la 3.ª generación (se saltan Colosseum y XD, grupos 12 y 13, también de la 3.ª). */
const FRLG_VG = 7;
const GEN3_VG_LATER = new Set([12, 13]);
function gameValues(raw) {
  const out = { power: raw.power, accuracy: raw.accuracy, type: raw.type ? raw.type.name : null };
  if (GAME.gen >= 9) return out;
  const later = (raw.past_values || [])
    .map((p) => ({ p, vg: dexIdFromUrl(p.version_group && p.version_group.url) }))
    .filter((x) => x.vg > FRLG_VG && !GEN3_VG_LATER.has(x.vg))
    .sort((a, b) => a.vg - b.vg);
  for (const field of ["power", "accuracy", "type"]) {
    const hit = later.find((x) => x.p[field] != null);
    if (hit) out[field] = field === "type" ? hit.p.type.name : hit.p[field];
  }
  return out;
}

/* Detalle de un movimiento: nombre en español, tipo, potencia y precisión en el juego,
   categoría (física / especial) y nº de MT/MO. */
const moveCache = new Map();
async function fetchMoveDetail(slug) {
  if (moveCache.has(slug)) return moveCache.get(slug);
  const raw = await fetchJSON(`${API_ROOT}move/${slug}/`);
  const g3 = gameValues(raw);
  const meta = raw.meta || {};
  const out = {
    slug,
    nameEs: esName(raw) || pretty(slug),
    type: g3.type && esc(g3.type),
    power: g3.power == null ? null : Number(g3.power),
    accuracy: g3.accuracy == null ? null : Number(g3.accuracy),
    status: !!(raw.damage_class && raw.damage_class.name === "status"),
    physical: !!(raw.damage_class && raw.damage_class.name === "physical"),
    hits: meta.min_hits && meta.max_hits ? (meta.min_hits === meta.max_hits ? meta.min_hits : 3) : 1,
    mt: null,
  };
  const mach = (raw.machines || []).find((m) => m.version_group && GAME.versionGroups.includes(m.version_group.name));
  if (mach && mach.machine && mach.machine.url) {
    try {
      const mdata = await fetchJSON(mach.machine.url);
      const item = mdata.item && mdata.item.name;
      if (item) out.mt = esc(item).replace(/^tm/i, "MT").replace(/^hm/i, "MO");
    } catch { /* sin número de MT: se muestra igual */ }
  }
  moveCache.set(slug, out);
  return out;
}

/* ---------- Pokédex: encuentros salvajes del juego (vía PokéAPI) ---------- */

const METHOD_ES = {
  walk: "Hierba",
  surf: "Surf",
  "old-rod": "Pesca (caña vieja)",
  "good-rod": "Pesca (caña buena)",
  "super-rod": "Pesca (supercaña)",
  "rock-smash": "Golpe Roca",
};
function methodEs(slug) {
  return METHOD_ES[slug] || pretty(slug);
}

const areaEsCache = new Map();
async function areaEs(slug) {
  if (areaEsCache.has(slug)) return areaEsCache.get(slug);
  let name = null;
  try {
    const la = await fetchJSON(`${API_ROOT}location-area/${slug}/`);
    name = esName(la);
    if (!name && la.location && la.location.url) {
      name = esName(await fetchJSON(la.location.url));
    }
  } catch { /* fallback al slug */ }
  if (!name) name = pretty(slug);
  areaEsCache.set(slug, name);
  return name;
}

/* Zonas salvajes del nº id en el juego actual (máx. 4, por %).
   Devuelve [{area, method, levels, rate, eds: ["fire","leaf"]}]. */
const encCache = new Map();
async function fetchDexEncounters(id) {
  if (encCache.has(id)) return encCache.get(id);
  if (!Object.keys(GAME.encounterVersions).length) return [];
  const list = await fetchJSON(`${API_ROOT}pokemon/${id}/encounters`);
  const groups = new Map();
  for (const e of list || []) {
    const area = e.location_area && e.location_area.name;
    if (!area) continue;
    for (const v of e.version_details || []) {
      const ver = v.version && v.version.name;
      const ed = GAME.encounterVersions[ver];
      if (!ed) continue;
      for (const d of v.encounter_details || []) {
        const key = `${area}|${d.method.name}`;
        const g = groups.get(key) || { area, method: d.method.name, min: 99, max: 0, chance: 0, eds: new Set() };
        g.min = Math.min(g.min, Number(d.min_level));
        g.max = Math.max(g.max, Number(d.max_level));
        g.chance = Math.max(g.chance, Number(d.chance));
        g.eds.add(ed);
        groups.set(key, g);
      }
    }
  }
  const top = [...groups.values()].sort((a, b) => b.chance - a.chance).slice(0, 4);
  await Promise.all(top.map(async (a) => { a.areaEs = await areaEs(a.area); }));
  const out = top.map((a) => ({
    area: a.areaEs,
    method: methodEs(a.method),
    levels: a.min === a.max ? `Nv ${a.min}` : `Nv ${a.min}–${a.max}`,
    rate: `${a.chance}%`,
    eds: [...a.eds],
  }));
  encCache.set(id, out);
  return out;
}

/* Banderas de especie: bebé / legendario / mítico (para el fallback de obtención). */
const spCache = new Map();
async function fetchSpeciesFlags(id) {
  if (spCache.has(id)) return spCache.get(id);
  const sp = await fetchJSON(`${API_ROOT}pokemon-species/${id}/`);
  const out = { baby: !!sp.is_baby, legendary: !!sp.is_legendary, mythical: !!sp.is_mythical };
  spCache.set(id, out);
  return out;
}
