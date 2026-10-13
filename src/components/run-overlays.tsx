import { useEffect, useState } from "react";
import { ART } from "@/game/assets";
import { SYMS, fmtTime, type Sym } from "@/game/content";
import type { Card, LuckyPull, Summary } from "@/game/engine";
import { SkillIcon } from "@/game/icons";
import { Pips, SymMark } from "./ui";

export function ArmorSheet({ onPick }: { onPick: (kind: "fire" | "ice") => void }) {
  return (
    <section className="armor-sheet anim-pop" aria-label="Rüstungs-Wahl">
      <div className="mb-1">
        <h2 className="font-display text-4xl leading-none text-yellow">Rüstung</h2>
        <p className="text-sm font-bold">Die Keule ist Stufe 5. Die Wahl gilt für den ganzen Run.</p>
      </div>
      <div className="flex flex-col gap-3">
        <button type="button" className="armor-card" onClick={() => onPick("fire")}>
          <img src={ART.armorFire} alt="" className="armor-pic" />
          <span className="skill-copy">
            <span className="text-xs font-bold tracking-wide text-pink">1 · Feuerrüstung</span>
            <span className="font-display text-xl leading-none">Feuerdrache</span>
            <span className="text-sm leading-snug font-medium">
              Feuerwellen treffen härter. Getroffene Gegner brennen weiter.
            </span>
          </span>
        </button>
        <button type="button" className="armor-card" onClick={() => onPick("ice")}>
          <img src={ART.armorIce} alt="" className="armor-pic" />
          <span className="skill-copy">
            <span className="text-xs font-bold tracking-wide text-pink">2 · Eisrüstung</span>
            <span className="font-display text-xl leading-none">Eisdrache</span>
            <span className="text-sm leading-snug font-medium">
              Eisschockwellen. Getroffene Gegner frieren kurz ein und werden langsam.
            </span>
          </span>
        </button>
      </div>
    </section>
  );
}

type LevelProps = {
  cards: Card[];
  rerolls: number;
  onChoose: (key: string) => void;
  onReroll: () => void;
};

export function LevelSheet({ cards, rerolls, onChoose, onReroll }: LevelProps) {
  return (
    <section className="sheet anim-pop" aria-label="Skill-Auswahl">
      <div className="mb-2">
        <h2 className="font-display text-4xl leading-none text-yellow">Level</h2>
        <p className="text-sm font-bold">Wähle eine Karte. Tasten 1, 2, 3.</p>
      </div>
      <div className="flex flex-col gap-3">
        {cards.map((card, i) => (
          <button key={card.key} type="button" className="skill" onClick={() => onChoose(card.key)}>
            <span className={card.tone === "evo" ? "skill-ico evo" : "skill-ico"}>
              <SkillIcon id={card.icon} />
            </span>
            <span className="skill-copy">
              <span className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold tracking-wide text-pink">
                  {i + 1} · {card.badge}
                </span>
                <Pips n={card.pips} max={card.pipsMax} />
              </span>
              <span className="font-display text-xl leading-none">{card.name}</span>
              <span className="text-sm leading-snug font-medium">{card.desc}</span>
            </span>
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-ink mt-3" disabled={rerolls <= 0} onClick={onReroll}>
        Neu würfeln ({rerolls})
      </button>
    </section>
  );
}

const IDLE_REELS: Sym[] = ["sword", "magnet", "star", "coin"];

type LuckyProps = {
  onPull: () => LuckyPull | null;
  onClose: () => void;
};

/** Glücksrad. Wird bei jeder Belohnung neu eingeblendet und startet dann leer. */
export function LuckySheet({ onPull, onClose }: LuckyProps) {
  const [pull, setPull] = useState<LuckyPull | null>(null);
  const [reels, setReels] = useState<Sym[]>(IDLE_REELS);
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    if (!spinning || !pull) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReels(pull.symbols);
      setSpinning(false);
      return;
    }
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      if (n >= 10) {
        window.clearInterval(id);
        setReels(pull.symbols);
        setSpinning(false);
        return;
      }
      setReels(pull.symbols.map((_, i) => SYMS[(n + i * 2) % SYMS.length]));
    }, 70);
    return () => window.clearInterval(id);
  }, [spinning, pull]);

  function draw() {
    const result = onPull();
    if (!result) return;
    setPull(result);
    setSpinning(true);
  }

  return (
    <section className="sheet anim-pop" aria-label="Lucky Train">
      <h2 className="font-display text-4xl leading-none text-yellow">Lucky Train</h2>
      <p className="text-sm font-bold">Vier Symbole. Paare zahlen aus, vier gleiche sind der Jackpot.</p>
      <div className="reel-row my-2">
        {reels.map((sym, i) => (
          <div key={i} className={spinning ? "reel spin" : "reel"}>
            <SymMark sym={sym} className="size-8" />
          </div>
        ))}
      </div>
      {pull && !spinning && (
        <div>
          <p className="font-display text-2xl leading-none text-pink">{pull.title}</p>
          <p className="mt-1 text-sm font-medium">{pull.detail}</p>
        </div>
      )}
      {!pull ? (
        <button type="button" className="btn btn-go mt-2" onClick={draw}>
          Ziehen
        </button>
      ) : (
        <button type="button" className="btn btn-go mt-2" disabled={spinning} onClick={onClose}>
          Weiter
        </button>
      )}
    </section>
  );
}

export function PauseSheet({ onResume, onGiveUp }: { onResume: () => void; onGiveUp: () => void }) {
  return (
    <section className="sheet anim-pop" aria-label="Pause">
      <h2 className="font-display text-4xl leading-none">Pause</h2>
      <button type="button" className="btn btn-go" onClick={onResume}>
        Weiter
      </button>
      <button type="button" className="btn btn-pink" onClick={onGiveUp}>
        Aufgeben
      </button>
    </section>
  );
}

type DeathProps = {
  summary: Summary;
  onRevive: () => void;
  onRetry: () => void;
  onMenu: () => void;
};

export function DeathScreen({ summary, onRevive, onRetry, onMenu }: DeathProps) {
  const stats: [string, string | number][] = [
    ["Zeit", fmtTime(summary.time)],
    ["Kills", summary.kills],
    ["Level", summary.level],
    ["Gold", summary.coins],
  ];
  return (
    <section className="poster poster-dead anim-pop">
      <div className="dead-scroll">
        <p className="text-xs font-bold text-pink">RUN BEENDET</p>
        <h2 className="logo">Gefallen</h2>
        <ul className="grid grid-cols-2 gap-2 text-sm font-bold">
          {stats.map(([label, value]) => (
            <li key={label} className="frame">
              {label}
              <span className="mt-1 block font-display text-2xl tabular-nums">{value}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm font-bold">
          {summary.best ? "Neue Bestzeit in diesem Kapitel." : `Bosse: ${summary.bosses}`}
          {summary.warriors > 0 ? ` · ${summary.warriors} Krieger für die Burg` : ""}
        </p>
      </div>
      <div className="dead-actions">
        {summary.reviveCost > 0 && (
          <button type="button" className="btn btn-revive" onClick={onRevive}>
            <span className="block leading-none">{summary.reviveCost >= 500 ? "Letzte Chance" : "Wiederbeleben"}</span>
            <span className="btn-sub">{summary.reviveCost} Gold</span>
          </button>
        )}
        <button type="button" className="btn btn-go" onClick={onRetry}>
          Nochmal
        </button>
        <button type="button" className="btn btn-ink" onClick={onMenu}>
          Menü
        </button>
      </div>
    </section>
  );
}
