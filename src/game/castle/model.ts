/**
 * Datenmodell des Königreichs: feste Stadtmauer, Gebäude mit Stufe 1–5,
 * Rohstoffe und passive Produktion. Reine Funktionen ohne DOM.
 */

export type BuildingKind = "castle" | "tower" | "house" | "field" | "farm" | "mine" | "coal" | "goldmine";
export type Resource = "gold" | "food" | "stone" | "coal";
export type WallSkin = "ice" | "fire" | "lava" | "gold";

export type Building = {
  id: number;
  kind: BuildingKind;
  /** Linke obere Kachel des Grundrisses. */
  x: number;
  y: number;
  level: number;
  /** Zeitpunkt der letzten Ernte (ms). Nur für Produktionsgebäude. */
  t?: number;
};

export type Stock = { food: number; stone: number; coal: number };

export type Castle = {
  v: 3;
  buildings: Building[];
  nextId: number;
  /** Stufe der festen Stadtmauer (1–5). */
  wall: number;
  res: Stock;
  skin: WallSkin;
  owned: WallSkin[];
  boosters: number;
  kit: boolean;
  raid: number;
};

export type Cost = Partial<Record<Resource, number>>;

/** Gesamtes Gelände in Kacheln; die Mauer umschließt den Innenbereich. */
export const WORLD = 48;
export const INNER0 = 6;
export const INNER1 = 42;
export const MAX_LEVEL = 5;
export const SKIN_IDS: WallSkin[] = ["ice", "fire", "lava", "gold"];
export const KINDS: BuildingKind[] = ["castle", "tower", "house", "field", "farm", "mine", "coal", "goldmine"];
/** Speicher der Produktionsgebäude in Stunden. */
export const STORE_HOURS = 8;

export const KIND_NAME: Record<BuildingKind, string> = {
  castle: "Schloss",
  tower: "Wachturm",
  house: "Wohnhaus",
  field: "Feld",
  farm: "Bauernhof",
  mine: "Steinbruch",
  coal: "Kohlewerk",
  goldmine: "Goldmine",
};

export const RES_NAME: Record<Resource, string> = { gold: "Gold", food: "Nahrung", stone: "Stein", coal: "Kohle" };

export const SIZE: Record<BuildingKind, number> = {
  castle: 4,
  tower: 2,
  house: 2,
  field: 3,
  farm: 3,
  mine: 3,
  coal: 3,
  goldmine: 3,
};

export const LEVEL_TITLE: Record<BuildingKind | "wall", string[]> = {
  castle: ["Holzfeste", "Steinburg", "Wehrburg", "Königsburg", "Goldene Zitadelle"],
  wall: ["Palisade", "Steinmauer", "Wehrmauer", "Festungsmauer", "Königsmauer"],
  tower: ["Holzturm", "Steinturm", "Bogenturm", "Kristallturm", "Sonnenturm"],
  house: ["Hütte", "Kate", "Fachwerkhaus", "Gutshaus", "Halle"],
  field: ["Acker", "Weizenfeld", "Goldfeld", "Großfeld", "Kornkammer"],
  farm: ["Scheune", "Hof", "Gutshof", "Mühlenhof", "Großgut"],
  mine: ["Geröll", "Steinbruch", "Tiefbruch", "Steinwerk", "Großsteinwerk"],
  coal: ["Meiler", "Köhlerei", "Kohlenhof", "Kohlewerk", "Hochofen"],
  goldmine: ["Schürfstelle", "Stollen", "Förderturm", "Goldwerk", "Goldene Mine"],
};

/** Was ein Gebäude pro Stunde erzeugt (Stufe 1–5). */
export const PRODUCTION: Partial<Record<BuildingKind, { res: Resource; perHour: number[] }>> = {
  field: { res: "food", perHour: [60, 100, 150, 210, 280] },
  farm: { res: "food", perHour: [120, 200, 300, 420, 560] },
  mine: { res: "stone", perHour: [80, 130, 190, 260, 340] },
  coal: { res: "coal", perHour: [50, 85, 125, 170, 220] },
  goldmine: { res: "gold", perHour: [40, 70, 110, 160, 220] },
};

