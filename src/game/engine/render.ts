/**
 * Zeichenfunktionen für Spielfigur, Waffen und Effekte. Sie sind zustandslos:
 * alles, was sie brauchen, kommt als Argument herein.
 */
import { ready, type Art, type SpriteCache } from "./sprites";
import { CREAM, DANGER, INK, PINK, VISOR, YELLOW, type Bullet } from "./types";

type Ctx = CanvasRenderingContext2D;

export function diamond(ctx: Ctx, x: number, y: number, r: number, fill: string) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.75, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r * 0.75, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

export function drawBlade(ctx: Ctx, x: number, y: number, ang: number, scale: number, hot: boolean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.scale(scale, scale);
  ctx.fillStyle = hot ? PINK : CREAM;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-10, 5);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-10, -5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = hot ? YELLOW : PINK;
  ctx.fillRect(-4, -2, 6, 4);
  ctx.restore();
}

export function drawShield(
  ctx: Ctx,
  sprites: SpriteCache,
  art: Art,
  x: number,
  y: number,
  rot: number,
  star: boolean,
  scale: number,
) {
  const size = star ? 46 : 28 * scale;
  const blur = star ? 16 : 10;
  const img = sprites.rune(star ? art.runeStar : art.runeTri, size, blur);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  if (img) {
    const pad = blur * 2;
    const w = size + pad * 2;
    const h = w * (img.height / img.width);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
  } else {
    ctx.beginPath();
    ctx.moveTo(size * 0.45, 0);
    ctx.lineTo(-size * 0.28, size * 0.32);
    ctx.lineTo(-size * 0.28, -size * 0.32);
    ctx.closePath();
    ctx.fillStyle = "#ff2a14";
    ctx.fill();
  }
  ctx.restore();
}

