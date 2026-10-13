/**
 * Canvas-Szene des Burg-Modus: isometrische Karte mit Kamera (Ziehen, Zoomen),
 * Bauen, Verschieben, Upgrade-Effekten und dem Angriff zum Zuschauen.
 * React steuert die Bedienelemente und reicht Aktionen hierher weiter.
 */
import { Sfx } from "@/game/audio";
import { CastleArt, HH, HW, iso, type Sprite } from "./art";
import {
  FIELD,
  SIZE,
  fits,
  freeSpotNear,
  move,
  occupancy,
  place,
  type Building,
  type BuildingKind,
  type Castle,
} from "./model";
import { foesLeft, startRaid, stepRaid, type Raid, type RaidEvent } from "./raid";

export type RaidView = {
  left: number;
  total: number;
  keepHp: number;
  keepMax: number;
  result: Raid["result"];
  reward: number;
  level: number;
};
export type PlaceView = { kind: BuildingKind; valid: boolean };

export type SceneHooks = {
  onSelect: (id: number | null) => void;
  /** Ein abgeschlossener Bau-/Verschiebe-Vorgang: neuer Stand und Restgold. */
  onCommit: (castle: Castle, coins: number) => void;
  onToast: (text: string) => void;
  onRaid: (view: RaidView | null) => void;
  onPlace: (view: PlaceView | null) => void;
};

type Pointer = { id: number; x: number; y: number; sx: number; sy: number };

type Fx =
  | {
      kind: "spark";
      x: number;
      y: number;
      z: number;
      vx: number;
      vy: number;
      vz: number;
      life: number;
      max: number;
      color: string;
    }
  | { kind: "ring"; x: number; y: number; life: number; max: number; color: string }
  | { kind: "text"; x: number; y: number; z: number; life: number; max: number; text: string; color: string };

type Deco = { x: number; y: number; tree: boolean; v: number };

const ZOOM_MIN = 0.35;
const ZOOM_MAX = 1.6;
const STEP = 1 / 30;

export class CastleScene {
  private ctx: CanvasRenderingContext2D;
  private art = new CastleArt();
  private sfx = new Sfx();
  private castle: Castle;
  private coins: number;
  private warriors = 0;
  private viewW = 1;
  private viewH = 1;
  private dpr = 1;
  private cam = { x: FIELD / 2, y: FIELD / 2, zoom: 0.85 };
  private pointers = new Map<number, Pointer>();
  private gesture: null | {
    kind: "pan" | "pinch" | "move" | "ghost" | "paint";
    moved: boolean;
    dist?: number;
    zoom?: number;
    grabX?: number;
    grabY?: number;
    lastTile?: number;
  } = null;
  private selected: number | null = null;
  private ghost: { kind: BuildingKind; x: number; y: number } | null = null;
  private moving: { id: number; x: number; y: number } | null = null;
  private wallTool = false;
  private stroke: { castle: Castle; coins: number; placed: number } | null = null;
  private raid: Raid | null = null;
  private raidAcc = 0;
  private raidEmitAt = 0;
  private fx: Fx[] = [];
  private pops = new Map<number, number>();
  private decos: Deco[] = [];
  private dirty = true;
  private raf = 0;
  private last = performance.now();
  private lastDraw = 0;
  private time = 0;
  private grassDark: CanvasPattern | null = null;
  private grassLight: CanvasPattern | null = null;
  private ro: ResizeObserver;
  private destroyed = false;

  constructor(
    private canvas: HTMLCanvasElement,
    castle: Castle,
    coins: number,
    private hooks: SceneHooks,
  ) {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2D-Kontext nicht verfügbar");
    this.ctx = ctx;
    this.castle = castle;
    this.coins = coins;
    const keep = castle.buildings.find((b) => b.kind === "castle");
    if (keep) {
      this.cam.x = keep.x + 1.5;
      this.cam.y = keep.y + 1.5;
    }
    this.decos = makeDecos();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.resize();
    canvas.addEventListener("pointerdown", this.onDown);
    canvas.addEventListener("pointermove", this.onMove);
    canvas.addEventListener("pointerup", this.onUp);
    canvas.addEventListener("pointercancel", this.onUp);
    canvas.addEventListener("wheel", this.onWheel, { passive: false });
    canvas.addEventListener("contextmenu", this.onContext);
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.canvas.removeEventListener("pointerdown", this.onDown);
    this.canvas.removeEventListener("pointermove", this.onMove);
    this.canvas.removeEventListener("pointerup", this.onUp);
    this.canvas.removeEventListener("pointercancel", this.onUp);
    this.canvas.removeEventListener("wheel", this.onWheel);
    this.canvas.removeEventListener("contextmenu", this.onContext);
  }

  // -------------------------------------------------------------------------
  // Steuerung von außen (React)

  setData(castle: Castle, coins: number, warriors: number, sound: boolean) {
    if (!this.stroke) {
      this.castle = castle;
      this.coins = coins;
    }
    this.warriors = warriors;
    this.sfx.muted = !sound;
    if (this.selected !== null && !castle.buildings.some((b) => b.id === this.selected)) this.select(null);
    this.dirty = true;
  }

  unlockAudio() {
    this.sfx.unlock();
  }

