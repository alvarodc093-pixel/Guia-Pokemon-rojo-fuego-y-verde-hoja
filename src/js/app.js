/* App principal: pestañas, ediciones, modal y guía en vídeo.
   Script clásico: usa los globales de games.js, los datos y la playlist del juego,
   api.js y ui.js (cargados antes, al final de cada página). */

const $ = (s, r = document) => r.querySelector(s);
const gridFire = $("#grid-fire");
const gridLeaf = $("#grid-leaf");
const stripFire = $("#strip-fire");
const stripLeaf = $("#strip-leaf");
const statusFire = document.querySelector('[data-panel-status="fire"]');
const statusLeaf = document.querySelector('[data-panel-status="leaf"]');
const modalBackdrop = $("#modalBackdrop");
const modalBody = $("#modalBody");
const modalClose = $("#modalClose");

const ALL_EXCLUSIVES = [
  ...EXCL_FIRE.map((p) => ({ ...p, edition: "fire" })),
  ...EXCL_LEAF.map((p) => ({ ...p, edition: "leaf" })),
];

let store = []; // lista enriquecida con datos vivos
let lastFocus = null;

/* Pestañas independientes (sin scroll infinito). Debe ir antes de init()
   porque initTabs() lo usa durante el arranque. */
const TABS = ["pokedex", "mecanicas", "ediciones", "mapa", "guia", "recursos"];

init();

async function init() {
  // Cada subsistema va protegido: si uno falla, el resto sigue funcionando.
  safe("images", initImageFallbacks);
  safe("nav", initNav);
  safe("tabs", initTabs);
  safe("dex", initPokedex);
  safe("mecanics", initMechanics);
  safe("grids", initGridEvents);
  safe("modal", initModal);
  safe("guide", initGuide);
  safe("skeletons", paintSkeletons);

  try {
    const { ok, fail } = await loadAll(ALL_EXCLUSIVES);
    store = ok;
    if (fail.length) {
      toast(`Sin conexión total: ${fail.length} mostrados con datos locales`);
      const msg = `Mostrando datos locales (sin conexión a PokéAPI) en ${fail.length} caso(s).`;
      statusFire.textContent = msg;
      statusLeaf.textContent = msg;
    }
    renderEditions();
  } catch (err) {
    console.error(err);
    store = ALL_EXCLUSIVES.map((p) => ({ ...p, name: p.slug, sprite: "" }));
    statusFire.textContent = "No se pudo contactar con PokéAPI. Mostrando datos locales.";
    statusLeaf.textContent = statusFire.textContent;
    renderEditions();
  }
}

function safe(name, fn) {
  try {
    fn();
  } catch (err) {
    console.error(`[init:${name}]`, err);
  }
}

/* Imágenes con respaldo: data-fallback (otra URL) o data-fallback-text (texto).
   Sustituye a los onerror en línea, que la Content-Security-Policy bloquea. */
function imageFallback(img) {
  if (img.dataset.fallback) {
    const alt = img.dataset.fallback;
    delete img.dataset.fallback; // un solo intento
    img.src = alt;
  } else if (img.dataset.fallbackText) {
    const p = document.createElement("p");
    p.className = "pokemon-logo-fallback";
    p.textContent = img.dataset.fallbackText;
    img.replaceWith(p);
  }
}

function initImageFallbacks() {
  document.addEventListener("error", (e) => {
    if (e.target instanceof HTMLImageElement) imageFallback(e.target);
  }, true);
  // Las que fallaron antes de cargar este script (el logo va arriba del todo).
  document.querySelectorAll("img[data-fallback], img[data-fallback-text]").forEach((img) => {
    if (img.complete && img.naturalWidth === 0) imageFallback(img);
  });
}

/* ---------- Navegación móvil ---------- */

