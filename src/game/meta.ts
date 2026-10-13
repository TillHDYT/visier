import { ART } from "@/game/assets";

export type Slot = "helm" | "scarf" | "boots";
export type Rarity = 0 | 1 | 2 | 3;

export type GearItem = {
  slot: Slot;
  rarity: Rarity;
  value: number;
};

export type WallSkin = "ice" | "fire" | "lava" | "gold";

export type Castle = {
  wall: number;
  tower: number;
  keep: number;
  skin: WallSkin;
  owned: WallSkin[];
  boosters: number;
  grid: string;
  cx: number;
  cy: number;
  kit: boolean;
};

export type Meta = {
  v: 1;
  coins: number;
  ranks: { hp: number; dmg: number; spd: number; mag: number; start: number };
  gear: Record<Slot, GearItem | null>;
  gearRolls: number;
  best: [number, number, number];
  selectedChapter: number;
  mute: boolean;
  music: boolean;
  sfxOn: boolean;
  shake: boolean;
  runs: number;
  skills: Record<string, number>;
  warriors: number;
  castle: Castle;
};

const KEY = "visier-meta-v1";

export const RARITY_NAME = ["Gewöhnlich", "Selten", "Episch", "Legendär"] as const;
export const SLOT_NAME: Record<Slot, string> = {
  helm: "Helm",
  scarf: "Schal",
  boots: "Stiefel",
};

const RANK_MAX = { hp: 10, dmg: 10, spd: 10, mag: 8, start: 2 };

export const BUILD_MAX = 8;
export const WARRIOR_CAP = 12;
export const BOOSTER_CAP = 5;
export const BOOSTER_COST = 60;

export const SKIN_INFO: { id: WallSkin; name: string; cost: number; src: string }[] = [
  { id: "ice", name: "Eismauer", cost: 0, src: ART.wallIce },
  { id: "fire", name: "Feuermauer", cost: 80, src: ART.wallFire },
  { id: "lava", name: "Lavamauer", cost: 180, src: ART.wallLava },
  { id: "gold", name: "Goldmauer", cost: 320, src: ART.wallGold },
];

const SKIN_IDS: WallSkin[] = ["ice", "fire", "lava", "gold"];

export const GRID_W = 16;
export const GRID_H = 16;
export const CASTLE_C = 6;
export const CASTLE_R = 6;
export const CASTLE_S = 3;
export const PIECE_MAX = 3;

export const keepAt = { c: CASTLE_C, r: CASTLE_R };

export function castleCell(c: number, r: number) {
  return c >= keepAt.c && c < keepAt.c + CASTLE_S && r >= keepAt.r && r < keepAt.r + CASTLE_S;
}

export function emptyGrid() {
  return ".".repeat(GRID_W * GRID_H);
}

export type Plot = { kind: "wall" | "tower" | "house"; level: number };

const PLACE_CH: Record<Plot["kind"], string> = { wall: "123", tower: "456", house: "789" };

export function readPlots(grid: string): (Plot | null)[] {
  const src = grid.length === GRID_W * GRID_H ? grid : emptyGrid();
  const out: (Plot | null)[] = [];
  for (let i = 0; i < GRID_W * GRID_H; i++) {
    const ch = src[i] ?? ".";
    if (ch >= "1" && ch <= "3") out.push({ kind: "wall", level: Number(ch) });
    else if (ch >= "4" && ch <= "6") out.push({ kind: "tower", level: Number(ch) - 3 });
    else if (ch >= "7" && ch <= "9") out.push({ kind: "house", level: Number(ch) - 6 });
    else out.push(null);
  }
  return out;
}

export function writePlots(plots: (Plot | null)[]) {
  let s = "";
  for (let i = 0; i < GRID_W * GRID_H; i++) {
    const p = plots[i];
    if (!p) s += ".";
    else s += PLACE_CH[p.kind][p.level - 1] ?? ".";
  }
  return s;
}

export const PLACE_COST = { wall: 8, tower: 48, house: 32 } as const;

export function pieceUpgradeCost(kind: Plot["kind"], level: number) {
  if (kind === "wall") return 12 + level * 10;
  if (kind === "tower") return 30 + level * 22;
  return 22 + level * 16;
}

export function defaultCastle(): Castle {
  return {
    wall: 1,
    tower: 0,
    keep: 1,
    skin: "ice",
    owned: ["ice"],
    boosters: 0,
    grid: emptyGrid(),
    cx: CASTLE_C,
    cy: CASTLE_R,
    kit: false,
  };
}

export function wallCost(level: number) {
  return 35 + level * 28;
}
export function towerCost(level: number) {
  return 45 + level * 32;
}
export function keepCost(level: number) {
  return 55 + level * 36;
}

