/* Mecánicas: naturalezas (25) + tipos y eficacias (18).
   Script clásico: se carga tras data.js (usa TYPE_ES) y antes de app.js.
   Expone: NATURES, pickNatures, natureCardsHTML, initMechanics. */

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
