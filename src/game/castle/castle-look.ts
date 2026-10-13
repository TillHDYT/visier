/**
 * Das Schloss: eines von fünf gemalten Bildern (normal, Gift, Eis, Feuer,
 * Mordor) als Tafel im 3D-Königreich, dazu Effekte, die mit jeder Stufe
 * stärker werden und schon den nächsten Stil ankündigen: Färbung, Leuchten,
 * Bodenaura, Fackeln und Partikel.
 */
import * as THREE from "three";
import fireUrl from "@/assets/castle-fire.webp";
import iceUrl from "@/assets/castle-ice.webp";
import mordorUrl from "@/assets/castle-mordor.webp";
import normalUrl from "@/assets/castle-normal.webp";
import poisonUrl from "@/assets/castle-poison.webp";
import { Kit, castleWidth } from "./meshes";
import { CASTLE_STAGES, SIZE, castleStage, type CastleStage } from "./model";
import type { Mat, Materials } from "./textures";

type StageKey = CastleStage["key"];
export type Motion = "rise" | "ember" | "snow" | "smoke";

type Theme = {
  url: string;
  /** Waagerechte Lage der vorderen Bodenspitze im Bild (0–1). */
  foot: number;
  /** Färbung, auf die das vorige Schloss kurz vor diesem Stil zuläuft. */
  tint: string;
  aura: string;
  colors: string[];
  motion: Motion;
  post: Mat;
  flame: Mat;
};

const THEME: Record<StageKey, Theme> = {
  normal: {
    url: normalUrl,
    foot: 0.545,
    tint: "#ffffff",
    aura: "#ffd27a",
    colors: ["#ffe9a8", "#ffd27a"],
    motion: "rise",
    post: "trunk",
    flame: "fire",
  },
  poison: {
    url: poisonUrl,
    foot: 0.575,
    tint: "#bff0a8",
    aura: "#8a3cff",
    colors: ["#7dff4a", "#b45cff", "#c8ff6a"],
    motion: "rise",
    post: "dark",
    flame: "poison",
  },
  ice: {
    url: iceUrl,
    foot: 0.58,
    tint: "#bcdcff",
    aura: "#6fd2ff",
    colors: ["#e6f8ff", "#9fe2ff", "#ffffff"],
    motion: "snow",
    post: "stoneLight",
    flame: "crystal",
  },
  fire: {
    url: fireUrl,
    foot: 0.54,
    tint: "#ffbe92",
    aura: "#ff6a1a",
    colors: ["#ff7a1a", "#ffd04a", "#ff4a10"],
    motion: "ember",
    post: "metal",
    flame: "fire",
  },
  mordor: {
    url: mordorUrl,
    foot: 0.556,
    tint: "#e08a78",
    aura: "#ff2a00",
    colors: ["#ff3010", "#ff7a1a", "#ffb040"],
    motion: "ember",
    post: "dark",
    flame: "fire",
  },
};

/** Partikel des eigenen Stils (Index wie CASTLE_STAGES) und für den Übergang. */
const OWN_MOTES = [0, 34, 34, 44, 64];
const NEXT_MOTES = 56;

/**
 * Kamera-Neigung der Szene. Die Tafel steht in der Mitte des Bauplatzes;
 * ihr Fuß muss im Bild auf der vorderen Ecke liegen, also so weit unter der
 * Mitte, wie die halbe Diagonale in der Ansicht nach unten wandert.
 */
const CAMERA_EL = 0.9;
const FOOT_DROP = (SIZE.castle / 2) * 2 * Math.SQRT1_2 * Math.sin(CAMERA_EL);
/** Bildschirm-Oben in der Welt und Blickrichtung (Azimut π/4). */
const VIEW_UP = new THREE.Vector3(
  -Math.SQRT1_2 * Math.sin(CAMERA_EL),
  Math.cos(CAMERA_EL),
  -Math.SQRT1_2 * Math.sin(CAMERA_EL),
);
const VIEW_IN = new THREE.Vector3(
  -Math.SQRT1_2 * Math.cos(CAMERA_EL),
  -Math.sin(CAMERA_EL),
  -Math.SQRT1_2 * Math.cos(CAMERA_EL),
);

