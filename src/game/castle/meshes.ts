/**
 * 3D-Modelle des Königreichs, prozedural aus einfachen Körpern gebaut und je
 * Material zu einer Geometrie zusammengefasst (wenige Draw-Calls, schnell auf
 * Handys). Alle vier Stufen gibt es eine neue Grundform, dazwischen Zierrat.
 * Einheiten: 1 = eine Kachel; y zeigt nach oben, z entspricht der Kachel-y-Achse.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { INNER0, INNER1, ROAD_END, SIZE, WORLD, tierOf, type BuildingKind } from "./model";
import { wallTowers } from "./raid";
import type { Mat, Materials } from "./textures";

const euler = new THREE.Euler();
const quat = new THREE.Quaternion();
const one = new THREE.Vector3(1, 1, 1);
const pos = new THREE.Vector3();

/** Box, deren UVs der Flächengröße folgen (Texturen kacheln statt zu strecken). */
function uvBox(w: number, h: number, d: number) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const dims = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]);
    }
  }
  return g;
}

/** Satteldach: Dreiecksprofil (Breite w, Höhe h), entlang z mit Länge d. */
function gableGeo(w: number, h: number, d: number) {
  const x = w / 2;
  const z = d / 2;
  const p = [
    // linke Dachfläche
    -x,
    0,
    z,
    0,
    h,
    z,
    0,
    h,
    -z,
    -x,
    0,
    z,
    0,
    h,
    -z,
    -x,
    0,
    -z,
    // rechte Dachfläche
    x,
    0,
    -z,
    0,
    h,
    -z,
    0,
    h,
    z,
    x,
    0,
    -z,
    0,
    h,
    z,
    x,
    0,
    z,
    // Giebel vorn und hinten
    -x,
    0,
    z,
    x,
    0,
    z,
    0,
    h,
    z,
    x,
    0,
    -z,
    -x,
    0,
    -z,
    0,
    h,
    -z,
  ];
  const slope = Math.hypot(x, h);
  const uv = [
    0,
    0,
    slope,
    0,
    slope,
    d,
    0,
    0,
    slope,
    d,
    0,
    d,
    0,
    0,
    slope,
    0,
    slope,
    d,
    0,
    0,
    slope,
    d,
    0,
    d,
    0,
    0,
    w,
    0,
    x,
    h,
    0,
    0,
    w,
    0,
    x,
    h,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

/** Sammelt Körper je Material und fasst sie zusammen. */
export class Kit {
  private parts = new Map<Mat, THREE.BufferGeometry[]>();
  private extras: THREE.Object3D[] = [];
  constructor(private mats: Materials) {}

  add(
    mat: Mat,
    geo: THREE.BufferGeometry,
    x: number,
    y: number,
    z: number,
    ry = 0,
    rx = 0,
    rz = 0,
    sx = 1,
    sy = 1,
    sz = 1,
  ) {
    const m = new THREE.Matrix4().compose(
      pos.set(x, y, z),
      quat.setFromEuler(euler.set(rx, ry, rz)),
      one.clone().set(sx, sy, sz),
    );
    const g = (geo.index ? geo.toNonIndexed() : geo).applyMatrix4(m);
    if (!g.attributes.uv)
      g.setAttribute(
        "uv",
        new THREE.Float32BufferAttribute(new Float32Array((g.attributes.position.count * 2) | 0), 2),
      );
    let list = this.parts.get(mat);
    if (!list) this.parts.set(mat, (list = []));
    list.push(g);
    return this;
  }

  /** Quader mit Unterkante auf y. */
  box(mat: Mat, w: number, h: number, d: number, x: number, y: number, z: number, ry = 0) {
    return this.add(mat, uvBox(w, h, d), x, y + h / 2, z, ry);
  }

  cyl(mat: Mat, rt: number, rb: number, h: number, seg: number, x: number, y: number, z: number) {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const circ = Math.PI * (rt + rb);
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * circ, uv.getY(i) * h);
    return this.add(mat, g, x, y + h / 2, z);
  }

  cone(mat: Mat, r: number, h: number, seg: number, x: number, y: number, z: number, ry = 0) {
    const g = new THREE.ConeGeometry(r, h, seg);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * r * 4, uv.getY(i) * h * 1.4);
    return this.add(mat, g, x, y + h / 2, z, ry);
  }

  /** Pyramidendach über einem Quadrat der Kantenlänge w. */
  pyramid(mat: Mat, w: number, h: number, x: number, y: number, z: number) {
    return this.cone(mat, (w / 2) * Math.SQRT2, h, 4, x, y, z, Math.PI / 4);
  }

  gable(mat: Mat, w: number, h: number, d: number, x: number, y: number, z: number, ry = 0) {
    return this.add(mat, gableGeo(w, h, d), x, y, z, ry);
  }

  ball(mat: Mat, r: number, x: number, y: number, z: number, sy = 1, detail = 0) {
    return this.add(mat, new THREE.IcosahedronGeometry(r, detail), x, y, z, 0, 0, 0, 1, sy, 1);
  }

  rock(mat: Mat, r: number, x: number, y: number, z: number, seed: number) {
    return this.add(
      mat,
      new THREE.DodecahedronGeometry(r, 0),
      x,
      y + r * 0.5,
      z,
      seed * 1.7,
      seed * 0.9,
      0,
      1,
      0.7,
      1.1,
    );
  }

  /** Zinnen entlang eines Rechtecks (Breite w, Tiefe d) auf Höhe y. */
  merlons(mat: Mat, w: number, d: number, y: number, size: number, cx = 0, cz = 0) {
    const n = Math.max(2, Math.round(w / (size * 2)));
    for (let i = 0; i <= n; i++) {
      const t = -w / 2 + (w * i) / n;
      this.box(mat, size, size, size, cx + t, y, cz - d / 2 + size / 2);
      this.box(mat, size, size, size, cx + t, y, cz + d / 2 - size / 2);
    }
    const m = Math.max(2, Math.round(d / (size * 2)));
    for (let i = 1; i < m; i++) {
      const t = -d / 2 + (d * i) / m;
      this.box(mat, size, size, size, cx - w / 2 + size / 2, y, cz + t);
      this.box(mat, size, size, size, cx + w / 2 - size / 2, y, cz + t);
    }
    return this;
  }

  /** Zinnen rund um einen Turm. */
  ring(mat: Mat, r: number, y: number, n: number, size: number, cx = 0, cz = 0) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.box(mat, size, size, size, cx + Math.cos(a) * r, y, cz + Math.sin(a) * r, -a);
    }
    return this;
  }

  /** Fenster auf der Vorder- (z+) und rechten Seite (x+) eines Quaders. */
  windows(mat: Mat, w: number, d: number, y: number, h: number, n: number, cx = 0, cz = 0) {
    for (let i = 0; i < n; i++) {
      const t = -w / 2 + (w * (i + 0.5)) / n;
      this.box(mat, Math.min(0.22, w / n / 2), h, 0.04, cx + t, y, cz + d / 2 + 0.01);
      const u = -d / 2 + (d * (i + 0.5)) / n;
      this.box(mat, 0.04, h, Math.min(0.22, d / n / 2), cx + w / 2 + 0.01, y, cz + u);
    }
    return this;
  }

  banner(mat: Mat, x: number, y: number, z: number, ry = 0, h = 0.7) {
    this.box(mat, 0.32, h, 0.03, x, y - h, z, ry);
    return this;
  }

  flag(mat: Mat, x: number, y: number, z: number) {
    this.cyl("trunk", 0.025, 0.025, 0.9, 4, x, y, z);
    this.box(mat, 0.45, 0.25, 0.02, x + 0.23, y + 0.6, z);
    return this;
  }

  /** Nicht zusammengefasste, bewegliche Teile (z. B. Windmühlenflügel). */
  extra(o: THREE.Object3D) {
    this.extras.push(o);
    return this;
  }

  build(): THREE.Group {
    const group = new THREE.Group();
    for (const [mat, list] of this.parts) {
      const merged = mergeGeometries(list, false);
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, this.mats.get(mat));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      for (const g of list) g.dispose();
    }
    for (const e of this.extras) group.add(e);
    return group;
  }
}

