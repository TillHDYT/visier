import { useEffect, useRef, useState } from "react";
import {
  CASTLE_S,
  GRID_H,
  GRID_W,
  PIECE_MAX,
  PLACE_COST,
  SKIN_INFO,
  castleCell,
  keepCost,
  keepAt,
  pieceUpgradeCost,
  readPlots,
  writePlots,
  BUILD_MAX,
  type Meta,
  type Plot,
} from "@/game/meta";

type Tool = "wall" | "tower" | "house" | "move" | "erase";
type Foe = { x: number; y: number; hp: number; max: number; tier: number; cd: number };
type Ally = { x: number; y: number; hp: number; cd: number };
type Bolt = { x: number; y: number; tx: number; ty: number; life: number };
type View = { camX: number; camY: number; tw: number; th: number; w: number; h: number; ready: boolean };

const INK = "#1a120c";
const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

const TOOLS: { id: Tool; name: string }[] = [
  { id: "wall", name: "Mauer" },
  { id: "tower", name: "Turm" },
  { id: "house", name: "Haus" },
  { id: "move", name: "Ziehen" },
  { id: "erase", name: "Weg" },
];

function idx(c: number, r: number) {
  return r * GRID_W + c;
}

function hash(c: number, r: number) {
  return (c * 17 + r * 31 + c * r) % 13;
}

