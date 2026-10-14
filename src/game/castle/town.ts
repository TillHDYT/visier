/**
 * Stadtgebäude des Glutreichs: kräftige, detaillierte Bauten mit Sockel,
 * Fachwerk, Dachüberstand, Schornsteinen und Kleinkram (Fässer, Kisten,
 * Laternen). Jeder Bau steht auf einem gepflasterten Grundstück, damit die
 * Stadt aufgeräumt und dicht wirkt. Stil 1–5 (alle vier Stufen ein neuer).
 * Einheiten: 1 = eine Kachel; Mitte des Bauplatzes ist (0, 0).
 */
import * as THREE from "three";
import type { Kit } from "./meshes";
import type { Mat } from "./textures";

const ROOF: Mat[] = ["thatch", "roofRed", "roofRed", "roofBlue", "roofGold"];
const roofOf = (t: number) => ROOF[t - 1];
const bannerOf = (t: number): Mat => (t >= 5 ? "bannerPurple" : "bannerRed");

type HallOpts = {
  w: number;
  d: number;
  /** Wandhöhe ohne Dach */
  h: number;
  x?: number;
  z?: number;
  wall?: Mat;
  base?: Mat;
  roof?: Mat;
  roofH?: number;
  /** First entlang x statt z */
  alongX?: boolean;
  timber?: boolean;
  floors?: number;
  win?: Mat;
  chimney?: boolean;
  door?: boolean;
};

/** Ein Hausblock: Steinsockel, Wände, Fenster, Tür, Satteldach mit Überstand. */
export function hall(k: Kit, o: HallOpts) {
  const { w, d, h } = o;
  const x = o.x ?? 0;
  const z = o.z ?? 0;
  const base: Mat = o.base ?? "stone";
  const wall: Mat = o.wall ?? "plaster";
  const roof: Mat = o.roof ?? "roofRed";
  const roofH = o.roofH ?? Math.min(w, d) * 0.55;
  const floors = o.floors ?? 1;
  const win: Mat = o.win ?? "dark";
  const b = 0.24;
  k.box(base, w + 0.12, b, d + 0.12, x, 0, z);
  k.box(wall, w, h, d, x, b, z);
  // Stockwerksbalken und Fachwerk
  if (floors > 1) k.box("woodDark", w + 0.04, 0.07, d + 0.04, x, b + h / floors - 0.03, z);
  if (o.timber) {
    const n = Math.max(2, Math.round(w / 0.45));
    for (let i = 0; i <= n; i++) k.box("woodDark", 0.06, h, 0.04, x - w / 2 + (w * i) / n, b, z + d / 2 + 0.01);
    const m = Math.max(2, Math.round(d / 0.45));
    for (let i = 0; i <= m; i++) k.box("woodDark", 0.04, h, 0.06, x + w / 2 + 0.01, b, z - d / 2 + (d * i) / m);
  }
  // Fenster mit Sims je Stockwerk
  for (let f = 0; f < floors; f++) {
    const y = b + (h / floors) * f + (h / floors) * 0.42;
    const n = Math.max(1, Math.round(w / 0.55));
    k.windows(win, w, d, y, Math.min(0.3, (h / floors) * 0.4), n, x, z);
    k.box("stoneLight", w * 0.92, 0.04, 0.06, x, y - 0.03, z + d / 2 + 0.03);
  }
  // Tür mit Stufe
  if (o.door !== false) {
    k.box("woodDark", 0.3, Math.min(0.55, h * 0.6), 0.05, x + w * 0.18, b, z + d / 2 + 0.02);
    k.box("stoneLight", 0.46, 0.08, 0.2, x + w * 0.18, 0, z + d / 2 + 0.12);
  }
  // Dach mit Überstand und Traufbalken
  const top = b + h;
  k.box("woodDark", w + 0.2, 0.06, d + 0.2, x, top - 0.03, z);
  if (o.alongX) k.gable(roof, d + 0.34, roofH, w + 0.26, x, top, z, Math.PI / 2);
  else k.gable(roof, w + 0.34, roofH, d + 0.26, x, top, z);
  if (o.chimney) {
    k.box("stone", 0.22, roofH + 0.35, 0.22, x - w / 4, top, z - d / 5);
    k.box("stoneLight", 0.28, 0.06, 0.28, x - w / 4, top + roofH + 0.35, z - d / 5);
  }
  return top + roofH;
}