/** Windmühlenflügel als eigenes Objekt, damit sie sich drehen können. */
function blades(mats: Materials, size: number): THREE.Object3D {
  const k = new Kit(mats);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    k.add(
      "wood",
      uvBox(0.07, size, 0.04),
      Math.cos(a) * size * 0.5,
      Math.sin(a) * size * 0.5,
      0,
      0,
      0,
      a - Math.PI / 2,
    );
    k.add(
      "plaster",
      uvBox(0.22, size * 0.75, 0.02),
      Math.cos(a) * size * 0.55 + Math.cos(a + Math.PI / 2) * 0.13,
      Math.sin(a) * size * 0.55 + Math.sin(a + Math.PI / 2) * 0.13,
      0.03,
      0,
      0,
      a - Math.PI / 2,
    );
  }
  const g = k.build();
  g.userData.spin = true;
  return g;
}

// ---------------------------------------------------------------------------
// Gebäude

function house(k: Kit, l: number) {
  if (l === 1) {
    k.box("wood", 1.2, 0.75, 1.0, 0, 0, 0);
    k.gable("thatch", 1.45, 0.75, 1.25, 0, 0.75, 0, Math.PI / 2);
    k.box("dark", 0.28, 0.45, 0.04, 0.2, 0, 0.51);
    return;
  }
  const w = [0, 1.45, 1.55, 1.6, 1.75][l - 1];
  const d = [0, 1.25, 1.35, 1.4, 1.55][l - 1];
  const wallMat: Mat = l === 5 ? "stoneLight" : "plaster";
  const roofMat: Mat = l === 5 ? "roofGold" : l === 4 ? "roofBlue" : "roofRed";
  const win: Mat = l >= 4 ? "glow" : "dark";
  k.box("stone", w + 0.1, 0.22, d + 0.1, 0, 0, 0);
  if (l === 2) {
    k.box(wallMat, w, 0.95, d, 0, 0.22, 0);
    k.windows(win, w, d, 0.5, 0.28, 2);
    k.gable(roofMat, w + 0.3, 0.8, d + 0.2, 0, 1.17, 0);
    k.box("stone", 0.22, 0.7, 0.22, -0.4, 1.3, -0.3);
  } else {
    const floor = l === 3 ? 0.85 : 0.9;
    k.box(l === 3 ? "stone" : wallMat, w, floor, d, 0, 0.22, 0);
    k.box(wallMat, w, floor, d, 0, 0.22 + floor, 0);
    if (l === 3) {
      for (const t of [-w / 2, -w / 6, w / 6, w / 2])
        k.box("woodDark", 0.07, floor, 0.05, t, 0.22 + floor, d / 2 + 0.01);
      for (const t of [-d / 2, 0, d / 2]) k.box("woodDark", 0.05, floor, 0.07, w / 2 + 0.01, 0.22 + floor, t);
      k.box("woodDark", w + 0.04, 0.07, d + 0.04, 0, 0.22 + floor, 0);
    }
    k.windows(win, w, d, 0.42, 0.3, 3);
    k.windows(win, w, d, 0.3 + floor, 0.3, 3);
    const top = 0.22 + floor * 2;
    k.gable(roofMat, w + 0.35, 0.95, d + 0.25, 0, top, 0);
    k.box("stone", 0.24, 0.9, 0.24, -w / 3, top + 0.2, -d / 4);
    if (l >= 4) {
      k.box(wallMat, 0.6, top + 0.5, 0.6, w / 2 - 0.1, 0, -d / 2 + 0.1);
      k.pyramid(roofMat, 0.75, 0.7, w / 2 - 0.1, top + 0.5, -d / 2 + 0.1);
      k.banner(l === 5 ? "bannerPurple" : "bannerRed", -w / 4, top - 0.05, d / 2 + 0.04);
    }
    if (l === 5) {
      k.banner("bannerPurple", w / 4, top - 0.05, d / 2 + 0.04);
      k.ball("gold", 0.12, 0, top + 1.05, 0);
      k.ball("gold", 0.08, w / 2 - 0.1, top + 1.28, -d / 2 + 0.1);
    }
  }
  k.box("woodDark", 0.3, 0.55, 0.04, 0, 0.22, d / 2 + 0.03);
}