export function CastleView({
  meta,
  onMeta,
  onClose,
}: {
  meta: Meta;
  onMeta: (next: Meta) => void;
  onClose: () => void;
}) {
  const metaRef = useRef(meta);
  metaRef.current = meta;
  const onMetaRef = useRef(onMeta);
  onMetaRef.current = onMeta;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paintRef = useRef<(Plot | null)[] | null>(null);
  const dragRef = useRef<{ from: number; c: number; r: number; plot: Plot } | null>(null);
  const hoverRef = useRef<{ c: number; r: number } | null>(null);
  const toolRef = useRef<Tool>("wall");
  const raidRef = useRef(false);
  const actRef = useRef<() => void>(() => {});
  const startRef = useRef<() => void>(() => {});
  const repairRef = useRef<() => void>(() => {});
  const [tool, setTool] = useState<Tool>("wall");
  const [sel, setSel] = useState<number | "castle" | null>(null);
  const [hud, setHud] = useState({
    gold: meta.coins,
    raid: false,
    fallen: false,
    wave: 1,
    timer: 18,
    keep: 1,
    keepMax: 1,
  });
  toolRef.current = tool;
  const selRef = useRef(sel);
  selRef.current = sel;
  keepAt.c = meta.castle.cx;
  keepAt.r = meta.castle.cy;

  useEffect(() => {
    if (meta.castle.kit || sessionStorage.getItem("visier-kit") === "1") return;
    sessionStorage.setItem("visier-kit", "1");
    onMeta({
      ...meta,
      coins: meta.coins + 280,
      castle: { ...meta.castle, kit: true },
    });
  }, []);

  useEffect(() => {
    const node = canvasRef.current;
    if (!node) return;
    const gfx = node.getContext("2d");
    if (!gfx) return;
    const canvas: HTMLCanvasElement = node;
    const ctx: CanvasRenderingContext2D = gfx;
    const skins = new Map<string, HTMLImageElement>();
    for (const skin of SKIN_INFO) {
      const img = new Image();
      img.src = skin.src;
      skins.set(skin.id, img);
    }

    let foes: Foe[] = [];
    let allies: Ally[] = [];
    let bolts: Bolt[] = [];
    let raid = false;
    let fallen = false;
    let wave = 1;
    let castleHp = 240;
    let castleMax = 240;
    let allyWait = 0;
    let blast = 0;
    let flash = 0;
    const towerAcc = new Map<number, number>();
    const wallHp = new Map<number, number>();
    let last = performance.now();
    let hudAt = 0;
    let running = true;
    const view: View = { camX: 180, camY: 80, tw: 58, th: 29, w: 360, h: 640, ready: false };
    let pen: { c: number; r: number } | null = null;
    let gesture: "none" | "paint" | "drag" | "pan" | "tap" | "erase" | "keep" = "none";
    let panX = 0;
    let panY = 0;
    let startX = 0;
    let startY = 0;
    let keepDrag: { c: number; r: number; dc: number; dr: number } | null = null;
    let keepGrab = { dc: 0, dr: 0 };

    function line(c0: number, r0: number, c1: number, r1: number, put: (c: number, r: number) => void) {
      let x0 = c0;
      let y0 = r0;
      const dx = Math.abs(c1 - c0);
      const dy = Math.abs(r1 - r0);
      const sx = c0 < c1 ? 1 : -1;
      const sy = r0 < r1 ? 1 : -1;
      let err = dx - dy;
      for (;;) {
        put(x0, y0);
        if (x0 === c1 && y0 === r1) break;
        const e2 = 2 * err;
        if (e2 > -dy) {
          err -= dy;
          x0 += sx;
        }
        if (e2 < dx) {
          err += dx;
          y0 += sy;
        }
      }
    }

    function layout() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(2, Math.floor(rect.width * dpr));
      canvas.height = Math.max(2, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      view.w = rect.width;
      view.h = rect.height;
      view.tw = Math.max(48, Math.min(64, Math.round(rect.width / 7)));
      view.th = Math.round(view.tw / 2);
      if (!view.ready) {
        const cc = keepAt.c + 1.5;
        const cr = keepAt.r + 1.5;
        view.camX = rect.width / 2 - (cc - cr) * (view.tw / 2);
        view.camY = rect.height / 2 - 30 - (cc + cr) * (view.th / 2);
        view.ready = true;
      }
    }

    function clampCam() {
      const sx = view.w / 2 - view.camX;
      const sy = view.h / 2 - 24 - view.camY;
      let c = (sx / (view.tw / 2) + sy / (view.th / 2)) / 2;
      let r = (sy / (view.th / 2) - sx / (view.tw / 2)) / 2;
      const cc = Math.min(GRID_W - 2, Math.max(1, c));
      const rr = Math.min(GRID_H - 2, Math.max(1, r));
      if (cc !== c || rr !== r) {
        view.camX = view.w / 2 - (cc - rr) * (view.tw / 2);
        view.camY = view.h / 2 - 24 - (cc + rr) * (view.th / 2);
      }
    }

    function plotsNow() {
      return paintRef.current ?? readPlots(metaRef.current.castle.grid);
    }

    function commitPlots(plots: (Plot | null)[], coins: number, keep = metaRef.current.castle.keep) {
      const m = metaRef.current;
      onMetaRef.current({
        ...m,
        coins,
        castle: { ...m.castle, grid: writePlots(plots), keep },
      });
    }

    function spawnRaid() {
      raid = true;
      raidRef.current = true;
      fallen = false;
      setSel(null);
      const plots = plotsNow();
      wallHp.clear();
      plots.forEach((p, i) => {
        if (!p) return;
        const base = p.kind === "tower" ? 70 : p.kind === "house" ? 48 : 42;
        wallHp.set(i, base * p.level);
      });
      const keep = metaRef.current.castle.keep;
      castleMax = 220 + keep * 80;
      castleHp = castleMax;
      foes = [];
      const edge: [number, number][] = [];
      for (let c = 0; c < GRID_W; c++) edge.push([c, 0], [c, GRID_H - 1]);
      for (let r = 1; r < GRID_H - 1; r++) edge.push([0, r], [GRID_W - 1, r]);
      const n = Math.min(edge.length, 4 + wave);
      for (let i = 0; i < n; i++) {
        const [c, r] = edge[(i * 5 + wave * 3) % edge.length];
        const tier = wave >= 6 && i % 5 === 0 ? 2 : wave >= 3 && i % 4 === 0 ? 1 : 0;
        const hp = (22 + wave * 8) * (tier === 2 ? 2.3 : tier === 1 ? 1.55 : 1);
        foes.push({ x: c + 0.5, y: r + 0.5, hp, max: hp, tier, cd: 0.2 });
      }
      allies = [];
      allyWait = 0.2;
    }

    function breakWall(i: number) {
      wallHp.delete(i);
      const plots = readPlots(metaRef.current.castle.grid);
      if (!plots[i]) return;
      plots[i] = null;
      commitPlots(plots, metaRef.current.coins);
    }

    actRef.current = () => {
      if (!raid || fallen || blast > 0) return;
      blast = 2.6;
      flash = 0.35;
      const power = 26 + metaRef.current.castle.boosters * 16;
      const cx = keepAt.c + 1.5;
      const cy = keepAt.r + 1.5;
      for (const foe of foes) {
        const dx = foe.x - cx;
        const dy = foe.y - cy;
        if (dx * dx + dy * dy < 18) foe.hp -= power;
      }
    };

    repairRef.current = () => {
      const m = metaRef.current;
      if (!fallen || m.coins < 40) return;
      commitPlots(readPlots(m.castle.grid), m.coins - 40);
      fallen = false;
      raid = false;
      raidRef.current = false;
      castleHp = castleMax || 240;
      foes = [];
    };

    startRef.current = () => {
      if (raid || fallen) return;
      spawnRaid();
    };

    function step(dt: number) {
      if (!raid) return;
      const plots = plotsNow();
      if (fallen) return;
      if (blast > 0) blast -= dt;
      if (flash > 0) flash -= dt;
      const houses = plots.filter((p) => p?.kind === "house").length;
      const garrison = Math.min(6, metaRef.current.warriors + houses);
      if (allies.length < garrison) {
        allyWait -= dt;
        if (allyWait <= 0) {
          allies.push({ x: keepAt.c + 1.5, y: keepAt.r + CASTLE_S - 0.2, hp: 40 + metaRef.current.castle.keep * 6, cd: 0 });
          allyWait = 1.3;
        }
      }
      for (let i = 0; i < plots.length; i++) {
        const p = plots[i];
        if (p?.kind !== "tower") continue;
        const acc = (towerAcc.get(i) ?? 0) - dt;
        if (acc > 0) {
          towerAcc.set(i, acc);
          continue;
        }
        const c = (i % GRID_W) + 0.5;
        const r = Math.floor(i / GRID_W) + 0.5;
        let best: Foe | null = null;
        let bestD = 3.4 * 3.4;
        for (const foe of foes) {
          const d = (foe.x - c) ** 2 + (foe.y - r) ** 2;
          if (d < bestD) {
            bestD = d;
            best = foe;
          }
        }
        if (!best) {
          towerAcc.set(i, 0.2);
          continue;
        }
        best.hp -= 8 + p.level * 7;
        towerAcc.set(i, Math.max(0.45, 0.95 - p.level * 0.12));
        bolts.push({ x: c, y: r, tx: best.x, ty: best.y, life: 0.16 });
      }
      for (const ally of allies) {
        ally.cd = Math.max(0, ally.cd - dt);
        let best: Foe | null = null;
        let bestD = 99;
        for (const foe of foes) {
          const d = Math.hypot(foe.x - ally.x, foe.y - ally.y);
          if (d < bestD) {
            bestD = d;
            best = foe;
          }
        }
        if (!best) continue;
        if (bestD < 0.75) {
          if (ally.cd <= 0) {
            best.hp -= 9;
            ally.cd = 0.55;
          }
        } else {
          ally.x += ((best.x - ally.x) / bestD) * dt * 1.35;
          ally.y += ((best.y - ally.y) / bestD) * dt * 1.35;
        }
      }
      for (const foe of foes) {
        foe.cd = Math.max(0, foe.cd - dt);
        const c = Math.floor(foe.x);
        const r = Math.floor(foe.y);
        if (castleCell(c, r)) {
          if (foe.cd <= 0) {
            castleHp -= 8 + foe.tier * 4;
            foe.cd = 0.7;
          }
          continue;
        }
        const next = toward(plots, c, r, keepAt.c, keepAt.r);
        if (!next) continue;
        const ni = idx(next.c, next.r);
        const block = plots[ni];
        if (block) {
          if (foe.cd <= 0) {
            const base = block.kind === "tower" ? 70 : block.kind === "house" ? 48 : 42;
            const left = (wallHp.get(ni) ?? base * block.level) - (7 + foe.tier * 4);
            foe.cd = 0.62;
            if (left <= 0) breakWall(ni);
            else wallHp.set(ni, left);
          }
          continue;
        }
        const ally = allies.find((a) => Math.hypot(a.x - foe.x, a.y - foe.y) < 0.75);
        if (ally && foe.cd <= 0) {
          ally.hp -= 6 + foe.tier * 3;
          foe.cd = 0.6;
          continue;
        }
        const tx = next.c + 0.5;
        const ty = next.r + 0.5;
        const dx = tx - foe.x;
        const dy = ty - foe.y;
        const dist = Math.hypot(dx, dy) || 1;
        const sp = dt * (0.95 + foe.tier * 0.12);
        foe.x += (dx / dist) * Math.min(sp, dist);
        foe.y += (dy / dist) * Math.min(sp, dist);
      }
      foes = foes.filter((f) => f.hp > 0);
      const before = allies.length;
      allies = allies.filter((a) => a.hp > 0);
      if (allies.length < before) allyWait = Math.max(allyWait, 2.2);
      bolts = bolts.filter((b) => {
        b.life -= dt;
        return b.life > 0;
      });
      if (castleHp <= 0) {
        castleHp = 0;
        fallen = true;
        foes = [];
      } else if (foes.length === 0 && allies.length >= 0) {
        raid = false;
        raidRef.current = false;
        wave += 1;
        wallHp.clear();
      }
    }

    function frame(now: number) {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      step(dt);
      if (keepDrag) {
        keepAt.c = keepDrag.c;
        keepAt.r = keepDrag.r;
      } else {
        keepAt.c = metaRef.current.castle.cx;
        keepAt.r = metaRef.current.castle.cy;
      }
      const plots = plotsNow();
      drawRealm(ctx, view, plots, skins.get(metaRef.current.castle.skin) ?? null, metaRef.current.castle.skin, {
        foes,
        allies,
        bolts,
        raid,
        flash,
        castleHp,
        castleMax,
        wallHp,
        hover: hoverRef.current,
        drag: dragRef.current,
        sel: selRef.current,
        keep: metaRef.current.castle.keep,
      });
      if (now - hudAt > 160) {
        hudAt = now;
        setHud({
          gold: metaRef.current.coins,
          raid,
          fallen,
          wave: Math.max(1, raid ? wave : wave),
          timer: 0,
          keep: Math.max(0, Math.round(castleHp)),
          keepMax: Math.round(castleMax),
        });
      }
      requestAnimationFrame(frame);
    }

    function cellAt(e: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left - view.camX;
      const y = e.clientY - rect.top - view.camY;
      const c = Math.floor((x / (view.tw / 2) + y / (view.th / 2)) / 2);
      const r = Math.floor((y / (view.th / 2) - x / (view.tw / 2)) / 2);
      if (c < 0 || r < 0 || c >= GRID_W || r >= GRID_H) return null;
      return { c, r };
    }

    function onDown(e: PointerEvent) {
      startX = e.clientX;
      startY = e.clientY;
      panX = e.clientX;
      panY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
      const hit = cellAt(e);
      hoverRef.current = hit;
      if (raidRef.current || !hit) {
        gesture = "pan";
        return;
      }
      const toolNow = toolRef.current;
      if (toolNow === "move" && castleCell(hit.c, hit.r)) {
        gesture = "keep";
        keepGrab = { dc: hit.c - keepAt.c, dr: hit.r - keepAt.r };
        keepDrag = { c: keepAt.c, r: keepAt.r, dc: keepGrab.dc, dr: keepGrab.dr };
        setSel("castle");
        return;
      }
      if (castleCell(hit.c, hit.r)) {
        gesture = "tap";
        return;
      }
      const plots = readPlots(metaRef.current.castle.grid);
      const i = idx(hit.c, hit.r);
      if (toolNow === "wall") {
        gesture = "paint";
        paintRef.current = plots.slice();
        pen = { c: hit.c, r: hit.r };
        stampWall(hit.c, hit.r);
        return;
      }
      if (toolNow === "erase" && plots[i]) {
        gesture = "erase";
        eraseAt(i);
        return;
      }
      if (toolNow === "move" && plots[i]) {
        gesture = "drag";
        dragRef.current = { from: i, c: hit.c, r: hit.r, plot: plots[i] };
        setSel(i);
        return;
      }
      gesture = "tap";
    }

    function stampWall(c: number, r: number) {
      const draft = paintRef.current;
      if (!draft || castleCell(c, r)) return;
      const i = idx(c, r);
      if (draft[i]) return;
      const base = readPlots(metaRef.current.castle.grid);
      const added = draft.reduce((n, p, k) => n + (p && !base[k] ? 1 : 0), 0);
      if (metaRef.current.coins < (added + 1) * PLACE_COST.wall) return;
      draft[i] = { kind: "wall", level: 1 };
    }

    function eraseAt(i: number) {
      const plots = readPlots(metaRef.current.castle.grid);
      const plot = plots[i];
      if (!plot) return;
      plots[i] = null;
      const refund = Math.floor(PLACE_COST[plot.kind] * 0.5);
      commitPlots(plots, metaRef.current.coins + refund);
      setSel(null);
    }

    function onMove(e: PointerEvent) {
      const dx = e.clientX - panX;
      const dy = e.clientY - panY;
      panX = e.clientX;
      panY = e.clientY;
      const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
      if (gesture === "tap" && dist > 12) gesture = "pan";
      if (gesture === "pan") {
        view.camX += dx;
        view.camY += dy;
        clampCam();
        hoverRef.current = null;
        return;
      }
      const hit = cellAt(e);
      hoverRef.current = hit;
      if (!hit) return;
      if (gesture === "paint") {
        if (pen) line(pen.c, pen.r, hit.c, hit.r, stampWall);
        else stampWall(hit.c, hit.r);
        pen = { c: hit.c, r: hit.r };
      }
      if (gesture === "erase") eraseAt(idx(hit.c, hit.r));
      const drag = dragRef.current;
      if (gesture === "drag" && drag) {
        drag.c = hit.c;
        drag.r = hit.r;
      }
      if (gesture === "keep") {
        const c = Math.max(0, Math.min(GRID_W - CASTLE_S, hit.c - keepGrab.dc));
        const r = Math.max(0, Math.min(GRID_H - CASTLE_S, hit.r - keepGrab.dr));
        keepDrag = { c, r, dc: keepGrab.dc, dr: keepGrab.dr };
      }
    }

    function onUp(e: PointerEvent) {
      const hit = cellAt(e);
      if (gesture === "tap" && hit && !raidRef.current) {
        if (castleCell(hit.c, hit.r)) setSel("castle");
        else {
          const plots = readPlots(metaRef.current.castle.grid);
          const i = idx(hit.c, hit.r);
          if (plots[i]) setSel(i);
          else if (toolRef.current === "tower" || toolRef.current === "house") {
            const kind = toolRef.current === "tower" ? "tower" : "house";
            const cost = PLACE_COST[kind];
            const m = metaRef.current;
            if (m.coins >= cost) {
              plots[i] = { kind, level: 1 };
              commitPlots(plots, m.coins - cost);
              setSel(i);
            }
          } else setSel(null);
        }
      }
      hoverRef.current = null;
      pen = null;
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      if (gesture === "paint" && paintRef.current) {
        const draft = paintRef.current;
        paintRef.current = null;
        const base = readPlots(metaRef.current.castle.grid);
        const added = draft.reduce((n, p, k) => n + (p && !base[k] ? 1 : 0), 0);
        if (added > 0) commitPlots(draft, metaRef.current.coins - added * PLACE_COST.wall);
      } else paintRef.current = null;
      const drag = dragRef.current;
      dragRef.current = null;
      if (gesture === "drag" && drag) {
        const plots = readPlots(metaRef.current.castle.grid);
        const ti = idx(drag.c, drag.r);
        if (!castleCell(drag.c, drag.r) && !plots[ti]) {
          plots[drag.from] = null;
          plots[ti] = drag.plot;
          commitPlots(plots, metaRef.current.coins);
          setSel(ti);
        }
      }
      if (gesture === "keep" && keepDrag) {
        const m = metaRef.current;
        const plots = readPlots(m.castle.grid);
        const ox = m.castle.cx;
        const oy = m.castle.cy;
        let free = true;
        for (let y = 0; y < CASTLE_S && free; y++) {
          for (let x = 0; x < CASTLE_S; x++) {
            const c = keepDrag.c + x;
            const r = keepDrag.r + y;
            const old = c >= ox && c < ox + CASTLE_S && r >= oy && r < oy + CASTLE_S;
            if (!old && plots[idx(c, r)]) free = false;
          }
        }
        if (free) {
          onMetaRef.current({ ...m, castle: { ...m.castle, cx: keepDrag.c, cy: keepDrag.r } });
          keepAt.c = keepDrag.c;
          keepAt.r = keepDrag.r;
        }
      }
      keepDrag = null;
      gesture = "none";
    }

    const ro = new ResizeObserver(layout);
    ro.observe(canvas);
    layout();
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    requestAnimationFrame(frame);
    return () => {
      running = false;
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const plots = readPlots(meta.castle.grid);
  const picked = typeof sel === "number" ? plots[sel] : null;
  const built = plots.some(Boolean);

  function upgradeSel() {
    if (hud.raid) return;
    if (sel === "castle") {
      if (meta.castle.keep >= BUILD_MAX || meta.coins < keepCost(meta.castle.keep)) return;
      onMeta({
        ...meta,
        coins: meta.coins - keepCost(meta.castle.keep),
        castle: { ...meta.castle, keep: meta.castle.keep + 1 },
      });
      return;
    }
    if (typeof sel !== "number" || !picked || picked.level >= PIECE_MAX) return;
    const cost = pieceUpgradeCost(picked.kind, picked.level);
    if (meta.coins < cost) return;
    const next = plots.slice();
    next[sel] = { ...picked, level: picked.level + 1 };
    onMeta({ ...meta, coins: meta.coins - cost, castle: { ...meta.castle, grid: writePlots(next) } });
  }

  function repair() {
    repairRef.current();
  }

  return (
    <section className="realm" aria-label="Königreich">
      <canvas ref={canvasRef} className="realm-canvas" />
      <div className="realm-top">
        <button type="button" className="btn btn-ink btn-sm" onClick={onClose}>
          Menü
        </button>
        <span className="realm-gold tabular-nums">{hud.gold} G</span>
        {hud.raid ? (
          <span className="realm-gold">Welle {hud.wave}</span>
        ) : (
          <button type="button" className="realm-start" onClick={() => startRef.current()}>
            Angriff starten
          </button>
        )}
      </div>
      <p className="realm-hint">
        {hud.fallen
          ? "Das Schloss ist gefallen."
          : hud.raid
            ? `Schloss ${hud.keep}/${hud.keepMax}. Mauern und Türme halten die Welle.`
            : built
              ? "In Ruhe bauen. Angriff startet nur über den Button. Leeres Feld schiebt die Karte."
              : "Du hast Startgold. Zieh Mauern, tippe Turm und Haus."}
      </p>
      {hud.fallen && (
        <div className="castle-fall">
          <h2 className="font-display text-4xl leading-none">Gefallen</h2>
          <p className="text-sm font-bold">Reparier das Schloss für 40 Gold. Deine Gebäude bleiben.</p>
          <button type="button" className="btn btn-go" disabled={meta.coins < 40} onClick={repair}>
            Reparieren 40
          </button>
        </div>
      )}
      {!hud.raid && (picked || sel === "castle") && (
        <div className="realm-card">
          <div className="min-w-0 flex-1">
            <p className="font-display text-2xl leading-none">
              {sel === "castle" ? "Schloss" : picked?.kind === "tower" ? "Turm" : picked?.kind === "house" ? "Haus" : "Mauer"}
            </p>
            <p className="text-xs font-bold">
              Stufe {sel === "castle" ? meta.castle.keep : picked?.level} / {sel === "castle" ? BUILD_MAX : PIECE_MAX}
            </p>
          </div>
          <button type="button" className="btn btn-go btn-sm" onClick={upgradeSel}>
            {sel === "castle"
              ? meta.castle.keep >= BUILD_MAX
                ? "Max"
                : `+ ${keepCost(meta.castle.keep)}`
              : picked && picked.level >= PIECE_MAX
                ? "Max"
                : picked
                  ? `+ ${pieceUpgradeCost(picked.kind, picked.level)}`
                  : ""}
          </button>
        </div>
      )}
      {hud.raid && !hud.fallen && (
        <button type="button" className="realm-act" onClick={() => actRef.current()}>
          Feuerstoß
        </button>
      )}
      <div className="realm-tools">
        {TOOLS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tool === item.id ? "realm-tool on" : "realm-tool"}
            disabled={hud.raid}
            onClick={() => setTool(item.id)}
          >
            {item.name}
          </button>
        ))}
      </div>
    </section>
  );
}