/** Runder Turm mit Kegeldach. */
function roundTower(k: Kit, x: number, z: number, r: number, h: number, roof: Mat, body: Mat = "stone") {
  k.cyl("stone", r + 0.08, r + 0.12, 0.25, 10, x, 0, z);
  k.cyl(body, r, r + 0.03, h, 10, x, 0.25, z);
  k.cyl("woodDark", r + 0.06, r + 0.06, 0.08, 10, x, 0.25 + h - 0.05, z);
  k.cone(roof, r + 0.14, r * 2.2, 10, x, 0.25 + h, z);
  for (let i = 0; i < 2; i++) {
    const a = 0.6 + i * 0.9;
    k.box(
      "glow",
      0.12,
      0.24,
      0.04,
      x + Math.cos(a) * (r + 0.01),
      0.25 + h * (0.45 + i * 0.25),
      z + Math.sin(a) * (r + 0.01),
      Math.PI / 2 - a,
    );
  }
  return 0.25 + h + r * 2.2;
}

/** Gepflastertes Grundstück. */
function lot(k: Kit, s: number) {
  k.box("paving", s - 0.12, 0.04, s - 0.12, 0, 0, 0);
}

function barrel(k: Kit, x: number, z: number, s = 1) {
  k.cyl("wood", 0.13 * s, 0.11 * s, 0.32 * s, 8, x, 0.04, z);
  k.cyl("metal", 0.135 * s, 0.135 * s, 0.03, 8, x, 0.04 + 0.08 * s, z);
  k.cyl("metal", 0.135 * s, 0.135 * s, 0.03, 8, x, 0.04 + 0.22 * s, z);
}

function crate(k: Kit, x: number, z: number, s = 0.26, y = 0.04) {
  k.box("wood", s, s, s, x, y, z, 0.3);
  k.box("woodDark", s + 0.01, 0.03, s + 0.01, x, y + s * 0.45, z, 0.3);
}

function lantern(k: Kit, x: number, z: number) {
  k.cyl("metal", 0.03, 0.04, 0.8, 5, x, 0.04, z);
  k.box("glow", 0.11, 0.14, 0.11, x, 0.84, z);
  k.pyramid("metal", 0.18, 0.1, x, 0.98, z);
}

function hay(k: Kit, x: number, z: number) {
  k.add("wheat", new THREE.CylinderGeometry(0.17, 0.17, 0.32, 10), x, 0.21, z, 0.4, 0, Math.PI / 2);
}

function horse(k: Kit, x: number, z: number, ry: number, coat: Mat = "trunk") {
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  const at = (dx: number, dz: number): [number, number] => [x + dx * c + dz * s, z - dx * s + dz * c];
  k.box(coat, 0.5, 0.2, 0.18, x, 0.3, z, ry);
  for (const [dx, dz] of [
    [-0.18, -0.06],
    [-0.18, 0.06],
    [0.18, -0.06],
    [0.18, 0.06],
  ]) {
    const [px, pz] = at(dx, dz);
    k.box(coat, 0.05, 0.3, 0.05, px, 0, pz, ry);
  }
  const [nx, nz] = at(0.28, 0);
  k.add(coat, new THREE.BoxGeometry(0.1, 0.3, 0.12), nx, 0.52, nz, ry, 0, -0.5);
  const [hx, hz] = at(0.38, 0);
  k.box(coat, 0.2, 0.1, 0.1, hx, 0.62, hz, ry);
  const [tx, tz] = at(-0.27, 0);
  k.box("dark", 0.05, 0.2, 0.05, tx, 0.22, tz, ry);
}

// ---------------------------------------------------------------------------
// Wohnhaus und Wachturm (überarbeitet: kräftiger, mit mehr Details)

