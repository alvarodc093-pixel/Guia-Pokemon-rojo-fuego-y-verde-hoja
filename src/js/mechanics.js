/* Mecánicas: naturalezas (25) + tipos y eficacias (18).
   Script clásico: se carga tras data.js (usa TYPE_ES) y antes de app.js.
   Expone: NATURES, pickNatures, natureCardsHTML, pickMoveset, movesetHTML, initMechanics. */

const STAT_ES = {
  attack: "Ataque",
  defense: "Defensa",
  "special-attack": "At. Esp.",
  "special-defense": "Def. Esp.",
  speed: "Velocidad",
};
const NATURE_STATS = ["attack", "defense", "special-attack", "special-defense", "speed"];

/* Las 25 naturalezas. up/down: clave de estadística o null (neutra).
   Nombres oficiales ES según Nintendo (es) + EN. */
const NATURES = [
  { es: "Firme", en: "Adamant", up: "attack", down: "special-attack", desc: "La clásica de los atacantes físicos: todo el daño va por Ataque y el At. Esp. no se usa." },
  { es: "Huraña", en: "Lonely", up: "attack", down: "defense", desc: "Más Ataque a cambio de perder Defensa: para atacantes físicos que no suelen recibir golpes físicos." },
  { es: "Pícara", en: "Naughty", up: "attack", down: "special-defense", desc: "Sube el Ataque y deja la Def. Esp. al descubierto frente a los ataques especiales." },
  { es: "Audaz", en: "Brave", up: "attack", down: "speed", desc: "Ataque máximo bajando Velocidad: ideal en Pokémon lentos o en equipos de Espacio Raro." },

  { es: "Osada", en: "Bold", up: "defense", down: "attack", desc: "Muralla física: más Defensa y se descarta el Ataque, que una defensa no necesita." },
  { es: "Agitada", en: "Impish", up: "defense", down: "special-attack", desc: "El estándar de los tanques físicos: aguantan más y tiran a la basura el At. Esp." },
  { es: "Floja", en: "Lax", up: "defense", down: "special-defense", desc: "Aguanta mejor los físicos pero se ablanda contra los especiales." },
  { es: "Plácida", en: "Relaxed", up: "defense", down: "speed", desc: "Defensa al máximo sin velocidad: perfecta para defensas en Espacio Raro." },

  { es: "Modesta", en: "Modest", up: "special-attack", down: "attack", desc: "La clásica de los atacantes especiales: todo el daño por At. Esp. y el Ataque físico sobra." },
  { es: "Afable", en: "Mild", up: "special-attack", down: "defense", desc: "Más daño especial a cambio de perder Defensa: ofensivo pero frágil a los físicos." },
  { es: "Alocada", en: "Rash", up: "special-attack", down: "special-defense", desc: "Especialista dañino que se abre a los ataques especiales enemigos." },
  { es: "Mansa", en: "Quiet", up: "special-attack", down: "speed", desc: "At. Esp. brutal sin velocidad: para especiales lentos y potentes (o Espacio Raro)." },

  { es: "Serena", en: "Calm", up: "special-defense", down: "attack", desc: "Tanque especial: sube la Def. Esp. y descarta el Ataque físico." },
  { es: "Amable", en: "Gentle", up: "special-defense", down: "defense", desc: "Mejor contra especiales pero más flojo contra los golpes físicos." },
  { es: "Cauta", en: "Careful", up: "special-defense", down: "special-attack", desc: "El estándar de los tanques especiales: resisten y no necesitan At. Esp." },
  { es: "Grosera", en: "Sassy", up: "special-defense", down: "speed", desc: "Def. Esp. alta con poca velocidad: para puntos de resistencia lentos." },

  { es: "Miedosa", en: "Timid", up: "speed", down: "attack", desc: "Para atacantes especiales rápidos: primero en el turno y sin tocar el At. Esp." },
  { es: "Activa", en: "Hasty", up: "speed", down: "defense", desc: "Rápido pero con menos Defensa: golpea primero pero aguanta peor los físicos." },
  { es: "Alegre", en: "Jolly", up: "speed", down: "special-attack", desc: "Para atacantes físicos rápidos: velocidad pura tirando el At. Esp." },
  { es: "Ingenua", en: "Naive", up: "speed", down: "special-defense", desc: "Rápida pero vulnerable a los ataques especiales." },

  { es: "Fuerte", en: "Hardy", up: null, down: null, desc: "Neutra: no sube ni baja nada. Solo interesa si buscas unos IVs muy concretos." },
  { es: "Dócil", en: "Docile", up: null, down: null, desc: "Neutra: no modifica ninguna estadística." },
  { es: "Seria", en: "Serious", up: null, down: null, desc: "Neutra: no modifica ninguna estadística." },
  { es: "Tímida", en: "Bashful", up: null, down: null, desc: "Neutra: no modifica ninguna estadística (ojo, no confundir con Miedosa / Timid)." },
  { es: "Rara", en: "Quirky", up: null, down: null, desc: "Neutra: no modifica ninguna estadística." },
];

