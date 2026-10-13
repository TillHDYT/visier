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
const keep = head
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l.startsWith("<title") || l.includes("fonts.g") || l.includes('name="theme-color"'))
  .join("\n");

// Im Claude-Viewer liegt die Seite zwischen Kopf- und Fußleiste der App.
// Die Safe-Area-Werte des Geräts würden die Anzeige dort doppelt einrücken.
const page = `${keep}
<style>
${style}
:root { --safe-top: 0px; --safe-bottom: 0px; padding: 0 !important; background: #1a120c; }
</style>
<div id="root"></div>
<script type="module">
${code}
</script>
`;
writeFileSync(join(out, "visier.html"), page);
for (const f of [js, css, "index.html"]) rmSync(join(out, f));
console.log(`${out}/visier.html (${Math.round(page.length / 1024)} KB)`);