  select(id: number | null) {
    this.selected = id;
    this.hooks.onSelect(id);
    this.dirty = true;
  }

  focus(id: number) {
    const b = this.castle.buildings.find((it) => it.id === id);
    if (!b) return;
    const s = SIZE[b.kind];
    this.cam.x = b.x + s / 2;
    this.cam.y = b.y + s / 2;
    this.select(id);
  }

  /** Neues Gebäude zum Platzieren anbieten (Geist in Bildmitte). */
  beginPlace(kind: BuildingKind) {
    this.cancelPlace();
    this.select(null);
    if (kind === "wall") {
      this.wallTool = true;
      this.hooks.onPlace({ kind, valid: true });
      this.dirty = true;
      return;
    }
    const spot = freeSpotNear(occupancy(this.castle), kind, this.cam.x, this.cam.y);
    if (!spot) {
      this.hooks.onToast("Kein Platz frei");
      return;
    }
    this.ghost = { kind, ...spot };
    this.emitPlace();
  }

  confirmPlace() {
    const g = this.ghost;
    if (!g) return;
    const r = place(this.castle, g.kind, g.x, g.y, this.coins);
    if (!r) {
      this.hooks.onToast("Hier ist kein Platz");
      return;
    }
    const id = r.castle.nextId - 1;
    this.ghost = null;
    this.hooks.onPlace(null);
    this.apply(r.castle, r.coins);
    this.celebrate(id, 1, false);
    this.sfx.coin();
  }

  cancelPlace() {
    if (!this.ghost && !this.wallTool) return;
    this.ghost = null;
    this.wallTool = false;
    this.hooks.onPlace(null);
    this.dirty = true;
  }

