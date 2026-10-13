/**
 * Stadtmauer im Stil des Schlosses: ab Schloss-Stufe 5 Gift, ab 10 Eis, ab 15
 * Feuer, ab 20 die große Mordor-Mauer. Die Mauer bleibt ein festes 3D-Modell
 * (antippbar, Ziel der Angriffe); ihre Flächen stammen aus den gemalten
 * Mauer-Bildern. Leuchtrisse, Bodennebel und Partikel werden mit jeder
 * Schloss-Stufe innerhalb eines Stils stärker.
 */
import * as THREE from "three";
import fireAtlas from "@/assets/rampart-fire-atlas.webp";
import fireGlow from "@/assets/rampart-fire-glow.webp";
import firePreview from "@/assets/rampart-fire.webp";
import iceAtlas from "@/assets/rampart-ice-atlas.webp";
import mordorAtlas from "@/assets/rampart-mordor-atlas.webp";
import mordorGlow from "@/assets/rampart-mordor-glow.webp";
import mordorPreview from "@/assets/rampart-mordor.webp";
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
import { WALL_LAYOUT } from "./wall-layout";

export type WallStyle = "poison" | "ice" | "fire" | "mordor";

export const WALL_STYLES: { key: WallStyle; name: string; from: number; preview: string }[] = [
  { key: "poison", name: "Gift-Mauer", from: 5, preview: poisonPreview },
  { key: "ice", name: "Eis-Mauer", from: 10, preview: icePreview },
  { key: "fire", name: "Feuer-Mauer", from: 15, preview: firePreview },
  { key: "mordor", name: "Mordor-Mauer", from: 20, preview: mordorPreview },
];

/** Mauer-Stil zur Schloss-Stufe und wie stark seine Effekte sind (0–1). */
export function wallStyleOf(castleLevel: number): { style: WallStyle | null; strength: number } {
  const { stage, progress } = castleStage(castleLevel);
  if (stage.key === "normal") return { style: null, strength: 0 };
  if (stage.key === "mordor") return { style: "mordor", strength: 1 };
  return { style: stage.key, strength: progress };
}

// ---------------------------------------------------------------------------
// Bilder: Textur-Atlas (Flächen aus dem Mauer-Bild) und Leuchtkarte

const FILES: Record<WallStyle, { atlas: string; glow: string }> = {
  poison: { atlas: poisonAtlas, glow: poisonGlow },
  ice: { atlas: iceAtlas, glow: iceGlow },
  fire: { atlas: fireAtlas, glow: fireGlow },
  mordor: { atlas: mordorAtlas, glow: mordorGlow },
};

/** Ausschnitt im Atlas: u, v (von unten), Breite, Höhe; negative Breite spiegelt. */
type Rect = readonly [number, number, number, number];

/**
 * Flächen eines Stils im Atlas (aus art/walls/build-atlas.py) und daraus
 * abgeleitete Ausschnitte für Zinnen, Wehrgang und Turmsockel.
 */
