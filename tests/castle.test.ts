import { describe, expect, it } from "vitest";
import {
  FIELD,
  PLACE_COST,
  UPGRADE_COST,
  castleLevel,
  defaultCastle,
  fits,
  limitFor,
  move,
  occupancy,
  place,
  readCastle,
  statsFor,
  upgrade,
  upgradeBlock,
  upgradeWalls,
  type Castle,
} from "@/game/castle/model";
import { startRaid, stepRaid, type RaidEvent } from "@/game/castle/raid";

function castleOf(c: Castle) {
  return c.buildings.find((b) => b.kind === "castle")!;
}

describe("Burg: Bauen", () => {
  it("startet mit Schloss, Turm und Haus", () => {
    const c = defaultCastle();
    expect(c.buildings.map((b) => b.kind).sort()).toEqual(["castle", "house", "tower"]);
  });

  it("platziert nur auf freien Feldern und zieht Gold ab", () => {
    const c = defaultCastle();
    const k = castleOf(c);
    expect(place(c, "wall", k.x, k.y, 100)).toBeNull();
    const r = place(c, "wall", 2, 2, 100)!;
    expect(r.coins).toBe(100 - PLACE_COST.wall);
    expect(r.castle.buildings).toHaveLength(4);
    expect(place(r.castle, "tower", 1, 1, 1000)).toBeNull();
  });

  it("hält Gebäude im Baufeld", () => {
    const grid = occupancy(defaultCastle());
    expect(fits(grid, "tower", FIELD - 1, 0)).toBe(false);
    expect(fits(grid, "tower", FIELD - 2, 0)).toBe(true);
    expect(fits(grid, "wall", -1, 0)).toBe(false);
  });

  it("begrenzt die Anzahl über die Schloss-Stufe", () => {
    let c = defaultCastle();
    let coins = 1e6;
    for (let i = 0; i < 10; i++) {
      const r = place(c, "tower", 2 + i * 3, 2, coins);
      if (!r) break;
      c = r.castle;
      coins = r.coins;
    }
    expect(c.buildings.filter((b) => b.kind === "tower")).toHaveLength(limitFor("tower", 1));
  });

  it("verschiebt nur auf freie Plätze", () => {
    const c = defaultCastle();
    const tower = c.buildings.find((b) => b.kind === "tower")!;
    const k = castleOf(c);
    expect(move(c, tower.id, k.x, k.y)).toBeNull();
    const moved = move(c, tower.id, 5, 5)!;
    expect(moved.buildings.find((b) => b.id === tower.id)).toMatchObject({ x: 5, y: 5 });
  });
});

describe("Burg: Upgrades", () => {
  it("braucht für Gebäude eine passende Schloss-Stufe", () => {
    const c = defaultCastle();
    const tower = c.buildings.find((b) => b.kind === "tower")!;
    expect(upgradeBlock(c, tower, 1e6)).toMatch(/Schloss Stufe 2/);
    const up = upgrade(c, castleOf(c).id, 1e6)!;
    expect(castleLevel(up.castle)).toBe(2);
    expect(upgrade(up.castle, tower.id, 1e6)!.castle.buildings.find((b) => b.id === tower.id)!.level).toBe(2);
  });

  it("geht bis Stufe 5 und wird immer teurer", () => {
    let c = defaultCastle();
    let coins = 1e6;
    const id = castleOf(c).id;
    for (let l = 1; l < 5; l++) {
      const r = upgrade(c, id, coins)!;
      expect(coins - r.coins).toBe(UPGRADE_COST.castle[l - 1]);
      c = r.castle;
      coins = r.coins;
    }
    expect(castleLevel(c)).toBe(5);
    expect(upgrade(c, id, coins)).toBeNull();
    for (const list of Object.values(UPGRADE_COST)) {
      for (let i = 1; i < list.length; i++) expect(list[i]).toBeGreaterThan(list[i - 1]);
    }
  });

  it("macht Türme mit jeder Stufe stärker", () => {
    for (let l = 1; l < 5; l++) {
      const a = statsFor("tower", l);
      const b = statsFor("tower", l + 1);
      expect(b.dmg!).toBeGreaterThan(a.dmg!);
      expect(b.hp).toBeGreaterThan(a.hp);
      expect(statsFor("wall", l + 1).hp).toBeGreaterThan(statsFor("wall", l).hp);
    }
  });

  it("upgradet Mauern gesammelt, solange das Gold reicht", () => {
    let c = upgrade(defaultCastle(), 1, 1e6)!.castle;
    let coins = 1000;
    for (let i = 0; i < 5; i++) {
      const r = place(c, "wall", 2 + i, 30, coins)!;
      c = r.castle;
      coins = r.coins;
    }
    const r = upgradeWalls(c, 1, UPGRADE_COST.wall[0] * 3);
    expect(r.count).toBe(3);
    expect(r.coins).toBe(0);
  });
});