// ---------------------------------------------------------------------------
// Bilder (einmal geladen, von allen Stufen geteilt)

type Art = { tex: THREE.Texture; aspect: number; mask: Uint8Array; ready: boolean; waiting: (() => void)[] };
const MASK = 64;
const arts = new Map<StageKey, Art>();

function art(key: StageKey, onReady: () => void): Art {
  let a = arts.get(key);
  if (!a) {
    const img = new Image();
    const tex = new THREE.Texture(img);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const made: Art = { tex, aspect: 1.1, mask: new Uint8Array(MASK * MASK), ready: false, waiting: [] };
    img.onload = () => {
      made.aspect = img.naturalHeight / img.naturalWidth;
      const c = document.createElement("canvas");
      c.width = MASK;
      c.height = MASK;
      const g = c.getContext("2d", { willReadFrequently: true });
      if (g) {
        g.drawImage(img, 0, 0, MASK, MASK);
        const px = g.getImageData(0, 0, MASK, MASK).data;
        for (let i = 0; i < MASK * MASK; i++) made.mask[i] = px[i * 4 + 3] > 110 ? 1 : 0;
      }
      tex.needsUpdate = true;
      made.ready = true;
      for (const w of made.waiting.splice(0)) w();
    };
    img.src = THEME[key].url;
    arts.set(key, made);
    a = made;
  }
  if (a.ready) queueMicrotask(onReady);
  else a.waiting.push(onReady);
  return a;
}

/** Lädt alle Schloss-Bilder vorab, damit ein Stilwechsel nicht flackert. */
export function preloadCastleArt() {
  for (const s of CASTLE_STAGES) art(s.key, () => {});
}

/** Trifft ein Strahl die Tafel an einer sichtbaren (nicht durchsichtigen) Stelle? */
export function castleOpaqueAt(sprite: THREE.Object3D, uv: THREE.Vector2 | undefined): boolean {
  const a = sprite.userData.art as Art | undefined;
  if (!a || !uv) return true;
  const x = Math.min(MASK - 1, Math.max(0, Math.floor(uv.x * MASK)));
  const y = Math.min(MASK - 1, Math.max(0, Math.floor((1 - uv.y) * MASK)));
  return a.mask[y * MASK + x] === 1;
}

// ---------------------------------------------------------------------------
// Weiche Verläufe für Leuchten, Aura, Schatten und Partikel