function tower(k: Kit, l: number) {
  if (l === 1) {
    for (const [x, z] of [
      [-0.45, -0.45],
      [0.45, -0.45],
      [-0.45, 0.45],
      [0.45, 0.45],
    ] as const)
      k.cyl("trunk", 0.08, 0.1, 2.2, 6, x, 0, z);
    k.box("wood", 0.95, 0.06, 0.06, 0, 0.9, 0.45);
    k.box("wood", 0.06, 0.06, 0.95, 0.45, 0.9, 0);
    k.box("wood", 1.25, 0.14, 1.25, 0, 2.0, 0);
    k.box("wood", 1.2, 0.35, 0.06, 0, 2.14, 0.6);
    k.box("wood", 0.06, 0.35, 1.2, 0.6, 2.14, 0);
    k.pyramid("thatch", 1.35, 0.7, 0, 2.5, 0);
    for (const [x, z] of [
      [-0.55, -0.55],
      [0.55, 0.55],
      [-0.55, 0.55],
      [0.55, -0.55],
    ] as const)
      k.cyl("trunk", 0.04, 0.04, 0.4, 4, x, 2.14, z);
    return;
  }
  if (l === 2) {
    k.box("stone", 1.1, 0.3, 1.1, 0, 0, 0);
    k.box("stone", 0.95, 2.4, 0.95, 0, 0.3, 0);
    k.windows("dark", 0.95, 0.95, 1.4, 0.32, 1);
    k.box("stone", 1.2, 0.25, 1.2, 0, 2.7, 0);
    k.merlons("stone", 1.2, 1.2, 2.95, 0.18);
    k.pyramid("roofRed", 1.1, 0.9, 0, 3.0, 0);
    return;
  }
  const r = [0, 0, 0.58, 0.62, 0.68][l - 1];
  const h = [0, 0, 3.0, 3.6, 4.2][l - 1];
  const body: Mat = l === 3 ? "stone" : "stoneLight";
  const roof: Mat = l === 5 ? "roofGold" : l === 4 ? "roofBlue" : "roofRed";
  k.cyl("stone", r + 0.18, r + 0.25, 0.35, 10, 0, 0, 0);
  k.cyl(body, r, r + 0.06, h, 10, 0, 0.35, 0);
  for (let i = 0; i < 3; i++) {
    const a = 0.8 + i * 0.9;
    k.box(
      l >= 4 ? "glow" : "dark",
      0.16,
      0.34,
      0.04,
      Math.cos(a) * (r + 0.02),
      0.9 + i * 0.85,
      Math.sin(a) * (r + 0.02),
      Math.PI / 2 - a,
    );
  }
  if (l >= 4) {
    const band: Mat = l === 5 ? "gold" : "metal";
    k.cyl(band, r + 0.03, r + 0.03, 0.1, 10, 0, 0.9, 0);
    k.cyl(band, r + 0.03, r + 0.03, 0.1, 10, 0, h - 0.2, 0);
  }
  k.cyl(body, r + 0.18, r + 0.12, 0.28, 10, 0, h + 0.35, 0);
  k.ring(body, r + 0.12, h + 0.63, 10, 0.17);
  k.cone(roof, r + 0.1, 1.1 + l * 0.15, 10, 0, h + 0.7, 0);
  const tip = h + 0.7 + 1.1 + l * 0.15;
  if (l === 3) k.flag("bannerRed", 0, tip, 0);
  if (l === 4) k.add("crystal", new THREE.OctahedronGeometry(0.22), 0, tip + 0.35, 0, 0, 0, 0, 1, 1.6, 1);
  if (l === 5) {
    k.ball("glow", 0.26, 0, tip + 0.35, 0, 1, 1);
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2])
      k.box("fire", 0.14, 0.14, 0.14, Math.cos(a) * (r + 0.3), h + 0.63, Math.sin(a) * (r + 0.3));
  }
}

function field(k: Kit, l: number) {
  k.box("soil", 2.7, 0.06, 2.7, 0, 0, 0);
  const crop: Mat = l >= 3 ? "wheat" : "crop";
  const rows = l === 1 ? 4 : 7;
  const h = [0.12, 0.25, 0.35, 0.42, 0.48][l - 1];
  for (let i = 0; i < rows; i++) {
    const z = -1.15 + (i * 2.3) / (rows - 1);
    if (l === 1) {
      for (let j = 0; j < 6; j++) k.box(crop, 0.14, h, 0.14, -1.0 + j * 0.4, 0.06, z);
    } else k.box(crop, 2.3, h, 0.2, 0, 0.06, z);
  }
  if (l >= 3) {
    const fence = (x1: number, z1: number, x2: number, z2: number) => {
      const n = 6;
      for (let i = 0; i <= n; i++)
        k.cyl("trunk", 0.04, 0.04, 0.4, 4, x1 + ((x2 - x1) * i) / n, 0, z1 + ((z2 - z1) * i) / n);
      const len = Math.hypot(x2 - x1, z2 - z1);
      k.box("wood", len, 0.05, 0.04, (x1 + x2) / 2, 0.28, (z1 + z2) / 2, -Math.atan2(z2 - z1, x2 - x1));
    };
    fence(-1.45, -1.45, 1.45, -1.45);
    fence(-1.45, -1.45, -1.45, 1.45);
    fence(1.45, -1.45, 1.45, 0.6);
    fence(-1.45, 1.45, 0.6, 1.45);
  }
  if (l >= 4) {
    // Strohballen und Vogelscheuche
    k.add("wheat", new THREE.CylinderGeometry(0.22, 0.22, 0.4, 10), 1.15, 0.22, 1.15, 0, 0, Math.PI / 2);
    k.add("wheat", new THREE.CylinderGeometry(0.22, 0.22, 0.4, 10), 0.85, 0.22, 1.25, 0.6, 0, Math.PI / 2);
    k.cyl("trunk", 0.03, 0.03, 0.9, 4, -0.2, 0, 0.1);
    k.box("bannerRed", 0.5, 0.06, 0.06, -0.2, 0.65, 0.1);
    k.ball("thatch", 0.1, -0.2, 0.95, 0.1);
  }
  if (l === 5) {
    k.box("wood", 0.7, 0.55, 0.6, -1.0, 0.06, -1.0);
    k.gable("roofRed", 0.85, 0.4, 0.7, -1.0, 0.61, -1.0, Math.PI / 2);
    k.cyl("stone", 0.2, 0.22, 0.3, 8, 1.1, 0.06, -1.05);
    k.box("wood", 0.5, 0.05, 0.05, 1.1, 0.65, -1.05);
  }
}