function initNav() {
  const btn = $("#navToggle");
  const menu = $("#navMenu");
  btn.addEventListener("click", () => {
    const open = menu.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(open));
    btn.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
  });
  menu.addEventListener("click", (e) => {
    if (e.target.closest("a")) {
      menu.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
      setDexMenu(false);
    }
  });
  // Desplegable "Pokédex": una entrada por juego de la guía.
  const dexBtn = $("#dexMenuBtn");
  dexBtn.addEventListener("click", () => setDexMenu(dexBtn.getAttribute("aria-expanded") !== "true"));
  // La entrada del juego actual no recarga la página: solo abre la pestaña.
  $("#dexMenu").addEventListener("click", (e) => {
    const a = e.target.closest("a[data-game]");
    if (!a || a.dataset.game !== GAME.id) return;
    e.preventDefault();
    setDexMenu(false);
    activateTab("pokedex");
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".nav-drop")) setDexMenu(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && dexBtn.getAttribute("aria-expanded") === "true") {
      setDexMenu(false);
      dexBtn.focus();
    }
  });
}

function setDexMenu(open) {
  $("#dexMenuBtn").setAttribute("aria-expanded", String(open));
  $("#dexMenu").hidden = !open;
}

/* ---------- Pestañas independientes (ver const TABS arriba) ---------- */
function initTabs() {
  // Enlaces y botones con data-tab (navegación, hero, propia tablist)
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-tab]");
    if (!t) return;
    e.preventDefault();
    activateTab(t.dataset.tab, { scrollTarget: t.dataset.scroll || null });
  });
  // Teclado en la tablist: flechas / inicio / fin
  $(".tabs").addEventListener("keydown", (e) => {
    const i = TABS.indexOf(document.activeElement?.dataset?.tab);
    if (i < 0) return;
    let j = null;
    if (e.key === "ArrowRight") j = (i + 1) % TABS.length;
    else if (e.key === "ArrowLeft") j = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = TABS.length - 1;
    if (j === null) return;
    e.preventDefault();
    activateTab(TABS[j], { scroll: false });
    document.querySelector(`[role="tab"][data-tab="${TABS[j]}"]`).focus();
  });
  // Enlace profundo: #ediciones, #mapa... (por defecto, pokedex)
  const fromHash = location.hash.replace("#", "");
  activateTab(TABS.includes(fromHash) ? fromHash : "pokedex", { scroll: false });
  // El desplegable de la Pokédex enlaza a "#pokedex" también dentro de la misma página.
  window.addEventListener("hashchange", () => {
    const name = location.hash.replace("#", "");
    if (TABS.includes(name)) activateTab(name);
  });
}

