import type { EnemyKind, Sym, WeaponId } from "@/game/content";
import type { Meta } from "@/game/meta";
import type { Bonus } from "@/game/skills";

/** Pool-Größen. Die Spawn-Logik hält höchstens ~110 Gegner gleichzeitig. */
export const MAX_E = 512;
export const MAX_B = 640;
export const MAX_G = 460;
export const MAX_P = 300;
export const MAX_T = 80;
export const MAX_Z = 32;
export const MAX_F = 36;
export const CELL = 80;
export const HITN = 16;
export const STEP = 1 / 60;
export const INK = "#1a120c";
export const CREAM = "#fff6ea";
export const YELLOW = "#ffd000";
export const PINK = "#ff3d81";
export const DANGER = "#d0002b";
export const VISOR = "#2f6bff";

export type Mode = "menu" | "play" | "level" | "lucky" | "pause" | "dead" | "dying" | "armor";

export type Card = {
  key: string;
  name: string;
  desc: string;
  tone: "weapon" | "passive" | "evo" | "util";
  pips: number;
  pipsMax: number;
  badge: string;
  icon: string;
};

export type Hud = {
  time: number;
  hp: number;
  maxHp: number;
  xp: number;
  xpNeed: number;
  level: number;
  wave: string;
  waveN: number;
  kills: number;
  weapons: { id: string; star: number }[];
  passives: { id: string; star: number }[];
  boss: { name: string; hp: number; max: number; shield: number; maxShield: number } | null;
  moved: boolean;
  warning: string;
  gold: number;
  dragon: boolean;
};

export type Summary = {
  time: number;
  kills: number;
  level: number;
  coins: number;
  best: boolean;
  chapter: number;
  bosses: number;
  wallet: number;
  reviveCost: number;
  warriors: number;
};

export type LuckyPull = { symbols: Sym[]; title: string; detail: string };

export type GameHooks = {
  onMode: (mode: Mode, summary?: Summary) => void;
  onCards: (cards: Card[], rerolls: number) => void;
  onFrame: (hud: Hud) => void;
  onMeta: (meta: Meta) => void;
  /** Ein neues Glücksrad beginnt (auch direkt nach einem vorherigen). */
  onLuckyOpen: () => void;
};

export type GameHandle = {
  start: (chapter: number) => void;
  choose: (key: string) => void;
  reroll: () => void;
  pullLucky: () => LuckyPull | null;
  closeLucky: () => void;
  pause: () => void;
  resume: () => void;
  giveUp: () => void;
  toMenu: () => void;
  revive: () => void;
  sync: (meta: Meta) => void;
  prime: () => void;
  destroy: () => void;
  pickArmor: (kind: "fire" | "ice") => void;
  breath: (on: boolean) => void;
};

export type Wep = {
  id: string;
  base: WeaponId;
  star: number;
  evolved: boolean;
  cd: number;
  angle: number;
  perm: Bonus;
};

export type Enemy = {
  alive: boolean;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  r: number;
  speed: number;
  dmg: number;
  kind: EnemyKind;
  tier: 0 | 1 | 2 | 3;
  flash: number;
  wobble: number;
  atk: number;
  kx: number;
  ky: number;
  cdO: number;
  cdF: number;
  cdG: number;
  cdS: number;
  cdZ: number;
  cdH: number;
  shield: number;
  maxShield: number;
  variant: number;
  tele: number;
  teleKind: number;
  dashAng: number;
  markX: number;
  markY: number;
  slashId: number;
  xpKind: 0 | 1 | 2 | 3;
  coin: number;
  grade: 1 | 2 | 3 | 4;
  member: boolean;
  burn: number;
  burnDps: number;
  burnAcc: number;
  chill: number;
};

export type Bullet = {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  life: number;
  pierce: number;
  kind: "pellet" | "knife" | "slash" | "boom" | "ball" | "enemy" | "fire" | "ice";
  homing: number;
  speed: number;
  ang: number;
  age: number;
  returning: boolean;
  crit: boolean;
  gid: number;
};

export type Gem = {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  xp: number;
  kind: 0 | 1 | 2 | 3;
  magnet: boolean;
  r: number;
};

export type Bit = {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  s: number;
};

export type Floater = {
  alive: boolean;
  x: number;
  y: number;
  vy: number;
  life: number;
  text: string;
  tone: 0 | 1 | 2;
};

export type Zone = {
  alive: boolean;
  x: number;
  y: number;
  r: number;
  dmg: number;
  life: number;
  every: number;
  acc: number;
  fire: boolean;
};

export type Flash = { alive: boolean; x1: number; y1: number; x2: number; y2: number; life: number };

export type Shock = { alive: boolean; x: number; y: number; max: number; life: number; hue: number };

export type Offer = { card: Card; apply: () => void };

export function makeEnemy(): Enemy {
  return {
    alive: false,
    x: 0,
    y: 0,
    hp: 1,
    maxHp: 1,
    r: 14,
    speed: 60,
    dmg: 6,
    kind: "zombie",
    tier: 0,
    flash: 0,
    wobble: 0,
    atk: 1,
    kx: 0,
    ky: 0,
    cdO: 0,
    cdF: 0,
    cdG: 0,
    cdS: 0,
    cdZ: 0,
    cdH: 0,
    shield: 0,
    maxShield: 0,
    variant: 0,
    tele: 0,
    teleKind: 0,
    dashAng: 0,
    markX: 0,
    markY: 0,
    slashId: 0,
    xpKind: 0,
    coin: 0,
    grade: 1,
    member: false,
    burn: 0,
    burnDps: 0,
    burnAcc: 0,
    chill: 0,
  };
}

export function makeBullet(): Bullet {
  return {
    alive: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    r: 6,
    dmg: 1,
    life: 0,
    pierce: 1,
    kind: "pellet",
    homing: 0,
    speed: 400,
    ang: 0,
    age: 0,
    returning: false,
    crit: false,
    gid: 0,
  };
}
