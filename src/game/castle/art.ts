/**
 * Optik des Burg-Modus. Alle Gebäude werden prozedural in isometrischer
 * Ansicht gemalt – je Art und Stufe einmal in ein Offscreen-Canvas, danach
 * nur noch kopiert. Jede Stufe bekommt mehr Höhe, Material und Details.
 */
import type { BuildingKind, WallSkin } from "./model";

/** Halbe Kachelbreite/-höhe in Pixeln (Zoom 1). */
export const HW = 32;
export const HH = 16;

type G = CanvasRenderingContext2D;
type Pal = { top: string; left: string; right: string };

const INK = "rgba(26,18,12,0.55)";

export function iso(tx: number, ty: number): [number, number] {
  return [(tx - ty) * HW, (tx + ty) * HH];
}

function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Farbe (#rrggbb) aufhellen (f > 0) oder abdunkeln (f < 0); Ergebnis wieder #rrggbb. */
export function shade(c: string, f: number) {
  const [r, g, b] = hex(c);
  const m = (v: number) => Math.max(0, Math.min(255, Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f))));
  return `#${((1 << 24) | (m(r) << 16) | (m(g) << 8) | m(b)).toString(16).slice(1)}`;
}

function pal(c: string): Pal {
  return { top: shade(c, 0.18), left: shade(c, -0.08), right: shade(c, -0.3) };
}

function poly(g: G, pts: [number, number][], fill: string, stroke = true) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  if (stroke) {
    g.strokeStyle = INK;
    g.lineWidth = 1.2;
    g.stroke();
  }
}

/** Punkt in Kachel-Koordinaten relativ zum Ursprung, auf Höhe z. */
function p(tx: number, ty: number, z: number): [number, number] {
  const [x, y] = iso(tx, ty);
  return [x, y - z];
}

/** Quader: Mitte (ox, oy), halbe Ausdehnung (ex, ey) in Kacheln, Boden z0, Höhe h. */
function box(g: G, ox: number, oy: number, ex: number, ey: number, z0: number, h: number, c: Pal | string) {
  const k = typeof c === "string" ? pal(c) : c;
  const z1 = z0 + h;
  poly(g, [p(ox - ex, oy + ey, z0), p(ox + ex, oy + ey, z0), p(ox + ex, oy + ey, z1), p(ox - ex, oy + ey, z1)], k.left);
  poly(
    g,
    [p(ox + ex, oy + ey, z0), p(ox + ex, oy - ey, z0), p(ox + ex, oy - ey, z1), p(ox + ex, oy + ey, z1)],
    k.right,
  );
  poly(g, [p(ox - ex, oy - ey, z1), p(ox + ex, oy - ey, z1), p(ox + ex, oy + ey, z1), p(ox - ex, oy + ey, z1)], k.top);
}

/** Pyramidendach über dem Rechteck (ex, ey) auf Höhe z0 mit Spitze apex darüber. */
function roof(g: G, ox: number, oy: number, ex: number, ey: number, z0: number, apex: number, c: string) {
  const k = pal(c);
  const top = p(ox, oy, z0 + apex);
  poly(g, [p(ox - ex, oy - ey, z0), p(ox + ex, oy - ey, z0), top], shade(c, 0.1));
  poly(g, [p(ox - ex, oy - ey, z0), p(ox - ex, oy + ey, z0), top], k.top);
  poly(g, [p(ox - ex, oy + ey, z0), p(ox + ex, oy + ey, z0), top], k.left);
  poly(g, [p(ox + ex, oy + ey, z0), p(ox + ex, oy - ey, z0), top], k.right);
}

/** Rechteck auf der linken (vorderen) Seitenfläche eines Quaders; u entlang der Kante, z Höhe. */
function onLeft(
  g: G,
  ox: number,
  oy: number,
  ex: number,
  ey: number,
  u0: number,
  u1: number,
  z0: number,
  z1: number,
  fill: string,
  stroke = false,
) {
  const x0 = ox - ex + 2 * ex * u0;
  const x1 = ox - ex + 2 * ex * u1;
  poly(g, [p(x0, oy + ey, z0), p(x1, oy + ey, z0), p(x1, oy + ey, z1), p(x0, oy + ey, z1)], fill, stroke);
}

