"""Genera src/js/data-sv.js: Pokédex de Escarlata/Púrpura (Paldea + Noroteo + Arándano)
con tipos y nombres en español de PokéAPI y ubicaciones de RankedBoost SV.
Uso: python tools/build_sv_data.py [CARPETA_CACHE]
Las descargas se guardan en la caché (por defecto, una carpeta temporal) para no repetirlas.
"""
import html
import json
import re
import sys
import tempfile
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

PROJ = Path(__file__).resolve().parent.parent
CACHE = Path(sys.argv[1] if len(sys.argv) > 1 else Path(tempfile.gettempdir()) / "sv-cache")
OUT = PROJ / "src" / "js" / "data-sv.js"
API = "https://pokeapi.co/api/v2/"
RB = "https://rankedboost.com/pokemon-scarlet-violet/{}/"
UA = {"User-Agent": "Mozilla/5.0 (guia-ediciones-pokemon; proyecto personal)"}

# Pokédex regionales del juego, en orden: región -> nombre en PokéAPI
DEXES = [("paldea", "paldea"), ("kitakami", "kitakami"), ("blueberry", "blueberry")]

# Exclusivos verificados con Serebii (scarletviolet/exclusives.shtml), juego base + DLC.
# Tauros de Paldea (raza Llameante / Acuática) se explica aparte: comparte el nº 128.
SCARLET = ["larvitar", "pupitar", "tyranitar", "gligar", "gliscor", "cranidos", "rampardos",
           "drifloon", "drifblim", "stunky", "skuntank", "deino", "zweilous", "hydreigon",
           "skrelp", "dragalge", "oranguru", "cramorant", "stonjourner", "armarouge",
           "great-tusk", "scream-tail", "brute-bonnet", "flutter-mane", "slither-wing",
           "sandy-shocks", "roaring-moon", "koraidon", "walking-wake", "gouging-fire",
           "raging-bolt", "vulpix", "ninetales"]
VIOLET = ["sandshrew", "sandslash", "aipom", "ambipom", "misdreavus", "mismagius", "gulpin",
          "swalot", "bagon", "shelgon", "salamence", "shieldon", "bastiodon", "clauncher",
          "clawitzer", "passimian", "morpeko", "dreepy", "drakloak", "dragapult", "eiscue",
          "ceruledge", "iron-treads", "iron-bundle", "iron-hands", "iron-jugulis", "iron-moth",
          "iron-thorns", "iron-valiant", "miraidon", "iron-leaves", "iron-boulder", "iron-crown"]

# Cómo se consiguen los que no salen en estado salvaje y no son evolución ni legendarios.
STARTER = "Pokémon inicial: se elige al comienzo de la aventura, en Pueblo Cahíz"
SPECIAL = {906: STARTER, 909: STARTER, 912: STARTER}

# Formas regionales que son las que se encuentran en el juego (no la original).
FORMS = {
    "wooper": "wooper-paldea", "tauros": "tauros-paldea-combat-breed",
    "vulpix": "vulpix-alola", "ninetales": "ninetales-alola",
    "sandshrew": "sandshrew-alola", "sandslash": "sandslash-alola",
}

