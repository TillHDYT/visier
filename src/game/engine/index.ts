import { Music, Sfx } from "@/game/audio";
import {
  BOSS_AT,
  BOSS_NAME,
  CHAPTERS,
  ENEMY_BASE,
  INFO,
  PASSIVE_IDS,
  SYMS,
  WAVES,
  WEAPON_IDS,
  type Chapter,
  type EnemyKind,
  type PassiveId,
  type Sym,
  type WeaponId,
  xpFor,
} from "@/game/content";
import { bonuses, loadMeta, recruitsFromRun, saveMeta, type Meta } from "@/game/meta";
import { EVO_OF, permBonus, stackLine } from "@/game/skills";
import {
  diamond,
  drawArmored,
  drawBlade,
  drawDragon,
  drawDragonIntro,
  drawDrone,
  drawFireWave,
  drawForceField,
  drawIceWave,
  drawShield,
  drawTank,
  drawUfo,
  drawWarlock,
} from "./render";
import { loadArt, SpriteCache } from "./sprites";
import {
  CELL,
  CREAM,
  DANGER,
  HITN,
  INK,
  MAX_B,
  MAX_E,
  MAX_F,
  MAX_G,
  MAX_P,
  MAX_T,
  MAX_Z,
  PINK,
  STEP,
  VISOR,
  YELLOW,
  makeBullet,
  makeEnemy,
  type Bit,
  type Bullet,
  type Card,
  type Enemy,
  type Flash,
  type Floater,
  type GameHandle,
  type GameHooks,
  type Gem,
  type LuckyPull,
  type Mode,
  type Offer,
  type Shock,
  type Summary,
  type Wep,
  type Zone,
} from "./types";

export type { Card, GameHandle, GameHooks, Hud, LuckyPull, Mode, Summary } from "./types";

const GEM_COLORS = ["#e4ff55", "#14964a", "#3ec6ff", YELLOW] as const;

