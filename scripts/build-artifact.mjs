// Baut eine einzelne HTML-Seite (JS und CSS inline, Bilder daneben) für das
// Veröffentlichen als Claude-Artifact. Ergebnis: dist-single/visier.html
import { execSync } from "node:child_process";
import { readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const out = "dist-single";
execSync("npx vite build --mode single", { stdio: "inherit" });

const html = readFileSync(join(out, "index.html"), "utf8");
const files = readdirSync(out);
const js = files.find((f) => f.endsWith(".js"));
const css = files.find((f) => f.endsWith(".css"));
if (!js || !css) throw new Error("Build lieferte kein JS oder CSS");
const code = readFileSync(join(out, js), "utf8");
if (code.includes("</script")) throw new Error("JS enthält </script und kann nicht inline stehen");
const style = readFileSync(join(out, css), "utf8");

const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? "";
// Ganze Tags übernehmen (sie können über mehrere Zeilen gehen): Titel,
// Theme-Farbe und Google-Fonts. Alles andere setzt der Viewer selbst.
const tags = head.match(/<title>[\s\S]*?<\/title>|<(?:meta|link)\b[^>]*>/g) ?? [];
const keep = tags
  .filter((t) => t.startsWith("<title") || t.includes("fonts.g") || t.includes('name="theme-color"'))
  .map((t) => t.replace(/\s+/g, " "))
  .join("\n");

// Im Claude-Viewer läuft die Seite bis unter die Kopf- und Fußleiste der App.
// Der Viewer hält den Inhalt per Innenabstand auf :root frei. Das Spiel füllt
// deshalb genau diesen Innenbereich (statt des ganzen Fensters), und die
// eigenen Safe-Area-Abstände entfallen, sonst würde doppelt eingerückt.
const page = `${keep}
<style>
${style}
:root { --safe-top: 0px; --safe-bottom: 0px; box-sizing: border-box; height: 100%; background: #1a120c; }
body, #root { height: 100%; margin: 0; overflow: hidden; }
.shell { position: relative; inset: auto; height: 100%; }
</style>
<div id="root"></div>
<script type="module">
${code}
</script>
`;
writeFileSync(join(out, "visier.html"), page);
for (const f of [js, css, "index.html"]) rmSync(join(out, f));
console.log(`${out}/visier.html (${Math.round(page.length / 1024)} KB)`);