/** Anzahl je Art abhängig von der Schloss-Stufe. */
export function limitFor(kind: BuildingKind, castleLevel: number): number {
  const l = Math.max(1, Math.min(MAX_LEVEL, castleLevel));
  switch (kind) {
    case "castle":
      return 1;
    case "tower":
      return l;
    case "house":
      return l + 1;
    case "field":
      return l + 2;
    case "farm":
    case "mine":
      return 1 + Math.floor(l / 2);
    case "coal":
      return Math.floor((l + 1) / 2);
    case "goldmine":
      return 1 + Math.floor((l - 1) / 2);
  }
}

const BASE: Record<BuildingKind | "wall", Required<Cost>> = {
  castle: { gold: 150, food: 300, stone: 200, coal: 100 },
  wall: { gold: 120, food: 0, stone: 300, coal: 120 },
  tower: { gold: 60, food: 50, stone: 80, coal: 40 },
  house: { gold: 40, food: 80, stone: 50, coal: 30 },
  field: { gold: 20, food: 0, stone: 30, coal: 20 },
  farm: { gold: 40, food: 60, stone: 50, coal: 30 },
  mine: { gold: 50, food: 100, stone: 20, coal: 30 },
  coal: { gold: 60, food: 120, stone: 60, coal: 0 },
  goldmine: { gold: 100, food: 150, stone: 100, coal: 50 },
};
const MULT = [1, 2, 4, 8, 15];

/** Preis für Stufe `level` (1 = Bau). Ab Stufe 2 Stein, ab Stufe 4 Kohle. */
export function costFor(kind: BuildingKind | "wall", level: number): Cost {
  const b = BASE[kind];
  const m = MULT[Math.max(1, Math.min(MAX_LEVEL, level)) - 1];
  const c: Cost = { gold: b.gold * m };
  if (b.food) c.food = b.food * m;
  if (level >= 2 && b.stone) c.stone = b.stone * m;
  if (level >= 4 && b.coal) c.coal = b.coal * m;
  return c;
}

export type Wallet = { gold: number } & Stock;

export function walletOf(c: Castle, coins: number): Wallet {
  return { gold: coins, ...c.res };
}

export function missing(cost: Cost, w: Wallet): Resource | null {
  for (const r of ["gold", "food", "stone", "coal"] as Resource[]) if ((cost[r] ?? 0) > w[r]) return r;
  return null;
}

function pay(c: Castle, coins: number, cost: Cost): { castle: Castle; coins: number } {
  return {
    castle: {
      ...c,
      res: {
        food: c.res.food - (cost.food ?? 0),
        stone: c.res.stone - (cost.stone ?? 0),
        coal: c.res.coal - (cost.coal ?? 0),
      },
    },
    coins: coins - (cost.gold ?? 0),
  };
}

export type Stats = { hp: number; dmg?: number; range?: number; rate?: number; defenders?: number };