export function house(k: Kit, t: number) {
  lot(k, 2);
  if (t === 1) {
    hall(k, { w: 1.45, d: 1.15, h: 0.75, wall: "wood", base: "rock", roof: "thatch", roofH: 0.75, door: true });
    barrel(k, 0.75, 0.55);
    crate(k, -0.7, 0.62);
    return;
  }
  const wall: Mat = t >= 5 ? "stoneLight" : "plaster";
  const win: Mat = t >= 3 ? "glow" : "dark";
  const floors = t >= 3 ? 2 : 1;
  const h = floors === 2 ? 1.5 : 0.95;
  const top = hall(k, {
    w: 1.6,
    d: 1.3,
    h,
    z: -0.1,
    wall,
    base: t >= 4 ? "stoneLight" : "stone",
    roof: roofOf(t),
    roofH: 0.8,
    timber: t <= 3,
    floors,
    win,
    chimney: true,
  });
  if (t >= 4) {
    // Anbau und Erkerturm
    hall(k, {
      w: 0.8,
      d: 0.9,
      h: h * 0.7,
      x: -0.45,
      z: 0.55,
      wall,
      roof: roofOf(t),
      roofH: 0.5,
      alongX: true,
      win,
      door: false,
    });
    k.box(wall, 0.5, top + 0.1, 0.5, 0.62, 0, -0.55);
    k.pyramid(roofOf(t), 0.66, 0.65, 0.62, top + 0.1, -0.55);
    k.banner(bannerOf(t), 0.0, 0.24 + h - 0.05, 0.56);
  }
  if (t >= 5) k.ball("gold", 0.08, 0.62, top + 0.8, -0.55);
  barrel(k, 0.75, 0.72);
  if (t >= 2) lantern(k, -0.78, 0.78);
}

export function tower(k: Kit, t: number) {
  lot(k, 2);
  if (t === 1) {
    // Hölzerner Wachturm: dicke Pfosten, Plattform mit Brüstung, Strohdach
    for (const [x, z] of [
      [-0.55, -0.55],
      [0.55, -0.55],
      [-0.55, 0.55],
      [0.55, 0.55],
    ] as const)
      k.cyl("trunk", 0.11, 0.13, 2.3, 6, x, 0, z);
    k.box("wood", 1.3, 0.08, 0.08, 0, 0.9, 0.55);
    k.box("wood", 0.08, 0.08, 1.3, 0.55, 0.9, 0);
    k.box("wood", 1.55, 0.16, 1.55, 0, 2.1, 0);
    k.box("wood", 1.5, 0.42, 0.08, 0, 2.26, 0.74);
    k.box("wood", 0.08, 0.42, 1.5, 0.74, 2.26, 0);
    k.box("wood", 1.5, 0.42, 0.08, 0, 2.26, -0.74);
    k.box("wood", 0.08, 0.42, 1.5, -0.74, 2.26, 0);
    k.pyramid("thatch", 1.7, 0.85, 0, 2.95, 0);
    for (const [x, z] of [
      [-0.7, -0.7],
      [0.7, 0.7],
      [-0.7, 0.7],
      [0.7, -0.7],
    ] as const)
      k.cyl("trunk", 0.05, 0.05, 0.7, 4, x, 2.26, z);
    crate(k, 0.75, 0.75);
    return;
  }
  if (t === 2) {
    k.box("stone", 1.45, 0.3, 1.45, 0, 0, 0);
    k.box("stone", 1.25, 2.6, 1.25, 0, 0.3, 0);
    k.windows("dark", 1.25, 1.25, 1.6, 0.34, 1);
    k.box("stone", 1.5, 0.25, 1.5, 0, 2.9, 0);
    k.merlons("stone", 1.5, 1.5, 3.15, 0.22);
    k.flag("bannerRed", 0, 3.15, 0);
    k.box("woodDark", 0.34, 0.6, 0.05, 0, 0.3, 0.64);
    return;
  }
  const r = [0, 0, 0.68, 0.74, 0.8][t - 1];
  const h = [0, 0, 3.0, 3.6, 4.2][t - 1];
  const body: Mat = t === 3 ? "stone" : "stoneLight";
  k.box("stone", 1.6, 0.3, 1.6, 0, 0, 0);
  k.cyl(body, r, r + 0.08, h, 12, 0, 0.3, 0);
  k.cyl("woodDark", r + 0.04, r + 0.04, 0.08, 12, 0, 1.2, 0);
  k.cyl(body, r + 0.2, r + 0.1, 0.32, 12, 0, h + 0.3, 0);
  k.ring(body, r + 0.14, h + 0.62, 12, 0.18);
  k.cone(roofOf(t), r + 0.12, 1.2 + t * 0.15, 12, 0, h + 0.7, 0);
  for (let i = 0; i < 3; i++) {
    const a = 0.8 + i * 0.9;
    k.box(
      t >= 4 ? "glow" : "dark",
      0.16,
      0.34,
      0.04,
      Math.cos(a) * (r + 0.02),
      0.95 + i * 0.85,
      Math.sin(a) * (r + 0.02),
      Math.PI / 2 - a,
    );
  }
  k.box("woodDark", 0.36, 0.62, 0.05, 0, 0.3, r + 0.04);
  const tip = h + 0.7 + 1.2 + t * 0.15;
  if (t === 3) k.flag("bannerRed", 0, tip, 0);
  if (t === 4) k.add("crystal", new THREE.OctahedronGeometry(0.22), 0, tip + 0.35, 0, 0, 0, 0, 1, 1.6, 1);
  if (t === 5) {
    k.ball("glow", 0.26, 0, tip + 0.35, 0, 1, 1);
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2])
      k.box("fire", 0.14, 0.14, 0.14, Math.cos(a) * (r + 0.32), h + 0.62, Math.sin(a) * (r + 0.32));
  }
}

