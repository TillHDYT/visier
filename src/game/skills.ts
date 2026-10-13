import type { PassiveId, WeaponId } from "@/game/content";

export const EVO_OF: Record<WeaponId, string> = {
  staff: "staff",
  katana: "demon",
  shotgun: "gatling",
  kunai: "shuriken",
  guardian: "starwheel",
  force: "aegis",
  molotov: "inferno",
  lightning: "storm",
  drones: "titan",
  boomerang: "magnetboom",
  soccer: "comet",
  tank: "ufo",
};

export type Bonus = {
  dmg: number;
  cdr: number;
  count: number;
  aoe: number;
  spd: number;
  pierce: number;
  hp: number;
  magnet: number;
  xp: number;
  crit: number;
  taken: number;
  proj: number;
  ls: number;
};

export const ZERO_BONUS: Bonus = {
  dmg: 0,
  cdr: 0,
  count: 0,
  aoe: 0,
  spd: 0,
  pierce: 0,
  hp: 0,
  magnet: 0,
  xp: 0,
  crit: 0,
  taken: 0,
  proj: 0,
  ls: 0,
};

type Tier = Partial<Bonus> & { label: string };

export const PERM: Record<WeaponId | PassiveId, Tier[]> = {
  staff: [
    { label: "+10% Feuerkugel-Schaden", dmg: 0.1 },
    { label: "Schnellere Feuerkugeln", cdr: 0.1 },
    { label: "Größere Schockwelle", aoe: 0.14 },
    { label: "+1 Feuerkugel", count: 1 },
    { label: "+12% Schaden und Tempo", dmg: 0.12, spd: 0.1 },
  ],
  katana: [
    { label: "+12% Klingenschaden", dmg: 0.12 },
    { label: "+1 Klinge im Orbit", count: 1 },
    { label: "Größere Klingenwellen", aoe: 0.16 },
    { label: "Schnellere Schwünge", cdr: 0.12 },
    { label: "+15% Schaden und Tempo", dmg: 0.15, spd: 0.12 },
  ],
  shotgun: [
    { label: "+10% Schussschaden", dmg: 0.1 },
    { label: "+1 Pellet", count: 1 },
    { label: "Schnelleres Nachladen", cdr: 0.12 },
    { label: "+1 weiteres Pellet", count: 1 },
    { label: "Schnellere, härtere Kugeln", dmg: 0.12, spd: 0.16 },
  ],
  kunai: [
    { label: "+10% Messerschaden", dmg: 0.1 },
    { label: "+1 Messer", count: 1 },
    { label: "+1 Durchschlag", pierce: 1 },
    { label: "Schnellere Würfe", cdr: 0.12, spd: 0.1 },
    { label: "+14% Schaden", dmg: 0.14 },
  ],
  guardian: [
    { label: "+10% Radschaden", dmg: 0.1 },
    { label: "+1 Rad", count: 1 },
    { label: "Weiterer Orbit", aoe: 0.14 },
    { label: "+12% Schaden", dmg: 0.12 },
    { label: "Schnellere Drehung", spd: 0.2 },
  ],
  force: [
    { label: "+10% Felsschaden", dmg: 0.1 },
    { label: "Größerer Ring", aoe: 0.14 },
    { label: "Schnellere Pulse", cdr: 0.14 },
    { label: "Noch weiter", aoe: 0.12 },
    { label: "+18% Schaden", dmg: 0.18 },
  ],
  molotov: [
    { label: "+12% Brandschaden", dmg: 0.12 },
    { label: "Größere Brandfläche", aoe: 0.16 },
    { label: "+1 Wurf", count: 1 },
    { label: "Kürzere Pause", cdr: 0.12 },
    { label: "+15% Schaden", dmg: 0.15 },
  ],
  lightning: [
    { label: "+10% Blitzschaden", dmg: 0.1 },
    { label: "+1 Kettensprung", count: 1 },
    { label: "Schnellere Spule", cdr: 0.12 },
    { label: "+1 weiterer Sprung", count: 1 },
    { label: "+16% Schaden", dmg: 0.16 },
  ],
  drones: [
    { label: "+10% Drohnenschaden", dmg: 0.1 },
    { label: "+1 Drohne", count: 1 },
    { label: "Schnelleres Feuer", cdr: 0.12 },
    { label: "+12% Schaden", dmg: 0.12 },
    { label: "Weiterer Flugkreis", aoe: 0.14, dmg: 0.08 },
  ],
  boomerang: [
    { label: "+10% Schnittschaden", dmg: 0.1 },
    { label: "+1 Bumerang", count: 1 },
    { label: "Größere Klinge", aoe: 0.14 },
    { label: "Schneller unterwegs", spd: 0.16, cdr: 0.1 },
    { label: "+14% Schaden", dmg: 0.14 },
  ],
  soccer: [
    { label: "+10% Ballschaden", dmg: 0.1 },
    { label: "+1 Ball", count: 1 },
    { label: "Schnellerer Ball", spd: 0.16 },
    { label: "Größerer Ball", aoe: 0.14 },
    { label: "+15% Schaden", dmg: 0.15 },
  ],
  tank: [
    { label: "+14% Kanonenschaden", dmg: 0.14 },
    { label: "Schnelleres Rohr", cdr: 0.12 },
    { label: "Breiteres Überrollen", aoe: 0.16 },
    { label: "+18% Schaden", dmg: 0.18 },
    { label: "Stärkerer UFO-Strahl", dmg: 0.16, cdr: 0.08 },
  ],
  boots: [
    { label: "+4% Lauftempo", spd: 0.04 },
    { label: "+4% Lauftempo", spd: 0.04 },
    { label: "+5% Lauftempo", spd: 0.05 },
    { label: "+5% Lauftempo", spd: 0.05 },
    { label: "+6% Lauftempo", spd: 0.06 },
  ],
  glove: [
    { label: "+6% Schaden", dmg: 0.06 },
    { label: "+6% Schaden", dmg: 0.06 },
    { label: "+8% Schaden", dmg: 0.08 },
    { label: "+8% Schaden", dmg: 0.08 },
    { label: "+10% Schaden", dmg: 0.1 },
  ],
  chrono: [
    { label: "−4% Abklingzeit", cdr: 0.04 },
    { label: "−4% Abklingzeit", cdr: 0.04 },
    { label: "−5% Abklingzeit", cdr: 0.05 },
    { label: "−5% Abklingzeit", cdr: 0.05 },
    { label: "−6% Abklingzeit", cdr: 0.06 },
  ],
  magnet: [
    { label: "+24 Magnetreichweite", magnet: 24 },
    { label: "+28 Magnetreichweite", magnet: 28 },
    { label: "+32 Magnetreichweite", magnet: 32 },
    { label: "+36 Magnetreichweite", magnet: 36 },
    { label: "+48 Magnetreichweite", magnet: 48 },
  ],
  heart: [
    { label: "+14 maximale HP", hp: 14 },
    { label: "+16 maximale HP", hp: 16 },
    { label: "+18 maximale HP", hp: 18 },
    { label: "+22 maximale HP", hp: 22 },
    { label: "+28 maximale HP", hp: 28 },
  ],
  lens: [
    { label: "+5% Wirkungsradius", aoe: 0.05 },
    { label: "+5% Wirkungsradius", aoe: 0.05 },
    { label: "+6% Wirkungsradius", aoe: 0.06 },
    { label: "+6% Wirkungsradius", aoe: 0.06 },
    { label: "+8% Wirkungsradius", aoe: 0.08 },
  ],
  blood: [
    { label: "+2% Lebensraub", ls: 0.02 },
    { label: "+2% Krit", crit: 0.02 },
    { label: "+2% Lebensraub", ls: 0.02 },
    { label: "+3% Krit", crit: 0.03 },
    { label: "+3% Lebensraub", ls: 0.03 },
  ],
  ammo: [
    { label: "+1 Projektil", proj: 1 },
    { label: "+6% Schaden", dmg: 0.06 },
    { label: "+1 Projektil", proj: 1 },
    { label: "−6% Abklingzeit", cdr: 0.06 },
    { label: "+8% Schaden", dmg: 0.08 },
  ],
  scroll: [
    { label: "+1 Durchschlag", pierce: 1 },
    { label: "+6% Schaden", dmg: 0.06 },
    { label: "+1 Durchschlag", pierce: 1 },
    { label: "+8% Projektiltempo", spd: 0.08 },
    { label: "+1 Durchschlag", pierce: 1 },
  ],
  scope: [
    { label: "+3% Krit", crit: 0.03 },
    { label: "+3% Krit", crit: 0.03 },
    { label: "+4% Krit", crit: 0.04 },
    { label: "+4% Krit", crit: 0.04 },
    { label: "+5% Krit", crit: 0.05 },
  ],
  plate: [
    { label: "−3% erlittener Schaden", taken: 0.03 },
    { label: "−3% erlittener Schaden", taken: 0.03 },
    { label: "−4% erlittener Schaden", taken: 0.04 },
    { label: "−4% erlittener Schaden", taken: 0.04 },
    { label: "−5% erlittener Schaden", taken: 0.05 },
  ],
  purse: [
    { label: "+5% XP", xp: 0.05 },
    { label: "+5% XP", xp: 0.05 },
    { label: "+6% XP", xp: 0.06 },
    { label: "+6% XP", xp: 0.06 },
    { label: "+8% XP", xp: 0.08 },
  ],
};