describe("Burg: Speicherstand", () => {
  it("liest den eigenen Stand verlustfrei", () => {
    const r = place(defaultCastle(), "wall", 3, 3, 100)!;
    expect(readCastle(JSON.parse(JSON.stringify(r.castle)))).toEqual(r.castle);
  });

  it("übernimmt alte Raster-Stände", () => {
    const grid = "3".padEnd(16 * 16, ".");
    const c = readCastle({ grid, cx: 6, cy: 6, keep: 7, skin: "fire", owned: ["ice", "fire"], boosters: 2 });
    expect(castleLevel(c)).toBe(5);
    expect(c.buildings.some((b) => b.kind === "wall" && b.level === 3)).toBe(true);
    expect(c.skin).toBe("fire");
    expect(c.boosters).toBe(2);
  });

  it("repariert Überlappungen und ein fehlendes Schloss", () => {
    const c = readCastle({
      v: 2,
      buildings: [
        { kind: "tower", x: 5, y: 5, level: 9 },
        { kind: "tower", x: 5, y: 5, level: 1 },
      ],
    });
    expect(c.buildings.filter((b) => b.kind === "castle")).toHaveLength(1);
    expect(c.buildings.find((b) => b.kind === "tower")!.level).toBe(5);
    const grid = occupancy(c);
    expect(grid.filter((v) => v !== 0).length).toBe(9 + 4 + 4);
  });
});

describe("Burg: Angriff", () => {
  function run(c: Castle, warriors = 0) {
    const raid = startRaid(c, warriors, 42);
    const events: RaidEvent[] = [];
    let steps = 0;
    while (!raid.result && steps < 30 * 600) {
      stepRaid(raid, c, 1 / 30, events);
      steps++;
    }
    return { raid, seconds: steps / 30 };
  }

  it("endet immer mit Sieg oder Niederlage", () => {
    const { raid, seconds } = run(defaultCastle());
    expect(raid.result).not.toBeNull();
    expect(seconds).toBeLessThan(300);
  });

  it("wird mit ausgebauten Türmen gewonnen", () => {
    let c = defaultCastle();
    let coins = 1e9;
    for (let i = 0; i < 4; i++) ({ castle: c, coins } = upgrade(c, 1, coins)!);
    for (const [x, y] of [
      [10, 10],
      [28, 10],
      [10, 28],
      [28, 28],
    ])
      ({ castle: c, coins } = place(c, "tower", x, y, coins)!);
    for (const b of c.buildings.filter((it) => it.kind === "tower")) {
      for (let l = b.level; l < 5; l++) ({ castle: c, coins } = upgrade(c, b.id, coins)!);
    }
    const { raid } = run(c, 6);
    expect(raid.result).toBe("win");
    expect(raid.reward).toBeGreaterThan(0);
  });

  it("ein Angriff verändert den Bau-Stand nicht", () => {
    const c = defaultCastle();
    const before = JSON.stringify(c);
    run(c);
    expect(JSON.stringify(c)).toBe(before);
  });
});
