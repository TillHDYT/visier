import { ENEMY_BASE, type EnemyKind } from "@/game/content";
import { ART } from "@/game/assets";
import { CREAM, INK, PINK, YELLOW, type Enemy } from "./types";

function load(src: string) {
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  return img;
}

export function ready(img: HTMLImageElement) {
  return img.complete && img.naturalWidth > 0;
}

/** Alle Spielbilder, einmal pro Spielinstanz geladen. */
export function loadArt() {
  return {
    lava: load(ART.lava),
    mace: load(ART.mace),
    armorFire: load(ART.armorFire),
    armorIce: load(ART.armorIce),
    dragonFront: load(ART.dragonFront),
    dragonA: load(ART.dragonA),
    dragonB: load(ART.dragonB),
    runeTri: load(ART.runeTri),
    runeStar: load(ART.runeStar),
  };
}

export type Art = ReturnType<typeof loadArt>;

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const g = c.getContext("2d");
  if (!g) throw new Error("2D-Kontext nicht verfügbar");
  return { c, g };
}

/**
 * Vorgerenderte Bilder. Statt jeden Gegner pro Frame aus 10–20 Pfad-Befehlen
 * neu zu zeichnen, wird jede Variante einmal in ein Offscreen-Canvas gemalt
 * und danach nur noch per drawImage kopiert.
 */
export class SpriteCache {
  private enemies = new Map<string, HTMLCanvasElement>();
  private runes = new Map<string, HTMLCanvasElement>();
  private glows = new Map<string, HTMLCanvasElement>();
  private scale = 1;

  setScale(dpr: number) {
    if (dpr === this.scale) return;
    this.scale = dpr;
    this.enemies.clear();
    this.runes.clear();
    this.glows.clear();
  }

  enemy(e: Enemy, detail: boolean): { img: HTMLCanvasElement; half: number } {
    const flash = e.flash > 0;
    const r = Math.round(e.r);
    const key = `${e.kind}|${e.tier}|${e.grade}|${r}|${flash ? 1 : 0}|${detail ? 1 : 0}`;
    const half = r + 20;
    let img = this.enemies.get(key);
    if (!img) {
      img = paintEnemy(e.kind, e.tier, e.grade, r, flash, detail, half, this.scale);
      this.enemies.set(key, img);
    }
    return { img, half };
  }

  /** Rune mit rotem Leuchten; der Blur wird nur einmal berechnet. */
  rune(src: HTMLImageElement, size: number, blur: number): HTMLCanvasElement | null {
    if (!ready(src)) return null;
    const s = Math.round(size);
    const key = `${src.src}|${s}|${blur}`;
    let out = this.runes.get(key);
    if (!out) {
      const h = s * (src.naturalHeight / src.naturalWidth);
      const pad = blur * 2;
      const { c, g } = canvas((s + pad * 2) * this.scale, (h + pad * 2) * this.scale);
      g.scale(this.scale, this.scale);
      g.shadowColor = "rgba(255, 36, 12, 0.85)";
      g.shadowBlur = blur * this.scale;
      g.drawImage(src, pad, pad, s, h);
      out = c;
      this.runes.set(key, out);
    }
    return out;
  }

  /** Weicher radialer Schein (Feuer-/Eiswelle), skaliert beim Zeichnen. */
  glow(kind: "fire" | "ice"): HTMLCanvasElement {
    let out = this.glows.get(kind);
    if (!out) {
      const R = 64;
      const { c, g } = canvas(R * 2, R * 2);
      const grad = g.createRadialGradient(R, R, 3, R, R, R);
      if (kind === "fire") {
        grad.addColorStop(0, "rgba(255, 220, 80, 0.55)");
        grad.addColorStop(0.4, "rgba(255, 80, 16, 0.35)");
        grad.addColorStop(1, "rgba(255, 30, 0, 0)");
      } else {
        grad.addColorStop(0, "rgba(230, 250, 255, 0.7)");
        grad.addColorStop(0.45, "rgba(80, 190, 255, 0.35)");
        grad.addColorStop(1, "rgba(40, 120, 255, 0)");
      }
      g.fillStyle = grad;
      g.fillRect(0, 0, R * 2, R * 2);
      out = c;
      this.glows.set(kind, out);
    }
    return out;
  }
}