// ---------------------------------------------------------------------------
// Neue Gebäude

export function barracks(k: Kit, t: number) {
  lot(k, 3);
  const wall: Mat = t >= 3 ? "stoneLight" : "stone";
  hall(k, {
    w: 2.3,
    d: 1.2,
    h: t >= 2 ? 1.35 : 1.0,
    z: -0.6,
    wall,
    roof: roofOf(Math.max(2, t)),
    roofH: 0.75,
    alongX: true,
    floors: t >= 2 ? 2 : 1,
    timber: t === 2,
    win: t >= 3 ? "glow" : "dark",
    chimney: true,
  });
  if (t >= 2) roundTower(k, 1.05, -0.95, 0.38, 1.6 + t * 0.3, roofOf(t));
  // Übungsplatz: Waffenständer, Strohpuppen, Zielscheibe
  k.box("woodDark", 0.9, 0.06, 0.08, -0.6, 0.55, 0.75);
  for (let i = 0; i < 4; i++) k.cyl("metal", 0.02, 0.02, 0.7, 4, -0.95 + i * 0.22, 0.04, 0.72);
  for (const x of [0.2, 0.75]) {
    k.cyl("trunk", 0.04, 0.04, 0.75, 5, x, 0.04, 0.55);
    k.box("wheat", 0.3, 0.06, 0.06, x, 0.6, 0.55);
    k.ball("wheat", 0.12, x, 0.85, 0.55);
  }
  k.cyl("wood", 0.26, 0.26, 0.05, 12, 1.05, 0.5, 0.95);
  k.cyl("bannerRed", 0.14, 0.14, 0.06, 12, 1.05, 0.5, 0.96);
  if (t >= 3) {
    k.banner(bannerOf(t), -0.4, 1.3, -0.0);
    k.banner(bannerOf(t), 0.4, 1.3, -0.0);
  }
  if (t >= 4)
    hall(k, {
      w: 1.0,
      d: 1.1,
      h: 1.0,
      x: -0.95,
      z: 0.45,
      wall,
      roof: roofOf(t),
      roofH: 0.55,
      door: false,
      win: "glow",
    });
  if (t >= 5) k.flag("bannerPurple", 1.05, 0.25 + 1.6 + t * 0.3 + 0.85, -0.95);
}

function stall(k: Kit, x: number, z: number, goods: Mat[], striped: boolean) {
  for (const [dx, dz] of [
    [-0.32, -0.25],
    [0.32, -0.25],
    [-0.32, 0.25],
    [0.32, 0.25],
  ])
    k.cyl("wood", 0.03, 0.03, 0.75, 4, x + dx, 0.04, z + dz);
  k.box("wood", 0.72, 0.08, 0.5, x, 0.4, z);
  goods.forEach((g, i) => k.ball(g, 0.08, x - 0.22 + i * 0.22, 0.54, z + 0.05));
  // gestreiftes Sonnendach
  for (let i = 0; i < 4; i++)
    k.add(
      i % 2 && striped ? "canvas" : "awning",
      new THREE.BoxGeometry(0.2, 0.03, 0.66),
      x - 0.3 + i * 0.2,
      0.86,
      z,
      0,
      0.25,
      0,
    );
}