let glowTex: THREE.Texture | null = null;
function glow(): THREE.Texture {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,1)");
  r.addColorStop(0.35, "rgba(255,255,255,0.55)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

export function noPick(o: THREE.Object3D) {
  o.raycast = () => {};
  return o;
}

// ---------------------------------------------------------------------------
// Partikel

/** Startpunkt (x, z) eines Partikels; ohne Angabe ein Ring um den Ursprung. */
export type Spot = () => readonly [number, number];

export class Motes {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private col: Float32Array;
  private vel: Float32Array;
  private age: Float32Array;
  private life: Float32Array;
  private base: THREE.Color[];

  constructor(
    private count: number,
    private motion: Motion,
    colors: string[],
    private height: number,
    size: number,
    private spot?: Spot,
  ) {
    this.pos = new Float32Array(count * 3);
    this.col = new Float32Array(count * 4);
    this.vel = new Float32Array(count * 3);
    this.age = new Float32Array(count);
    this.life = new Float32Array(count);
    this.base = colors.map((c) => new THREE.Color(c));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("color", new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    const smoke = motion === "smoke";
    const mat = new THREE.PointsMaterial({
      size,
      map: glow(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: smoke ? THREE.NormalBlending : THREE.AdditiveBlending,
      fog: true,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
    noPick(this.points);
    for (let i = 0; i < count; i++) this.spawn(i, Math.random());
    this.tick(0);
  }

  private spawn(i: number, phase = 0) {
    const h = this.height;
    const a = Math.random() * Math.PI * 2;
    const r = 1 + Math.random() * 2.6;
    const p = this.pos;
    const v = this.vel;
    if (this.spot) {
      const [x, z] = this.spot();
      p[i * 3] = x;
      p[i * 3 + 2] = z;
    } else {
      p[i * 3] = Math.cos(a) * r;
      p[i * 3 + 2] = Math.sin(a) * r;
    }
    v[i * 3] = (Math.random() - 0.5) * 0.3;
    v[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
    if (this.motion === "snow") {
      p[i * 3 + 1] = h * (0.5 + Math.random() * 0.6);
      v[i * 3 + 1] = -(0.35 + Math.random() * 0.4);
      this.life[i] = 3 + Math.random() * 3;
    } else if (this.motion === "smoke") {
      if (!this.spot) {
        p[i * 3] *= 0.6;
        p[i * 3 + 2] *= 0.6;
      }
      p[i * 3 + 1] = h * (0.55 + Math.random() * 0.3);
      v[i * 3 + 1] = 0.5 + Math.random() * 0.5;
      this.life[i] = 3 + Math.random() * 2;
    } else {
      p[i * 3 + 1] = Math.random() * h * 0.5;
      v[i * 3 + 1] = this.motion === "ember" ? 1.4 + Math.random() * 1.6 : 0.45 + Math.random() * 0.6;
      this.life[i] = 1.8 + Math.random() * 2.2;
    }
    this.age[i] = this.life[i] * phase;
    const c = this.base[i % this.base.length];
    this.col[i * 4] = c.r;
    this.col[i * 4 + 1] = c.g;
    this.col[i * 4 + 2] = c.b;
  }

  tick(dt: number) {
    const p = this.pos;
    const v = this.vel;
    for (let i = 0; i < this.count; i++) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {
        this.spawn(i);
        continue;
      }
      const t = this.age[i] / this.life[i];
      const sway = Math.sin(this.age[i] * 2.3 + i) * 0.25;
      p[i * 3] += (v[i * 3] + sway) * dt;
      p[i * 3 + 1] += v[i * 3 + 1] * dt;
      p[i * 3 + 2] += (v[i * 3 + 2] - sway * 0.5) * dt;
      // weich ein- und ausblenden
      this.col[i * 4 + 3] = Math.min(1, t * 5, (1 - t) * 3) * (this.motion === "smoke" ? 0.55 : 0.95);
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }

  dispose() {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}

// ---------------------------------------------------------------------------
// Das Schloss einer Stufe

/** Plätze für Fackeln an den beiden vorderen Kanten (Straße in der Mitte frei). */
const TORCH_LEFT = [-2.6, 2.6, -1.9, 1.9, 0];
const TORCH_RIGHT = [1.8, -2.6, -0.4, 2.7, -1.5];

export class CastleLook {
  readonly group = new THREE.Group();
  /** Bewegt sich etwas (Partikel)? Dann zeichnet die Szene laufend. */
  readonly animated: boolean;
  private motes: Motes[] = [];
  private sprite: THREE.Sprite;
  private owned: THREE.Material[] = [];

  constructor(mats: Materials, level: number, onReady: () => void) {
    const { stage, next, progress } = castleStage(level);
    const si = CASTLE_STAGES.findIndex((s) => s.key === stage.key);
    const own = THEME[stage.key];
    const coming = next ? THEME[next.key] : null;
    const width = castleWidth(level);

    // Färbung: kurz vor dem nächsten Stil nimmt das Schloss dessen Farbe an.
    const tint = new THREE.Color("#ffffff");
    if (coming) tint.lerp(new THREE.Color(coming.tint), progress * 0.6);
    const a = art(stage.key, () => {
      this.fit(a, width);
      onReady();
    });
    const mat = new THREE.SpriteMaterial({
      map: a.tex,
      color: tint,
      transparent: true,
      alphaTest: 0.04,
      toneMapped: false,
    });
    this.owned.push(mat);
    this.sprite = new THREE.Sprite(mat);
    this.sprite.userData.art = a;
    this.sprite.renderOrder = 2;
    this.sprite.center.set(own.foot, 0);
    this.sprite.visible = false;
    this.fit(a, width);

    // Aura am Boden und Leuchten hinter dem Schloss
    const auraColor = new THREE.Color(own.aura);
    if (coming) auraColor.lerp(new THREE.Color(coming.aura), si === 0 ? 1 : progress);
    const strength = (si > 0 ? 0.32 : 0) + (coming ? progress * 0.42 : 0.4);
    if (strength > 0.01) {
      const auraMat = new THREE.MeshBasicMaterial({
        map: glow(),
        color: auraColor,
        transparent: true,
        opacity: Math.min(0.85, strength),
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const aura = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), auraMat);
      aura.rotation.x = -Math.PI / 2;
      aura.scale.set(width * 1.25, width * 1.25, 1);
      aura.position.y = 0.04;
      aura.renderOrder = 0;
      this.group.add(noPick(aura));
      const haloMat = new THREE.SpriteMaterial({
        map: glow(),
        color: auraColor,
        transparent: true,
        opacity: Math.min(0.7, strength * 0.8),
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const halo = new THREE.Sprite(haloMat);
      halo.scale.set(width * 1.5, width * 1.5, 1);
      const lift = width * a.aspect * 0.5 - FOOT_DROP;
      halo.position.copy(VIEW_UP).multiplyScalar(lift).addScaledVector(VIEW_IN, 2.5);
      halo.renderOrder = 1;
      this.group.add(noPick(halo));
      this.owned.push(auraMat, haloMat);
    }

    // Weicher Schatten, da gemalte Bilder keinen werfen
    const shadeMat = new THREE.MeshBasicMaterial({
      map: glow(),
      color: "#000000",
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    const shade = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadeMat);
    shade.rotation.x = -Math.PI / 2;
    shade.scale.set(width * 0.95, width * 0.95, 1);
    shade.position.set(0.8, 0.03, -0.8);
    shade.renderOrder = 0;
    this.group.add(noPick(shade));
    this.owned.push(shadeMat);

    // Fackeln: je Stufe innerhalb eines Stils ein Paar mehr
    const within = level - stage.from;
    const pairs = stage.key === "mordor" ? TORCH_LEFT.length : Math.min(TORCH_LEFT.length, within + 1);
    const k = new Kit(mats);
    const edge = SIZE.castle / 2 + 0.35;
    for (let i = 0; i < pairs; i++) {
      for (const [x, z] of [
        [TORCH_LEFT[i], edge],
        [edge, TORCH_RIGHT[i]],
      ] as const) {
        if (z === edge && Math.abs(x) < 1.4) continue;
        k.cyl(own.post, 0.07, 0.1, 1.1, 6, x, 0, z);
        k.cyl(own.post, 0.2, 0.12, 0.16, 8, x, 1.1, z);
        k.ball(own.flame, 0.15, x, 1.36, z, 1.4, 1);
      }
    }
    const torches = k.build();
    this.group.add(torches);
    this.group.add(this.sprite);

    // Partikel: eigener Stil plus der kommende, der mit jeder Stufe zunimmt
    const height = width * 1.1;
    const ownCount = OWN_MOTES[si];
    if (ownCount) this.motes.push(new Motes(ownCount, own.motion, own.colors, height, 0.32));
    if (stage.key === "mordor") this.motes.push(new Motes(26, "smoke", ["#2a2220", "#3a2e2a"], height, 2.2));
    if (coming && progress > 0) {
      const n = Math.round(progress * NEXT_MOTES);
      this.motes.push(new Motes(n, coming.motion, coming.colors, height, 0.3));
      if (next?.key === "mordor")
        this.motes.push(new Motes(Math.round(progress * 18), "smoke", ["#2a2220"], height, 1.8));
    }
    for (const m of this.motes) this.group.add(m.points);
    this.animated = this.motes.length > 0;
  }

  /** Größe der Tafel aus Breite und Bildformat; Fuß auf der vorderen Ecke. */
  private fit(a: { aspect: number; ready: boolean }, width: number) {
    const h = width * a.aspect;
    this.sprite.scale.set(width, h, 1);
    this.sprite.center.y = FOOT_DROP / h;
    this.sprite.visible = a.ready;
  }

  tick(dt: number) {
    for (const m of this.motes) m.tick(dt);
  }

  dispose() {
    for (const m of this.motes) m.dispose();
    for (const m of this.owned) m.dispose();
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });
  }
}
