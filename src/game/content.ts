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
  desc: string;
  tone: "weapon" | "passive" | "evo";
};

export const INFO: Record<string, Info> = {
  staff: {
    name: "Stab",
    desc: "Rote Feuerkugeln aus dem Stab. Ab Stufe 3: Sauron-Keule mit Feuerwellen und blauer Schockwelle.",
    tone: "weapon",
  },
  mace: {
    name: "Sauron-Keule",
    desc: "Geschwungene Feuerwellen nach vorn und eine blaue Schockwelle.",
    tone: "evo",
  },
  katana: {
    name: "Katana",
    desc: "Jede Stufe eine weitere Klinge plus Wellen. Stufe 5: Dämonenklinge.",
    tone: "weapon",
  },
  shotgun: {
    name: "Schrotflinte",
    desc: "Mehr Stufen, mehr Pellets, kürzere Pause. Stufe 5: Gatling-Kanone.",
    tone: "weapon",
  },
  kunai: {
    name: "Kunai",
    desc: "Jede Stufe ein weiteres Messer. Stufe 5: Geister-Shuriken.",
    tone: "weapon",
  },
  guardian: {
    name: "Abwehrrad",
    desc: "Jede Stufe ein weiteres Rad im Orbit. Stufe 5: riesiges Sternrad.",
    tone: "weapon",
  },
  force: {
    name: "Kraftfeld",
    desc: "Ring wächst mit jeder Stufe. Stufe 5: Aegis, ein harter Schutzschild.",
    tone: "weapon",
  },
  molotov: {
    name: "Molotow",
    desc: "Brandflächen, ab Stufe 3 ein zweiter Wurf. Stufe 5: Feuersturm.",
    tone: "weapon",
  },
  lightning: {
    name: "Blitzspule",
    desc: "Jede Stufe ein weiterer Kettensprung. Stufe 5: Kettensturm.",
    tone: "weapon",
  },
  drones: {
    name: "Drohnen",
    desc: "1 bis 4 Drohnen. Die fünfte Stufe wird zur Super-Drohne.",
    tone: "weapon",
  },
  boomerang: {
    name: "Bumerang",
    desc: "Jede Stufe ein weiterer Bumerang. Stufe 5: Magnet-Bumerang.",
    tone: "weapon",
  },
  soccer: {
    name: "Fußball",
    desc: "Jede Stufe ein weiterer Ball. Stufe 5: Kometenball.",
    tone: "weapon",
  },
  tank: {
    name: "Panzer",
    desc: "Ab Minute 8 sehr selten, ab Minute 10 etwas öfter. Dreimal gewählt wird er zum UFO.",
    tone: "weapon",
  },
  demon: {
    name: "Dämonenklinge",
    desc: "Evolution der Katana. Riesige Klingen, und Treffer heilen dich.",
    tone: "evo",
  },
  gatling: {
    name: "Gatling-Kanone",
    desc: "Evolution der Schrotflinte. Dauerfeuer, mehrere Läufe, Auto-Ziel.",
    tone: "evo",
  },
  shuriken: {
    name: "Geister-Shuriken",
    desc: "Evolution der Kunai. Sehr schnell, groß, hoher Durchschlag.",
    tone: "evo",
  },
  starwheel: {
    name: "Sternrad",
    desc: "Evolution des Abwehrrads. Ein riesiges Rad mit massivem Flächenschaden.",
    tone: "evo",
  },
  aegis: {
    name: "Aegis",
    desc: "Evolution des Kraftfelds. Viel größer, härtere Pulse.",
    tone: "evo",
  },
  inferno: {
    name: "Feuersturm",
    desc: "Evolution des Molotows. Eine riesige Brandzone.",
    tone: "evo",
  },
  storm: {
    name: "Kettensturm",
    desc: "Evolution der Blitzspule. Viele Sprünge, viel mehr Schaden.",
    tone: "evo",
  },
  titan: {
    name: "Super-Drohne",
    desc: "Evolution der Drohnen. Eine riesige Drohne mit mehr Schüssen.",
    tone: "evo",
  },
  magnetboom: {
    name: "Magnet-Bumerang",
    desc: "Evolution des Bumerangs. Groß, magnetisch, schneidet härter.",
    tone: "evo",
  },
  comet: {
    name: "Kometenball",
    desc: "Evolution des Fußballs. Ein riesiger, schneller Ball.",
    tone: "evo",
  },
  ufo: {
    name: "UFO",
    desc: "Der Panzer wird zur Superwaffe. Breiter Strahl, aber nicht mehr unsterblich.",
    tone: "evo",
  },
  boots: {
    name: "Sprintsohlen",
    desc: "Bewegungstempo +8% pro Stern.",
    tone: "passive",
  },
  glove: {
    name: "Powerhandschuh",
    desc: "Schaden +12% pro Stern.",
    tone: "passive",
  },
  chrono: {
    name: "Chrono-Chip",
    desc: "Abklingzeiten −8% pro Stern.",
    tone: "passive",
  },
  magnet: {
    name: "Magnetkern",
    desc: "XP-Kristalle werden aus größerer Distanz gezogen.",
    tone: "passive",
  },
  heart: {
    name: "Vitalherz",
    desc: "Maximale HP +25 pro Stern, und du wirst sofort geheilt.",
    tone: "passive",
  },
  lens: {
    name: "Sprengradius",
    desc: "Wirkungsradius +12% pro Stern.",
    tone: "passive",
  },
  blood: {
    name: "Blutjuwel",
    desc: "Krit und Lebensraub. Stapelt sich, unabhängig von der Evolution.",
    tone: "passive",
  },
  ammo: {
    name: "Munitionsgurt",
    desc: "Mehr Projektile. Stapelt sich bis Stufe 5.",
    tone: "passive",
  },
  scroll: {
    name: "Ninja-Rolle",
    desc: "Mehr Durchschlag. Stapelt sich bis Stufe 5.",
    tone: "passive",
  },
  scope: {
    name: "Zielfernrohr",
    desc: "Kritische Treffer +6% pro Stern.",
    tone: "passive",
  },
  plate: {
    name: "Panzerplatte",
    desc: "Erlittener Schaden −6% pro Stern.",
    tone: "passive",
  },
  purse: {
    name: "Glücksmünze",
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

export const ENEMY_BASE: Record<EnemyKind, { hp: number; speed: number; r: number; dmg: number; color: string }> = {
  zombie: { hp: 14, speed: 68, r: 15, dmg: 6, color: "#3dce6a" },
  bug: { hp: 11, speed: 122, r: 12, dmg: 5, color: "#ffe14a" },
  mutant: { hp: 40, speed: 50, r: 20, dmg: 10, color: "#c86bff" },
  robot: { hp: 32, speed: 66, r: 16, dmg: 8, color: "#3ec6ff" },
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