export function market(k: Kit, t: number) {
  lot(k, 3);
  const n = Math.min(4, 1 + t);
  const spots: [number, number][] = [
    [-0.75, 0.65],
    [0.4, 0.75],
    [-0.75, -0.2],
    [0.95, -0.05],
  ];
  const goods: Mat[][] = [
    ["wheat", "crop", "petalRed"],
    ["gold", "gold", "gold"],
    ["petalYellow", "petalPink", "crop"],
    ["rock", "coal", "metal"],
  ];
  for (let i = 0; i < n; i++) stall(k, spots[i][0], spots[i][1], goods[i], i % 2 === 0);
  crate(k, 0.0, 0.2);
  crate(k, 0.1, -0.05, 0.2, 0.3);
  barrel(k, -0.15, 1.05);
  if (t >= 3)
    hall(k, {
      w: 1.4,
      d: 0.8,
      h: 0.9 + t * 0.1,
      x: 0.1,
      z: -1.0,
      wall: "plaster",
      roof: roofOf(t),
      roofH: 0.55,
      alongX: true,
      timber: true,
      win: "glow",
    });
  if (t >= 4) {
    // Uhrturm
    k.box("stoneLight", 0.5, 2.2 + t * 0.15, 0.5, -1.05, 0, -1.05);
    k.cyl("canvas", 0.16, 0.16, 0.03, 12, -1.05, 1.7, -0.79);
    k.pyramid(roofOf(t), 0.66, 0.6, -1.05, 2.2 + t * 0.15, -1.05);
  }
  lantern(k, 1.25, 1.2);
}

export function tavern(k: Kit, t: number) {
  lot(k, 2);
  const top = hall(k, {
    w: 1.6,
    d: 1.15,
    h: t >= 2 ? 1.4 : 0.9,
    z: -0.25,
    wall: t >= 4 ? "stoneLight" : "plaster",
    roof: roofOf(t),
    roofH: 0.7,
    timber: t <= 3,
    floors: t >= 2 ? 2 : 1,
    win: "glow",
    chimney: true,
  });
  // Wirtshausschild
  k.box("woodDark", 0.04, 0.04, 0.4, 0.82, 1.05, 0.25);
  k.box("gold", 0.03, 0.26, 0.26, 0.86, 0.78, 0.35);
  // Biergarten: Tisch, Bänke, Fässer
  k.box("wood", 0.6, 0.05, 0.3, -0.3, 0.38, 0.72);
  k.box("woodDark", 0.6, 0.04, 0.1, -0.3, 0.22, 0.52);
  k.box("woodDark", 0.6, 0.04, 0.1, -0.3, 0.22, 0.92);
  for (const x of [-0.5, -0.1]) k.cyl("woodDark", 0.025, 0.025, 0.34, 4, x, 0.04, 0.72);
  barrel(k, 0.55, 0.65);
  barrel(k, 0.75, 0.82, 0.9);
  if (t >= 3) k.add("canvas", new THREE.BoxGeometry(0.9, 0.03, 0.6), -0.3, 0.95, 0.72, 0, 0.2, 0);
  if (t >= 4)
    hall(k, {
      w: 0.7,
      d: 0.8,
      h: 0.9,
      x: -0.55,
      z: -0.25 - 0.25,
      wall: "plaster",
      roof: roofOf(t),
      roofH: 0.45,
      door: false,
      win: "glow",
    });
  if (t >= 5) k.ball("gold", 0.08, 0, top + 0.05, -0.25);
  lantern(k, 0.8, -0.85);
}