function activateTab(name, opts = {}) {
  if (!TABS.includes(name)) return;
  for (const t of TABS) {
    const btn = document.querySelector(`[role="tab"][data-tab="${t}"]`);
    const panel = document.querySelector(`[data-panel="${t}"]`);
    if (!btn || !panel) continue;
    const on = t === name;
    btn.setAttribute("aria-selected", String(on));
    btn.tabIndex = on ? 0 : -1;
    panel.hidden = !on;
  }
  document.querySelectorAll('.site-nav a[data-tab]').forEach((a) =>
    a.classList.toggle("active", a.dataset.tab === name));
  $("#dexMenuBtn")?.classList.toggle("active", name === "pokedex");
  try { history.replaceState(null, "", `#${name}`); } catch { /* file:// u otros contextos */ }
  if (opts.scroll === false) return;
  const target = opts.scrollTarget ? document.querySelector(opts.scrollTarget)
    : document.getElementById("tabsBar");
  target?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------- Guía en vídeo: reproductor + lista ---------- */
function initGuide() {
  const eps = $("#playlistEps");
  const shorts = $("#playlistShorts");
  if (!eps || !shorts) return;
  $("#epCount").textContent = `(${EPISODES.length})`;
  $("#shortCount").textContent = `(${SHORTS.length})`;
  eps.innerHTML = EPISODES.map((v, i) => plItem(v, i + 1)).join("");
  shorts.innerHTML = SHORTS.map((v, i) => plItem(v, EPISODES.length + i + 1)).join("");
  document.querySelector(".playlist-wrap").addEventListener("click", (e) => {
    const b = e.target.closest("button.playlist-item");
    if (b) playVideo(b.dataset.id, b.dataset.title);
  });
  markActive(EPISODES[0].id);
}

function plItem(v, n) {
  return `<li><button class="playlist-item" data-id="${v.id}" data-title="${esc(v.title)}">
    <span class="pl-num">${n}</span><img src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg"
    alt="" loading="lazy" decoding="async" width="96" height="54" />
    <span class="pl-title">${esc(v.title)}</span></button></li>`;
}

function playVideo(id, title) {
  const all = [...EPISODES, ...SHORTS];
  const n = all.findIndex((v) => v.id === id) + 1;
  // Embed simple en dominio nocookie (sin muro de consentimiento de cookies).
  $("#ytPlayer").src = `https://www.youtube-nocookie.com/embed/${id}?rel=0&autoplay=1`;
  $("#nowPlaying").textContent = `${n} · ${title}`;
  const watch = $("#watchLink");
  const list = SHORTS.some((v) => v.id === id) ? SHORTS_PLAYLIST_ID : PLAYLIST_ID;
  if (watch) watch.href = `https://www.youtube.com/watch?v=${id}&list=${list}`;
  markActive(id);
}

function markActive(id) {
  document.querySelectorAll(".playlist-item").forEach((b) => {
    if (b.dataset.id === id) b.setAttribute("aria-current", "true");
    else b.removeAttribute("aria-current");
  });
}

/* ---------- Cuadrículas y recortes: detalle + captura ---------- */
function initGridEvents() {
  for (const grid of [gridFire, gridLeaf]) {
    grid.addEventListener("click", onGridClick);
  }
  for (const strip of [stripFire, stripLeaf]) {
    strip.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-action='detail']");
      if (btn) await openModal(Number(btn.dataset.id));
    });
  }
}

/* Sincroniza todas las balls con el mismo id (Pokédex + ediciones + modal)
   sin re-render completo, para que la animación de apertura se vea. */
function syncCaughtUI(id, on) {
  document.querySelectorAll(`button[data-caught="${id}"]`).forEach((b) => {
    b.classList.remove("catching");
    b.classList.toggle("is-caught", on);
    b.setAttribute("aria-pressed", String(on));
    b.title = on ? "¡Capturado! Toca para liberar" : "Marcar como capturado";
    if (on) {
      b.classList.add("just-caught");
      setTimeout(() => b.classList.remove("just-caught"), 500);
    }
    const cell = b.closest(".dex-cell");
    if (cell) cell.classList.toggle("is-caught", on);
    const card = b.closest(".poke-card");
    if (card) {
      card.classList.toggle("is-caught", on);
      let ribbon = card.querySelector(".caught-ribbon");
      if (on && !ribbon) {
        ribbon = document.createElement("span");
        ribbon.className = "caught-ribbon";
        ribbon.textContent = "✓ Capturado";
        ribbon.setAttribute("aria-hidden", "true");
        card.querySelector(".poke-media")?.appendChild(ribbon);
      } else if (!on && ribbon) {
        ribbon.remove();
      }
    }
  });
  document.querySelectorAll(`button[data-action="caught"][data-id="${id}"]`).forEach((b) => {
    b.classList.remove("catching");
    b.setAttribute("aria-pressed", String(on));
    b.innerHTML = `<span class="mini-ball" aria-hidden="true"></span>${on ? "¡Capturado! ✓" : "Marcar capturado"}`;
  });
  updateCaughtCounts();
}

