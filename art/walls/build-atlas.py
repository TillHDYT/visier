"""Baut die Mauer-Texturen des Königreichs aus den gemalten Vorlagen in src/.

Je Stil (poison, ice, fire, mordor) entstehen
  src/assets/rampart-<stil>-atlas.webp   Flächen der 3D-Mauer (RGBA 1024²)
  src/assets/rampart-<stil>-glow.webp    Leuchtkarte (Risse, Fenster, Lava)
  src/assets/rampart-<stil>.webp         Vorschaubild für das Mauer-Fenster
  art/walls/wall-<stil>.webp             freigestelltes Mauer-Bild in voller Größe
und src/game/castle/wall-layout.ts mit der Lage der Flächen im Atlas.

Gift und Mordor: Flächen werden aus dem isometrischen Bild entzerrt.
Eis und Feuer: Flächen werden aus den mitgelieferten Textur-Kacheln gebaut.

Aufruf (im Projektordner): python3 art/walls/build-atlas.py
"""
import json
import os

import numpy as np
from PIL import Image, ImageOps
from scipy import ndimage as ndi

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "art", "walls", "src")
ASSETS = os.path.join(ROOT, "src", "assets")
SIZE = 1024
PAD = 6


# ---------------------------------------------------------------------------
# Hilfen


def skew(img, x0, x1, y0, slope, h):
    """Isometrische Fläche entzerren: Spalten senkrecht, Zeilen entlang der Wand."""
    return img.transform((x1 - x0, h), Image.AFFINE, (1, 0, x0, slope, 1, y0), resample=Image.BICUBIC)


def rgba(img):
    return img.convert("RGBA")


def fit_h(img, h):
    return img.resize((max(1, round(img.width * h / img.height)), h), Image.LANCZOS)


def fit_w(img, w):
    return img.resize((w, max(1, round(img.height * w / img.width))), Image.LANCZOS)


def tile(img, box, inset=3):
    x0, y0, x1, y1 = box
    return img.crop((x0 + inset, y0 + inset, x1 - inset, y1 - inset)).convert("RGBA")


def row(tiles):
    w = sum(t.width for t in tiles)
    out = Image.new("RGBA", (w, tiles[0].height))
    x = 0
    for t in tiles:
        out.alpha_composite(t, (x, 0))
        x += t.width
    return out


def lighten(base, over, y, strength=1.0):
    """Helle Teile von `over` (Eiszapfen, Kristalle, Lava) auf `base` legen."""
    b = np.asarray(base).astype(np.float32)
    o = np.asarray(over.convert("RGBA")).astype(np.float32)
    h = min(o.shape[0], b.shape[0] - y)
    w = min(o.shape[1], b.shape[1])
    seg = b[y : y + h, :w, :3]
    top = o[:h, :w, :3]
    mixed = np.maximum(seg, top)
    k = strength * (o[:h, :w, 3:4] / 255)
    b[y : y + h, :w, :3] = seg * (1 - k) + mixed * k
    return Image.fromarray(b.astype(np.uint8), "RGBA")


def repeat_x(img, w, mirror=True):
    parts = []
    x = 0
    i = 0
    while x < w:
        parts.append(ImageOps.mirror(img) if mirror and i % 2 else img)
        x += img.width
        i += 1
    return row(parts).crop((0, 0, w, img.height))


def repeat_y(img, h):
    out = Image.new("RGBA", (img.width, h))
    y = 0
    i = 0
    while y < h:
        out.alpha_composite(ImageOps.flip(img) if i % 2 else img, (0, y))
        y += img.height
        i += 1
    return out


def white_to_alpha(img, soft=None):
    """Weißen Grund weich ausblenden (Color-to-Alpha gegen Weiß)."""
    a = np.asarray(img.convert("RGB")).astype(np.float32) / 255
    al = np.clip((np.max(1 - a, axis=2) - 0.04) / 0.96, 0, 1)
    if soft is not None:
        al = np.maximum(al, soft)
    col = np.clip((a - (1 - al[..., None])) / np.maximum(al, 1e-3)[..., None], 0, 1)
    return Image.fromarray((np.dstack([col, al]) * 255).astype(np.uint8), "RGBA")


def cutout(img):
    """Mauer-Bild freistellen: Grund = mit dem Rand verbundenes Fast-Weiß."""
    a = np.asarray(img.convert("RGB")).astype(np.float32)
    light = a.min(2) > 225
    lab, _ = ndi.label(light)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    body = ndi.binary_fill_holes(~bg)
    soft = ndi.gaussian_filter(body.astype(np.float32), 1.0)
    # Rand-Nebel/Rauch per Color-to-Alpha, Körper deckend
    return white_to_alpha(img, soft=np.clip(soft * 1.2, 0, 1) * (soft > 0.98))