export function statsFor(kind: BuildingKind | "wall", level: number, boosters = 0): Stats {
  const l = Math.max(1, Math.min(MAX_LEVEL, level));
  switch (kind) {
    case "wall":
      return { hp: [900, 1400, 2100, 3000, 4500][l - 1], dmg: 8 + 4 * l, range: 7, rate: 0.9 };
    case "tower":
      return {
        hp: 150 * l,
        dmg: Math.round((8 + 7 * l) * (1 + 0.1 * boosters)),
        range: 6 + 0.5 * l,
        rate: [1, 1.15, 1.3, 1.5, 1.8][l - 1],
      };
    case "castle":
      return { hp: 600 * l, dmg: 10 * l, range: 7, rate: 0.9 };
    case "house":
      return { hp: 100 * l, defenders: l };
    default:
      return { hp: 120 * l };
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

// ---------------------------------------------------------------------------
// Produktion

export function rateOf(b: Building): number {
  const p = PRODUCTION[b.kind];
  return p ? p.perHour[b.level - 1] : 0;
}

/** Bereit liegende Menge (gekappt auf STORE_HOURS). */
export function pending(b: Building, now: number): number {
  if (!PRODUCTION[b.kind] || b.t === undefined) return 0;
  const hours = Math.max(0, (now - b.t) / 3_600_000);
  return Math.floor(rateOf(b) * Math.min(STORE_HOURS, hours));
}

export function capacity(b: Building): number {
  return Math.floor(rateOf(b) * STORE_HOURS);
}

export type Harvest = { castle: Castle; coins: number; got: Partial<Record<Resource, number>> };

/** Erntet die angegebenen (oder alle) Produktionsgebäude. */
export function collect(c: Castle, coins: number, now: number, ids?: number[]): Harvest {
  const got: Partial<Record<Resource, number>> = {};
  const res = { ...c.res };
  let gold = coins;
  const buildings = c.buildings.map((b) => {
    if (ids && !ids.includes(b.id)) return b;
    const amount = pending(b, now);
    if (amount <= 0) return b;
    const r = PRODUCTION[b.kind]!.res;
    got[r] = (got[r] ?? 0) + amount;
    if (r === "gold") gold += amount;
    else res[r] += amount;
    return { ...b, t: now };
  });
  return { castle: { ...c, buildings, res }, coins: gold, got };
}

// ---------------------------------------------------------------------------
// Platzieren, Verschieben, Upgraden

export function inside(x: number, y: number, s: number) {
  return x >= INNER0 && y >= INNER0 && x + s <= INNER1 && y + s <= INNER1;
}

export function occupancy(c: Castle, skipId = -1): Int32Array {
  const grid = new Int32Array(WORLD * WORLD);
  for (const b of c.buildings) {
    if (b.id === skipId) continue;
    const s = SIZE[b.kind];
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) grid[(b.y + dy) * WORLD + b.x + dx] = b.id;
  }
  // Straße vom Tor zum Schloss freihalten
  for (const [x, y] of roadTiles()) grid[y * WORLD + x] = grid[y * WORLD + x] || -1;
  return grid;
}

/** Hauptstraße: vom Südtor bis vor das Schloss, zwei Kacheln breit. */
export const ROAD_END = 22;

export function roadTiles(): [number, number][] {
  const out: [number, number][] = [];
  const mid = WORLD / 2;
  for (let y = INNER1 - 1; y >= ROAD_END; y--) {
    out.push([mid - 1, y], [mid, y]);
  }
  return out;
}

export function fits(grid: Int32Array, kind: BuildingKind, x: number, y: number): boolean {
  const s = SIZE[kind];
  if (!inside(x, y, s)) return false;
  for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) if (grid[(y + dy) * WORLD + x + dx] !== 0) return false;
  return true;
}