function bodyColor(kind: EnemyKind, tier: number, grade: number, flash: boolean) {
  if (flash) return CREAM;
  if (tier === 0) {
    if (grade === 4) return "#ff2d2d";
    if (grade === 3) return "#c86bff";
    if (grade === 2) return "#ffe14a";
    return "#3dce6a";
  }
  return ENEMY_BASE[kind].color;
}

function paintEnemy(
  kind: EnemyKind,
  tier: number,
  grade: number,
  r: number,
  flash: boolean,
  detail: boolean,
  half: number,
  scale: number,
) {
  const { c, g } = canvas(half * 2 * scale, half * 2 * scale);
  g.scale(scale, scale);
  const x = half;
  const y = half;
  g.lineJoin = "round";

  g.fillStyle = "rgba(26,18,12,0.18)";
  g.beginPath();
  g.ellipse(x, y + r * 0.75, r * 0.7, r * 0.28, 0, 0, Math.PI * 2);
  g.fill();

  g.fillStyle = bodyColor(kind, tier, grade, flash);
  g.strokeStyle = grade === 4 && tier < 3 ? "#6d0018" : tier === 1 ? YELLOW : INK;
  g.lineWidth = grade === 4 || tier >= 2 ? 4 : 3;
  if (kind === "bug") {
    g.beginPath();
    g.ellipse(x, y, r * 0.85, r, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    if (detail) {
      g.beginPath();
      g.moveTo(x - 4, y - r);
      g.lineTo(x - 10, y - r - 10);
      g.moveTo(x + 4, y - r);
      g.lineTo(x + 10, y - r - 10);
      g.stroke();
    }
  } else if (kind === "robot") {
    g.beginPath();
    g.roundRect(x - r, y - r * 0.85, r * 2, r * 1.7, 6);
    g.fill();
    g.stroke();
    g.fillStyle = flash ? YELLOW : "#d0002b";
    g.fillRect(x - r * 0.45, y - r * 0.2, r * 0.9, r * 0.28);
  } else if (kind === "mutant") {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.beginPath();
    g.arc(x - r * 0.45, y + 2, r * 0.45, 0, Math.PI * 2);
    g.arc(x + r * 0.5, y - 2, r * 0.38, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  } else {
    g.beginPath();
    g.arc(x, y + 2, r * 0.78, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.beginPath();
    g.roundRect(x - r * 0.55, y - r * 0.95, r * 1.1, r * 0.85, 4);
    g.fill();
    g.stroke();
  }
  if (detail && kind !== "robot") {
    const ey = kind === "bug" ? y - 2 : y - r * 0.35;
    g.fillStyle = CREAM;
    g.beginPath();
    g.arc(x - 4, ey, 3.2, 0, Math.PI * 2);
    g.arc(x + 4, ey, 3.2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = INK;
    g.beginPath();
    g.arc(x - 4, ey, 1.5, 0, Math.PI * 2);
    g.arc(x + 4, ey, 1.5, 0, Math.PI * 2);
    g.fill();
  }
  if (tier === 1) {
    g.fillStyle = YELLOW;
    g.beginPath();
    g.moveTo(x, y - r - 12);
    g.lineTo(x + 7, y - r - 2);
    g.lineTo(x - 7, y - r - 2);
    g.closePath();
    g.fill();
    g.strokeStyle = INK;
    g.stroke();
  }
  if (tier >= 2) {
    g.fillStyle = tier === 3 ? PINK : YELLOW;
    g.beginPath();
    g.moveTo(x - r, y - r);
    g.lineTo(x - r + 8, y - r - 14);
    g.lineTo(x - r + 16, y - r);
    g.moveTo(x + r, y - r);
    g.lineTo(x + r - 8, y - r - 14);
    g.lineTo(x + r - 16, y - r);
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.stroke();
  }
  return c;
}