function onRight(
  g: G,
  ox: number,
  oy: number,
  ex: number,
  ey: number,
  u0: number,
  u1: number,
  z0: number,
  z1: number,
  fill: string,
  stroke = false,
) {
  const y0 = oy + ey - 2 * ey * u0;
  const y1 = oy + ey - 2 * ey * u1;
  poly(g, [p(ox + ex, y0, z0), p(ox + ex, y1, z0), p(ox + ex, y1, z1), p(ox + ex, y0, z1)], fill, stroke);
}

/** Fenster auf beiden sichtbaren Seiten. */
function windows(
  g: G,
  ox: number,
  oy: number,
  ex: number,
  ey: number,
  n: number,
  z0: number,
  z1: number,
  fill: string,
) {
  for (let i = 0; i < n; i++) {
    const u0 = (i + 0.3) / n;
    const u1 = (i + 0.7) / n;
    onLeft(g, ox, oy, ex, ey, u0, u1, z0, z1, fill, true);
    onRight(g, ox, oy, ex, ey, u0, u1, z0, z1, fill, true);
  }
}

/** Zinnen entlang der beiden vorderen Oberkanten. */
function crenels(g: G, ox: number, oy: number, ex: number, ey: number, z: number, size: number, c: string) {
  const n = Math.max(2, Math.round((ex * 2) / (size * 2.4)));
  const s = size;
  for (let i = 0; i <= n; i++) {
    const t = -ex + (2 * ex * i) / n;
    box(g, ox + t, oy - ey + s, s, s, z, s * 9, c);
  }
  for (let i = 0; i <= n; i++) {
    const t = -ey + (2 * ey * i) / n;
    box(g, ox - ex + s, oy + t, s, s, z, s * 9, c);
  }
  for (let i = 0; i <= n; i++) {
    const t = -ex + (2 * ex * i) / n;
    box(g, ox + t, oy + ey - s, s, s, z, s * 9, c);
  }
  for (let i = 0; i <= n; i++) {
    const t = -ey + (2 * ey * i) / n;
    box(g, ox + ex - s, oy + t, s, s, z, s * 9, c);
  }
}

function flag(g: G, ox: number, oy: number, z: number, h: number, color: string) {
  const [x, y] = p(ox, oy, z);
  g.strokeStyle = "#3a2a1c";
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x, y - h);
  g.stroke();
  poly(
    g,
    [
      [x, y - h],
      [x + 14, y - h + 4],
      [x, y - h + 9],
    ],
    color,
  );
}

function banner(
  g: G,
  ox: number,
  oy: number,
  ex: number,
  ey: number,
  u: number,
  z: number,
  color: string,
  trim: string,
) {
  const x0 = ox - ex + 2 * ex * (u - 0.07);
  const x1 = ox - ex + 2 * ex * (u + 0.07);
  const a = p(x0, oy + ey, z);
  const b = p(x1, oy + ey, z);
  const c = p(x1, oy + ey, z - 22);
  const m = p((x0 + x1) / 2, oy + ey, z - 16);
  const d = p(x0, oy + ey, z - 22);
  poly(g, [a, b, c, m, d], color);
  g.strokeStyle = trim;
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(a[0], a[1] + 2);
  g.lineTo(b[0], b[1] + 2);
  g.stroke();
}

function glow(g: G, x: number, y: number, r: number, color: string, alpha = 0.6) {
  const [cr, cg, cb] = hex(color);
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, `rgba(${cr},${cg},${cb},${alpha})`);
  grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
  g.fillStyle = grad;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