# Zonas de RankedBoost (inglés) -> nombre oficial en español (WikiDex).
AREA_ES = {
    "Poco Path": "Sendero de Cahíz", "Cabo Poco": "Pueblo Cahíz", "Inlet Grotto": "Gruta Caleta",
    "Los Platos": "Pueblo Ataifor", "Mesagoza": "Ciudad Meseta", "Cortondo": "Pueblo Pirotín",
    "Artazon": "Pueblo Altamía", "Alfornada": "Pueblo Alforno", "Alfornada Cavern": "Sima de Alforno",
    "The Pokemon League": "Liga Pokémon", "Pokemon League": "Liga Pokémon",
    "South Paldean Sea": "Mar Meridional de Paldea", "East Paldean Sea": "Mar Oriental de Paldea",
    "West Paldean Sea": "Mar Occidental de Paldea", "North Paldean Sea": "Mar Septentrional de Paldea",
    "Levincia": "Ciudad Leudal", "Zapapico": "Pueblo Veta", "Tagtree Thicket": "Bosquejada",
    "Porto Marinada": "Pueblo Marinada", "Medali": "Pueblo Mestura", "Asado Desert": "Desierto Rostiz",
    "Cascarrafa": "Ciudad Cántara", "Colonnade Hollow": "Cueva Columnata",
    "Dalizapa Passage": "Gruta Vestura", "Glaseado Mountain": "Sierra Napada",
    "Montenevera": "Pueblo Hozkailu", "Casseroya Lake": "Lago Cazola", "Socarrat Trail": "Alameda Socarrada",
    "The Great Crater of Paldea": "Foso de Paldea", "Great Crater of Paldea": "Foso de Paldea",
    "Area Zero": "Área Cero", "Zero Lab": "Laboratorio Cero", "Area Zero Underdepths": "Caverna Abisal Cero",
    "Grasswither Shrine": "Santuario Mustiarbor", "Icerend Shrine": "Santuario Glaceratio",
    "Firescourge Shrine": "Santuario Devastigneus", "Groundblight Shrine": "Santuario Detriterra",
    # Noroteo
    "Mossui Town": "Villa Versui", "Kitakami Road": "Carretera de Noroteo", "Apple Hills": "Colina Manzanar",
    "Wistful Fields": "Pradera Glicina", "Paradise Barrens": "Elíseo Baldío",
    "Kitakami Wilds": "Campos Prístinos de Noroteo", "Timeless Woods": "Soto Sempiterno",
    "Fellhorn Gorge": "Desfiladero del Cuerno", "Mossfell Confluence": "Ribera Confluencia",
    "Reveler's Road": "Senda Jarana", "Revelers Road": "Senda Jarana", "Oni Mountain": "Monte Ogro",
    "Oni's Maw": "Fauces del Ogro", "Onis Maw": "Fauces del Ogro", "Dreaded Den": "Gruta del Pavor",
    "Infernal Pass": "Paso del Averno", "Chilling Waterhead": "Cueva Aguafría", "Crystal Pool": "Lago Cristalino",
    "Loyalty Plaza": "Parque de los compatrones", "Kitakami Hall": "Centro cultural de Noroteo",
    # Biodomo (Academia Arándano)
    "Savanna Biome": "Área Árida", "Coastal Biome": "Área Costera", "Canyon Biome": "Área Escarpada",
    "Polar Biome": "Área Polar", "Central Plaza": "Plaza Cúbica", "Savanna Plaza": "Plaza Árida",
    "Coastal Plaza": "Plaza Costera", "Canyon Plaza": "Plaza Escarpada", "Polar Plaza": "Plaza Polar",
    "Chargestone Cavern": "Gruta Electrorroca", "Chargestone Cave": "Gruta Electrorroca",
    "Torchlit Labyrinth": "Laberinto Lumbre",
}
PROVINCE_ES = {"South": "sur", "East": "este", "West": "oeste", "North": "norte"}
NUM = {"One": 1, "Two": 2, "Three": 3, "Four": 4, "Five": 5, "Six": 6}
BIOME_ES = {
    "Grass": "Pradera", "Forest": "Bosque", "Cave": "Cueva", "Mountain": "Montaña", "Desert": "Desierto",
    "Water": "Agua", "Lake": "Lago", "River": "Río", "Ocean": "Mar", "Beach": "Playa", "Swamp": "Pantano",
    "Snow": "Nieve", "Flower": "Flores", "Bamboo": "Bambú", "Ruins": "Ruinas", "Mine": "Mina",
    "Town": "Pueblo", "Rocky": "Rocoso", "Underground": "Subterráneo", "Olive": "Olivar",
    "Sky": "Cielo", "Volcano": "Volcán", "Savanna": "Sabana", "Canyon": "Cañón", "Coastal": "Costa",
    "Polar": "Polar",
}
RARITY_ES = {"Very Common": "Muy común", "Common": "Común", "Uncommon": "Poco común",
             "Rare": "Raro", "Very Rare": "Muy raro"}