const NATURE_BY_KEY = new Map(NATURES.map((n) => [`${n.up}|${n.down}`, n]));

function natureOf(up, down) {
  return NATURE_BY_KEY.get(`${up}|${down}`) || null;
}

function natureEffectHTML(up, down) {
  if (!up || !down) return `<span class="nat-neutral">Sin cambios (neutra)</span>`;
  return `<span class="nat-up">▲ +10% ${STAT_ES[up]}</span><span class="nat-down">▼ −10% ${STAT_ES[down]}</span>`;
}

function statsMap(stats) {
  const s = {};
  for (const k of NATURE_STATS) {
    const hit = (stats || []).find((x) => x && x.name === k);
    s[k] = hit ? Number(hit.value) || 0 : 0;
  }
  return s;
}

function otherOffensive(k) {
  return k === "attack" ? "special-attack" : "attack";
}

function topStat(s) {
  return NATURE_STATS.reduce((a, b) => (s[b] > s[a] ? b : a));
}

/* Naturaleza óptima + alternativa a partir de las estadísticas base.
   Devuelve { s, boost, drop, opt, altBoost, altDrop, alt } o null. */
function pickNatures(stats) {
  const s = statsMap(stats);
  if (!s.attack && !s["special-attack"] && !s.speed) return null;

  const phys = s.attack;
  const spec = s["special-attack"];
  const offensive = phys === spec ? null : phys > spec ? "attack" : "special-attack";
  const top = topStat(s);
  const wall = (top === "defense" || top === "special-defense") && s[top] >= 90 && s[top] >= Math.max(phys, spec) * 1.2;

  let boost;
  if (s.speed >= 95) boost = "speed";
  else if (wall) boost = top;
  else if (offensive && s.speed >= 90 && s.speed >= Math.max(phys, spec) * 1.5) boost = "speed";
  else if (offensive) boost = offensive;
  else boost = s.speed >= 85 ? "speed" : top;

  let drop;
  if (boost === "attack") drop = "special-attack";
  else if (boost === "special-attack") drop = "attack";
  else drop = phys <= spec ? "attack" : "special-attack";

  let altBoost;
  if (boost === "speed") altBoost = offensive || (phys >= spec ? "attack" : "special-attack");
  else if (boost === "defense" || boost === "special-defense") {
    const otherWall = boost === "defense" ? "special-defense" : "defense";
    altBoost = s[otherWall] >= 85 ? otherWall : s.speed >= 75 ? "speed" : otherWall;
  } else altBoost = "speed";

  let altDrop = drop;
  if (altBoost === altDrop) altDrop = otherOffensive(altDrop);

  const opt = natureOf(boost, drop);
  const alt = natureOf(altBoost, altDrop);
  if (!opt || !alt) return null;
  return { s, boost, drop, opt, altBoost, altDrop, alt };
}

