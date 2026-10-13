/**
 * Stadtmauer im Stil des Schlosses: ab Schloss-Stufe 5 Gift, ab 10 Eis, ab 15
 * Feuer (auch bei der Mordor-Festung). Die Mauer bleibt ein festes 3D-Modell
 * (antippbar, Ziel der Angriffe); ihre Flächen stammen aus den gemalten
 * Mauer-Bildern. Leuchtrisse, Bodennebel und Partikel werden mit jeder
 * Schloss-Stufe innerhalb eines Stils stärker.
 */
import * as THREE from "three";
import fireAtlas from "@/assets/rampart-fire-atlas.webp";
import fireGlow from "@/assets/rampart-fire-glow.webp";
import firePreview from "@/assets/rampart-fire.webp";
import iceAtlas from "@/assets/rampart-ice-atlas.webp";
import iceGlow from "@/assets/rampart-ice-glow.webp";
import icePreview from "@/assets/rampart-ice.webp";
import poisonAtlas from "@/assets/rampart-poison-atlas.webp";
import poisonGlow from "@/assets/rampart-poison-glow.webp";
import poisonPreview from "@/assets/rampart-poison.webp";
import flameUrl from "@/assets/rampart-flame.webp";
import { Motes, noPick, type Motion } from "./castle-look";
import { Kit, type KitMat } from "./meshes";
import { INNER0, INNER1, WORLD, castleStage } from "./model";
import { wallTowers } from "./raid";
import type { Materials } from "./textures";

export type WallStyle = "poison" | "ice" | "fire";

export const WALL_STYLES: { key: WallStyle; name: string; from: number; preview: string }[] = [
  { key: "poison", name: "Gift-Mauer", from: 5, preview: poisonPreview },
  { key: "ice", name: "Eis-Mauer", from: 10, preview: icePreview },
  { key: "fire", name: "Feuer-Mauer", from: 15, preview: firePreview },
];

/** Mauer-Stil zur Schloss-Stufe und wie stark seine Effekte sind (0–1). */
export function wallStyleOf(castleLevel: number): { style: WallStyle | null; strength: number } {
  const { stage, progress } = castleStage(castleLevel);
  if (stage.key === "normal") return { style: null, strength: 0 };
  if (stage.key === "mordor") return { style: "fire", strength: 1 };
  return { style: stage.key, strength: progress };
}

// ---------------------------------------------------------------------------
// Bilder: Textur-Atlas (Flächen aus dem Mauer-Bild) und Leuchtkarte

const FILES: Record<WallStyle, { atlas: string; glow: string }> = {
  poison: { atlas: poisonAtlas, glow: poisonGlow },
  ice: { atlas: iceAtlas, glow: iceGlow },
  fire: { atlas: fireAtlas, glow: fireGlow },
};

/** Ausschnitt im Atlas: u, v (von unten), Breite, Höhe; negative Breite spiegelt. */
type Rect = readonly [number, number, number, number];

/** Lage der Flächen im Atlas (siehe Erzeugungs-Skript, gleich für alle Stile). */
const FACE_Z: Rect = [0.00586, 0.78906, 0.53711, 0.20508];
const FACE_X: Rect = [0.55469, 0.76465, 0.3125, 0.22949];
const TOWER_Z: Rect = [0.87891, 0.56445, 0.14648, 0.42969];
const TOWER_X: Rect = [0.55469, 0.3623, 0.13184, 0.39062];
const MIST: Rect = [0.00586, 0.5625, 0.53711, 0.21484];
/** Schlichtes Mauerwerk für Zinnen und Wehrgang. */
const STONE: Rect = [FACE_Z[0] + 0.4 * FACE_Z[2], FACE_Z[1] + 0.55 * FACE_Z[3], 0.12 * FACE_Z[2], 0.35 * FACE_Z[3]];
/** Unterer Mauerstreifen (mit Nebel) für Turmsockel. */
const BASE: Rect = [FACE_Z[0], FACE_Z[1], 0.25, 0.25 * FACE_Z[3]];
/** Mauerwerk im passenden Seitenverhältnis (Breite/Höhe), damit nichts verzerrt. */
function stoneFor(ratio: number): Rect {
  const h = ratio >= 1 ? 0.3 * FACE_Z[3] : 0.9 * FACE_Z[3];
  return [FACE_Z[0] + 0.02, FACE_Z[1] + 0.05 * FACE_Z[3], Math.min(FACE_Z[2] - 0.04, ratio * h), h];
}
/** Seitenverhältnis (Breite/Höhe) einer Fläche im Bild. */
const aspect = (r: Rect) => Math.abs(r[2]) / r[3];
const mirror = (r: Rect): Rect => [r[0] + r[2], r[1], -r[2], r[3]];