def fade_down(img, start=0.0, power=1.2):
    """Bodennebel: nahe der Mauer (oben) deckend, nach außen auslaufend."""
    a = np.asarray(img.convert("RGBA")).astype(np.float32)
    h = a.shape[0]
    t = np.clip((np.arange(h) / h - start) / (1 - start), 0, 1)
    a[..., 3] *= ((1 - t) ** power)[:, None]
    return Image.fromarray(a.astype(np.uint8), "RGBA")


def alpha_by_light(img, gain=1.6, floor=0.0):
    a = np.asarray(img.convert("RGBA")).astype(np.float32)
    v = a[..., :3].max(2) / 255
    a[..., 3] = np.clip(floor + v * gain, 0, 1) * 255
    return Image.fromarray(a.astype(np.uint8), "RGBA")


def glow_of(atlas):
    a = np.asarray(atlas).astype(np.float32) / 255
    rgb = a[..., :3]
    v = rgb.max(2)
    s = (v - rgb.min(2)) / np.maximum(v, 1e-3)
    e = np.clip((v - 0.42) / 0.5, 0, 1) * np.clip((s - 0.3) / 0.45, 0, 1)
    return Image.fromarray((np.clip(rgb * e[..., None] * a[..., 3:4], 0, 1) * 255).astype(np.uint8), "RGB")


def pack(regions):
    """Einfacher Regal-Packer: Flächen nach Höhe sortiert in Reihen."""
    atlas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    rects = {}
    x = y = shelf = 0
    for name, img in sorted(regions.items(), key=lambda kv: -kv[1].height):
        w, h = img.size
        if x + w + 2 * PAD > SIZE:
            x, y, shelf = 0, y + shelf, 0
        if y + h + 2 * PAD > SIZE:
            raise SystemExit(f"Atlas voll bei {name}")
        padded = np.pad(np.asarray(img), ((PAD, PAD), (PAD, PAD), (0, 0)), mode="edge")
        atlas.paste(Image.fromarray(padded), (x, y))
        u = (x + PAD) / SIZE
        v = 1 - (y + PAD + h) / SIZE
        rects[name] = [round(u, 5), round(v, 5), round(w / SIZE, 5), round(h / SIZE, 5)]
        x += w + 2 * PAD
        shelf = max(shelf, h + 2 * PAD)
    return atlas, rects


# ---------------------------------------------------------------------------
# Stile


def poison():
    img = Image.open(os.path.join(SRC, "poison.jpg")).convert("RGB")
    face_z = rgba(skew(img, 350, 900, 621, 0.655, 210))
    regions = {
        "faceZ": face_z,
        "faceX": rgba(skew(img, 640, 960, 416, -0.475, 235)),
        "towerZ": rgba(skew(img, 945, 1095, 803, 0.67, 440)),
        "towerX": rgba(skew(img, 1118, 1253, 874, -0.665, 400)),
        "mist": fade_down(white_to_alpha(skew(img, 350, 900, 823, 0.655, 220)), 0.25),
        "brick": face_z.crop((20, 10, 260, 130)),
    }
    return regions, img


ICE = {
    "brick": (150, 330, 262, 492),
    "banner": (265, 330, 330, 492),
    "icicles": (333, 330, 408, 400),
    "crystals": (333, 402, 408, 492),
    "window": (410, 330, 490, 440),
    "base": (410, 444, 490, 492),
}
FIRE = {
    "brick": (168, 921, 274, 1108),
    "banner": (279, 921, 343, 1108),
    "skull": (349, 921, 421, 991),
    "lava": (349, 996, 421, 1108),
    "window": (426, 921, 498, 1028),
    "base": (426, 1033, 498, 1108),
}