export function freeSpotNear(
  grid: Int32Array,
  kind: BuildingKind,
  x: number,
  y: number,
): { x: number; y: number } | null {
  const s = SIZE[kind];
  const cx = Math.round(x - s / 2);
  const cy = Math.round(y - s / 2);
  for (let r = 0; r < WORLD; r++) {
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
  if (countOf(c, kind) >= limitFor(kind, castleLevel(c))) return "Limit erreicht – Schloss upgraden";
  const need = missing(costFor(kind, 1), walletOf(c, coins));
  if (need) return `Zu wenig ${RES_NAME[need]}`;
  return null;
}

export function place(
  c: Castle,
  kind: BuildingKind,
  x: number,
  y: number,
  coins: number,
  now = Date.now(),
): Result | null {
  if (placeBlock(c, kind, coins)) return null;
  if (!fits(occupancy(c), kind, x, y)) return null;
  const paid = pay(c, coins, costFor(kind, 1));
  const b: Building = { id: c.nextId, kind, x, y, level: 1 };
  if (PRODUCTION[kind]) b.t = now;
  return { castle: { ...paid.castle, buildings: [...c.buildings, b], nextId: c.nextId + 1 }, coins: paid.coins };
}

export function move(c: Castle, id: number, x: number, y: number): Castle | null {
  const b = c.buildings.find((it) => it.id === id);
  if (!b || (b.x === x && b.y === y)) return null;
  if (!fits(occupancy(c, id), b.kind, x, y)) return null;
  return { ...c, buildings: c.buildings.map((it) => (it.id === id ? { ...it, x, y } : it)) };
}

export function upgradeCost(b: Building): Cost | null {
  return b.level >= MAX_LEVEL ? null : costFor(b.kind, b.level + 1);
}

export function upgradeBlock(c: Castle, b: Building, coins: number): string | null {
  const cost = upgradeCost(b);
  if (!cost) return "Maximale Stufe";
  if (b.kind !== "castle" && b.level >= castleLevel(c)) return `Schloss Stufe ${b.level + 1} nötig`;
  const need = missing(cost, walletOf(c, coins));
  if (need) return `Zu wenig ${RES_NAME[need]}`;
  return null;
}

/** Upgrade; Produktionsgebäude werden vorher geerntet. */
export function upgrade(c: Castle, id: number, coins: number, now = Date.now()): Result | null {
  const b = c.buildings.find((it) => it.id === id);
  if (!b || upgradeBlock(c, b, coins)) return null;
  const h = collect(c, coins, now, [id]);
  const paid = pay(h.castle, h.coins, upgradeCost(b)!);
  return {
    castle: {
      ...paid.castle,
      buildings: paid.castle.buildings.map((it) => (it.id === id ? { ...it, level: it.level + 1 } : it)),
    },
    coins: paid.coins,
  };
}

export function wallUpgradeBlock(c: Castle, coins: number): string | null {
  if (c.wall >= MAX_LEVEL) return "Maximale Stufe";
  if (c.wall >= castleLevel(c)) return `Schloss Stufe ${c.wall + 1} nötig`;
  const need = missing(costFor("wall", c.wall + 1), walletOf(c, coins));
  if (need) return `Zu wenig ${RES_NAME[need]}`;
  return null;
}

export function upgradeWall(c: Castle, coins: number): Result | null {
  if (wallUpgradeBlock(c, coins)) return null;
  const paid = pay(c, coins, costFor("wall", c.wall + 1));
  return { castle: { ...paid.castle, wall: c.wall + 1 }, coins: paid.coins };
}

/** Siegprämie eines Angriffs. */
export function raidReward(raid: number): number {
  return 25 + raid * 10;
}

// ---------------------------------------------------------------------------
// Start und Speicherstand

const MID = WORLD / 2;

export function defaultCastle(now = Date.now()): Castle {
  return {
    v: 3,
    buildings: [
      { id: 1, kind: "castle", x: MID - 2, y: MID - 6, level: 1 },
      { id: 2, kind: "goldmine", x: MID + 5, y: MID - 9, level: 1, t: now },
      { id: 3, kind: "field", x: MID - 9, y: MID - 4, level: 1, t: now },
      { id: 4, kind: "house", x: MID + 4, y: MID - 2, level: 1 },
      { id: 5, kind: "tower", x: MID - 7, y: MID + 6, level: 1 },
    ],
    nextId: 6,
    wall: 1,
    res: { food: 600, stone: 400, coal: 100 },
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

type Seed = { kind: BuildingKind; x: number; y: number; level: number; t?: number };

/**
 * Liest und repariert einen gespeicherten Stand. Ältere Formate (frei
 * platzierbare Mauern, 16×16-Raster) werden übernommen: Gebäude ziehen ins
 * Innere, aus den alten Mauern wird die Stufe der festen Stadtmauer.
 */
export function readCastle(raw: unknown, now = Date.now()): Castle {
  const base = defaultCastle(now);
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

  let seeds: Seed[] = [];
  let wall = 1;
  let res = base.res;
  if (r.v === 3 && Array.isArray(r.buildings)) {
    for (const it of r.buildings as Record<string, unknown>[]) {
      if (!it || !KINDS.includes(it.kind as BuildingKind)) continue;
      seeds.push({
        kind: it.kind as BuildingKind,
        x: int(it.x, 0, WORLD - 1, 0),
        y: int(it.y, 0, WORLD - 1, 0),
        level: int(it.level, 1, MAX_LEVEL, 1),
        t: typeof it.t === "number" && Number.isFinite(it.t) ? Math.min(now, it.t) : undefined,
      });
    }
    wall = int(r.wall, 1, MAX_LEVEL, 1);
    const s = (r.res ?? {}) as Record<string, unknown>;
    res = { food: int(s.food, 0, 1e9, 0), stone: int(s.stone, 0, 1e9, 0), coal: int(s.coal, 0, 1e9, 0) };
  } else {
    const legacy =
      r.v === 2 && Array.isArray(r.buildings)
        ? legacyV2(r.buildings)
        : typeof r.grid === "string"
          ? legacyGrid(r)
          : null;
    if (!legacy) return { ...base, ...shared };
    const walls = legacy.filter((b) => b.kind === "wall");
    seeds = legacy.filter((b) => b.kind !== "wall") as Seed[];
    const keep = seeds.find((b) => b.kind === "castle");
    wall = Math.max(1, Math.min(keep?.level ?? 1, Math.max(1, ...walls.map((w) => w.level))));
    // Neuer Rohstoffvorrat und die Produktionsgebäude des Starts dazu
    for (const b of base.buildings) if (b.kind !== "castle" && b.kind !== "tower" && b.kind !== "house") seeds.push(b);
  }

  let castle: Castle = { ...base, ...shared, wall, res, buildings: [], nextId: 1 };
  const keep = seeds.find((b) => b.kind === "castle") ?? base.buildings[0];
  const ordered = [keep, ...seeds.filter((b) => b.kind !== "castle")];
  for (const b of ordered) {
    if (b.kind !== "castle" && countOf(castle, b.kind) >= limitFor(b.kind, castleLevel(castle))) continue;
    const grid = occupancy(castle);
    const spot = fits(grid, b.kind, b.x, b.y) ? { x: b.x, y: b.y } : freeSpotNear(grid, b.kind, b.x, b.y);
    if (!spot) continue;
    const nb: Building = { id: castle.nextId, kind: b.kind, x: spot.x, y: spot.y, level: b.level };
    if (PRODUCTION[b.kind]) nb.t = b.t ?? now;
    castle = { ...castle, buildings: [...castle.buildings, nb], nextId: castle.nextId + 1 };
  }
  return castle;
}

type Legacy = { kind: BuildingKind | "wall"; x: number; y: number; level: number };

function legacyV2(list: unknown[]): Legacy[] {
  const out: Legacy[] = [];
  for (const it of list as Record<string, unknown>[]) {
    if (!it || !["castle", "tower", "house", "wall"].includes(it.kind as string)) continue;
    out.push({
      kind: it.kind as Legacy["kind"],
      x: int(it.x, 0, 39, 0) + 4,
      y: int(it.y, 0, 39, 0) + 4,
      level: int(it.level, 1, MAX_LEVEL, 1),
    });
  }
  return out;
}

function legacyGrid(r: Record<string, unknown>): Legacy[] {
  const grid = r.grid as string;
  const OLD = 16;
  const off = MID - 8;
  const out: Legacy[] = [
    { kind: "castle", x: int(r.cx, 0, 13, 6) + off, y: int(r.cy, 0, 13, 6) + off, level: int(r.keep, 1, MAX_LEVEL, 1) },
  ];
  if (grid.length !== OLD * OLD) return out;
  for (let i = 0; i < grid.length; i++) {
    const ch = grid[i];
    if (ch < "1" || ch > "9") continue;
    const n = Number(ch);
    const kind = n <= 3 ? "wall" : n <= 6 ? "tower" : "house";
    out.push({ kind, x: (i % OLD) + off, y: Math.floor(i / OLD) + off, level: n <= 3 ? n : n <= 6 ? n - 3 : n - 6 });
  }
  return out;
}