def get(url, path, as_json=False):
    """Descarga con caché en disco. Devuelve None si la página no existe."""
    f = CACHE / path
    if f.exists():
        text = f.read_text(encoding="utf-8")
        return None if text == "404" else (json.loads(text) if as_json else text)
    f.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                text = r.read().decode("utf-8", "replace")
            break
        except urllib.error.HTTPError as e:
            if e.code == 404:
                f.write_text("404", encoding="utf-8")
                return None
            time.sleep(2 + attempt * 3)
        except (urllib.error.URLError, TimeoutError):
            time.sleep(2 + attempt * 3)
    else:
        raise RuntimeError(f"No se pudo descargar {url}")
    f.write_text(text, encoding="utf-8")
    return json.loads(text) if as_json else text


def species_list():
    """[(id nacional, slug, [regiones])] sin repetidos, en orden de las Pokédex regionales."""
    seen = {}
    for region, name in DEXES:
        dex = get(f"{API}pokedex/{name}/", f"api/pokedex-{name}.json", True)
        for e in sorted(dex["pokemon_entries"], key=lambda x: x["entry_number"]):
            sid = int(e["pokemon_species"]["url"].rstrip("/").split("/")[-1])
            if sid not in seen:
                seen[sid] = (sid, e["pokemon_species"]["name"], [])
            seen[sid][2].append(region)
    return list(seen.values())


def species_info(entry):
    sid, slug, regions = entry
    sp = get(f"{API}pokemon-species/{sid}/", f"api/species-{sid}.json", True)
    es = next((n["name"] for n in sp["names"] if n["language"]["name"] == "es"), None)
    variety = FORMS.get(slug) or next(v["pokemon"]["name"] for v in sp["varieties"] if v["is_default"])
    pk = get(f"{API}pokemon/{variety}/", f"api/pokemon-{variety}.json", True)
    types = [t["type"]["name"] for t in sorted(pk["types"], key=lambda t: t["slot"])]
    return {"id": sid, "slug": slug, "regions": regions, "es": es, "types": types,
            "form": variety if variety in FORMS.values() else None, "art": pk["id"]}


def rb_page(slug):
    for cand in dict.fromkeys([slug, slug.replace("-", ""), slug.split("-")[0]]):
        page = get(RB.format(cand), f"rb/{cand}.html")
        if page and "rbss-location-data-for-pokemon" in page:
            return page
    return None


def clean(s):
    s = re.sub(r"<style.*?</style>|<script.*?</script>", " ", s, flags=re.S)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()


def area_es(name):
    name = name.replace("Pokémon", "Pokemon").strip()
    # RankedBoost a veces se deja el paréntesis de cierre ("South Province (Area Three").
    m = re.match(r"(South|East|West|North) Province \(Area (\w+)\)?$", name)
    if m:
        return f"Área {NUM.get(m.group(2), m.group(2))} del {PROVINCE_ES[m.group(1)]}"
    if name == "Unknown":
        return ""
    name = re.sub(r" \d+$", "", name)  # "Glaseado Mountain 1" -> una sola Sierra Napada
    return AREA_ES.get(name, name)


def parse_locations(page, english):
    """Filas de la tabla de RankedBoost en las que aparece el propio Pokémon."""
    i = page.find("rbss-location-data-for-pokemon")
    table = page[i:page.find("</table>", i)]
    out = []
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", table, flags=re.S)[1:]:
        cells = re.findall(r"<td[^>]*>(.*?)</td>", row, flags=re.S)
        if len(cells) < 3:
            continue
        spawn = clean(cells[2])
        m = re.match(r"(.+?) Lv\. (\d+)(?: - (\d+))?", spawn)
        if not m or m.group(1).lower().replace(" ", "-").replace(".", "") != english:
            continue
        lv = m.group(2) if not m.group(3) or m.group(3) == m.group(2) else f"{m.group(2)}–{m.group(3)}"
        how = clean(cells[1])
        if clean(cells[0]).startswith("Tera Raid"):
            stars = re.match(r"(\d+)", how)
            out.append(["Teraincursión", f"{stars.group(1)}★" if stars else "", f"Nv {lv}", ""])
            continue
        areas = [area_es(clean(a)) for a in re.findall(r"<a[^>]*>(.*?)</a>", cells[0], flags=re.S)]
        areas = [a for a in dict.fromkeys(areas) if a and a != "?"]
        if not areas:
            continue
        rate = re.search(r"(\d+)%", how)
        biomes = [BIOME_ES.get(b, b) for b in re.findall(r"([A-Z][a-z]+) \(\d+%\) Biome", how)]
        place = ", ".join(areas[:4]) + (f" y {len(areas) - 4} más" if len(areas) > 4 else "")
        out.append([place, " / ".join(dict.fromkeys(biomes)) or "Salvaje", f"Nv {lv}",
                    f"{rate.group(1)}%" if rate else ""])
    # Primero los encuentros salvajes (por %), luego las teraincursiones.
    wild = sorted([r for r in out if r[0] != "Teraincursión"], key=lambda r: -int(r[3][:-1] or 0))
    raids = [r for r in out if r[0] == "Teraincursión"]
    return (wild[:4] + raids[:1])


