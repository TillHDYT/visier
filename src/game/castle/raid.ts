/**
 * Angriff auf die Burg. Gegner laufen auf Gebäude zu, Mauern halten sie auf,
 * Türme und Schloss schießen, Häuser stellen Verteidiger. Reine Simulation
 * in Kachel-Koordinaten; gezeichnet wird in scene.ts.
 */
import { FIELD, SIZE, castleLevel, occupancy, raidReward, statsFor, type Building, type Castle } from "./model";

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
  target: number;
  alive: boolean;
  /** Schlägt gerade zu (für die Animation). */
  swing: number;
  face: number;
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

export type Shot = { x: number; y: number; foe: number; dmg: number; splash: number; level: number; alive: boolean };

export type RaidEvent =
  | { type: "shot"; x: number; y: number }
  | { type: "hit"; x: number; y: number; big: boolean }
  | { type: "wreck"; id: number }
  | { type: "foeDown"; x: number; y: number };

export type Raid = {
  level: number;
  time: number;
  foes: Foe[];
  guards: Guard[];
  shots: Shot[];
  queue: { at: number; kind: FoeKind; x: number; y: number }[];
  hp: Map<number, number>;
  max: Map<number, number>;
  cool: Map<number, number>;
  total: number;
  result: null | "win" | "lose";
  reward: number;
};

const FOE: Record<FoeKind, { hp: number; speed: number; dmg: number }> = {
  orc: { hp: 40, speed: 1.5, dmg: 10 },
  runner: { hp: 22, speed: 2.5, dmg: 6 },
  brute: { hp: 150, speed: 1, dmg: 28 },
};