/* Frase breve explicando por qué esa naturaleza encaja con el Pokémon. */
function natureWhy(s, boost, drop) {
  const B = STAT_ES[boost];
  const D = STAT_ES[drop];
  const bv = s[boost];
  const dv = s[drop];
  if (boost === "speed") {
    return bv >= 85
      ? `Con ${bv} de ${B.toLowerCase()}, ganar el turno vale oro: sube un 10% y el −10% cae sobre ${D} (base ${dv}), el stat que menos aprovecha.`
      : `No es rápido (${bv} de ${B.toLowerCase()}), así que prefiere el −10% en ${D} (base ${dv}) y recortar distancias con un 10% extra de velocidad.`;
  }
  if (boost === "defense" || boost === "special-defense") {
    return `Rol de tanque: su ${B} (base ${bv}) es su mejor atributo, así que sube un 10% ahí y baja un 10% ${D} (base ${dv}), que apenas usa.`;
  }
  const kind = boost === "attack" ? "físico" : "especial";
  return `Atacante ${kind}: concentra el daño en ${B} (base ${bv}) y descarta ${D} (base ${dv}), que casi no le sirve.`;
}

/* Bloque completo "Naturaleza óptima" para la ficha de la Pokédex y el modal. */
function natureCardsHTML(stats) {
  const pick = pickNatures(stats);
  if (!pick) {
    return `<h3 class="dex-sub">Naturaleza óptima 🎯</h3>
      <p>Sin estadísticas base disponibles para calcularla.</p>`;
  }
  const card = (tag, n, up, down, why, cls) => `
    <article class="nat-card ${cls}">
      <p class="nat-tag">${tag}</p>
      <h4 class="nat-name">${n.es} <span class="nat-en">(${n.en})</span></h4>
      <p class="nat-effect">${natureEffectHTML(up, down)}</p>
      <p class="nat-why">${why}</p>
    </article>`;
  return `<h3 class="dex-sub">Naturaleza óptima 🎯</h3>
    <div class="nat-cards">
      ${card("Óptima", pick.opt, pick.boost, pick.drop, natureWhy(pick.s, pick.boost, pick.drop), "nat-card--opt")}
      ${card("Alternativa", pick.alt, pick.altBoost, pick.altDrop, natureWhy(pick.s, pick.altBoost, pick.altDrop), "nat-card--alt")}
    </div>
    <p class="loc-source">Calculada sobre sus estadísticas base · Las 25 naturalezas, en
      <a href="#mecanicas" data-tab="mecanicas">Mecánicas</a></p>`;
}

/* ---------- Tipos ---------- */

const TYPE_ICONS = {
  normal: "⭕", fire: "🔥", water: "💧", grass: "🌿", electric: "⚡",
  ice: "❄️", fighting: "🥊", poison: "☠️", ground: "🏔️", flying: "🕊️",
  psychic: "🔮", bug: "🐞", rock: "🪨", ghost: "👻", dark: "🌑",
  dragon: "🐉", steel: "⚙️", fairy: "🧚",
};

const TYPE_EN = {
  normal: "Normal", fire: "Fire", water: "Water", grass: "Grass", electric: "Electric",
  ice: "Ice", fighting: "Fighting", poison: "Poison", ground: "Ground", flying: "Flying",
  psychic: "Psychic", bug: "Bug", rock: "Rock", ghost: "Ghost", dark: "Dark",
  dragon: "Dragon", steel: "Steel", fairy: "Fairy",
};

const TYPE_ORDER = [
  "normal", "fire", "water", "grass", "electric", "ice", "fighting", "poison", "ground",
  "flying", "psychic", "bug", "rock", "ghost", "dark", "dragon", "steel", "fairy",
];

