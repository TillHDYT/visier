/**
 * Datenmodell des Burg-Modus: Gebäude, Platzierungsregeln, Kosten und Stufen.
 * Reine Funktionen ohne DOM, damit sie testbar sind.
 */

export type BuildingKind = "castle" | "wall" | "tower" | "house";
export type WallSkin = "ice" | "fire" | "lava" | "gold";

export type Building = {
  id: number;
  kind: BuildingKind;
  /** Linke obere Kachel des Grundrisses. */
  x: number;
  y: number;
  level: number;
};

export type Castle = {
  v: 2;
  buildings: Building[];
  nextId: number;
  skin: WallSkin;
  owned: WallSkin[];
  boosters: number;
  /** Startpaket (einmalig 280 Gold) schon erhalten. */
  kit: boolean;
  /** Stufe des nächsten Angriffs; steigt mit jedem Sieg. */
  raid: number;
};

export const FIELD = 40;
export const MAX_LEVEL = 5;
export const SKIN_IDS: WallSkin[] = ["ice", "fire", "lava", "gold"];

export const KIND_NAME: Record<BuildingKind, string> = {
  castle: "Schloss",
  wall: "Mauer",
  tower: "Turm",
  house: "Haus",
};

/** Grundriss in Kacheln (quadratisch). */
export const SIZE: Record<BuildingKind, number> = { castle: 3, wall: 1, tower: 2, house: 2 };

/** Baupreis (Stufe 1). Das Schloss gibt es genau einmal. */
export const PLACE_COST: Record<Exclude<BuildingKind, "castle">, number> = { wall: 5, tower: 60, house: 40 };

/** Upgrade-Kosten auf Stufe 2…5 (Index 0 = auf Stufe 2). */
export const UPGRADE_COST: Record<BuildingKind, number[]> = {
  castle: [150, 400, 800, 1500],
  wall: [10, 25, 60, 120],
  tower: [80, 180, 350, 600],
  house: [60, 140, 280, 500],
};

export const LEVEL_TITLE: Record<BuildingKind, string[]> = {
  castle: ["Holzfeste", "Steinburg", "Wehrburg", "Königsburg", "Goldene Zitadelle"],
  wall: ["Grobe Mauer", "Steinmauer", "Zinnenmauer", "Eisenmauer", "Runenmauer"],
  tower: ["Wachposten", "Steinturm", "Bogenturm", "Kristallturm", "Sonnenturm"],
  house: ["Hütte", "Kate", "Fachwerkhaus", "Gutshaus", "Goldene Halle"],
};

/** Wie viele Gebäude einer Art die Schloss-Stufe erlaubt. */
export function limitFor(kind: BuildingKind, castleLevel: number): number {
  const l = Math.max(1, Math.min(MAX_LEVEL, castleLevel));
  if (kind === "castle") return 1;
  if (kind === "wall") return 25 * l;
  return l + 1;
}

export type Stats = { hp: number; dmg?: number; range?: number; rate?: number; defenders?: number };

/** Kampfwerte je Stufe. Türme profitieren zusätzlich von Booster-Packs (+10 % je Pack). */
export function statsFor(kind: BuildingKind, level: number, boosters = 0): Stats {
  const l = Math.max(1, Math.min(MAX_LEVEL, level));
  switch (kind) {
    case "wall":
      return { hp: [60, 120, 220, 360, 550][l - 1] };
    case "tower":
      return {
        hp: 120 * l,
        dmg: Math.round((6 + 6 * l) * (1 + 0.1 * boosters)),
        range: 4 + 0.5 * l,
        rate: [1, 1.15, 1.3, 1.5, 1.8][l - 1],
      };
    case "house":
      return { hp: 90 * l, defenders: l };
    case "castle":
      return { hp: 400 * l, dmg: 8 * l, range: 5, rate: 0.8 };
  }
}

export function castleLevel(c: Castle): number {
  return c.buildings.find((b) => b.kind === "castle")?.level ?? 1;
}

export function countOf(c: Castle, kind: BuildingKind): number {
  let n = 0;
  for (const b of c.buildings) if (b.kind === kind) n++;
  return n;
}

export function upgradeCost(b: Building): number | null {
  if (b.level >= MAX_LEVEL) return null;
  return UPGRADE_COST[b.kind][b.level - 1];
}