export function drawDrone(ctx: Ctx, x: number, y: number, s: number) {
  const big = s > 1.4;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = big ? PINK : "#d7fff6";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(-10, -8, 20, 16, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = big ? YELLOW : DANGER;
  ctx.fillRect(-4, -3, 8, 5);
  if (big) {
    ctx.strokeStyle = YELLOW;
    ctx.beginPath();
    ctx.moveTo(-18, -6);
    ctx.lineTo(18, -6);
    ctx.moveTo(-16, 8);
    ctx.lineTo(16, 8);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawIceWave(ctx: Ctx, sprites: SpriteCache, x: number, y: number, b: Bullet) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(b.ang);
  const span = b.r * 1.05;
  ctx.drawImage(sprites.glow("ice"), 4 - span * 0.85, -span * 0.7, span * 1.7, span * 1.4);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#1a4e86";
  for (let i = 0; i < 7; i++) {
    const ang = -1.15 + (i / 6) * 2.3;
    const flick = 0.72 + Math.sin(b.age * 28 + i * 1.4) * 0.18;
    const len = span * (0.42 + (i % 3) * 0.08) * flick;
    const px = Math.cos(ang) * span * 0.22;
    const py = Math.sin(ang) * span * 0.55;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(ang) * len, py + Math.sin(ang) * len);
    ctx.lineTo(px + Math.cos(ang + 0.7) * len * 0.28, py + Math.sin(ang + 0.7) * len * 0.28);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? "#e9fbff" : "#7ad7ff";
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, span * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = "#f4fdff";
  ctx.fill();
  ctx.strokeStyle = VISOR;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#d7f4ff";
  for (let i = 0; i < 6; i++) {
    const back = 6 + i * span * 0.1;
    const side = Math.sin(b.age * 20 + i) * span * 0.3;
    ctx.globalAlpha = Math.max(0.15, 0.8 - i * 0.12);
    ctx.fillRect(-back, side, 3, 3);
  }
  ctx.restore();
}

export function drawFireWave(ctx: Ctx, sprites: SpriteCache, x: number, y: number, b: Bullet) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(b.ang);
  const span = b.r * 1.05;
  ctx.drawImage(sprites.glow("fire"), 6 - span * 0.95, -span * 0.82, span * 1.9, span * 1.64);

  const steps = 16;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const ang = -1.2 + (i / steps) * 2.4;
    const flick = 0.62 + Math.sin(b.age * 36 + i * 1.35) * 0.22 + (i % 2) * 0.14;
    const rad = span * flick;
    const px = Math.cos(ang) * rad * 0.42 + 8;
    const py = Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  for (let i = steps; i >= 0; i--) {
    const ang = -1.2 + (i / steps) * 2.4;
    const rad = span * 0.22;
    ctx.lineTo(Math.cos(ang) * rad * 0.15 - 8, Math.sin(ang) * rad * 0.85);
  }
  ctx.closePath();
  ctx.fillStyle = "#ff3a10";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#6a1408";
  ctx.stroke();

  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const ang = -0.95 + (i / steps) * 1.9;
    const rad = span * (0.4 + Math.sin(b.age * 44 + i) * 0.12);
    const px = Math.cos(ang) * rad * 0.36 + 4;
    const py = Math.sin(ang) * rad * 0.82;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.lineTo(2, 0);
  ctx.closePath();
  ctx.fillStyle = "#ffb000";
  ctx.fill();

  for (let i = 0; i < 8; i++) {
    const ang = -1.05 + (i / 7) * 2.1;
    const flick = 0.55 + Math.sin(b.age * 48 + i * 1.8) * 0.35;
    const len = span * (0.28 + (i % 3) * 0.08) * flick;
    const px = Math.cos(ang) * span * 0.5 + 6;
    const py = Math.sin(ang) * span * 0.72;
    ctx.beginPath();
    ctx.moveTo(px + Math.cos(ang) * len, py + Math.sin(ang) * len);
    ctx.lineTo(px + Math.cos(ang + 0.45) * len * 0.25, py + Math.sin(ang + 0.45) * len * 0.25);
    ctx.lineTo(px + Math.cos(ang - 0.45) * len * 0.25, py + Math.sin(ang - 0.45) * len * 0.25);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? "#ffe14a" : "#ff6a12";
    ctx.fill();
  }

  for (let i = 0; i < 8; i++) {
    const back = 8 + i * (span * 0.11);
    const side = Math.sin(b.age * 22 + i * 1.6) * span * 0.38;
    const sz = 1.6 + (i % 3) * 1.1;
    ctx.globalAlpha = Math.max(0.12, 0.85 - i * 0.1);
    ctx.fillStyle = i % 2 === 0 ? YELLOW : "#ff4a12";
    ctx.fillRect(-back - sz, side - sz, sz * 2, sz * 2);
  }
  ctx.fillStyle = CREAM;
  for (let i = 0; i < 5; i++) {
    const flick = Math.sin(b.age * 55 + i * 2.4);
    const a = -0.9 + i * 0.45;
    const dist = span * (0.35 + Math.abs(flick) * 0.35);
    ctx.globalAlpha = Math.max(0, 0.45 + flick * 0.35);
    ctx.fillRect(Math.cos(a) * dist, Math.sin(a) * dist * 0.75, 2.4, 2.4);
  }
  ctx.restore();
}

/** Kraftfeld: pulsierende Sechsecke. Ohne shadowBlur, der auf Handys teuer ist. */
export function drawForceField(ctx: Ctx, cx: number, cy: number, radius: number, evolved: boolean, t: number) {
  const beat = 0.5 + 0.5 * Math.sin(t * 2.5);
  ctx.save();
  ctx.lineJoin = "round";
  const bloom = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * (1.02 + beat * 0.06));
  bloom.addColorStop(0, `rgba(255, 70, 40, ${0.06 + beat * 0.05})`);
  bloom.addColorStop(0.62, `rgba(255, 24, 16, ${0.1 + beat * 0.08})`);
  bloom.addColorStop(1, "rgba(255, 10, 8, 0)");
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 1.08, 0, Math.PI * 2);
  ctx.fillStyle = bloom;
  ctx.fill();
  const layers = evolved ? [0.34, 0.52, 0.7, 0.86, 1] : [0.4, 0.62, 0.82, 1];
  for (let i = 0; i < layers.length; i++) {
    const p = 0.5 + 0.5 * Math.sin(t * 2.5 + i * 0.85);
    const rad = radius * layers[i] * (0.93 + p * 0.1);
    const hot = i === layers.length - 1;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 3;
      const x = cx + Math.cos(a) * rad;
      const y = cy + Math.sin(a) * rad;
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = "#ff3a22";
    ctx.globalAlpha = 0.08 + p * 0.05;
    ctx.lineWidth = hot ? 26 : 20;
    ctx.stroke();
    ctx.globalAlpha = 0.16 + p * 0.1;
    ctx.lineWidth = hot ? 14 : 10;
    ctx.stroke();
    ctx.strokeStyle = hot ? "#ffe4dc" : "#ff8a72";
    ctx.globalAlpha = 0.38 + p * 0.4;
    ctx.lineWidth = hot ? 2.6 : 2;
    ctx.stroke();
  }
  ctx.restore();
}