function farm(k: Kit, l: number, mats: Materials) {
  k.box("soil", 2.8, 0.04, 2.8, 0, 0, 0);
  const barnW = [1.3, 1.6, 1.6, 1.7, 1.9][l - 1];
  const barnH = [0.9, 1.1, 1.15, 1.2, 1.35][l - 1];
  const wall: Mat = l === 5 ? "plaster" : "wood";
  const roof: Mat = l === 1 ? "thatch" : l === 5 ? "roofGold" : "roofRed";
  k.box(wall, barnW, barnH, 1.2, -0.45, 0.04, -0.5);
  k.gable(roof, barnW + 0.25, 0.75, 1.35, -0.45, barnH + 0.04, -0.5, Math.PI / 2);
  k.box("woodDark", 0.5, barnH * 0.65, 0.04, -0.45, 0.04, 0.12);
  k.ball("wheat", 0.32, 0.9, 0.04, 0.9, 0.6);
  if (l >= 2) {
    for (let i = 0; i < 6; i++) k.cyl("trunk", 0.04, 0.04, 0.35, 4, -1.3 + i * 0.45, 0.04, 1.3);
    k.box("wood", 2.3, 0.05, 0.04, -0.17, 0.3, 1.3);
    k.box("wood", 0.6, 0.18, 0.25, 0.8, 0.04, 0.2);
  }
  if (l >= 3) {
    k.cyl("stone", 0.32, 0.34, 1.7, 10, 0.95, 0.04, -0.85);
    k.cone(roof === "thatch" ? "roofRed" : roof, 0.38, 0.4, 10, 0.95, 1.74, -0.85);
  }
  if (l >= 4) {
    const mx = 0.95;
    const mz = 0.75;
    k.cyl(l === 5 ? "stoneLight" : "stone", 0.28, 0.38, 1.8, 8, mx, 0.04, mz);
    k.cone(roof, 0.36, 0.5, 8, mx, 1.84, mz);
    const b = blades(mats, l === 5 ? 1.5 : 1.25);
    b.position.set(mx + 0.25, 1.75, mz + 0.25);
    b.rotation.y = Math.PI / 4;
    k.extra(b);
  }
  if (l === 5) {
    k.cyl("stone", 0.32, 0.34, 1.9, 10, 0.2, 0.04, -1.0);
    k.cone("roofGold", 0.38, 0.4, 10, 0.2, 1.94, -1.0);
    k.banner("bannerPurple", -0.45, barnH + 0.04, 0.12, 0, 0.5);
  }
}

function mine(k: Kit, l: number) {
  k.box("gravel", 2.7, 0.04, 2.7, 0, 0, 0);
  const rocks = [3, 4, 5, 5, 6][l - 1];
  for (let i = 0; i < rocks; i++) {
    const a = i * 1.3;
    k.rock("rock", 0.35 + (i % 3) * 0.12 + l * 0.04, -0.9 + Math.cos(a) * 0.35, 0.05, -0.8 + Math.sin(a) * 0.35, i);
  }
  // geschnittene Steinblöcke
  const stacks = [1, 2, 3, 4, 5][l - 1];
  for (let i = 0; i < stacks; i++)
    k.box("stoneLight", 0.35, 0.25, 0.35, 0.3 + (i % 3) * 0.4, 0.05 + Math.floor(i / 3) * 0.25, 0.8);
  if (l >= 2) {
    k.box("wood", 0.5, 0.25, 0.32, 0.9, 0.12, -0.2);
    k.cyl("metal", 0.1, 0.1, 0.06, 8, 0.75, 0.05, -0.05);
    k.cyl("metal", 0.1, 0.1, 0.06, 8, 1.05, 0.05, -0.05);
  }
  if (l >= 3) {
    k.cyl("trunk", 0.06, 0.07, 1.8, 6, 0.3, 0.05, -0.3);
    k.box("wood", 1.4, 0.08, 0.08, -0.25, 1.75, -0.3, 0.4);
    k.cyl("metal", 0.01, 0.01, 0.9, 3, -0.8, 0.9, -0.05);
    k.box("stoneLight", 0.3, 0.25, 0.3, -0.8, 0.6, -0.05);
  }
  if (l >= 4) {
    k.box("stone", 1.0, 0.9, 0.8, -0.6, 0.05, 0.5);
    k.gable(l === 5 ? "roofBlue" : "roofRed", 1.15, 0.5, 0.95, -0.6, 0.95, 0.5, Math.PI / 2);
    k.box("metal", 2.4, 0.03, 0.06, 0.2, 0.05, 0.15);
    k.box("metal", 2.4, 0.03, 0.06, 0.2, 0.05, 0.35);
  }
  if (l === 5) {
    k.banner("bannerRed", -0.9, 0.9, 0.92, 0, 0.5);
    k.box("stoneLight", 0.6, 0.6, 0.6, 1.1, 0.05, 1.0);
    k.flag("bannerRed", 1.1, 0.65, 1.0);
  }
}

function coal(k: Kit, l: number) {
  k.box("gravel", 2.7, 0.04, 2.7, 0, 0, 0);
  k.box("coal", 1.2, 0.03, 1.0, 0.8, 0.04, 0.8);
  const kilns = l >= 3 ? 2 : 1;
  for (let i = 0; i < kilns; i++) {
    const x = -0.8 + i * 0.9;
    k.ball("stone", 0.55, x, 0.04, -0.8, 0.75, 1);
    k.box(l >= 3 ? "fire" : "dark", 0.25, 0.22, 0.05, x, 0.08, -0.27);
  }
  k.rock("coal", 0.3, 0.9, 0.04, 0.9, 1);
  k.rock("coal", 0.25 + l * 0.04, 1.1, 0.04, 0.5, 2);
  for (let i = 0; i < 4; i++) k.cyl("trunk", 0.07, 0.07, 0.8, 5, -1.1 + i * 0.16, 0.08, 1.0);
  if (l >= 2) {
    k.box("wood", 1.0, 0.8, 0.8, 0.6, 0.04, -0.6);
    k.gable("roofRed", 1.15, 0.45, 0.95, 0.6, 0.84, -0.6, Math.PI / 2);
  }
  if (l >= 3) {
    k.cyl("stone", 0.16, 0.2, 1.8 + l * 0.2, 8, 1.15, 0.04, -1.1);
    k.cyl("fire", 0.12, 0.12, 0.08, 8, 1.15, 1.84 + l * 0.2, -1.1);
  }
  if (l >= 4) {
    k.box("stone", 1.3, 1.0, 0.9, -0.5, 0.04, 0.35);
    k.gable("roofRed", 1.45, 0.5, 1.05, -0.5, 1.04, 0.35);
    k.windows("glow", 1.3, 0.9, 0.45, 0.28, 2, -0.5, 0.35);
  }
  if (l === 5) {
    k.cyl("stone", 0.55, 0.7, 1.6, 10, 0.75, 0.04, 0.6);
    k.cyl("metal", 0.72, 0.72, 0.1, 10, 0.75, 0.4, 0.6);
    k.cyl("metal", 0.6, 0.6, 0.1, 10, 0.75, 1.3, 0.6);
    k.box("fire", 0.3, 0.3, 0.05, 0.75, 0.3, 1.27);
    k.cyl("fire", 0.4, 0.4, 0.05, 10, 0.75, 1.64, 0.6);
  }
}

