import { describe, expect, it } from "vitest";
import {
  INNER0,
  INNER1,
  MAX_LEVEL,
  STORE_HOURS,
  castleLevel,
  collect,
  costFor,
  defaultCastle,
  fits,
  limitFor,
  move,
  occupancy,
  pending,
  place,
  readCastle,
  roadTiles,
  statsFor,
  upgrade,
  upgradeBlock,
  upgradeWall,
  wallUpgradeBlock,
  type Castle,
} from "@/game/castle/model";
import { startRaid, stepRaid, type RaidEvent } from "@/game/castle/raid";

const HOUR = 3_600_000;
const RICH = 1e9;

function rich(c: Castle): Castle {
  return { ...c, res: { food: RICH, stone: RICH, coal: RICH } };
}

function keepOf(c: Castle) {
  return c.buildings.find((b) => b.kind === "castle")!;
}

describe("Königreich: Start", () => {
  it("startet mit Schloss, Goldmine, Feld, Haus und Turm innerhalb der Mauer", () => {
    const c = defaultCastle(0);
    expect(c.buildings.map((b) => b.kind).sort()).toEqual(["castle", "field", "goldmine", "house", "tower"]);
    const grid = occupancy({ ...c, buildings: [] });
    for (const b of c.buildings) {
      const others = { ...c, buildings: c.buildings.filter((o) => o.id !== b.id) };
      expect(fits(occupancy(others), b.kind, b.x, b.y)).toBe(true);
    }
    expect(grid.length).toBeGreaterThan(0);
  });
});

describe("Königreich: Bauen", () => {
  it("baut nur innerhalb der festen Mauer und nicht auf die Straße", () => {
    const c = rich(defaultCastle(0));
    expect(place(c, "field", INNER0 - 1, 20, RICH)).toBeNull();
    expect(place(c, "field", INNER1 - 2, 20, RICH)).toBeNull();
    const [rx, ry] = roadTiles()[0];
    expect(place(c, "house", rx, ry - 1, RICH)).toBeNull();
    expect(place(c, "field", INNER0, INNER0, RICH)).not.toBeNull();
  });

  it("zieht Gold und Rohstoffe ab", () => {
    const c = defaultCastle(0);
    const cost = costFor("field", 1);
    const r = place(c, "field", INNER0, INNER0, 1000)!;
    expect(r.coins).toBe(1000 - (cost.gold ?? 0));
    expect(r.castle.res.food).toBe(c.res.food - (cost.food ?? 0));
  });

  it("begrenzt Gebäude über die Schloss-Stufe", () => {
    let c = rich(defaultCastle(0));
    let coins = RICH;
    for (let i = 0; i < 6; i++) {
      const r = place(c, "goldmine", INNER0 + i * 4, INNER0, coins);
      if (!r) break;
      c = r.castle;
      coins = r.coins;
    }
    expect(c.buildings.filter((b) => b.kind === "goldmine")).toHaveLength(limitFor("goldmine", 1));
  });

  it("verschiebt Gebäude, aber nicht über die Mauer", () => {
    const c = defaultCastle(0);
    const house = c.buildings.find((b) => b.kind === "house")!;
    expect(move(c, house.id, 2, 2)).toBeNull();
    expect(move(c, house.id, INNER0, INNER0)!.buildings.find((b) => b.id === house.id)).toMatchObject({
      x: INNER0,
      y: INNER0,
    });
  });
});

describe("Königreich: Produktion", () => {
  it("Goldminen sammeln passiv Gold, gedeckelt auf den Speicher", () => {
    const c = defaultCastle(0);
    const mine = c.buildings.find((b) => b.kind === "goldmine")!;
    expect(pending(mine, 2 * HOUR)).toBe(80);
    expect(pending(mine, 100 * HOUR)).toBe(40 * STORE_HOURS);
    const h = collect(c, 10, 2 * HOUR);
    expect(h.coins).toBe(10 + 80);
    expect(h.got.gold).toBe(80);
    expect(h.got.food).toBe(120);
    expect(
      pending(
        h.castle.buildings.find((b) => b.id === mine.id)!,
        2 * HOUR,
      ),
    ).toBe(0);
  });

  it("erntet vor einem Upgrade automatisch", () => {
    let c = rich(defaultCastle(0));
    c = upgrade(c, keepOf(c).id, RICH, 0)!.castle;
    const field = c.buildings.find((b) => b.kind === "field")!;
    const before = c.res.food;
    const r = upgrade(c, field.id, RICH, HOUR)!;
    expect(r.castle.res.food).toBe(before - (costFor("field", 2).food ?? 0) + 60);
  });
});