def location(info):
    page = rb_page(info["slug"])
    return parse_locations(page, info["slug"]) if page else []


def js(v):
    return json.dumps(v, ensure_ascii=False)


def main():
    entries = species_list()
    with ThreadPoolExecutor(6) as pool:
        infos = list(pool.map(species_info, entries))
    with ThreadPoolExecutor(4) as pool:
        locs = list(pool.map(location, infos))
    ids = {i["slug"]: i["id"] for i in infos}
    by_id = {i["id"]: i for i in infos}

    def excl(slugs):
        rows = []
        for s in sorted(slugs, key=lambda s: ids[s]):
            i = by_id[ids[s]]
            form = f', form: {js(i["form"])}, art: {i["art"]}' if i["form"] else ""
            rows.append(f'  {{ id: {i["id"]}, slug: {js(s)}, types: {js(i["types"])}{form} }},')
        return "\n".join(rows)

    lines = [
        "/* Datos de Escarlata y Púrpura, generados con tools/build_sv_data.py.",
        "   Pokédex de Paldea + Noroteo + Arándano (PokéAPI), exclusivos según Serebii",
        "   y ubicaciones de RankedBoost SV. No editar a mano: vuelve a ejecutar el script. */",
        "",
        "const EXCL_FIRE = [ // exclusivos de Escarlata",
        excl(SCARLET),
        "];",
        "",
        "const EXCL_LEAF = [ // exclusivos de Púrpura",
        excl(VIOLET),
        "];",
        "",
        "/* w: [zona, método o bioma, niveles, % aparición] · e: [null, cómo se consigue] para los",
        "   casos especiales; las evoluciones salen de PokéAPI. */",
        "const LOC = {",
    ]
    for i, w in zip(infos, locs):
        special = SPECIAL.get(i["id"])
        if w or special:
            lines.append(f'  {i["id"]}: {{ w: {js(w)}, e: {js([None, special]) if special else "null"} }},')
    lines += ["};", "", "/* Pokédex completa del juego. region: la primera Pokédex regional en la que sale (paldea,",
        "   kitakami o blueberry); regions: todas en las que aparece, para el filtro. */", "const DEX_ALL = ["]
    for i in infos:
        form = f', form: {js(i["form"])}, art: {i["art"]}' if i["form"] else ""
        lines.append(f'  {{ id: {i["id"]}, slug: {js(i["slug"])}, region: {js(i["regions"][0])}, regions: {js(i["regions"])}{form} }},')
    lines += ["];", "", "const TYPES_ALL = {"]
    lines += [f'  {i["id"]}: {js(i["types"])},' for i in infos]
    lines += ["};", "", "/* Nombre oficial en español cuando no coincide con el slug. */", "const NAME_FIX = {"]
    for i in infos:
        default = i["slug"][:1].upper() + i["slug"][1:]
        if i["es"] and i["es"] != default:
            lines.append(f'  {js(i["slug"])}: {js(i["es"])},')
    lines += ["};", ""]
    OUT.write_text("\n".join(lines), encoding="utf-8")
    found = sum(1 for w in locs if w)
    print(f"{len(infos)} Pokémon · {found} con ubicaciones · {OUT}")


if __name__ == "__main__":
    main()