function goldmine(k: Kit, l: number) {
  k.box("gravel", 2.7, 0.04, 2.7, 0, 0, 0);
  // Fels mit Stolleneingang
  k.rock("rock", 0.95, -0.55, 0.05, -0.6, 3);
  k.rock("rock", 0.7, 0.4, 0.05, -0.95, 5);
  k.box("dark", 0.55, 0.65, 0.08, -0.45, 0.05, 0.25);
  const piles = [1, 2, 3, 4, 6][l - 1];
  for (let i = 0; i < piles; i++)
    k.rock("gold", 0.16 + (i % 2) * 0.06, 0.6 + (i % 3) * 0.3, 0.05, 0.6 + Math.floor(i / 3) * 0.35, i + 7);
  if (l >= 2) {
    k.cyl("trunk", 0.05, 0.05, 0.75, 5, -0.78, 0.05, 0.3);
    k.cyl("trunk", 0.05, 0.05, 0.75, 5, -0.12, 0.05, 0.3);
    k.box("trunk", 0.8, 0.09, 0.1, -0.45, 0.78, 0.3);
    k.box("wood", 0.45, 0.22, 0.3, 0.3, 0.12, 0.15);
    k.rock("gold", 0.14, 0.3, 0.3, 0.15, 11);
  }
  if (l >= 3) {
    const mat: Mat = l >= 4 ? "stone" : "trunk";
    for (const [x, z] of [
      [0.6, -0.5],
      [1.15, -0.5],
      [0.6, 0.05],
      [1.15, 0.05],
    ] as const)
      k.cyl(mat, 0.05, 0.07, 2.0, 5, x, 0.05, z);
    k.box(mat === "stone" ? "stone" : "wood", 0.7, 0.1, 0.7, 0.875, 2.0, -0.22);
    k.add("metal", new THREE.TorusGeometry(0.28, 0.04, 6, 14), 0.875, 2.35, -0.22, Math.PI / 4);
  }
  if (l >= 4) {
    for (const [x, z] of [
      [-1.15, 0.9],
      [1.25, 1.1],
    ] as const) {
      k.cyl("trunk", 0.03, 0.03, 0.9, 4, x, 0.05, z);
      k.box("glow", 0.12, 0.16, 0.12, x, 0.95, z);
    }
  }
  if (l === 5) {
    k.box("stoneLight", 1.1, 0.9, 0.8, -0.85, 0.05, 1.0);
    k.gable("roofGold", 1.25, 0.5, 0.95, -0.85, 0.95, 1.0, Math.PI / 2);
    k.windows("glow", 1.1, 0.8, 0.4, 0.26, 2, -0.85, 1.0);
    k.banner("bannerPurple", -0.45, 0.75, 0.36, 0, 0.45);
    k.ball("gold", 0.18, 0.875, 2.75, -0.22, 1, 1);
  }
}

/** Breite des Schloss-Bildes in Kacheln; es wächst mit jeder Stufe. */
export function castleWidth(level: number): number {
  return 8.6 * (1 + 0.014 * (Math.max(1, Math.min(20, level)) - 1));
}

/** Ungefähre Höhe des Schloss-Bildes (die Bilder sind etwa so hoch wie breit). */
export function castleHeight(level: number): number {
  return castleWidth(level) * 1.08;
}

/**
 * Zierrat der Zwischenstufen: Jede der vier Unterstufen eines Stils fügt
 * etwas hinzu (Steinkante, Laternen, Banner mit Vorräten), damit jedes
 * Upgrade sichtbar ist, auch wenn die Grundform gleich bleibt.
 */
function adorn(k: Kit, kind: BuildingKind, tier: number, sub: number) {
  if (sub === 0) return;
  const h = SIZE[kind] / 2 - 0.1;
  const flame: Mat = tier >= 4 ? "crystal" : "fire";
  const banner: Mat = tier === 5 ? "bannerPurple" : "bannerRed";
  // Steinkante rund um den Bauplatz
  const curb: Mat = tier >= 3 ? "stoneLight" : "stone";
  k.box(curb, SIZE[kind] - 0.1, 0.1, 0.12, 0, 0, -h);
  k.box(curb, SIZE[kind] - 0.1, 0.1, 0.12, 0, 0, h);
  k.box(curb, 0.12, 0.1, SIZE[kind] - 0.1, -h, 0, 0);
  k.box(curb, 0.12, 0.1, SIZE[kind] - 0.1, h, 0, 0);
  if (sub >= 2) {
    // Laternen an der linken und rechten Ecke
    for (const [x, z] of [
      [-h, h],
      [h, -h],
    ] as const) {
      k.cyl("metal", 0.035, 0.05, 0.85, 5, x, 0.1, z);
      k.box("metal", 0.2, 0.04, 0.2, x, 0.95, z);
      k.box(flame, 0.13, 0.17, 0.13, x, 0.99, z);
      k.pyramid("metal", 0.22, 0.12, x, 1.16, z);
    }
  }
  if (sub >= 3) {
    // Banner an der vorderen Ecke und ein paar Vorräte
    k.cyl("trunk", 0.03, 0.03, 1.5, 4, h - 0.05, 0.1, h - 0.05);
    k.box(banner, 0.04, 0.55, 0.32, h - 0.05, 1.05, h - 0.25);
    k.ball("gold", 0.05, h - 0.05, 1.62, h - 0.05);
    k.box("wood", 0.26, 0.24, 0.26, -h + 0.3, 0.1, h - 0.6);
    k.cyl("woodDark", 0.12, 0.12, 0.3, 8, -h + 0.32, 0.1, h - 0.25);
  }
}

/**
 * Einmal gebaute Vorlagen je Art und Stufe; Gebäude sind Klone davon.
 * Stufe 1–20: alle vier Stufen eine neue Grundform (Stil 1–5), dazwischen
 * wächst das Gebäude und bekommt Zierrat. Das Schloss ist ein eigenes Modell
 * (siehe castle-look.ts).
 */