  /** Nach einem Upgrade: Gebäude hüpft, Funken sprühen, Stufe schwebt hoch. */
  celebrate(id: number, level: number, upgrade = true) {
    const b = this.castle.buildings.find((it) => it.id === id);
    if (!b) return;
    const s = SIZE[b.kind];
    const cx = b.x + s / 2;
    const cy = b.y + s / 2;
    this.pops.set(id, this.time);
    const colors = ["#ffd000", "#fff6ea", "#ff8a2a", level >= 4 ? "#6fd2ff" : "#ffe27a"];
    const n = upgrade ? 26 + level * 6 : 12;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.6 + Math.random() * 1.6;
      this.fx.push({
        kind: "spark",
        x: cx,
        y: cy,
        z: 10 + Math.random() * 30 * s,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        vz: 40 + Math.random() * 80,
        life: 0.9 + Math.random() * 0.5,
        max: 1.4,
        color: colors[i % colors.length],
      });
    }
    this.fx.push({ kind: "ring", x: cx, y: cy, life: 0.6, max: 0.6, color: upgrade ? "#ffd000" : "#fff6ea" });
    if (upgrade) {
      this.fx.push({
        kind: "text",
        x: cx,
        y: cy,
        z: 40 + s * 22,
        life: 1.4,
        max: 1.4,
        text: `Stufe ${level}!`,
        color: "#ffd000",
      });
      this.sfx.level();
    }
    this.dirty = true;
  }

  startRaid() {
    if (this.raid) return;
    this.cancelPlace();
    this.select(null);
    this.sfx.unlock();
    this.raid = startRaid(this.castle, this.warriors);
    this.raidAcc = 0;
    this.sfx.warn();
    this.emitRaid(true);
  }

  /** Angriff beenden (Aufgeben oder nach dem Ergebnis). Alles ist danach wieder heil. */
  endRaid() {
    this.raid = null;
    this.hooks.onRaid(null);
    this.dirty = true;
  }

  get raiding() {
    return this.raid !== null;
  }

  // -------------------------------------------------------------------------
  // Hilfsfunktionen

  private apply(castle: Castle, coins: number) {
    this.castle = castle;
    this.coins = coins;
    this.hooks.onCommit(castle, coins);
    this.dirty = true;
  }

  private emitPlace() {
    const g = this.ghost;
    if (!g) return;
    this.hooks.onPlace({ kind: g.kind, valid: fits(occupancy(this.castle), g.kind, g.x, g.y) });
    this.dirty = true;
  }

  private emitRaid(force = false) {
    const r = this.raid;
    if (!r) return;
    const now = performance.now();
    if (!force && now - this.raidEmitAt < 150) return;
    this.raidEmitAt = now;
    const keep = this.castle.buildings.find((b) => b.kind === "castle");
    this.hooks.onRaid({
      left: foesLeft(r),
      total: r.total,
      keepHp: keep ? Math.max(0, r.hp.get(keep.id) ?? 0) : 0,
      keepMax: keep ? (r.max.get(keep.id) ?? 1) : 1,
      result: r.result,
      reward: r.reward,
      level: r.level,
    });
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.viewW = Math.max(1, rect.width);
    this.viewH = Math.max(1, rect.height);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.viewW * this.dpr);
    this.canvas.height = Math.round(this.viewH * this.dpr);
    this.art.setScale(this.dpr * 1.25);
    this.grassDark = this.ctx.createPattern(this.art.grass(false), "repeat");
    this.grassLight = this.ctx.createPattern(this.art.grass(true), "repeat");
    this.dirty = true;
  }

  /** Kachel-Koordinaten → Bildschirm. */
  private toScreen(tx: number, ty: number, z = 0): [number, number] {
    const [x, y] = iso(tx - this.cam.x, ty - this.cam.y);
    return [this.viewW / 2 + x * this.cam.zoom, this.viewH / 2 + (y - z) * this.cam.zoom];
  }

  /** Bildschirm → Kachel-Koordinaten (Boden). */
  private toTile(sx: number, sy: number): [number, number] {
    const x = (sx - this.viewW / 2) / this.cam.zoom;
    const y = (sy - this.viewH / 2) / this.cam.zoom;
    return [this.cam.x + (x / HW + y / HH) / 2, this.cam.y + (y / HH - x / HW) / 2];
  }

  private clampCam() {
    this.cam.x = Math.max(-4, Math.min(FIELD + 4, this.cam.x));
    this.cam.y = Math.max(-4, Math.min(FIELD + 4, this.cam.y));
    this.cam.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, this.cam.zoom));
  }

  private local(e: PointerEvent): [number, number] {
    const r = this.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  /** Oberstes Gebäude an einem Bildschirmpunkt, mit Pixeltest auf dem Sprite. */
  private pick(sx: number, sy: number): Building | null {
    const list = [...this.castle.buildings].sort((a, b) => depthOf(b) - depthOf(a));
    for (const b of list) {
      if (this.raid && (this.raid.hp.get(b.id) ?? 0) <= 0) continue;
      const spr = this.art.building(b.kind, b.level, this.castle.skin);
      const s = SIZE[b.kind];
      const [x, y] = this.toScreen(b.x + s / 2, b.y + s / 2);
      const z = this.cam.zoom;
      const lx = (sx - x) / z + spr.ax;
      const ly = (sy - y) / z + spr.ay;
      if (lx < 0 || ly < 0 || lx >= spr.w || ly >= spr.h) continue;
      const k = spr.img.width / spr.w;
      const a = spr.img.getContext("2d")!.getImageData(Math.floor(lx * k), Math.floor(ly * k), 1, 1).data[3];
      if (a > 40) return b;
    }
    // Fallback: Grundriss am Boden
    const [tx, ty] = this.toTile(sx, sy);
    const id = occupancy(this.castle)[Math.floor(ty) * FIELD + Math.floor(tx)];
    return (
      (Math.floor(tx) >= 0 &&
        Math.floor(ty) >= 0 &&
        Math.floor(tx) < FIELD &&
        Math.floor(ty) < FIELD &&
        this.castle.buildings.find((b) => b.id === id)) ||
      null
    );
  }

  private paintWallAt(tx: number, ty: number) {
    const st = this.stroke;
    if (!st) return;
    const x = Math.floor(tx);
    const y = Math.floor(ty);
    const r = place(st.castle, "wall", x, y, st.coins);
    if (!r) return;
    st.castle = r.castle;
    st.coins = r.coins;
    st.placed++;
    this.castle = r.castle;
    this.pops.set(r.castle.nextId - 1, this.time);
    this.sfx.coin();
    this.dirty = true;
  }

  // -------------------------------------------------------------------------
  // Eingabe

  private onContext = (e: Event) => e.preventDefault();

  private onDown = (e: PointerEvent) => {
    this.sfx.unlock();
    const [x, y] = this.local(e);
    this.pointers.set(e.pointerId, { id: e.pointerId, x, y, sx: x, sy: y });
    this.canvas.setPointerCapture(e.pointerId);
    if (this.pointers.size === 2) {
      this.finishStroke();
      const [a, b] = [...this.pointers.values()];
      this.gesture = { kind: "pinch", moved: true, dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.cam.zoom };
      return;
    }
    if (this.pointers.size > 2) return;
    const [tx, ty] = this.toTile(x, y);
    if (this.wallTool && !this.raid) {
      this.stroke = { castle: this.castle, coins: this.coins, placed: 0 };
      this.gesture = { kind: "paint", moved: false, lastTile: -1 };
      this.paintWallAt(tx, ty);
      return;
    }
    if (this.ghost) {
      const g = this.ghost;
      const s = SIZE[g.kind];
      const on = tx >= g.x - 0.5 && tx < g.x + s + 0.5 && ty >= g.y - 0.5 && ty < g.y + s + 0.5;
      this.gesture = on
        ? { kind: "ghost", moved: false, grabX: tx - g.x, grabY: ty - g.y }
        : { kind: "pan", moved: false };
      return;
    }
    if (!this.raid && this.selected !== null) {
      const hit = this.pick(x, y);
      if (hit && hit.id === this.selected) {
        this.gesture = { kind: "move", moved: false, grabX: tx - hit.x, grabY: ty - hit.y };
        return;
      }
    }
    this.gesture = { kind: "pan", moved: false };
  };

  private onMove = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId);
    if (!p || !this.gesture) return;
    const [x, y] = this.local(e);
    const dx = x - p.x;
    const dy = y - p.y;
    p.x = x;
    p.y = y;
    const g = this.gesture;
    if (!g.moved && Math.hypot(x - p.sx, y - p.sy) > 7) g.moved = true;
    if (g.kind === "pinch") {
      const [a, b] = [...this.pointers.values()];
      if (!a || !b) return;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      this.cam.zoom = (g.zoom ?? 1) * (d / (g.dist ?? d));
      // Mitbewegen mit dem Mittelpunkt der Finger
      const [tx, ty] = this.screenDelta(dx / 2, dy / 2);
      this.cam.x -= tx;
      this.cam.y -= ty;
      this.clampCam();
      this.dirty = true;
      return;
    }
    if (!g.moved) return;
    const [tx, ty] = this.toTile(x, y);
    if (g.kind === "pan") {
      const [mx, my] = this.screenDelta(dx, dy);
      this.cam.x -= mx;
      this.cam.y -= my;
      this.clampCam();
      this.dirty = true;
    } else if (g.kind === "ghost" && this.ghost) {
      const nx = Math.round(tx - (g.grabX ?? 0));
      const ny = Math.round(ty - (g.grabY ?? 0));
      if (nx !== this.ghost.x || ny !== this.ghost.y) {
        this.ghost.x = nx;
        this.ghost.y = ny;
        this.emitPlace();
      }
    } else if (g.kind === "move" && this.selected !== null) {
      const nx = Math.round(tx - (g.grabX ?? 0));
      const ny = Math.round(ty - (g.grabY ?? 0));
      if (!this.moving || this.moving.x !== nx || this.moving.y !== ny) {
        this.moving = { id: this.selected, x: nx, y: ny };
        this.dirty = true;
      }
    } else if (g.kind === "paint") {
      // Linie zwischen letzter und aktueller Kachel füllen, damit schnelle Striche keine Lücken lassen.
      const [lx, ly] = this.toTile(x - dx, y - dy);
      const steps = Math.ceil(Math.max(Math.abs(tx - lx), Math.abs(ty - ly)) * 2) + 1;
      for (let i = 1; i <= steps; i++) this.paintWallAt(lx + ((tx - lx) * i) / steps, ly + ((ty - ly) * i) / steps);
    }
  };

  private onUp = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    const g = this.gesture;
    if (!p || !g) return;
    if (g.kind === "pinch") {
      if (this.pointers.size === 0) this.gesture = null;
      else this.gesture = { kind: "pan", moved: true };
      return;
    }
    if (this.pointers.size > 0) return;
    this.gesture = null;
    const [tx, ty] = this.toTile(p.x, p.y);
    if (g.kind === "paint") {
      this.finishStroke();
      return;
    }
    if (g.kind === "move") {
      const m = this.moving;
      this.moving = null;
      if (m) {
        const next = move(this.castle, m.id, m.x, m.y);
        if (next) {
          this.apply(next, this.coins);
          this.pops.set(m.id, this.time);
          this.sfx.click();
        } else this.hooks.onToast("Dort ist kein Platz");
      }
      this.dirty = true;
      if (g.moved) return;
    }
    if (g.moved) return;
    // Tippen
    if (this.ghost) {
      const s = SIZE[this.ghost.kind];
      this.ghost.x = Math.round(tx - s / 2);
      this.ghost.y = Math.round(ty - s / 2);
      this.emitPlace();
      return;
    }
    const hit = this.pick(p.x, p.y);
    this.select(hit ? hit.id : null);
    if (hit) this.pops.set(hit.id, this.time - 0.25);
  };

  private finishStroke() {
    const st = this.stroke;
    this.stroke = null;
    if (!st) return;
    if (st.placed > 0) this.apply(st.castle, st.coins);
    else if (this.gesture?.kind === "paint") {
      // Kein Platz, kein Gold oder Limit
      this.hooks.onToast("Hier kann keine Mauer hin");
    }
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const [x, y] = this.local(e as unknown as PointerEvent);
    const [bx, by] = this.toTile(x, y);
    this.cam.zoom *= Math.exp(-e.deltaY * 0.0015);
    this.clampCam();
    const [ax, ay] = this.toTile(x, y);
    this.cam.x += bx - ax;
    this.cam.y += by - ay;
    this.clampCam();
    this.dirty = true;
  };

  /** Bildschirm-Verschiebung → Kachel-Verschiebung. */
  private screenDelta(dx: number, dy: number): [number, number] {
    const x = dx / this.cam.zoom;
    const y = dy / this.cam.zoom;
    return [(x / HW + y / HH) / 2, (y / HH - x / HW) / 2];
  }

  // -------------------------------------------------------------------------
  // Schleife

  private frame = (now: number) => {
    if (this.destroyed) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;

    if (this.raid && !this.raid.result) {
      this.raidAcc += dt;
      const events: RaidEvent[] = [];
      while (this.raidAcc >= STEP) {
        stepRaid(this.raid, this.castle, STEP, events);
        this.raidAcc -= STEP;
      }
      this.handleEvents(events);
      this.emitRaid(this.raid.result !== null);
      if (this.raid.result === "win") this.sfx.revive();
      if (this.raid.result === "lose") this.sfx.death();
      this.dirty = true;
    }

    this.tickFx(dt);
    const animating = this.fx.length > 0 || this.popsActive() || this.raid !== null;
    // Ruhige Szene: nur bei Änderungen zeichnen, Glanzeffekte mit 20 fps.
    if (this.dirty || animating || now - this.lastDraw > 50) {
      this.draw();
      this.lastDraw = now;
      this.dirty = false;
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  private popsActive() {
    for (const t of this.pops.values()) if (this.time - t < 0.5) return true;
    return false;
  }

  private handleEvents(events: RaidEvent[]) {
    let shot = false;
    for (const ev of events) {
      if (ev.type === "shot") shot = true;
      else if (ev.type === "foeDown") {
        for (let i = 0; i < 6; i++) {
          const a = Math.random() * Math.PI * 2;
          this.fx.push({
            kind: "spark",
            x: ev.x,
            y: ev.y,
            z: 8,
            vx: Math.cos(a),
            vy: Math.sin(a),
            vz: 50,
            life: 0.5,
            max: 0.5,
            color: "#7ed06a",
          });
        }
        this.sfx.die();
      } else if (ev.type === "hit") {
        this.fx.push({ kind: "ring", x: ev.x, y: ev.y, life: 0.25, max: 0.25, color: ev.big ? "#ff8a2a" : "#fff6ea" });
        this.sfx.hit();
      } else if (ev.type === "wreck") {
        const b = this.castle.buildings.find((it) => it.id === ev.id);
        if (b) {
          const s = SIZE[b.kind];
          for (let i = 0; i < 14; i++) {
            const a = Math.random() * Math.PI * 2;
            this.fx.push({
              kind: "spark",
              x: b.x + s / 2,
              y: b.y + s / 2,
              z: 10,
              vx: Math.cos(a) * 1.2,
              vy: Math.sin(a) * 1.2,
              vz: 70,
              life: 0.7,
              max: 0.7,
              color: "#8d8a84",
            });
          }
          this.sfx.big();
        }
      }
    }
    if (shot) this.sfx.shoot();
  }

  private tickFx(dt: number) {
    if (!this.fx.length) return;
    for (const f of this.fx) {
      f.life -= dt;
      if (f.kind === "spark") {
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.z += f.vz * dt;
        f.vz -= 220 * dt;
        if (f.z < 0) {
          f.z = 0;
          f.vz *= -0.3;
        }
      } else if (f.kind === "text") f.z += 28 * dt;
    }
    this.fx = this.fx.filter((f) => f.life > 0);
  }

  // -------------------------------------------------------------------------
  // Zeichnen

  private draw() {
    const g = this.ctx;
    const z = this.cam.zoom;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.fillStyle = "#3f8a34";
    g.fillRect(0, 0, this.viewW, this.viewH);

    // Wiese (am Weltursprung verankert)
    const [ox, oy] = this.toScreen(0, 0);
    if (this.grassDark) {
      g.save();
      g.translate(ox, oy);
      g.scale(z, z);
      g.fillStyle = this.grassDark;
      g.fillRect(-ox / z, -oy / z, this.viewW / z, this.viewH / z);
      g.restore();
    }
    // Baufeld
    const c0 = this.toScreen(0, 0);
    const c1 = this.toScreen(FIELD, 0);
    const c2 = this.toScreen(FIELD, FIELD);
    const c3 = this.toScreen(0, FIELD);
    g.beginPath();
    g.moveTo(c0[0], c0[1]);
    g.lineTo(c1[0], c1[1]);
    g.lineTo(c2[0], c2[1]);
    g.lineTo(c3[0], c3[1]);
    g.closePath();
    if (this.grassLight) {
      g.save();
      g.clip();
      g.translate(ox, oy);
      g.scale(z, z);
      g.fillStyle = this.grassLight;
      g.fillRect(-ox / z, -oy / z, this.viewW / z, this.viewH / z);
      g.restore();
    }
    g.lineWidth = Math.max(2, 7 * z);
    g.strokeStyle = "#b8925a";
    g.stroke();
    g.lineWidth = Math.max(1, 2 * z);
    g.strokeStyle = "rgba(90,60,30,0.6)";
    g.stroke();

    const building = this.ghost !== null || this.wallTool || this.moving !== null;
    if (building) this.drawGrid();

    // Markierungen am Boden
    if (this.selected !== null && !this.raid) {
      const b = this.castle.buildings.find((it) => it.id === this.selected);
      if (b) {
        const m = this.moving?.id === b.id ? this.moving : b;
        this.footprint(
          m.x,
          m.y,
          SIZE[b.kind],
          this.moving ? (fits(occupancy(this.castle, b.id), b.kind, m.x, m.y) ? "ok" : "bad") : "sel",
        );
      }
    }
    if (this.ghost) {
      const gh = this.ghost;
      this.footprint(gh.x, gh.y, SIZE[gh.kind], fits(occupancy(this.castle), gh.kind, gh.x, gh.y) ? "ok" : "bad");
    }
    if (this.raid) this.drawRanges();

    this.drawEntities();
    this.drawFx();
  }

  private drawGrid() {
    const g = this.ctx;
    g.beginPath();
    for (let i = 0; i <= FIELD; i++) {
      const a = this.toScreen(i, 0);
      const b = this.toScreen(i, FIELD);
      g.moveTo(a[0], a[1]);
      g.lineTo(b[0], b[1]);
      const c = this.toScreen(0, i);
      const d = this.toScreen(FIELD, i);
      g.moveTo(c[0], c[1]);
      g.lineTo(d[0], d[1]);
    }
    g.strokeStyle = "rgba(255,255,255,0.18)";
    g.lineWidth = 1;
    g.stroke();
  }

  private footprint(x: number, y: number, s: number, state: "ok" | "bad" | "sel") {
    const g = this.ctx;
    const pts = [this.toScreen(x, y), this.toScreen(x + s, y), this.toScreen(x + s, y + s), this.toScreen(x, y + s)];
    g.beginPath();
    pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
    g.closePath();
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 6);
    g.fillStyle =
      state === "bad"
        ? "rgba(208,0,43,0.45)"
        : state === "ok"
          ? "rgba(120,255,120,0.4)"
          : `rgba(255,208,0,${0.22 + pulse * 0.18})`;
    g.fill();
    g.strokeStyle = state === "bad" ? "#ff3d3d" : state === "ok" ? "#d8ffd0" : "#ffd000";
    g.lineWidth = 2;
    g.stroke();
  }

  private drawRanges() {
    // dezente Reichweitenkreise der Türme während des Angriffs
    const g = this.ctx;
    g.save();
    g.setLineDash([6, 6]);
    g.strokeStyle = "rgba(255,255,255,0.22)";
    g.lineWidth = 1.5;
    for (const b of this.castle.buildings) {
      if (b.kind !== "tower" || (this.raid!.hp.get(b.id) ?? 0) <= 0) continue;
      const r = 4 + 0.5 * b.level;
      const [x, y] = this.toScreen(b.x + 1, b.y + 1);
      g.beginPath();
      g.ellipse(x, y, r * HW * Math.SQRT2 * this.cam.zoom, r * HH * Math.SQRT2 * this.cam.zoom, 0, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();
  }

  private sprite(spr: Sprite, tx: number, ty: number, scale = 1, alpha = 1) {
    const [x, y] = this.toScreen(tx, ty);
    const z = this.cam.zoom * scale;
    const w = spr.w * z;
    const h = spr.h * z;
    const left = x - spr.ax * z;
    const top = y - spr.ay * z;
    if (left > this.viewW || top > this.viewH || left + w < 0 || top + h < 0) return;
    if (alpha < 1) this.ctx.globalAlpha = alpha;
    this.ctx.drawImage(spr.img, left, top, w, h);
    if (alpha < 1) this.ctx.globalAlpha = 1;
  }

  private drawEntities() {
    type Item = { d: number; draw: () => void };
    const items: Item[] = [];
    const skin = this.castle.skin;
    const raid = this.raid;
    const wallAt = new Map<number, Building>();
    for (const b of this.castle.buildings) {
      if (b.kind !== "wall") continue;
      if (raid && (raid.hp.get(b.id) ?? 0) <= 0) continue;
      if (this.moving?.id === b.id) continue;
      wallAt.set(b.y * FIELD + b.x, b);
    }

    // Deko um das Baufeld
    const [vx0, vy0] = this.toTile(0, 0);
    const span = (this.viewW + this.viewH) / (HW * this.cam.zoom);
    for (const d of this.decos) {
      if (Math.abs(d.x - vx0) + Math.abs(d.y - vy0) > span * 2.2 + 8) continue;
      items.push({ d: d.x + d.y, draw: () => this.sprite(d.tree ? this.art.tree(d.v) : this.art.rock(d.v), d.x, d.y) });
    }

    for (const b of this.castle.buildings) {
      const s = SIZE[b.kind];
      const at = this.moving?.id === b.id ? this.moving : b;
      const dead = raid ? (raid.hp.get(b.id) ?? 0) <= 0 : false;
      const pop = this.pops.get(b.id);
      const age = pop === undefined ? 1 : this.time - pop;
      const scale = age < 0.5 ? 1 + 0.18 * Math.sin((age / 0.5) * Math.PI) * (1 - age / 0.5) : 1;
      const alpha = this.moving?.id === b.id ? 0.75 : 1;
      items.push({
        d: at.x + at.y + s,
        draw: () => {
          if (dead) {
            this.rubble(at.x + s / 2, at.y + s / 2, s);
            return;
          }
          this.sprite(this.art.building(b.kind, b.level, skin), at.x + s / 2, at.y + s / 2, scale, alpha);
          this.ambient(b, at.x + s / 2, at.y + s / 2);
          if (raid) this.hpBar(b, at.x + s / 2, at.y + s / 2);
        },
      });
      if (b.kind === "wall" && !dead && this.moving?.id !== b.id) {
        const east = wallAt.get(b.y * FIELD + b.x + 1);
        const south = wallAt.get((b.y + 1) * FIELD + b.x);
        const lvl = (o: Building) => Math.min(b.level, o.level);
        if (east && b.x + 1 < FIELD)
          items.push({
            d: b.x + b.y + 1.5,
            draw: () => this.sprite(this.art.wallLink(lvl(east), skin, 0), b.x + 1, b.y + 0.5),
          });
        if (south)
          items.push({
            d: b.x + b.y + 1.5,
            draw: () => this.sprite(this.art.wallLink(lvl(south), skin, 1), b.x + 0.5, b.y + 1),
          });
      }
    }

    if (this.ghost) {
      const gh = this.ghost;
      const s = SIZE[gh.kind];
      items.push({
        d: gh.x + gh.y + s + 0.01,
        draw: () => this.sprite(this.art.building(gh.kind, 1, skin), gh.x + s / 2, gh.y + s / 2, 1, 0.8),
      });
    }

    if (raid) {
      for (const f of raid.foes)
        if (f.alive)
          items.push({ d: f.x + f.y, draw: () => this.foe(f.x, f.y, f.kind, f.hp / f.max, f.swing, f.face) });
      for (const gd of raid.guards)
        if (gd.alive) items.push({ d: gd.x + gd.y, draw: () => this.guard(gd.x, gd.y, gd.hp / gd.max, gd.swing) });
    }

    items.sort((a, b) => a.d - b.d);
    for (const it of items) it.draw();

    if (raid) {
      const g = this.ctx;
      for (const sh of raid.shots) {
        if (!sh.alive) continue;
        const [x, y] = this.toScreen(sh.x, sh.y, 30);
        const r = (sh.level >= 4 ? 5 : 3.5) * Math.max(0.6, this.cam.zoom);
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fillStyle = sh.level >= 5 ? "#ffb020" : sh.level >= 4 ? "#6fd2ff" : "#fff6ea";
        g.fill();
        g.strokeStyle = "#1a120c";
        g.lineWidth = 1;
        g.stroke();
      }
    }
  }

  /** Glanzeffekte ab Stufe 4. */
  private ambient(b: Building, tx: number, ty: number) {
    if (b.level < 4 || b.kind === "house") return;
    const g = this.ctx;
    const z = this.cam.zoom;
    const t = this.time + b.id * 0.7;
    const pulse = 0.5 + 0.5 * Math.sin(t * 3);
    let height = 0;
    let color = "#6fd2ff";
    let r = 18;
    if (b.kind === "tower") {
      height = b.level === 4 ? 88 + 10 + 34 + 12 : 100 + 10 + 38 + 14;
      color = b.level === 4 ? "#6fd2ff" : "#ffb020";
      r = b.level === 4 ? 16 : 24;
    } else if (b.kind === "castle") {
      height = b.level === 4 ? 70 : 110;
      color = b.level === 4 ? "#9fd8ff" : "#ffd75a";
      r = b.level === 4 ? 30 : 46;
    } else if (b.kind === "wall") {
      if (b.level < 5) return;
      height = 29 + 3 + 16;
      r = 7;
      color = "#fff3b0";
    }
    const [x, y] = this.toScreen(tx, ty, height);
    g.save();
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.25 + pulse * 0.35;
    const rad = r * z * (0.9 + pulse * 0.25);
    const grad = g.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, color);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    if (b.level === 5 && b.kind !== "wall") {
      // kreisende Funken
      g.globalAlpha = 0.9;
      g.fillStyle = color;
      for (let i = 0; i < 4; i++) {
        const a = t * 2 + (i * Math.PI) / 2;
        g.fillRect(x + Math.cos(a) * rad * 0.8 - 1.5, y + Math.sin(a) * rad * 0.4 - 1.5, 3, 3);
      }
    }
    g.restore();
  }

  private hpBar(b: Building, tx: number, ty: number) {
    const r = this.raid!;
    const hp = r.hp.get(b.id) ?? 0;
    const max = r.max.get(b.id) ?? 1;
    if (hp >= max) return;
    const s = SIZE[b.kind];
    const [x, y] = this.toScreen(tx, ty, 30 + s * 18);
    const w = 18 + s * 10;
    const g = this.ctx;
    g.fillStyle = "#1a120c";
    g.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
    g.fillStyle = hp / max > 0.4 ? "#7ed06a" : "#ff3d3d";
    g.fillRect(x - w / 2, y, w * Math.max(0, hp / max), 4);
  }

  private rubble(tx: number, ty: number, s: number) {
    const g = this.ctx;
    const z = this.cam.zoom;
    for (let i = 0; i < 3 + s * 2; i++) {
      const a = i * 2.4;
      const [x, y] = this.toScreen(tx + Math.cos(a) * 0.3 * s, ty + Math.sin(a) * 0.3 * s);
      g.fillStyle = i % 2 ? "#6e6a64" : "#8d8a84";
      g.beginPath();
      g.ellipse(x, y, 6 * z, 4 * z, 0, 0, Math.PI * 2);
      g.fill();
    }
  }

  private foe(tx: number, ty: number, kind: string, hp: number, swing: number, face: number) {
    const g = this.ctx;
    const z = this.cam.zoom;
    const [x, y] = this.toScreen(tx, ty);
    const size = (kind === "brute" ? 19 : kind === "runner" ? 11 : 14) * Math.max(0.55, z);
    const hop = Math.abs(Math.sin(this.time * 10 + tx * 3)) * 3 * z;
    g.fillStyle = "rgba(0,0,0,0.25)";
    g.beginPath();
    g.ellipse(x, y, size, size * 0.45, 0, 0, Math.PI * 2);
    g.fill();
    const by = y - size - hop;
    g.beginPath();
    g.arc(x, by, size, 0, Math.PI * 2);
    g.fillStyle = kind === "brute" ? "#8a4fd0" : kind === "runner" ? "#e0483a" : "#4fa83a";
    g.fill();
    g.strokeStyle = "#1a120c";
    g.lineWidth = 1.5;
    g.stroke();
    g.fillStyle = "#ffd000";
    g.fillRect(x - size * 0.45, by - size * 0.25, size * 0.3, size * 0.25);
    g.fillRect(x + size * 0.15, by - size * 0.25, size * 0.3, size * 0.25);
    // Waffe
    g.save();
    g.translate(x + face * size * 0.9, by);
    g.rotate(face * (swing > 0 ? -1.2 : -0.3));
    g.fillStyle = "#6b4226";
    g.fillRect(-1.5 * z, -size * 1.4, 3 * z, size * 1.4);
    g.restore();
    if (hp < 1) {
      g.fillStyle = "#1a120c";
      g.fillRect(x - size, by - size * 1.8, size * 2, 3);
      g.fillStyle = "#ff3d3d";
      g.fillRect(x - size, by - size * 1.8, size * 2 * Math.max(0, hp), 3);
    }
  }

  private guard(tx: number, ty: number, hp: number, swing: number) {
    const g = this.ctx;
    const z = this.cam.zoom;
    const [x, y] = this.toScreen(tx, ty);
    const size = 12 * Math.max(0.55, z);
    g.fillStyle = "rgba(0,0,0,0.25)";
    g.beginPath();
    g.ellipse(x, y, size, size * 0.45, 0, 0, Math.PI * 2);
    g.fill();
    const by = y - size * 1.4;
    g.fillStyle = "#2f6bff";
    g.strokeStyle = "#1a120c";
    g.lineWidth = 1.5;
    g.beginPath();
    g.roundRect(x - size * 0.7, by - size * 0.6, size * 1.4, size * 1.6, 3);
    g.fill();
    g.stroke();
    g.beginPath();
    g.arc(x, by - size, size * 0.6, 0, Math.PI * 2);
    g.fillStyle = "#c9ced6";
    g.fill();
    g.stroke();
    g.save();
    g.translate(x + size, by);
    g.rotate(swing > 0 ? 0.9 : 0.2);
    g.fillStyle = "#e9eef5";
    g.fillRect(-1.5 * z, -size * 1.6, 3 * z, size * 1.6);
    g.restore();
    if (hp < 1) {
      g.fillStyle = "#1a120c";
      g.fillRect(x - size, by - size * 2.2, size * 2, 3);
      g.fillStyle = "#7ed06a";
      g.fillRect(x - size, by - size * 2.2, size * 2 * Math.max(0, hp), 3);
    }
  }

  private drawFx() {
    const g = this.ctx;
    const z = this.cam.zoom;
    for (const f of this.fx) {
      const a = Math.max(0, f.life / f.max);
      if (f.kind === "spark") {
        const [x, y] = this.toScreen(f.x, f.y, f.z);
        g.globalAlpha = a;
        g.fillStyle = f.color;
        const s = Math.max(2, 4 * z);
        g.fillRect(x - s / 2, y - s / 2, s, s);
      } else if (f.kind === "ring") {
        const [x, y] = this.toScreen(f.x, f.y);
        const r = (1 - a) * 70 * z + 6;
        g.globalAlpha = a;
        g.strokeStyle = f.color;
        g.lineWidth = 3;
        g.beginPath();
        g.ellipse(x, y, r, r / 2, 0, 0, Math.PI * 2);
        g.stroke();
      } else {
        const [x, y] = this.toScreen(f.x, f.y, f.z);
        g.globalAlpha = Math.min(1, a * 2);
        g.font = `${Math.round(18 + 10 * z)}px 'Lilita One', system-ui, sans-serif`;
        g.textAlign = "center";
        g.lineWidth = 5;
        g.lineJoin = "round";
        g.strokeStyle = "#1a120c";
        g.strokeText(f.text, x, y);
        g.fillStyle = f.color;
        g.fillText(f.text, x, y);
      }
    }
    g.globalAlpha = 1;
  }
}

function depthOf(b: Building) {
  return b.x + b.y + SIZE[b.kind];
}

/** Bäume und Felsen rund um das Baufeld, immer gleich verteilt. */
function makeDecos(): Deco[] {
  let seed = 12345;
  const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const out: Deco[] = [];
  for (let y = -14; y < FIELD + 14; y++) {
    for (let x = -14; x < FIELD + 14; x++) {
      const inside = x >= -1 && y >= -1 && x <= FIELD && y <= FIELD;
      if (inside) continue;
      const edge = Math.min(Math.abs(x < 0 ? x : x - FIELD), Math.abs(y < 0 ? y : y - FIELD));
      const chance = edge < 3 ? 0.22 : 0.35;
      if (r() < chance)
        out.push({ x: x + 0.2 + r() * 0.6, y: y + 0.2 + r() * 0.6, tree: r() < 0.85, v: Math.floor(r() * 6) });
    }
  }
  return out;
}