export function mountGame(canvas: HTMLCanvasElement, hooks: GameHooks): GameHandle {
  const ctxMaybe = canvas.getContext("2d", { alpha: false });
  if (!ctxMaybe) {
    return {
      start() {},
      choose() {},
      reroll() {},
      pullLucky: () => null,
      closeLucky() {},
      pause() {},
      resume() {},
      giveUp() {},
      toMenu() {},
      revive() {},
      sync() {},
      prime() {},
      destroy() {},
      pickArmor() {},
      breath() {},
    };
  }
  const ctx = ctxMaybe;
  const sfx = new Sfx();
  const music = new Music();
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const art = loadArt();
  const sprites = new SpriteCache();
  let lavaPat: CanvasPattern | null = null;
  const makeLava = () => {
    lavaPat = ctx.createPattern(art.lava, "repeat");
  };
  if (art.lava.complete && art.lava.naturalWidth > 0) makeLava();
  else art.lava.addEventListener("load", makeLava, { once: true });

  const enemies: Enemy[] = Array.from({ length: MAX_E }, makeEnemy);
  const bullets: Bullet[] = Array.from({ length: MAX_B }, makeBullet);
  const gems: Gem[] = Array.from({ length: MAX_G }, () => ({
    alive: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    xp: 1,
    kind: 0 as const,
    magnet: false,
    r: 6,
  }));
  const bits: Bit[] = Array.from({ length: MAX_P }, () => ({
    alive: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    max: 1,
    color: CREAM,
    s: 4,
  }));
  const floats: Floater[] = Array.from({ length: MAX_T }, () => ({
    alive: false,
    x: 0,
    y: 0,
    vy: 0,
    life: 0,
    text: "",
    tone: 0 as const,
  }));
  const zones: Zone[] = Array.from({ length: MAX_Z }, () => ({
    alive: false,
    x: 0,
    y: 0,
    r: 40,
    dmg: 1,
    life: 0,
    every: 0.3,
    acc: 0,
    fire: true,
  }));
  const flashes: Flash[] = Array.from({ length: MAX_F }, () => ({
    alive: false,
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 0,
    life: 0,
  }));
  const shocks: Shock[] = Array.from({ length: 6 }, () => ({
    alive: false,
    x: 0,
    y: 0,
    max: 80,
    life: 0,
    hue: 0,
  }));
  const hitIds = new Int16Array(MAX_B * HITN);
  /** Wiederverwendeter Puffer für Nachbarschaftsabfragen (keine Allokation pro Frame). */
  const near = new Int32Array(MAX_E);
  const nextLink = new Int32Array(MAX_E);
  const grid = new Map<number, number>();

  let eCursor = 0;
  let bCursor = 0;
  let pCursor = 0;
  let hudAt = 0;
  let hudWarn = "";
  let gaveUp = false;
  let stillPainted = false;
  let enemyCount = 0;
  let gidSeq = 1;
  let destroyed = false;
  let raf = 0;
  let viewW = 360;
  let viewH = 640;
  let camX = 0;
  let camY = 0;
  let shakeX = 0;
  let shakeY = 0;
  let trauma = 0;
  let shakeOn = true;
  let mode: Mode = "menu";
  let time = 0;
  let renderTime = 0;
  let accTime = 0;
  let lastTs = performance.now();
  let chapter: Chapter = CHAPTERS[0];
  let meta = loadMeta();
  sfx.muted = !meta.sfxOn;
  music.enabled = meta.music;
  shakeOn = meta.shake;

  const player = {
    x: 0,
    y: 0,
    r: 15,
    hp: 100,
    maxHp: 100,
    facing: -Math.PI / 2,
    vx: 0,
    vy: 0,
    flash: 0,
  };

  let weapons: Wep[] = [];
  let passives: { id: PassiveId; star: number }[] = [];
  const stats = {
    dmg: 1,
    speed: 200,
    cdr: 1,
    aoe: 1,
    taken: 1,
    xpMul: 1,
    crit: 0,
    magnet: 80,
    proj: 0,
    pierce: 0,
    ls: 0,
  };
  let baseDmg = 1;
  let baseSpd = 1;
  let baseMag = 80;
  let magnetBonus = 0;
  let runBaseHp = 100;
  let adrenaline = 0;
  let lifeBank = 0;
  let xp = 0;
  let xpNeed = xpFor(1);
  let level = 1;
  let pendingLevels = 0;
  let kills = 0;
  let bossesKilled = 0;
  let bonusCoins = 0;
  let coinPending = false;
  let coinSaveT = 0;
  let moved = false;
  let contactAcc = 0;
  let spawnAcc = 0;
  let eliteT = 8;
  let miniT = 40;
  let hordeT = 20;
  let calm = 0;
  let quiet = 0;
  let waveNo = 0;
  let waveGoal = 25;
  let waveSpawned = 0;
  let waveAlive = 0;
  let waveGap = 0;
  let markWave = false;
  let armor: "none" | "fire" | "ice" = "none";
  let armorPending = false;
  let dragonForm = false;
  let dragonPending = false;
  let dragonShow = 0;
  let breathHeld = false;
  let breathAcc = 0;
  let warnT = 0;
  let warnText = "";
  let didBoss = [false, false, false];
  let bossQueue = -1;
  let bossIn = 0;
  let bossI = -1;
  let hitstop = 0;
  let deathT = 0;
  let grace = 0;
  let revives = 0;
  let runLive = false;
  let banked = false;
  let payoutSpent = 0;
  let staffAim = -Math.PI / 2;
  let luckyQueue = 0;
  let luckyPulled = false;
  let offers: Offer[] = [];
  let rerolls = 1;
  let offerN = 1;
  let footT = 0;
  let textsFrame = 0;
  let forceR = 0;
  let forceOn = false;
  let forceEvo = false;
  let bladeScale = 1;
  let bladeHot = false;
  let shieldStar = false;
  let shieldScale = 1;
  let droneScale = 1;
  let form: "hero" | "tank" | "ufo" = "hero";
  let turret = -Math.PI / 2;
  let beamOn = 0;
  let beamAng = 0;
  let beamLen = 0;
  let crushT = 0;
  let crushVis = 0;
  let crushR = 0;
  const gx = new Float32Array(8);
  const gy = new Float32Array(8);
  let gN = 0;
  const ox = new Float32Array(12);
  const oy = new Float32Array(12);
  let oN = 0;
  const dxs = new Float32Array(8);
  const dys = new Float32Array(8);
  let dN = 0;

  const held = new Set<string>();
  let scripted: Set<string> | null = null;
  const joy = { on: false, id: -1, ox: 0, oy: 0, x: 0, y: 0, kx: 0, ky: 0 };

  function releaseJoy() {
    if (joy.id >= 0 && canvas.hasPointerCapture(joy.id)) {
      try {
        canvas.releasePointerCapture(joy.id);
      } catch {
        /* pointer already gone */
      }
    }
    joy.on = false;
    joy.x = 0;
    joy.y = 0;
    joy.id = -1;
  }

  function keyDown(code: string) {
    return scripted ? scripted.has(code) : held.has(code);
  }

  function pstar(id: PassiveId) {
    return passives.find((p) => p.id === id)?.star ?? 0;
  }

  function capFor(base: WeaponId) {
    return base === "tank" ? 3 : 5;
  }

  function canEvolve(w: Wep) {
    if (w.base === "staff") return false;
    return !w.evolved && w.star >= capFor(w.base) - 1;
  }

  function evolveNow(w: Wep) {
    if (w.evolved) return;
    w.evolved = true;
    w.star = capFor(w.base);
    w.id = EVO_OF[w.base];
    if (w.base === "soccer") {
      for (let i = 0; i < MAX_B; i++) if (bullets[i].kind === "ball") bullets[i].alive = false;
    }
    if (w.base === "tank") {
      player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.55);
      addTrauma(0.7);
    }
  }

  function raise(w: Wep, n: number) {
    if (w.evolved || n <= 0) return;
    const cap = capFor(w.base);
    w.star = Math.min(cap, w.star + n);
    if (w.base === "staff" && w.star >= cap) armorPending = armor === "none";
    if (w.base !== "staff" && w.star >= cap) {
      evolveNow(w);
      addTrauma(0.45);
      sfx.level();
    }
  }

  function recompute() {
    for (const w of weapons) w.perm = permBonus(w.base, meta.skills[w.base] ?? 0);
    const glove = pstar("glove") > 0 ? permBonus("glove", meta.skills.glove ?? 0) : null;
    const boots = pstar("boots") > 0 ? permBonus("boots", meta.skills.boots ?? 0) : null;
    const chrono = pstar("chrono") > 0 ? permBonus("chrono", meta.skills.chrono ?? 0) : null;
    const lens = pstar("lens") > 0 ? permBonus("lens", meta.skills.lens ?? 0) : null;
    const plate = pstar("plate") > 0 ? permBonus("plate", meta.skills.plate ?? 0) : null;
    const purse = pstar("purse") > 0 ? permBonus("purse", meta.skills.purse ?? 0) : null;
    const scope = pstar("scope") > 0 ? permBonus("scope", meta.skills.scope ?? 0) : null;
    const blood = pstar("blood") > 0 ? permBonus("blood", meta.skills.blood ?? 0) : null;
    const magnet = pstar("magnet") > 0 ? permBonus("magnet", meta.skills.magnet ?? 0) : null;
    const heart = pstar("heart") > 0 ? permBonus("heart", meta.skills.heart ?? 0) : null;
    const ammoP = pstar("ammo") > 0 ? permBonus("ammo", meta.skills.ammo ?? 0) : null;
    const scrollP = pstar("scroll") > 0 ? permBonus("scroll", meta.skills.scroll ?? 0) : null;
    stats.dmg = baseDmg * (1 + 0.12 * pstar("glove") + (glove?.dmg ?? 0)) * (1 + adrenaline);
    stats.speed = 200 * baseSpd * (1 + 0.08 * pstar("boots") + (boots?.spd ?? 0));
    stats.cdr = Math.max(0.38, 1 - 0.08 * pstar("chrono") - (chrono?.cdr ?? 0));
    stats.aoe = 1 + 0.12 * pstar("lens") + (lens?.aoe ?? 0);
    stats.taken = Math.max(0.28, 1 - 0.06 * pstar("plate") - (plate?.taken ?? 0));
    stats.xpMul = chapter.xp * (1 + 0.08 * pstar("purse") + (purse?.xp ?? 0));
    stats.crit = Math.min(
      0.62,
      0.06 * pstar("scope") + 0.03 * pstar("blood") + (scope?.crit ?? 0) + (blood?.crit ?? 0),
    );
    stats.magnet = baseMag + pstar("magnet") * 50 + (magnet?.magnet ?? 0) + magnetBonus;
    const ammo = pstar("ammo");
    stats.proj = (ammo >= 5 ? 3 : ammo >= 3 ? 2 : ammo >= 1 ? 1 : 0) + Math.round(ammoP?.proj ?? 0);
    const scroll = pstar("scroll");
    stats.pierce = (scroll >= 5 ? 3 : scroll >= 3 ? 2 : scroll >= 1 ? 1 : 0) + Math.round(scrollP?.pierce ?? 0);
    stats.ls = (weapons.some((w) => w.id === "demon") ? 0.08 : 0) + pstar("blood") * 0.012 + (blood?.ls ?? 0);
    const max = runBaseHp + pstar("heart") * 25 + (heart?.hp ?? 0);
    const hull = weapons.find((w) => w.base === "tank");
    if (hull?.id === "ufo") {
      stats.taken *= 0.62;
      stats.speed *= 1.04;
    } else if (hull) {
      stats.taken *= 0.58;
      stats.speed *= 0.86;
    }
    player.maxHp = max;
    player.hp = Math.min(player.hp, max);
    checkDragon();
  }

  function addTrauma(n: number) {
    trauma = Math.min(1, trauma + n);
  }

  function hashCell(cx: number, cy: number) {
    return (cx * 73856093) ^ (cy * 19349663);
  }

  function rebuildGrid() {
    grid.clear();
    for (let i = 0; i < MAX_E; i++) {
      const e = enemies[i];
      if (!e.alive) continue;
      const k = hashCell(Math.floor(e.x / CELL), Math.floor(e.y / CELL));
      const prev = grid.get(k);
      nextLink[i] = prev === undefined ? -1 : prev;
      grid.set(k, i);
    }
  }

  /**
   * Schreibt die Indizes aller lebenden Gegner in den Gitterzellen um (x, y)
   * in den Puffer `near` und gibt ihre Anzahl zurück. Der Aufrufer prüft die
   * genaue Distanz selbst.
   */
  function gather(x: number, y: number, rad: number) {
    const x0 = Math.floor((x - rad) / CELL);
    const x1 = Math.floor((x + rad) / CELL);
    const y0 = Math.floor((y - rad) / CELL);
    const y1 = Math.floor((y + rad) / CELL);
    let n = 0;
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        let i = grid.get(hashCell(cx, cy));
        if (i === undefined) continue;
        while (i !== -1) {
          if (enemies[i].alive) near[n++] = i;
          i = nextLink[i];
        }
      }
    }
    return n;
  }

  function nearest(x: number, y: number, maxDist: number, skip?: Set<Enemy>): Enemy | null {
    let best: Enemy | null = null;
    let bestD = maxDist * maxDist;
    const n = gather(x, y, maxDist);
    for (let k = 0; k < n; k++) {
      const e = enemies[near[k]];
      if (skip?.has(e)) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  function allocE() {
    for (let n = 0; n < MAX_E; n++) {
      const i = (eCursor + n) % MAX_E;
      if (!enemies[i].alive) {
        eCursor = (i + 1) % MAX_E;
        return i;
      }
    }
    return -1;
  }

  function allocB() {
    for (let n = 0; n < MAX_B; n++) {
      const i = (bCursor + n) % MAX_B;
      if (!bullets[i].alive) {
        bCursor = (i + 1) % MAX_B;
        return i;
      }
    }
    return -1;
  }

  function clearHits(bi: number) {
    const b = bi * HITN;
    for (let k = 0; k < HITN; k++) hitIds[b + k] = -1;
  }

  function seenHit(bi: number, ei: number) {
    const b = bi * HITN;
    for (let k = 0; k < HITN; k++) if (hitIds[b + k] === ei) return true;
    return false;
  }

  function addHit(bi: number, ei: number) {
    const b = bi * HITN;
    for (let k = 0; k < HITN; k++) {
      if (hitIds[b + k] === -1) {
        hitIds[b + k] = ei;
        return;
      }
    }
    for (let k = HITN - 1; k > 0; k--) hitIds[b + k] = hitIds[b + k - 1];
    hitIds[b] = ei;
  }

  function spawnBit(x: number, y: number, color: string, n: number, speed: number) {
    for (let k = 0; k < n; k++) {
      // Ringpuffer: bei vollem Pool wird das älteste Partikel ersetzt.
      const p = bits[pCursor];
      pCursor = (pCursor + 1) % MAX_P;
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random());
      p.alive = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      p.life = 0.28 + Math.random() * 0.25;
      p.max = p.life;
      p.color = color;
      p.s = 3 + Math.random() * 4;
    }
  }

  function spawnText(x: number, y: number, text: string, tone: 0 | 1 | 2) {
    if (tone === 0 && textsFrame > 28) return;
    textsFrame++;
    let slot = -1;
    let oldest = 0;
    let oldestLife = 99;
    for (let i = 0; i < MAX_T; i++) {
      if (!floats[i].alive) {
        slot = i;
        break;
      }
      if (floats[i].life < oldestLife) {
        oldestLife = floats[i].life;
        oldest = i;
      }
    }
    if (slot < 0) slot = oldest;
    const f = floats[slot];
    f.alive = true;
    f.x = x + (Math.random() * 10 - 5);
    f.y = y;
    f.vy = -48 - Math.random() * 20;
    f.life = 0.55;
    f.text = text;
    f.tone = tone;
  }

  function dropGem(x: number, y: number, kind: 0 | 1 | 2 | 3) {
    const xpVal = (time >= 180 ? [2, 5, 12, 30] : [1, 2, 6, 18])[kind];
    let slot = -1;
    for (let i = 0; i < MAX_G; i++)
      if (!gems[i].alive) {
        slot = i;
        break;
      }
    if (slot < 0) {
      addXp(xpVal);
      return;
    }
    const g = gems[slot];
    const a = Math.random() * Math.PI * 2;
    const sp = 30 + Math.random() * 90;
    g.alive = true;
    g.x = x;
    g.y = y;
    g.vx = Math.cos(a) * sp;
    g.vy = Math.sin(a) * sp;
    g.kind = kind;
    g.xp = xpVal;
    g.magnet = false;
    g.r = [6, 8, 9, 11][kind];
  }

  function spawnZone(x: number, y: number, r: number, dmg: number, life: number, every: number, fire = true) {
    let slot = -1;
    for (let i = 0; i < MAX_Z; i++)
      if (!zones[i].alive) {
        slot = i;
        break;
      }
    if (slot < 0) return;
    const z = zones[slot];
    z.alive = true;
    z.x = x;
    z.y = y;
    z.r = r;
    z.dmg = dmg;
    z.life = life;
    z.every = every;
    z.acc = every;
    z.fire = fire;
  }

  function addFlash(x1: number, y1: number, x2: number, y2: number) {
    let f = flashes[0];
    for (let i = 0; i < MAX_F; i++) {
      if (!flashes[i].alive) {
        f = flashes[i];
        break;
      }
    }
    f.alive = true;
    f.x1 = x1;
    f.y1 = y1;
    f.x2 = x2;
    f.y2 = y2;
    f.life = 0.12;
  }

  function wakeBullet(kind: Bullet["kind"]): { b: Bullet; i: number } | null {
    const i = allocB();
    if (i < 0) return null;
    const b = bullets[i];
    b.alive = true;
    b.kind = kind;
    b.age = 0;
    b.returning = false;
    b.homing = 0;
    b.gid = 0;
    b.pierce = 1;
    clearHits(i);
    return { b, i };
  }

  function roll(base: number, star: number) {
    const starMul = 1 + Math.max(0, star - 1) * 0.16;
    const pace = time < 90 ? 0.9 : time < 180 ? 0.74 : time < 300 ? 0.5 : time < 480 ? 0.56 : time < 660 ? 0.7 : 0.86;
    const scaled = base * starMul * stats.dmg * pace;
    const crit = Math.random() < stats.crit;
    return { dmg: scaled * (crit ? 2 : 1), crit };
  }

  /** Schaden ist im Spiel und während der Lucky-Belohnung (Raketen, Blitze) erlaubt. */
  function canDamage() {
    return mode === "play" || mode === "lucky";
  }

  function hurt(e: Enemy, amount: number, crit: boolean, knock = 26) {
    if (!e.alive || amount <= 0 || !canDamage()) return;
    if (e.tier === 0 && e.cdH > 0) return;
    let dmg = amount;
    if (e.shield > 0) {
      const absorbed = Math.min(e.shield, dmg);
      e.shield -= absorbed;
      dmg -= absorbed;
      if (dmg <= 0) return;
    }
    if (e.tier === 0 && e.grade === 4) dmg *= 0.6;
    else if (e.tier === 0 && e.grade === 2) dmg *= 0.78;
    e.hp -= dmg;
    if (e.tier === 0) e.cdH = e.grade >= 4 ? 0.1 : 0.12;
    e.flash = 0.08;
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const len = Math.hypot(dx, dy) || 1;
    const knockScale = e.grade === 4 ? 0.35 : e.grade === 2 ? 0.7 : 1;
    e.kx += (dx / len) * knock * knockScale;
    e.ky += (dy / len) * knock * knockScale;
    const shown = Math.max(1, Math.round(dmg));
    const tone: 0 | 1 | 2 = shown >= 58 ? 2 : crit ? 1 : shown >= 46 ? 2 : 0;
    spawnText(e.x, e.y - e.r, String(shown), tone);
    lifeBank = Math.min(48, lifeBank + dmg * stats.ls);
    sfx.hit();
    if (e.hp <= 0) kill(e);
  }

  function kill(e: Enemy) {
    if (!e.alive) return;
    e.alive = false;
    enemyCount = Math.max(0, enemyCount - 1);
    if (e.member) {
      e.member = false;
      waveAlive = Math.max(0, waveAlive - 1);
    }
    kills++;
    const col = e.tier === 3 ? PINK : e.grade === 4 ? DANGER : e.tier === 1 ? YELLOW : ENEMY_BASE[e.kind].color;
    spawnBit(e.x, e.y, col, e.tier > 0 ? 10 : 5, e.tier > 0 ? 160 : 90);
    if (e.tier === 3) {
      for (let i = 0; i < 8; i++) dropGem(e.x, e.y, 3);
      bossesKilled++;
      calm = 7;
      if (bossI >= 0 && enemies[bossI] === e) bossI = -1;
      hitstop = Math.max(hitstop, 0.07);
      addTrauma(0.85);
      sfx.big();
      queueLucky(true);
    } else if (e.tier === 2) {
      dropGem(e.x, e.y, 2);
      dropGem(e.x, e.y, 2);
      dropGem(e.x, e.y, 3);
      addTrauma(0.4);
      sfx.big();
      if (Math.random() < 0.45) queueLucky(false);
    } else if (e.tier === 1) {
      dropGem(e.x, e.y, 2);
      dropGem(e.x, e.y, 2);
      dropGem(e.x, e.y, 1);
      if (Math.random() < 0.35) dropGem(e.x, e.y, 3);
      addTrauma(0.28);
      hitstop = Math.max(hitstop, 0.035);
      sfx.die();
      if (Math.random() < 0.28) queueLucky(false);
    } else {
      dropGem(e.x, e.y, e.xpKind);
      if (Math.random() < 0.2) addTrauma(0.04);
      sfx.die();
    }
    let gold = e.coin;
    if (time >= 180) gold += e.tier === 0 ? (time >= 480 ? 2 : 1) : 2;
    if (gold > 0) {
      grantCoins(gold);
      spawnText(e.x, e.y - e.r - 8, `+${gold}`, gold >= 4 ? 1 : 0);
      sfx.coin();
    }
  }

  function hurtPlayer(amount: number) {
    if (mode !== "play" || amount <= 0 || grace > 0) return;
    player.hp -= amount;
    player.flash = 0.14;
    quiet = 0;
    sfx.hurt();
    addTrauma(0.3);
    if (player.hp <= 0) {
      player.hp = 0;
      mode = "dying";
      deathT = 0.28;
      releaseJoy();
      hooks.onMode("dying");
    }
  }

  function addXp(n: number) {
    let mul = stats.xpMul;
    if (time >= 180) {
      const mins = (time - 180) / 60;
      mul *= Math.min(2.05, 1.5 + mins * 0.09);
    }
    xp += n * mul;
    let guard = 0;
    while (xp >= xpNeed && level < 60 && guard++ < 8) {
      xp -= xpNeed;
      level++;
      pendingLevels++;
      xpNeed = xpFor(level);
      player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.08);
    }
  }

  function queueLucky(force: boolean) {
    if (!force && luckyQueue >= 2) return;
    luckyQueue++;
  }

  function grantCoins(n: number) {
    if (n <= 0) return;
    bonusCoins += n;
    meta = { ...meta, coins: meta.coins + n };
    coinPending = true;
  }

  function flushCoins(force = false) {
    if (!coinPending) return;
    if (!force && coinSaveT > 0) return;
    coinPending = false;
    coinSaveT = 1.25;
    saveMeta(meta);
    hooks.onMeta(meta);
  }

  function configureEnemy(i: number, x: number, y: number, kind: EnemyKind, tier: 0 | 1 | 2, grade: 1 | 2 | 3 | 4 = 1) {
    const base = ENEMY_BASE[kind];
    const e = enemies[i];
    const wave = WAVES[waveIndexAt()];
    e.alive = true;
    e.x = x;
    e.y = y;
    e.kind = kind;
    e.tier = tier;
    e.grade = grade;
    e.variant = 0;
    e.flash = 0;
    e.wobble = Math.random() * Math.PI * 2;
    e.atk = 0.8 + Math.random() * 1.4;
    e.kx = 0;
    e.ky = 0;
    e.cdO = e.cdF = e.cdG = e.cdS = e.cdZ = e.cdH = 0;
    e.shield = 0;
    e.maxShield = 0;
    e.tele = 0;
    e.teleKind = 0;
    e.slashId = 0;
    e.coin = 0;
    e.member = markWave;
    e.burn = 0;
    e.burnDps = 0;
    e.burnAcc = 0;
    e.chill = 0;
    if (markWave) {
      markWave = false;
      waveSpawned++;
      waveAlive++;
    }
    const mul = chapter.hp * wave.hp * (1 + time / 320);
    const speedJ = 0.92 + Math.random() * 0.16;
    if (tier === 2) {
      e.grade = 3;
      e.r = 34;
      e.maxHp = 980 * chapter.hp * (1 + time / 240);
      e.speed = 62;
      e.dmg = 14 * chapter.dmg * (1 + time / 480);
      e.xpKind = 3;
      e.coin = 8;
    } else if (tier === 1) {
      e.grade = 2;
      e.r = base.r * 1.72;
      e.maxHp = base.hp * 9 * mul;
      e.speed = base.speed * 0.9;
      e.dmg = base.dmg * 1.55 * chapter.dmg * (1 + time / 420);
      e.xpKind = 2;
      e.coin = 4;
    } else if (tier === 0) {
      const ch = chapter.hp;
      const dm = chapter.dmg;
      if (grade === 4) {
        e.kind = "mutant";
        e.r = 22;
        e.maxHp = 230 * ch;
        e.speed = 64 * speedJ;
        e.dmg = 16 * dm;
        e.xpKind = 2;
        e.coin = 3;
      } else if (grade === 3) {
        e.kind = "mutant";
        e.r = 18;
        e.maxHp = 120 * ch;
        e.speed = 76 * speedJ;
        e.dmg = 12 * dm;
        e.xpKind = 1;
        e.coin = 1;
      } else if (grade === 2) {
        e.kind = "bug";
        e.r = 16;
        e.maxHp = 48 * ch;
        e.speed = 62 * speedJ;
        e.dmg = 9 * dm;
        e.xpKind = 1;
        e.coin = 1;
      } else {
        e.grade = 1;
        e.kind = "zombie";
        e.r = 15;
        e.maxHp = 14 * ch;
        e.speed = 34 * speedJ;
        e.dmg = 5 * dm;
        e.xpKind = 0;
        e.coin = 0;
      }
    }
    e.hp = e.maxHp;
    enemyCount++;
  }

  function tally() {
    const c = { n: 0, g2: 0, g3: 0, g4: 0 };
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.alive) continue;
      c.n++;
      if (e.tier !== 0) continue;
      if (e.grade === 4) c.g4++;
      else if (e.grade === 3) c.g3++;
      else if (e.grade === 2) c.g2++;
    }
    return c;
  }

  function chooseGrade(c: { g2: number; g3: number; g4: number }): 1 | 2 | 3 | 4 {
    const r = Math.random();
    const g2cap = waveNo >= 1 ? Math.min(16, 3 + waveNo * 2) : 0;
    const g3cap = waveNo >= 2 ? Math.min(10, waveNo) : 0;
    const g4cap = waveNo >= 4 ? Math.min(6, waveNo - 3) : 0;
    if (g4cap > 0 && c.g4 < g4cap && c.g2 + c.g3 <= 10 && r < 0.05 + waveNo * 0.006) return 4;
    if (g3cap > 0 && c.g3 < g3cap && r < 0.1 + waveNo * 0.012) return 3;
    if (g2cap > 0 && c.g2 < g2cap && r < 0.2 + waveNo * 0.018) return 2;
    return 1;
  }

  function pickMob(grade: 1 | 2 | 3 | 4): { kind: EnemyKind; grade: 1 | 2 | 3 | 4 } {
    if (grade === 4) return { kind: "mutant", grade };
    if (grade === 3) return { kind: "mutant", grade };
    if (grade === 2) return { kind: "bug", grade };
    return { kind: "zombie", grade: 1 };
  }

  function ringPos(ang: number, pad = 22) {
    const hw = viewW / 2 + pad;
    const hh = viewH / 2 + pad;
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const tx = Math.abs(c) < 1e-4 ? 1e9 : hw / Math.abs(c);
    const ty = Math.abs(s) < 1e-4 ? 1e9 : hh / Math.abs(s);
    const edge = Math.min(tx, ty);
    const t = Math.min(edge, Math.min(viewW, viewH) * 0.5);
    return { x: player.x + c * t, y: player.y + s * t };
  }

  function spawnEdge(kind: EnemyKind, tier: 0 | 1 | 2, grade: 1 | 2 | 3 | 4 = 1) {
    if (enemyCount >= MAX_E - 2) return;
    const i = allocE();
    if (i < 0) return;
    const p = ringPos(Math.random() * Math.PI * 2, tier > 0 ? 36 : 20);
    configureEnemy(i, p.x, p.y, kind, tier, grade);
  }

  function spawnRing(n: number) {
    const baseAng = Math.random() * Math.PI * 2;
    const cap = WAVES[waveIndexAt()].maxAlive;
    for (let k = 0; k < n; k++) {
      if (enemyCount >= cap || enemyCount >= MAX_E - 2) return;
      const i = allocE();
      if (i < 0) return;
      const mob = pickMob(1);
      const ang = baseAng + (k / Math.max(1, n)) * Math.PI * 2;
      const p = ringPos(ang, 16);
      configureEnemy(i, p.x, p.y, mob.kind, 0, mob.grade);
    }
  }

  function spawnAdds(x: number, y: number, n: number) {
    const cap = WAVES[waveIndexAt()].maxAlive;
    const room = Math.min(n, 4);
    for (let k = 0; k < room; k++) {
      if (enemyCount >= cap || enemyCount >= MAX_E - 2) return;
      const i = allocE();
      if (i < 0) return;
      const a = Math.random() * Math.PI * 2;
      configureEnemy(i, x + Math.cos(a) * 30, y + Math.sin(a) * 30, "zombie", 0, 1);
    }
  }

  function spawnBoss(which: number) {
    const i = allocE();
    if (i < 0) return;
    const e = enemies[i];
    const ang = Math.random() * Math.PI * 2;
    const dist = Math.hypot(viewW, viewH) * 0.5 + 10;
    const hp = [3600, 6200, 9400][which] * chapter.hp * (1 + time / 700);
    e.alive = true;
    e.x = player.x + Math.cos(ang) * dist;
    e.y = player.y + Math.sin(ang) * dist;
    e.kind = which === 1 ? "bug" : which === 2 ? "robot" : "mutant";
    e.tier = 3;
    e.r = 56;
    e.maxHp = hp;
    e.hp = hp;
    e.speed = 44;
    e.dmg = 18 * chapter.dmg;
    e.flash = 0;
    e.wobble = 0;
    e.atk = 1.1;
    e.kx = 0;
    e.ky = 0;
    e.cdO = e.cdF = e.cdG = e.cdS = e.cdZ = e.cdH = 0;
    e.shield = hp * 0.3;
    e.maxShield = e.shield;
    e.variant = which;
    e.tele = 0;
    e.teleKind = 0;
    e.slashId = 0;
    e.xpKind = 3;
    e.coin = 25;
    e.grade = 1;
    e.member = false;
    e.burn = 0;
    e.burnDps = 0;
    e.burnAcc = 0;
    e.chill = 0;
    enemyCount++;
    bossI = i;
    addTrauma(0.45);
  }

  function waveIndexAt() {
    return Math.min(WAVES.length - 1, waveNo);
  }

  function waveQuota(n: number) {
    const table = [25, 45, 70, 100];
    if (n < table.length) return table[n];
    let count = 100;
    for (let i = 4; i <= n; i++) count += 30 + (i - 3) * 5;
    return count;
  }

  function beginWave() {
    waveGoal = waveQuota(waveNo);
    waveSpawned = 0;
    waveAlive = 0;
    waveGap = 0;
  }

  function screenCap() {
    const stars = maxedSkills();
    let cap = Math.min(waveGoal, 18 + waveNo * 12);
    if (time >= 420 || stars >= 2) cap = Math.min(waveGoal, Math.max(cap, 54));
    if (waveNo >= 3) cap = Math.min(waveGoal, Math.max(cap, 64));
    if (stars >= 3 && quiet >= 12) cap = Math.min(waveGoal, Math.max(cap, quiet >= 24 ? 100 : 82));
    return Math.min(100, cap);
  }

  function spawnMember(kind: EnemyKind, tier: 0 | 1 | 2, grade: 1 | 2 | 3 | 4) {
    if (waveSpawned >= waveGoal || enemyCount >= MAX_E - 2) return false;
    const before = enemyCount;
    markWave = true;
    spawnEdge(kind, tier, grade);
    if (enemyCount === before) {
      markWave = false;
      return false;
    }
    return true;
  }

  function bossAlive() {
    return bossI >= 0 && enemies[bossI].alive && enemies[bossI].tier === 3;
  }

  function aimDir(auto: boolean) {
    if (auto) {
      const t = nearest(player.x, player.y, 560);
      if (t) return Math.atan2(t.y - player.y, t.x - player.x);
    }
    const moving = player.vx * player.vx + player.vy * player.vy > 80;
    if (!moving) {
      const t = nearest(player.x, player.y, 480);
      if (t) return Math.atan2(t.y - player.y, t.x - player.x);
    }
    return player.facing;
  }

  function firePellet(
    x: number,
    y: number,
    ang: number,
    hit: { dmg: number; crit: boolean },
    speed: number,
    life: number,
    r: number,
    pierce = 1,
  ) {
    const slot = wakeBullet("pellet");
    if (!slot) return;
    const b = slot.b;
    b.x = x;
    b.y = y;
    b.ang = ang;
    b.speed = speed;
    b.vx = Math.cos(ang) * speed;
    b.vy = Math.sin(ang) * speed;
    b.dmg = hit.dmg;
    b.crit = hit.crit;
    b.life = life;
    b.r = r;
    b.pierce = pierce;
  }

  function spawnShock(x: number, y: number, max: number, hue = 0) {
    let slot = 0;
    for (let i = 0; i < shocks.length; i++) {
      if (!shocks[i].alive) {
        slot = i;
        break;
      }
      if (shocks[i].life < shocks[slot].life) slot = i;
    }
    const s = shocks[slot];
    s.alive = true;
    s.x = x;
    s.y = y;
    s.max = max;
    s.life = 0.42;
    s.hue = hue;
  }

  function ignite(e: Enemy, power: number) {
    e.burn = Math.max(e.burn, 1.7);
    e.burnDps = Math.max(e.burnDps, power * 0.45);
  }

  function chill(e: Enemy) {
    e.chill = Math.max(e.chill, 1.7);
  }

  function scorch(e: Enemy, amount: number) {
    if (!e.alive || amount <= 0 || !canDamage()) return;
    e.hp -= amount;
    if (textsFrame < 10) spawnText(e.x, e.y - e.r, String(Math.max(1, Math.round(amount))), 0);
    if (e.hp <= 0) kill(e);
  }

  function castStaff(w: Wep) {
    const perm = w.perm;
    const aoe = stats.aoe * (1 + perm.aoe);
    const cdr = Math.max(0.42, 1 - perm.cdr);
    const extra = Math.max(0, Math.round(perm.count));
    const mace = w.star >= 3;
    w.cd = Math.max(0.82, 1.55 - (w.star - 1) * 0.16) * cdr * stats.cdr;
    const aim = player.facing;
    staffAim = aim;
    if (mace) {
      const clad = armor === "fire" || armor === "ice";
      const boost = clad ? 1.42 : 1;
      const n = 1 + Math.min(1, extra);
      const size = (46 + (w.star - 3) * 9) * (1 + perm.aoe * 0.3) * (clad ? 1.16 : 1);
      for (let i = 0; i < n; i++) {
        const a = aim + (i - (n - 1) / 2) * 0.22;
        const hit = roll(26 * (1 + perm.dmg) * boost, w.star);
        const slot = wakeBullet(armor === "ice" ? "ice" : "fire");
        if (!slot) break;
        const speed = 250 * (1 + perm.spd * 0.35);
        slot.b.x = player.x + Math.cos(a) * 26;
        slot.b.y = player.y + Math.sin(a) * 26;
        slot.b.ang = a;
        slot.b.speed = speed;
        slot.b.vx = Math.cos(a) * speed;
        slot.b.vy = Math.sin(a) * speed;
        slot.b.dmg = hit.dmg;
        slot.b.crit = hit.crit;
        slot.b.life = 0.85;
        slot.b.r = size;
        slot.b.pierce = 24;
        slot.b.gid = armor === "ice" ? 3 : 2;
      }
      const radius = (74 + (w.star - 3) * 18) * aoe * (armor === "ice" ? 1.28 : armor === "fire" ? 1.12 : 1);
      const hit = roll((8 + w.star) * (1 + perm.dmg) * boost, w.star);
      spawnShock(player.x, player.y, radius, armor === "ice" ? 2 : armor === "fire" ? 1 : 0);
      {
        const n = gather(player.x, player.y, radius + 16);
        for (let k = 0; k < n; k++) {
          const e = enemies[near[k]];
          const dx = e.x - player.x;
          const dy = e.y - player.y;
          const lim = radius + e.r * 0.4;
          if (dx * dx + dy * dy <= lim * lim) {
            hurt(e, hit.dmg, hit.crit, 12);
            if (armor === "fire") ignite(e, hit.dmg);
            if (armor === "ice") chill(e);
          }
        }
      }
    } else {
      const n = 1 + Math.min(2, extra);
      const size = 8 + (w.star - 1) * 1.15;
      for (let i = 0; i < n; i++) {
        const a = aim + (i - (n - 1) / 2) * 0.16;
        const hit = roll(20 * (1 + perm.dmg), w.star);
        const slot = wakeBullet("fire");
        if (!slot) break;
        const speed = 360 * (1 + perm.spd * 0.45);
        slot.b.x = player.x + Math.cos(a) * 22;
        slot.b.y = player.y + Math.sin(a) * 22;
        slot.b.ang = a;
        slot.b.speed = speed;
        slot.b.vx = Math.cos(a) * speed;
        slot.b.vy = Math.sin(a) * speed;
        slot.b.dmg = hit.dmg;
        slot.b.crit = hit.crit;
        slot.b.life = 1.35;
        slot.b.r = size;
        slot.b.pierce = 2;
        slot.b.gid = 0;
      }
    }
    if (mace) sfx.wave();
    else sfx.shoot();
  }

  function tickWeapons(dt: number) {
    gN = 0;
    oN = 0;
    dN = 0;
    forceOn = false;
    forceEvo = false;
    bladeHot = false;
    bladeScale = 1;
    shieldStar = false;
    shieldScale = 1;
    droneScale = 1;
    form = "hero";
    player.r = 15;
    for (const w of weapons) {
      const perm = w.perm;
      const aoe = stats.aoe * (1 + perm.aoe);
      const cdr = Math.max(0.42, 1 - perm.cdr);
      const extra = Math.round(perm.count);
      const spin = (w.evolved ? 4.6 : 2.05 + w.star * 0.2) * (1 + perm.spd * 0.35);
      w.angle += dt * spin;
      w.cd -= dt;
      const id = w.id;
      const pow = (base: number) => base * (1 + perm.dmg);

      if (id === "staff") {
        staffAim = player.facing;
        if (!dragonForm && w.cd <= 0) castStaff(w);
      } else if (id === "katana" || id === "demon") {
        const demon = id === "demon";
        bladeHot = demon;
        bladeScale = demon ? 1.85 : 0.82 + w.star * 0.08;
        const orbitN = Math.min(10, (demon ? 6 : Math.max(1, w.star)) + (demon ? 0 : extra));
        const rad = (demon ? 86 : 68) * aoe;
        const hitR = demon ? 26 : 18;
        for (let i = 0; i < orbitN && oN < 12; i++) {
          const a = w.angle + (i * Math.PI * 2) / Math.max(1, orbitN);
          const x = player.x + Math.cos(a) * rad;
          const y = player.y + Math.sin(a) * rad;
          ox[oN] = x;
          oy[oN] = y;
          oN++;
          {
            const n = gather(x, y, hitR + 18);
            for (let k = 0; k < n; k++) {
              const e = enemies[near[k]];
              if (e.cdO > 0) continue;
              const dx = e.x - x;
              const dy = e.y - y;
              if (dx * dx + dy * dy <= (hitR + e.r) * (hitR + e.r)) {
                e.cdO = demon ? 0.22 : 0.32;
                const hit = roll(pow(demon ? 18 : 10), w.star);
                hurt(e, hit.dmg, hit.crit, demon ? 56 : 40);
              }
            }
          }
        }
        if (w.cd <= 0) {
          w.cd = (demon ? 0.42 : Math.max(0.55, 0.9 - w.star * 0.05)) * cdr * stats.cdr;
          const aim = aimDir(false);
          const gid = ++gidSeq;
          const size = (demon ? 1.7 : 0.92 + w.star * 0.05) * (1 + perm.aoe);
          const base = pow(demon ? 26 : 16);
          shootSlash(aim, base, w.star, gid, size);
          shootSlash(aim + Math.PI, base * 0.9, w.star, gid, size);
          if (demon) shootSlash(aim + Math.PI / 2, base * 0.75, w.star, gid, size * 0.8);
          sfx.slash();
        }
      } else if (id === "shotgun" || id === "gatling") {
        if (w.cd <= 0) {
          if (id === "gatling") {
            w.cd = 0.05 * cdr * stats.cdr;
            const aim = aimDir(true);
            const n = 3 + extra;
            for (let i = 0; i < n; i++) {
              const a = aim + (i - (n - 1) / 2) * 0.08;
              firePellet(player.x, player.y, a, roll(pow(7.2), w.star), 740 * (1 + perm.spd), 0.48, 5.2);
            }
            sfx.shoot();
          } else {
            w.cd = Math.max(0.36, 1.02 - w.star * 0.11) * cdr * stats.cdr;
            const aim = aimDir(false);
            const pellets = 2 + w.star + extra + Math.min(3, stats.proj);
            const spread = 0.72;
            for (let i = 0; i < pellets; i++) {
              const a = aim + (i - (pellets - 1) / 2) * (spread / Math.max(1, pellets - 1));
              firePellet(player.x, player.y, a, roll(pow(6.4), w.star), 520 * (1 + perm.spd), 0.38, 5);
            }
            sfx.shoot();
          }
        }
      } else if (id === "kunai" || id === "shuriken") {
        if (w.cd <= 0) {
          const evo = id === "shuriken";
          w.cd = (evo ? 0.13 : Math.max(0.28, 0.52 - w.star * 0.03)) * cdr * stats.cdr;
          const n = Math.min(8, (evo ? 4 : w.star) + extra);
          const pierce = Math.min(16, (evo ? 6 : 1) + stats.pierce + Math.round(perm.pierce) + Math.floor(w.star / 2));
          for (let i = 0; i < n; i++) {
            const target = nearest(player.x, player.y, 680);
            let a = target ? Math.atan2(target.y - player.y, target.x - player.x) : player.facing;
            a += (i - (n - 1) / 2) * (evo ? 0.18 : 0.16);
            const slot = wakeBullet("knife");
            if (!slot) break;
            const hit = roll(pow(evo ? 13 : 15), w.star);
            const speed = (evo ? 720 : 540) * (1 + perm.spd);
            slot.b.x = player.x;
            slot.b.y = player.y;
            slot.b.ang = a;
            slot.b.speed = speed;
            slot.b.vx = Math.cos(a) * speed;
            slot.b.vy = Math.sin(a) * speed;
            slot.b.dmg = hit.dmg;
            slot.b.crit = hit.crit;
            slot.b.life = 1.1;
            slot.b.r = evo ? 11 : 6;
            slot.b.pierce = pierce;
            slot.b.homing = evo ? 8 : 3.2;
          }
          sfx.knife();
        }
      } else if (id === "guardian" || id === "starwheel") {
        const star = id === "starwheel";
        shieldStar = star;
        shieldScale = star ? 1.75 : 0.78 + w.star * 0.08;
        const n = star ? 1 : Math.min(8, w.star + extra);
        const rad = (star ? 112 : 84) * aoe;
        const hitR = star ? 36 : 18;
        for (let i = 0; i < n && gN < 8; i++) {
          const a = w.angle * (star ? 1.35 : 1) + (i * Math.PI * 2) / n;
          const x = player.x + Math.cos(a) * rad;
          const y = player.y + Math.sin(a) * rad;
          gx[gN] = x;
          gy[gN] = y;
          gN++;
          {
            const n = gather(x, y, hitR + 16);
            for (let k = 0; k < n; k++) {
              const e = enemies[near[k]];
              if (e.cdG > 0) continue;
              const dx = e.x - x;
              const dy = e.y - y;
              if (dx * dx + dy * dy <= (hitR + e.r) * (hitR + e.r)) {
                e.cdG = star ? 0.16 : 0.34;
                const hit = roll(pow(star ? 170 : 11), w.star);
                hurt(e, hit.dmg, hit.crit, star ? 70 : 48);
              }
            }
          }
        }
      } else if (id === "force" || id === "aegis") {
        const aegis = id === "aegis";
        forceOn = true;
        forceEvo = aegis;
        forceR = (aegis ? 124 : 44 + w.star * 10) * aoe;
        if (w.cd <= 0) {
          w.cd = (aegis ? 0.26 : 0.44) * cdr * stats.cdr;
          const hit = roll(pow(aegis ? 18 : 7 + w.star), w.star);
          const capN = aegis ? 8 : 5;
          const cand: { e: Enemy; d: number }[] = [];
          {
            const n = gather(player.x, player.y, forceR + 24);
            for (let k = 0; k < n; k++) {
              const e = enemies[near[k]];
              if (e.cdF > 0) continue;
              const dx = e.x - player.x;
              const dy = e.y - player.y;
              const d2 = dx * dx + dy * dy;
              const lim = forceR + e.r;
              if (d2 > lim * lim) continue;
              if (cand.length < 20) cand.push({ e, d: d2 });
              else {
                let far = 0;
                for (let i = 1; i < cand.length; i++) if (cand[i].d > cand[far].d) far = i;
                if (d2 < cand[far].d) cand[far] = { e, d: d2 };
              }
            }
          }
          cand.sort((a, b) => a.d - b.d);
          const nHit = Math.min(capN, cand.length);
          for (let i = 0; i < nHit; i++) {
            const e = cand[i].e;
            e.cdF = aegis ? 0.26 : 0.44;
            hurt(e, hit.dmg, hit.crit, aegis ? 14 : 8);
          }
        }
      } else if (id === "molotov" || id === "inferno") {
        if (w.cd <= 0) {
          const inferno = id === "inferno";
          w.cd = (inferno ? 1.05 : Math.max(0.9, 1.7 - w.star * 0.08)) * cdr * stats.cdr;
          const throws = inferno ? 1 : Math.min(3, 1 + Math.floor((w.star - 1) / 2) + extra);
          const t = nearest(player.x, player.y, 460);
          const baseA = t ? Math.atan2(t.y - player.y, t.x - player.x) : player.facing;
          for (let i = 0; i < throws; i++) {
            const a = baseA + (i - (throws - 1) / 2) * 0.45;
            const dist = t ? 0 : 130;
            const x = (t && i === 0 ? t.x : player.x) + Math.cos(a) * (i === 0 && t ? 10 : dist);
            const y = (t && i === 0 ? t.y : player.y) + Math.sin(a) * (i === 0 && t ? 10 : dist);
            const hit = roll(pow(inferno ? 20 : 11), w.star);
            spawnZone(
              x,
              y,
              (inferno ? 128 : 50 + w.star * 10) * aoe,
              hit.dmg,
              inferno ? 4.2 : 2.2 + w.star * 0.12,
              inferno ? 0.22 : 0.32,
              true,
            );
          }
        }
      } else if (id === "lightning" || id === "storm") {
        if (w.cd <= 0) {
          const storm = id === "storm";
          w.cd = (storm ? 0.48 : Math.max(0.4, 1.12 - w.star * 0.08)) * cdr * stats.cdr;
          let x = player.x;
          let y = player.y;
          const banned = new Set<Enemy>();
          const chains = Math.min(14, storm ? 8 + extra : w.star + extra);
          for (let c = 0; c < chains; c++) {
            const t = nearest(x, y, storm ? 300 : 230, banned);
            if (!t) break;
            addFlash(x, y, t.x, t.y);
            const hit = roll(pow(storm ? 30 : 20), w.star);
            hurt(t, hit.dmg, hit.crit, 12);
            banned.add(t);
            x = t.x;
            y = t.y;
          }
          sfx.shoot();
        }
      } else if (id === "drones" || id === "titan") {
        const titan = id === "titan";
        droneScale = titan ? 2.35 : 1;
        const n = titan ? 1 : Math.min(6, w.star + extra);
        const rad = (titan ? 80 : 56) * aoe;
        for (let i = 0; i < n && dN < 8; i++) {
          const a = w.angle * 0.85 + (i * Math.PI * 2) / n;
          dxs[dN] = player.x + Math.cos(a) * rad;
          dys[dN] = player.y + Math.sin(a) * rad;
          dN++;
        }
        if (w.cd <= 0) {
          w.cd = (titan ? 0.2 : 0.44) * cdr * stats.cdr;
          const shots = titan ? 3 + Math.min(3, extra) : 1;
          for (let i = 0; i < dN; i++) {
            const target = nearest(dxs[i], dys[i], 520);
            const aim = target ? Math.atan2(target.y - dys[i], target.x - dxs[i]) : player.facing;
            for (let s = 0; s < shots; s++) {
              const a = aim + (s - (shots - 1) / 2) * 0.12;
              firePellet(
                dxs[i],
                dys[i],
                a,
                roll(pow(titan ? 15 : 9), w.star),
                (titan ? 560 : 500) * (1 + perm.spd),
                0.75,
                titan ? 6.5 : 4.5,
              );
            }
          }
          sfx.shoot();
        }
      } else if (id === "boomerang" || id === "magnetboom") {
        if (w.cd <= 0) {
          const mag = id === "magnetboom";
          w.cd = (mag ? 0.62 : Math.max(0.62, 1.12 - w.star * 0.06)) * cdr * stats.cdr;
          const n = mag ? 2 : Math.min(4, w.star + extra);
          const aim = aimDir(true);
          for (let i = 0; i < n; i++) {
            const a = aim + (i - (n - 1) / 2) * 0.38;
            const slot = wakeBullet("boom");
            if (!slot) break;
            const hit = roll(pow(mag ? 22 : 14), w.star);
            const speed = (mag ? 310 : 340) * (1 + perm.spd);
            slot.b.x = player.x;
            slot.b.y = player.y;
            slot.b.ang = a;
            slot.b.speed = speed;
            slot.b.vx = Math.cos(a) * speed;
            slot.b.vy = Math.sin(a) * speed;
            slot.b.dmg = hit.dmg;
            slot.b.crit = hit.crit;
            slot.b.life = mag ? 1.8 : 1.45;
            slot.b.r = (mag ? 22 : 12) * (1 + perm.aoe * 0.45);
            slot.b.pierce = 16;
            slot.b.homing = mag ? 2.2 : 0;
          }
          sfx.slash();
        }
      } else if (id === "soccer" || id === "comet") {
        const comet = id === "comet";
        const want = comet ? 1 : Math.min(4, w.star + extra);
        let have = 0;
        for (let i = 0; i < MAX_B; i++) if (bullets[i].alive && bullets[i].kind === "ball") have++;
        if (have < want && w.cd <= 0) {
          w.cd = comet ? 0.2 : 0.35;
          const a = Math.random() * Math.PI * 2;
          const slot = wakeBullet("ball");
          if (slot) {
            const hit = roll(pow(comet ? 24 : 13), w.star);
            const speed = (comet ? 360 : 230 + w.star * 16) * (1 + perm.spd);
            slot.b.x = player.x + Math.cos(a) * 36;
            slot.b.y = player.y + Math.sin(a) * 36;
            slot.b.ang = a;
            slot.b.speed = speed;
            slot.b.vx = Math.cos(a) * speed;
            slot.b.vy = Math.sin(a) * speed;
            slot.b.dmg = hit.dmg;
            slot.b.crit = hit.crit;
            slot.b.life = 12;
            slot.b.r = (comet ? 28 : 12) * (1 + perm.aoe * 0.35);
            slot.b.pierce = 99;
          }
        }
      } else if (id === "tank" || id === "ufo") {
        const ufo = id === "ufo";
        form = ufo ? "ufo" : "tank";
        player.r = ufo ? 22 : 30;
        turret = aimDir(true);
        const crush = (ufo ? 82 : 48 + w.star * 10) * aoe;
        crushT -= dt;
        if (crushT <= 0) {
          crushT = ufo ? 0.22 : 0.24;
          crushVis = 0.22;
          crushR = crush;
          {
            const n = gather(player.x, player.y, crush + 30);
            for (let k = 0; k < n; k++) {
              const e = enemies[near[k]];
              const dx = e.x - player.x;
              const dy = e.y - player.y;
              if (dx * dx + dy * dy > (crush + e.r) * (crush + e.r)) continue;
              const hit = roll(pow(ufo ? 22 : 18 + w.star * 6), w.star);
              hurt(e, hit.dmg, hit.crit, ufo ? 70 : 110);
            }
          }
        }
        if (w.cd <= 0) {
          w.cd = (ufo ? 0.22 : Math.max(0.28, 0.62 - w.star * 0.12)) * cdr * stats.cdr;
          const aim = turret;
          if (ufo) {
            beamOn = 0.14;
            beamAng = aim;
            beamLen = 300 * aoe;
            {
              const n = gather(player.x, player.y, beamLen + 20);
              for (let k = 0; k < n; k++) {
                const e = enemies[near[k]];
                const dx = e.x - player.x;
                const dy = e.y - player.y;
                const dist = Math.hypot(dx, dy) || 1;
                if (dist > beamLen) continue;
                let diff = Math.atan2(dy, dx) - aim;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                if (Math.abs(diff) > 0.4) continue;
                const hit = roll(pow(36), w.star);
                hurt(e, hit.dmg, hit.crit, 16);
              }
            }
            for (let s = -1; s <= 1; s += 2) {
              const a = aim + s * 0.85;
              firePellet(player.x, player.y, a, roll(pow(14), w.star), 480, 0.5, 8, 2);
            }
            sfx.shoot();
          } else {
            const barrels = w.star >= 2 ? 2 : 1;
            for (let i = 0; i < barrels; i++) {
              const a = aim + (i - (barrels - 1) / 2) * 0.1;
              const hit = roll(pow(w.star >= 2 ? 74 : 52), w.star);
              firePellet(
                player.x + Math.cos(a) * 34,
                player.y + Math.sin(a) * 34,
                a,
                hit,
                480 * (1 + perm.spd),
                0.9,
                w.star >= 2 ? 18 : 15,
                w.star >= 2 ? 8 : 5,
              );
            }
            sfx.slash();
          }
        }
      }
    }
  }

  function shootSlash(ang: number, base: number, star: number, gid: number, size: number) {
    const slot = wakeBullet("slash");
    if (!slot) return;
    const hit = roll(base, star);
    const speed = 280;
    slot.b.x = player.x + Math.cos(ang) * 18;
    slot.b.y = player.y + Math.sin(ang) * 18;
    slot.b.ang = ang;
    slot.b.speed = speed;
    slot.b.vx = Math.cos(ang) * speed;
    slot.b.vy = Math.sin(ang) * speed;
    slot.b.dmg = hit.dmg;
    slot.b.crit = hit.crit;
    slot.b.life = 0.24;
    slot.b.r = 34 * stats.aoe * size;
    slot.b.gid = gid;
    slot.b.pierce = 99;
  }

  function tickBoss(e: Enemy, dt: number) {
    const mini = e.tier === 2;
    if (e.tele > 0) {
      e.tele -= dt;
      if (e.tele <= 0) {
        if (e.teleKind === 0) {
          const sp = mini ? 420 : 560;
          e.kx = Math.cos(e.dashAng) * sp;
          e.ky = Math.sin(e.dashAng) * sp;
        } else if (e.teleKind === 1) {
          spawnZone(e.markX, e.markY, (mini ? 78 : 120) * stats.aoe, e.dmg * 1.3, 0.22, 0.2, false);
          addTrauma(0.25);
          sfx.big();
        } else {
          spawnAdds(e.x, e.y, 6);
        }
      }
      return true;
    }
    e.atk -= dt;
    if (e.atk <= 0) {
      e.atk = mini ? 2.5 : e.variant === 1 ? 2.1 : 2.7;
      e.tele = mini ? 0.48 : 0.72;
      if (mini) e.teleKind = 0;
      else if (e.variant === 1) e.teleKind = Math.random() < 0.7 ? 0 : 1;
      else e.teleKind = Math.random() < 0.45 ? 0 : Math.random() < 0.7 ? 1 : 2;
      e.dashAng = Math.atan2(player.y - e.y, player.x - e.x);
      e.markX = player.x;
      e.markY = player.y;
    }
    return e.tele > 0;
  }

  function movePlayer(dt: number) {
    if (dragonForm) player.r = 22;
    let mx = 0;
    let my = 0;
    if (keyDown("KeyA") || keyDown("ArrowLeft")) mx -= 1;
    if (keyDown("KeyD") || keyDown("ArrowRight")) mx += 1;
    if (keyDown("KeyW") || keyDown("ArrowUp")) my -= 1;
    if (keyDown("KeyS") || keyDown("ArrowDown")) my += 1;
    if (mx !== 0 || my !== 0) {
      const l = Math.hypot(mx, my);
      mx /= l;
      my /= l;
    } else if (joy.on) {
      mx = joy.x;
      my = joy.y;
    }
    player.x += mx * stats.speed * dt;
    player.y += my * stats.speed * dt;
    player.vx = mx * stats.speed;
    player.vy = my * stats.speed;
    if (mx !== 0 || my !== 0) {
      player.facing = Math.atan2(my, mx);
      moved = true;
      footT -= dt;
      if (footT <= 0) {
        footT = 0.16;
        spawnBit(player.x, player.y + 10, "#ff7a2a", 1, 20);
      }
    }
    player.flash = Math.max(0, player.flash - dt);
  }

  function moveEnemies(dt: number) {
    for (let i = 0; i < MAX_E; i++) {
      const e = enemies[i];
      if (!e.alive) continue;
      e.flash = Math.max(0, e.flash - dt);
      e.cdO = Math.max(0, e.cdO - dt);
      e.cdF = Math.max(0, e.cdF - dt);
      e.cdG = Math.max(0, e.cdG - dt);
      e.cdS = Math.max(0, e.cdS - dt);
      e.cdZ = Math.max(0, e.cdZ - dt);
      e.cdH = Math.max(0, e.cdH - dt);
      if (e.burn > 0) {
        e.burn = Math.max(0, e.burn - dt);
        e.burnAcc += dt;
        if (e.burnAcc >= 0.3) {
          e.burnAcc = 0;
          scorch(e, e.burnDps * 0.3);
          if (!e.alive) continue;
        }
        if (e.burn <= 0) e.burnDps = 0;
      }
      if (e.chill > 0) e.chill = Math.max(0, e.chill - dt);
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const len = Math.hypot(dx, dy) || 1;
      if (e.tier === 0) {
        const ox = e.x - player.x;
        const oy = e.y - player.y;
        if (Math.abs(ox) > viewW * 0.5 + 48 || Math.abs(oy) > viewH * 0.5 + 48) {
          const p = ringPos(Math.random() * Math.PI * 2, 8);
          e.x = p.x;
          e.y = p.y;
          e.kx = 0;
          e.ky = 0;
          continue;
        }
      }
      let slow = false;
      if (e.tier >= 2) slow = tickBoss(e, dt);
      if (e.kind === "robot" && e.tier < 2) {
        e.atk -= dt;
        if (e.atk <= 0 && len < 480 && e.chill <= 1.05) {
          e.atk = e.tier === 1 ? 1.7 : 2.5;
          const slot = wakeBullet("enemy");
          if (slot) {
            const sp = 145;
            slot.b.x = e.x;
            slot.b.y = e.y;
            slot.b.vx = (dx / len) * sp;
            slot.b.vy = (dy / len) * sp;
            slot.b.speed = sp;
            slot.b.life = 3.2;
            slot.b.r = 7;
            slot.b.dmg = e.dmg * 0.85;
          }
        }
      }
      let ax = dx / len;
      let ay = dy / len;
      if (e.tier < 2) {
        const sway = e.grade === 4 ? 0.04 : e.grade === 3 ? 0.1 : e.tier === 1 ? 0.16 : 0.34;
        const ang = Math.atan2(dy, dx) + Math.sin(renderTime * 2.1 + e.wobble) * sway;
        ax = Math.cos(ang);
        ay = Math.sin(ang);
      }
      const grip = e.chill > 1.05 ? 0 : e.chill > 0 ? 0.34 : 1;
      const spd = e.speed * (slow ? 0.32 : 1) * grip;
      e.x += ax * spd * dt + e.kx * dt;
      e.y += ay * spd * dt + e.ky * dt;
      e.kx *= Math.exp(-7 * dt);
      e.ky *= Math.exp(-7 * dt);
      if (enemyCount < 480 && e.tier < 2 && len < 640) nudge(e);
    }
  }

  function nudge(e: Enemy) {
    const cx = Math.floor(e.x / CELL);
    const cy = Math.floor(e.y / CELL);
    let px = 0;
    let py = 0;
    let seen = 0;
    for (let oy = -1; oy <= 1 && seen < 4; oy++) {
      for (let ox = -1; ox <= 1 && seen < 4; ox++) {
        let i = grid.get(hashCell(cx + ox, cy + oy));
        let guard = 0;
        while (i !== undefined && i >= 0 && guard++ < 5 && seen < 4) {
          const o = enemies[i];
          const ni = nextLink[i];
          if (o.alive && o !== e) {
            const dx = e.x - o.x;
            const dy = e.y - o.y;
            const min = (e.r + o.r) * 0.62;
            const d2 = dx * dx + dy * dy;
            if (d2 > 1 && d2 < min * min) {
              const d = Math.sqrt(d2);
              px += (dx / d) * ((min - d) / d);
              py += (dy / d) * ((min - d) / d);
              seen++;
            }
          }
          i = ni;
        }
      }
    }
    if (seen > 0) {
      e.x += px * 0.45;
      e.y += py * 0.45;
    }
  }

  function tickBullets(dt: number) {
    for (let i = 0; i < MAX_B; i++) {
      const b = bullets[i];
      if (!b.alive) continue;
      b.age += dt;
      b.life -= dt;
      if (b.kind === "enemy") {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        const dx = player.x - b.x;
        const dy = player.y - b.y;
        if (dx * dx + dy * dy < (player.r + b.r) * (player.r + b.r)) {
          b.alive = false;
          hurtPlayer(b.dmg * stats.taken);
          continue;
        }
        let blocked = false;
        for (let g = 0; g < gN; g++) {
          const gx0 = b.x - gx[g];
          const gy0 = b.y - gy[g];
          if (gx0 * gx0 + gy0 * gy0 < 24 * 24) blocked = true;
        }
        if (blocked || b.life <= 0) b.alive = false;
        continue;
      }
      if (b.kind === "boom" && !b.returning && b.age > 0.42) {
        b.returning = true;
        clearHits(i);
        b.pierce = 16;
      }
      if (b.kind === "boom" && b.returning) {
        const dx = player.x - b.x;
        const dy = player.y - b.y;
        const d = Math.hypot(dx, dy) || 1;
        b.vx = (dx / d) * b.speed;
        b.vy = (dy / d) * b.speed;
        if (d < 22) {
          b.alive = false;
          continue;
        }
      }
      if (b.kind === "ball") {
        const dx = b.x - player.x;
        const dy = b.y - player.y;
        const d = Math.hypot(dx, dy) || 1;
        const lim = Math.min(viewW, viewH) * 0.46;
        if (d > lim) {
          const nx = dx / d;
          const ny = dy / d;
          const dot = b.vx * nx + b.vy * ny;
          if (dot > 0) {
            b.vx -= 2 * dot * nx;
            b.vy -= 2 * dot * ny;
          }
          b.x = player.x + nx * lim;
          b.y = player.y + ny * lim;
        }
      }
      if (b.homing > 0) {
        const t = nearest(b.x, b.y, 260);
        if (t) {
          const want = Math.atan2(t.y - b.y, t.x - b.x);
          const cur = Math.atan2(b.vy, b.vx);
          let diff = want - cur;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const na = cur + Math.max(-b.homing * dt, Math.min(b.homing * dt, diff));
          b.vx = Math.cos(na) * b.speed;
          b.vy = Math.sin(na) * b.speed;
          b.ang = na;
        }
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.ang = Math.atan2(b.vy, b.vx);
      if (b.life <= 0) {
        b.alive = false;
        continue;
      }
      const pdx = b.x - player.x;
      const pdy = b.y - player.y;
      if (pdx * pdx + pdy * pdy > 980 * 980 && b.kind !== "ball") {
        b.alive = false;
        continue;
      }
      {
        const n = gather(b.x, b.y, b.r + 70);
        for (let k = 0; k < n; k++) {
          const ei = near[k];
          const e = enemies[ei];
          if (!b.alive) break;
          const dx = e.x - b.x;
          const dy = e.y - b.y;
          const rr = b.r + e.r;
          if (dx * dx + dy * dy > rr * rr) continue;
          if (b.kind === "slash") {
            if (e.slashId === b.gid) continue;
            e.slashId = b.gid;
            hurt(e, b.dmg, b.crit, 70);
            continue;
          }
          if (b.kind === "ball") {
            if (e.cdS > 0) continue;
            e.cdS = 0.32;
            hurt(e, b.dmg, b.crit, 36);
            continue;
          }
          if (seenHit(i, ei)) continue;
          addHit(i, ei);
          hurt(e, b.dmg, b.crit, b.kind === "boom" ? 20 : b.r >= 12 ? 48 : 24);
          if (b.gid === 4) ignite(e, 80);
          if (b.kind === "fire" && b.gid === 2 && armor === "fire") ignite(e, b.dmg);
          if (b.kind === "ice") chill(e);
          if (b.kind === "pellet" && b.r >= 12 && b.gid === 0) {
            b.gid = 1;
            spawnZone(b.x, b.y, b.r * 3.4, b.dmg * 0.55, 0.32, 0.2, false);
            addTrauma(0.12);
          }
          b.pierce -= 1;
          if (b.kind !== "boom" && b.pierce <= 0) b.alive = false;
        }
      }
    }
  }

  function tickZones(dt: number) {
    for (let i = 0; i < MAX_Z; i++) {
      const z = zones[i];
      if (!z.alive) continue;
      z.life -= dt;
      z.acc += dt;
      if (z.life <= 0) {
        z.alive = false;
        continue;
      }
      if (z.acc >= z.every) {
        z.acc = 0;
        {
          const n = gather(z.x, z.y, z.r + 10);
          for (let k = 0; k < n; k++) {
            const e = enemies[near[k]];
            if (e.cdZ > 0 && z.fire) continue;
            const dx = e.x - z.x;
            const dy = e.y - z.y;
            if (dx * dx + dy * dy <= (z.r + e.r * 0.6) * (z.r + e.r * 0.6)) {
              if (z.fire) e.cdZ = z.every;
              hurt(e, z.dmg, false, 8);
            }
          }
        }
      }
    }
  }

  function tickGems(dt: number) {
    const mag = stats.magnet * (time >= 180 ? 1.4 : 1.35);
    const mag2 = mag * mag;
    for (let i = 0; i < MAX_G; i++) {
      const g = gems[i];
      if (!g.alive) continue;
      g.vx *= Math.exp(-3 * dt);
      g.vy *= Math.exp(-3 * dt);
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      const dx = player.x - g.x;
      const dy = player.y - g.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < mag2) g.magnet = true;
      if (g.magnet) {
        const d = Math.sqrt(d2) || 1;
        const pull = 680;
        g.x += (dx / d) * pull * dt;
        g.y += (dy / d) * pull * dt;
      }
      if (d2 < 28 * 28) {
        g.alive = false;
        addXp(g.xp);
        sfx.pickup();
      }
    }
  }

  function tickContact() {
    contactAcc -= STEP;
    if (contactAcc > 0) return;
    let hits = 0;
    let dmg = 0;
    const capHits = time < 210 ? 2 : 3;
    {
      const n = gather(player.x, player.y, 90);
      for (let k = 0; k < n; k++) {
        const e = enemies[near[k]];
        if (hits >= capHits) continue;
        const dx = e.x - player.x;
        const dy = e.y - player.y;
        const rr = e.r + player.r;
        if (dx * dx + dy * dy <= rr * rr) {
          hits++;
          dmg += e.dmg;
        }
      }
    }
    if (hits > 0) {
      contactAcc = time < 210 ? 0.64 : 0.46;
      hurtPlayer(dmg * stats.taken * (time < 210 ? 0.52 : 0.8));
    }
  }

  function decayFx(dt: number) {
    if (beamOn > 0) beamOn -= dt;
    if (crushVis > 0) crushVis -= dt;
    for (let i = 0; i < MAX_P; i++) {
      const p = bits[i];
      if (!p.alive) continue;
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) p.alive = false;
    }
    for (let i = 0; i < MAX_T; i++) {
      const f = floats[i];
      if (!f.alive) continue;
      f.life -= dt;
      f.y += f.vy * dt;
      if (f.life <= 0) f.alive = false;
    }
    for (let i = 0; i < MAX_F; i++) {
      if (!flashes[i].alive) continue;
      flashes[i].life -= dt;
      if (flashes[i].life <= 0) flashes[i].alive = false;
    }
    if (lifeBank > 0) {
      const h = Math.min(lifeBank, 16 * dt);
      lifeBank -= h;
      player.hp = Math.min(player.maxHp, player.hp + h);
    }
  }

  function warn(text: string) {
    warnText = text;
    warnT = 1.75;
    sfx.warn();
    addTrauma(0.18);
  }

  function maxedSkills() {
    let n = 0;
    for (const w of weapons) if (w.evolved || w.star >= 5) n++;
    for (const p of passives) if (p.star >= 5) n++;
    return n;
  }

  function beginDragon() {
    if (dragonForm) {
      dragonPending = false;
      return;
    }
    dragonPending = false;
    dragonForm = true;
    dragonShow = 1.5;
    breathHeld = false;
    addTrauma(0.85);
    sfx.level();
  }

  function checkDragon() {
    if (dragonForm || dragonPending || dragonShow > 0) return;
    if (maxedSkills() < 2) return;
    dragonPending = true;
    if (mode === "play") beginDragon();
  }

  function spew() {
    const a = player.facing;
    const slot = wakeBullet("fire");
    if (!slot) return;
    const speed = 380;
    slot.b.x = player.x + Math.cos(a) * 42;
    slot.b.y = player.y + Math.sin(a) * 34;
    slot.b.ang = a;
    slot.b.speed = speed;
    slot.b.vx = Math.cos(a) * speed;
    slot.b.vy = Math.sin(a) * speed;
    slot.b.dmg = 150;
    slot.b.crit = false;
    slot.b.life = 0.42;
    slot.b.r = 74;
    slot.b.pierce = 48;
    slot.b.gid = 4;
    spawnZone(player.x + Math.cos(a) * 70, player.y + Math.sin(a) * 54, 58, 22, 0.55, 0.16, true);
    sfx.wave();
  }

  function director(dt: number) {
    for (let i = 0; i < BOSS_AT.length; i++) {
      if (!didBoss[i] && time >= BOSS_AT[i]) {
        didBoss[i] = true;
        warn("BOSS INCOMING");
        bossQueue = i;
        bossIn = 1.25;
      }
    }
    if (bossIn > 0) {
      bossIn -= dt;
      if (bossIn <= 0 && bossQueue >= 0) {
        spawnBoss(bossQueue);
        bossQueue = -1;
      }
    }
    if (calm > 0) calm -= dt;
    if (warnT > 0) {
      warnT -= dt;
      if (warnT <= 0) warnText = "";
    }
    const wi = waveIndexAt();
    const wave = WAVES[wi];
    const start = wi === 0 ? 0 : WAVES[wi - 1].until;
    const span = Number.isFinite(wave.until) ? wave.until - start : 1;
    const frac = Number.isFinite(wave.until) ? Math.min(1, Math.max(0, (time - start) / span)) : 1;

    if (wave.hordeEvery > 0) {
      hordeT -= dt;
      if (hordeT <= 0 && !bossAlive() && calm <= 0 && bossQueue < 0) {
        hordeT = wave.hordeEvery;
        warn("ZOMBIES INCOMING");
        spawnRing(wave.burst);
      }
    }
    if (wave.eliteEvery > 0 && calm <= 0 && !bossAlive() && waveGap <= 0) {
      eliteT -= dt;
      if (eliteT <= 0) {
        if (waveSpawned >= waveGoal || enemyCount >= screenCap()) eliteT = 3.5;
        else {
          eliteT = wave.eliteEvery;
          const kind = wave.types[(Math.random() * wave.types.length) | 0];
          spawnMember(kind, 1, 1);
        }
      }
    }
    if (time >= 450 && calm <= 0 && !bossAlive() && waveGap <= 0) {
      miniT -= dt;
      if (miniT <= 0) {
        if (waveSpawned >= waveGoal || enemyCount >= screenCap()) miniT = 4;
        else {
          miniT = 78;
          spawnMember(Math.random() < 0.5 ? "mutant" : "robot", 2, 3);
        }
      }
    }
    const slow = (bossAlive() ? 0.45 : 1) * (calm > 0 ? 0.35 : 1) * chapter.spawn;
    quiet += dt;
    if (waveGap > 0) {
      waveGap -= dt;
      if (waveGap <= 0) {
        waveNo++;
        beginWave();
        warn(`WELLE ${waveNo + 1}`);
      }
      return;
    }
    if (waveSpawned >= waveGoal && waveAlive <= 0 && !bossAlive() && bossQueue < 0) {
      waveGap = 1.15;
      return;
    }
    const cap = screenCap();
    const stars = maxedSkills();
    const hot = stars >= 3 && quiet >= 12;
    const packed = stars >= 2 || time >= 420 || waveNo >= 3;
    spawnAcc += dt * slow;
    let interval = wave.interval * (1 - 0.08 * frac);
    const age = time - start;
    if (time >= 210 && age < 8) interval *= 1.2;
    const refillAt = time >= 180 && time < 330 ? 0.72 : 0.5;
    if (enemyCount < cap * refillAt) interval *= 0.62;
    if (packed) interval *= hot ? 0.28 : 0.48;
    if (waveSpawned >= waveGoal || enemyCount >= cap) {
      if (spawnAcc > interval) spawnAcc = interval;
      return;
    }
    if (spawnAcc >= interval) {
      const c = tally();
      if (c.n >= cap || waveSpawned >= waveGoal) {
        spawnAcc = interval;
        return;
      }
      spawnAcc = 0;
      const batch = hot ? 3 : packed ? 2 : 1;
      for (let k = 0; k < batch; k++) {
        if (c.n >= cap || enemyCount >= cap || waveSpawned >= waveGoal) break;
        const grade = chooseGrade(c);
        if (grade === 4) spawnAcc = -1.25;
        const mob = pickMob(grade);
        if (!spawnMember(mob.kind, 0, mob.grade)) break;
        c.n++;
        if (grade === 2) c.g2++;
        else if (grade === 3) c.g3++;
        else if (grade === 4) c.g4++;
      }
    }
  }

  function endStep() {
    if (mode !== "play" || player.hp <= 0) return;
    if (pendingLevels > 0) openLevel();
    else if (luckyQueue > 0) openLucky();
  }

  function sim(dt: number) {
    if (hitstop > 0) {
      hitstop -= dt;
      return;
    }
    if (dragonShow > 0) {
      dragonShow -= dt;
      renderTime += dt;
      if (dragonShow > 0) return;
    }
    textsFrame = 0;
    if (grace > 0) grace = Math.max(0, grace - dt);
    if (coinSaveT > 0) coinSaveT -= dt;
    flushCoins();
    time += dt;
    renderTime += dt;
    music.wave = waveIndexAt();
    director(dt);
    movePlayer(dt);
    moveEnemies(dt);
    rebuildGrid();
    tickWeapons(dt);
    if (breathHeld && dragonForm) {
      breathAcc += dt;
      if (breathAcc >= 0.12) {
        breathAcc = 0;
        spew();
      }
    }
    tickBullets(dt);
    tickZones(dt);
    tickGems(dt);
    tickContact();
    decayFx(dt);
    for (let i = 0; i < shocks.length; i++) {
      if (!shocks[i].alive) continue;
      shocks[i].life -= dt;
      if (shocks[i].life <= 0) shocks[i].alive = false;
    }
    endStep();
  }

  function cardKey(prefix: string) {
    offerN += 1;
    return `${prefix}-${offerN}`;
  }

  function offerOf(card: Card, apply: () => void): Offer {
    return { card, apply };
  }

  function buildOffers(): Offer[] {
    type Cand = { w: number; id: string; make: () => Offer };
    const pool: Cand[] = [];
    const evos: Cand[] = [];
    for (const w of weapons) {
      if (w.base === "tank") continue;
      if (canEvolve(w)) {
        const evo = EVO_OF[w.base];
        evos.push({
          w: 14,
          id: `evo-${evo}`,
          make: () =>
            offerOf(
              {
                key: cardKey("evo"),
                name: INFO[evo].name,
                desc: stackLine(w.base, capFor(w.base)) || INFO[evo].desc,
                tone: "evo",
                pips: capFor(w.base),
                pipsMax: capFor(w.base),
                badge: "Evolution",
                icon: evo,
              },
              () => raise(w, 1),
            ),
        });
      } else if (!w.evolved && w.star < (w.base === "staff" ? capFor(w.base) : capFor(w.base) - 1)) {
        pool.push({
          w: 7,
          id: `up-${w.base}`,
          make: () =>
            offerOf(
              {
                key: cardKey("up"),
                name: w.base === "staff" && w.star + 1 >= 3 ? "Sauron-Keule" : INFO[w.base].name,
                desc: stackLine(w.base, w.star + 1) || INFO[w.base].desc,
                tone: "weapon",
                pips: w.star + 1,
                pipsMax: capFor(w.base),
                badge: `Stufe ${w.star + 1}`,
                icon: w.base,
              },
              () => raise(w, 1),
            ),
        });
      }
    }
    for (const p of passives) {
      if (p.star >= 5) continue;
      pool.push({
        w: 6,
        id: `up-${p.id}`,
        make: () =>
          offerOf(
            {
              key: cardKey("pup"),
              name: INFO[p.id].name,
              desc: INFO[p.id].desc,
              tone: "passive",
              pips: p.star + 1,
              pipsMax: 5,
              badge: p.star === 4 ? "Meister" : `Stufe ${p.star + 1}`,
              icon: p.id,
            },
            () => {
              p.star += 1;
              if (p.id === "heart") player.hp += 25;
            },
          ),
      });
    }
    if (weapons.length < 6) {
      for (const id of WEAPON_IDS) {
        if (id === "tank" || id === "staff" || weapons.some((w) => w.base === id)) continue;
        pool.push({
          w: level < 8 ? 8 : 4,
          id: `new-${id}`,
          make: () =>
            offerOf(
              {
                key: cardKey("nw"),
                name: INFO[id].name,
                desc: stackLine(id, 1) || INFO[id].desc,
                tone: "weapon",
                pips: 1,
                pipsMax: 5,
                badge: "Neue Waffe",
                icon: id,
              },
              () => addWeapon(id, 1),
            ),
        });
      }
    }
    const tankLate = time >= 600;
    const hull = weapons.find((w) => w.base === "tank");
    if (time >= 480 && !hull) {
      pool.push({
        w: tankLate ? 2.8 : 0.85,
        id: "new-tank",
        make: () =>
          offerOf(
            {
              key: cardKey("tank"),
              name: INFO.tank.name,
              desc: INFO.tank.desc,
              tone: "evo",
              pips: 1,
              pipsMax: 3,
              badge: tankLate ? "Selten" : "Sehr selten",
              icon: "tank",
            },
            () => addWeapon("tank", 1),
          ),
      });
    } else if (time >= 480 && hull && !hull.evolved) {
      const evolving = hull.star >= capFor("tank") - 1;
      pool.push({
        w: evolving ? (tankLate ? 6 : 2.4) : tankLate ? 4.5 : 1.8,
        id: evolving ? "evo-ufo" : "up-tank",
        make: () =>
          offerOf(
            {
              key: cardKey(evolving ? "ufo" : "uptank"),
              name: evolving ? INFO.ufo.name : INFO.tank.name,
              desc: stackLine("tank", evolving ? 3 : hull.star + 1) || INFO.tank.desc,
              tone: evolving ? "evo" : "weapon",
              pips: evolving ? 3 : hull.star + 1,
              pipsMax: 3,
              badge: evolving ? (tankLate ? "Selten" : "Sehr selten") : `Stufe ${hull.star + 1}`,
              icon: evolving ? "ufo" : "tank",
            },
            () => raise(hull, 1),
          ),
      });
    }
    if (passives.length < 6) {
      for (const id of PASSIVE_IDS) {
        if (passives.some((p) => p.id === id)) continue;
        pool.push({
          w: level < 9 ? 6.5 : 3.5,
          id: `new-${id}`,
          make: () =>
            offerOf(
              {
                key: cardKey("np"),
                name: INFO[id].name,
                desc: INFO[id].desc,
                tone: "passive",
                pips: 1,
                pipsMax: 5,
                badge: "Neu",
                icon: id,
              },
              () => {
                passives.push({ id, star: 1 });
                if (id === "heart") player.hp += 25;
              },
            ),
        });
      }
    }
    pool.push({
      w: 2,
      id: "heal",
      make: () =>
        offerOf(
          {
            key: cardKey("heal"),
            name: "Verband",
            desc: "Heilt 35% deiner Lebenspunkte.",
            tone: "util",
            pips: 0,
            pipsMax: 0,
            badge: "Bonus",
            icon: "heal",
          },
          () => {
            player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.35);
          },
        ),
    });
    pool.push({
      w: 1.4,
      id: "coins",
      make: () =>
        offerOf(
          {
            key: cardKey("coins"),
            name: "Goldbeutel",
            desc: "20 Gold für den Fähigkeits-Shop.",
            tone: "util",
            pips: 0,
            pipsMax: 0,
            badge: "Bonus",
            icon: "coins",
          },
          () => grantCoins(20),
        ),
    });
    pool.push({
      w: 1.3,
      id: "adr",
      make: () =>
        offerOf(
          {
            key: cardKey("adr"),
            name: "Adrenalin",
            desc: "+10% Schaden für den Rest dieses Laufs.",
            tone: "util",
            pips: 0,
            pipsMax: 0,
            badge: "Bonus",
            icon: "adrenaline",
          },
          () => {
            adrenaline += 0.1;
          },
        ),
    });

    const picked: Offer[] = [];
    const used = new Set<string>();
    const take = (list: Cand[]) => {
      let total = 0;
      const open = list.filter((c) => !used.has(c.id));
      if (!open.length) return;
      for (const c of open) total += c.w;
      let r = Math.random() * total;
      let choice = open[open.length - 1];
      for (const c of open) {
        r -= c.w;
        if (r <= 0) {
          choice = c;
          break;
        }
      }
      used.add(choice.id);
      picked.push(choice.make());
    };
    if (evos.length) take(evos);
    let guard = 0;
    while (picked.length < 3 && guard++ < 12) take(pool);
    return picked.slice(0, 3);
  }

  function openArmor() {
    armorPending = false;
    if (armor !== "none") return;
    mode = "armor";
    releaseJoy();
    hooks.onMode("armor");
  }

  function openLevel() {
    if (mode === "level") return;
    flushCoins(true);
    mode = "level";
    releaseJoy();
    rerolls = 1;
    offers = buildOffers();
    sfx.level();
    hooks.onCards(
      offers.map((o) => o.card),
      rerolls,
    );
    hooks.onMode("level");
  }

  function openLucky() {
    if (mode === "lucky" || luckyQueue <= 0) return;
    luckyQueue--;
    mode = "lucky";
    releaseJoy();
    luckyPulled = false;
    sfx.lucky();
    hooks.onLuckyOpen();
    hooks.onMode("lucky");
  }

  function nextGate() {
    if (player.hp <= 0) return;
    if (armorPending && armor === "none") {
      openArmor();
      return;
    }
    if (dragonPending) {
      beginDragon();
      mode = "play";
      hooks.onMode("play");
      return;
    }
    if (pendingLevels > 0) openLevel();
    else if (luckyQueue > 0) openLucky();
    else {
      mode = "play";
      hooks.onMode("play");
    }
  }

  function addWeapon(id: WeaponId, star: number) {
    const owned = weapons.find((it) => it.base === id);
    if (owned) {
      raise(owned, star);
      return;
    }
    if (weapons.length >= 6) {
      if (id !== "tank") return;
      const victim = weapons
        .filter((w) => w.base !== "staff")
        .sort((a, b) => Number(a.evolved) - Number(b.evolved) || a.star - b.star)[0];
      if (!victim) return;
      weapons.splice(weapons.indexOf(victim), 1);
    }
    const cap = capFor(id);
    const w: Wep = {
      id,
      base: id,
      star: Math.max(1, Math.min(cap, star)),
      evolved: false,
      cd: 0.2,
      angle: Math.random() * 6.28,
      perm: permBonus(id, meta.skills[id] ?? 0),
    };
    if (w.star >= cap && id !== "staff") evolveNow(w);
    if (id === "staff" && w.star >= 5 && armor === "none") armorPending = true;
    weapons.push(w);
    if (id === "tank" && !w.evolved) player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.3);
  }

  function vacuum() {
    for (const g of gems) if (g.alive) g.magnet = true;
  }

  function rocket(power: number) {
    const rad = Math.hypot(viewW, viewH) * 0.58;
    const rad2 = rad * rad;
    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      if (dx * dx + dy * dy > rad2) continue;
      const frac = e.tier === 3 ? 0.07 * power : e.tier === 2 ? 0.38 * power : 0.78 * power;
      hurt(e, Math.max(10, e.maxHp * frac), false, 20);
    }
    addTrauma(0.7);
    sfx.big();
  }

  function luckyBolt() {
    let x = player.x;
    let y = player.y;
    const banned = new Set<Enemy>();
    for (let c = 0; c < 10; c++) {
      const t = nearest(x, y, 320, banned);
      if (!t) break;
      addFlash(x, y, t.x, t.y);
      hurt(t, 80 * stats.dmg, true, 8);
      banned.add(t);
      x = t.x;
      y = t.y;
    }
  }

  function pullLucky(): LuckyPull | null {
    if (mode !== "lucky" || luckyPulled) return null;
    luckyPulled = true;
    const symbols: Sym[] = [];
    const bias = Math.random();
    const featured = SYMS[(Math.random() * SYMS.length) | 0];
    for (let i = 0; i < 4; i++) {
      if (bias > 0.55 && Math.random() < 0.62) symbols.push(featured);
      else symbols.push(SYMS[(Math.random() * SYMS.length) | 0]);
    }
    const counts = new Map<Sym, number>();
    for (const s of symbols) counts.set(s, (counts.get(s) ?? 0) + 1);
    let sym: Sym = symbols[0];
    let n = 0;
    for (const [k, v] of counts) {
      if (v > n) {
        n = v;
        sym = k;
      }
    }
    const power = n >= 4 ? 2 : n === 3 ? 1.25 : n === 2 ? 0.75 : 0.4;
    let title = "Niete";
    let detail = "Ein bisschen Heilung und ein paar Münzen.";
    if (n >= 4) title = "JACKPOT";
    else if (n === 3) title = "Dreier";
    else if (n === 2) title = "Paar";
    if (n < 2) {
      player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.18);
      grantCoins(12);
    } else if (sym === "sword") {
      const up = weapons.filter((w) => !w.evolved && w.star < capFor(w.base) && w.base !== "tank");
      if (up.length) {
        const w = up[(Math.random() * up.length) | 0];
        raise(w, n >= 4 ? 2 : 1);
        detail = w.evolved ? `${INFO[w.id].name} erwacht.` : `${INFO[w.base].name} wird schärfer.`;
      } else {
        adrenaline += 0.12 * power;
        detail = "Deine Waffen laufen heiß. Schaden rauf.";
      }
      title = n >= 4 ? "JACKPOT · Klinge" : "Klinge";
    } else if (sym === "magnet") {
      vacuum();
      magnetBonus += 40 * power;
      detail = "Alle Kristalle fliegen zu dir.";
      title = "Magnetsturm";
    } else if (sym === "rocket") {
      rocket(power);
      detail = "Die Horde auf dem Schirm wird zerlegt.";
      title = "Raketenhagel";
    } else if (sym === "heart") {
      const frac = n >= 4 ? 1 : n === 3 ? 0.6 : 0.35;
      player.hp = Math.min(player.maxHp, player.hp + player.maxHp * frac);
      detail = "Du fängst dich wieder.";
      title = "Heilpuls";
    } else if (sym === "star") {
      const fresh = WEAPON_IDS.filter((id) => id !== "tank" && !weapons.some((w) => w.base === id));
      if (weapons.length < 6 && fresh.length && Math.random() < 0.55) {
        const id = fresh[(Math.random() * fresh.length) | 0];
        addWeapon(id, n >= 4 ? 2 : 1);
        detail = `${INFO[id].name} springt ins Arsenal.`;
      } else {
        const up = weapons.filter((w) => !w.evolved && w.star < capFor(w.base) && w.base !== "tank");
        if (up.length) {
          const w = up[(Math.random() * up.length) | 0];
          raise(w, 1);
          detail = w.evolved ? `${INFO[w.id].name} erwacht.` : `${INFO[w.base].name} +1 Stufe.`;
        } else {
          adrenaline += 0.15;
          detail = "Dauerhafter Schub für diesen Lauf.";
        }
      }
      title = "Sternschnuppe";
    } else if (sym === "coin") {
      const amt = n >= 4 ? 80 : n === 3 ? 40 : 22;
      grantCoins(amt);
      detail = `+${amt} Gold in die Werkstatt.`;
      title = "Münzregen";
    } else if (sym === "bolt") {
      luckyBolt();
      if (n >= 3) rocket(0.45);
      detail = "Blitze springen durch die Meute.";
      title = "Gewitter";
    } else if (sym === "blade") {
      const ready = weapons.find((w) => w.base !== "tank" && canEvolve(w));
      if (ready) {
        raise(ready, 1);
        detail = `${INFO[ready.id].name} erwacht.`;
        title = "Evolution";
      } else if (!weapons.some((w) => w.base === "katana") && weapons.length < 6) {
        addWeapon("katana", n >= 3 ? 2 : 1);
        detail = "Eine Katana liegt auf einmal in der Hand.";
        title = "Klinge";
      } else {
        adrenaline += 0.16;
        const kat = weapons.find((w) => w.base === "katana" && !w.evolved && w.star < 5);
        if (kat) {
          raise(kat, 1);
          detail = kat.evolved ? "Dämonenklinge erwacht." : "Katana +1 und ein Schub Schaden.";
        } else detail = "Reiner Schaden für den Rest des Laufs.";
        title = "Klingenrausch";
      }
    }
    recompute();
    addTrauma(0.35);
    return { symbols, title, detail };
  }

  function runPayout() {
    return Math.max(0, Math.floor((time / 60) * 100 + kills * 0.35 + bossesKilled * 250));
  }

  function revivePrice() {
    if (gaveUp) return 0;
    if (revives <= 0) return 200;
    if (revives === 1) return 500;
    return 0;
  }

  function bankedPayout() {
    return Math.max(0, runPayout() - payoutSpent);
  }

  function spendableGold() {
    return Math.max(0, meta.coins) + bankedPayout();
  }

  function deathSummary(): Summary {
    const prev = meta.best[chapter.id - 1] ?? 0;
    const price = revivePrice();
    const purse = spendableGold();
    return {
      time,
      kills,
      level,
      coins: runPayout() + bonusCoins,
      best: time > prev && time > 1,
      chapter: chapter.id,
      bosses: bossesKilled,
      wallet: purse,
      reviveCost: price > 0 && purse >= price ? price : 0,
      warriors: recruitsFromRun(meta.warriors ?? 0, kills),
    };
  }

  function presentDeath() {
    flushCoins(true);
    mode = "dead";
    releaseJoy();
    sfx.death();
    hooks.onMode("dead", deathSummary());
  }

  function commitRun() {
    if (!runLive || banked) return;
    banked = true;
    runLive = false;
    flushCoins(true);
    const earned = Math.max(0, runPayout() - payoutSpent);
    const prev = meta.best[chapter.id - 1] ?? 0;
    const best = time > prev && time > 1;
    const bestArr: [number, number, number] = [meta.best[0], meta.best[1], meta.best[2]];
    if (best) bestArr[chapter.id - 1] = time;
    const gained = recruitsFromRun(meta.warriors ?? 0, kills);
    meta = {
      ...meta,
      coins: meta.coins + earned,
      best: bestArr,
      runs: meta.runs + 1,
      warriors: (meta.warriors ?? 0) + gained,
    };
    saveMeta(meta);
    hooks.onMeta(meta);
  }

  function shoveCrowd() {
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.alive) continue;
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const near = dx * dx + dy * dy < 230 * 230;
      if (e.tier >= 3) {
        if (!near) continue;
        const len = Math.hypot(dx, dy) || 1;
        e.x = player.x + (dx / len) * 240;
        e.y = player.y + (dy / len) * 240;
      } else if (near) {
        const ang = Math.atan2(dy, dx);
        const p = ringPos(Number.isFinite(ang) ? ang : Math.random() * Math.PI * 2, 30);
        e.x = p.x;
        e.y = p.y;
      } else continue;
      e.kx = 0;
      e.ky = 0;
    }
    for (let i = 0; i < bullets.length; i++) {
      const b = bullets[i];
      if (!b.alive || b.kind !== "enemy") continue;
      const dx = b.x - player.x;
      const dy = b.y - player.y;
      if (dx * dx + dy * dy < 200 * 200) b.alive = false;
    }
  }

  /** HUD an React melden: höchstens 10× pro Sekunde, Warnungen sofort. */
  function emit(force: boolean) {
    const now = performance.now();
    if (!force && warnText === hudWarn && now - hudAt < 100) return;
    hudAt = now;
    hudWarn = warnText;
    const b = bossAlive() ? enemies[bossI] : null;
    hooks.onFrame({
      time,
      hp: player.hp,
      maxHp: player.maxHp,
      xp,
      xpNeed,
      level,
      wave: WAVES[waveIndexAt()].name,
      waveN: waveNo + 1,
      kills,
      weapons: weapons.map((w) => ({
        id: w.base === "staff" && w.star >= 3 ? "mace" : w.id,
        star: w.star,
      })),
      passives: passives.map((p) => ({ id: p.id, star: p.star })),
      boss: b
        ? {
            name: BOSS_NAME[b.variant] ?? "Boss",
            hp: Math.max(0, b.hp),
            max: b.maxHp,
            shield: b.shield,
            maxShield: b.maxShield,
          }
        : null,
      moved,
      warning: warnText,
      gold: bonusCoins,
      dragon: dragonForm,
    });
  }

  function resetWorld() {
    for (const e of enemies) e.alive = false;
    for (const b of bullets) b.alive = false;
    for (const g of gems) g.alive = false;
    for (const p of bits) p.alive = false;
    for (const f of floats) f.alive = false;
    for (const z of zones) z.alive = false;
    for (const f of flashes) f.alive = false;
    enemyCount = 0;
    eCursor = 0;
    bCursor = 0;
    player.x = 0;
    player.y = 0;
    player.vx = 0;
    player.vy = 0;
    player.facing = -Math.PI / 2;
    player.flash = 0;
    player.r = 15;
    form = "hero";
    turret = -Math.PI / 2;
    beamOn = 0;
    crushT = 0;
    crushVis = 0;
    weapons = [];
    passives = [];
    adrenaline = 0;
    lifeBank = 0;
    xp = 0;
    level = 1;
    xpNeed = xpFor(1);
    pendingLevels = 0;
    kills = 0;
    bossesKilled = 0;
    bonusCoins = 0;
    coinPending = false;
    coinSaveT = 0;
    payoutSpent = 0;
    staffAim = -Math.PI / 2;
    for (let i = 0; i < shocks.length; i++) shocks[i].alive = false;
    moved = false;
    contactAcc = 0;
    spawnAcc = 0;
    eliteT = 10;
    miniT = 50;
    hordeT = 28;
    calm = 0;
    quiet = 0;
    waveNo = 0;
    beginWave();
    armor = "none";
    armorPending = false;
    dragonForm = false;
    dragonPending = false;
    dragonShow = 0;
    breathHeld = false;
    breathAcc = 0;
    warnT = 0;
    warnText = "";
    grace = 0;
    revives = 0;
    didBoss = [false, false, false];
    bossQueue = -1;
    bossIn = 0;
    bossI = -1;
    hitstop = 0;
    luckyQueue = 0;
    time = 0;
    renderTime = 0;
    gN = 0;
    oN = 0;
    dN = 0;
    forceOn = false;
    magnetBonus = 0;
  }

  function SX(x: number) {
    return x - camX + viewW / 2 + shakeX;
  }
  function SY(y: number) {
    return y - camY + viewH / 2 + shakeY;
  }

  function onScreen(x: number, y: number, m = 48) {
    return Math.abs(x - camX) < viewW / 2 + m && Math.abs(y - camY) < viewH / 2 + m;
  }

  function paint(dt: number) {
    camX = player.x;
    camY = player.y;
    const sh = shakeOn && !reduced ? trauma * trauma : 0;
    shakeX = sh ? (Math.random() * 2 - 1) * 16 * sh : 0;
    shakeY = sh ? (Math.random() * 2 - 1) * 12 * sh : 0;
    trauma = Math.max(0, trauma - dt * 1.8);

    ctx.fillStyle = "#2a1812";
    ctx.fillRect(0, 0, viewW, viewH);
    if (lavaPat) {
      // Muster an Weltkoordinaten verankern, damit der Boden mit der Kamera wandert.
      ctx.save();
      ctx.translate(SX(0), SY(0));
      ctx.fillStyle = lavaPat;
      ctx.fillRect(camX - viewW / 2 - 4, camY - viewH / 2 - 4, viewW + 8, viewH + 8);
      ctx.restore();
    }

    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    for (let i = 0; i < MAX_Z; i++) {
      const z = zones[i];
      if (!z.alive || !onScreen(z.x, z.y, z.r)) continue;
      ctx.beginPath();
      ctx.arc(SX(z.x), SY(z.y), z.r, 0, Math.PI * 2);
      ctx.fillStyle = z.fire ? "rgba(255, 90, 40, 0.45)" : "rgba(208, 0, 43, 0.35)";
      ctx.fill();
      ctx.stroke();
    }

    for (let i = 0; i < MAX_G; i++) {
      const g = gems[i];
      if (!g.alive || !onScreen(g.x, g.y, 20)) continue;
      diamond(ctx, SX(g.x), SY(g.y), g.r, GEM_COLORS[g.kind]);
    }

    const detail = enemyCount < 380;
    for (let i = 0; i < MAX_E; i++) {
      const e = enemies[i];
      if (!e.alive || !onScreen(e.x, e.y, e.r + 8)) continue;
      paintEnemy(e, detail);
    }

    for (let i = 0; i < MAX_B; i++) {
      const b = bullets[i];
      if (!b.alive || !onScreen(b.x, b.y, b.r + 30)) continue;
      paintBullet(b);
    }

    for (let i = 0; i < MAX_F; i++) {
      const f = flashes[i];
      if (!f.alive) continue;
      ctx.beginPath();
      ctx.moveTo(SX(f.x1), SY(f.y1));
      const mx = (f.x1 + f.x2) / 2 + Math.sin(renderTime * 40) * 10;
      const my = (f.y1 + f.y2) / 2;
      ctx.lineTo(SX(mx), SY(my));
      ctx.lineTo(SX(f.x2), SY(f.y2));
      ctx.strokeStyle = YELLOW;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    if (forceOn) drawForceField(ctx, SX(player.x), SY(player.y), forceR, forceEvo, renderTime);

    for (let i = 0; i < oN; i++) {
      drawBlade(ctx, SX(ox[i]), SY(oy[i]), Math.atan2(oy[i] - player.y, ox[i] - player.x), bladeScale, bladeHot);
    }
    for (let i = 0; i < gN; i++) {
      const rot = shieldStar ? renderTime * 0.9 : Math.atan2(gy[i] - player.y, gx[i] - player.x) + renderTime * 1.6;
      drawShield(ctx, sprites, art, SX(gx[i]), SY(gy[i]), rot, shieldStar, shieldScale);
    }
    for (let i = 0; i < dN; i++) drawDrone(ctx, SX(dxs[i]), SY(dys[i]), droneScale);

    paintTelegraphs();
    paintTankFx();

    for (let i = 0; i < shocks.length; i++) {
      const s = shocks[i];
      if (!s.alive) continue;
      const p = Math.max(0, s.life / 0.42);
      const rad = 14 + (s.max - 14) * (1 - p);
      ctx.beginPath();
      ctx.arc(SX(s.x), SY(s.y), rad, 0, Math.PI * 2);
      ctx.globalAlpha = 0.35 + 0.55 * p;
      ctx.strokeStyle = s.hue === 1 ? "#ff5a18" : s.hue === 2 ? "#d8fbff" : "#3ec6ff";
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.globalAlpha = 0.85 * p;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    paintPlayer(viewW / 2 + shakeX, viewH / 2 + shakeY);

    if (dragonShow > 0) drawDragonIntro(ctx, art, viewW, viewH, dragonShow, renderTime);

    for (let i = 0; i < MAX_P; i++) {
      const p = bits[i];
      if (!p.alive || !onScreen(p.x, p.y, 10)) continue;
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(SX(p.x), SY(p.y), p.s, p.s);
    }
    ctx.globalAlpha = 1;

    ctx.font = "700 15px Outfit, sans-serif";
    ctx.textAlign = "center";
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    for (let i = 0; i < MAX_T; i++) {
      const f = floats[i];
      if (!f.alive) continue;
      ctx.globalAlpha = Math.min(1, f.life * 2);
      ctx.fillStyle = f.tone === 1 ? YELLOW : f.tone === 2 ? DANGER : CREAM;
      ctx.strokeText(f.text, SX(f.x), SY(f.y));
      ctx.fillText(f.text, SX(f.x), SY(f.y));
    }
    ctx.globalAlpha = 1;

    if (player.maxHp > 0 && player.hp / player.maxHp < 0.28) {
      ctx.fillStyle = `rgba(208,0,43,${0.1 + (reduced ? 0 : 0.05 * Math.sin(renderTime * 8))})`;
      ctx.fillRect(0, 0, viewW, viewH);
    }

    if (joy.on && mode === "play") {
      ctx.beginPath();
      ctx.arc(joy.ox, joy.oy, 58, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(26,18,12,0.35)";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(joy.kx, joy.ky, 24, 0, Math.PI * 2);
      ctx.fillStyle = YELLOW;
      ctx.fill();
      ctx.stroke();
    }
  }

  function paintTelegraphs() {
    for (let i = 0; i < MAX_E; i++) {
      const e = enemies[i];
      if (!e.alive || e.tele <= 0 || !onScreen(e.x, e.y, 140)) continue;
      ctx.save();
      ctx.strokeStyle = DANGER;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      if (e.teleKind === 0) {
        ctx.moveTo(SX(e.x), SY(e.y));
        ctx.lineTo(SX(e.x + Math.cos(e.dashAng) * 180), SY(e.y + Math.sin(e.dashAng) * 180));
      } else if (e.teleKind === 1) {
        ctx.arc(SX(e.markX), SY(e.markY), e.tier === 3 ? 120 : 78, 0, Math.PI * 2);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  function paintTankFx() {
    const x = viewW / 2 + shakeX;
    const y = viewH / 2 + shakeY;
    if (crushVis > 0 && (form === "tank" || form === "ufo")) {
      const k = 1 - crushVis / 0.22;
      ctx.save();
      ctx.globalAlpha = crushVis / 0.22;
      ctx.strokeStyle = form === "ufo" ? VISOR : YELLOW;
      ctx.lineWidth = form === "ufo" ? 8 : 6;
      ctx.beginPath();
      ctx.arc(x, y, crushR * (0.45 + k * 0.55), 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
    if (beamOn > 0 && form === "ufo") {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(beamAng);
      ctx.globalAlpha = Math.min(1, beamOn * 6);
      ctx.fillStyle = YELLOW;
      const half = Math.tan(0.4) * beamLen;
      ctx.beginPath();
      ctx.moveTo(18, -12);
      ctx.lineTo(beamLen, -half);
      ctx.lineTo(beamLen, half);
      ctx.lineTo(18, 12);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
  }

  function paintEnemy(e: Enemy, detail: boolean) {
    const x = SX(e.x);
    const y = SY(e.y);
    const { img, half } = sprites.enemy(e, detail);
    ctx.drawImage(img, x - half, y - half, half * 2, half * 2);
    if (e.burn > 0) {
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(renderTime * 18 + e.wobble);
      ctx.fillStyle = "#ff6a12";
      ctx.beginPath();
      ctx.arc(x - 3, y - e.r * 0.2, 3, 0, Math.PI * 2);
      ctx.arc(x + 4, y + 2, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (e.chill > 0) {
      ctx.beginPath();
      ctx.strokeStyle = e.chill > 1.05 ? "#f4fdff" : "#7ad7ff";
      ctx.lineWidth = e.chill > 1.05 ? 3 : 2;
      ctx.arc(x, y, e.r + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (e.maxShield > 0 && e.shield > 0) {
      ctx.beginPath();
      ctx.strokeStyle = VISOR;
      ctx.lineWidth = 5;
      ctx.arc(x, y, e.r + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (e.shield / e.maxShield));
      ctx.stroke();
    }
    if ((e.tier >= 1 || e.grade >= 2) && e.hp < e.maxHp) {
      const w = e.r * 2;
      ctx.fillStyle = INK;
      ctx.fillRect(x - w / 2, y - e.r - 10, w, 5);
      ctx.fillStyle = e.grade === 4 ? DANGER : e.tier === 3 ? PINK : YELLOW;
      ctx.fillRect(x - w / 2, y - e.r - 10, w * Math.max(0, e.hp / e.maxHp), 5);
    }
  }

  function paintBullet(b: Bullet) {
    const x = SX(b.x);
    const y = SY(b.y);
    switch (b.kind) {
      case "ice":
        drawIceWave(ctx, sprites, x, y, b);
        return;
      case "fire":
        if (b.gid === 2 || b.gid === 4) {
          drawFireWave(ctx, sprites, x, y, b);
          return;
        }
        ctx.beginPath();
        ctx.arc(x, y, b.r + 4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 70, 20, 0.28)";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = "#ff3418";
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = INK;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x - b.r * 0.22, y - b.r * 0.22, Math.max(2, b.r * 0.42), 0, Math.PI * 2);
        ctx.fillStyle = "#ffe14a";
        ctx.fill();
        return;
      case "slash":
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(b.ang);
        ctx.beginPath();
        ctx.arc(0, 0, b.r * 0.55, -1.1, 1.1);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 8;
        ctx.stroke();
        ctx.strokeStyle = bladeHot ? PINK : CREAM;
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.restore();
        return;
      case "knife":
      case "boom": {
        const boom = b.kind === "boom";
        const scale = Math.max(0.8, b.r / (boom ? 12 : 6));
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(b.ang);
        ctx.scale(scale, scale);
        ctx.fillStyle = boom ? (b.r > 16 ? PINK : YELLOW) : b.r > 8 ? "#7ef0ff" : CREAM;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(11, 0);
        ctx.lineTo(-8, 5);
        ctx.lineTo(-4, 0);
        ctx.lineTo(-8, -5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        return;
      }
      case "ball": {
        const comet = b.r > 18;
        ctx.beginPath();
        ctx.arc(x, y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = comet ? "#ff6a2a" : CREAM;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = INK;
        ctx.stroke();
        ctx.fillStyle = comet ? YELLOW : INK;
        ctx.beginPath();
        ctx.arc(x, y, comet ? 6 : 3, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      case "enemy":
        ctx.beginPath();
        ctx.arc(x, y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = DANGER;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = INK;
        ctx.stroke();
        return;
      default:
        ctx.beginPath();
        ctx.arc(x, y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = YELLOW;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = INK;
        ctx.stroke();
    }
  }

  function paintPlayer(x: number, y: number) {
    if (grace > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, (form === "hero" ? 28 : 42) + Math.sin(renderTime * 9) * 2, 0, Math.PI * 2);
      ctx.strokeStyle = PINK;
      ctx.globalAlpha = 0.45 + 0.35 * Math.min(1, grace / 2.8);
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
    const flash = player.flash > 0;
    if (dragonForm) drawDragon(ctx, art, x, y, renderTime, player.vx, player.vy, player.facing);
    else if (form === "tank") drawTank(ctx, x, y, turret, flash);
    else if (form === "ufo") drawUfo(ctx, x, y, renderTime, flash);
    else {
      const pose = { t: renderTime, moved, aim: staffAim, flash };
      if (armor !== "none") drawArmored(ctx, armor === "ice" ? art.armorIce : art.armorFire, x, y, pose);
      else
        drawWarlock(
          ctx,
          art,
          x,
          y,
          pose,
          weapons.some((w) => w.base === "staff" && w.star >= 3),
        );
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    viewW = Math.max(2, rect.width);
    viewH = Math.max(2, rect.height);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    sprites.setScale(dpr);
    canvas.width = Math.floor(viewW * dpr);
    canvas.height = Math.floor(viewH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stillPainted = false;
  }

  function localPos(e: PointerEvent) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onPointerDown(e: PointerEvent) {
    if (mode !== "play") return;
    if (e.button !== 0 && e.pointerType === "mouse") return;
    joy.on = true;
    joy.id = e.pointerId;
    const p = localPos(e);
    joy.ox = p.x;
    joy.oy = p.y;
    joy.kx = p.x;
    joy.ky = p.y;
    joy.x = 0;
    joy.y = 0;
    canvas.setPointerCapture(e.pointerId);
    prime();
  }

  function onPointerMove(e: PointerEvent) {
    if (!joy.on || e.pointerId !== joy.id) return;
    const p = localPos(e);
    const dx = p.x - joy.ox;
    const dy = p.y - joy.oy;
    const max = 64;
    const len = Math.hypot(dx, dy) || 1;
    const cl = Math.min(max, len);
    joy.kx = joy.ox + (dx / len) * cl;
    joy.ky = joy.oy + (dy / len) * cl;
    const jx = (dx / len) * (cl / max);
    const jy = (dy / len) * (cl / max);
    const mag = Math.hypot(jx, jy);
    if (mag < 0.16) {
      joy.x = 0;
      joy.y = 0;
    } else {
      const s = Math.min(1, (mag - 0.16) / 0.84);
      joy.x = (jx / mag) * s;
      joy.y = (jy / mag) * s;
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (e.pointerId !== joy.id) return;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    joy.on = false;
    joy.x = 0;
    joy.y = 0;
    joy.id = -1;
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.repeat) return;
    held.add(e.code);
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
    if ((e.code === "Escape" || e.code === "KeyP") && mode === "play") {
      mode = "pause";
      releaseJoy();
      hooks.onMode("pause");
    } else if ((e.code === "Escape" || e.code === "KeyP") && mode === "pause") {
      mode = "play";
      hooks.onMode("play");
    } else if (mode === "armor" && (e.code === "Digit1" || e.code === "Digit2")) {
      pickArmor(e.code === "Digit1" ? "fire" : "ice");
    } else if (mode === "level" && (e.code === "Digit1" || e.code === "Digit2" || e.code === "Digit3")) {
      const idx = Number(e.code.slice(5)) - 1;
      const card = offers[idx];
      if (card) choose(card.card.key);
    }
    if (mode === "play") prime();
  }

  function onKeyUp(e: KeyboardEvent) {
    held.delete(e.code);
  }

  function frame(now: number) {
    if (destroyed) return;
    const dt = Math.min(0.05, (now - lastTs) / 1000);
    lastTs = now;
    if (mode === "play") {
      accTime += dt;
      let steps = 0;
      while (accTime >= STEP && steps < 4 && mode === "play") {
        sim(STEP);
        accTime -= STEP;
        steps++;
      }
      if (steps === 4) accTime = 0;
    } else if (mode === "dying") {
      deathT -= dt;
      if (deathT <= 0) presentDeath();
    } else {
      accTime = 0;
    }
    // Bewegte Szenen jeden Frame zeichnen; hinter Menüs reicht ein Standbild.
    const live = mode === "play" || mode === "dying";
    if (mode !== "menu" && (live || !stillPainted)) {
      paint(dt);
      stillPainted = !live;
    }
    if (mode !== "menu" && mode !== "dead") emit(false);
    raf = requestAnimationFrame(frame);
  }

  function start(chapterId: number) {
    if ((mode === "dead" || mode === "dying") && runLive && !banked) commitRun();
    prime();
    chapter = CHAPTERS[chapterId - 1] ?? CHAPTERS[0];
    resetWorld();
    gaveUp = false;
    runLive = true;
    banked = false;
    const b = bonuses(meta);
    runBaseHp = 100 + b.hp;
    player.maxHp = runBaseHp;
    player.hp = runBaseHp;
    baseDmg = 1 + b.dmg;
    baseSpd = 1 + b.spd;
    baseMag = 132 + b.mag;
    addWeapon("staff", Math.min(5, Math.max(1, b.startStars)));
    recompute();
    mode = "play";
    for (let k = 0; k < 8; k++) {
      const i = allocE();
      if (i < 0) break;
      const ang = (k / 8) * Math.PI * 2 + 0.2;
      const p = ringPos(ang, 36);
      configureEnemy(i, p.x, p.y, "zombie", 0, 1);
    }
    lastTs = performance.now();
    accTime = 0;
    hooks.onMode("play");
    emit(true);
    if (armorPending) openArmor();
  }

  function choose(key: string) {
    if (mode !== "level") return;
    const o = offers.find((item) => item.card.key === key);
    if (!o) return;
    o.apply();
    recompute();
    pendingLevels = Math.max(0, pendingLevels - 1);
    sfx.click();
    nextGate();
  }

  function pickArmor(kind: "fire" | "ice") {
    if (mode !== "armor") return;
    armor = kind;
    armorPending = false;
    addTrauma(0.4);
    sfx.level();
    nextGate();
  }

  function breath(on: boolean) {
    if (!dragonForm || mode !== "play" || dragonShow > 0) {
      breathHeld = false;
      return;
    }
    breathHeld = on;
    if (on) {
      breathAcc = 0.12;
      spew();
    }
  }

  function reroll() {
    if (mode !== "level" || rerolls <= 0) return;
    rerolls -= 1;
    offers = buildOffers();
    sfx.click();
    hooks.onCards(
      offers.map((o) => o.card),
      rerolls,
    );
  }

  function closeLucky() {
    if (mode !== "lucky" || !luckyPulled) return;
    nextGate();
  }

  function pause() {
    if (mode !== "play") return;
    flushCoins(true);
    mode = "pause";
    breathHeld = false;
    releaseJoy();
    hooks.onMode("pause");
  }

  function resume() {
    if (mode !== "pause") return;
    prime();
    mode = "play";
    lastTs = performance.now();
    hooks.onMode("play");
  }

  function giveUp() {
    if (mode !== "pause" && mode !== "play") return;
    gaveUp = true;
    releaseJoy();
    presentDeath();
  }

  function revive() {
    if (mode !== "dead" || !runLive || banked) return;
    const cost = revivePrice();
    if (cost <= 0 || spendableGold() < cost) return;
    let rest = cost;
    const fromWallet = Math.min(Math.max(0, meta.coins), rest);
    rest -= fromWallet;
    payoutSpent += rest;
    meta = { ...meta, coins: Math.max(0, meta.coins - fromWallet) };
    saveMeta(meta);
    hooks.onMeta(meta);
    revives += 1;
    player.hp = player.maxHp;
    player.flash = 0.25;
    grace = 3.2;
    calm = 0.7;
    contactAcc = 0.4;
    shoveCrowd();
    mode = "play";
    lastTs = performance.now();
    accTime = 0;
    warn("WEITER");
    sfx.revive();
    hooks.onMode("play");
    emit(true);
  }

  function toMenu() {
    if ((mode === "dead" || mode === "dying") && runLive && !banked) commitRun();
    mode = "menu";
    releaseJoy();
    scripted = null;
    held.clear();
    hooks.onMode("menu");
  }

  function prime() {
    sfx.unlock();
    const ac = sfx.context();
    if (!ac) return;
    music.attach(ac);
    const go = () => {
      if (meta.music) music.start();
    };
    if (ac.state === "running") go();
    else void ac.resume().then(go);
  }

  function sync(next: Meta) {
    meta = next;
    sfx.muted = !next.sfxOn;
    music.setEnabled(next.music);
    if (next.music) prime();
    shakeOn = next.shake;
  }

  function destroy() {
    destroyed = true;
    music.stop();
    cancelAnimationFrame(raf);
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerUp);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
    canvas.removeEventListener("contextmenu", onContextMenu);
    document.removeEventListener("visibilitychange", onVisibility);
    ro.disconnect();
    if (import.meta.env.DEV) delete window.__visier;
  }

  function onBlur() {
    held.clear();
    releaseJoy();
    breathHeld = false;
  }

  function onContextMenu(e: Event) {
    e.preventDefault();
  }

  /** App-Wechsel oder Tab im Hintergrund: Spiel pausieren und Ton anhalten. */
  function onVisibility() {
    if (document.hidden) {
      pause();
      music.stop();
      void sfx.context()?.suspend();
    } else if (mode !== "menu") {
      prime();
    }
  }

  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);
  resize();
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  canvas.addEventListener("contextmenu", onContextMenu);
  document.addEventListener("visibilitychange", onVisibility);

  // Nur im Entwicklungsmodus: Testzugriff für scripts/smoke.mjs.
  if (import.meta.env.DEV) {
    window.__visier = {
      state: () => ({
        mode,
        time,
        level,
        kills,
        hp: player.hp,
        enemies: enemyCount,
        armor,
        dragon: dragonForm,
        weapons: weapons.map((w) => `${w.id}:${w.star}`),
      }),
      setKeys: (codes) => {
        scripted = codes ? new Set(codes) : null;
      },
      cheat: (what) => {
        if (what === "god") {
          runBaseHp = 1e9;
          recompute();
          player.hp = player.maxHp;
        } else if (what === "staff") {
          const staff = weapons.find((w) => w.base === "staff");
          if (staff) raise(staff, 5);
          recompute();
          nextGate();
        } else if (what === "dragon") {
          for (const id of ["katana", "kunai"] as const) addWeapon(id, 5);
          recompute();
          nextGate();
        } else if (what === "time") time += 60;
      },
    };
  }

  raf = requestAnimationFrame(frame);

  return {
    start,
    choose,
    reroll,
    pullLucky,
    closeLucky,
    pause,
    resume,
    giveUp,
    toMenu,
    revive,
    sync,
    prime,
    destroy,
    pickArmor,
    breath,
  };
}

declare global {
  interface Window {
    __visier?: {
      state: () => Record<string, unknown>;
      setKeys: (codes: string[] | null) => void;
      cheat: (what: "god" | "staff" | "dragon" | "time") => void;
    };
  }
}
