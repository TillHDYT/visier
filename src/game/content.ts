export type EnemyKind = "zombie" | "bug" | "mutant" | "robot";
export type WeaponId =
  | "staff"
  | "katana"
  | "shotgun"
  | "kunai"
  | "guardian"
  | "force"
  | "molotov"
  | "lightning"
  | "drones"
  | "boomerang"
  | "soccer"
  | "tank";
export type PassiveId =
  | "boots"
  | "glove"
  | "chrono"
  | "magnet"
  | "heart"
  | "lens"
  | "blood"
  | "ammo"
  | "scroll"
  | "scope"
  | "plate"
  | "purse";
export type EvoId =
  | "demon"
  | "gatling"
  | "shuriken"
  | "starwheel"
  | "aegis"
  | "inferno"
  | "storm"
  | "titan"
  | "magnetboom"
  | "comet"
  | "ufo";
export type AnyId = WeaponId | PassiveId | EvoId | "heal" | "coins" | "adrenaline";

export type Info = {
  name: string;
  short: string;
  desc: string;
  tone: "weapon" | "passive" | "evo";
};

export const INFO: Record<string, Info> = {
  staff: {
    name: "Stab",
    short: "STAB",
    desc: "Rote Feuerkugeln aus dem Stab. Ab Stufe 3: Sauron-Keule mit Feuerwellen und blauer Schockwelle.",
    tone: "weapon",
  },
  mace: {
    name: "Sauron-Keule",
    short: "KEULE",
    desc: "Geschwungene Feuerwellen nach vorn und eine blaue Schockwelle.",
    tone: "evo",
  },
  katana: {
    name: "Katana",
    short: "KAT",
    desc: "Jede Stufe eine weitere Klinge plus Wellen. Stufe 5: Dämonenklinge.",
    tone: "weapon",
  },
  shotgun: {
    name: "Schrotflinte",
    short: "SCH",
    desc: "Mehr Stufen, mehr Pellets, kürzere Pause. Stufe 5: Gatling-Kanone.",
    tone: "weapon",
  },
  kunai: {
    name: "Kunai",
    short: "KUN",
    desc: "Jede Stufe ein weiteres Messer. Stufe 5: Geister-Shuriken.",
    tone: "weapon",
  },
  guardian: {
    name: "Abwehrrad",
    short: "RAD",
    desc: "Jede Stufe ein weiteres Rad im Orbit. Stufe 5: riesiges Sternrad.",
    tone: "weapon",
  },
  force: {
    name: "Kraftfeld",
    short: "FLD",
    desc: "Ring wächst mit jeder Stufe. Stufe 5: Aegis, ein harter Schutzschild.",
    tone: "weapon",
  },
  molotov: {
    name: "Molotow",
    short: "MOL",
    desc: "Brandflächen, ab Stufe 3 ein zweiter Wurf. Stufe 5: Feuersturm.",
    tone: "weapon",
  },
  lightning: {
    name: "Blitzspule",
    short: "BLI",
    desc: "Jede Stufe ein weiterer Kettensprung. Stufe 5: Kettensturm.",
    tone: "weapon",
  },
  drones: {
    name: "Drohnen",
    short: "DRO",
    desc: "1 bis 4 Drohnen. Die fünfte Stufe wird zur Super-Drohne.",
    tone: "weapon",
  },
  boomerang: {
    name: "Bumerang",
    short: "BUM",
    desc: "Jede Stufe ein weiterer Bumerang. Stufe 5: Magnet-Bumerang.",
    tone: "weapon",
  },
  soccer: {
    name: "Fußball",
    short: "BALL",
    desc: "Jede Stufe ein weiterer Ball. Stufe 5: Kometenball.",
    tone: "weapon",
  },
  tank: {
    name: "Panzer",
    short: "PAN",
    desc: "Ab Minute 8 sehr selten, ab Minute 10 etwas öfter. Dreimal gewählt wird er zum UFO.",
    tone: "weapon",
  },
  demon: {
    name: "Dämonenklinge",
    short: "DÄM",
    desc: "Evolution der Katana. Riesige Klingen, und Treffer heilen dich.",
    tone: "evo",
  },
  gatling: {
    name: "Gatling-Kanone",
    short: "GAT",
    desc: "Evolution der Schrotflinte. Dauerfeuer, mehrere Läufe, Auto-Ziel.",
    tone: "evo",
  },
  shuriken: {
    name: "Geister-Shuriken",
    short: "SHU",
    desc: "Evolution der Kunai. Sehr schnell, groß, hoher Durchschlag.",
    tone: "evo",
  },
  starwheel: {
    name: "Sternrad",
    short: "RAD",
    desc: "Evolution des Abwehrrads. Ein riesiges Rad mit massivem Flächenschaden.",
    tone: "evo",
  },
  aegis: {
    name: "Aegis",
    short: "AEG",
    desc: "Evolution des Kraftfelds. Viel größer, härtere Pulse.",
    tone: "evo",
  },
  inferno: {
    name: "Feuersturm",
    short: "FEU",
    desc: "Evolution des Molotows. Eine riesige Brandzone.",
    tone: "evo",
  },
  storm: {
    name: "Kettensturm",
    short: "STU",
    desc: "Evolution der Blitzspule. Viele Sprünge, viel mehr Schaden.",
    tone: "evo",
  },
  titan: {
    name: "Super-Drohne",
    short: "SUP",
    desc: "Evolution der Drohnen. Eine riesige Drohne mit mehr Schüssen.",
    tone: "evo",
  },
  magnetboom: {
    name: "Magnet-Bumerang",
    short: "MAG",
    desc: "Evolution des Bumerangs. Groß, magnetisch, schneidet härter.",
    tone: "evo",
  },
  comet: {
    name: "Kometenball",
    short: "KOM",
    desc: "Evolution des Fußballs. Ein riesiger, schneller Ball.",
    tone: "evo",
  },
  ufo: {
    name: "UFO",
    short: "UFO",
    desc: "Der Panzer wird zur Superwaffe. Breiter Strahl, aber nicht mehr unsterblich.",
    tone: "evo",
  },
  boots: {
    name: "Sprintsohlen",
    short: "SPD",
    desc: "Bewegungstempo +8% pro Stern.",
    tone: "passive",
  },
  glove: {
    name: "Powerhandschuh",
    short: "DMG",
    desc: "Schaden +12% pro Stern.",
    tone: "passive",
  },
  chrono: {
    name: "Chrono-Chip",
    short: "CD",
    desc: "Abklingzeiten −8% pro Stern.",
    tone: "passive",
  },
  magnet: {
    name: "Magnetkern",
    short: "MAG",
    desc: "XP-Kristalle werden aus größerer Distanz gezogen.",
    tone: "passive",
  },
  heart: {
    name: "Vitalherz",
    short: "HP",
    desc: "Maximale HP +25 pro Stern, und du wirst sofort geheilt.",
    tone: "passive",
  },
  lens: {
    name: "Sprengradius",
    short: "AOE",
    desc: "Wirkungsradius +12% pro Stern.",
    tone: "passive",
  },
  blood: {
    name: "Blutjuwel",
    short: "BLUT",
    desc: "Krit und Lebensraub. Stapelt sich, unabhängig von der Evolution.",
    tone: "passive",
  },
  ammo: {
    name: "Munitionsgurt",
    short: "AMMO",
    desc: "Mehr Projektile. Stapelt sich bis Stufe 5.",
    tone: "passive",
  },
  scroll: {
    name: "Ninja-Rolle",
    short: "ROL",
    desc: "Mehr Durchschlag. Stapelt sich bis Stufe 5.",
    tone: "passive",
  },
  scope: {
    name: "Zielfernrohr",
    short: "KRIT",
    desc: "Kritische Treffer +6% pro Stern.",
    tone: "passive",
  },
  plate: {
    name: "Panzerplatte",
    short: "RÜS",
    desc: "Erlittener Schaden −6% pro Stern.",
    tone: "passive",
  },
  purse: {
    name: "Glücksmünze",
    short: "XP",
    desc: "Mehr XP aus jedem Kristall, +8% pro Stern.",
    tone: "passive",
  },
};

