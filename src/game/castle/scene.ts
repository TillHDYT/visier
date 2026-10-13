/**
 * 3D-Szene des Königreichs (Three.js): Kamera mit Ziehen/Zoomen, Auswahl per
 * Antippen, Platzieren und Verschieben, Ernte-Blasen und Angriffe.
 * Gezeichnet wird nur bei Änderungen; Schatten werden nur neu berechnet,
 * wenn sich Gebäude ändern.
 */
import * as THREE from "three";
import { Sfx } from "@/game/audio";
import {
  INNER1,
  PRODUCTION,
  SIZE,
  WORLD,
  castleLevel,
  fits,
  freeSpotNear,
  move,
  occupancy,
  pending,
  rateOf,
  type BuildingKind,
  type Castle,
  type Resource,
} from "./model";
import { CastleLook, castleOpaqueAt, preloadCastleArt } from "./castle-look";
import { Decor, Templates, cityWall, landscape, unitGeometry } from "./meshes";
import { WallLook, preloadWallArt, wallArtReady, wallStyleOf } from "./wall-look";
import { SEG_PER_SIDE, foesLeft, segmentCenter, startRaid, stepRaid, type Raid, type RaidEvent } from "./raid";
import { Materials } from "./textures";

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
  onSelect: (sel: number | "wall" | null) => void;
  onCommit: (castle: Castle, coins: number) => void;
  onCollect: (ids: number[]) => void;
  onToast: (text: string) => void;
  onRaid: (view: RaidView | null) => void;
  onPlace: (view: PlaceView | null) => void;
};

type Pointer = { x: number; y: number; sx: number; sy: number };
type Gesture = {
  kind: "pan" | "pinch" | "move" | "ghost";
  moved: boolean;
  grab?: THREE.Vector3;
  dist?: number;
  zoom?: number;
  offX?: number;
  offY?: number;
};
type Fx =
  | { kind: "spark"; x: number; y: number; vx: number; vy: number; life: number; max: number; color: string }
  | { kind: "ring"; x: number; y: number; life: number; max: number; color: string }
  | { kind: "text"; x: number; y: number; life: number; max: number; text: string; color: string };

const RES_COLOR: Record<Resource, string> = { gold: "#ffd000", food: "#f2c84b", stone: "#b9c0c8", coal: "#3a3a40" };
const STEP = 1 / 30;
const DIST_MIN = 14;
const DIST_MAX = 95;