export class Templates {
  private cache = new Map<string, THREE.Group>();
  constructor(private mats: Materials) {}

  get(kind: BuildingKind, level: number): THREE.Group {
    const key = `${kind}|${level}`;
    let t = this.cache.get(key);
    if (!t) {
      const { tier, sub } = tierOf(level);
      const k = new Kit(this.mats);
      if (kind === "house") house(k, tier);
      else if (kind === "tower") tower(k, tier);
      else if (kind === "field") field(k, tier);
      else if (kind === "farm") farm(k, tier, this.mats);
      else if (kind === "mine") mine(k, tier);
      else if (kind === "coal") coal(k, tier);
      else goldmine(k, tier);
      const body = k.build();
      // Jede Unterstufe etwas höher und breiter
      body.scale.set(1 + 0.025 * sub, 1 + 0.07 * sub, 1 + 0.025 * sub);
      const deco = new Kit(this.mats);
      adorn(deco, kind, tier, sub);
      t = new THREE.Group();
      t.add(body, deco.build());
      this.cache.set(key, t);
    }
    return t;
  }

  /** Höhe über dem Boden für Blasen und Effekte. */
  static top(kind: BuildingKind, level: number): number {
    const { tier, sub } = tierOf(level);
    const grow = 1 + 0.07 * sub;
    switch (kind) {
      case "castle":
        return castleHeight(level) * 0.72;
      case "tower":
        return (3 + tier * 0.8) * grow;
      case "house":
        return (1.6 + tier * 0.4) * grow;
      case "field":
        return 1 + sub * 0.1;
      default:
        return (1.8 + tier * 0.25) * grow;
    }
  }
}

// ---------------------------------------------------------------------------
// Stadtmauer (fest)

export function cityWall(mats: Materials, wallLevel: number): THREE.Group {
  const k = new Kit(mats);
  // Stil 1–5 bestimmt die Bauweise, die Unterstufe Höhe und Schmuck.
  const { tier: level, sub } = tierOf(wallLevel);
  const a = INNER0 - 0.5;
  const b = INNER1 + 0.5;
  const mid = WORLD / 2;
  const gateHalf = 1.4;
  const h = [1.5, 2.2, 2.7, 3.1, 3.5][level - 1] + sub * 0.14;
  const t = [0.5, 0.9, 1.0, 1.1, 1.2][level - 1];

  // Seiten als [x1, z1, x2, z2]; die Südseite hat das Tor.
  const runs: [number, number, number, number][] = [
    [a, a, b, a],
    [b, a, b, b],
    [a, a, a, b],
    [a, b, mid - gateHalf, b],
    [mid + gateHalf, b, b, b],
  ];

  if (level === 1) {
    for (const [x1, z1, x2, z2] of runs) {
      const n = Math.round(Math.hypot(x2 - x1, z2 - z1) / 0.32);
      for (let i = 0; i <= n; i++) {
        const x = x1 + ((x2 - x1) * i) / n;
        const z = z1 + ((z2 - z1) * i) / n;
        k.cyl("trunk", 0.15, 0.16, h + ((i * 7) % 3) * 0.08, 5, x, 0, z);
      }
      // Wehrgang innen
      const along = x1 === x2;
      k.box(
        "wood",
        along ? 0.5 : Math.abs(x2 - x1),
        0.08,
        along ? Math.abs(z2 - z1) : 0.5,
        (x1 + x2) / 2 + (along ? (x1 < mid ? 0.35 : -0.35) : 0),
        h - 0.45,
        (z1 + z2) / 2 + (along ? 0 : z1 < mid ? 0.35 : -0.35),
      );
    }
  } else {
    for (const [x1, z1, x2, z2] of runs) {
      const along = x1 === x2;
      const w = along ? t : Math.abs(x2 - x1);
      const d = along ? Math.abs(z2 - z1) : t;
      const cx = (x1 + x2) / 2;
      const cz = (z1 + z2) / 2;
      k.box("wall", w + (along ? 0.25 : 0), 0.4, d + (along ? 0 : 0.25), cx, 0, cz);
      k.box("wall", w, h, d, cx, 0, cz);
      if (level >= 4 || sub >= 3) k.box("wallTrim", w + 0.06, 0.1, d + 0.06, cx, h - 0.35, cz);
      // Zinnen außen und innen
      const n = Math.round((along ? d : w) / 0.55);
      for (let i = 0; i <= n; i++) {
        const u = -0.5 + i / n;
        const px = along ? cx : cx + u * w;
        const pz = along ? cz + u * d : cz;
        const off = t / 2 - 0.12;
        if (along) {
          k.box("wall", 0.22, 0.32, 0.3, px - off, h, pz);
          k.box("wall", 0.22, 0.32, 0.3, px + off, h, pz);
        } else {
          k.box("wall", 0.3, 0.32, 0.22, px, h, pz - off);
          k.box("wall", 0.3, 0.32, 0.22, px, h, pz + off);
        }
      }
    }
  }

  // Türme
  for (const tw of wallTowers()) {
    // Außenseite des Turms (für Fackeln und Banner)
    const ox = tw.x < mid - 1 ? -1 : tw.x > mid + 1 ? 1 : 0;
    const oz = tw.y < mid - 1 ? -1 : tw.y > mid + 1 ? 1 : 0;
    if (sub >= 1) {
      const r = level === 1 ? 0.6 : 0.85;
      k.box("fire", 0.16, 0.22, 0.16, tw.x + ox * r, h - 0.1, tw.y + oz * r);
    }
    if (sub >= 2 && (ox || oz)) {
      const r = level === 1 ? 0.58 : 0.9;
      k.banner(
        level === 5 ? "bannerPurple" : "bannerRed",
        tw.x + (oz ? 0 : ox * r),
        h + 0.7,
        tw.y + oz * r,
        oz ? 0 : Math.PI / 2,
        0.9,
      );
    }
    if (level === 1) {
      k.box("wood", 1.1, h + 1.0, 1.1, tw.x, 0, tw.y);
      k.box("wood", 1.4, 0.15, 1.4, tw.x, h + 1.0, tw.y);
      k.pyramid("thatch", 1.5, 0.8, tw.x, h + 1.15, tw.y);
      continue;
    }
    const r = 0.75 + level * 0.07;
    const th = h + 1.0 + level * 0.25;
    const roof: Mat = level === 5 ? "roofGold" : level === 4 ? "roofBlue" : "roofRed";
    if (level === 2) {
      k.box("wall", 1.5, th, 1.5, tw.x, 0, tw.y);
      k.merlons("wall", 1.5, 1.5, th, 0.24, tw.x, tw.y);
      continue;
    }
    k.cyl("wall", r, r + 0.1, th, 12, tw.x, 0, tw.y);
    k.cyl("wall", r + 0.15, r, 0.3, 12, tw.x, th, tw.y);
    k.ring("wall", r + 0.08, th + 0.3, 12, 0.24, tw.x, tw.y);
    if (level >= 4) {
      k.cone(roof, r + 0.15, 1.3 + level * 0.15, 12, tw.x, th + 0.3, tw.y);
      k.cyl("wallTrim", r + 0.03, r + 0.03, 0.12, 12, tw.x, th - 0.6, tw.y);
    }
    k.box("fire", 0.14, 0.2, 0.14, tw.x + (tw.x < mid ? r + 0.05 : -r - 0.05), th - 0.9, tw.y);
    if (level === 5) k.ball("glow", 0.2, tw.x, th + 0.3 + 1.3 + level * 0.15 + 0.2, tw.y, 1, 1);
  }

  // Torhaus
  const gh = h + (level === 1 ? 0.6 : 1.4);
  for (const s of [-1, 1]) {
    const gx = mid + s * (gateHalf + 0.6);
    if (level === 1) k.box("wood", 1.0, gh, 1.2, gx, 0, b);
    else {
      k.box("wall", 1.3, gh, 1.5, gx, 0, b);
      k.merlons("wall", 1.3, 1.5, gh, 0.22, gx, b);
      if (level >= 3)
        k.pyramid(level === 5 ? "roofGold" : level === 4 ? "roofBlue" : "roofRed", 1.4, 1.1, gx, gh + 0.22, b);
      if (level >= 4) k.banner(level === 5 ? "bannerPurple" : "bannerRed", gx, gh - 0.2, b + 0.77, 0, 1.2);
    }
  }
  k.box(level === 1 ? "wood" : "wall", gateHalf * 2 + 0.2, 0.6, 1.2, mid, gh - 0.6, b);
  k.box("woodDark", gateHalf * 2 - 0.2, gh - 0.6, 0.12, mid, 0, b + 0.2);
  for (let i = 0; i < 5; i++) k.box("metal", 0.06, gh - 0.6, 0.14, mid - gateHalf + 0.4 + i * 0.55, 0, b + 0.21);

  const g = k.build();
  g.userData.wall = true;
  g.traverse((o) => (o.userData.wall = true));
  return g;
}