def from_tiles(kind):
    sheet = Image.open(os.path.join(SRC, "ice-fire.jpg")).convert("RGB")
    T = {k: tile(sheet, b) for k, b in (ICE if kind == "ice" else FIRE).items()}
    H = 210
    brick = fit_h(T["brick"], H)
    banner = fit_h(T["banner"], H)
    wall = repeat_x(brick, brick.width * 3)
    face_z = row([wall, banner])
    if kind == "ice":
        face_x = row([banner, repeat_x(ImageOps.mirror(brick), brick.width * 3)])
        ic = repeat_x(fit_h(T["icicles"], 70), face_z.width)
        cr = repeat_x(fit_h(T["crystals"], 80), face_z.width)
        for name in ("z", "x"):
            f = face_z if name == "z" else face_x
            f = lighten(f, ic, 0, 0.9)
            f = lighten(f, cr, H - 80, 0.85)
            if name == "z":
                face_z = f
            else:
                face_x = f
    else:
        skull = fit_h(T["skull"], round(H * 0.55))
        face_x = repeat_x(ImageOps.mirror(brick), brick.width * 3 + banner.width)
        face_x.alpha_composite(skull, (face_x.width - skull.width - 20, 8))
        lava = repeat_x(fit_h(T["lava"], 110), face_z.width)
        face_z = lighten(face_z, lava, H - 110, 0.75)
        face_x = lighten(face_x, lava, H - 110, 0.75)

    # Türme: Mauerwerk, Fenster, Sockel übereinander
    W, TH = 150, 440
    col = repeat_y(fit_w(T["brick"], W), TH)
    win = fit_w(T["window"], W)
    col.alpha_composite(win, (0, 70))
    base = fit_w(T["base"], W)
    col.alpha_composite(base, (0, TH - base.height))
    if kind == "ice":
        col = lighten(col, repeat_x(fit_h(T["icicles"], 60), W), 0, 0.9)
        col = lighten(col, repeat_x(fit_h(T["crystals"], 70), W), TH - 70, 0.85)
    else:
        col = lighten(col, repeat_x(fit_h(T["lava"], 120), W), TH - 120, 0.7)
    tower_z = col
    tower_x = ImageOps.mirror(col)

    if kind == "ice":
        ground = repeat_x(fit_h(T["crystals"], 200), 480)
        mist = fade_down(alpha_by_light(ground, 1.5, 0.15), 0.1)
    else:
        ground = repeat_x(fit_h(T["lava"], 200), 480)
        mist = fade_down(alpha_by_light(ground, 1.9, 0.2), 0.1)

    regions = {
        "faceZ": face_z,
        "faceX": face_x,
        "towerZ": tower_z,
        "towerX": tower_x,
        "mist": mist,
        "brick": fit_w(T["brick"], 160),
    }
    # Vorschau: das isometrische Mauer-Bild aus dem Blatt (Kacheln weiß übermalt)
    if kind == "ice":
        crop = sheet.crop((0, 0, 581, 365))
        crop.paste((255, 255, 255), (146, 325, 581, 365))
    else:
        crop = sheet.crop((0, 568, 581, 995))
        crop.paste((255, 255, 255), (162, 914 - 568, 581, 995 - 568))
        # Unter dem Bild lagen die Kacheln: dort weich nach Weiß auslaufen statt hart zu enden
        a = np.asarray(crop).astype(np.float32)
        y1 = 914 - 568
        for i in range(40):
            k = (i + 1) / 40
            a[y1 - 40 + i, 150:] = a[y1 - 40 + i, 150:] * (1 - k) + 255 * k
        crop = Image.fromarray(a.astype(np.uint8))
    return regions, crop


def mordor():
    img = Image.open(os.path.join(SRC, "mordor.webp")).convert("RGB")
    face_z = rgba(skew(img, 215, 490, 755, -0.48, 345))
    face_x = rgba(skew(img, 630, 850, 540, -0.48, 350))
    tower_z = fit_h(rgba(skew(img, 66, 146, 707, 0.28, 430)), 640)
    tower_x = fit_h(rgba(skew(img, 148, 212, 760, -0.66, 420)), 620)
    lava = rgba(skew(img, 215, 490, 1030, -0.48, 90))
    mist = fade_down(alpha_by_light(repeat_x(lava, 550).resize((520, 160), Image.LANCZOS), 1.7, 0.25), 0.15)
    regions = {
        "faceZ": face_z,
        "faceX": face_x,
        "towerZ": tower_z,
        "towerX": tower_x,
        "mist": mist,
        "brick": face_z.crop((10, 10, 120, 150)),
    }
    return regions, img


# ---------------------------------------------------------------------------


def main():
    layout = {}
    for style, make in (("poison", poison), ("ice", lambda: from_tiles("ice")), ("fire", lambda: from_tiles("fire")), ("mordor", mordor)):
        regions, sprite = make()
        atlas, rects = pack(regions)
        atlas.save(os.path.join(ASSETS, f"rampart-{style}-atlas.webp"), "WEBP", quality=86, method=6)
        glow_of(atlas).save(os.path.join(ASSETS, f"rampart-{style}-glow.webp"), "WEBP", quality=80, method=6)
        cut = Image.open(os.path.join(ROOT, "art", "walls", "wall-poison.webp")) if style == "poison" else cutout(sprite)
        if style != "poison":
            bbox = cut.getchannel("A").point(lambda v: 255 if v > 10 else 0).getbbox()
            cut = cut.crop(bbox)
            cut.save(os.path.join(ROOT, "art", "walls", f"wall-{style}.webp"), "WEBP", quality=90, method=6)
        fit_w(cut.convert("RGBA"), 480).save(os.path.join(ASSETS, f"rampart-{style}.webp"), "WEBP", quality=85, method=6)
        layout[style] = rects
        print(style, json.dumps(rects))

    ts = [
        "// Erzeugt von art/walls/build-atlas.py – nicht von Hand ändern.",
        "/** Lage der Mauer-Flächen im Atlas je Stil: [u, v (von unten), Breite, Höhe]. */",
        "export const WALL_LAYOUT = {",
    ]
    for style, rects in layout.items():
        ts.append(f"  {style}: {{")
        for name, r in rects.items():
            ts.append(f"    {name}: [{', '.join(str(v) for v in r)}],")
        ts.append("  },")
    ts.append("} as const;")
    with open(os.path.join(ROOT, "src", "game", "castle", "wall-layout.ts"), "w") as f:
        f.write("\n".join(ts) + "\n")


main()