export class CastleScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 1, 500);
  private overlay: CanvasRenderingContext2D;
  private mats = new Materials();
  private templates = new Templates(this.mats);
  private sfx = new Sfx();
  private target = new THREE.Vector3(WORLD / 2, 0, WORLD / 2);
  private dist = 62;
  private decor: Decor;
  private sun: THREE.DirectionalLight;
  private groups = new Map<number, THREE.Group>();
  private builtAs = new Map<number, string>();
  private wall: THREE.Group | null = null;
  private wallKey = "";
  private wallLook: WallLook | null = null;
  private wallWaiting = false;
  /** Ansicht um 90° gedreht (Handy hochkant, Burg im Querformat)? */
  private turned = false;
  private ghost: { kind: BuildingKind; x: number; y: number; group: THREE.Group } | null = null;
  private ghostPad: THREE.Mesh;
  private selPad: THREE.Mesh;
  private moving: { id: number; x: number; y: number } | null = null;
  private selected: number | "wall" | null = null;
  private castle: Castle;
  private coins: number;
  private warriors = 0;
  private raid: Raid | null = null;
  private raidAcc = 0;
  private raidEmit = 0;
  private units = new THREE.Group();
  private unitGeo = unitGeometry();
  private unitMats = {
    orc: new THREE.MeshLambertMaterial({ color: "#5aa83a" }),
    runner: new THREE.MeshLambertMaterial({ color: "#d8402c" }),
    brute: new THREE.MeshLambertMaterial({ color: "#7a3fc0" }),
    guard: new THREE.MeshLambertMaterial({ color: "#2f6bff" }),
    shot: new THREE.MeshBasicMaterial({ color: "#ffe27a" }),
    rubble: new THREE.MeshLambertMaterial({ color: "#6e6a64" }),
  };
  private shotGeo = new THREE.SphereGeometry(0.12, 6, 4);
  private rubbleGeo = new THREE.DodecahedronGeometry(0.5, 0);
  private pointers = new Map<number, Pointer>();
  private gesture: Gesture | null = null;
  private fx: Fx[] = [];
  private pops = new Map<number, number>();
  private spinners: THREE.Object3D[] = [];
  private look: CastleLook | null = null;
  private dirty = true;
  private overlayAt = 0;
  private time = 0;
  private last = performance.now();
  private raf = 0;
  private destroyed = false;
  private viewW = 1;
  private viewH = 1;
  private ro: ResizeObserver;
  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  constructor(
    private canvas: HTMLCanvasElement,
    private overlayCanvas: HTMLCanvasElement,
    castle: Castle,
    coins: number,
    private hooks: SceneHooks,
  ) {
    const dpr = window.devicePixelRatio || 1;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: dpr < 2, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(dpr, 1.6));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.overlay = overlayCanvas.getContext("2d")!;
    this.castle = castle;
    this.coins = coins;

    const sky = new THREE.Color("#a9cfe0");
    this.scene.background = sky;
    this.scene.fog = new THREE.Fog(sky, 90, 190);
    this.scene.add(new THREE.HemisphereLight("#dcecff", "#3e5226", 1.0));
    this.sun = new THREE.DirectionalLight("#ffe7c2", 2.8);
    this.sun.position.set(WORLD / 2 - 26, 46, WORLD / 2 + 14);
    this.sun.target.position.set(WORLD / 2, 0, WORLD / 2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -34;
    sc.right = 34;
    sc.top = 34;
    sc.bottom = -34;
    sc.near = 10;
    sc.far = 120;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);
    this.scene.add(landscape(this.mats));
    this.decor = new Decor(this.mats);
    this.scene.add(this.decor.group);
    this.scene.add(this.units);

    this.ghostPad = pad(0x66ff66);
    this.selPad = pad(0xffd000);
    this.scene.add(this.ghostPad, this.selPad);
    this.ghostPad.visible = false;
    this.selPad.visible = false;

    const keep = castle.buildings.find((b) => b.kind === "castle");
    if (keep) this.target.set(keep.x + 3, 0, keep.y + 8);
    preloadCastleArt();
    preloadWallArt();
    this.sync();

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.resize();
    const el = overlayCanvas;
    el.addEventListener("pointerdown", this.onDown);
    el.addEventListener("pointermove", this.onMove);
    el.addEventListener("pointerup", this.onUp);
    el.addEventListener("pointercancel", this.onUp);
    el.addEventListener("wheel", this.onWheel, { passive: false });
    el.addEventListener("contextmenu", this.onContext);
    this.raf = requestAnimationFrame(this.frame);
    if (import.meta.env.DEV) (window as unknown as { __kingdom?: unknown }).__kingdom = this;
  }

  /** Nur für Tests: Grafik-Statistik des letzten Bildes. */
  stats() {
    const i = this.renderer.info;
    return {
      calls: i.render.calls,
      triangles: i.render.triangles,
      geometries: i.memory.geometries,
      textures: i.memory.textures,
    };
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    const el = this.overlayCanvas;
    el.removeEventListener("pointerdown", this.onDown);
    el.removeEventListener("pointermove", this.onMove);
    el.removeEventListener("pointerup", this.onUp);
    el.removeEventListener("pointercancel", this.onUp);
    el.removeEventListener("wheel", this.onWheel);
    el.removeEventListener("contextmenu", this.onContext);
    this.look?.dispose();
    this.wallLook?.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
    });
    this.renderer.dispose();
  }

  // -------------------------------------------------------------------------
  // Steuerung von außen

  setData(castle: Castle, coins: number, warriors: number, sound: boolean) {
    this.castle = castle;
    this.coins = coins;
    this.warriors = warriors;
    this.sfx.muted = !sound;
    if (typeof this.selected === "number" && !castle.buildings.some((b) => b.id === this.selected)) this.select(null);
    this.sync();
  }

  /** Die Oberfläche ist per CSS um 90° gedreht; Fingerpositionen werden umgerechnet. */
  setTurned(on: boolean) {
    this.turned = on;
    this.pointers.clear();
    this.gesture = null;
  }

  unlockAudio() {
    this.sfx.unlock();
  }

  select(sel: number | "wall" | null) {
    this.selected = sel;
    this.hooks.onSelect(sel);
    this.updateSelPad();
    this.dirty = true;
  }

  focus(id: number) {
    const b = this.castle.buildings.find((it) => it.id === id);
    if (!b) return;
    const s = SIZE[b.kind];
    this.target.set(b.x + s / 2, 0, b.y + s / 2);
    this.select(id);
  }

  beginPlace(kind: BuildingKind) {
    this.cancelPlace();
    this.select(null);
    const spot = freeSpotNear(occupancy(this.castle), kind, this.target.x, this.target.z);
    if (!spot) {
      this.hooks.onToast("Kein Platz frei");
      return;
    }
    const group = ghostOf(this.templates.get(kind, 1));
    this.scene.add(group);
    this.ghost = { kind, ...spot, group };
    this.placeGhost();
  }

  confirmPlace(): { kind: BuildingKind; x: number; y: number } | null {
    const g = this.ghost;
    if (!g) return null;
    if (!fits(occupancy(this.castle), g.kind, g.x, g.y)) {
      this.hooks.onToast("Hier ist kein Platz");
      return null;
    }
    const spot = { kind: g.kind, x: g.x, y: g.y };
    this.cancelPlace();
    return spot;
  }

  cancelPlace() {
    if (!this.ghost) return;
    this.scene.remove(this.ghost.group);
    this.ghost = null;
    this.ghostPad.visible = false;
    this.hooks.onPlace(null);
    this.dirty = true;
  }

  /** Effekt nach Bau/Upgrade: Gebäude hüpft, Funken, Text. */
  celebrate(id: number | "wall", level: number, text = true) {
    let x = WORLD / 2;
    let y = INNER1 + 0.5;
    let h = 3;
    if (id !== "wall") {
      const b = this.castle.buildings.find((it) => it.id === id);
      if (!b) return;
      const s = SIZE[b.kind];
      x = b.x + s / 2;
      y = b.y + s / 2;
      h = Templates.top(b.kind, level);
      this.pops.set(id, this.time);
    }
    const [sx, sy] = this.project(x, h * 0.6, y);
    const colors = ["#ffd000", "#fff6ea", "#ff8a2a", level >= 4 ? "#6fd2ff" : "#ffe27a"];
    for (let i = 0; i < 30 + level * 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 160;
      this.fx.push({
        kind: "spark",
        x: sx,
        y: sy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 120,
        life: 1 + Math.random() * 0.4,
        max: 1.4,
        color: colors[i % 4],
      });
    }
    this.fx.push({ kind: "ring", x: sx, y: sy, life: 0.6, max: 0.6, color: "#ffd000" });
    if (text)
      this.fx.push({ kind: "text", x: sx, y: sy - 30, life: 1.5, max: 1.5, text: `Stufe ${level}!`, color: "#ffd000" });
    this.sfx.level();
    this.dirty = true;
  }

  /** Schwebende Zahlen nach der Ernte. */
  harvested(id: number, amount: number, res: Resource) {
    const b = this.castle.buildings.find((it) => it.id === id);
    if (!b || amount <= 0) return;
    const s = SIZE[b.kind];
    const [sx, sy] = this.project(b.x + s / 2, Templates.top(b.kind, b.level), b.y + s / 2);
    this.fx.push({
      kind: "text",
      x: sx,
      y: sy - 20,
      life: 1.2,
      max: 1.2,
      text: `+${amount}`,
      color: RES_COLOR[res] === "#3a3a40" ? "#d8d8de" : RES_COLOR[res],
    });
    this.sfx.coin();
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
    // Kamera auf die angegriffene Mauer
    const first = this.raid.queue[0];
    if (first) this.target.set((first.x + WORLD / 2) / 2, 0, (first.y + WORLD / 2) / 2);
    this.dirty = true;
  }

  endRaid() {
    this.raid = null;
    this.units.clear();
    for (const g of this.groups.values()) g.visible = true;
    this.hooks.onRaid(null);
    this.dirty = true;
  }

  // -------------------------------------------------------------------------
  // Aufbau der 3D-Objekte aus den Daten

  private sync() {
    let changed = false;
    // Die Mauer wächst mit dem Schloss: ab Stufe 5 Gift, ab 10 Eis, ab 15 Feuer.
    const keepLevel = castleLevel(this.castle);
    const ws = wallStyleOf(keepLevel);
    const wallKey = ws.style
      ? `${this.castle.wall}|${ws.style}|${keepLevel}`
      : `${this.castle.wall}|${this.castle.skin}`;
    if (this.wallKey !== wallKey) {
      // Bilder noch nicht geladen: alte Mauer bleibt stehen, bis sie da sind.
      const ready =
        !ws.style ||
        (!this.wallWaiting &&
          wallArtReady(ws.style, () => {
            this.wallWaiting = false;
            if (this.destroyed) return;
            this.wallKey = "";
            this.sync();
          }));
      if (!ready) this.wallWaiting = true;
      else {
        this.removeWall();
        if (ws.style) {
          this.wallLook = new WallLook(this.mats, ws.style, this.castle.wall, ws.strength);
          this.wallLook.fit(this.camera.fov);
          this.wall = this.wallLook.group;
        } else {
          this.mats.setSkin(this.castle.skin);
          this.wall = cityWall(this.mats, this.castle.wall);
        }
        this.scene.add(this.wall);
        this.wallKey = wallKey;
        changed = true;
      }
    }
    const seen = new Set<number>();
    for (const b of this.castle.buildings) {
      seen.add(b.id);
      const key = `${b.kind}|${b.level}`;
      let g = this.groups.get(b.id);
      if (!g || this.builtAs.get(b.id) !== key) {
        if (g) this.scene.remove(g);
        if (b.kind === "castle") {
          this.look?.dispose();
          this.look = new CastleLook(this.mats, b.level, () => {
            this.dirty = true;
            this.renderer.shadowMap.needsUpdate = true;
          });
          g = this.look.group;
        } else g = this.templates.get(b.kind, b.level).clone();
        g.traverse((o) => (o.userData.id = b.id));
        this.groups.set(b.id, g);
        this.builtAs.set(b.id, key);
        this.scene.add(g);
        changed = true;
      }
      const s = SIZE[b.kind];
      const at = this.moving?.id === b.id ? this.moving : b;
      if (g.position.x !== at.x + s / 2 || g.position.z !== at.y + s / 2) {
        g.position.set(at.x + s / 2, 0, at.y + s / 2);
        changed = true;
      }
    }
    for (const [id, g] of this.groups) {
      if (seen.has(id)) continue;
      this.scene.remove(g);
      this.groups.delete(id);
      this.builtAs.delete(id);
      changed = true;
    }
    if (changed) {
      // Das Schloss-Bild ragt über seinen Bauplatz hinaus: davor keine Bäume.
      const keep = this.castle.buildings.find((b) => b.kind === "castle");
      this.decor.update(
        occupancy(this.castle),
        keep && { x0: keep.x - 2, y0: keep.y - 1, x1: keep.x + SIZE.castle + 1, y1: keep.y + SIZE.castle + 2 },
      );
      this.spinners = [];
      for (const g of this.groups.values()) g.traverse((o) => o.userData.spin && this.spinners.push(o));
      this.renderer.shadowMap.needsUpdate = true;
    }
    this.updateSelPad();
    this.dirty = true;
  }

  /** Alte Mauer entfernen; geteilte Materialien bleiben, Geometrien werden frei. */
  private removeWall() {
    if (!this.wall) return;
    this.scene.remove(this.wall);
    if (this.wallLook) this.wallLook.dispose();
    else
      this.wall.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.geometry.dispose();
      });
    this.wallLook = null;
    this.wall = null;
  }

  private updateSelPad() {
    const sel = this.selected;
    if (typeof sel !== "number") {
      this.selPad.visible = false;
      return;
    }
    const b = this.castle.buildings.find((it) => it.id === sel);
    if (!b) return;
    const s = SIZE[b.kind];
    const at = this.moving?.id === b.id ? this.moving : b;
    this.selPad.visible = true;
    this.selPad.scale.set(s, s, 1);
    this.selPad.position.set(at.x + s / 2, 0.04, at.y + s / 2);
    const ok = !this.moving || fits(occupancy(this.castle, b.id), b.kind, at.x, at.y);
    (this.selPad.material as THREE.MeshBasicMaterial).color.set(this.moving ? (ok ? 0x66ff66 : 0xff4040) : 0xffd000);
  }

  private placeGhost() {
    const g = this.ghost;
    if (!g) return;
    const s = SIZE[g.kind];
    const valid = fits(occupancy(this.castle), g.kind, g.x, g.y);
    g.group.position.set(g.x + s / 2, 0, g.y + s / 2);
    this.ghostPad.visible = true;
    this.ghostPad.scale.set(s, s, 1);
    this.ghostPad.position.set(g.x + s / 2, 0.05, g.y + s / 2);
    (this.ghostPad.material as THREE.MeshBasicMaterial).color.set(valid ? 0x66ff66 : 0xff4040);
    this.hooks.onPlace({ kind: g.kind, valid });
    this.dirty = true;
  }

  private emitRaid(force = false) {
    const r = this.raid;
    if (!r) return;
    const now = performance.now();
    if (!force && now - this.raidEmit < 150) return;
    this.raidEmit = now;
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

  // -------------------------------------------------------------------------
  // Kamera und Projektion

  private resize() {
    // Layout-Größe statt Bildschirm-Rechteck: Bei gedrehter Ansicht wären Breite und Höhe vertauscht.
    this.viewW = Math.max(1, this.canvas.clientWidth);
    this.viewH = Math.max(1, this.canvas.clientHeight);
    this.renderer.setSize(this.viewW, this.viewH, false);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.overlayCanvas.width = Math.round(this.viewW * dpr);
    this.overlayCanvas.height = Math.round(this.viewH * dpr);
    this.overlay.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.camera.aspect = this.viewW / this.viewH;
    // Hochformat: weiter weg, damit die Breite passt
    this.camera.fov = this.viewW < this.viewH ? 40 : 30;
    this.camera.updateProjectionMatrix();
    this.wallLook?.fit(this.camera.fov);
    this.dirty = true;
  }

  private placeCamera() {
    const az = Math.PI / 4;
    const el = 0.9;
    this.camera.position.set(
      this.target.x + Math.sin(az) * Math.cos(el) * this.dist,
      Math.sin(el) * this.dist,
      this.target.z + Math.cos(az) * Math.cos(el) * this.dist,
    );
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
  }

  /**
   * Begrenzt die Kamera und setzt sie sofort neu. Wichtig: Handys melden oft
   * mehrere Fingerbewegungen pro Bild. Rechnete die nächste Bewegung noch mit
   * der alten Kamera, schösse die Karte über und spränge hin und her.
   */
  private clampTarget() {
    this.target.x = Math.max(-6, Math.min(WORLD + 6, this.target.x));
    this.target.z = Math.max(-6, Math.min(WORLD + 10, this.target.z));
    this.dist = Math.max(DIST_MIN, Math.min(DIST_MAX, this.dist));
    this.placeCamera();
  }

  private project(x: number, y: number, z: number): [number, number] {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return [((v.x + 1) / 2) * this.viewW, ((1 - v.y) / 2) * this.viewH];
  }

  private groundAt(sx: number, sy: number): THREE.Vector3 | null {
    this.ray.setFromCamera(new THREE.Vector2((sx / this.viewW) * 2 - 1, -(sy / this.viewH) * 2 + 1), this.camera);
    const hit = new THREE.Vector3();
    return this.ray.ray.intersectPlane(this.plane, hit) ? hit : null;
  }

  private pick(sx: number, sy: number): number | "wall" | null {
    this.ray.setFromCamera(new THREE.Vector2((sx / this.viewW) * 2 - 1, -(sy / this.viewH) * 2 + 1), this.camera);
    const targets: THREE.Object3D[] = [...this.groups.values()];
    if (this.wall) targets.push(this.wall);
    const hits = this.ray.intersectObjects(targets, true);
    for (const h of hits) {
      // Durchsichtige Stellen des Schloss-Bildes lassen den Tipp durch.
      if ((h.object as THREE.Sprite).isSprite && !castleOpaqueAt(h.object, h.uv)) continue;
      if (h.object.userData.wall) return "wall";
      if (typeof h.object.userData.id === "number") return h.object.userData.id;
    }
    return null;
  }

  /** Antippbare Ernte-Blase an diesem Punkt? */
  private bubbleAt(sx: number, sy: number): number | null {
    for (const bub of this.bubbles()) if (Math.hypot(bub.x - sx, bub.y - sy) < 24) return bub.id;
    return null;
  }

  private bubbles(): { id: number; x: number; y: number; res: Resource; full: boolean }[] {
    if (this.raid) return [];
    const now = Date.now();
    const out: { id: number; x: number; y: number; res: Resource; full: boolean }[] = [];
    for (const b of this.castle.buildings) {
      const p = PRODUCTION[b.kind];
      if (!p) continue;
      const amount = pending(b, now);
      if (amount < Math.max(1, rateOf(b) * 0.05)) continue;
      const s = SIZE[b.kind];
      const [x, y] = this.project(b.x + s / 2, Templates.top(b.kind, b.level) + 0.6, b.y + s / 2);
      out.push({ id: b.id, x, y, res: p.res, full: amount >= rateOf(b) * 8 * 0.99 });
    }
    return out;
  }

  // -------------------------------------------------------------------------
  // Eingabe

  private onContext = (e: Event) => e.preventDefault();

  private local(e: PointerEvent | WheelEvent): [number, number] {
    const r = this.overlayCanvas.getBoundingClientRect();
    if (!this.turned) return [e.clientX - r.left, e.clientY - r.top];
    // Drehung um 90° im Uhrzeigersinn um die Mitte zurückrechnen
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    return [this.viewW / 2 + (e.clientY - cy), this.viewH / 2 - (e.clientX - cx)];
  }

  private onDown = (e: PointerEvent) => {
    this.sfx.unlock();
    const [x, y] = this.local(e);
    this.pointers.set(e.pointerId, { x, y, sx: x, sy: y });
    try {
      this.overlayCanvas.setPointerCapture(e.pointerId);
    } catch {
      /* Zeiger bereits weg */
    }
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.gesture = { kind: "pinch", moved: true, dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.dist };
      return;
    }
    if (this.pointers.size > 2) return;
    const ground = this.groundAt(x, y);
    if (this.ghost && ground) {
      const g = this.ghost;
      const s = SIZE[g.kind];
      const on =
        ground.x >= g.x - 0.5 && ground.x <= g.x + s + 0.5 && ground.z >= g.y - 0.5 && ground.z <= g.y + s + 0.5;
      if (on) {
        this.gesture = { kind: "ghost", moved: false, offX: ground.x - g.x, offY: ground.z - g.y };
        return;
      }
    }
    if (!this.raid && typeof this.selected === "number" && ground && this.pick(x, y) === this.selected) {
      const b = this.castle.buildings.find((it) => it.id === this.selected)!;
      this.gesture = { kind: "move", moved: false, offX: ground.x - b.x, offY: ground.z - b.y };
      return;
    }
    this.gesture = { kind: "pan", moved: false, grab: ground ?? undefined };
  };

  private onMove = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId);
    const g = this.gesture;
    if (!p || !g) return;
    const [x, y] = this.local(e);
    p.x = x;
    p.y = y;
    if (!g.moved && Math.hypot(x - p.sx, y - p.sy) > 8) g.moved = true;
    if (g.kind === "pinch") {
      const [a, b] = [...this.pointers.values()];
      if (!a || !b) return;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      this.dist = (g.zoom ?? this.dist) * ((g.dist ?? d) / Math.max(1, d));
      this.clampTarget();
      this.dirty = true;
      return;
    }
    if (!g.moved) return;
    const ground = this.groundAt(x, y);
    if (!ground) return;
    if (g.kind === "pan" && g.grab) {
      this.target.x += g.grab.x - ground.x;
      this.target.z += g.grab.z - ground.z;
      this.clampTarget();
      this.dirty = true;
    } else if (g.kind === "ghost" && this.ghost) {
      const nx = Math.round(ground.x - (g.offX ?? 0));
      const ny = Math.round(ground.z - (g.offY ?? 0));
      if (nx !== this.ghost.x || ny !== this.ghost.y) {
        this.ghost.x = nx;
        this.ghost.y = ny;
        this.placeGhost();
      }
    } else if (g.kind === "move" && typeof this.selected === "number") {
      const nx = Math.round(ground.x - (g.offX ?? 0));
      const ny = Math.round(ground.z - (g.offY ?? 0));
      if (!this.moving || this.moving.x !== nx || this.moving.y !== ny) {
        this.moving = { id: this.selected, x: nx, y: ny };
        this.sync();
      }
    }
  };

  private onUp = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (this.overlayCanvas.hasPointerCapture(e.pointerId)) this.overlayCanvas.releasePointerCapture(e.pointerId);
    const g = this.gesture;
    if (!p || !g) return;
    if (g.kind === "pinch") {
      this.gesture = this.pointers.size ? { kind: "pan", moved: true, grab: undefined } : null;
      return;
    }
    if (this.pointers.size > 0) return;
    this.gesture = null;
    if (g.kind === "move") {
      const m = this.moving;
      this.moving = null;
      if (m) {
        const next = move(this.castle, m.id, m.x, m.y);
        if (next) {
          this.castle = next;
          this.hooks.onCommit(next, this.coins);
          this.pops.set(m.id, this.time);
          this.sfx.click();
        } else this.hooks.onToast("Dort ist kein Platz");
        this.sync();
      }
      if (g.moved) return;
    }
    if (g.moved) return;
    // Tippen
    if (this.ghost) {
      const ground = this.groundAt(p.x, p.y);
      if (ground) {
        const s = SIZE[this.ghost.kind];
        this.ghost.x = Math.round(ground.x - s / 2);
        this.ghost.y = Math.round(ground.z - s / 2);
        this.placeGhost();
      }
      return;
    }
    const bubble = this.bubbleAt(p.x, p.y);
    if (bubble !== null) {
      this.hooks.onCollect([bubble]);
      return;
    }
    const hit = this.pick(p.x, p.y);
    if (this.raid) return;
    this.select(hit);
    if (typeof hit === "number") this.pops.set(hit, this.time - 0.25);
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.dist *= Math.exp(e.deltaY * 0.0012);
    this.clampTarget();
    this.dirty = true;
  };

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
      this.syncUnits();
      this.dirty = true;
    }

    let animating = this.fx.length > 0 || this.raid !== null || this.selected !== null || this.ghost !== null;
    for (const [id, t] of this.pops) {
      const age = this.time - t;
      const g = this.groups.get(id);
      if (!g) continue;
      if (age > 0.5) {
        g.scale.set(1, 1, 1);
        this.pops.delete(id);
      } else {
        const k = 1 + 0.12 * Math.sin((age / 0.5) * Math.PI) * (1 - age / 0.5);
        g.scale.set(k, k, k);
        animating = true;
      }
    }
    const ambient = (this.spinners.length > 0 || !!this.look?.animated || !!this.wallLook) && now - this.overlayAt > 33;
    if (ambient) {
      // Windmühlen und Schloss-Partikel: 30 Bilder pro Sekunde genügen und schonen den Akku.
      const step = Math.min(0.1, (now - this.overlayAt) / 1000);
      for (const s of this.spinners) s.rotation.z += step * 1.2;
      this.look?.tick(step);
      this.wallLook?.tick(step);
    }

    this.tickFx(dt);
    if (this.dirty || animating || ambient) {
      const pulse = 0.35 + 0.25 * Math.sin(this.time * 6);
      (this.selPad.material as THREE.MeshBasicMaterial).opacity = this.moving ? 0.55 : pulse;
      this.placeCamera();
      this.renderer.render(this.scene, this.camera);
      this.drawOverlay();
      this.overlayAt = now;
      this.dirty = false;
    } else if (now - this.overlayAt > 1000) {
      // Ernte-Blasen wachsen auch ohne Bewegung
      this.drawOverlay();
      this.overlayAt = now;
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  private handleEvents(events: RaidEvent[]) {
    let shot = false;
    for (const ev of events) {
      if (ev.type === "shot") shot = true;
      else if (ev.type === "foeDown") {
        const [x, y] = this.project(ev.x, 0.4, ev.y);
        for (let i = 0; i < 8; i++) {
          const a = Math.random() * Math.PI * 2;
          this.fx.push({
            kind: "spark",
            x,
            y,
            vx: Math.cos(a) * 80,
            vy: Math.sin(a) * 80 - 60,
            life: 0.5,
            max: 0.5,
            color: "#7ed06a",
          });
        }
        this.sfx.die();
      } else if (ev.type === "hit") {
        const [x, y] = this.project(ev.x, 0.6, ev.y);
        this.fx.push({ kind: "ring", x, y, life: 0.25, max: 0.25, color: ev.wall ? "#ff8a2a" : "#fff6ea" });
        this.sfx.hit();
      } else if (ev.type === "breach") {
        const c = segmentCenter(ev.seg);
        const [x, y] = this.project(c.x, 1, c.y);
        this.fx.push({ kind: "text", x, y: y - 20, life: 1.4, max: 1.4, text: "Bresche!", color: "#ff5a3a" });
        this.sfx.big();
      } else if (ev.type === "wreck") {
        const g = this.groups.get(ev.id);
        if (g) {
          g.visible = false;
          const r = new THREE.Mesh(this.rubbleGeo, this.unitMats.rubble);
          r.position.copy(g.position);
          r.scale.set(1.2, 0.5, 1.2);
          r.userData.rubble = true;
          this.units.add(r);
        }
        this.sfx.big();
      }
    }
    if (shot) this.sfx.shoot();
  }

  /** Einheiten und Geschosse aus der Simulation in die Szene übertragen. */
  private syncUnits() {
    const r = this.raid;
    if (!r) return;
    const keep = this.units.children.filter((c) => c.userData.rubble);
    this.units.clear();
    for (const k of keep) this.units.add(k);
    for (const f of r.foes) {
      if (!f.alive) continue;
      const m = new THREE.Mesh(this.unitGeo, this.unitMats[f.kind]);
      const s = f.kind === "brute" ? 1.5 : f.kind === "runner" ? 0.85 : 1;
      m.scale.set(s, s, s);
      m.position.set(f.x, Math.abs(Math.sin(this.time * 9 + f.x)) * 0.12, f.y);
      m.rotation.z = f.swing > 0 ? 0.3 : 0;
      this.units.add(m);
    }
    for (const g of r.guards) {
      if (!g.alive) continue;
      const m = new THREE.Mesh(this.unitGeo, this.unitMats.guard);
      m.position.set(g.x, 0, g.y);
      m.rotation.z = g.swing > 0 ? -0.3 : 0;
      this.units.add(m);
    }
    for (const s of r.shots) {
      if (!s.alive) continue;
      const m = new THREE.Mesh(this.shotGeo, this.unitMats.shot);
      m.position.set(s.x, s.z, s.y);
      this.units.add(m);
    }
  }

  private tickFx(dt: number) {
    if (!this.fx.length) return;
    for (const f of this.fx) {
      f.life -= dt;
      if (f.kind === "spark") {
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.vy += 320 * dt;
      } else if (f.kind === "text") f.y -= 30 * dt;
    }
    this.fx = this.fx.filter((f) => f.life > 0);
  }

  // -------------------------------------------------------------------------
  // 2D-Überlagerung: Blasen, Lebensbalken, Effekte

  private drawOverlay() {
    const g = this.overlay;
    g.clearRect(0, 0, this.viewW, this.viewH);
    for (const b of this.bubbles()) drawBubble(g, b.x, b.y, b.res, b.full, this.time);

    const r = this.raid;
    if (r) {
      for (let i = 0; i < SEG_PER_SIDE * 4; i++) {
        if (r.seg[i] >= r.segMax) continue;
        const c = segmentCenter(i);
        const [x, y] = this.project(c.x, 3.4, c.y);
        bar(g, x, y, 40, Math.max(0, r.seg[i] / r.segMax), r.seg[i] > 0 ? "#ffd000" : "#ff3d3d");
      }
      for (const b of this.castle.buildings) {
        const hp = r.hp.get(b.id) ?? 0;
        const max = r.max.get(b.id) ?? 1;
        if (hp >= max || hp <= 0) continue;
        const s = SIZE[b.kind];
        const [x, y] = this.project(b.x + s / 2, Templates.top(b.kind, b.level), b.y + s / 2);
        bar(g, x, y, 44, hp / max, "#7ed06a");
      }
      for (const f of r.foes) {
        if (!f.alive || f.hp >= f.max) continue;
        const [x, y] = this.project(f.x, 1.1, f.y);
        bar(g, x, y, 22, f.hp / f.max, "#ff3d3d");
      }
    }

    for (const f of this.fx) {
      const a = Math.max(0, f.life / f.max);
      g.globalAlpha = Math.min(1, a * 1.6);
      if (f.kind === "spark") {
        g.fillStyle = f.color;
        g.fillRect(f.x - 2.5, f.y - 2.5, 5, 5);
      } else if (f.kind === "ring") {
        const rad = (1 - a) * 70 + 6;
        g.strokeStyle = f.color;
        g.lineWidth = 3;
        g.beginPath();
        g.ellipse(f.x, f.y, rad, rad * 0.55, 0, 0, Math.PI * 2);
        g.stroke();
      } else {
        g.font = "26px 'Lilita One', system-ui, sans-serif";
        g.textAlign = "center";
        g.lineJoin = "round";
        g.lineWidth = 6;
        g.strokeStyle = "#1a120c";
        g.strokeText(f.text, f.x, f.y);
        g.fillStyle = f.color;
        g.fillText(f.text, f.x, f.y);
      }
    }
    g.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------
// Hilfen

function pad(color: number) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 1;
  return m;
}

const ghostMat = new THREE.MeshLambertMaterial({ color: "#e8ffe0", transparent: true, opacity: 0.7 });

function ghostOf(t: THREE.Group): THREE.Group {
  const g = t.clone();
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.material = ghostMat;
      m.castShadow = false;
    }
  });
  return g;
}