export function recruitsFromRun(have: number, kills: number) {
  const gain = Math.min(2, Math.floor(kills / 30));
  return Math.min(gain, Math.max(0, WARRIOR_CAP - have));
}

function readCastle(raw: unknown): Castle {
  const base = defaultCastle();
  if (!raw || typeof raw !== "object") return base;
  const c = raw as Partial<Castle>;
  const owned = Array.isArray(c.owned)
    ? c.owned.filter((id): id is WallSkin => SKIN_IDS.includes(id as WallSkin))
    : base.owned;
  if (!owned.includes("ice")) owned.unshift("ice");
  const skin =
    SKIN_IDS.includes(c.skin as WallSkin) && owned.includes(c.skin as WallSkin) ? (c.skin as WallSkin) : "ice";
  return {
    wall: clampInt(c.wall, BUILD_MAX) || 1,
    tower: clampInt(c.tower, BUILD_MAX),
    keep: clampInt(c.keep, BUILD_MAX) || 1,
    skin,
    owned,
    boosters: clampInt(c.boosters, BOOSTER_CAP),
    grid: typeof c.grid === "string" && c.grid.length === GRID_W * GRID_H ? c.grid : emptyGrid(),
    cx: clampKeep(c.cx),
    cy: clampKeep(c.cy),
    kit: c.kit === true,
  };
}

const GEAR_TABLE: Record<Slot, number[]> = {
  helm: [16, 30, 52, 84],
  scarf: [0.06, 0.12, 0.2, 0.34],
  boots: [0.04, 0.08, 0.14, 0.22],
};

export function defaultMeta(): Meta {
  return {
    v: 1,
    coins: 0,
    ranks: { hp: 0, dmg: 0, spd: 0, mag: 0, start: 0 },
    gear: { helm: null, scarf: null, boots: null },
    gearRolls: 0,
    best: [0, 0, 0],
    selectedChapter: 1,
    mute: false,
    music: true,
    sfxOn: true,
    shake: true,
    runs: 0,
    skills: {},
    warriors: 0,
    castle: defaultCastle(),
  };
}

function clampKeep(n: unknown) {
  const max = GRID_W - CASTLE_S;
  if (typeof n !== "number" || !Number.isFinite(n)) return CASTLE_C;
  return Math.min(max, Math.max(0, Math.floor(n)));
}

function clampInt(n: unknown, max: number): number {
  const v = typeof n === "number" ? n : 0;
  if (!Number.isFinite(v) || v < 0) return 0;
  return Math.min(max, Math.floor(v));
}

export function loadMeta(): Meta {
  const base = defaultMeta();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const p = JSON.parse(raw) as Partial<Meta>;
    if (!p || p.v !== 1) return base;
    const best = Array.isArray(p.best) ? p.best : [0, 0, 0];
    const gear = { ...base.gear };
    const slots: Slot[] = ["helm", "scarf", "boots"];
    for (const s of slots) {
      const g = p.gear?.[s];
      if (g && (g.rarity === 0 || g.rarity === 1 || g.rarity === 2 || g.rarity === 3)) {
        gear[s] = {
          slot: s,
          rarity: g.rarity,
          value: GEAR_TABLE[s][g.rarity],
        };
      }
    }
    return {
      v: 1,
      coins: clampInt(p.coins, 999999),
      ranks: {
        hp: clampInt(p.ranks?.hp, RANK_MAX.hp),
        dmg: clampInt(p.ranks?.dmg, RANK_MAX.dmg),
        spd: clampInt(p.ranks?.spd, RANK_MAX.spd),
        mag: clampInt(p.ranks?.mag, RANK_MAX.mag),
        start: clampInt(p.ranks?.start, RANK_MAX.start),
      },
      gear,
      gearRolls: clampInt(p.gearRolls, 999),
      best: [Number(best[0]) || 0, Number(best[1]) || 0, Number(best[2]) || 0],
      selectedChapter: clampInt(p.selectedChapter, 3) || 1,
      mute: Boolean(p.mute),
      music: typeof p.music === "boolean" ? p.music : !p.mute,
      sfxOn: typeof p.sfxOn === "boolean" ? p.sfxOn : !p.mute,
      shake: p.shake !== false,
      runs: clampInt(p.runs, 99999),
      skills: readSkills(p.skills),
      warriors: clampInt(p.warriors, WARRIOR_CAP),
      castle: readCastle(p.castle),
    };
  } catch {
    return base;
  }
}

export function saveMeta(m: Meta) {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* storage blocked (private mode): keep playing without saving */
  }
}

export function rankCost(rank: number): number {
  return 25 + rank * 30;
}