function gem(g: G, x: number, y: number, r: number, color: string) {
  glow(g, x, y, r * 3, color, 0.55);
  poly(
    g,
    [
      [x, y - r * 1.6],
      [x + r, y],
      [x, y + r * 1.4],
      [x - r, y],
    ],
    color,
  );
  poly(
    g,
    [
      [x, y - r * 1.6],
      [x + r, y],
      [x, y],
    ],
    shade(color, 0.45),
    false,
  );
}

// ---------------------------------------------------------------------------
// Mauern

export const WALL_SKIN: Record<WallSkin, { base: string; accent: string }> = {
  ice: { base: "#9fd0ee", accent: "#46b8ff" },
  fire: { base: "#c45a32", accent: "#ffcc33" },
  lava: { base: "#4a3833", accent: "#ff6a12" },
  gold: { base: "#dcb04a", accent: "#fff3b0" },
};

const WALL_H = [12, 17, 21, 25, 29];
const WALL_E = 0.27;

function wallColor(skin: WallSkin, level: number) {
  const base = WALL_SKIN[skin].base;
  return level === 1 ? shade(base, -0.25) : level === 2 ? shade(base, -0.1) : base;
}

/** Ein Mauerpfeiler auf einer Kachel. */
function paintWallPost(g: G, level: number, skin: WallSkin) {
  const h = WALL_H[level - 1];
  const c = wallColor(skin, level);
  const e = WALL_E + (level >= 3 ? 0.04 : 0);
  box(g, 0, 0, e, e, 0, h, c);
  wallDetail(g, 0, 0, e, e, h, level, skin);
  if (level >= 2) box(g, 0, 0, e + 0.05, e + 0.05, h, 3, shade(c, 0.25));
  const top = h + (level >= 2 ? 3 : 0);
  if (level >= 3) box(g, 0, 0, 0.11, 0.11, top, 6, shade(c, 0.12));
  if (level >= 4) {
    const [x, y] = p(0, 0, top + 6);
    poly(
      g,
      [
        [x, y - 9],
        [x + 4, y],
        [x - 4, y],
      ],
      "#c9ced6",
    );
  }
  if (level >= 5) {
    const [x, y] = p(0, 0, top + 16);
    gem(g, x, y, 3.2, WALL_SKIN[skin].accent);
  }
}

/** Mauerstück zwischen zwei Pfeilern, entlang x (dir 0) oder y (dir 1). */
function paintWallLink(g: G, level: number, skin: WallSkin, dir: 0 | 1) {
  const h = WALL_H[level - 1] - 3;
  const c = wallColor(skin, level);
  const ex = dir === 0 ? 0.5 : 0.19;
  const ey = dir === 0 ? 0.19 : 0.5;
  box(g, 0, 0, ex, ey, 0, h, c);
  wallDetail(g, 0, 0, ex, ey, h, level, skin);
  if (level >= 3) {
    // Zinnen auf dem Mauerstück
    for (const t of [-0.25, 0.25]) {
      const ox = dir === 0 ? t : 0;
      const oy = dir === 0 ? 0 : t;
      box(g, ox, oy, 0.1, 0.1, h, 5, shade(c, 0.12));
    }
  }
}

function wallDetail(g: G, ox: number, oy: number, ex: number, ey: number, h: number, level: number, skin: WallSkin) {
  const c = wallColor(skin, level);
  if (level === 1) {
    onLeft(g, ox, oy, ex, ey, 0.2, 0.45, h * 0.3, h * 0.55, shade(c, -0.2));
    onRight(g, ox, oy, ex, ey, 0.5, 0.8, h * 0.5, h * 0.75, shade(c, -0.35));
  }
  if (level >= 3) {
    // Steinfugen
    const line = shade(c, -0.35);
    for (const z of [h * 0.33, h * 0.66]) {
      onLeft(g, ox, oy, ex, ey, 0, 1, z, z + 0.8, line);
      onRight(g, ox, oy, ex, ey, 0, 1, z, z + 0.8, shade(c, -0.5));
    }
  }
  if (level >= 4) {
    onLeft(g, ox, oy, ex, ey, 0, 1, h - 4, h - 1.5, "#5c6270");
    onRight(g, ox, oy, ex, ey, 0, 1, h - 4, h - 1.5, "#40444e");
    onLeft(g, ox, oy, ex, ey, 0, 1, 1.5, 4, "#5c6270");
    onRight(g, ox, oy, ex, ey, 0, 1, 1.5, 4, "#40444e");
  }
  if (level >= 5) {
    const a = WALL_SKIN[skin].accent;
    onLeft(g, ox, oy, ex, ey, 0.1, 0.9, h * 0.45, h * 0.55, a);
    onRight(g, ox, oy, ex, ey, 0.1, 0.9, h * 0.45, h * 0.55, shade(a, -0.15));
  }
}

