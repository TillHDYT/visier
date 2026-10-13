# VISIER

Top-Down-Survivor mit Burg-Aufbau. React + Canvas, gebaut mit Vite.

## Start

```bash
npm install
npm run dev        # http://localhost:8080
```

## Befehle

| Befehl                            | Zweck                                                       |
| --------------------------------- | ----------------------------------------------------------- |
| `npm run dev`                     | Entwicklungsserver                                          |
| `npm run build`                   | Typprüfung und Produktions-Build nach `dist/`               |
| `npm run typecheck`               | Nur TypeScript prüfen                                       |
| `npm run lint`                    | ESLint                                                      |
| `npm test`                        | Unit-Tests (Vitest)                                         |
| `npm run smoke`                   | Automatischer Spieltest im Browser (Dev-Server muss laufen) |
| `node scripts/build-artifact.mjs` | Einzelseite für den Claude-Link nach `dist-single/`         |

## Aufbau

```
src/
  main.tsx                 Einstieg
  styles.css               Oberfläche (Tailwind v4)
  assets/                  Bilder (Lava, Drachen, Rüstungen, Runen, Mauern)
  components/
    visor-app.tsx          Wurzel: verbindet Engine und Oberfläche
    hud.tsx                Anzeige im Lauf
    menu.tsx               Hauptmenü, Optionen, Shop, Skins, Werkstatt
    run-overlays.tsx       Rüstungswahl, Level-Karten, Glücksrad, Pause, Tod
    castle-screen.tsx      Königreich: Rohstoffleiste, Baumenü, Upgrade-Panel, Angriffs-Anzeige
    ui.tsx                 Kleine Bausteine
  game/
    engine/
      index.ts             Simulation: Wellen, Waffen, Kollision, Evolutionen
      render.ts            Zeichnen von Figur, Waffen und Effekten
      sprites.ts           Bilder laden, vorgerenderte Gegner und Leuchteffekte
      types.ts             Typen, Konstanten, Pool-Größen
    content.ts             Gegner, Wellen, Kapitel, Waffentexte
    skills.ts              Dauerhafte Fähigkeiten und Evolutionen
    meta.ts                Gold, Shop, Speicherstand
    audio.ts               Musik und Soundeffekte (WebAudio)
    castle/
      model.ts             Königreich: Gebäude, Stufen 1–5, Kosten, Rohstoffe, AFK-Produktion, Speicherstand
      textures.ts          Königreich: prozedurale Texturen und Materialien (Stein, Holz, Ziegel …)
      meshes.ts            Königreich: 3D-Modelle aller Gebäude je Stufe, Stadtmauer, Landschaft
      scene.ts             Königreich: Three.js-Szene, Kamera, Bauen, Verschieben, Ernte-Blasen, Angriffe
      raid.ts              Königreich: Angriffs-Simulation an der festen Mauer
    icons.tsx              Symbole
tests/                     Unit-Tests
scripts/                   Spieltest und Einzelseiten-Build
```

## Entwicklungsstufen

1. **Hexenmeister** mit Kristallstab, ab Stab-Stufe 3 mit Keule.
2. **Drachenrüstung**: bei Stab-Stufe 5 wählst du Feuer oder Eis.
3. **Lavadrache**: sobald zwei Fähigkeiten voll ausgebaut sind. Feueratem über den „Atem“-Knopf.

## Burg-Modus (Königreich)

- 3D-Ansicht (Three.js) mit Licht, Schatten und Texturen; wird erst beim Öffnen geladen.
- Feste Stadtmauer um einen 36 × 36 Felder großen Innenhof. Sie lässt sich nicht verschieben, nur upgraden (Palisade bis Königsmauer).
- Gebäude: Schloss, Wachturm, Wohnhaus, Feld, Bauernhof, Steinbruch, Kohlewerk, Goldmine. Alle bis Stufe 5, jede Stufe sichtbar prächtiger. Die Schloss-Stufe begrenzt die anderen.
- Produktion läuft auch, wenn das Spiel geschlossen ist (bis zu 8 Stunden Speicher). Goldminen liefern Gold, die anderen Nahrung, Stein und Kohle für Upgrades.
- Angriffe starten nur über den Knopf; die Mauer hält frühe Angriffe sicher ab.

## Deployment

`vercel.json` baut eine statische Seite (`npm run build`, Ausgabe `dist/`).