function toward(plots: (Plot | null)[], c: number, r: number, ox: number, oy: number) {
  const inside = (x: number, y: number) => x >= ox && x < ox + CASTLE_S && y >= oy && y < oy + CASTLE_S;
  if (inside(c, r)) return null;
  const prev = new Map<number, number>();
  const start = idx(c, r);
  const q: [number, number][] = [[c, r]];
  prev.set(start, -1);
  let found = -1;
  for (let k = 0; k < q.length; k++) {
    const [x, y] = q[k];
    if (inside(x, y)) {
      found = idx(x, y);
      break;
    }
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) continue;
      const key = idx(nx, ny);
      if (prev.has(key)) continue;
      if (plots[key]) continue;
      prev.set(key, idx(x, y));
      q.push([nx, ny]);
    }
  }
  if (found < 0) {
    const tx = ox + 1;
    const ty = oy + 1;
    const dx = Math.sign(tx - c);
    const dy = Math.sign(ty - r);
    const options = [
      [c + dx, r],
      [c, r + dy],
    ];
    for (const [nx, ny] of options) {
      if (nx >= 0 && ny >= 0 && nx < GRID_W && ny < GRID_H) return { c: nx, r: ny };
    }
    return null;
  }
  let cur = found;
  let parent = prev.get(cur) ?? -1;
  while (parent !== start && parent !== -1) {
    cur = parent;
    parent = prev.get(cur) ?? -1;
  }
  return { c: cur % GRID_W, r: Math.floor(cur / GRID_W) };
}