// ---------------------------------------------------------------------------
// Türme (2×2)

function paintTower(g: G, level: number) {
  if (level === 1) {
    for (const [x, y] of [
      [-0.55, -0.55],
      [0.55, -0.55],
      [-0.55, 0.55],
      [0.55, 0.55],
    ] as const) {
      box(g, x, y, 0.08, 0.08, 0, 38, "#8a5a32");
    }
    box(g, 0, 0, 0.62, 0.08, 14, 3, "#6e4424");
    box(g, 0, 0, 0.72, 0.72, 36, 5, "#a8743f");
    box(g, 0, 0.62, 0.62, 0.06, 41, 7, "#8a5a32");
    box(g, 0.62, 0, 0.06, 0.62, 41, 7, "#7a4c28");
    roof(g, 0, 0, 0.62, 0.62, 52, 16, "#e2bc5a");
    return;
  }
  const spec = [
    null,
    { h: 60, e: 0.5, stone: "#a7a39b", roof: "#c8402a", apex: 26 },
    { h: 74, e: 0.52, stone: "#9c968c", roof: "#b83224", apex: 30 },
    { h: 88, e: 0.55, stone: "#c9c6c0", roof: "#2f5fb8", apex: 34 },
    { h: 100, e: 0.58, stone: "#4a4458", roof: "#e7b52c", apex: 38 },
  ][level - 1]!;
  const { h, e } = spec;
  box(g, 0, 0, e + 0.18, e + 0.18, 0, 6, shade(spec.stone, -0.2));
  box(g, 0, 0, e, e, 6, h - 6, spec.stone);
  // Steinfugen und Bänder
  for (let z = 18; z < h - 6; z += 14) {
    onLeft(g, 0, 0, e, e, 0, 1, z, z + 1, shade(spec.stone, -0.3));
    onRight(g, 0, 0, e, e, 0, 1, z, z + 1, shade(spec.stone, -0.45));
  }
  if (level >= 4) {
    const band = level === 5 ? "#e7b52c" : "#4f86e0";
    for (const z of [10, h - 10]) {
      onLeft(g, 0, 0, e, e, 0, 1, z, z + 3, band);
      onRight(g, 0, 0, e, e, 0, 1, z, z + 3, shade(band, -0.25));
    }
  }
  // Schießscharten / Fenster
  const slit = level >= 4 ? (level === 5 ? "#ffd75a" : "#9fd8ff") : "#2a1c14";
  onLeft(g, 0, 0, e, e, 0.42, 0.58, h * 0.45, h * 0.62, slit, true);
  onRight(g, 0, 0, e, e, 0.42, 0.58, h * 0.45, h * 0.62, slit, true);
  if (level >= 3) {
    onLeft(g, 0, 0, e, e, 0.42, 0.58, h * 0.2, h * 0.32, slit, true);
    onRight(g, 0, 0, e, e, 0.42, 0.58, h * 0.2, h * 0.32, slit, true);
  }
  // Wehrgang
  const deck = level >= 3 ? e + 0.12 : e + 0.06;
  box(g, 0, 0, deck, deck, h, 6, shade(spec.stone, 0.1));
  if (level >= 3) crenels(g, 0, 0, deck, deck, h + 6, 0.08, shade(spec.stone, 0.1));
  roof(g, 0, 0, deck - 0.06, deck - 0.06, h + (level >= 3 ? 10 : 6), spec.apex, spec.roof);
  const tip = h + (level >= 3 ? 10 : 6) + spec.apex;
  if (level === 3) flag(g, 0, 0, tip, 16, "#d0002b");
  if (level === 4) {
    const [x, y] = p(0, 0, tip + 12);
    gem(g, x, y, 6, "#6fd2ff");
  }
  if (level === 5) {
    const [x, y] = p(0, 0, tip + 14);
    glow(g, x, y, 26, "#ffb020", 0.65);
    g.beginPath();
    g.arc(x, y, 7, 0, Math.PI * 2);
    g.fillStyle = "#ffe27a";
    g.fill();
    g.strokeStyle = "#a8660a";
    g.lineWidth = 1.5;
    g.stroke();
  }
}

