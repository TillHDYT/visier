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
    castle-screen.tsx      Burg-Modus: Werkzeugleiste, Upgrade-Panel, Angriffs-Anzeige
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
      model.ts             Burg: Gebäude, Kosten, Stufen 1–5, Limits, Speicherstand
      art.ts               Burg: isometrische Gebäude-Grafik je Stufe, Wiese, Bäume
      scene.ts             Burg: Kamera, Bauen, Verschieben, Effekte, Zeichnen
      raid.ts              Burg: Angriffs-Simulation (Gegner, Türme, Verteidiger)
    icons.tsx              Symbole
tests/                     Unit-Tests
scripts/                   Spieltest und Einzelseiten-Build
```

## Entwicklungsstufen

1. **Hexenmeister** mit Kristallstab, ab Stab-Stufe 3 mit Keule.
2. **Drachenrüstung**: bei Stab-Stufe 5 wählst du Feuer oder Eis.
3. **Lavadrache**: sobald zwei Fähigkeiten voll ausgebaut sind. Feueratem über den „Atem“-Knopf.

## Burg-Modus

- Schloss, Türme, Häuser und Mauern frei platzieren und verschieben (Gebäude antippen, festhalten, ziehen).
- Mauern per Tippen oder Ziehen setzen; benachbarte Mauern verbinden sich.
- Jedes Gebäude hat Stufe 1–5, jede Stufe sieht deutlich anders aus. Gebäude können höchstens die Stufe des Schlosses erreichen.
- Gold kommt aus dem Survivor-Modus. Angriffe starten nur über den Knopf „Angriff“; ein Sieg bringt Gold und macht den nächsten Angriff härter.

## Deployment

`vercel.json` baut eine statische Seite (`npm run build`, Ausgabe `dist/`).