function layout(style: WallStyle) {
  const L = WALL_LAYOUT[style];
  const brick: Rect = L.brick;
  /** Mauerwerk im Seitenverhältnis `ratio` (Breite/Höhe), damit nichts verzerrt. */
  const stone = (ratio: number): Rect => {
    const a = aspect(brick);
    return ratio >= a
      ? [brick[0], brick[1], brick[2], brick[2] / ratio]
      : [brick[0], brick[1], brick[3] * ratio, brick[3]];
  };
  return {
    faceZ: L.faceZ as Rect,
    faceX: L.faceX as Rect,
    towerZ: L.towerZ as Rect,
    towerX: L.towerX as Rect,
    mist: L.mist as Rect,
    stone,
  };
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
  // Auch bei einem Ladefehler weiter: Die Mauer steht dann eben ohne Bild statt gar nicht.
  const map = prep(loader.load(FILES[style].atlas, done, undefined, done));
  const glow = prep(loader.load(FILES[style].glow, done, undefined, done));
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
function atlasBox(w: number, h: number, d: number, faces: Faces, rest: Rect) {
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
  mordor: { motion: "ember", colors: ["#ff3010", "#ff7a1a", "#ffb040"] },
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
  private flameWorld = 0;
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
    const L = layout(style);
    // Die Mordor-Mauer ist deutlich größer: höher, dicker, mächtigere Türme.
    const big = style === "mordor" ? 1.45 : 1;
    const cube = L.stone(1);
    const lo = INNER0 - 0.5;
    const hi = INNER1 + 0.5;
    const mid = WORLD / 2;
    const gateHalf = 1.4;
    const h = (2.5 + 0.065 * wallLevel) * big;
    const t = style === "mordor" ? 1.3 : 1.1;

    // Seiten als [x1, z1, x2, z2]; die Südseite hat das Tor.
    const runs: [number, number, number, number][] = [
      [lo, lo, hi, lo],
      [hi, lo, hi, hi],
      [lo, lo, lo, hi],
      [lo, hi, mid - gateHalf, hi],
      [mid + gateHalf, hi, hi, hi],
    ];
    const mz = 0.34 * big;
    const merlon = atlasBox(mz, mz * 1.06, mz, {}, cube);
    for (const [x1, z1, x2, z2] of runs) {
      const along = x1 === x2; // läuft entlang z
      const len = Math.abs(along ? z2 - z1 : x2 - x1);
      const face = along ? L.faceX : L.faceZ;
      const n = Math.max(1, Math.round(len / (h * aspect(face))));
      const seg = len / n;
      for (let i = 0; i < n; i++) {
        const r = i % 2 ? mirror(face) : face;
        const c = Math.min(along ? z1 : x1, along ? z2 : x2) + seg * (i + 0.5);
        const geo = along
          ? atlasBox(t, h, seg, { px: r, nx: r, py: L.stone(t / seg) }, cube)
          : atlasBox(seg, h, t, { pz: r, nz: r, py: L.stone(seg / t) }, cube);
        put(k, body, geo, h, along ? x1 : c, 0, along ? c : z1);
      }
      // Zinnen außen und innen
      const m = Math.round(len / (0.62 * big));
      const off = t / 2 - mz / 2;
      for (let i = 0; i <= m; i++) {
        const u = Math.min(along ? z1 : x1, along ? z2 : x2) + (len * i) / m;
        for (const s of [-1, 1]) {
          if (along) put(k, body, merlon, mz * 1.06, x1 + s * off, h, u);
          else put(k, body, merlon, mz * 1.06, u, h, z1 + s * off);
        }
      }
    }

    // Türme wie im Bild: eckig, gestufter Sockel, Zinnenkranz
    const tower = (x: number, z: number, s: number, th: number) => {
      const base = L.stone((s + 0.35) / 0.5);
      put(k, body, atlasBox(s + 0.35, 0.5, s + 0.35, { px: base, nx: base, pz: base, nz: base }, cube), 0.5, x, 0, z);
      const faces = { pz: L.towerZ, nz: L.towerZ, px: L.towerX, nx: L.towerX };
      put(k, body, atlasBox(s, th, s, faces, cube), th, x, 0, z);
      put(k, body, atlasBox(s + 0.16, 0.18, s + 0.16, {}, cube), 0.18, x, th, z);
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
          put(k, body, atlasBox(0.4, 0.42, 0.4, {}, cube), 0.42, x + dx, th + 0.18, z + dz);
        }
      }
    };
    const th = (h + 1.5 + 0.02 * wallLevel) * (style === "mordor" ? 1.12 : 1);
    const ts = 2.1 * (style === "mordor" ? 1.2 : 1);
    // Der Mauerturm in der Tormitte würde das Tor verdecken; dort steht das Torhaus.
    const towers = wallTowers().filter((tw) => !(tw.y === hi && Math.abs(tw.x - mid) < gateHalf + ts));
    for (const tw of towers) tower(tw.x, tw.y, ts, th);

    // Torhaus
    const gh = h + 1.1;
    for (const s of [-1, 1]) tower(mid + s * (gateHalf + 0.75), hi, 1.5, gh);
    const lintel = L.stone((gateHalf * 2 + 0.3) / 0.8);
    put(k, body, atlasBox(gateHalf * 2 + 0.3, 0.8, t + 0.2, { pz: lintel, nz: lintel }, cube), 0.8, mid, gh - 0.8, hi);
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
      } else if (style === "mordor") {
        // Schwarze Turmspitzen wie im Bild: eine hohe Mitte, vier Eckdornen
        k.box("fire", ts - 0.3, 0.08, ts - 0.3, tw.x, th + 0.18, tw.y);
        k.cone("dark", 0.55, 3.6, 8, tw.x, th + 0.6, tw.y);
        for (const [dx, dz] of [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ])
          k.cone("dark", 0.2, 1.7, 6, tw.x + dx * (ts / 2 - 0.25), th + 0.6, tw.y + dz * (ts / 2 - 0.25));
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
    const mist = this.mistStrips(runs, t, L.mist);
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
    if (style === "fire" || style === "mordor") {
      // Gemalte Flammen auf den Türmen: ein Zeichenaufruf für alle
      // Punktgröße ist in three.js ohne tan(fov/2) gerechnet: ×2,8 ergibt etwa Weltgröße
      const world = (2.2 + 1.2 * strength) * (style === "mordor" ? 1.15 : 1);
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
      this.flameWorld = world;
    }

    this.motes = new Motes(Math.round(110 + 170 * strength), fx.motion, fx.colors, h + 1.2, 0.34, spot);
    this.group.add(this.motes.points);
    this.group.userData.wall = true;
  }

  /** Nebelstreifen auf dem Boden beidseits jeder Mauerseite (im Wechsel gespiegelt). */
  private mistStrips(runs: [number, number, number, number][], t: number, MIST: Rect) {
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

  /**
   * Punktgröße an das Sichtfeld anpassen: three.js rechnet Punkte ohne
   * tan(fov/2), die Flammen sollen aber in jeder Ausrichtung gleich groß sein.
   */
  fit(fovDeg: number) {
    if (this.flameWorld) this.flameSize = this.flameWorld / Math.tan((fovDeg * Math.PI) / 360);
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