// ---------------------------------------------------------------------------
// Häuser (2×2)

function paintHouse(g: G, level: number) {
  const spec = [
    { e: 0.58, h: 18, wall: "#9a6a3c", roof: "#e3c062", apex: 20 },
    { e: 0.66, h: 24, wall: "#efe1c4", roof: "#c4472c", apex: 24 },
    { e: 0.72, h: 36, wall: "#f2e6cc", roof: "#9c3a22", apex: 26 },
    { e: 0.76, h: 40, wall: "#f4f1ea", roof: "#3463b5", apex: 30 },
    { e: 0.8, h: 46, wall: "#fbf8f0", roof: "#e5b12a", apex: 34 },
  ][level - 1];
  const { e, h } = spec;
  let z0 = 0;
  if (level >= 4) {
    box(g, 0, 0, e + 0.08, e + 0.08, 0, 7, level === 5 ? "#d9d4c8" : "#8f8a82");
    z0 = 7;
  }
  box(g, 0, 0, e, e, z0, h, spec.wall);
  if (level === 1) {
    // Holzbretter
    for (const u of [0.25, 0.5, 0.75]) {
      onLeft(g, 0, 0, e, e, u, u + 0.02, 0, h, shade(spec.wall, -0.3));
      onRight(g, 0, 0, e, e, u, u + 0.02, 0, h, shade(spec.wall, -0.45));
    }
  }
  if (level === 3) {
    // Fachwerk
    const beam = "#6b4226";
    for (const u of [0, 0.33, 0.66, 0.97]) {
      onLeft(g, 0, 0, e, e, u, u + 0.03, 0, h, beam);
      onRight(g, 0, 0, e, e, u, u + 0.03, 0, h, shade(beam, -0.2));
    }
    onLeft(g, 0, 0, e, e, 0, 1, h * 0.5, h * 0.5 + 2, beam);
    onRight(g, 0, 0, e, e, 0, 1, h * 0.5, h * 0.5 + 2, shade(beam, -0.2));
  }
  // Tür
  const door = level >= 4 ? "#5a2e1a" : "#4a2c18";
  onLeft(g, 0, 0, e, e, 0.4, 0.6, z0, z0 + Math.min(16, h * 0.6), door, true);
  // Fenster
  const lit = level >= 4 ? "#ffd75a" : "#8fc4e8";
  if (level >= 2) {
    onLeft(g, 0, 0, e, e, 0.12, 0.28, z0 + h * 0.35, z0 + h * 0.6, lit, true);
    onLeft(g, 0, 0, e, e, 0.72, 0.88, z0 + h * 0.35, z0 + h * 0.6, lit, true);
    onRight(g, 0, 0, e, e, 0.2, 0.4, z0 + h * 0.35, z0 + h * 0.6, lit, true);
    onRight(g, 0, 0, e, e, 0.6, 0.8, z0 + h * 0.35, z0 + h * 0.6, lit, true);
  }
  if (level >= 3) {
    onLeft(g, 0, 0, e, e, 0.12, 0.28, z0 + h * 0.72, z0 + h * 0.92, lit, true);
    onLeft(g, 0, 0, e, e, 0.72, 0.88, z0 + h * 0.72, z0 + h * 0.92, lit, true);
    onRight(g, 0, 0, e, e, 0.2, 0.4, z0 + h * 0.72, z0 + h * 0.92, lit, true);
    onRight(g, 0, 0, e, e, 0.6, 0.8, z0 + h * 0.72, z0 + h * 0.92, lit, true);
  }
  const top = z0 + h;
  if (level >= 2) box(g, -0.3, -0.3, 0.12, 0.12, top, spec.apex * 0.8, level >= 4 ? "#8f8a82" : "#8a5040");
  roof(g, 0, 0, e + 0.1, e + 0.1, top, spec.apex, spec.roof);
  if (level === 5) {
    const [x, y] = p(0, 0, top + spec.apex + 6);
    gem(g, x, y, 4, "#ffffff");
  }
  if (level >= 4) {
    banner(g, 0, 0, e, e, 0.15, top - 2, level === 5 ? "#7a2bb8" : "#d0002b", "#ffd000");
    if (level === 5) banner(g, 0, 0, e, e, 0.85, top - 2, "#7a2bb8", "#ffd000");
  }
}

