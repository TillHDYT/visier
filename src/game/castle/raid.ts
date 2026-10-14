/**
 * Angriff von außen. Gegner marschieren auf das Schloss zu und prallen an der
 * festen Stadtmauer ab; Mauertürme, Wachtürme und das Schloss schießen,
 * Wohnhäuser schicken Verteidiger an die Mauer. Bewusst nicht zu stark:
 * die Mauer soll Sicherheit vermitteln.
 */
import {
  INNER0,
  INNER1,
  SIZE,
  WORLD,
  castleLevel,
  occupancy,
  raidReward,
  statsFor,
  type Building,
  type Castle,
} from "./model";

export type FoeKind = "orc" | "runner" | "brute";

export type Foe = {
  kind: FoeKind;
  x: number;
  y: number;
  hp: number;
  max: number;
  speed: number;
  dmg: number;
  cd: number;
  alive: boolean;
  swing: number;
};

export type Guard = {
  x: number;
  y: number;
  hx: number;
  hy: number;
  hp: number;
  max: number;
  cd: number;
  alive: boolean;
  swing: number;
};

export type Shot = { x: number; y: number; z: number; foe: number; dmg: number; level: number; alive: boolean };

export type RaidEvent =
  | { type: "shot"; x: number; y: number }
  | { type: "hit"; x: number; y: number; wall: boolean }
  | { type: "breach"; seg: number }
  | { type: "wreck"; id: number }
  | { type: "foeDown"; x: number; y: number };

/** Mauerabschnitte: je Seite 9 Stücke à 4 Kacheln. */
export const SEG_PER_SIDE = (INNER1 - INNER0) / 4;

export type Raid = {
  level: number;
  time: number;
  foes: Foe[];
  guards: Guard[];
  shots: Shot[];
  queue: { at: number; kind: FoeKind; x: number; y: number }[];
  hp: Map<number, number>;
  max: Map<number, number>;
  seg: number[];
  segMax: number;
  cool: Map<string, number>;
  total: number;
  result: null | "win" | "lose";
  reward: number;
};

const FOE: Record<FoeKind, { hp: number; speed: number; dmg: number }> = {
  orc: { hp: 36, speed: 1.4, dmg: 10 },
  runner: { hp: 20, speed: 2.3, dmg: 6 },
  brute: { hp: 120, speed: 0.95, dmg: 26 },
};