export function academy(k: Kit, t: number) {
  lot(k, 3);
  const wall: Mat = t >= 2 ? "stoneLight" : "plaster";
  const roof: Mat = t >= 5 ? "roofGold" : t >= 2 ? "roofBlue" : "roofRed";
  const top = hall(k, {
    w: 2.0,
    d: 1.3,
    h: 1.0 + t * 0.15,
    z: -0.45,
    wall,
    roof,
    roofH: 0.8,
    alongX: true,
    floors: t >= 3 ? 2 : 1,
    win: "glow",
  });
  // Säulen am Eingang
  for (let i = 0; i < 4; i++) k.cyl("marble", 0.06, 0.07, 0.8 + t * 0.1, 8, -0.6 + i * 0.4, 0.24, 0.3);
  k.box("marble", 1.5, 0.1, 0.3, 0, 0.24 + 0.8 + t * 0.1, 0.3);
  k.box("stoneLight", 1.7, 0.12, 0.5, 0, 0, 0.4);
  roundTower(k, 1.0, -0.95, 0.4, 1.8 + t * 0.35, roof, wall);
  if (t >= 3) {
    // Bücherstapel und Globus im Hof
    k.ball("crystal", 0.16, -0.95, 0.4, 0.95, 1, 1);
    k.cyl("metal", 0.03, 0.05, 0.3, 5, -0.95, 0.04, 0.95);
  }
  if (t >= 5) k.add("gold", new THREE.SphereGeometry(0.35, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, top - 0.1, -0.45);
  lantern(k, 1.2, 1.2);
  lantern(k, -1.2, 1.2);
}

export function chapel(k: Kit, t: number) {
  lot(k, 2);
  const wall: Mat = t >= 3 ? "stoneLight" : "stone";
  hall(k, {
    w: 1.0,
    d: 1.45,
    h: 0.9 + t * 0.12,
    z: -0.15,
    wall,
    roof: roofOf(Math.max(2, t)),
    roofH: 0.85,
    door: false,
    win: "glow",
  });
  // Glockenturm vorne mit Spitze
  const th = 1.5 + t * 0.25;
  k.box(wall, 0.55, th, 0.55, 0, 0, 0.6);
  k.box("dark", 0.22, 0.3, 0.04, 0, th - 0.45, 0.88);
  k.box("gold", 0.08, 0.1, 0.05, 0, th - 0.4, 0.9);
  k.pyramid(t >= 5 ? "roofGold" : roofOf(Math.max(2, t)), 0.7, 0.9 + t * 0.1, 0, th, 0.6);
  k.box("woodDark", 0.26, 0.5, 0.05, 0, 0, 0.89);
  // Kreuz-/Sternspitze
  const tip = th + 0.9 + t * 0.1;
  k.box("gold", 0.04, 0.3, 0.04, 0, tip, 0.6);
  k.box("gold", 0.18, 0.04, 0.04, 0, tip + 0.18, 0.6);
  // Rosenfenster
  k.cyl("glow", 0.12, 0.12, 0.03, 10, 0.52, 0.85, -0.15);
  if (t >= 4) {
    for (const z of [-0.6, 0.0]) k.box(wall, 0.12, 0.7, 0.12, 0.58, 0, z);
  }
  k.box("hedge", 0.5, 0.25, 0.18, -0.6, 0.04, 0.8);
}

export function storehouse(k: Kit, t: number) {
  lot(k, 3);
  hall(k, {
    w: 2.2,
    d: 1.5,
    h: 1.1 + t * 0.12,
    z: -0.5,
    wall: t >= 3 ? "plaster" : "wood",
    base: "stone",
    roof: roofOf(t),
    roofH: 0.8,
    alongX: true,
    timber: t >= 3,
    win: "dark",
    door: false,
  });
  // großes Tor
  k.box("woodDark", 0.7, 0.85, 0.06, 0, 0.24, 0.27);
  k.box("wood", 0.06, 0.85, 0.07, 0, 0.24, 0.28);
  // Kisten, Fässer, Säcke
  const stack: [number, number][] = [
    [-1.0, 0.7],
    [-0.72, 0.75],
    [-0.86, 0.95],
  ];
  stack.forEach(([x, z]) => crate(k, x, z));
  crate(k, -0.86, 0.75, 0.24, 0.3);
  for (let i = 0; i < Math.min(5, 1 + t); i++) barrel(k, 0.55 + (i % 3) * 0.3, 0.75 + Math.floor(i / 3) * 0.3);
  for (let i = 0; i < 3; i++) k.ball("wheat", 0.13, -0.2 + i * 0.22, 0.12, 0.95, 0.8);
  if (t >= 4) {
    // Lastkran
    k.cyl("trunk", 0.05, 0.06, 2.0, 5, 1.15, 0.04, -1.2);
    k.box("wood", 0.9, 0.07, 0.07, 0.8, 1.95, -1.2);
    k.cyl("metal", 0.01, 0.01, 0.8, 3, 0.4, 1.15, -1.2);
    crate(k, 0.4, -1.2, 0.22, 0.9);
  }
}

export function smithy(k: Kit, t: number) {
  lot(k, 2);
  // Rückwand und offenes Dach auf Pfosten
  k.box("stone", 1.6, 1.0 + t * 0.1, 0.25, 0, 0, -0.72);
  for (const x of [-0.75, 0.75]) k.cyl("trunk", 0.06, 0.07, 1.0 + t * 0.1, 6, x, 0, 0.35);
  k.add(roofOf(Math.max(2, t)), new THREE.BoxGeometry(1.75, 0.08, 1.35), 0, 1.05 + t * 0.1, -0.2, 0, -0.18, 0);
  // Esse mit Glut und hohem Schornstein
  k.box("stone", 0.6, 0.55, 0.5, -0.45, 0, -0.4);
  k.box("fire", 0.36, 0.06, 0.3, -0.45, 0.55, -0.4);
  k.box("stone", 0.32, 1.9 + t * 0.2, 0.32, -0.45, 0, -0.65);
  // Amboss, Hammer, Waffen
  k.box("trunk", 0.2, 0.25, 0.2, 0.3, 0, 0.1);
  k.box("metal", 0.32, 0.1, 0.14, 0.3, 0.25, 0.1);
  k.box("metal", 0.22, 0.06, 0.06, 0.3, 0.35, 0.1);
  for (let i = 0; i < 3; i++) k.cyl("metal", 0.02, 0.02, 0.6, 4, 0.45 + i * 0.12, 0.04, -0.55);
  barrel(k, 0.72, 0.72);
  if (t >= 3) k.box("water", 0.4, 0.12, 0.2, -0.2, 0.04, 0.6);
  if (t >= 4) k.box("fire", 0.1, 0.12, 0.1, -0.45, 1.9 + t * 0.2, -0.65);
}

export function stable(k: Kit, t: number) {
  lot(k, 3);
  hall(k, {
    w: 2.4,
    d: 0.95,
    h: 0.95 + t * 0.08,
    z: -0.9,
    wall: t >= 3 ? "plaster" : "wood",
    roof: roofOf(t),
    roofH: 0.6,
    alongX: true,
    timber: t >= 3,
    door: false,
    win: "dark",
  });
  // Boxentüren
  for (let i = 0; i < 4; i++) {
    k.box("woodDark", 0.36, 0.42, 0.05, -0.9 + i * 0.6, 0.24, -0.41);
    k.box("dark", 0.36, 0.3, 0.04, -0.9 + i * 0.6, 0.68, -0.42);
  }
  // Koppel mit Zaun
  const fence = (x1: number, z1: number, x2: number, z2: number) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const n = Math.round(len / 0.35);
    for (let i = 0; i <= n; i++)
      k.cyl("wood", 0.03, 0.03, 0.42, 4, x1 + ((x2 - x1) * i) / n, 0.04, z1 + ((z2 - z1) * i) / n);
    for (const y of [0.22, 0.38])
      k.box("wood", len, 0.04, 0.04, (x1 + x2) / 2, y, (z1 + z2) / 2, -Math.atan2(z2 - z1, x2 - x1));
  };
  fence(-1.3, -0.25, 1.3, -0.25);
  fence(-1.3, 1.3, 1.3, 1.3);
  fence(-1.3, -0.25, -1.3, 1.3);
  fence(1.3, -0.25, 1.3, 0.6);
  horse(k, -0.4, 0.5, 0.4);
  if (t >= 2) horse(k, 0.5, 0.75, -2.4, "woodDark");
  if (t >= 4) horse(k, 0.1, 0.1, 1.4, "canvas");
  hay(k, 1.0, 1.0);
  hay(k, 0.75, 1.05);
  k.box("water", 0.5, 0.1, 0.16, -0.9, 0.06, 1.05);
  k.box("wood", 0.56, 0.08, 0.22, -0.9, 0.0, 1.05);
}