/* Eficacia al ATACAR: tipo -> { x2, x05, x0 }. */
const TYPE_CHART = {
  normal:   { x2: [], x05: ["rock", "steel"], x0: ["ghost"] },
  fire:     { x2: ["grass", "ice", "bug", "steel"], x05: ["fire", "water", "rock", "dragon"], x0: [] },
  water:    { x2: ["fire", "ground", "rock"], x05: ["water", "grass", "dragon"], x0: [] },
  grass:    { x2: ["water", "ground", "rock"], x05: ["fire", "poison", "grass", "flying", "bug", "dragon", "steel"], x0: [] },
  electric: { x2: ["water", "flying"], x05: ["electric", "grass", "dragon"], x0: ["ground"] },
  ice:      { x2: ["grass", "ground", "flying", "dragon"], x05: ["fire", "water", "ice", "steel"], x0: [] },
  fighting: { x2: ["normal", "ice", "rock", "dark", "steel"], x05: ["poison", "flying", "psychic", "bug", "fairy"], x0: ["ghost"] },
  poison:   { x2: ["grass", "fairy"], x05: ["poison", "ground", "rock", "ghost"], x0: ["steel"] },
  ground:   { x2: ["fire", "electric", "poison", "rock", "steel"], x05: ["grass", "bug"], x0: ["flying"] },
  flying:   { x2: ["grass", "fighting", "bug"], x05: ["electric", "rock", "steel"], x0: [] },
  psychic:  { x2: ["fighting", "poison"], x05: ["psychic", "steel"], x0: ["dark"] },
  bug:      { x2: ["grass", "psychic", "dark"], x05: ["fire", "fighting", "poison", "flying", "ghost", "steel", "fairy"], x0: [] },
  rock:     { x2: ["fire", "ice", "flying", "bug"], x05: ["fighting", "ground", "steel"], x0: [] },
  ghost:    { x2: ["psychic", "ghost"], x05: ["dark"], x0: ["normal"] },
  dark:     { x2: ["psychic", "ghost"], x05: ["fighting", "dark", "fairy"], x0: [] },
  dragon:   { x2: ["dragon"], x05: ["steel"], x0: ["fairy"] },
  steel:    { x2: ["rock", "ice", "fairy"], x05: ["fire", "water", "electric", "steel"], x0: [] },
  fairy:    { x2: ["fighting", "dragon", "dark"], x05: ["fire", "poison", "steel"], x0: [] },
};

function typeIcon(t) { return TYPE_ICONS[t] || "❔"; }
function typeNameEs(t) { return TYPE_ES[t] || t; }

/* Eficacia defensiva de un tipo: qué le hace 2×, qué resiste (½×) y qué le ignora (0×). */
function typeDefense(t) {
  const weak = [];
  const resist = [];
  const immune = [];
  for (const atk of TYPE_ORDER) {
    const row = TYPE_CHART[atk];
    if (!row) continue;
    if (row.x2.includes(t)) weak.push(atk);
    else if (row.x05.includes(t)) resist.push(atk);
    else if (row.x0.includes(t)) immune.push(atk);
  }
  return { weak, resist, immune };
}

function typeTagList(list) {
  if (!list || !list.length) return `<span class="mech-none">ninguno</span>`;
  return list.map((t) => `<span class="type-chip type-${t}">${typeIcon(t)} ${typeNameEs(t)}</span>`).join(" ");
}

function typeCardsHTML() {
  return TYPE_ORDER.map((t) => {
    const d = typeDefense(t);
    const off = TYPE_CHART[t];
    return `<article class="type-card">
      <h4 class="type-card-name"><span class="type-chip type-${t} type-chip--lg">${typeIcon(t)} ${typeNameEs(t)}</span>
        <span class="type-card-en">${TYPE_EN[t]}</span></h4>
      <ul class="type-card-list">
        <li><strong>Atacando hace 2× a:</strong> ${typeTagList(off.x2)}</li>
        <li><strong>Recibe 2× de:</strong> ${typeTagList(d.weak)}</li>
        <li><strong>Resiste (½×):</strong> ${typeTagList(d.resist)}</li>
        <li><strong>Inmune (0×):</strong> ${typeTagList(d.immune)}</li>
      </ul>
    </article>`;
  }).join("");
}