export const WEAPON_IDS: WeaponId[] = [
  "staff",
  "katana",
  "shotgun",
  "kunai",
  "guardian",
  "force",
  "molotov",
  "lightning",
  "drones",
  "boomerang",
  "soccer",
  "tank",
];

export const PASSIVE_IDS: PassiveId[] = [
  "boots",
  "glove",
  "chrono",
  "magnet",
  "heart",
  "lens",
  "blood",
  "ammo",
  "scroll",
  "scope",
  "plate",
  "purse",
];

export const ENEMY_BASE: Record<
  EnemyKind,
  { hp: number; speed: number; r: number; dmg: number; xp: number; color: string }
> = {
  zombie: { hp: 14, speed: 68, r: 15, dmg: 6, xp: 1, color: "#3dce6a" },
  bug: { hp: 11, speed: 122, r: 12, dmg: 5, xp: 1, color: "#ffe14a" },
  mutant: { hp: 40, speed: 50, r: 20, dmg: 10, xp: 3, color: "#c86bff" },
  robot: { hp: 32, speed: 66, r: 16, dmg: 8, xp: 2, color: "#3ec6ff" },
};

export type Wave = {
  name: string;
  until: number;
  interval: number;
  maxAlive: number;
  hp: number;
  types: EnemyKind[];
  eliteEvery: number;
  hordeEvery: number;
  burst: number;
  /** Gleichzeitige Stufe-2-Normals (ohne Elite/Boss). */
  g2: number;
  /** Gleichzeitige Stufe-3-Normals. */
  g3: number;
  /** Gleichzeitige rote Stufe 4. */
  g4: number;
};