function rnd(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Mauertürme: an den Ecken und alle 9 Kacheln entlang der Mauer, dazu zwei am Tor. */
export function wallTowers(): { key: string; x: number; y: number }[] {
  const a = INNER0 - 0.5;
  const b = INNER1 + 0.5;
  const out: { key: string; x: number; y: number }[] = [];
  const step = (INNER1 - INNER0) / 4;
  for (let i = 0; i <= 4; i++) {
    const t = a + i * step + (i === 4 ? 1 : 0);
    out.push({ key: `n${i}`, x: t, y: a }, { key: `s${i}`, x: t, y: b });
    if (i > 0 && i < 4) out.push({ key: `w${i}`, x: a, y: t }, { key: `e${i}`, x: b, y: t });
  }
  return out;
}

/** Welcher Mauerabschnitt liegt an (x, y)? -1, wenn keine Mauer. */
export function segmentAt(x: number, y: number): number {
  const lo = INNER0 - 1;
  const hi = INNER1;
  const inBand = (v: number, edge: number) => v >= edge && v < edge + 1;
  const along = (v: number) => Math.max(0, Math.min(SEG_PER_SIDE - 1, Math.floor((v - INNER0) / 4)));
  if (inBand(y, lo) && x >= lo && x < hi + 1) return along(x);
  if (inBand(x, hi) && y >= lo && y < hi + 1) return SEG_PER_SIDE + along(y);
  if (inBand(y, hi) && x >= lo && x < hi + 1) return 2 * SEG_PER_SIDE + along(x);
  if (inBand(x, lo) && y >= lo && y < hi + 1) return 3 * SEG_PER_SIDE + along(y);
  return -1;
}

/** Mitte eines Mauerabschnitts (für Effekte). */
export function segmentCenter(seg: number): { x: number; y: number } {
  const side = Math.floor(seg / SEG_PER_SIDE);
  const t = INNER0 + (seg % SEG_PER_SIDE) * 4 + 2;
  if (side === 0) return { x: t, y: INNER0 - 0.5 };
  if (side === 1) return { x: INNER1 + 0.5, y: t };
  if (side === 2) return { x: t, y: INNER1 + 0.5 };
  return { x: INNER0 - 0.5, y: t };
}

export function startRaid(castle: Castle, warriors: number, seed = Date.now()): Raid {
  const level = castle.raid;
  const r = rnd(seed);
  const count = Math.min(40, 4 + level * 2);
  const queue: Raid["queue"] = [];
  const sides = [Math.floor(r() * 4), Math.floor(r() * 4)];
  for (let i = 0; i < count; i++) {
    const side = sides[i % 2];
    const t = INNER0 + 4 + r() * (INNER1 - INNER0 - 8);
    const out = 8 + r() * 4;
    const pos =
      side === 0
        ? { x: t, y: INNER0 - out }
        : side === 1
          ? { x: INNER1 + out, y: t }
          : side === 2
            ? { x: t, y: INNER1 + out }
            : { x: INNER0 - out, y: t };
    const kind: FoeKind = level >= 4 && i % 6 === 5 ? "brute" : level >= 2 && i % 4 === 1 ? "runner" : "orc";
    queue.push({ at: (i / count) * Math.min(12, 3 + count * 0.4), kind, ...pos });
  }

  const hp = new Map<number, number>();
  const max = new Map<number, number>();
  for (const b of castle.buildings) {
    const s = statsFor(b.kind, b.level, castle.boosters);
    hp.set(b.id, s.hp);
    max.set(b.id, s.hp);
  }
  const segMax = statsFor("wall", castle.wall).hp;

  const guards: Guard[] = [];
  const clampIn = (v: number) => Math.max(INNER0 + 0.3, Math.min(INNER1 - 0.3, v));
  const addGuards = (b: Building, n: number, strength: number) => {
    const s = SIZE[b.kind];
    for (let i = 0; i < n; i++) {
      const a = (i / Math.max(1, n)) * Math.PI * 2;
      const hx = clampIn(b.x + s / 2 + Math.cos(a) * (s / 2 + 0.5));
      const hy = clampIn(b.y + s / 2 + Math.sin(a) * (s / 2 + 0.5));
      const m = 30 + strength * 12;
      guards.push({ x: hx, y: hy, hx, hy, hp: m, max: m, cd: 0, alive: true, swing: 0 });
    }
  };
  for (const b of castle.buildings) if (b.kind === "house") addGuards(b, b.level, b.level);
  // Kasernen stellen mehr und stärkere Verteidiger
  for (const b of castle.buildings)
    if (b.kind === "barracks") addGuards(b, statsFor("barracks", b.level).defenders ?? 2, b.level + 4);
  const keep = castle.buildings.find((b) => b.kind === "castle");
  if (keep) addGuards(keep, Math.min(12, warriors), castleLevel(castle));

  return {
    level,
    time: 0,
    foes: [],
    guards,
    shots: [],
    queue,
    hp,
    max,
    seg: Array.from({ length: SEG_PER_SIDE * 4 }, () => segMax),
    segMax,
    cool: new Map(),
    total: count,
    result: null,
    reward: raidReward(level),
  };
}

function centerOf(b: Building) {
  const s = SIZE[b.kind];
  return { x: b.x + s / 2, y: b.y + s / 2 };
}

function kill(f: Foe, out: RaidEvent[]) {
  if (!f.alive) return;
  f.alive = false;
  out.push({ type: "foeDown", x: f.x, y: f.y });
}

export function stepRaid(raid: Raid, castle: Castle, dt: number, out: RaidEvent[]): void {
  if (raid.result) return;
  raid.time += dt;
  const scale = 1 + (raid.level - 1) * 0.15;

  while (raid.queue.length && raid.queue[0].at <= raid.time) {
    const q = raid.queue.shift()!;
    const f = FOE[q.kind];
    raid.foes.push({
      kind: q.kind,
      x: q.x,
      y: q.y,
      hp: f.hp * scale,
      max: f.hp * scale,
      speed: f.speed,
      dmg: f.dmg * (1 + (raid.level - 1) * 0.1),
      cd: 0,
      alive: true,
      swing: 0,
    });
  }

  const keep = castle.buildings.find((b) => b.kind === "castle");
  const goal = keep ? centerOf(keep) : { x: WORLD / 2, y: WORLD / 2 };
  const live = castle.buildings.filter((b) => (raid.hp.get(b.id) ?? 0) > 0);
  const grid = occupancy({ ...castle, buildings: live });

  for (const f of raid.foes) {
    if (!f.alive) continue;
    f.cd -= dt;
    f.swing = Math.max(0, f.swing - dt);

    let guard: Guard | null = null;
    for (const g of raid.guards) {
      if (g.alive && Math.hypot(g.x - f.x, g.y - f.y) < 0.8) {
        guard = g;
        break;
      }
    }
    if (guard) {
      if (f.cd <= 0) {
        f.cd = 1;
        f.swing = 0.25;
        guard.hp -= f.dmg;
        if (guard.hp <= 0) guard.alive = false;
      }
      continue;
    }

    const dx = goal.x - f.x;
    const dy = goal.y - f.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = f.x + (dx / len) * f.speed * dt;
    const ny = f.y + (dy / len) * f.speed * dt;

    const seg = segmentAt(nx, ny);
    if (seg >= 0 && raid.seg[seg] > 0) {
      if (f.cd <= 0) {
        f.cd = 1;
        f.swing = 0.25;
        raid.seg[seg] -= f.dmg * (f.kind === "brute" ? 1.4 : 0.7);
        out.push({ type: "hit", x: nx, y: ny, wall: true });
        if (raid.seg[seg] <= 0) out.push({ type: "breach", seg });
      }
      continue;
    }
    const tx = Math.floor(nx);
    const ty = Math.floor(ny);
    const id = tx >= 0 && ty >= 0 && tx < WORLD && ty < WORLD ? grid[ty * WORLD + tx] : 0;
    if (id > 0) {
      if (f.cd <= 0) {
        f.cd = 1;
        f.swing = 0.25;
        const left = (raid.hp.get(id) ?? 0) - f.dmg;
        raid.hp.set(id, left);
        out.push({ type: "hit", x: nx, y: ny, wall: false });
        if (left <= 0) out.push({ type: "wreck", id });
      }
      continue;
    }
    f.x = nx;
    f.y = ny;
  }

  // Verteidiger bleiben innerhalb der Mauer
  for (const g of raid.guards) {
    if (!g.alive) continue;
    g.cd -= dt;
    g.swing = Math.max(0, g.swing - dt);
    let best: Foe | null = null;
    let bestD = 9;
    for (const f of raid.foes) {
      if (!f.alive) continue;
      const d = Math.hypot(f.x - g.x, f.y - g.y);
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    }
    if (best && bestD < 0.7) {
      if (g.cd <= 0) {
        g.cd = 0.8;
        g.swing = 0.25;
        best.hp -= 10 + g.max / 8;
        if (best.hp <= 0) kill(best, out);
      }
      continue;
    }
    const tx = Math.max(INNER0 + 0.3, Math.min(INNER1 - 0.3, best ? best.x : g.hx));
    const ty = Math.max(INNER0 + 0.3, Math.min(INNER1 - 0.3, best ? best.y : g.hy));
    const d = Math.hypot(tx - g.x, ty - g.y);
    if (d > 0.05) {
      const step = Math.min(d, 2.2 * dt);
      g.x += ((tx - g.x) / d) * step;
      g.y += ((ty - g.y) / d) * step;
    }
  }

  // Schützen: Mauertürme, Wachtürme, Schloss
  const wallStats = statsFor("wall", castle.wall);
  const shooters: {
    key: string;
    x: number;
    y: number;
    z: number;
    dmg: number;
    range: number;
    rate: number;
    level: number;
  }[] = [];
  for (const t of wallTowers())
    shooters.push({
      ...t,
      z: 3,
      dmg: wallStats.dmg!,
      range: wallStats.range!,
      rate: wallStats.rate!,
      level: castle.wall,
    });
  for (const b of live) {
    if (b.kind !== "tower" && b.kind !== "castle") continue;
    const s = statsFor(b.kind, b.level, castle.boosters);
    const c = centerOf(b);
    shooters.push({
      key: String(b.id),
      x: c.x,
      y: c.y,
      z: b.kind === "castle" ? 4 : 3.5,
      dmg: s.dmg!,
      range: s.range!,
      rate: s.rate!,
      level: b.level,
    });
  }
  for (const s of shooters) {
    const cool = (raid.cool.get(s.key) ?? 0) - dt;
    if (cool > 0) {
      raid.cool.set(s.key, cool);
      continue;
    }
    let best = -1;
    let bestD = s.range;
    for (let i = 0; i < raid.foes.length; i++) {
      const f = raid.foes[i];
      if (!f.alive) continue;
      const d = Math.hypot(f.x - s.x, f.y - s.y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best < 0) {
      raid.cool.set(s.key, 0);
      continue;
    }
    raid.cool.set(s.key, 1 / s.rate);
    raid.shots.push({ x: s.x, y: s.y, z: s.z, foe: best, dmg: s.dmg, level: s.level, alive: true });
    out.push({ type: "shot", x: s.x, y: s.y });
  }

  for (const sh of raid.shots) {
    if (!sh.alive) continue;
    const f = raid.foes[sh.foe];
    if (!f || !f.alive) {
      sh.alive = false;
      continue;
    }
    const dx = f.x - sh.x;
    const dy = f.y - sh.y;
    const d = Math.hypot(dx, dy);
    const step = 14 * dt;
    sh.z = Math.max(0.6, sh.z - dt * 4);
    if (d <= step) {
      sh.alive = false;
      f.hp -= sh.dmg;
      if (f.hp <= 0) kill(f, out);
    } else {
      sh.x += (dx / d) * step;
      sh.y += (dy / d) * step;
    }
  }
  if (raid.shots.length > 80) raid.shots = raid.shots.filter((s) => s.alive);

  if (keep && (raid.hp.get(keep.id) ?? 0) <= 0) raid.result = "lose";
  else if (!raid.queue.length && raid.foes.every((f) => !f.alive)) raid.result = "win";
}

export function foesLeft(raid: Raid) {
  return raid.queue.length + raid.foes.filter((f) => f.alive).length;
}
