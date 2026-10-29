/* Configuración de cada juego de la guía. Es el primer script de la página:
   <body data-game="frlg|sv"> elige el juego y el resto de scripts leen GAME.
   Las dos ediciones de cada juego usan siempre las claves "fire" (la primera:
   Rojo Fuego / Escarlata) y "leaf" (la segunda: Verde Hoja / Púrpura). */

const GAMES = {
  frlg: {
    id: "frlg",
    title: "Rojo Fuego / Verde Hoja",
    editions: {
      fire: { name: "Rojo Fuego", icon: "🔥" },
      leaf: { name: "Verde Hoja", icon: "🍃" },
    },
    gen: 3,
    versionGroups: ["firered-leafgreen"],
    machines: "MT/MO",
    encounterVersions: { firered: "fire", leafgreen: "leaf" },
    regions: { kanto: "Kanto", johto: "Johto" },
    regionOf: (id) => (id <= 151 ? "kanto" : "johto"),
    caughtKey: "frlg:caught:v1",
    maxId: 386,
    cutouts: true,
    rankedBoost: (slug) => `https://rankedboost.com/pokemon/${slug}/firered-leafgreen/`,
    rankedBoostLabel: "FRLG",
    movesNote: "Ojo: en RFVH cada MT se gasta al usarla y cada tutor enseña una sola vez.",
    noWildText: "No aparece salvaje en Rojo Fuego / Verde Hoja · se consigue por intercambio desde otros juegos.",
  },
  sv: {
    id: "sv",
    title: "Escarlata / Púrpura",
    editions: {
      fire: { name: "Escarlata", icon: "🔴" },
      leaf: { name: "Púrpura", icon: "🟣" },
    },
    gen: 9,
    versionGroups: ["scarlet-violet", "the-teal-mask", "the-indigo-disk"],
    machines: "MT", // no hay MO desde la 7.ª generación
    encounterVersions: {}, // PokéAPI no tiene encuentros de Escarlata/Púrpura
    regions: { paldea: "Paldea", kitakami: "Noroteo", blueberry: "Arándano" },
    regionOf: null, // cada entrada de DEX_ALL trae su región
    caughtKey: "sv:caught:v1",
    maxId: 1025,
    cutouts: false,
    rankedBoost: (slug) => `https://rankedboost.com/pokemon-scarlet-violet/${slug}/`,
    rankedBoostLabel: "Escarlata/Púrpura",
    movesNote: "En Escarlata/Púrpura las MT no se gastan: se fabrican con materiales en cualquier Centro Pokémon.",
    noWildText: "RankedBoost no tiene su ubicación (no cubre los DLC ni todos los encuentros). Consulta dónde encontrarlo en su ficha de Serebii.",
    serebii: (slug) => `https://www.serebii.net/pokedex-sv/${slug.replace(/-/g, "")}/`,
  },
};

const GAME = GAMES[document.body.dataset.game] || GAMES.frlg;

/* Etiquetas de tipos en español para la UI */
const TYPE_ES = {
  normal: "Normal",
  fire: "Fuego",
  water: "Agua",
  grass: "Planta",
  electric: "Eléctrico",
  ice: "Hielo",
  fighting: "Lucha",
  poison: "Veneno",
  ground: "Tierra",
  flying: "Volador",
  psychic: "Psíquico",
  bug: "Bicho",
  rock: "Roca",
  ghost: "Fantasma",
  dark: "Siniestro",
  dragon: "Dragón",
  steel: "Acero",
  fairy: "Hada",
};

/* Nombre de la edición ("fire" / "leaf") del juego actual, con o sin icono. */
function editionName(ed, { icon = false } = {}) {
  const e = GAME.editions[ed];
  if (!e) return "";
  return icon ? `${e.icon} ${e.name}` : e.name;
}

function regionName(d) {
  const key = d.region || (GAME.regionOf && GAME.regionOf(d.id));
  return GAME.regions[key] || "";
}
