import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { mountGame, type Card, type GameHandle, type Hud as HudData, type Mode, type Summary } from "@/game/engine";
import { defaultMeta, loadMeta, saveMeta, type Meta } from "@/game/meta";
import { Hud } from "./hud";
import { MenuScreen, type Panel } from "./menu";
import { ArmorSheet, DeathScreen, LevelSheet, LuckySheet, PauseSheet } from "./run-overlays";

// Der Burg-Modus bringt Three.js mit; er wird erst beim Öffnen geladen.
const CastleScreen = lazy(() => import("./castle-screen").then((m) => ({ default: m.CastleScreen })));

const IN_RUN: ReadonlySet<Mode> = new Set(["play", "dying", "pause", "level", "lucky", "armor"]);

/**
 * Wurzel der Oberfläche. Das Spielfeld ist ein Canvas, das die Engine
 * selbst zeichnet; React kümmert sich nur um HUD, Menüs und Dialoge.
 */
export function VisorApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameHandle | null>(null);
  const [meta, setMeta] = useState<Meta>(defaultMeta);
  const [mode, setMode] = useState<Mode>("menu");
  const [hud, setHud] = useState<HudData | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [rerolls, setRerolls] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [panel, setPanel] = useState<Panel>("home");
  const [luckyRound, setLuckyRound] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = mountGame(canvas, {
      onMode: (next, sum) => {
        setMode(next);
        if (sum) setSummary(sum);
        if (next === "menu") setPanel("home");
      },
      onCards: (next, rolls) => {
        setCards(next);
        setRerolls(rolls);
      },
      onFrame: setHud,
      onMeta: setMeta,
      onLuckyOpen: () => setLuckyRound((n) => n + 1),
    });
    const loaded = loadMeta();
    game.sync(loaded);
    setMeta(loaded);
    gameRef.current = game;
    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  const commit = useCallback((next: Meta) => {
    saveMeta(next);
    setMeta(next);
    gameRef.current?.sync(next);
  }, []);

  const onPause = useCallback(() => gameRef.current?.pause(), []);
  const onBreath = useCallback((on: boolean) => gameRef.current?.breath(on), []);

  const inRun = IN_RUN.has(mode);
  const game = () => gameRef.current;

  return (
    <main className="shell">
      <div className="stage">
        <canvas ref={canvasRef} className={mode === "play" ? "playfield" : "playfield inert"} aria-label="Spielfeld" />
        {inRun && <div className="vignette" aria-hidden />}
        {inRun && hud && <Hud hud={hud} mode={mode} onPause={onPause} onBreath={onBreath} />}

        {mode === "menu" && panel !== "castle" && (
          <MenuScreen
            meta={meta}
            panel={panel}
            onPanel={setPanel}
            onMeta={commit}
            onStart={(chapter) => game()?.start(chapter)}
            onPrime={() => game()?.prime()}
          />
        )}

        {mode === "armor" && <ArmorSheet onPick={(kind) => game()?.pickArmor(kind)} />}
        {mode === "level" && (
          <LevelSheet
            cards={cards}
            rerolls={rerolls}
            onChoose={(key) => game()?.choose(key)}
            onReroll={() => game()?.reroll()}
          />
        )}
        {mode === "lucky" && (
          <LuckySheet
            key={luckyRound}
            onPull={() => game()?.pullLucky() ?? null}
            onClose={() => game()?.closeLucky()}
          />
        )}
        {mode === "pause" && <PauseSheet onResume={() => game()?.resume()} onGiveUp={() => game()?.giveUp()} />}
        {mode === "dead" && summary && (
          <DeathScreen
            summary={summary}
            onRevive={() => game()?.revive()}
            onRetry={() => game()?.start(summary.chapter)}
            onMenu={() => game()?.toMenu()}
          />
        )}
      </div>
      {mode === "menu" && panel === "castle" && (
        <Suspense fallback={<div className="kingdom kingdom-loading">Königreich wird geladen …</div>}>
          <CastleScreen meta={meta} onMeta={commit} onClose={() => setPanel("home")} />
        </Suspense>
      )}
    </main>
  );
}