function rnd(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export function startRaid(castle: Castle, warriors: number, seed = Date.now()): Raid {
  const level = castle.raid;
  const r = rnd(seed);
  const count = Math.min(60, 5 + level * 3);
  const queue: Raid["queue"] = [];
  // Zwei Angriffsseiten, damit Mauern an mehreren Stellen gefragt sind.
  const sides = [Math.floor(r() * 4), Math.floor(r() * 4)];
  for (let i = 0; i < count; i++) {
    const side = sides[i % 2];
    const t = 0.15 + r() * 0.7;
    const out = -1.5 - r() * 2;
    const pos =
      side === 0
        ? { x: t * FIELD, y: out }
        : side === 1
          ? { x: FIELD - out, y: t * FIELD }
          : side === 2
            ? { x: t * FIELD, y: FIELD - out }
            : { x: out, y: t * FIELD };
    const kind: FoeKind = level >= 3 && i % 5 === 4 ? "brute" : level >= 2 && i % 4 === 1 ? "runner" : "orc";
    queue.push({ at: (i / count) * Math.min(14, 4 + count * 0.4), kind, ...pos });
  }

  const hp = new Map<number, number>();
  const max = new Map<number, number>();
  for (const b of castle.buildings) {
    const s = statsFor(b.kind, b.level, castle.boosters);
    hp.set(b.id, s.hp);
    max.set(b.id, s.hp);
  }

  const guards: Guard[] = [];
  const addGuard = (b: Building, n: number, strength: number) => {
    const s = SIZE[b.kind];
    for (let i = 0; i < n; i++) {
      const a = (i / Math.max(1, n)) * Math.PI * 2;
      const hx = b.x + s / 2 + Math.cos(a) * (s / 2 + 0.4);
      const hy = b.y + s / 2 + Math.sin(a) * (s / 2 + 0.4);
      const m = 30 + strength * 12;
      guards.push({ x: hx, y: hy, hx, hy, hp: m, max: m, cd: 0, alive: true, swing: 0 });
    }
  };
  for (const b of castle.buildings) if (b.kind === "house") addGuard(b, b.level, b.level);
  const keep = castle.buildings.find((b) => b.kind === "castle");
  if (keep) addGuard(keep, Math.min(12, warriors), castleLevel(castle));

  return {
    level,
    time: 0,
    foes: [],
    guards,
    shots: [],
    queue,
    hp,
    max,
    cool: new Map(),
    total: count,
    result: null,
    reward: raidReward(level),
  };
}

function center(b: Building) {
  const s = SIZE[b.kind];
  return { x: b.x + s / 2, y: b.y + s / 2 };
}

function alive(raid: Raid, id: number) {
  return (raid.hp.get(id) ?? 0) > 0;
}

/** Ein Simulationsschritt. Liefert Ereignisse für Effekte und Töne. */
export function stepRaid(raid: Raid, castle: Castle, dt: number, out: RaidEvent[]): void {
  if (raid.result) return;
  raid.time += dt;
  const scale = 1 + (raid.level - 1) * 0.22;

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
      dmg: f.dmg * (1 + (raid.level - 1) * 0.12),
      cd: 0,
      target: -1,
      alive: true,
      swing: 0,
      face: 1,
    });
  }

  const byId = new Map(castle.buildings.map((b) => [b.id, b]));
  const grid = occupancy({ ...castle, buildings: castle.buildings.filter((b) => alive(raid, b.id)) });
  const at = (x: number, y: number) => {
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= FIELD || ty >= FIELD) return 0;
    return grid[ty * FIELD + tx];
  };

  const damage = (id: number, amount: number) => {
    const left = (raid.hp.get(id) ?? 0) - amount;
    raid.hp.set(id, left);
    if (left <= 0) out.push({ type: "wreck", id });
  };

  // Gegner
  for (const f of raid.foes) {
    if (!f.alive) continue;
    f.cd -= dt;
    f.swing = Math.max(0, f.swing - dt);

    // Verteidiger in Reichweite werden zuerst angegriffen.
    let guard: Guard | null = null;
    for (const g of raid.guards) {
      if (g.alive && Math.hypot(g.x - f.x, g.y - f.y) < 0.7) {
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

    if (f.target < 0 || !alive(raid, f.target)) {
      let best = -1;
      let bestD = Infinity;
      for (const b of castle.buildings) {
        if (b.kind === "wall" || !alive(raid, b.id)) continue;
        const c = center(b);
        const d = Math.hypot(c.x - f.x, c.y - f.y);
        if (d < bestD) {
          bestD = d;
          best = b.id;
        }
      }
      f.target = best;
    }
    const target = byId.get(f.target);
    if (!target) continue;
    const c = center(target);
    const dx = c.x - f.x;
    const dy = c.y - f.y;
    const len = Math.hypot(dx, dy) || 1;
    f.face = dx - dy >= 0 ? 1 : -1;
    const nx = f.x + (dx / len) * f.speed * dt;
    const ny = f.y + (dy / len) * f.speed * dt;
    const block = at(nx, ny);
    if (block) {
      // Steht etwas im Weg: draufhauen (Mauer, Ziel oder anderes Gebäude).
      if (f.cd <= 0) {
        const wall = byId.get(block)?.kind === "wall";
        f.cd = 1;
        f.swing = 0.25;
        damage(block, f.dmg * (f.kind === "brute" && wall ? 2 : 1));
        out.push({ type: "hit", x: nx, y: ny, big: f.kind === "brute" });
      }
    } else {
      f.x = nx;
      f.y = ny;
    }
  }

  // Verteidiger
  for (const g of raid.guards) {
    if (!g.alive) continue;
    g.cd -= dt;
    g.swing = Math.max(0, g.swing - dt);
    let best: Foe | null = null;
    let bestD = 7;
    for (const f of raid.foes) {
      if (!f.alive || Math.hypot(f.x - g.hx, f.y - g.hy) > 7) continue;
      const d = Math.hypot(f.x - g.x, f.y - g.y);
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    }
    const tx = best ? best.x : g.hx;
    const ty = best ? best.y : g.hy;
    const d = Math.hypot(tx - g.x, ty - g.y);
    if (best && d < 0.6) {
      if (g.cd <= 0) {
        g.cd = 0.8;
        g.swing = 0.25;
        best.hp -= 9 + g.max / 8;
        if (best.hp <= 0) kill(best, out);
      }
    } else if (d > 0.05) {
      const step = Math.min(d, 2.2 * dt);
      g.x += ((tx - g.x) / d) * step;
      g.y += ((ty - g.y) / d) * step;
    }
  }

  // Türme und Schloss
  for (const b of castle.buildings) {
    if ((b.kind !== "tower" && b.kind !== "castle") || !alive(raid, b.id)) continue;
    const s = statsFor(b.kind, b.level, castle.boosters);
    const cool = (raid.cool.get(b.id) ?? 0) - dt;
    if (cool > 0) {
      raid.cool.set(b.id, cool);
      continue;
    }
    const c = center(b);
    let best = -1;
    let bestD = s.range!;
    raid.foes.forEach((f, i) => {
      if (!f.alive) return;
      const d = Math.hypot(f.x - c.x, f.y - c.y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best < 0) {
      raid.cool.set(b.id, 0);
      continue;
    }
    raid.cool.set(b.id, 1 / s.rate!);
    raid.shots.push({
      x: c.x,
      y: c.y,
      foe: best,
      dmg: s.dmg!,
      splash: b.kind === "tower" && b.level >= 5 ? 1.1 : 0,
      level: b.kind === "castle" ? 3 : b.level,
      alive: true,
    });
    out.push({ type: "shot", x: c.x, y: c.y });
  }

  // Geschosse
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
    const step = 11 * dt;
    if (d <= step) {
      sh.alive = false;
      if (sh.splash > 0) {
        for (const o of raid.foes) {
          if (o.alive && Math.hypot(o.x - f.x, o.y - f.y) <= sh.splash) {
            o.hp -= sh.dmg;
            if (o.hp <= 0) kill(o, out);
          }
        }
      } else {
        f.hp -= sh.dmg;
        if (f.hp <= 0) kill(f, out);
      }
      out.push({ type: "hit", x: f.x, y: f.y, big: sh.splash > 0 });
    } else {
      sh.x += (dx / d) * step;
      sh.y += (dy / d) * step;
    }
  }
  if (raid.shots.length > 64) raid.shots = raid.shots.filter((s) => s.alive);

  const keep = castle.buildings.find((b) => b.kind === "castle");
  if (keep && !alive(raid, keep.id)) raid.result = "lose";
  else if (!raid.queue.length && raid.foes.every((f) => !f.alive)) raid.result = "win";
}

function kill(f: Foe, out: RaidEvent[]) {
  if (!f.alive) return;
  f.alive = false;
  out.push({ type: "foeDown", x: f.x, y: f.y });
}

export function foesLeft(raid: Raid) {
  return raid.queue.length + raid.foes.filter((f) => f.alive).length;
}