export const SKILL_CAP = 5;

export function skillCost(rank: number): number {
  return 70 + rank * 80;
}

export function buySkill(m: Meta, id: string): Meta | null {
  const rank = m.skills[id] ?? 0;
  if (rank >= SKILL_CAP) return null;
  const cost = skillCost(rank);
  if (m.coins < cost) return null;
  return {
    ...m,
    coins: m.coins - cost,
    skills: { ...m.skills, [id]: rank + 1 },
  };
}

function readSkills(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    out[key] = clampInt(value, SKILL_CAP);
  }
  return out;
}

export function buySkin(m: Meta, id: WallSkin): Meta | null {
  const info = SKIN_INFO.find((s) => s.id === id);
  if (!info || m.castle.owned.includes(id)) return null;
  if (m.coins < info.cost) return null;
  return {
    ...m,
    coins: m.coins - info.cost,
    castle: { ...m.castle, owned: [...m.castle.owned, id], skin: id },
  };
}

export function equipSkin(m: Meta, id: WallSkin): Meta | null {
  if (!m.castle.owned.includes(id) || m.castle.skin === id) return null;
  return { ...m, castle: { ...m.castle, skin: id } };
}

export function buyBooster(m: Meta): Meta | null {
  if (m.castle.boosters >= BOOSTER_CAP || m.coins < BOOSTER_COST) return null;
  return {
    ...m,
    coins: m.coins - BOOSTER_COST,
    castle: { ...m.castle, boosters: m.castle.boosters + 1 },
  };
}

export function buyBuild(m: Meta, part: "wall" | "tower" | "keep"): Meta | null {
  const level = m.castle[part];
  if (level >= BUILD_MAX) return null;
  const cost = part === "wall" ? wallCost(level) : part === "tower" ? towerCost(level) : keepCost(level);
  if (m.coins < cost) return null;
  return {
    ...m,
    coins: m.coins - cost,
    castle: { ...m.castle, [part]: level + 1 },
  };
}

export function gearCost(rolls: number): number {
  return 40 + rolls * 18;
}

export function chapterUnlocked(m: Meta, id: number): boolean {
  if (id <= 1) return true;
  if (id === 2) return m.best[0] >= 240;
  if (id === 3) return m.best[1] >= 480;
  return false;
}

export type Bonuses = {
  hp: number;
  dmg: number;
  spd: number;
  mag: number;
  startStars: number;
};

export function bonuses(m: Meta): Bonuses {
  const helm = m.gear.helm?.value ?? 0;
  const scarf = m.gear.scarf?.value ?? 0;
  const boots = m.gear.boots?.value ?? 0;
  return {
    hp: m.ranks.hp * 18 + helm,
    dmg: m.ranks.dmg * 0.06 + scarf,
    spd: m.ranks.spd * 0.035 + boots,
    mag: m.ranks.mag * 16,
    startStars: 1 + m.ranks.start,
  };
}

export function buyRank(m: Meta, key: keyof Meta["ranks"]): Meta | null {
  const rank = m.ranks[key];
  if (rank >= RANK_MAX[key]) return null;
  const cost = rankCost(rank);
  if (m.coins < cost) return null;
  return {
    ...m,
    coins: m.coins - cost,
    ranks: { ...m.ranks, [key]: rank + 1 },
  };
}

/**
 * Würfelt ein Ausrüstungsteil. Ein schlechteres oder gleich gutes Teil ersetzt
 * das vorhandene nicht; dann gibt es 20 % des Preises zurück.
 */
export function rollGear(m: Meta): Meta | null {
  const cost = gearCost(m.gearRolls);
  if (m.coins < cost) return null;
  const slots: Slot[] = ["helm", "scarf", "boots"];
  const slot = slots[Math.floor(Math.random() * slots.length)];
  const bag: Rarity[] = [0, 0, 0, 0, 0, 1, 1, 1, 2, 2, 3];
  const rarity = bag[Math.floor(Math.random() * bag.length)];
  const have = m.gear[slot];
  const upgrade = !have || rarity > have.rarity;
  return {
    ...m,
    coins: m.coins - cost + (upgrade ? 0 : Math.floor(cost * 0.2)),
    gearRolls: m.gearRolls + 1,
    gear: upgrade ? { ...m.gear, [slot]: { slot, rarity, value: GEAR_TABLE[slot][rarity] } } : m.gear,
  };
}

export function gearLine(item: GearItem | null): string {
  if (!item) return "Leer";
  if (item.slot === "helm") return `+${Math.round(item.value)} HP`;
  return `+${Math.round(item.value * 100)}%`;
}

export const RANK_MAX_PUBLIC = RANK_MAX;