function updateCaughtCounts() {
  const caught = getCaught();
  const dexCount = $("#dexCount");
  if (dexCount) {
    const total = (typeof DEX_ALL !== "undefined" ? DEX_ALL.length : 0);
    // Con filtro activo muestra "visibles de total · X capturados" (también 0 de N).
    const visible = typeof DEX_ALL !== "undefined" ? dexFiltered().length : total;
    dexCount.textContent = `${visible} de ${total} · ${caught.size} capturados`;
  }
  if (store.length) {
    const fire = store.filter((p) => p.edition === "fire");
    const leaf = store.filter((p) => p.edition === "leaf");
    const fGot = fire.filter((p) => caught.has(p.id)).length;
    const lGot = leaf.filter((p) => caught.has(p.id)).length;
    if (statusFire) statusFire.textContent = `${fire.length} de ${EXCL_FIRE.length} en ${editionName("fire")} · ${fGot} capturados`;
    if (statusLeaf) statusLeaf.textContent = `${leaf.length} de ${EXCL_LEAF.length} en ${editionName("leaf")} · ${lGot} capturados`;
  }
}

/* Un toque = meneo + apertura + destello, luego se guarda el estado. */
function handleCaughtClick(btn, id) {
  if (!btn || btn.classList.contains("catching")) return;
  btn.classList.add("catching");
  const willCatch = !getCaught().has(id);
  setTimeout(() => {
    const caught = toggleCaught(id);
    const on = caught.has(id);
    syncCaughtUI(id, on);
    toast(on ? `¡Atrapado! ${cap(nameOf(id))} registrado ✓` : `${cap(nameOf(id))} liberado`);
  }, willCatch ? 560 : 250);
}

async function onGridClick(e) {
  const ball = e.target.closest("button[data-caught]");
  if (ball) {
    e.stopPropagation();
    handleCaughtClick(ball, Number(ball.dataset.caught));
    return;
  }
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const id = Number(btn.dataset.id);
  if (btn.dataset.action === "caught") {
    handleCaughtClick(btn, id);
  } else if (btn.dataset.action === "detail") {
    await openModal(id);
  }
}

function nameOf(id) {
  const p = store.find((x) => x.id === id) || DEX_ALL.find((x) => x.id === id);
  return p ? displayName(p.slug || p.name) : String(id);
}

function paintSkeletons() {
  skeletonGrid(gridFire, 6);
  skeletonGrid(gridLeaf, 6);
  stripFire.textContent = "Cargando…";
  stripLeaf.textContent = "Cargando…";
  statusFire.textContent = "Cargando Pokémon desde PokéAPI…";
  statusLeaf.textContent = "Cargando Pokémon desde PokéAPI…";
}

/* Render directo: los exclusivos en sus dos cuadros, mismo formato ball que la Pokédex. */
function renderEditions() {
  if (!store.length) return;
  const caught = getCaught();
  const fire = store.filter((p) => p.edition === "fire").sort((a, b) => a.id - b.id);
  const leaf = store.filter((p) => p.edition === "leaf").sort((a, b) => a.id - b.id);

  gridFire.innerHTML = fire.map((p) => cardHTML(p, caught.has(p.id))).join("");
  gridLeaf.innerHTML = leaf.map((p) => cardHTML(p, caught.has(p.id))).join("");

  const allIds = new Set(store.map((p) => p.id));
  stripFire.innerHTML = stripHTML(fire, allIds);
  stripLeaf.innerHTML = stripHTML(leaf, allIds);

  updateCaughtCounts();
  renderDexList();
}

/* ---------- Pokédex: lista + ficha completa ---------- */
let selectedDexId = null;
const edMap = new Map(ALL_EXCLUSIVES.map((p) => [p.id, p.edition]));

/* Entrada unificada de la Pokédex: tipos estáticos, edición si es exclusivo. */
function dexEntry(id) {
  const base = store.find((x) => x.id === id);
  const d = (typeof DEX_ALL !== "undefined" && DEX_ALL.find((x) => x.id === id)) || null;
  const slug = (d && d.slug) || (base && (base.slug || base.name)) || String(id);
  return {
    id,
    slug,
    name: slug,
    region: d && d.region,
    form: (d && d.form) || (base && base.form) || null,
    art: (d && d.art) || (base && base.art) || null,
    types: (base && base.types) || (typeof TYPES_ALL !== "undefined" && TYPES_ALL[id]) || [],
    edition: edMap.get(id) || (base && base.edition) || null,
    moves: base && base.moves,
    stats: (base && base.stats) || null,
  };
}