// ---------------------------------------------------------------------------
// Landschaft

/**
 * Bodenflächen schreiben keine Tiefe: Das Schloss-Bild steht als Tafel in der
 * Mitte seines Bauplatzes, sein Fuß reicht optisch bis zur vorderen Ecke und
 * läge sonst „unter“ dem Boden. Die Reihenfolge ersetzt den Tiefentest.
 */
function flat(m: THREE.Mesh, order: number) {
  (m.material as THREE.Material).depthWrite = false;
  m.renderOrder = order;
}

export function landscape(mats: Materials): THREE.Group {
  const group = new THREE.Group();
  const size = 220;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshLambertMaterial({ map: mats.grassOut }),
  );
  mats.grassOut.repeat.set(size / 3, size / 3);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(WORLD / 2, -0.02, WORLD / 2);
  ground.receiveShadow = true;
  flat(ground, -4);
  group.add(ground);

  const inner = INNER1 - INNER0;
  const yard = new THREE.Mesh(
    new THREE.PlaneGeometry(inner + 1, inner + 1),
    new THREE.MeshLambertMaterial({ map: mats.grassIn }),
  );
  mats.grassIn.repeat.set(inner / 2.5, inner / 2.5);
  yard.rotation.x = -Math.PI / 2;
  yard.position.set(WORLD / 2, 0, WORLD / 2);
  yard.receiveShadow = true;
  flat(yard, -2);
  group.add(yard);

  // Pflasterstraße vom Tor nach innen und hinaus
  const roadMat = new THREE.MeshLambertMaterial({ map: mats.road });
  const roadLen = WORLD + 8 - ROAD_END;
  mats.road.repeat.set(2, roadLen / 1.2);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(2.3, roadLen), roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.set(WORLD / 2, 0.015, ROAD_END + roadLen / 2);
  road.receiveShadow = true;
  flat(road, -1);
  group.add(road);

  // See im Osten
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(1, 40),
    new THREE.MeshPhongMaterial({
      color: "#3a86b8",
      shininess: 90,
      specular: new THREE.Color("#cfe8ff"),
      transparent: true,
      opacity: 0.92,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.scale.set(14, 22, 1);
  water.position.set(INNER1 + 22, 0.01, WORLD / 2 - 4);
  group.add(water);
  const shore = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshLambertMaterial({ color: "#c8b47a" }));
  shore.rotation.x = -Math.PI / 2;
  shore.scale.set(15.2, 23.2, 1);
  shore.position.set(INNER1 + 22, 0.005, WORLD / 2 - 4);
  flat(shore, -3);
  group.add(shore);

  // Berge am Horizont
  const rock = mats.get("rock");
  const peaks: [number, number, number, number][] = [
    [-30, -20, 18, 22],
    [-8, -38, 22, 26],
    [20, -42, 16, 20],
    [48, -36, 24, 30],
    [80, -20, 18, 22],
    [-40, 20, 20, 24],
  ];
  for (const [x, z, r, h] of peaks) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), rock);
    m.position.set(x, h / 2 - 1, z);
    group.add(m);
    const cap = new THREE.Mesh(
      new THREE.ConeGeometry(r * 0.32, h * 0.32, 7),
      new THREE.MeshLambertMaterial({ color: "#f2f4f6" }),
    );
    cap.position.set(x, h - h * 0.16 - 1, z);
    group.add(cap);
  }

  // Wald rund um die Mauer (instanziert: zwei Draw-Calls für hunderte Bäume)
  let seed = 7;
  const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const spots: [number, number, number][] = [];
  for (let i = 0; i < 2400 && spots.length < 520; i++) {
    const x = -36 + r() * (WORLD + 72);
    const z = -36 + r() * (WORLD + 72);
    const nearWall = x > INNER0 - 9 && x < INNER1 + 9 && z > INNER0 - 9 && z < INNER1 + 9;
    const inLake = ((x - INNER1 - 22) / 16) ** 2 + ((z - WORLD / 2 + 4) / 24) ** 2 < 1;
    const onRoad = Math.abs(x - WORLD / 2) < 3 && z > INNER1;
    if (nearWall || inLake || onRoad) continue;
    spots.push([x, z, 0.8 + r() * 0.7]);
  }
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1.2, 5);
  trunkGeo.translate(0, 0.6, 0);
  const crownGeo = new THREE.ConeGeometry(0.9, 2.4, 7);
  crownGeo.translate(0, 2.2, 0);
  const roundGeo = new THREE.IcosahedronGeometry(1.0, 0);
  roundGeo.translate(0, 1.9, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, mats.get("trunk"), spots.length);
  const pines = new THREE.InstancedMesh(crownGeo, new THREE.MeshLambertMaterial({ color: "#2f6a34" }), spots.length);
  const leafy = new THREE.InstancedMesh(roundGeo, new THREE.MeshLambertMaterial({ color: "#4f8f3a" }), spots.length);
  const m = new THREE.Matrix4();
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  const tint = new THREE.Color();
  spots.forEach(([x, z, s], i) => {
    m.compose(
      new THREE.Vector3(x, 0, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, x * 3.1, 0)),
      new THREE.Vector3(s, s, s),
    );
    trunks.setMatrixAt(i, m);
    const pine = (i * 7) % 10 < 6;
    pines.setMatrixAt(i, pine ? m : hidden);
    leafy.setMatrixAt(i, pine ? hidden : m);
    tint.setHSL(0.27 + ((i * 13) % 10) * 0.006, 0.45, 0.32 + ((i * 7) % 10) * 0.012);
    pines.setColorAt(i, tint);
    leafy.setColorAt(i, tint.clone().offsetHSL(0.02, 0, 0.04));
  });
  for (const im of [trunks, pines, leafy]) {
    im.castShadow = true;
    im.receiveShadow = true;
    group.add(im);
  }
  return group;
}