function bar(g: CanvasRenderingContext2D, x: number, y: number, w: number, frac: number, color: string) {
  g.fillStyle = "#1a120c";
  g.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
  g.fillStyle = color;
  g.fillRect(x - w / 2, y, w * frac, 4);
}

/** Weiße Sprechblase mit Rohstoff-Symbol, wie in Aufbauspielen üblich. */
function drawBubble(g: CanvasRenderingContext2D, x: number, y: number, res: Resource, full: boolean, t: number) {
  const bob = Math.sin(t * 3 + x * 0.05) * 3;
  const cy = y + bob - 26;
  g.save();
  g.shadowColor = "rgba(0,0,0,0.35)";
  g.shadowBlur = 6;
  g.fillStyle = full ? "#fff3c4" : "#ffffff";
  g.beginPath();
  g.roundRect(x - 20, cy - 20, 40, 40, 10);
  g.fill();
  g.beginPath();
  g.moveTo(x - 6, cy + 19);
  g.lineTo(x, cy + 28);
  g.lineTo(x + 6, cy + 19);
  g.fill();
  g.restore();
  g.lineWidth = 2;
  g.strokeStyle = full ? "#e7b52c" : "#c9c2b4";
  g.beginPath();
  g.roundRect(x - 20, cy - 20, 40, 40, 10);
  g.stroke();
  resIcon(g, x, cy, res, 13);
}

