/**
 * Prozedurale Texturen (Canvas) und die gemeinsamen Materialien des
 * Königreichs. Alles wird einmal erzeugt und von allen Gebäuden geteilt.
 */
import * as THREE from "three";
import type { WallSkin } from "./model";

type Paint = (g: CanvasRenderingContext2D, n: number, r: () => number) => void;

function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function tex(size: number, seed: number, paint: Paint): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d")!;
  paint(g, size, rng(seed));
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function hsl(h: number, s: number, l: number) {
  return `hsl(${h},${s}%,${l}%)`;
}

/** Mauerwerk: versetzte Quader mit Fugen und leichter Farbstreuung. */
function blocks(base: [number, number, number], rows: number, mortar: string, seed: number) {
  return tex(256, seed, (g, n, r) => {
    g.fillStyle = mortar;
    g.fillRect(0, 0, n, n);
    const h = n / rows;
    for (let row = 0; row < rows; row++) {
      const cols = 2 + Math.floor(r() * 2);
      const w = n / cols;
      const off = row % 2 ? w / 2 : 0;
      for (let c = -1; c <= cols; c++) {
        const x = c * w + off;
        const l = base[2] + (r() - 0.5) * 12;
        g.fillStyle = hsl(base[0] + (r() - 0.5) * 8, base[1], l);
        g.fillRect(x + 2, row * h + 2, w - 4, h - 4);
        // Kanten-Licht und -Schatten
        g.fillStyle = "rgba(255,255,255,0.12)";
        g.fillRect(x + 2, row * h + 2, w - 4, 3);
        g.fillStyle = "rgba(0,0,0,0.18)";
        g.fillRect(x + 2, row * h + h - 5, w - 4, 3);
        for (let k = 0; k < 6; k++) {
          g.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.08})`;
          g.fillRect(x + 4 + r() * (w - 10), row * h + 4 + r() * (h - 10), 3 + r() * 6, 2 + r() * 4);
        }
      }
    }
  });
}

function planks(base: [number, number, number], seed: number) {
  return tex(128, seed, (g, n, r) => {
    const rows = 6;
    const h = n / rows;
    for (let i = 0; i < rows; i++) {
      g.fillStyle = hsl(base[0], base[1], base[2] + (r() - 0.5) * 10);
      g.fillRect(0, i * h, n, h);
      for (let k = 0; k < 10; k++) {
        g.fillStyle = `rgba(40,20,5,${0.08 + r() * 0.1})`;
        g.fillRect(r() * n, i * h + r() * h, 10 + r() * 30, 1);
      }
      g.fillStyle = "rgba(30,15,5,0.55)";
      g.fillRect(0, i * h, n, 2);
    }
  });
}

function tiles(base: [number, number, number], seed: number) {
  return tex(128, seed, (g, n, r) => {
    g.fillStyle = hsl(base[0], base[1], base[2] - 12);
    g.fillRect(0, 0, n, n);
    const rows = 8;
    const h = n / rows;
    for (let row = 0; row < rows; row++) {
      const cols = 8;
      const w = n / cols;
      const off = row % 2 ? w / 2 : 0;
      for (let c = -1; c <= cols; c++) {
        g.fillStyle = hsl(base[0] + (r() - 0.5) * 6, base[1], base[2] + (r() - 0.5) * 10);
        g.beginPath();
        g.roundRect(c * w + off + 1, row * h + 1, w - 2, h - 1, [0, 0, w / 2, w / 2]);
        g.fill();
        g.fillStyle = "rgba(255,255,255,0.14)";
        g.fillRect(c * w + off + 2, row * h + 2, w - 4, 2);
      }
    }
  });
}

function noise(colors: string[], dots: number, size: number, seed: number, base: string) {
  return tex(size, seed, (g, n, r) => {
    g.fillStyle = base;
    g.fillRect(0, 0, n, n);
    for (let i = 0; i < dots; i++) {
      g.fillStyle = colors[Math.floor(r() * colors.length)];
      const s = 1 + r() * 3;
      g.fillRect(r() * n, r() * n, s, s * (0.6 + r()));
    }
  });
}

export type Mat =
  | "stone"
  | "stoneLight"
  | "plaster"
  | "wood"
  | "woodDark"
  | "roofRed"
  | "roofBlue"
  | "roofGold"
  | "thatch"
  | "crop"
  | "wheat"
  | "soil"
  | "rock"
  | "gravel"
  | "coal"
  | "gold"
  | "metal"
  | "bannerRed"
  | "bannerPurple"
  | "glow"
  | "crystal"
  | "fire"
  | "poison"
  | "leaf"
  | "trunk"
  | "wall"
  | "wallTrim"
  | "dark"
  | "paving"
  | "water"
  | "awning"
  | "canvas"
  | "hedge"
  | "marble"
  | "petalRed"
  | "petalYellow"
  | "petalPink";

const WALL_SKIN: Record<WallSkin, { base: [number, number, number]; mortar: string; trim: string }> = {
  ice: { base: [210, 10, 62], mortar: "#5d646c", trim: "#8fb6d8" },
  fire: { base: [10, 45, 42], mortar: "#4a2a20", trim: "#d8a040" },
  lava: { base: [15, 10, 26], mortar: "#1c1412", trim: "#ff7a2a" },
  gold: { base: [40, 35, 62], mortar: "#7a6440", trim: "#e7b52c" },
};

/**
 * Rasen: kräftiges Grün mit weichen hellen und dunklen Flecken und feinen
 * Halmen. Ruhig genug, dass Gebäude und Wege gut lesbar bleiben. Nahtlos.
 */
function grassTexture() {
  return tex(512, 21, (g, n, r) => {
    g.fillStyle = "#78b444";
    g.fillRect(0, 0, n, n);
    // weiche Flecken, an den Rändern umlaufend gezeichnet (nahtlos)
    for (let i = 0; i < 70; i++) {
      const x = r() * n;
      const y = r() * n;
      const rad = 40 + r() * 110;
      const light = r() < 0.5;
      for (const dx of [-n, 0, n])
        for (const dy of [-n, 0, n]) {
          const grd = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
          grd.addColorStop(0, light ? "rgba(170,220,90,0.22)" : "rgba(60,120,40,0.2)");
          grd.addColorStop(1, "rgba(0,0,0,0)");
          g.fillStyle = grd;
          g.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2);
        }
    }
    // feine Halme
    for (let i = 0; i < 14000; i++) {
      const x = r() * n;
      const y = r() * n;
      g.strokeStyle = r() < 0.5 ? "rgba(150,205,85,0.35)" : "rgba(70,130,45,0.3)";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (r() - 0.5) * 2, y - 2 - r() * 4);
      g.stroke();
    }
  });
}

/** Helles Steinpflaster (beige), wie gepflegte Plätze und Wege in einer Stadt. */
function pavingTexture() {
  return tex(256, 23, (g, n, r) => {
    g.fillStyle = "#cdbb98";
    g.fillRect(0, 0, n, n);
    const cells = 8;
    const w = n / cells;
    for (let y = 0; y < cells; y++)
      for (let x = 0; x < cells; x++) {
        const l = 80 + (r() - 0.5) * 8;
        g.fillStyle = `hsl(${38 + (r() - 0.5) * 6}, ${28 + r() * 10}%, ${l}%)`;
        g.beginPath();
        g.roundRect(x * w + 2, y * w + 2, w - 4, w - 4, 4);
        g.fill();
        g.fillStyle = "rgba(255,255,255,0.25)";
        g.fillRect(x * w + 4, y * w + 3, w - 8, 2);
        g.fillStyle = "rgba(120,95,60,0.18)";
        g.fillRect(x * w + 4, y * w + w - 5, w - 8, 2);
      }
  });
}

/** Alle Materialien. Lambert ist auf Handys deutlich günstiger als PBR und reicht hier. */
export class Materials {
  private map = new Map<string, THREE.Material>();
  /** Heller Rasen (draußen und im Innenhof) und helles Pflaster für Wege und Plätze. */
  readonly grass: THREE.CanvasTexture;
  readonly paving: THREE.CanvasTexture;
  readonly road: THREE.CanvasTexture;

  constructor() {
    this.grass = grassTexture();
    this.paving = pavingTexture();
    this.road = blocks([35, 12, 58], 6, "#6b5a44", 11);
    const lambert = (key: string, p: THREE.MeshLambertMaterialParameters) =>
      this.map.set(key, new THREE.MeshLambertMaterial(p));
    lambert("stone", { map: blocks([34, 14, 70], 4, "#8a7c68", 1) });
    lambert("stoneLight", { map: blocks([40, 26, 86], 4, "#b0a084", 2) });
    lambert("plaster", { map: noise(["#efe4cc", "#e2d4b8", "#f6eedc"], 900, 128, 4, "#ece0c6") });
    lambert("wood", { map: planks([28, 45, 38], 6) });
    lambert("woodDark", { map: planks([22, 40, 24], 7) });
    lambert("roofRed", { map: tiles([6, 70, 48], 8) });
    lambert("roofBlue", { map: tiles([212, 62, 50], 9) });
    lambert("roofGold", { map: tiles([42, 80, 52], 10), emissive: new THREE.Color("#3a2600") });
    lambert("thatch", {
      map: tex(128, 12, (g, n, r) => {
        g.fillStyle = "#c9a050";
        g.fillRect(0, 0, n, n);
        for (let i = 0; i < 700; i++) {
          g.strokeStyle = r() < 0.5 ? "#a87e34" : "#e0bc68";
          g.beginPath();
          const x = r() * n;
          const y = r() * n;
          g.moveTo(x, y);
          g.lineTo(x + (r() - 0.5) * 3, y + 6 + r() * 8);
          g.stroke();
        }
      }),
    });
    lambert("crop", { map: noise(["#3f8a2c", "#58a83a", "#2e6e22", "#6cba48"], 1800, 128, 13, "#4a7a2a") });
    lambert("wheat", { map: noise(["#e8c050", "#d4a838", "#f2d670", "#b88a28"], 1800, 128, 14, "#d8b040") });
    lambert("soil", {
      map: tex(128, 15, (g, n, r) => {
        g.fillStyle = "#6e4a2c";
        g.fillRect(0, 0, n, n);
        for (let i = 0; i < 8; i++) {
          g.fillStyle = "#5a3a20";
          g.fillRect(0, i * 16 + 10, n, 5);
        }
        for (let i = 0; i < 300; i++) {
          g.fillStyle = r() < 0.5 ? "#7e5634" : "#4e321c";
          g.fillRect(r() * n, r() * n, 2, 2);
        }
      }),
    });
    lambert("rock", { map: noise(["#8a8680", "#6e6a64", "#a6a29a", "#5c5852"], 1400, 128, 16, "#7c7872") });
    lambert("gravel", { map: noise(["#8a7a62", "#6e604c", "#9c8c72", "#5e5242"], 1600, 128, 19, "#7a6c56") });
    lambert("coal", { map: noise(["#1c1c1e", "#2a2a2e", "#3a3a40", "#121214"], 1400, 128, 17, "#222226") });
    lambert("gold", {
      map: noise(["#ffd75a", "#e7b52c", "#fff0a0", "#c8960c"], 1400, 128, 18, "#e0b030"),
      emissive: new THREE.Color("#4a3000"),
    });
    lambert("metal", { color: "#4a4e56" });
    lambert("bannerRed", { color: "#b81c2c", side: THREE.DoubleSide });
    lambert("bannerPurple", { color: "#6a2ab0", side: THREE.DoubleSide });
    lambert("glow", { color: "#ffd75a", emissive: new THREE.Color("#ffb020"), emissiveIntensity: 0.9 });
    lambert("crystal", { color: "#8fe0ff", emissive: new THREE.Color("#2fa8ff"), emissiveIntensity: 0.9 });
    lambert("fire", { color: "#ff8a2a", emissive: new THREE.Color("#ff5a10"), emissiveIntensity: 1 });
    lambert("poison", { color: "#9cff5a", emissive: new THREE.Color("#3cff20"), emissiveIntensity: 1 });
    lambert("leaf", { color: "#4e8f3a" });
    lambert("trunk", { color: "#6b4a2c" });
    lambert("dark", { color: "#1c1612" });
    lambert("paving", { map: this.paving, color: new THREE.Color(0.86, 0.82, 0.76) });
    lambert("water", { color: "#3d9fd6", emissive: new THREE.Color("#0b3d66") });
    lambert("awning", { color: "#d8463a" });
    lambert("canvas", { color: "#f4ead2" });
    lambert("hedge", { color: "#3f8a2e" });
    lambert("marble", { color: "#eeeae2" });
    lambert("petalRed", { color: "#ff5a5a" });
    lambert("petalYellow", { color: "#ffd84a" });
    lambert("petalPink", { color: "#ff9ad0" });
    this.setSkin("ice");
  }

  /** Mauer-Skin aus dem Shop: Farbe und Zierleisten der Stadtmauer. */
  setSkin(skin: WallSkin) {
    const s = WALL_SKIN[skin];
    const old = this.map.get("wall") as THREE.MeshLambertMaterial | undefined;
    old?.map?.dispose();
    old?.dispose();
    this.map.set("wall", new THREE.MeshLambertMaterial({ map: blocks(s.base, 4, s.mortar, 20) }));
    this.map.get("wallTrim")?.dispose();
    this.map.set(
      "wallTrim",
      new THREE.MeshLambertMaterial({
        color: s.trim,
        emissive: new THREE.Color(skin === "lava" ? "#a02a00" : "#000000"),
      }),
    );
  }

  get(m: Mat): THREE.Material {
    return this.map.get(m)!;
  }
}