// ---------------------------------------------------------------------------
// Schloss (3×3)

function paintCastle(g: G, level: number) {
  const stone = ["#8a5a32", "#a49f96", "#a39c90", "#c6c2ba", "#f2ede2"][level - 1];
  const roofC = ["#e3c062", "#c8402a", "#b83224", "#2f5fb8", "#e7b52c"][level - 1];
  const ring = 1.32;
  const ringH = [12, 18, 22, 26, 30][level - 1];

  // Ringmauer
  box(g, 0, 0, ring, ring, 0, ringH, stone);
  poly(
    g,
    [
      p(-ring + 0.18, -ring + 0.18, ringH),
      p(ring - 0.18, -ring + 0.18, ringH),
      p(ring - 0.18, ring - 0.18, ringH),
      p(-ring + 0.18, ring - 0.18, ringH),
    ],
    shade(stone, -0.35),
    false,
  );
  if (level === 1) {
    for (let i = 0; i < 9; i++) {
      const u = (i + 0.5) / 9;
      onLeft(g, 0, 0, ring, ring, u, u + 0.015, 0, ringH, shade(stone, -0.35));
      onRight(g, 0, 0, ring, ring, u, u + 0.015, 0, ringH, shade(stone, -0.5));
    }
  } else {
    crenels(g, 0, 0, ring, ring, ringH, 0.08, shade(stone, 0.08));
  }
  // Tor
  onLeft(g, 0, 0, ring, ring, 0.4, 0.6, 0, ringH * 0.75, "#2a1c14", true);
  if (level >= 4) onLeft(g, 0, 0, ring, ring, 0.38, 0.62, ringH * 0.75, ringH * 0.75 + 3, "#e7b52c");

  const corner = level >= 3;
  const towerH = [0, 0, 44, 56, 66][level - 1];
  const towerAt: [number, number][] = [
    [-1.1, -1.1],
    [-1.1, 1.1],
    [1.1, -1.1],
  ];
  if (corner) for (const [x, y] of towerAt) cornerTower(g, x, y, towerH, stone, roofC, level);
  if (level === 2) {
    box(g, -1.1, 1.1, 0.24, 0.24, 0, 32, stone);
    box(g, 1.1, -1.1, 0.24, 0.24, 0, 32, stone);
    roof(g, -1.1, 1.1, 0.26, 0.26, 32, 14, roofC);
    roof(g, 1.1, -1.1, 0.26, 0.26, 32, 14, roofC);
  }

  // Bergfried
  const ke = [0.55, 0.62, 0.66, 0.72, 0.76][level - 1];
  const kh = [40, 54, 62, 74, 86][level - 1];
  box(g, 0, 0, ke, ke, 0, kh, stone);
  windows(g, 0, 0, ke, ke, 2, kh * 0.55, kh * 0.7, level >= 4 ? "#ffd75a" : "#2a1c14");
  if (level >= 3) windows(g, 0, 0, ke, ke, 2, kh * 0.3, kh * 0.42, level >= 4 ? "#ffd75a" : "#2a1c14");
  if (level >= 4) {
    const band = level === 5 ? "#e7b52c" : "#4f86e0";
    onLeft(g, 0, 0, ke, ke, 0, 1, kh - 6, kh - 3, band);
    onRight(g, 0, 0, ke, ke, 0, 1, kh - 6, kh - 3, shade(band, -0.25));
  }
  if (level === 1) {
    roof(g, 0, 0, ke + 0.06, ke + 0.06, kh, 20, roofC);
    flag(g, 0, 0, kh + 20, 16, "#d0002b");
  } else {
    box(g, 0, 0, ke + 0.1, ke + 0.1, kh, 5, shade(stone, 0.1));
    crenels(g, 0, 0, ke + 0.1, ke + 0.1, kh + 5, 0.07, shade(stone, 0.1));
    roof(g, 0, 0, ke - 0.05, ke - 0.05, kh + 9, 24 + level * 3, roofC);
    flag(g, 0, 0, kh + 9 + 24 + level * 3, 18, level === 5 ? "#7a2bb8" : "#d0002b");
  }
  if (level >= 4) banner(g, 0, 0, ke, ke, 0.5, kh - 8, level === 5 ? "#7a2bb8" : "#d0002b", "#ffd000");
  if (level === 5) {
    const [x, y] = p(0, 0, kh + 9 + 24 + 15 + 22);
    gem(g, x - 6, y + 4, 5, "#fff3b0");
  }

  if (corner) cornerTower(g, 1.1, 1.1, towerH, stone, roofC, level);
}