function initPokedex() {
  $("#dexFilterForm").addEventListener("submit", (e) => e.preventDefault());
  $("#dexList").addEventListener("click", (e) => {
    const c = e.target.closest("button[data-caught]");
    if (c) {
      e.stopPropagation();
      handleCaughtClick(c, Number(c.dataset.caught));
      return;
    }
    const b = e.target.closest("button[data-dex]");
    if (b) selectDex(Number(b.dataset.dex));
  });
  let t;
  $("#dexQ").addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(renderDexList, 200);
  });
  $("#dexGen").addEventListener("change", renderDexList);
}

function dexFiltered() {
  const q = ($("#dexQ").value || "").trim().toLowerCase();
  const gen = $("#dexGen").value;
  return DEX_ALL.filter((d) => {
    if (gen !== "all" && !(d.regions || [d.region || GAME.regionOf(d.id)]).includes(gen)) return false;
    if (!q) return true;
    const num = String(d.id) === q.replace(/^0+/, "") || `#${String(d.id).padStart(3, "0")}`.includes(q);
    return num || d.slug.includes(q) || displayName(d.slug).toLowerCase().includes(q);
  }).map((d) => dexEntry(d.id));
}

function renderDexList() {
  const list = dexFiltered();
  const caught = getCaught();
  $("#dexList").innerHTML = list.length
    ? dexListHTML(list, selectedDexId, caught)
    : `<li class="dex-empty">Ningún Pokémon coincide con «${esc($("#dexQ").value.trim())}».</li>`;
  // Sin scroll interno: la lista fluye en la página, solo actualizamos el contador.
  updateCaughtCounts();
  if (list.length && !list.some((p) => p.id === selectedDexId)) {
    selectDex(list[0].id, { scroll: false });
  }
}

/* Sección de obtención: RankedBoost > encuentros PokeAPI > cadena/especie. */
async function dexLocSection(p, evo) {
  const loc = LOC[p.id];
  if (loc && (loc.w.length || loc.e)) {
    // En RFVH, Johto no viene de RankedBoost (ver data.js): se enlaza la Pokédex oficial.
    const src = GAME.id === "frlg" && p.id > 151
      ? { url: `https://www.pokemon.com/es/pokedex/${p.slug}`, label: `Pokédex oficial · ${displayName(p.slug)}` }
      : null;
    return locationsHTML(p, src);
  }
  const enc = await fetchDexEncounters(p.id).catch(() => []);
  if (enc.length) return dexWildHTML(enc, p.slug);
  const findParent = (node) => {
    for (const c of (node && node.children) || []) {
      if (c.node.id === p.id) return { name: c.node.name, edge: c.edge };
      const r = findParent(c.node);
      if (r) return r;
    }
    return null;
  };
  const parent = evo ? findParent(evo) : null;
  if (parent) {
    return dexObtainHTML(`Evolución de <strong>${displayName(parent.name)}</strong> (${parent.edge}).`, p.slug);
  }
  try {
    const flags = await fetchSpeciesFlags(p.id);
    if (flags.baby) return dexObtainHTML("Crianza (huevo).", p.slug);
    if (flags.legendary || flags.mythical) {
      return dexObtainHTML("Encuentro especial o evento (no aparece de forma normal en estado salvaje).", p.slug);
    }
  } catch { /* sigue al genérico */ }
  return dexObtainHTML(GAME.noWildText, p.slug);
}