export function resIcon(g: CanvasRenderingContext2D, x: number, y: number, res: Resource, r: number) {
  g.lineWidth = 1.6;
  g.strokeStyle = "#1a120c";
  if (res === "gold") {
    g.fillStyle = "#ffd000";
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = "#c8960c";
    g.beginPath();
    g.arc(x, y, r * 0.55, 0, Math.PI * 2);
    g.fill();
  } else if (res === "food") {
    g.fillStyle = "#f2c84b";
    for (let i = -2; i <= 2; i++) {
      g.beginPath();
      g.ellipse(x + i * r * 0.18, y - Math.abs(i) * r * 0.1, r * 0.22, r * 0.55, i * 0.25, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    g.strokeStyle = "#7a9a30";
    g.beginPath();
    g.moveTo(x, y + r * 0.3);
    g.lineTo(x, y + r);
    g.stroke();
  } else if (res === "stone") {
    g.fillStyle = "#b9c0c8";
    g.beginPath();
    g.moveTo(x - r, y + r * 0.6);
    g.lineTo(x - r * 0.6, y - r * 0.6);
    g.lineTo(x + r * 0.4, y - r * 0.8);
    g.lineTo(x + r, y + r * 0.1);
    g.lineTo(x + r * 0.5, y + r * 0.7);
    g.closePath();
    g.fill();
    g.stroke();
  } else {
    g.fillStyle = "#2a2a30";
    g.beginPath();
    g.moveTo(x - r, y + r * 0.4);
    g.lineTo(x - r * 0.3, y - r * 0.9);
    g.lineTo(x + r * 0.8, y - r * 0.3);
    g.lineTo(x + r * 0.6, y + r * 0.7);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = "#6a6a74";
    g.fillRect(x - r * 0.2, y - r * 0.4, r * 0.35, r * 0.2);
  }
}