export function fountain(k: Kit, t: number) {
  // runder Platz
  k.cyl("paving", 0.95, 0.95, 0.04, 20, 0, 0, 0);
  const stone: Mat = t >= 3 ? "marble" : "stoneLight";
  k.cyl(stone, 0.78, 0.82, 0.3, 20, 0, 0.04, 0);
  k.cyl("water", 0.68, 0.68, 0.04, 20, 0, 0.3, 0);
  k.cyl(stone, 0.1, 0.14, 0.6 + t * 0.06, 10, 0, 0.3, 0);
  k.cyl(stone, 0.32, 0.12, 0.1, 14, 0, 0.9 + t * 0.06, 0);
  k.cyl("water", 0.28, 0.28, 0.03, 14, 0, 0.99 + t * 0.06, 0);
  if (t >= 2) {
    k.cyl(stone, 0.06, 0.08, 0.35, 8, 0, 1.0 + t * 0.06, 0);
    k.cyl(stone, 0.16, 0.06, 0.06, 10, 0, 1.35 + t * 0.06, 0);
  }
  // Wasser fällt aus der oberen Schale ins Becken
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    k.cyl("water", 0.025, 0.025, 0.62 + t * 0.06, 4, Math.cos(a) * 0.3, 0.32, Math.sin(a) * 0.3);
  }
  if (t >= 4) k.ball(t >= 5 ? "gold" : "marble", 0.12, 0, 1.55 + t * 0.06, 0, 1.3, 1);
  for (const a of [0.8, 2.4, 3.9, 5.5]) k.box("hedge", 0.22, 0.18, 0.22, Math.cos(a) * 0.95, 0.04, Math.sin(a) * 0.95);
}