function tileAt(c: number, r: number, view: View) {
  return {
    x: (c - r) * (view.tw / 2) + view.camX,
    y: (c + r) * (view.th / 2) + view.camY,
  };
}

function diamond(ctx: CanvasRenderingContext2D, x: number, y: number, tw: number, th: number) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + tw / 2, y + th / 2);
  ctx.lineTo(x, y + th);
  ctx.lineTo(x - tw / 2, y + th / 2);
  ctx.closePath();
}

function tone(id: string) {
  if (id === "fire") return { top: "#ffb07a", left: "#8a2208", right: "#e25416" };
  if (id === "lava") return { top: "#ffc56a", left: "#4a140c", right: "#d64518" };
  if (id === "gold") return { top: "#ffe98a", left: "#8a6410", right: "#e2b43a" };
  return { top: "#e7f8ff", left: "#2c6eae", right: "#8fd4f2" };
}

function drawRealm(
  ctx: CanvasRenderingContext2D,
  view: View,
  plots: (Plot | null)[],
  _skin: HTMLImageElement | null,
  skinId: string,
  world: {
    foes: Foe[];
    allies: Ally[];
    bolts: Bolt[];
    raid: boolean;
    flash: number;
    castleHp: number;
    castleMax: number;
    wallHp: Map<number, number>;
    hover: { c: number; r: number } | null;
    drag: { from: number; c: number; r: number; plot: Plot } | null;
    sel: number | "castle" | null;
    keep: number;
  },
) {
  const { w, h, tw, th } = view;
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#7ec8f8");
  sky.addColorStop(0.42, "#d7f3a8");
  sky.addColorStop(1, "#3c8f46");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#fff";
  for (const [x, y, s] of [
    [40, 70, 18],
    [120, 48, 12],
    [230, 86, 16],
    [310, 54, 11],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.arc(x + s, y + 2, s * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#8fb7d8";
  ctx.beginPath();
  ctx.moveTo(-10, 210);
  ctx.lineTo(70, 120);
  ctx.lineTo(140, 210);
  ctx.fill();
  ctx.fillStyle = "#6e9cc4";
  ctx.beginPath();
  ctx.moveTo(90, 220);
  ctx.lineTo(190, 100);
  ctx.lineTo(280, 220);
  ctx.fill();
  ctx.fillStyle = "#f4fbff";
  ctx.beginPath();
  ctx.moveTo(168, 118);
  ctx.lineTo(190, 100);
  ctx.lineTo(208, 124);
  ctx.fill();
  ctx.fillStyle = "#9aa8b4";
  ctx.beginPath();
  ctx.moveTo(250, 230);
  ctx.lineTo(330, 140);
  ctx.lineTo(400, 240);
  ctx.fill();

  const skip = world.drag ? world.drag.from : -1;
  for (let r = -5; r < GRID_H + 5; r++) {
    for (let c = -5; c < GRID_W + 5; c++) {
      const inside = c >= 0 && r >= 0 && c < GRID_W && r < GRID_H;
      if (inside) continue;
      const top = tileAt(c, r, view);
      if (top.x < -70 || top.x > w + 70 || top.y < -40 || top.y > h + 40) continue;
      diamond(ctx, top.x, top.y, tw, th);
      const n = hash(Math.abs(c), Math.abs(r));
      ctx.fillStyle = n % 3 === 0 ? "#4ea244" : "#5cb14c";
      ctx.fill();
      if (n % 5 === 0) drawTree(ctx, top.x, top.y + th * 0.2, 9 + (n % 3) * 3);
      else if (n % 7 === 0) {
        ctx.fillStyle = "#8d8074";
        ctx.beginPath();
        ctx.ellipse(top.x, top.y + th * 0.55, 7, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }
  for (let sum = 0; sum < GRID_W + GRID_H; sum++) {
    for (let c = 0; c < GRID_W; c++) {
      const r = sum - c;
      if (r < 0 || r >= GRID_H) continue;
      const top = tileAt(c, r, view);
      if (top.x < -80 || top.x > w + 80 || top.y < -80 || top.y > h + 80) continue;
      const n = hash(c, r);
      const path = c === keepAt.c + 1 && r > keepAt.r + CASTLE_S;
      diamond(ctx, top.x, top.y, tw, th);
      ctx.fillStyle = castleCell(c, r)
        ? "#7dce55"
        : path
          ? "#c4a15a"
          : (c + r) % 2 === 0
            ? "#63c44a"
            : "#57b440";
      ctx.fill();
      ctx.strokeStyle = "rgba(30, 90, 28, 0.28)";
      ctx.lineWidth = 1;
      ctx.stroke();
      if (!castleCell(c, r) && n % 9 === 0 && !plots[idx(c, r)]) {
        ctx.fillStyle = n % 2 === 0 ? "#fff4a8" : "#ff8fb8";
        ctx.fillRect(top.x - 2, top.y + th * 0.45, 3, 3);
      }
    }
  }
  for (let sum = 0; sum < GRID_W + GRID_H; sum++) {
    for (let c = 0; c < GRID_W; c++) {
      const r = sum - c;
      if (r < 0 || r >= GRID_H) continue;
      const plot = plots[idx(c, r)];
      if (plot && idx(c, r) !== skip) drawPiece(ctx, view, plots, c, r, plot, skinId);
      if (c === keepAt.c + 2 && r === keepAt.r + 2) drawCastle(ctx, view, skinId, world.keep);
    }
  }
  if (world.drag && !castleCell(world.drag.c, world.drag.r)) {
    drawPiece(ctx, view, plots, world.drag.c, world.drag.r, world.drag.plot, skinId);
  }
  if (world.hover && !castleCell(world.hover.c, world.hover.r)) {
    const p = tileAt(world.hover.c, world.hover.r, view);
    diamond(ctx, p.x, p.y, tw, th);
    ctx.strokeStyle = "#ffd000";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  if (world.sel === "castle") {
    const p = tileAt(keepAt.c, keepAt.r, view);
    diamond(ctx, p.x, p.y, tw * 3, th * 3);
    ctx.strokeStyle = "#ffd000";
    ctx.lineWidth = 4;
    ctx.stroke();
  } else if (typeof world.sel === "number") {
    const c = world.sel % GRID_W;
    const r = Math.floor(world.sel / GRID_W);
    const p = tileAt(c, r, view);
    diamond(ctx, p.x, p.y, tw, th);
    ctx.strokeStyle = "#ffd000";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  const units: { y: number; draw: () => void }[] = [];
  for (const ally of world.allies) units.push({ y: ally.x + ally.y, draw: () => drawAlly(ctx, view, ally.x, ally.y) });
  for (const foe of world.foes) units.push({ y: foe.x + foe.y, draw: () => drawFoe(ctx, view, foe) });
  units.sort((a, b) => a.y - b.y);
  for (const unit of units) unit.draw();

  ctx.strokeStyle = "#ffe56a";
  ctx.lineWidth = 3;
  for (const bolt of world.bolts) {
    const a = tileAt(bolt.x, bolt.y, view);
    const b = tileAt(bolt.tx, bolt.ty, view);
    ctx.globalAlpha = Math.max(0, bolt.life / 0.16);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y + th / 2);
    ctx.lineTo(b.x, b.y + th / 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (world.flash > 0) {
    const p = tileAt(keepAt.c + 1.5, keepAt.r + 1.5, view);
    ctx.fillStyle = `rgba(255, 120, 30, ${world.flash})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, tw * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  if (world.raid) {
    const p = tileAt(keepAt.c + 1.5, keepAt.r + 0.2, view);
    ctx.fillStyle = INK;
    ctx.fillRect(p.x - 36, p.y - 8, 72, 8);
    ctx.fillStyle = "#ff3d81";
    ctx.fillRect(p.x - 36, p.y - 8, 72 * Math.max(0, world.castleHp / Math.max(1, world.castleMax)), 8);
  }
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = "#6a3a22";
  ctx.fillRect(x - 3, y - 4, 6, 12);
  ctx.fillStyle = "#1e7a34";
  ctx.beginPath();
  ctx.arc(x, y - 10, s, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#49c45a";
  ctx.beginPath();
  ctx.arc(x - s * 0.3, y - s * 0.7, s * 0.65, 0, Math.PI * 2);
  ctx.fill();
}

function prism(ctx: CanvasRenderingContext2D, x: number, y: number, tw: number, th: number, lift: number, colors: { top: string; left: string; right: string }) {
  ctx.fillStyle = colors.left;
  ctx.beginPath();
  ctx.moveTo(x - tw / 2, y + th / 2);
  ctx.lineTo(x, y + th);
  ctx.lineTo(x, y + th - lift);
  ctx.lineTo(x - tw / 2, y + th / 2 - lift);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = colors.right;
  ctx.beginPath();
  ctx.moveTo(x + tw / 2, y + th / 2);
  ctx.lineTo(x, y + th);
  ctx.lineTo(x, y + th - lift);
  ctx.lineTo(x + tw / 2, y + th / 2 - lift);
  ctx.closePath();
  ctx.fill();
  diamond(ctx, x, y - lift, tw, th);
  ctx.fillStyle = colors.top;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawPiece(
  ctx: CanvasRenderingContext2D,
  view: View,
  plots: (Plot | null)[],
  c: number,
  r: number,
  plot: Plot,
  skinId: string,
) {
  const p = tileAt(c, r, view);
  const colors = tone(skinId);
  if (plot.kind === "wall") {
    prism(ctx, p.x, p.y, view.tw, view.th, 16 + plot.level * 3, colors);
    ctx.fillStyle = INK;
    if (r === 0 || plots[idx(c, r - 1)]?.kind !== "wall") {
      ctx.fillRect(p.x - 6, p.y - 8, 4, 5);
      ctx.fillRect(p.x + 2, p.y - 8, 4, 5);
    }
    return;
  }
  if (plot.kind === "tower") {
    const h = 28 + plot.level * 8;
    prism(ctx, p.x, p.y, view.tw * 0.55, view.th * 0.7, h, { top: "#d9d3cc", left: "#5c564f", right: "#8d867e" });
    ctx.fillStyle = plot.level >= 3 ? "#ffd000" : "#d0002b";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - h - 16);
    ctx.lineTo(p.x - 12, p.y - h + 2);
    ctx.lineTo(p.x + 12, p.y - h + 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#ffe56a";
    ctx.fillRect(p.x - 3, p.y - h * 0.45, 6, 7);
    return;
  }
  prism(ctx, p.x, p.y, view.tw * 0.72, view.th * 0.78, 16 + plot.level * 3, { top: "#fff1d2", left: "#c98462", right: "#e7b08a" });
  ctx.fillStyle = "#d0002b";
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - 34 - plot.level * 3);
  ctx.lineTo(p.x - view.tw * 0.42, p.y - 12);
  ctx.lineTo(p.x + view.tw * 0.42, p.y - 12);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.fillRect(p.x - 4, p.y - 2, 8, 10);
  ctx.fillStyle = "#7fd4ff";
  ctx.fillRect(p.x + 8, p.y - 10, 6, 6);
}

function drawAlly(ctx: CanvasRenderingContext2D, view: View, c: number, r: number) {
  const p = tileAt(c, r, view);
  const y = p.y + view.th * 0.35;
  ctx.fillStyle = INK;
  ctx.fillRect(p.x - 5, y - 12, 10, 12);
  ctx.fillStyle = "#ffd000";
  ctx.fillRect(p.x - 4, y - 11, 8, 10);
  ctx.fillStyle = "#fff6ea";
  ctx.fillRect(p.x - 3, y - 16, 6, 5);
}

function drawFoe(ctx: CanvasRenderingContext2D, view: View, foe: Foe) {
  const p = tileAt(foe.x, foe.y, view);
  const y = p.y + view.th * 0.4;
  ctx.beginPath();
  ctx.fillStyle = foe.tier === 2 ? "#7a3cff" : foe.tier === 1 ? "#ffd000" : "#3dce6a";
  ctx.arc(p.x, y - 6, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.fillRect(p.x - 3, y - 8, 2, 2);
  ctx.fillRect(p.x + 2, y - 8, 2, 2);
}

function drawCastle(ctx: CanvasRenderingContext2D, view: View, skinId: string, keep: number) {
  const colors = tone(skinId);
  const mid = tileAt(keepAt.c + 1, keepAt.r + 1, view);
  const hall = 48 + Math.min(16, keep * 2);
  prism(ctx, mid.x, mid.y, view.tw * 1.85, view.th * 1.85, hall, colors);
  ctx.fillStyle = INK;
  for (let i = 0; i < 6; i++) ctx.fillRect(mid.x - 22 + i * 8, mid.y - hall - 7, 5, 8);
  prism(ctx, mid.x, mid.y, view.tw * 0.72, view.th * 0.72, hall + 26, { top: "#f4f0ea", left: "#4a453f", right: "#8d877f" });
  ctx.fillStyle = skinId === "gold" ? "#ffd000" : "#d0002b";
  ctx.beginPath();
  ctx.moveTo(mid.x, mid.y - hall - 48);
  ctx.lineTo(mid.x - 14, mid.y - hall - 18);
  ctx.lineTo(mid.x + 14, mid.y - hall - 18);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();
  for (const [c, r] of [
    [keepAt.c + 0.2, keepAt.r + 0.2],
    [keepAt.c + 1.8, keepAt.r + 0.2],
    [keepAt.c + 0.2, keepAt.r + 1.8],
    [keepAt.c + 1.8, keepAt.r + 1.8],
  ] as const) {
    const t = tileAt(c, r, view);
    prism(ctx, t.x, t.y, view.tw * 0.62, view.th * 0.62, hall * 0.72, { top: "#e6e0d8", left: "#3f3b37", right: "#7d776f" });
    ctx.fillStyle = "#d0002b";
    ctx.beginPath();
    ctx.moveTo(t.x, t.y - hall * 0.72 - 16);
    ctx.lineTo(t.x - 8, t.y - hall * 0.72);
    ctx.lineTo(t.x + 8, t.y - hall * 0.72);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  const gate = tileAt(keepAt.c + 1, keepAt.r + 1.85, view);
  ctx.fillStyle = "#1a120c";
  ctx.fillRect(gate.x - 9, gate.y - 16, 18, 20);
  ctx.fillStyle = "#ffd000";
  ctx.beginPath();
  ctx.arc(gate.x + 4, gate.y - 6, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffe56a";
  ctx.fillRect(mid.x - 16, mid.y - hall * 0.35, 6, 8);
  ctx.fillRect(mid.x + 10, mid.y - hall * 0.35, 6, 8);
}