/* Tabla 18×18: fila = atacante, columna = defensor. */
function typeChartHTML() {
  const head = `<thead><tr><th scope="col" class="chart-corner">Ataque ↓ / Defensa →</th>${TYPE_ORDER
    .map((t) => `<th scope="col" title="${typeNameEs(t)} (${TYPE_EN[t]})">${typeIcon(t)}<span class="sr-only"> ${typeNameEs(t)}</span></th>`)
    .join("")}</tr></thead>`;
  const body = TYPE_ORDER.map((atk) => {
    const row = TYPE_CHART[atk];
    const cells = TYPE_ORDER.map((def) => {
      let v = "—";
      let cls = "eff-n";
      if (row.x2.includes(def)) { v = "2×"; cls = "eff-2"; }
      else if (row.x05.includes(def)) { v = "½×"; cls = "eff-h"; }
      else if (row.x0.includes(def)) { v = "0×"; cls = "eff-0"; }
      const label = v === "—" ? "sin efecto especial (1×)" : v === "2×" ? "muy eficaz (2×)" : v === "½×" ? "poco eficaz (½×)" : "no le afecta (0×)";
      return `<td class="${cls}" title="${typeNameEs(atk)} → ${typeNameEs(def)}: ${label}"><span aria-hidden="true">${v}</span><span class="sr-only">${label}</span></td>`;
    }).join("");
    return `<tr><th scope="row">${typeIcon(atk)} ${typeNameEs(atk)}</th>${cells}</tr>`;
  }).join("");
  return `${head}<tbody>${body}</tbody>`;
}

function natureCardsGridHTML() {
  return NATURES.map((n) => {
    const neutral = !n.up || !n.down;
    return `<article class="nature-item${neutral ? " nature-item--neutral" : ""}">
      <h4 class="nature-item-name">${n.es} <span class="nature-item-en">${n.en}</span></h4>
      <p class="nature-item-effect">${natureEffectHTML(n.up, n.down)}</p>
      <p class="nature-item-desc">${n.desc}</p>
    </article>`;
  }).join("");
}

/* ---------- Set de ataques recomendado (ficha de la Pokédex) ---------- */

/* En la 3.ª generación la categoría la decide el tipo, no el movimiento. */
const PHYSICAL_TYPES = new Set(["normal", "fighting", "flying", "poison", "ground", "rock", "bug", "ghost", "steel"]);
const GEN3_TYPES = TYPE_ORDER.filter((t) => t !== "fairy");

/* Daño variable con un valor de referencia razonable (Retribución con amistad máxima). */
const MOVE_POWER_FIX = { return: 102, magnitude: 71 };
/* Daño fijo igual al nivel: se valora como un ataque de 70 con stat 100 y sin STAB. */
const FIXED_DAMAGE = { "seismic-toss": "ghost", "night-shade": "normal" }; // slug -> tipo inmune
/* Inconvenientes: recarga, dos turnos, retroceso, confusión o bajada de stats. */
const MOVE_PENALTY = {
  "hyper-beam": 0.5, "blast-burn": 0.5, "hydro-cannon": 0.5, "frenzy-plant": 0.5,
  "solar-beam": 0.6, "sky-attack": 0.5, "razor-wind": 0.5, "skull-bash": 0.5,
  "future-sight": 0.6, "doom-desire": 0.6, "focus-punch": 0.4,
  fly: 0.8, dig: 0.8, dive: 0.8, bounce: 0.8, eruption: 0.7, "water-spout": 0.7,
  "double-edge": 0.85, "take-down": 0.85, submission: 0.85, "volt-tackle": 0.85,
  thrash: 0.85, "petal-dance": 0.85, outrage: 0.85, uproar: 0.85,
  overheat: 0.6, "psycho-boost": 0.6, superpower: 0.8,
};
/* Sin sitio en un set: se debilitan, dependen del rival o del estado, o son para capturar. */
const MOVE_EXCLUDED = new Set([
  "explosion", "self-destruct", "dream-eater", "snore", "false-swipe", "hidden-power",
  "sonic-boom", "dragon-rage", "super-fang", "psywave", "present", "bide", "counter", "mirror-coat",
  "endeavor", "flail", "reversal", "spit-up", "low-kick", "struggle",
]);
/* Mejoras de stats: ocupan el 4.º hueco si el último ataque apenas suma. kind = ataques que potencian. */
const BOOST_PICKS = [
  { slug: "dragon-dance", kind: "physical", why: "Sube Ataque y Velocidad: tras usarlo, barre." },
  { slug: "swords-dance", kind: "physical", why: "Duplica el Ataque de sus golpes físicos." },
  { slug: "bulk-up", kind: "physical", why: "Sube Ataque y Defensa." },
  { slug: "calm-mind", kind: "special", why: "Sube At. Esp. y Def. Esp." },
];
/* Apoyo solo para huecos que no llena ningún ataque útil, en orden de preferencia.
   last: únicamente si no aprende ningún ataque (Wobbuffet y similares). */