/** Warum ein Upgrade gerade nicht geht, oder null wenn es geht. */
export function upgradeBlock(c: Castle, b: Building, coins: number): string | null {
  const cost = upgradeCost(b);
  if (cost === null) return "Maximale Stufe";
  if (b.kind !== "castle" && b.level >= castleLevel(c)) return `Schloss Stufe ${b.level + 1} nötig`;
  if (coins < cost) return `Noch ${cost - coins} Gold`;
  return null;
}

/** Belegungsraster: Index y*FIELD+x → Gebäude-ID (0 = frei). */
export function occupancy(c: Castle, skipId = -1): Int32Array {
  const grid = new Int32Array(FIELD * FIELD);
  for (const b of c.buildings) {
    if (b.id === skipId) continue;
    const s = SIZE[b.kind];
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) grid[(b.y + dy) * FIELD + b.x + dx] = b.id;
  }
  return grid;
}

export function fits(grid: Int32Array, kind: BuildingKind, x: number, y: number): boolean {
  const s = SIZE[kind];
  if (x < 0 || y < 0 || x + s > FIELD || y + s > FIELD) return false;
  for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) if (grid[(y + dy) * FIELD + x + dx] !== 0) return false;
  return true;
}

/** Nächster freier Platz um (x, y), spiralförmig gesucht. */
export function freeSpotNear(
  grid: Int32Array,
  kind: BuildingKind,
  x: number,
  y: number,
): { x: number; y: number } | null {
  const s = SIZE[kind];
  const cx = Math.round(x - s / 2);
  const cy = Math.round(y - s / 2);
  for (let r = 0; r < FIELD; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (fits(grid, kind, cx + dx, cy + dy)) return { x: cx + dx, y: cy + dy };
      }
    }
  }
  return null;
}

export type Result = { castle: Castle; coins: number };

export function placeBlock(c: Castle, kind: BuildingKind, coins: number): string | null {
  if (kind === "castle") return "Das Schloss gibt es nur einmal";
  if (countOf(c, kind) >= limitFor(kind, castleLevel(c))) return `Limit erreicht – Schloss upgraden`;
  if (coins < PLACE_COST[kind]) return `${PLACE_COST[kind]} Gold nötig`;
  return null;
}

export function place(c: Castle, kind: BuildingKind, x: number, y: number, coins: number): Result | null {
  if (placeBlock(c, kind, coins) || kind === "castle") return null;
  if (!fits(occupancy(c), kind, x, y)) return null;
  const b: Building = { id: c.nextId, kind, x, y, level: 1 };
  return {
    castle: { ...c, buildings: [...c.buildings, b], nextId: c.nextId + 1 },
    coins: coins - PLACE_COST[kind],
  };
}

export function move(c: Castle, id: number, x: number, y: number): Castle | null {
  const b = c.buildings.find((it) => it.id === id);
  if (!b || (b.x === x && b.y === y)) return null;
  if (!fits(occupancy(c, id), b.kind, x, y)) return null;
  return { ...c, buildings: c.buildings.map((it) => (it.id === id ? { ...it, x, y } : it)) };
}

export function upgrade(c: Castle, id: number, coins: number): Result | null {
  const b = c.buildings.find((it) => it.id === id);
  if (!b || upgradeBlock(c, b, coins)) return null;
  const cost = upgradeCost(b)!;
  return {
    castle: { ...c, buildings: c.buildings.map((it) => (it.id === id ? { ...it, level: it.level + 1 } : it)) },
    coins: coins - cost,
  };
}

/** Upgradet so viele Mauern der gegebenen Stufe wie das Gold reicht. */
export function upgradeWalls(c: Castle, level: number, coins: number): Result & { count: number } {
  let castle = c;
  let left = coins;
  let count = 0;
  for (const b of c.buildings) {
    if (b.kind !== "wall" || b.level !== level) continue;
    const r = upgrade(castle, b.id, left);
    if (!r) break;
    castle = r.castle;
    left = r.coins;
    count++;
  }
  return { castle, coins: left, count };
}

export function wallsAt(c: Castle, level: number): { count: number; cost: number } {
  const count = c.buildings.filter((b) => b.kind === "wall" && b.level === level).length;
  return { count, cost: level < MAX_LEVEL ? UPGRADE_COST.wall[level - 1] : 0 };
}

export function removeWall(c: Castle, id: number): Castle | null {
  const b = c.buildings.find((it) => it.id === id);
  if (!b || b.kind !== "wall") return null;
  return { ...c, buildings: c.buildings.filter((it) => it.id !== id) };
}