export const WAVES: Wave[] = [
  {
    name: "Aufwärmen",
    until: 110,
    interval: 0.38,
    maxAlive: 26,
    hp: 1,
    types: ["zombie"],
    eliteEvery: 0,
    hordeEvery: 0,
    burst: 0,
    g2: 0,
    g3: 0,
    g4: 0,
  },
  {
    name: "Ansturm",
    until: 210,
    interval: 0.3,
    maxAlive: 30,
    hp: 1.08,
    types: ["zombie", "zombie", "bug"],
    eliteEvery: 0,
    hordeEvery: 0,
    burst: 0,
    g2: 0,
    g3: 0,
    g4: 0,
  },
  {
    name: "Druck",
    until: 330,
    interval: 0.42,
    maxAlive: 40,
    hp: 1.2,
    types: ["zombie", "zombie", "zombie", "bug"],
    eliteEvery: 36,
    hordeEvery: 0,
    burst: 0,
    g2: 4,
    g3: 0,
    g4: 0,
  },
  {
    name: "Belagerung",
    until: 450,
    interval: 0.58,
    maxAlive: 44,
    hp: 1.32,
    types: ["zombie", "zombie", "bug", "mutant"],
    eliteEvery: 30,
    hordeEvery: 0,
    burst: 0,
    g2: 7,
    g3: 2,
    g4: 0,
  },
  {
    name: "Schwarm",
    until: 540,
    interval: 0.5,
    maxAlive: 64,
    hp: 1.46,
    types: ["zombie", "bug", "mutant"],
    eliteEvery: 26,
    hordeEvery: 0,
    burst: 0,
    g2: 10,
    g3: 6,
    g4: 0,
  },
  {
    name: "Rotfront",
    until: 720,
    interval: 0.46,
    maxAlive: 66,
    hp: 1.6,
    types: ["zombie", "bug", "mutant", "robot"],
    eliteEvery: 24,
    hordeEvery: 0,
    burst: 0,
    g2: 10,
    g3: 6,
    g4: 3,
  },
  {
    name: "Endzeit",
    until: Number.POSITIVE_INFINITY,
    interval: 0.42,
    maxAlive: 68,
    hp: 1.78,
    types: ["zombie", "bug", "mutant", "robot"],
    eliteEvery: 22,
    hordeEvery: 0,
    burst: 0,
    g2: 12,
    g3: 7,
    g4: 4,
  },
];

export const BOSS_AT = [300, 600, 900];
export const BOSS_NAME = ["Brüllender Koloss", "Stahlkäfer", "Reaktor-König"];

export type Chapter = {
  id: number;
  name: string;
  blurb: string;
  hp: number;
  dmg: number;
  spawn: number;
  xp: number;
};

export const CHAPTERS: Chapter[] = [
  { id: 1, name: "Park", blurb: "Lerne den Rhythmus.", hp: 1, dmg: 1, spawn: 1, xp: 1 },
  { id: 2, name: "Fabrik", blurb: "Enger, härter, lauter.", hp: 1.42, dmg: 1.18, spawn: 1.12, xp: 1.12 },
  { id: 3, name: "Reaktor", blurb: "Volle Intensität.", hp: 1.9, dmg: 1.35, spawn: 1.24, xp: 1.28 },
];

export function waveIndex(time: number): number {
  for (let i = 0; i < WAVES.length; i++) if (time < WAVES[i].until) return i;
  return WAVES.length - 1;
}

export function xpFor(level: number): number {
  return Math.floor(10 + level * 5 + Math.pow(level, 1.32) * 2.4);
}

export function fmtTime(t: number): string {
  const s = Math.max(0, Math.floor(t));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export type Sym = "sword" | "magnet" | "rocket" | "heart" | "star" | "coin" | "bolt" | "blade";
export const SYMS: Sym[] = ["sword", "magnet", "rocket", "heart", "star", "coin", "bolt", "blade"];
