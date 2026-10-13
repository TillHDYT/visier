import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHAPTERS, INFO, PASSIVE_IDS, WEAPON_IDS, xpFor } from "@/game/content";
import {
  buyRank,
  buySkill,
  chapterUnlocked,
  defaultMeta,
  loadMeta,
  rollGear,
  saveMeta,
  skillCost,
  type Meta,
} from "@/game/meta";
import { EVO_OF, permBonus } from "@/game/skills";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  };
}

describe("Speicherstand", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
    // Der Startstand enthält Zeitstempel; eine feste Uhr macht Vergleiche stabil.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(1_700_000_000_000);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("liefert ohne Speicher einen frischen Stand", () => {
    expect(loadMeta()).toEqual(defaultMeta());
  });

  it("speichert und lädt verlustfrei", () => {
    const m = { ...defaultMeta(), coins: 1234, runs: 7, skills: { katana: 3 } };
    saveMeta(m);
    expect(loadMeta()).toEqual(m);
  });

  it("bereinigt manipulierte Werte", () => {
    localStorage.setItem(
      "visier-meta-v1",
      JSON.stringify({ v: 1, coins: -50, ranks: { hp: 999 }, skills: { katana: 99 }, selectedChapter: 9 }),
    );
    const m = loadMeta();
    expect(m.coins).toBe(0);
    expect(m.ranks.hp).toBe(10);
    expect(m.skills.katana).toBe(5);
    expect(m.selectedChapter).toBe(3);
  });

  it("übersteht kaputtes JSON und blockierten Speicher", () => {
    localStorage.setItem("visier-meta-v1", "{kaputt");
    expect(loadMeta()).toEqual(defaultMeta());
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(loadMeta()).toEqual(defaultMeta());
    expect(() => saveMeta(defaultMeta())).not.toThrow();
  });
});

describe("Shop", () => {
  it("kauft Fähigkeiten nur mit genug Gold", () => {
    const poor = defaultMeta();
    expect(buySkill(poor, "katana")).toBeNull();
    const rich = { ...poor, coins: skillCost(0) };
    const after = buySkill(rich, "katana");
    expect(after?.coins).toBe(0);
    expect(after?.skills.katana).toBe(1);
  });

  it("respektiert die Rang-Obergrenze", () => {
    const m = { ...defaultMeta(), coins: 1e6, ranks: { ...defaultMeta().ranks, start: 2 } };
    expect(buyRank(m, "start")).toBeNull();
  });

  it("ersetzt Ausrüstung nie durch ein schlechteres Teil", () => {
    const legendary = { slot: "helm" as const, rarity: 3 as const, value: 84 };
    let m: Meta = {
      ...defaultMeta(),
      coins: 1e6,
      gear: {
        helm: legendary,
        scarf: { ...legendary, slot: "scarf" as const, value: 0.34 },
        boots: { ...legendary, slot: "boots" as const, value: 0.22 },
      },
    };
    for (let i = 0; i < 200; i++) {
      const next = rollGear(m);
      expect(next).not.toBeNull();
      m = next!;
    }
    expect(m.gear.helm?.rarity).toBe(3);
    expect(m.gear.scarf?.rarity).toBe(3);
    expect(m.gear.boots?.rarity).toBe(3);
  });

  it("schaltet Kapitel über Bestzeiten frei", () => {
    const m = defaultMeta();
    expect(chapterUnlocked(m, 1)).toBe(true);
    expect(chapterUnlocked(m, 2)).toBe(false);
    expect(chapterUnlocked({ ...m, best: [240, 0, 0] }, 2)).toBe(true);
    expect(chapterUnlocked({ ...m, best: [240, 480, 0] }, 3)).toBe(true);
  });
});

describe("Spielinhalte", () => {
  it("hat für jede Waffe, Passive und Evolution einen Eintrag", () => {
    for (const id of [...WEAPON_IDS, ...PASSIVE_IDS]) expect(INFO[id]?.name).toBeTruthy();
    for (const evo of Object.values(EVO_OF)) expect(INFO[evo]?.name).toBeTruthy();
    expect(CHAPTERS.map((c) => c.id)).toEqual([1, 2, 3]);
  });

  it("braucht pro Level mehr Erfahrung", () => {
    for (let l = 1; l < 60; l++) expect(xpFor(l + 1)).toBeGreaterThan(xpFor(l));
  });

  it("summiert dauerhafte Boni stufenweise", () => {
    expect(permBonus("katana", 0).dmg).toBe(0);
    expect(permBonus("katana", 2).count).toBe(1);
    expect(permBonus("katana", 99).dmg).toBeCloseTo(0.27);
    expect(permBonus("unbekannt", 3).dmg).toBe(0);
  });
});