/** Siegprämie eines Angriffs der gegebenen Stufe. */
export function raidReward(raid: number): number {
  return 30 + raid * 15;
}

const CENTER = Math.floor(FIELD / 2);

export function defaultCastle(): Castle {
  return {
    v: 2,
    buildings: [
      { id: 1, kind: "castle", x: CENTER - 1, y: CENTER - 1, level: 1 },
      { id: 2, kind: "tower", x: CENTER - 4, y: CENTER - 1, level: 1 },
      { id: 3, kind: "house", x: CENTER + 3, y: CENTER - 1, level: 1 },
    ],
    nextId: 4,
    skin: "ice",
    owned: ["ice"],
    boosters: 0,
    kit: false,
    raid: 1,
  };
}

function int(n: unknown, lo: number, hi: number, fallback: number) {
  return typeof n === "number" && Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.floor(n))) : fallback;
}

const KINDS: BuildingKind[] = ["castle", "wall", "tower", "house"];

/**
 * Liest einen gespeicherten Burg-Stand und repariert ihn. Alte Stände
 * (16×16-Raster als Zeichenkette) werden ins neue Format übertragen.
 */
export function readCastle(raw: unknown): Castle {
  const base = defaultCastle();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const owned = Array.isArray(r.owned) ? r.owned.filter((id): id is WallSkin => SKIN_IDS.includes(id as WallSkin)) : [];
  if (!owned.includes("ice")) owned.unshift("ice");
  const skin = owned.includes(r.skin as WallSkin) ? (r.skin as WallSkin) : "ice";
  const shared = {
    skin,
    owned,
    boosters: int(r.boosters, 0, 5, 0),
    kit: r.kit === true,
    raid: int(r.raid, 1, 999, 1),
  };

  const list: Omit<Building, "id">[] = [];
  if (r.v === 2 && Array.isArray(r.buildings)) {
    for (const it of r.buildings as Record<string, unknown>[]) {
      if (!it || !KINDS.includes(it.kind as BuildingKind)) continue;
      list.push({
        kind: it.kind as BuildingKind,
        x: int(it.x, 0, FIELD - 1, 0),
        y: int(it.y, 0, FIELD - 1, 0),
        level: int(it.level, 1, MAX_LEVEL, 1),
      });
    }
  } else if (typeof r.grid === "string") {
    list.push(...migrateGrid(r.grid, r));
  } else {
    return { ...base, ...shared };
  }

  // Neu einsortieren und dabei Überlappungen und ein fehlendes Schloss reparieren.
  let castle: Castle = { ...base, ...shared, buildings: [], nextId: 1 };
  const keep = list.find((b) => b.kind === "castle");
  const ordered = [keep ?? { kind: "castle" as const, x: CENTER - 1, y: CENTER - 1, level: 1 }].concat(
    list.filter((b) => b.kind !== "castle"),
  );
  for (const b of ordered) {
    const grid = occupancy(castle);
    const spot = fits(grid, b.kind, b.x, b.y) ? { x: b.x, y: b.y } : freeSpotNear(grid, b.kind, b.x, b.y);
    if (!spot) continue;
    castle = {
      ...castle,
      buildings: [...castle.buildings, { id: castle.nextId, kind: b.kind, x: spot.x, y: spot.y, level: b.level }],
      nextId: castle.nextId + 1,
    };
  }
  return castle;
}

/** Altes Format: 16×16 Zeichen, '1'-'3' Mauer, '4'-'6' Turm, '7'-'9' Haus; Schloss 3×3 bei cx/cy. */
function migrateGrid(grid: string, r: Record<string, unknown>): Omit<Building, "id">[] {
  const OLD = 16;
  const off = CENTER - 8;
  const out: Omit<Building, "id">[] = [
    {
      kind: "castle",
      x: int(r.cx, 0, OLD - 3, 6) + off,
      y: int(r.cy, 0, OLD - 3, 6) + off,
      level: int(r.keep, 1, MAX_LEVEL, 1),
    },
  ];
  if (grid.length !== OLD * OLD) return out;
  for (let i = 0; i < grid.length; i++) {
    const ch = grid[i];
    if (ch < "1" || ch > "9") continue;
    const n = Number(ch);
    const kind: BuildingKind = n <= 3 ? "wall" : n <= 6 ? "tower" : "house";
    const level = n <= 3 ? n : n <= 6 ? n - 3 : n - 6;
    out.push({ kind, x: (i % OLD) + off, y: Math.floor(i / OLD) + off, level });
  }
  return out;
}
