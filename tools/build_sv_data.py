"""Genera src/js/data-sv.js: Pokédex de Escarlata/Púrpura (Paldea + Noroteo + Arándano)
con tipos y nombres en español de PokéAPI, ubicaciones por edición y DLC de Serebii
y niveles y % de aparición en Paldea de RankedBoost SV.
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
SEREBII = "https://www.serebii.net/pokedex-sv/{}/"
# Serebii quita los guiones del nombre, salvo en estos casos.
SEREBII_SLUG = {}
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
    "Naranja Academy": "Academia Naranja", "Uva Academy": "Academia Uva",
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
BIOME_ES.update({
    "Prairie": "Pradera", "Rocky Area": "Zona rocosa", "Snowfield": "Nieve", "CaveWater": "Cueva con agua",
    "Seafloor": "Fondo marino", "Volcanic": "Volcán", "Plains": "Llanura", "Chargestone": "Electrorroca",
    "ForestTown": "Bosque, Pueblo", "Mud": "Barro", "Riverside": "Ribera", "Rock": "Roca", "Sand": "Arena",
    "Wasteland": "Páramo", "Coast": "Costa",
})
# Partes del juego en Serebii y regiones de sus listas de biomas.
PART_KEY = {"base": "paldea", "The Teal Mask": "kitakami", "The Indigo Disk": "blueberry"}
BIOME_REGION = {"Paldea": "paldea", "Kitakami": "kitakami", "Terarium": "blueberry"}
VERSION_ES = {"Scarlet": "Escarlata", "Violet": "Púrpura"}
# Formas y variantes que Serebii pone delante de una lista de zonas.
FORM_ES = {
    "Combat Breed": "Raza Combatiente", "Blaze Breed": "Raza Llameante", "Aqua Breed": "Raza Acuática",
    "Paldean Form": "Forma de Paldea", "Johtonian Form": "Forma de Johto", "Kantonian Form": "Forma de Kanto",
    "Alolan Form": "Forma de Alola", "Galarian Form": "Forma de Galar", "Hisuian Form": "Forma de Hisui",
    "Bloodmoon": "Luna Carmesí",
    "Spring Form": "Estación Primavera", "Summer Form": "Estación Verano", "Autumn Form": "Estación Otoño",
    "Winter Form": "Estación Invierno", "Midday Form": "Forma Diurna", "Midnight Form": "Forma Nocturna",
    "Dusk Form": "Forma Crepuscular", "Baile Style": "Estilo Apasionado", "Pom-Pom Style": "Estilo Animado",
    "Pa'u Style": "Estilo Plácido", "Sensu Style": "Estilo Refinado", "West Sea": "Mar Oeste",
    "East Sea": "Mar Este", "White Flower Only": "Solo flor blanca",
}
# Aclaraciones que Serebii pone entre paréntesis detrás de una zona.
PAREN_ES = {
    "May disguise as other Pokémon": "puede hacerse pasar por otro Pokémon",
    "Drop down in cave from Crystal Pool": "bajando a la cueva desde el Lago Cristalino",
    "Egg Gift": "huevo de regalo",
    "White-Striped Form": "Forma Raya Blanca",
    "in cave in rocks to left of Research Station 3":
        "en una cueva entre las rocas, a la izquierda de la Estación de Investigación 3",
    "in rocky area to left of Research Station 2":
        "en la zona rocosa a la izquierda de la Estación de Investigación 2",
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
                # Serebii sirve ISO-8859-1; PokéAPI y RankedBoost, UTF-8.
                text = r.read().decode(r.headers.get_content_charset() or "utf-8", "replace")
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
    en = next((n["name"] for n in sp["names"] if n["language"]["name"] == "en"), slug)
    variety = FORMS.get(slug) or next(v["pokemon"]["name"] for v in sp["varieties"] if v["is_default"])
    pk = get(f"{API}pokemon/{variety}/", f"api/pokemon-{variety}.json", True)
    types = [t["type"]["name"] for t in sorted(pk["types"], key=lambda t: t["slot"])]
    return {"id": sid, "slug": slug, "regions": regions, "es": es, "en": en, "types": types,
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
    # Serebii lo escribe sin paréntesis: "East Province Area One".
    m = re.match(r"(South|East|West|North) Province \(?Area (\w+)\)?$", name)
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
        out.append([", ".join(areas), " / ".join(dict.fromkeys(biomes)) or "Salvaje", f"Nv {lv}",
                    f"{rate.group(1)}%" if rate else ""])
    # Solo los encuentros salvajes (por %): las teraincursiones salen de Serebii, por edición y DLC.
    wild = sorted([r for r in out if r[0] != "Teraincursión"], key=lambda r: -int(r[3][:-1] or 0))
    return wild[:4]


def location(info):
    page = rb_page(info["slug"])
    return parse_locations(page, info["slug"]) if page else []


UNKNOWN = set()  # textos de Serebii sin traducir, para revisarlos al final


def serebii_rows(page):
    """Filas de la tabla Locations: (parte del juego, "scarlet"|"violet", texto) o
    (parte, "biomes", región, lista de biomas)."""
    i = page.find("<h2>Locations</h2>")
    block = page[i:page.find("</table>", i)]
    part = "base"
    for tr in re.findall(r"<tr>(.*?)</tr>", block, flags=re.S):
        cells = re.findall(r'<td class="([^"]+)"[^>]*>(.*?)</td>', tr, flags=re.S)
        if not cells or cells[0][0] == "fooevo":
            continue
        if cells[0][0] not in ("scarlet", "violet", "fooblack"):
            part = clean(cells[0][1])  # "The Teal Mask", "The Indigo Disk"
            cells = cells[1:]
        if cells[0][0] == "fooblack" and len(cells) > 1:
            yield part, "biomes", clean(cells[0][1]).split(" Wild")[0], clean(cells[1][1])
        elif cells[0][0] in ("scarlet", "violet") and len(cells) > 1:
            text = re.sub(r"<br\s*/?>", " ¦ ", cells[1][1])
            yield part, cells[0][0], clean(text)


def place_es(name):
    """Zona de Serebii -> español; None si no es una zona conocida."""
    name = name.strip()
    m = re.match(r"(.+?) \((.+)\)$", name)  # "Timeless Woods (Bloodmoon)"
    if m and place_es(m.group(1)):
        extra = FORM_ES.get(m.group(2)) or PAREN_ES.get(m.group(2))
        if not extra:
            UNKNOWN.add("paréntesis: " + m.group(2))
        return f"{place_es(m.group(1))} ({extra or m.group(2)})"
    es = area_es(name)
    if es != name.replace("Pokémon", "Pokemon") or name in AREA_ES.values():
        return es
    return None


def places_es(text):
    items = [x for x in re.split(r"\s*,\s*", text) if x]
    out = [place_es(x) for x in items]
    return out if items and all(out) else None


def note_es(text, en_to_es):
    # "(Alolan Form)" al final: se traduce aparte y se vuelve a añadir.
    m = re.fullmatch(r"(.+?) \(([A-Za-z' -]+)\)", text)
    if m and m.group(2) in FORM_ES:
        return f"{note_es(m.group(1), en_to_es)} ({FORM_ES[m.group(2)]})"
    rules = [
        (r"Transfer from Pok.mon HOME.*", lambda m: "Solo por Pokémon HOME o intercambio"),
        (r"Trade from (Scarlet|Violet)", lambda m: f"Intercambio desde {VERSION_ES[m.group(1)]}"),
        # "Evovle" es una errata de Serebii en alguna ficha.
        (r"Ev(?:olve|ovle) (.+)", lambda m: "Evoluciona de " + " o ".join(en_to_es.get(x.strip(), x.strip())
                                                                         for x in re.split(r",| or ", m.group(1)))),
        (r"Starter Pok.mon in (.+)", lambda m: f"Pokémon inicial: se elige en {place_es(m.group(1)) or m.group(1)}"),
        (r"All over Paldea", lambda m: "Por toda Paldea"),
        (r"Trade in (.+)", lambda m: f"Intercambio con un personaje en {place_es(m.group(1)) or m.group(1)}"),
        (r"Breed (.+)", lambda m: f"Crianza de {en_to_es.get(m.group(1).split(' ')[-1], m.group(1))}"),
        (r"Gift from (.+?) in (.+)", lambda m: f"Regalo de {m.group(1)} en {place_es(m.group(2)) or m.group(2)}"),
        (r"League Club Trade with (.+)", lambda m: f"Intercambio en el Club de la Liga con {m.group(1)}"),
    ]
    for pat, fn in rules:
        m = re.fullmatch(pat, text)
        if m:
            return fn(m)
    UNKNOWN.add(text)
    return text


def entry_es(text, en_to_es):
    """Texto de una edición -> {a: [[etiqueta, zonas]], f: fijos, t: dominante, r: teraincursiones, n: notas}."""
    e = {"a": [], "f": [], "t": [], "r": "", "n": []}
    # Varias formas en un mismo bloque: "Midnight Form: zonas, Dusk Form: zonas".
    segs = [x.strip() for s in text.split("¦") for x in re.split(r",\s*(?=[A-Z][\w'-]* (?:Form|Style|Breed)\s*:)", s)]
    pending = ""  # una forma sola en su línea ("Kantonian Form") vale para la línea siguiente
    for seg in segs:
        if not seg:
            continue
        if seg in FORM_ES:
            pending = FORM_ES[seg]
            continue
        m = re.match(r"([A-Za-z' -]+?)\s*:\s*(.+)$", seg)
        label, rest = (m.group(1), m.group(2)) if m else ("", seg)
        if not label and pending:
            if places_es(seg):
                e["a"].append([pending, places_es(seg)])
            else:
                e["n"].append(f"{pending}: {note_es(seg, en_to_es)}")
            pending = ""
            continue
        if label == "Tera Raid Battles":
            e["r"] = ", ".join(f"{n}★" for n in re.findall(r"(\d) Star", rest))
        elif label in ("Fixed", "Titan") and places_es(rest):
            e["f" if label == "Fixed" else "t"] += places_es(rest)
        elif label and places_es(rest):
            if label not in FORM_ES:
                UNKNOWN.add(label)
            e["a"].append([FORM_ES.get(label, label), places_es(rest)])
        elif label in FORM_ES:
            e["n"].append(f"{FORM_ES[label]}: {note_es(rest, en_to_es)}")
        elif places_es(seg):
            e["a"].append(["", places_es(seg)])
        else:
            e["n"].append(note_es(seg, en_to_es))
    return {k: v for k, v in e.items() if v}


def biomes_es(text):
    out = []
    for b in re.split(r"\s*,\s*", text):
        b = b.replace(" Can be found in trees", "")
        if not b:
            continue
        if b not in BIOME_ES:
            UNKNOWN.add("bioma: " + b)
        out.append(BIOME_ES.get(b, b))
    return ", ".join(dict.fromkeys(out))


def serebii_locations(page, en_to_es):
    """Ubicaciones por parte del juego (Paldea, Noroteo, Arándano) y por edición."""
    parts = {}
    for row in serebii_rows(page):
        if row[1] == "biomes":
            key = BIOME_REGION.get(row[2])
            if key:
                parts.setdefault(key, {})["b"] = biomes_es(row[3])
            continue
        key = PART_KEY.get(row[0])
        if not key:
            UNKNOWN.add("parte: " + row[0])
            continue
        parts.setdefault(key, {})["s" if row[1] == "scarlet" else "v"] = entry_es(row[2], en_to_es)
    home = {"n": ["Solo por Pokémon HOME o intercambio"]}
    out = []
    for key in ("paldea", "kitakami", "blueberry"):
        p = parts.get(key)
        if not p or ("s" not in p and "v" not in p):
            continue
        s, v = p.get("s", {}), p.get("v", {})
        # En Paldea, "solo por HOME" no aporta nada si sale en algún DLC.
        if key == "paldea" and s == home and v == home and len(parts) > 1:
            continue
        item = {"p": key, "s": s}
        if v != s:
            item["v"] = v
        if p.get("b"):
            item["b"] = p["b"]
        out.append(item)
    return out


def serebii_page(info):
    """Ficha de Serebii del Pokémon, comprobando por el nº que es la correcta."""
    slug = info["slug"]
    cands = [SEREBII_SLUG.get(slug), slug.replace("-", ""), slug]
    for cand in dict.fromkeys(c for c in cands if c):
        page = get(SEREBII.format(cand), f"serebii/{cand}.html")
        if page and re.search(rf" - #0*{info['id']} - ", page) and "<h2>Locations</h2>" in page:
            return page
    return None


def js(v):
    return json.dumps(v, ensure_ascii=False)


def main():
    entries = species_list()
    with ThreadPoolExecutor(6) as pool:
        infos = list(pool.map(species_info, entries))
    with ThreadPoolExecutor(4) as pool:
        locs = list(pool.map(location, infos))
        pages = list(pool.map(serebii_page, infos))
    en_to_es = {i["en"]: i["es"] or i["en"] for i in infos}
    parts = [serebii_locations(p, en_to_es) if p else [] for p in pages]
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
        "   Pokédex de Paldea + Noroteo + Arándano (PokéAPI), exclusivos y ubicaciones por edición",
        "   y DLC según Serebii, y niveles y % de aparición en Paldea según RankedBoost.",
        "   No editar a mano: vuelve a ejecutar el script. */",
        "",
        "const EXCL_FIRE = [ // exclusivos de Escarlata",
        excl(SCARLET),
        "];",
        "",
        "const EXCL_LEAF = [ // exclusivos de Púrpura",
        excl(VIOLET),
        "];",
        "",
        "/* w: encuentros salvajes en Paldea de RankedBoost: [zonas, bioma, niveles, % aparición].",
        "   parts: dónde sale en cada parte del juego según Serebii, en orden Paldea, Noroteo, Arándano:",
        "     p: paldea | kitakami | blueberry · s: Escarlata · v: Púrpura (solo si es distinto) · b: biomas.",
        "     Cada edición: a: [[forma o raza, zonas]] · f: encuentros fijos · t: Pokémon dominante ·",
        "     r: teraincursiones · n: otras formas de conseguirlo. */",
        "const LOC = {",
    ]
    for i, w, pt in zip(infos, locs, parts):
        if w or pt:
            lines.append(f'  {i["id"]}: {{ w: {js(w)}, e: null, parts: {js(pt)} }},')
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
    print(f"{len(infos)} Pokémon · {sum(1 for p in parts if p)} con datos de Serebii · "
          f"{sum(1 for w in locs if w)} con niveles de RankedBoost · {OUT}")
    print("Sin ficha de Serebii:", [i["slug"] for i, p in zip(infos, pages) if not p])
    if UNKNOWN:
        print("Sin traducir:", sorted(UNKNOWN))


if __name__ == "__main__":
    main()