function cornerTower(g: G, x: number, y: number, h: number, stone: string, roofC: string, level: number) {
  const e = 0.27;
  box(g, x, y, e, e, 0, h, stone);
  onLeft(g, x, y, e, e, 0.35, 0.65, h * 0.55, h * 0.72, level >= 4 ? "#ffd75a" : "#2a1c14", true);
  box(g, x, y, e + 0.05, e + 0.05, h, 4, shade(stone, 0.1));
  roof(g, x, y, e + 0.03, e + 0.03, h + 4, 18 + level * 2, roofC);
  if (level >= 4) flag(g, x, y, h + 4 + 18 + level * 2, 12, level === 5 ? "#7a2bb8" : "#d0002b");
}

// ---------------------------------------------------------------------------
// Sprite-Cache

export type Sprite = { img: HTMLCanvasElement; ax: number; ay: number; w: number; h: number };

const ABOVE: Record<BuildingKind, number> = { castle: 190, tower: 210, house: 120, wall: 70 };

function makeSprite(size: number, above: number, scale: number, paint: (g: G) => void): Sprite {
  const w = size * HW * 2 + 48;
  const h = above + size * HH * 2 + 20;
  const ax = w / 2;
  const ay = above + size * HH;
  const img = document.createElement("canvas");
  img.width = Math.ceil(w * scale);
  img.height = Math.ceil(h * scale);
  const g = img.getContext("2d")!;
  g.scale(scale, scale);
  g.translate(ax, ay);
  g.lineJoin = "round";
  paint(g);
  return { img, ax, ay, w, h };
}

export class CastleArt {
  private cache = new Map<string, Sprite>();
  private scale = 2;

  setScale(s: number) {
    if (Math.abs(s - this.scale) < 0.01) return;
    this.scale = s;
    this.cache.clear();
  }

  private get(key: string, make: () => Sprite) {
    let s = this.cache.get(key);
    if (!s) {
      s = make();
      this.cache.set(key, s);
    }
    return s;
  }