/**
 * Lambert-Material, das die gemalte Grundhelligkeit des Bildes behält: Ein
 * Teil der Textur leuchtet unabhängig vom Licht (wie beim Schloss-Bild), der
 * Rest folgt Sonne und Schatten. Die Leuchtrisse kommen über die Leuchtkarte.
 */
function paintedMaterial() {
  const m = new THREE.MeshLambertMaterial({
    color: new THREE.Color(1.15, 1.15, 1.2),
    emissive: new THREE.Color("#ffffff"),
  });
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      "#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += diffuseColor.rgb * 0.5;",
    );
  };
  m.customProgramCacheKey = () => "painted-wall";
  return m;
}

type Art = {
  body: THREE.MeshLambertMaterial;
  mist: THREE.MeshBasicMaterial;
  ready: boolean;
  waiting: (() => void)[];
};
const arts = new Map<WallStyle, Art>();

function art(style: WallStyle): Art {
  let a = arts.get(style);
  if (a) return a;
  const loader = new THREE.TextureLoader();
  let left = 2;
  const made: Art = {
    body: paintedMaterial(),
    mist: new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    ready: false,
    waiting: [],
  };
  const done = () => {
    if (--left > 0) return;
    made.ready = true;
    for (const w of made.waiting.splice(0)) w();
  };
  const prep = (t: THREE.Texture) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };
  const map = prep(loader.load(FILES[style].atlas, done));
  const glow = prep(loader.load(FILES[style].glow, done));
  made.body.map = map;
  made.body.emissiveMap = glow;
  made.mist.map = map;
  arts.set(style, made);
  a = made;
  return a;
}

let flameTex: THREE.Texture | null = null;
function flame(): THREE.Texture {
  if (!flameTex) {
    flameTex = new THREE.TextureLoader().load(flameUrl);
    flameTex.colorSpace = THREE.SRGBColorSpace;
  }
  return flameTex;
}

/** Sind die Bilder geladen? Sonst wird `onReady` einmal nach dem Laden gerufen. */
export function wallArtReady(style: WallStyle, onReady: () => void): boolean {
  const a = art(style);
  if (!a.ready) a.waiting.push(onReady);
  return a.ready;
}

/** Lädt alle Mauer-Bilder vorab. */
export function preloadWallArt() {
  for (const s of WALL_STYLES) art(s.key);
  flame();
}

// ---------------------------------------------------------------------------
// Bausteine

type Faces = Partial<Record<"px" | "nx" | "py" | "ny" | "pz" | "nz", Rect>>;

/** Quader, dessen Seiten je einen Ausschnitt des Atlas zeigen. */
function atlasBox(w: number, h: number, d: number, faces: Faces, rest: Rect = STONE) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  (["px", "nx", "py", "ny", "pz", "nz"] as const).forEach((f, i) => {
    const r = faces[f] ?? rest;
    for (let k = i * 4; k < i * 4 + 4; k++) uv.setXY(k, r[0] + uv.getX(k) * r[2], r[1] + uv.getY(k) * r[3]);
  });
  return g;
}

/** Quader mit Unterkante auf y. */
function put(k: Kit, mat: KitMat, geo: THREE.BufferGeometry, h: number, x: number, y: number, z: number) {
  k.add(mat, geo, x, y + h / 2, z);
}

const STYLE_FX: Record<WallStyle, { motion: Motion; colors: string[] }> = {
  poison: { motion: "rise", colors: ["#7dff4a", "#b45cff", "#c8ff6a"] },
  ice: { motion: "snow", colors: ["#e6f8ff", "#9fe2ff", "#ffffff"] },
  fire: { motion: "ember", colors: ["#ff7a1a", "#ffd04a", "#ff4a10"] },
};

// ---------------------------------------------------------------------------
// Die Mauer

export class WallLook {
  readonly group = new THREE.Group();
  readonly animated = true;
  private motes: Motes;
  private geos: THREE.BufferGeometry[] = [];
  private flames: THREE.Points | null = null;
  private flameSize = 0;
  private time = 0;