async function selectDex(id, opts = {}) {
  selectedDexId = id;
  document.querySelectorAll("#dexList [data-dex]").forEach((b) => {
    const on = Number(b.dataset.dex) === id;
    b.classList.toggle("is-current", on);
    if (on) b.setAttribute("aria-current", "true");
    else b.removeAttribute("aria-current");
  });
  const detail = $("#dexDetail");
  const p = dexEntry(id);
  detail.innerHTML = dexLoadingHTML(displayName(p.slug));
  try {
    // Una sola llamada viva: da estadísticas (para la naturaleza) y movimientos del juego.
    const live = await fetchPokemon(p.form || id).catch(() => null);
    if (!p.stats && live) p.stats = live.stats;
    const learn = (live && live.moves) || p.moves ||
      (await fetchGameMoves(p.form || id).catch(() => null)) || { level: [], machine: [], tutor: [] };
    const slugs = [...learn.level.map((m) => m.slug), ...learn.machine, ...learn.tutor];
    const infos = await Promise.all(slugs.map((s) => fetchMoveDetail(s).catch(() => null)));
    const bySlug = new Map(infos.filter(Boolean).map((i) => [i.slug, i]));
    const moves = {
      level: learn.level.map((m) => ({ ...m, info: bySlug.get(m.slug) || null })),
      machine: learn.machine.map((s) => ({ slug: s, info: bySlug.get(s) || null })),
      tutor: learn.tutor.map((s) => ({ slug: s, info: bySlug.get(s) || null })),
    };
    const evo = await fetchEvoChain(id).catch(() => null);
    const loc = await dexLocSection(p, evo);
    // Si mientras cargaba se eligió otro Pokémon, esta respuesta ya no vale.
    if (selectedDexId !== id) return;
    detail.innerHTML = dexDetailHTML(p, evo, moves, loc);
  } catch {
    if (selectedDexId !== id) return;
    detail.innerHTML = dexErrorHTML();
  }
  if (opts.scroll !== false) detail.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/* ---------- Modal detalle ---------- */
function initModal() {
  modalClose.addEventListener("click", closeModal);
  modalBackdrop.addEventListener("click", (e) => {
    if (e.target === modalBackdrop) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (modalBackdrop.hidden) return;
    if (e.key === "Escape") closeModal();
    else if (e.key === "Tab") trapFocus(e);
  });
  modalBody.addEventListener("click", (e) => {
    const btn = e.target.closest('button[data-action="caught"]');
    if (!btn) return;
    if (btn.classList.contains("catching")) return;
    btn.classList.add("catching");
    const id = Number(btn.dataset.id);
    const willCatch = !getCaught().has(id);
    setTimeout(() => {
      const caught = toggleCaught(id);
      const on = caught.has(id);
      syncCaughtUI(id, on);
      // Refresca el botón del modal (sync ya lo actualiza) + toast
      toast(on ? `¡Atrapado! ${cap(nameOf(id))} registrado ✓` : `${cap(nameOf(id))} liberado`);
    }, willCatch ? 560 : 250);
  });
}

let modalRequest = 0;
async function openModal(id) {
  const req = ++modalRequest;
  lastFocus = document.activeElement;
  modalBackdrop.hidden = false;
  document.body.style.overflow = "hidden";
  modalBody.innerHTML = "<p>Cargando detalle…</p>";
  modalClose.focus();
  try {
    let p = store.find((x) => x.id === id);
    if (!p?.stats) {
      const live = await fetchPokemon((p && p.form) || id);
      p = { ...p, ...live, id };
    }
    if (req !== modalRequest || modalBackdrop.hidden) return;
    modalBody.innerHTML = modalHTML(p, p.edition);
  } catch {
    if (req !== modalRequest || modalBackdrop.hidden) return;
    modalBody.innerHTML = `<h2 id="modalName">Error</h2><p>No se pudo cargar el detalle del nº ${id}. Revisa tu conexión e inténtalo de nuevo.</p>`;
  }
}

/* Tab y Mayús+Tab dan la vuelta dentro del modal en vez de salir a la página. */
function trapFocus(e) {
  const items = [...$("#modal").querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')];
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

function closeModal() {
  modalBackdrop.hidden = true;
  document.body.style.overflow = "";
  if (lastFocus) lastFocus.focus();
}