const SUPPORT_PICKS = [
  { slug: "spore", why: "Duerme al rival sin fallar." },
  { slug: "sleep-powder", why: "Duerme al rival." },
  { slug: "softboiled", why: "Recupera la mitad de los PS." },
  { slug: "milk-drink", why: "Recupera la mitad de los PS." },
  { slug: "recover", why: "Recupera la mitad de los PS." },
  { slug: "thunder-wave", why: "Paraliza: el rival pierde velocidad y a veces el turno." },
  { slug: "will-o-wisp", why: "Quema: el rival pierde vida y la mitad de su Ataque." },
  { slug: "leech-seed", why: "Roba vida cada turno." },
  { slug: "toxic", why: "Envenena gravemente: el daño crece cada turno." },
  { slug: "hypnosis", why: "Duerme al rival (precisión baja)." },
  { slug: "stun-spore", why: "Paraliza al rival." },
  { slug: "counter", last: true, why: "Devuelve el doble del daño físico recibido." },
  { slug: "mirror-coat", last: true, why: "Devuelve el doble del daño especial recibido." },
  { slug: "destiny-bond", last: true, why: "Si cae, se lleva al rival con él." },
  { slug: "substitute", last: true, why: "Crea un sustituto que absorbe los golpes." },
  { slug: "rest", last: true, why: "Recupera todos los PS a cambio de dormir dos turnos." },
  { slug: "hidden-power", last: true, why: "Su único ataque: el tipo y la potencia dependen de sus IV." },
  { slug: "transform", last: true, why: "Copia al rival: tipos, stats y ataques." },
];
const SLEEP_MOVES = new Set(["spore", "sleep-powder", "hypnosis"]);

/* Eficacia en la 3.ª generación: sin tipo Hada y Acero resiste Fantasma y Siniestro. */
function gen3Eff(atk, def) {
  if (def === "steel" && (atk === "ghost" || atk === "dark")) return 0.5;
  const row = TYPE_CHART[atk];
  if (!row) return 1;
  if (row.x2.includes(def)) return 2;
  if (row.x05.includes(def)) return 0.5;
  if (row.x0.includes(def)) return 0;
  return 1;
}

/* Valor ofensivo de un movimiento contra un defensor neutro, o null si no entra en el set. */
function attackCandidate(m, s, types) {
  const info = m.info;
  if (!info || info.status || !info.type || MOVE_EXCLUDED.has(m.slug)) return null;
  const acc = (info.accuracy == null ? 100 : info.accuracy) / 100;
  if (FIXED_DAMAGE[m.slug]) {
    return { ...m, fixed: true, key: m.slug, score: 70 * 100 * acc, eff: (d) => (d === FIXED_DAMAGE[m.slug] ? 0 : 1) };
  }
  const power = MOVE_POWER_FIX[m.slug] || info.power;
  if (!power) return null;
  const physical = PHYSICAL_TYPES.has(info.type);
  const stat = (physical ? s.attack : s["special-attack"]) || 100;
  const stab = types.includes(info.type);
  const score = power * (info.hits || 1) * acc * (stab ? 1.5 : 1) * stat * (MOVE_PENALTY[m.slug] || 1);
  return { ...m, physical, stab, key: info.type, score, eff: (d) => gen3Eff(info.type, d) };
}