  building(kind: BuildingKind, level: number, skin: WallSkin): Sprite {
    const key = `${kind}|${level}|${kind === "wall" ? skin : ""}`;
    return this.get(key, () =>
      makeSprite(kind === "castle" ? 3 : kind === "wall" ? 1 : 2, ABOVE[kind], this.scale, (g) => {
        // Kacheln liegen bei 2×2/3×3 um die Mitte; Zeichnung ist auf die Mitte bezogen.
        if (kind === "wall") paintWallPost(g, level, skin);
        else if (kind === "tower") paintTower(g, level);
        else if (kind === "house") paintHouse(g, level);
        else paintCastle(g, level);
      }),
    );
  }

  wallLink(level: number, skin: WallSkin, dir: 0 | 1): Sprite {
    return this.get(`link|${level}|${skin}|${dir}`, () =>
      makeSprite(1, 60, this.scale, (g) => paintWallLink(g, level, skin, dir)),
    );
  }

  tree(variant: number): Sprite {
    return this.get(`tree|${variant}`, () =>
      makeSprite(1, 90, this.scale, (g) => {
        g.fillStyle = "rgba(20,40,10,0.25)";
        g.beginPath();
        g.ellipse(0, 2, 22, 10, 0, 0, Math.PI * 2);
        g.fill();
        box(g, 0, 0, 0.07, 0.07, 0, 14, "#6b4226");
        if (variant % 2 === 0) {
          const c = ["#2f7a3a", "#3c8c3f", "#2b6b35"][variant % 3];
          for (let i = 0; i < 3; i++) {
            const z = 12 + i * 15;
            const r = 24 - i * 6;
            const [x, y] = p(0, 0, z);
            poly(
              g,
              [
                [x, y - 26 + i * 2],
                [x + r, y],
                [x - r, y],
              ],
              shade(c, i * 0.06),
            );
          }
        } else {
          const c = ["#4a9a3c", "#5aa845", "#3f8a3a"][variant % 3];
          const [x, y] = p(0, 0, 30);
          for (const [dx, dy, r] of [
            [-8, 4, 14],
            [8, 4, 14],
            [0, -8, 16],
          ] as const) {
            g.beginPath();
            g.arc(x + dx, y + dy, r, 0, Math.PI * 2);
            g.fillStyle = shade(c, dy < 0 ? 0.12 : 0);
            g.fill();
            g.strokeStyle = INK;
            g.lineWidth = 1.2;
            g.stroke();
          }
        }
      }),
    );
  }

  rock(variant: number): Sprite {
    return this.get(`rock|${variant}`, () =>
      makeSprite(1, 30, this.scale, (g) => {
        const s = 0.18 + (variant % 3) * 0.06;
        box(g, 0, 0, s, s * 0.8, 0, 8 + (variant % 3) * 3, "#8d8a84");
        box(g, s * 0.6, s * 0.4, s * 0.5, s * 0.5, 0, 6, "#a19e97");
      }),
    );
  }

  /** Grasmuster, nahtlos kachelbar. */
  grass(light: boolean): HTMLCanvasElement {
    const key = `grass|${light}`;
    return this.get(key, () => {
      const N = 128;
      const img = document.createElement("canvas");
      img.width = N;
      img.height = N;
      const g = img.getContext("2d")!;
      g.fillStyle = light ? "#6fbe4e" : "#4f9a3c";
      g.fillRect(0, 0, N, N);
      let seed = light ? 7 : 3;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 520; i++) {
        const x = rnd() * N;
        const y = rnd() * N;
        const t = rnd();
        g.fillStyle = t < 0.5 ? (light ? "#7fcb5a" : "#5aa845") : light ? "#5fae44" : "#448a34";
        g.fillRect(x, y, 2, 3);
      }
      for (let i = 0; i < (light ? 10 : 4); i++) {
        g.fillStyle = ["#fff6ea", "#ffd84a", "#ff8fb0"][i % 3];
        g.fillRect(rnd() * N, rnd() * N, 2, 2);
      }
      return { img, ax: 0, ay: 0, w: N, h: N };
    }).img;
  }
}