  /**
   * @param wallLevel Stufe der Stadtmauer (Höhe)
   * @param strength Stärke der Effekte innerhalb des Schloss-Stils (0–1)
   */
  constructor(mats: Materials, style: WallStyle, wallLevel: number, strength: number) {
    const a = art(style);
    a.body.emissiveIntensity = 0.7 + 0.8 * strength;
    a.mist.opacity = 0.55 + 0.4 * strength;

    const k = new Kit(mats);
    const body = a.body;
    const lo = INNER0 - 0.5;
    const hi = INNER1 + 0.5;
    const mid = WORLD / 2;
    const gateHalf = 1.4;
    const h = 2.5 + 0.065 * wallLevel;
    const t = 1.1;

    // Seiten als [x1, z1, x2, z2]; die Südseite hat das Tor.
    const runs: [number, number, number, number][] = [
      [lo, lo, hi, lo],
      [hi, lo, hi, hi],
      [lo, lo, lo, hi],
      [lo, hi, mid - gateHalf, hi],
      [mid + gateHalf, hi, hi, hi],
    ];
    const merlon = atlasBox(0.34, 0.36, 0.34, {});
    for (const [x1, z1, x2, z2] of runs) {
      const along = x1 === x2; // läuft entlang z
      const len = Math.abs(along ? z2 - z1 : x2 - x1);
      const face = along ? FACE_X : FACE_Z;
      const n = Math.max(1, Math.round(len / (h * aspect(face))));
      const seg = len / n;
      for (let i = 0; i < n; i++) {
        const r = i % 2 ? mirror(face) : face;
        const c = Math.min(along ? z1 : x1, along ? z2 : x2) + seg * (i + 0.5);
        const geo = along
          ? atlasBox(t, h, seg, { px: r, nx: r, py: stoneFor(t / seg) })
          : atlasBox(seg, h, t, { pz: r, nz: r, py: stoneFor(seg / t) });
        put(k, body, geo, h, along ? x1 : c, 0, along ? c : z1);
      }
      // Zinnen außen und innen
      const m = Math.round(len / 0.62);
      const off = t / 2 - 0.17;
      for (let i = 0; i <= m; i++) {
        const u = Math.min(along ? z1 : x1, along ? z2 : x2) + (len * i) / m;
        for (const s of [-1, 1]) {
          if (along) put(k, body, merlon, 0.36, x1 + s * off, h, u);
          else put(k, body, merlon, 0.36, u, h, z1 + s * off);
        }
      }
    }

    // Türme wie im Bild: eckig, gestufter Sockel, Zinnenkranz
    const tower = (x: number, z: number, s: number, th: number) => {
      put(k, body, atlasBox(s + 0.35, 0.5, s + 0.35, { px: BASE, nx: BASE, pz: BASE, nz: BASE }), 0.5, x, 0, z);
      put(k, body, atlasBox(s, th, s, { pz: TOWER_Z, nz: TOWER_Z, px: TOWER_X, nx: TOWER_X }), th, x, 0, z);
      put(k, body, atlasBox(s + 0.16, 0.18, s + 0.16, {}), 0.18, x, th, z);
      const step = (s - 0.4) / 3;
      const seen = new Set<string>();
      for (let i = 0; i < 4; i++) {
        const u = -s / 2 + 0.2 + i * step;
        for (const [dx, dz] of [
          [u, -s / 2 + 0.2],
          [u, s / 2 - 0.2],
          [-s / 2 + 0.2, u],
          [s / 2 - 0.2, u],
        ]) {
          const key = `${dx.toFixed(2)},${dz.toFixed(2)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          put(k, body, atlasBox(0.4, 0.42, 0.4, {}), 0.42, x + dx, th + 0.18, z + dz);
        }
      }
    };
    const th = h + 1.5 + 0.02 * wallLevel;
    const towers = wallTowers();
    for (const tw of towers) tower(tw.x, tw.y, 2.1, th);

    // Torhaus
    const gh = h + 1.1;
    for (const s of [-1, 1]) tower(mid + s * (gateHalf + 0.75), hi, 1.5, gh);
    put(k, body, atlasBox(gateHalf * 2 + 0.3, 0.8, t + 0.2, { pz: FACE_Z, nz: FACE_Z }), 0.8, mid, gh - 0.8, hi);
    k.box("woodDark", gateHalf * 2 - 0.2, gh - 0.8, 0.12, mid, 0, hi + 0.2);
    for (let i = 0; i < 5; i++) k.box("metal", 0.06, gh - 0.8, 0.14, mid - gateHalf + 0.4 + i * 0.55, 0, hi + 0.21);

    // Stil-Schmuck
    for (const tw of towers) {
      if (style === "ice") {
        // Eiskristalle am Sockel und eine Spitze auf dem Turm
        for (const [dx, dz, s] of [
          [1.25, 0.6, 1],
          [0.6, 1.25, 0.8],
          [-1.2, 1.1, 0.7],
        ] as const) {
          k.add(
            "crystal",
            new THREE.OctahedronGeometry(0.28 * s),
            tw.x + dx,
            0.5 * s,
            tw.y + dz,
            dx,
            0.3,
            dz * 0.2,
            1,
            2.6,
            1,
          );
        }
        k.add("crystal", new THREE.OctahedronGeometry(0.32), tw.x, th + 1.2, tw.y, 0.4, 0, 0, 1, 3, 1);
      } else if (style === "fire") {
        // Glutbett auf jedem Turm; die Flammen darüber sind gemalt (siehe unten)
        k.box("fire", 1.2, 0.08, 1.2, tw.x, th + 0.18, tw.y);
      }
    }

    const built = k.build();
    built.traverse((o) => {
      o.userData.wall = true;
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) this.geos.push(mesh.geometry);
    });
    this.group.add(built);

    // Bodennebel innen und außen entlang der Mauer
    const mist = this.mistStrips(runs, t);
    const mistMesh = new THREE.Mesh(mist, a.mist);
    mistMesh.renderOrder = 0;
    this.group.add(noPick(mistMesh));
    this.geos.push(mist);

    // Partikel entlang der Mauer
    const fx = STYLE_FX[style];
    const total = runs.reduce((sum, [x1, z1, x2, z2]) => sum + Math.abs(x2 - x1) + Math.abs(z2 - z1), 0);
    const spot = () => {
      let pick = Math.random() * total;
      for (const [x1, z1, x2, z2] of runs) {
        const len = Math.abs(x2 - x1) + Math.abs(z2 - z1);
        if (pick > len) {
          pick -= len;
          continue;
        }
        const f = pick / len;
        const side = (Math.random() < 0.5 ? -1 : 1) * (t / 2 + 0.2 + Math.random() * 1.4);
        const x = x1 + (x2 - x1) * f + (x1 === x2 ? side : 0);
        const z = z1 + (z2 - z1) * f + (x1 === x2 ? 0 : side);
        return [x, z] as const;
      }
      return [lo, lo] as const;
    };
    if (style === "fire") {
      // Gemalte Flammen auf den Türmen: ein Zeichenaufruf für alle
      // Punktgröße ist in three.js ohne tan(fov/2) gerechnet: ×2,8 ergibt etwa Weltgröße
      const world = 2.2 + 1.2 * strength;
      const size = world * 2.8;
      const pos = new Float32Array(towers.length * 3);
      towers.forEach((tw, i) => pos.set([tw.x, th + 0.25 + world * 0.42, tw.y], i * 3));
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      this.flames = new THREE.Points(
        geo,
        new THREE.PointsMaterial({ size, map: flame(), transparent: true, depthWrite: false, alphaTest: 0.02 }),
      );
      this.flames.renderOrder = 3;
      this.group.add(noPick(this.flames));
      this.geos.push(geo);
      this.flameSize = size;
    }

    this.motes = new Motes(Math.round(110 + 170 * strength), fx.motion, fx.colors, h + 1.2, 0.34, spot);
    this.group.add(this.motes.points);
    this.group.userData.wall = true;
  }

  /** Nebelstreifen auf dem Boden beidseits jeder Mauerseite (im Wechsel gespiegelt). */
  private mistStrips(runs: [number, number, number, number][], t: number) {
    const depth = 2.6;
    const pos: number[] = [];
    const uv: number[] = [];
    for (const [x1, z1, x2, z2] of runs) {
      const along = x1 === x2;
      const len = Math.abs(along ? z2 - z1 : x2 - x1);
      const n = Math.max(1, Math.round(len / (depth * aspect(MIST))));
      const seg = len / n;
      const start = Math.min(along ? z1 : x1, along ? z2 : x2);
      for (const side of [-1, 1]) {
        const near = side * (t / 2);
        const far = side * (t / 2 + depth);
        for (let i = 0; i < n; i++) {
          const r = i % 2 ? mirror(MIST) : MIST;
          const a0 = start + seg * i;
          const a1 = a0 + seg;
          const at = (u: number, off: number): [number, number, number] =>
            along ? [x1 + off, 0.04, u] : [u, 0.04, z1 + off];
          const p = [at(a0, near), at(a1, near), at(a0, far), at(a1, far)];
          const top = r[1] + r[3];
          const q = [
            [r[0], top],
            [r[0] + r[2], top],
            [r[0], r[1]],
            [r[0] + r[2], r[1]],
          ];
          for (const idx of [0, 2, 1, 1, 2, 3]) {
            pos.push(...p[idx]);
            uv.push(...q[idx]);
          }
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.computeBoundingSphere();
    return g;
  }

  tick(dt: number) {
    this.motes.tick(dt);
    if (this.flames) {
      // leichtes Flackern
      this.time += dt;
      const m = this.flames.material as THREE.PointsMaterial;
      m.size = this.flameSize * (1 + 0.06 * Math.sin(this.time * 9) + 0.04 * Math.sin(this.time * 23));
    }
  }

  dispose() {
    for (const g of this.geos) g.dispose();
    this.motes.dispose();
    (this.flames?.material as THREE.Material | undefined)?.dispose();
  }
}