/* Daño del set: contra cada tipo defensor cuenta el mejor de sus ataques. */
function setValue(set) {
  return GEN3_TYPES.reduce((sum, d) => sum + Math.max(0, ...set.map((c) => c.score * c.eff(d))), 0);
}

/* Elige hasta 4 ataques de forma voraz (potencia + cobertura) y completa con apoyo.
   moves: { level, machine, tutor } con info de fetchMoveDetail. */
function pickMoveset(stats, types, moves) {
  const s = statsMap(stats);
  const all = new Map(); // slug -> { slug, info, source }; el nivel gana a MT y tutor
  for (const m of moves.tutor || []) all.set(m.slug, { ...m, source: "Tutor" });
  for (const m of moves.machine || []) all.set(m.slug, { ...m, source: (m.info && m.info.mt) || "MT" });
  for (const m of moves.level || []) all.set(m.slug, { ...m, source: `Nv ${m.level}` });

  // Un candidato por tipo: el mejor.
  const best = new Map();
  for (const m of all.values()) {
    const c = attackCandidate(m, s, types);
    if (c && (!best.has(c.key) || best.get(c.key).score < c.score)) best.set(c.key, c);
  }
  let pool = [...best.values()];
  const set = [];
  const gains = [];
  let total = 0;
  while (set.length < 4 && pool.length) {
    let top = null;
    let topVal = total;
    for (const c of pool) {
      const v = setValue([...set, c]);
      if (v > topVal) { top = c; topVal = v; }
    }
    // Un ataque que suma menos de un 2 % no merece hueco.
    if (!top || (set.length && topVal - total < total * 0.02)) break;
    set.push(top);
    gains.push(set.length > 1 ? (topVal - total) / total : 1);
    total = topVal;
    pool = pool.filter((c) => c !== top);
  }

  const support = [];
  const add = (m, why) => support.push({ ...m, why });
  const has = (slug) => all.get(slug) && all.get(slug).info;
  // Una mejora de stats sustituye al 4.º ataque si este aporta menos de un 8 %.
  const kindOf = (c) => (c.fixed ? null : c.physical ? "physical" : "special");
  const counts = { physical: 0, special: 0 };
  set.forEach((c) => { if (kindOf(c)) counts[kindOf(c)]++; });
  const boost = set.length >= 2 && BOOST_PICKS.find((b) => has(b.slug) && counts[b.kind] >= 2);
  if (boost && (set.length < 4 || gains[3] < 0.08)) {
    if (set.length === 4) set.pop();
    add(all.get(boost.slug), boost.why);
  }
  for (const p of SUPPORT_PICKS) {
    if (set.length + support.length >= 4) break;
    if (!has(p.slug) || (p.last && set.length)) continue;
    if (SLEEP_MOVES.has(p.slug) && support.some((x) => SLEEP_MOVES.has(x.slug))) continue;
    add(all.get(p.slug), p.why);
  }

  const covered = GEN3_TYPES.filter((d) => set.some((c) => !c.fixed && c.eff(d) >= 2));
  const walls = GEN3_TYPES.filter((d) => set.length && set.every((c) => c.eff(d) < 1));
  return { s, set, support, covered, walls };
}

function movesetRoleText(s, set) {
  const phys = set.filter((c) => !c.fixed && c.physical).length;
  const spec = set.filter((c) => !c.fixed && !c.physical).length;
  const stats = `Ataque ${s.attack} · At. Esp. ${s["special-attack"]}`;
  if (phys && spec) return `Atacante mixto (${stats})`;
  if (phys) return `Atacante físico (${stats})`;
  if (spec) return `Atacante especial (${stats})`;
  if (set.length) return `Daño fijo y apoyo (${stats})`;
  return `Sin ataques directos que recomendar (${stats})`;
}