function drawCrystalStaff(ctx: Ctx, ox: number, oy: number) {
  ctx.save();
  ctx.translate(ox, oy);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.fillStyle = "#3a3538";
  ctx.beginPath();
  ctx.roundRect(-3, -26, 6, 44, 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#4a4448";
  ctx.beginPath();
  ctx.moveTo(-7, -24);
  ctx.lineTo(0, -36);
  ctx.lineTo(7, -24);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ff2a2a";
  ctx.beginPath();
  ctx.moveTo(0, -40);
  ctx.lineTo(5, -32);
  ctx.lineTo(0, -26);
  ctx.lineTo(-5, -32);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ffd0c4";
  ctx.fillRect(-1.2, -35, 2.4, 4);
  ctx.restore();
}

function drawMaceSprite(ctx: Ctx, art: Art, ox: number, oy: number) {
  ctx.save();
  ctx.translate(ox, oy);
  ctx.rotate(-0.85);
  if (ready(art.mace)) {
    const h = 64;
    const w = h * (art.mace.naturalWidth / art.mace.naturalHeight);
    ctx.drawImage(art.mace, -w * 0.22, -h * 0.78, w, h);
  } else {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.fillStyle = "#2a2a2e";
    ctx.fillRect(-3, -8, 6, 36);
    ctx.strokeRect(-3, -8, 6, 36);
    ctx.beginPath();
    ctx.arc(0, -16, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ff1a1a";
    ctx.beginPath();
    ctx.arc(0, -16, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export type HeroPose = {
  t: number;
  moved: boolean;
  aim: number;
  flash: boolean;
};

/** Grundform: Hexenmeister mit Kristallstab oder (ab Stab-Stufe 3) Keule. */
export function drawWarlock(ctx: Ctx, art: Art, x: number, y: number, pose: HeroPose, mace: boolean) {
  const bob = Math.sin(pose.t * (pose.moved ? 12 : 3)) * (pose.moved ? 1.5 : 0.45);
  const side = Math.cos(pose.aim) >= 0 ? -1 : 1;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(1.22, 1.22);
  ctx.fillStyle = "rgba(26,18,12,0.22)";
  ctx.beginPath();
  ctx.ellipse(0, 18, 14, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.scale(side, 1);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  if (mace) drawMaceSprite(ctx, art, -12, 2);
  else drawCrystalStaff(ctx, -13, 0);
  ctx.fillStyle = "#1a1a1e";
  ctx.beginPath();
  ctx.roundRect(-5, 8, 5, 8, 1);
  ctx.roundRect(2, 8, 5, 8, 1);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = pose.flash ? "#4c4652" : "#2a2a30";
  ctx.beginPath();
  ctx.moveTo(-7, -8);
  ctx.lineTo(-14, 14);
  ctx.lineTo(13, 14);
  ctx.lineTo(8, -6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "#121014";
  ctx.beginPath();
  ctx.moveTo(0, -4);
  ctx.lineTo(-2, 12);
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.fillStyle = pose.flash ? "#3a3842" : "#1a1a20";
  ctx.beginPath();
  ctx.moveTo(0, -32);
  ctx.lineTo(12, -8);
  ctx.quadraticCurveTo(0, 1, -11, -8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#0e0d10";
  ctx.beginPath();
  ctx.moveTo(-6, -18);
  ctx.lineTo(6, -16);
  ctx.lineTo(4, -6);
  ctx.lineTo(-5, -7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ff2a2a";
  ctx.beginPath();
  ctx.ellipse(-2.6, -13, 2.2, 1.25, -0.15, 0, Math.PI * 2);
  ctx.ellipse(2.3, -12.4, 2.2, 1.25, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2a2a30";
  ctx.beginPath();
  ctx.roundRect(-16, -2, 8, 7, 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** 1. Entwicklung: Drachenrüstung (Feuer oder Eis). */
export function drawArmored(ctx: Ctx, img: HTMLImageElement, x: number, y: number, pose: HeroPose) {
  const bob = Math.sin(pose.t * (pose.moved ? 10 : 3)) * (pose.moved ? 1.4 : 0.4);
  const side = Math.cos(pose.aim) >= 0 ? 1 : -1;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.fillStyle = "rgba(26,18,12,0.28)";
  ctx.beginPath();
  ctx.ellipse(0, 28, 22, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.scale(side, 1);
  if (ready(img)) {
    const h = 92;
    const w = h * (img.naturalWidth / img.naturalHeight);
    ctx.drawImage(img, -w / 2, -h * 0.78, w, h);
  }
  ctx.restore();
}

/** 2. Entwicklung: Lavadrache. Steht er, schaut er nach vorn; läuft er, wechseln zwei Bilder. */
export function drawDragon(
  ctx: Ctx,
  art: Art,
  x: number,
  y: number,
  t: number,
  vx: number,
  vy: number,
  facing: number,
) {
  const moving = Math.hypot(vx, vy) > 28;
  const frame = Math.floor(t * 9) % 2;
  const img = moving ? (frame === 0 ? art.dragonA : art.dragonB) : art.dragonFront;
  const bob = moving ? Math.sin(t * 14) * 2 : Math.sin(t * 3) * 0.6;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.fillStyle = "rgba(26,18,12,0.3)";
  ctx.beginPath();
  ctx.ellipse(0, 30, 28, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  if (moving) {
    // Die Laufbilder schauen nach links; nach rechts wird gespiegelt.
    ctx.scale(Math.cos(facing) > 0 ? -1 : 1, 1);
    ctx.rotate(Math.sin(t * 12) * 0.05);
  }
  if (ready(img)) {
    const h = moving ? 112 : 104;
    const w = h * (img.naturalWidth / img.naturalHeight);
    ctx.drawImage(img, -w * 0.5, -h * 0.74, w, h);
  }
  ctx.restore();
}

export function drawDragonIntro(ctx: Ctx, art: Art, viewW: number, viewH: number, left: number, t: number) {
  const p = Math.min(1, left / 1.5);
  ctx.save();
  ctx.fillStyle = `rgba(12, 2, 0, ${0.55 * p + 0.2})`;
  ctx.fillRect(0, 0, viewW, viewH);
  const img = art.dragonFront;
  if (ready(img)) {
    const h = Math.min(viewH * 0.46, 280) * (0.92 + 0.08 * Math.sin(t * 8));
    const w = Math.min(viewW * 0.94, h * (img.naturalWidth / img.naturalHeight));
    const hh = w * (img.naturalHeight / img.naturalWidth);
    ctx.drawImage(img, viewW / 2 - w / 2, viewH * 0.34 - hh * 0.5, w, hh);
  }
  ctx.fillStyle = YELLOW;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.lineJoin = "round";
  ctx.font = "40px 'Lilita One', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.strokeText("DRACHE", viewW / 2, viewH * 0.72);
  ctx.fillText("DRACHE", viewW / 2, viewH * 0.72);
  ctx.restore();
}

export function drawTank(ctx: Ctx, x: number, y: number, ang: number, flash: boolean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.fillStyle = "rgba(26,18,12,0.25)";
  ctx.beginPath();
  ctx.ellipse(0, 10, 26, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2a3038";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(-28, -16, 56, 32, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = flash ? CREAM : "#5f6b3a";
  ctx.beginPath();
  ctx.roundRect(-22, -12, 40, 24, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#3d4a28";
  ctx.fillRect(-24, -18, 44, 6);
  ctx.fillRect(-24, 12, 44, 6);
  ctx.strokeRect(-24, -18, 44, 6);
  ctx.strokeRect(-24, 12, 44, 6);
  ctx.fillStyle = "#6d7a42";
  ctx.beginPath();
  ctx.arc(6, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = VISOR;
  ctx.fillRect(2, -4, 10, 6);
  ctx.strokeRect(2, -4, 10, 6);
  ctx.fillStyle = INK;
  ctx.fillRect(14, -3, 26, 6);
  ctx.fillStyle = YELLOW;
  ctx.fillRect(36, -2, 6, 4);
  ctx.restore();
}

export function drawUfo(ctx: Ctx, x: number, y: number, t: number, flash: boolean) {
  const bob = Math.sin(t * 6) * 3;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.fillStyle = "rgba(26,18,12,0.2)";
  ctx.beginPath();
  ctx.ellipse(0, 18, 22, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.fillStyle = flash ? CREAM : "#d7fff6";
  ctx.beginPath();
  ctx.ellipse(0, 4, 30, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#8eb6ff";
  ctx.beginPath();
  ctx.ellipse(0, -6, 14, 12, 0, Math.PI, 0);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = VISOR;
  ctx.beginPath();
  ctx.ellipse(0, -4, 8, 5, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = PINK;
  ctx.beginPath();
  ctx.arc(-16, 4, 4, 0, Math.PI * 2);
  ctx.arc(0, 6, 4, 0, Math.PI * 2);
  ctx.arc(16, 4, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
