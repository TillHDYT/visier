// Automatischer Spieltest gegen den Dev-Server (npm run dev).
// Spielt einen Lauf mit Unverwundbarkeit, wählt Karten, zieht Lucky-Belohnungen,
// löst Rüstung und Drache aus und prüft Konsolenfehler und Bildrate.
//
//   node scripts/smoke.mjs [url] [sekunden] [ausgabeordner]
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:8080/";
const seconds = Number(process.argv[3] ?? 60);
const out = process.argv[4] ?? "smoke-out";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const page = await browser.newPage({ viewport: { width: 400, height: 820 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("fonts.g")) errors.push(`console: ${m.text()}`);
});

await page.goto(url, { waitUntil: "networkidle" });
await page.screenshot({ path: `${out}/0-menu.png` });
await page.getByRole("button", { name: "Überleben" }).click();
await page.waitForFunction(() => window.__visier?.state().mode === "play");
await page.evaluate(() => window.__visier.cheat("god"));

// Bildzeiten im Browser messen.
await page.evaluate(() => {
  window.__frames = [];
  let last = performance.now();
  const tick = (t) => {
    window.__frames.push(t - last);
    last = t;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

const dirs = [
  ["KeyW"],
  ["KeyW", "KeyD"],
  ["KeyD"],
  ["KeyS", "KeyD"],
  ["KeyS"],
  ["KeyA", "KeyS"],
  ["KeyA"],
  ["KeyA", "KeyW"],
];
const seen = new Set();
const t0 = Date.now();
let step = 0;
let shots = 1;
while (Date.now() - t0 < seconds * 1000) {
  const s = await page.evaluate(() => window.__visier.state());
  seen.add(s.mode);
  const elapsed = (Date.now() - t0) / 1000;
  if (s.mode === "play") {
    await page.evaluate((k) => window.__visier.setKeys(k), dirs[Math.floor(step / 4) % dirs.length]);
    // Zeit vorspulen, damit spätere Wellen und der erste Boss (5:00) vorkommen.
    if (step % 40 === 39 && s.time < 330) await page.evaluate(() => window.__visier.cheat("time"));
    if (elapsed > seconds * 0.3 && s.armor === "none") await page.evaluate(() => window.__visier.cheat("staff"));
    if (elapsed > seconds * 0.6 && !s.dragon && s.armor !== "none")
      await page.evaluate(() => window.__visier.cheat("dragon"));
    if (s.dragon) {
      const btn = page.getByRole("button", { name: "Feueratem" });
      if (await btn.count()) await btn.dispatchEvent("pointerdown");
    }
  } else if (s.mode === "level") {
    await page.keyboard.press("Digit1");
  } else if (s.mode === "armor") {
    await page.screenshot({ path: `${out}/${shots++}-armor.png` });
    await page.keyboard.press(step % 2 ? "Digit2" : "Digit1");
  } else if (s.mode === "lucky") {
    await page.getByRole("button", { name: "Ziehen" }).click();
    await page.getByRole("button", { name: "Weiter" }).click({ timeout: 3000 });
  } else if (s.mode === "dead" || s.mode === "menu") {
    break;
  }
  if (step % 25 === 10) await page.screenshot({ path: `${out}/${shots++}-play.png` });
  step++;
  await page.waitForTimeout(200);
}

const final = await page.evaluate(() => window.__visier.state());
const frames = await page.evaluate(() => window.__frames.slice(5));
frames.sort((a, b) => a - b);
const pct = (p) => frames[Math.min(frames.length - 1, Math.floor(frames.length * p))].toFixed(1);
await page.screenshot({ path: `${out}/${shots}-end.png` });

// Pause durch Tab-Wechsel prüfen.
await page.evaluate(() => {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
  document.dispatchEvent(new Event("visibilitychange"));
});
const afterHide = await page.evaluate(() => window.__visier.state().mode);
await browser.close();

console.log(JSON.stringify({ final, modesSeen: [...seen], afterHide }, null, 1));
console.log(`frames: ${frames.length}, median ${pct(0.5)} ms, p95 ${pct(0.95)} ms, p99 ${pct(0.99)} ms`);
if (errors.length) {
  console.log("FEHLER:\n" + errors.join("\n"));
  process.exit(1);
}
const ok = final.armor !== "none" && final.dragon && afterHide === "pause";
console.log(ok ? "SMOKE OK" : "SMOKE UNVOLLSTÄNDIG");
process.exit(ok ? 0 : 1);