export function garden(k: Kit, t: number) {
  k.box("hedge", 1.85, 0.04, 1.85, 0, 0, 0);
  // Hecke rundum mit Eingang
  for (const [w, d, x, z] of [
    [1.85, 0.16, 0, -0.85],
    [0.16, 1.85, -0.85, 0],
    [0.16, 1.85, 0.85, 0],
    [0.65, 0.16, -0.6, 0.85],
    [0.65, 0.16, 0.6, 0.85],
  ] as const)
    k.box("hedge", w, 0.3, d, x, 0.04, z);
  // Wege und Beete
  k.box("paving", 0.3, 0.03, 1.5, 0, 0.04, 0.1);
  const petals: Mat[] = ["petalRed", "petalYellow", "petalPink"];
  for (const [i, [x, z]] of (
    [
      [-0.45, -0.4],
      [0.45, -0.4],
      [-0.45, 0.35],
      [0.45, 0.35],
    ] as const
  ).entries()) {
    k.box("soil", 0.5, 0.06, 0.5, x, 0.04, z);
    for (let j = 0; j < 6; j++)
      k.ball(petals[(i + j) % 3], 0.06, x - 0.15 + (j % 3) * 0.15, 0.14, z - 0.1 + Math.floor(j / 3) * 0.2);
  }
  // Bäumchen, Bank
  k.cyl("trunk", 0.04, 0.05, 0.5, 5, -0.65, 0.04, -0.65);
  k.ball("leaf", 0.25, -0.65, 0.68, -0.65, 1, 1);
  k.box("wood", 0.4, 0.05, 0.12, 0.55, 0.2, -0.65);
  if (t >= 3) {
    // Statue in der Mitte
    k.box("marble", 0.26, 0.2, 0.26, 0, 0.04, -0.05);
    k.cyl("marble", 0.07, 0.09, 0.42, 8, 0, 0.24, -0.05);
    k.ball(t >= 5 ? "gold" : "marble", 0.1, 0, 0.75, -0.05);
  }
  if (t >= 4) {
    // Pavillon
    for (const [x, z] of [
      [0.35, 0.3],
      [0.75, 0.3],
      [0.35, 0.7],
      [0.75, 0.7],
    ])
      k.cyl("marble", 0.03, 0.03, 0.7, 6, x, 0.04, z);
    k.cone(roofOf(t), 0.36, 0.35, 8, 0.55, 0.74, 0.5);
  }
}