export function permBonus(id: string, rank: number): Bonus {
  const b: Bonus = { ...ZERO_BONUS };
  const tiers = PERM[id as WeaponId];
  if (!tiers) return b;
  const n = Math.max(0, Math.min(tiers.length, Math.floor(rank)));
  for (let i = 0; i < n; i++) {
    const t = tiers[i];
    b.dmg += t.dmg ?? 0;
    b.cdr += t.cdr ?? 0;
    b.count += t.count ?? 0;
    b.aoe += t.aoe ?? 0;
    b.spd += t.spd ?? 0;
    b.pierce += t.pierce ?? 0;
    b.hp += t.hp ?? 0;
    b.magnet += t.magnet ?? 0;
    b.xp += t.xp ?? 0;
    b.crit += t.crit ?? 0;
    b.taken += t.taken ?? 0;
    b.proj += t.proj ?? 0;
    b.ls += t.ls ?? 0;
  }
  return b;
}

export function nextPermLabel(id: string, rank: number): string | null {
  return PERM[id as WeaponId]?.[rank]?.label ?? null;
}

const STACK: Record<string, string[]> = {
  staff: [
    "",
    "Eine rote Feuerkugel, alle ein bis zwei Sekunden.",
    "Größere Kugel, kürzere Pause.",
    "Sauron-Keule: geschwungene Feuerwellen plus blaue Schockwelle.",
    "Schnellere, breitere Feuerwellen.",
    "Schwere Keule, große Wellen, weite Schockwelle.",
  ],
  katana: [
    "",
    "Eine Klinge kreist und schlägt Wellen.",
    "Zwei Katanas im Orbit.",
    "Drei Klingen halten den Kreis.",
    "Vier Katanas rotieren um dich.",
    "Dämonenklinge: riesige Wellen, Heilung bei Treffern.",
  ],
  shotgun: [
    "",
    "Enger Streuschuss nach vorn.",
    "Mehr Pellets, kürzere Pause.",
    "Die Garbe wird breiter und härter.",
    "Schwere Salve, schnelles Nachladen.",
    "Gatling-Kanone: Dauerfeuer mit Auto-Ziel.",
  ],
  kunai: [
    "",
    "Ein Messer sucht den Nächsten.",
    "Zwei Messer gleichzeitig.",
    "Drei Messer, mehr Durchschlag.",
    "Vier Messer im Fächer.",
    "Geister-Shuriken: schnell, groß, hoher Durchschlag.",
  ],
  guardian: [
    "",
    "Ein Abwehrrad kreist um dich.",
    "Zwei Räder im Kreis.",
    "Drei Räder zerlegen, was rankommt.",
    "Vier Räder, dichter Orbit.",
    "Sternrad: ein riesiges Rad, massiver Flächenschaden.",
  ],
  force: [
    "",
    "Ein kleiner Schadensring.",
    "Der Ring wird weiter.",
    "Härtere Pulse.",
    "Breites Kraftfeld.",
    "Aegis: gewaltiger Schild mit Extra-Schaden.",
  ],
  molotov: [
    "",
    "Eine Brandfläche auf die Meute.",
    "Größer und heißer.",
    "Zwei Brandherde.",
    "Kurze Pause, große Feuer.",
    "Feuersturm: eine riesige, lange Brandzone.",
  ],
  lightning: [
    "",
    "Ein Blitz springt einmal weiter.",
    "Längere Kette.",
    "Mehr Sprünge durch die Horde.",
    "Dichte Kette, kurzer Cooldown.",
    "Kettensturm: viele Sprünge, viel höherer Schaden.",
  ],
  drones: [
    "",
    "1 Drohne kreist und schießt.",
    "2 Drohnen fliegen mit.",
    "3 Drohnen halten die Horde klein.",
    "4 Drohnen im Kreis.",
    "Super-Drohne: riesig, härter, mehr Schüsse.",
  ],
  boomerang: [
    "",
    "Ein Bumerang fliegt hinaus und zurück.",
    "Zwei Bumerangs.",
    "Drei Bumerangs im Fächer.",
    "Vier Bumerangs schneiden die Bahn.",
    "Magnet-Bumerang: groß, zieht und trifft härter.",
  ],
  soccer: [
    "",
    "Ein Ball prallt durchs Sichtfeld.",
    "Zwei Bälle.",
    "Drei Bälle räumen Stapel leer.",
    "Vier Bälle im Feld.",
    "Kometenball: ein riesiger, schneller Ball.",
  ],
  tank: [
    "",
    "Du wirst zum Panzer. Kanone und Überrollen.",
    "Zweiter Panzer: Doppelrohr und dickere Panzerung.",
    "UFO: ultimative Superwaffe mit Löschstrahl.",
  ],
};

export function stackLine(id: string, star: number): string {
  return STACK[id]?.[star] ?? "";
}