describe("Königreich: Upgrades", () => {
  it("Gebäude und Mauer brauchen die passende Schloss-Stufe", () => {
    let c = rich(defaultCastle(0));
    const tower = c.buildings.find((b) => b.kind === "tower")!;
    expect(upgradeBlock(c, tower, RICH)).toMatch(/Schloss Stufe 2/);
    expect(wallUpgradeBlock(c, RICH)).toMatch(/Schloss Stufe 2/);
    c = upgrade(c, keepOf(c).id, RICH)!.castle;
    expect(castleLevel(c)).toBe(2);
    expect(upgrade(c, tower.id, RICH)!.castle.buildings.find((b) => b.id === tower.id)!.level).toBe(2);
    expect(upgradeWall(c, RICH)!.castle.wall).toBe(2);
  });

  it("alles geht bis Stufe 5, Kosten steigen", () => {
    let c = rich(defaultCastle(0));
    let coins = RICH;
    for (let l = 1; l < MAX_LEVEL; l++) ({ castle: c, coins } = upgrade(c, keepOf(c).id, coins)!);
    for (const b of c.buildings)
      for (let l = b.level; l < MAX_LEVEL; l++) ({ castle: c, coins } = upgrade(c, b.id, coins)!);
    for (let l = 1; l < MAX_LEVEL; l++) ({ castle: c, coins } = upgradeWall(c, coins)!);
    expect(c.buildings.every((b) => b.level === MAX_LEVEL)).toBe(true);
    expect(c.wall).toBe(MAX_LEVEL);
    for (let l = 1; l < MAX_LEVEL; l++)
      expect(costFor("tower", l + 1).gold!).toBeGreaterThan(costFor("tower", l).gold!);
    expect(costFor("tower", 2).stone).toBeGreaterThan(0);
    expect(costFor("tower", 4).coal).toBeGreaterThan(0);
  });

  it("Türme und Mauer werden stärker", () => {
    for (let l = 1; l < MAX_LEVEL; l++) {
      expect(statsFor("tower", l + 1).dmg!).toBeGreaterThan(statsFor("tower", l).dmg!);
      expect(statsFor("wall", l + 1).hp).toBeGreaterThan(statsFor("wall", l).hp);
    }
  });
});

describe("Königreich: Speicherstand", () => {
  it("liest den eigenen Stand verlustfrei", () => {
    const c = place(defaultCastle(5), "field", INNER0, INNER0, 1000, 5)!.castle;
    expect(readCastle(JSON.parse(JSON.stringify(c)), 10)).toEqual(c);
  });

  it("übernimmt den vorherigen Burg-Modus (freie Mauern)", () => {
    const old = {
      v: 2,
      buildings: [
        { kind: "castle", x: 19, y: 19, level: 3 },
        { kind: "tower", x: 10, y: 10, level: 2 },
        { kind: "wall", x: 5, y: 5, level: 2 },
        { kind: "wall", x: 6, y: 5, level: 3 },
      ],
      skin: "gold",
      owned: ["ice", "gold"],
      raid: 4,
    };
    const c = readCastle(old, 0);
    expect(castleLevel(c)).toBe(3);
    expect(c.wall).toBe(3);
    expect(c.buildings.some((b) => b.kind === "tower" && b.level === 2)).toBe(true);
    expect(c.buildings.some((b) => b.kind === "goldmine")).toBe(true);
    expect(c.skin).toBe("gold");
    expect(c.raid).toBe(4);
  });

  it("übernimmt das alte 16×16-Raster", () => {
    const c = readCastle({ grid: "4".padEnd(256, "."), cx: 6, cy: 6, keep: 2 }, 0);
    expect(castleLevel(c)).toBe(2);
    expect(c.buildings.some((b) => b.kind === "tower")).toBe(true);
  });
});

describe("Königreich: Angriff", () => {
  function run(c: Castle) {
    const raid = startRaid(c, 0, 42);
    const events: RaidEvent[] = [];
    let steps = 0;
    while (!raid.result && steps < 30 * 600) {
      stepRaid(raid, c, 1 / 30, events);
      steps++;
    }
    return { raid, seconds: steps / 30, events };
  }

  it("die Startburg wehrt den ersten Angriff ab", () => {
    const { raid, seconds } = run(defaultCastle(0));
    expect(raid.result).toBe("win");
    expect(seconds).toBeLessThan(120);
  });

  it("auch spätere Angriffe brechen selten durch die Mauer", () => {
    const c = { ...defaultCastle(0), raid: 6 };
    const { raid } = run(c);
    expect(raid.result).toBe("win");
  });

  it("ein Angriff verändert den Bau-Stand nicht", () => {
    const c = defaultCastle(0);
    const before = JSON.stringify(c);
    run(c);
    expect(JSON.stringify(c)).toBe(before);
  });
});