/** Figuren für Angriffe: Gegner (grün/rot/lila) und Verteidiger (blau). */
export function unitGeometry(): THREE.BufferGeometry {
  const body = new THREE.CylinderGeometry(0.16, 0.22, 0.5, 7);
  body.translate(0, 0.25, 0);
  const head = new THREE.IcosahedronGeometry(0.15, 0);
  head.translate(0, 0.62, 0);
  const merged = mergeGeometries([body.toNonIndexed(), head]);
  return merged!;
}

// ---------------------------------------------------------------------------
// Deko im Innenhof: Bäume, Büsche, Blumen, Steine. Sie weichen Gebäuden aus.

type DecoSpot = { x: number; z: number; tile: number; kind: 0 | 1 | 2 | 3 | 4; s: number; rot: number };

export class Decor {
  readonly group = new THREE.Group();
  private spots: DecoSpot[] = [];
  private meshes: THREE.InstancedMesh[] = [];
  private byKind: number[][] = [[], [], [], [], []];

  constructor(mats: Materials) {
    let seed = 99;
    const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let ty = INNER0; ty < INNER1; ty++) {
      for (let tx = INNER0; tx < INNER1; tx++) {
        if (Math.abs(tx + 0.5 - WORLD / 2) < 1.6 && ty >= ROAD_END) continue;
        if (r() > 0.11) continue;
        const roll = r();
        const kind = (roll < 0.22 ? 0 : roll < 0.42 ? 1 : roll < 0.68 ? 2 : roll < 0.88 ? 3 : 4) as DecoSpot["kind"];
        this.spots.push({
          x: tx + 0.2 + r() * 0.6,
          z: ty + 0.2 + r() * 0.6,
          tile: ty * WORLD + tx,
          kind,
          s: 0.7 + r() * 0.5,
          rot: r() * 6,
        });
      }
    }
    for (const sp of this.spots) this.byKind[sp.kind].push(this.spots.indexOf(sp));

    const trunk = new THREE.CylinderGeometry(0.07, 0.11, 0.9, 5);
    trunk.translate(0, 0.45, 0);
    const blossom = new THREE.IcosahedronGeometry(0.75, 0);
    blossom.translate(0, 1.35, 0);
    const bush = new THREE.IcosahedronGeometry(0.38, 0);
    bush.translate(0, 0.25, 0);
    const flowers = new THREE.CylinderGeometry(0.32, 0.32, 0.08, 7);
    flowers.translate(0, 0.04, 0);
    const stone = new THREE.DodecahedronGeometry(0.22, 0);
    stone.translate(0, 0.12, 0);
    const parts: [THREE.BufferGeometry, THREE.Material, number[]][] = [
      [trunk, mats.get("trunk"), [0, 1]],
      [blossom, new THREE.MeshLambertMaterial({ color: "#a77ad8" }), [0]],
      [blossom, new THREE.MeshLambertMaterial({ color: "#4f8a38" }), [1]],
      [bush, new THREE.MeshLambertMaterial({ color: "#3f7a32" }), [2]],
      [flowers, new THREE.MeshLambertMaterial({ color: "#e8b4d8" }), [3]],
      [stone, mats.get("rock"), [4]],
    ];
    for (const [geo, mat, kinds] of parts) {
      const ids = kinds.flatMap((k) => this.byKind[k]);
      const im = new THREE.InstancedMesh(geo, mat, Math.max(1, ids.length));
      im.userData.ids = ids;
      im.castShadow = kinds[0] <= 2;
      im.receiveShadow = true;
      this.meshes.push(im);
      this.group.add(im);
    }
  }

  /** Versteckt Deko auf belegten Kacheln und im Bereich `clear` (Kacheln, inklusive). */
  update(grid: Int32Array, clear?: { x0: number; y0: number; x1: number; y1: number }) {
    const m = new THREE.Matrix4();
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const sc = new THREE.Vector3();
    for (const im of this.meshes) {
      const ids = im.userData.ids as number[];
      ids.forEach((id, i) => {
        const sp = this.spots[id];
        const tx = sp.tile % WORLD;
        const ty = Math.floor(sp.tile / WORLD);
        const cleared = clear && tx >= clear.x0 && tx <= clear.x1 && ty >= clear.y0 && ty <= clear.y1;
        if (grid[sp.tile] !== 0 || cleared) im.setMatrixAt(i, hidden);
        else
          im.setMatrixAt(
            i,
            m.compose(
              v.set(sp.x, 0, sp.z),
              q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), sp.rot),
              sc.set(sp.s, sp.s, sp.s),
            ),
          );
      });
      im.instanceMatrix.needsUpdate = true;
    }
  }
}