function movesetWhy(c) {
  if (c.fixed) return "Quita tantos PS como su nivel, sin importar sus stats ni los del rival.";
  const se = GEN3_TYPES.filter((d) => c.eff(d) >= 2);
  const parts = [];
  if (c.stab) parts.push("STAB (+50 % por ser de su tipo)");
  if (se.length) parts.push(`muy eficaz contra ${se.map(typeNameEs).join(", ")}`);
  const note = MOVE_PENALTY[c.slug] ? " Tiene un inconveniente, pero es lo mejor que aprende de este tipo." : "";
  return (parts.length ? cap(parts.join("; ")) + "." : "Daño neutro sin STAB.") + note;
}

/* Bloque "Set recomendado" de la ficha de la Pokédex. */
function movesetHTML(p, moves) {
  const title = `<h3 class="dex-sub">Set recomendado ⚔️</h3>`;
  const pick = pickMoveset(p.stats, p.types || [], moves);
  if (!pick.set.length && !pick.support.length) {
    return `${title}<p>No aprende ataques que valga la pena recomendar en Rojo Fuego / Verde Hoja.</p>`;
  }
  const card = (m, why, extra = "") => {
    const info = m.info;
    const pow = info.power == null ? (MOVE_POWER_FIX[m.slug] ? `~${MOVE_POWER_FIX[m.slug]}` : "—") : info.power;
    const acc = info.accuracy == null ? "—" : info.accuracy;
    return `<li class="set-card${extra}">
      <p class="set-top"><strong class="set-name">${info.nameEs}</strong><span class="mt-badge">${m.source}</span></p>
      <p class="set-meta">${typeChips([info.type])}<span>Pot. ${pow} · Prec. ${acc}</span></p>
      <p class="nat-why">${why}</p>
    </li>`;
  };
  const items = [
    ...pick.set.map((c) => card(c, movesetWhy(c))),
    ...pick.support.map((m) => card(m, m.why, " set-card--support")),
  ].join("");
  const cover = pick.set.length
    ? `<p class="loc-source"><strong>Muy eficaz contra ${pick.covered.length} de ${GEN3_TYPES.length} tipos.</strong>
        ${pick.walls.length ? `Le cuesta contra: ${typeTagList(pick.walls)}` : "Ningún tipo resiste todos sus ataques."}</p>`
    : "";
  return `${title}
    <p class="set-role">${movesetRoleText(pick.s, pick.set)}</p>
    <ul class="set-cards">${items}</ul>
    ${cover}
    <p class="loc-source">Calculado con las reglas de la 3.ª generación: el tipo decide si un ataque es físico o especial.
      Cuenta potencia, precisión, STAB y cobertura. Ojo: en RFVH cada MT se gasta al usarla y cada tutor enseña una sola vez.</p>`;
}

/* Render de la pestaña Mecánicas (una sola vez, al arrancar). */
function initMechanics() {
  const grid = document.getElementById("natureGrid");
  const types = document.getElementById("typeGrid");
  const chart = document.getElementById("typeChart");
  const legend = document.getElementById("chartLegend");
  if (grid) grid.innerHTML = natureCardsGridHTML();
  if (types) types.innerHTML = typeCardsHTML();
  if (chart) chart.innerHTML = typeChartHTML();
  if (legend) {
    legend.innerHTML = `Leyenda: <span class="eff-legend eff-2">2×</span> muy eficaz ·
      <span class="eff-legend eff-h">½×</span> poco eficaz ·
      <span class="eff-legend eff-0">0×</span> no le afecta ·
      <span class="eff-legend eff-n">—</span> sin efecto especial (1×). Tipos con interacción con Hada incluida.`;
  }
}
