import { useEffect, useRef, useState } from "react";
import {
  Coins,
  Heart,
  Lock,
  Magnet,
  Pause,
  Rocket,
  Star,
  Sword,
  TriangleAlert,
  Zap,
} from "lucide-react";
import { CHAPTERS, INFO, PASSIVE_IDS, SYMS, WEAPON_IDS, fmtTime, type Sym } from "@/game/content";
import { SkillIcon } from "@/game/icons";
import { nextPermLabel } from "@/game/skills";
import { CastleView } from "@/game/castle";
import {
  mountGame,
  type Card,
  type GameHandle,
  type Hud,
  type LuckyPull,
  type Mode,
  type Summary,
} from "@/game/engine";
import {
  RANK_MAX_PUBLIC,
  BOOSTER_CAP,
  BOOSTER_COST,
  SKIN_INFO,
  buyBooster,
  buyRank,
  buySkill,
  buySkin,
  chapterUnlocked,
  defaultMeta,
  equipSkin,
  gearCost,
  gearLine,
  loadMeta,
  rankCost,
  rollGear,
  saveMeta,
  SKILL_CAP,
  skillCost,
  type Meta,
} from "@/game/meta";

const RANKS: { key: keyof Meta["ranks"]; name: string; blurb: string }[] = [
  { key: "hp", name: "Leben", blurb: "+18 HP je Rang" },
  { key: "dmg", name: "Schaden", blurb: "+6% je Rang" },
  { key: "spd", name: "Tempo", blurb: "+3,5% je Rang" },
  { key: "mag", name: "Magnet", blurb: "+16 Reichweite" },
  { key: "start", name: "Startstab", blurb: "+1 Stern am Stab" },
];

function Pips({ n, max }: { n: number; max: number }) {
  if (max <= 0) return null;
  return (
    <span className="flex gap-1" aria-hidden>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < n ? "pip on" : "pip"} />
      ))}
    </span>
  );
}

function SymMark({ sym, className }: { sym: Sym; className?: string }) {
  const props = { className, strokeWidth: 2.4, "aria-hidden": true as const };
  if (sym === "sword" || sym === "blade") return <Sword {...props} />;
  if (sym === "magnet") return <Magnet {...props} />;
  if (sym === "rocket") return <Rocket {...props} />;
  if (sym === "heart") return <Heart {...props} />;
  if (sym === "star") return <Star {...props} />;
  if (sym === "coin") return <Coins {...props} />;
  return <Zap {...props} />;
}

function Slots({ items }: { items: { id: string; star: number }[] }) {
  return (
    <div className="chip-row">
      {Array.from({ length: 6 }, (_, i) => {
        const it = items[i];
        if (!it) return <div key={i} className="chip empty" />;
        const info = INFO[it.id];
        const evolved = info?.tone === "evo";
        return (
          <div key={it.id} className={evolved ? "chip evo" : "chip"} title={info?.name ?? it.id}>
            <SkillIcon id={it.id} className="chip-ico" />
            <span className="tabular-nums">{it.star}</span>
          </div>
        );
      })}
    </div>
  );
}

export function VisorApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameHandle | null>(null);
  const [meta, setMeta] = useState<Meta>(defaultMeta);
  const [mode, setMode] = useState<Mode>("menu");
  const [hud, setHud] = useState<Hud | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [rerolls, setRerolls] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [panel, setPanel] = useState<"home" | "shop" | "options" | "castle" | "market" | "skins">("home");
  const [shopTab, setShopTab] = useState<"skills" | "train">("skills");
  const [pull, setPull] = useState<LuckyPull | null>(null);
  const [reels, setReels] = useState<Sym[]>(["sword", "magnet", "heart", "coin"]);
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let hudAt = 0;
    let lastWarn = "";
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
      onFrame: (frame) => {
        const now = performance.now();
        const urgent = frame.warning !== lastWarn;
        lastWarn = frame.warning;
        if (!urgent && now - hudAt < 100) return;
        hudAt = now;
        setHud(frame);
      },
      onMeta: setMeta,
      onLuckyOpen: () => {
        setPull(null);
        setSpinning(false);
        setReels(["sword", "magnet", "star", "coin"]);
      },
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

  useEffect(() => {
    if (!spinning || !pull) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
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

  function backToMenu() {
    setPanel("home");
    setMode("menu");
    gameRef.current?.toMenu();
  }

  function commit(next: Meta) {
    saveMeta(next);
    setMeta(next);
    gameRef.current?.sync(next);
  }

  function drawLucky() {
    const result = gameRef.current?.pullLucky() ?? null;
    if (!result) return;
    setPull(result);
    setSpinning(true);
  }

  const playing = mode === "play" || mode === "dying" || mode === "pause" || mode === "level" || mode === "lucky" || mode === "armor";
  const xpPct = hud ? Math.max(0, Math.min(100, (hud.xp / Math.max(1, hud.xpNeed)) * 100)) : 0;
  const hpPct = hud ? Math.max(0, Math.min(100, (hud.hp / Math.max(1, hud.maxHp)) * 100)) : 0;

  return (
    <main className="shell">
      <div className="stage">
        <canvas ref={canvasRef} className={mode === "play" ? "playfield" : "playfield inert"} aria-label="Spielfeld" />

        {playing && hud && (
          <div className="hud">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-baseline justify-between font-display">
                  <span className="inked text-lg leading-none">Lv {hud.level}</span>
                  <span className="inked tabular-nums text-2xl leading-none">{fmtTime(hud.time)}</span>
                  <span className="inked font-sans text-sm font-bold">Welle {hud.waveN}</span>
                </div>
                <div className="bar xp" aria-label="Erfahrung">
                  <span style={{ width: `${xpPct}%` }} />
                </div>
                <div className="bar hp mt-1" aria-label="Leben">
                  <span style={{ width: `${hpPct}%` }} />
                </div>
                <p className="inked mt-1 text-xs font-bold">
                  {hud.wave} · {hud.kills} Kills · {hud.gold} Gold
                </p>
                {hud.boss && (
                  <div className="mt-2">
                    <p className="inked text-xs font-bold">{hud.boss.name}</p>
                    <div className="bar boss">
                      <span style={{ width: `${(hud.boss.hp / Math.max(1, hud.boss.max)) * 100}%` }} />
                    </div>
                  </div>
                )}
              </div>
              {mode === "play" && (
                <button type="button" className="icon-btn" aria-label="Pause" onClick={() => gameRef.current?.pause()}>
                  <Pause size={20} strokeWidth={2.6} />
                </button>
              )}
            </div>

            {hud.warning && (
              <div className="warn anim-warn" role="status">
                <TriangleAlert size={28} strokeWidth={2.6} />
                {hud.warning}
              </div>
            )}

            {!hud.moved && mode === "play" && !hud.warning && (
              <p className="warn warn-hint">Ziehen zum Laufen</p>
            )}

            {hud.dragon && mode === "play" && (
              <button
                type="button"
                className="breath-btn"
                aria-label="Feueratem"
                onPointerDown={(e) => {
                  e.preventDefault();
                  gameRef.current?.breath(true);
                }}
                onPointerUp={() => gameRef.current?.breath(false)}
                onPointerCancel={() => gameRef.current?.breath(false)}
                onPointerLeave={() => gameRef.current?.breath(false)}
              >
                Atem
              </button>
            )}

            <div className="dock">
              <Slots items={hud.weapons} />
              <Slots items={hud.passives} />
            </div>
          </div>
        )}

        {mode === "menu" && panel === "castle" && (
          <CastleView meta={meta} onMeta={commit} onClose={() => setPanel("home")} />
        )}

        {mode === "menu" && panel !== "castle" && (
          <section
            className={panel === "shop" ? "poster" : "poster poster-home"}
            onPointerDown={() => gameRef.current?.prime()}
          >
            <p className="text-xs font-bold tracking-[0.22em] text-muted">HEXENMEISTER</p>
            <h1 className="logo">VISIER</h1>
            {panel !== "shop" && (
              <p className="max-w-[22rem] text-base leading-snug font-medium">
                Eine Hand bewegt. Der Stab schießt von allein.
              </p>
            )}

            {panel === "home" ? (
              <>
                <div className="flex gap-2">
                  {CHAPTERS.map((ch) => {
                    const open = chapterUnlocked(meta, ch.id);
                    const on = meta.selectedChapter === ch.id;
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        className={on ? "chapter on" : "chapter"}
                        disabled={!open}
                        onClick={() => commit({ ...meta, selectedChapter: ch.id })}
                      >
                        <span className="block font-display text-lg leading-none">{ch.name}</span>
                        <span className="mt-1 block text-xs font-bold leading-snug">
                          {open ? ch.blurb : ch.id === 2 ? "Park 4:00" : "Fabrik 8:00"}
                        </span>
                        <span className="mt-1 block text-xs tabular-nums text-muted">
                          Best {fmtTime(meta.best[ch.id - 1] ?? 0)}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="btn btn-go"
                  onClick={() => gameRef.current?.start(meta.selectedChapter || 1)}
                >
                  Spielen
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" className="btn btn-pink" onClick={() => setPanel("castle")}>
                    Burg
                  </button>
                  <button type="button" className="btn btn-ink" onClick={() => setPanel("market")}>
                    Shop
                  </button>
                  <button type="button" className="btn btn-ink" onClick={() => setPanel("skins")}>
                    Skins
                  </button>
                  <button type="button" className="btn btn-ink" onClick={() => setPanel("options")}>
                    Optionen
                  </button>
                </div>
                <div className="flex items-center justify-between text-sm font-bold">
                  <span className="tabular-nums">{meta.coins} Gold</span>
                  <span>{meta.runs} Läufe</span>
                </div>
                <button type="button" className="btn btn-ink mt-auto" onClick={() => { setShopTab("skills"); setPanel("shop"); }}>
                  Fähigkeiten
                </button>
              </>
            ) : panel === "options" ? (
              <>
                <h2 className="font-display text-3xl leading-none">Optionen</h2>
                <button
                  type="button"
                  className="opt-row"
                  aria-pressed={meta.music}
                  onClick={() => commit({ ...meta, music: !meta.music })}
                >
                  <span>Musik</span>
                  <span className={meta.music ? "switch on" : "switch"}>{meta.music ? "An" : "Aus"}</span>
                </button>
                <button
                  type="button"
                  className="opt-row"
                  aria-pressed={meta.sfxOn}
                  onClick={() => commit({ ...meta, sfxOn: !meta.sfxOn, mute: meta.sfxOn })}
                >
                  <span>Effekte</span>
                  <span className={meta.sfxOn ? "switch on" : "switch"}>{meta.sfxOn ? "An" : "Aus"}</span>
                </button>
                <button
                  type="button"
                  className="opt-row"
                  aria-pressed={meta.shake}
                  onClick={() => commit({ ...meta, shake: !meta.shake })}
                >
                  <span>Wackeln</span>
                  <span className={meta.shake ? "switch on" : "switch"}>{meta.shake ? "An" : "Aus"}</span>
                </button>
                <p className="text-sm font-medium text-muted">Musik und Effekte laufen getrennt. Die Wahl bleibt gespeichert.</p>
                <button type="button" className="btn btn-go mt-auto" onClick={() => setPanel("home")}>
                  Zurück
                </button>
              </>
            ) : panel === "market" ? (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-3xl leading-none">Shop</h2>
                  <span className="font-display text-2xl leading-none tabular-nums">{meta.coins} G</span>
                </div>
                <p className="text-sm font-medium">Skins und Booster. Das Gold kommt aus dem Überleben.</p>
                <ul className="flex flex-col gap-2">
                  {SKIN_INFO.map((skin) => {
                    const owned = meta.castle.owned.includes(skin.id);
                    return (
                      <li key={skin.id} className="shop-row">
                        <img src={skin.src} alt="" className="skin-thumb" />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold leading-tight">{skin.name}</p>
                          <p className="text-xs font-medium text-muted">{owned ? "Freigeschaltet" : "Mauer-Skin"}</p>
                        </div>
                        <button
                          type="button"
                          className="btn btn-go btn-sm"
                          disabled={owned || meta.coins < skin.cost}
                          onClick={() => {
                            const next = buySkin(meta, skin.id);
                            if (next) commit(next);
                          }}
                        >
                          {owned ? "Besitz" : skin.cost === 0 ? "Frei" : skin.cost}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <button
                  type="button"
                  className="btn btn-pink"
                  disabled={meta.castle.boosters >= BOOSTER_CAP || meta.coins < BOOSTER_COST}
                  onClick={() => {
                    const next = buyBooster(meta);
                    if (next) commit(next);
                  }}
                >
                  Booster-Pack {meta.castle.boosters}/{BOOSTER_CAP} · {BOOSTER_COST}
                </button>
                <p className="text-xs font-medium text-muted">Jedes Pack macht den Feuerstoß der Burg härter.</p>
                <button type="button" className="btn btn-ink" onClick={() => setPanel("home")}>
                  Zurück
                </button>
              </>
            ) : panel === "skins" ? (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-3xl leading-none">Skins</h2>
                  <span className="font-display text-2xl leading-none tabular-nums">{meta.coins} G</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {SKIN_INFO.map((skin) => {
                    const owned = meta.castle.owned.includes(skin.id);
                    const on = meta.castle.skin === skin.id;
                    return (
                      <button
                        key={skin.id}
                        type="button"
                        className={on ? "skin-card on" : owned ? "skin-card" : "skin-card locked"}
                        disabled={!owned}
                        onClick={() => {
                          const next = equipSkin(meta, skin.id);
                          if (next) commit(next);
                        }}
                      >
                        <img src={skin.src} alt="" />
                        <span className="font-display text-lg leading-none">{skin.name}</span>
                        {!owned && (
                          <span className="skin-lock">
                            <Lock size={18} strokeWidth={2.6} /> {skin.cost}
                          </span>
                        )}
                        {on && <span className="text-xs font-bold">Aktiv</span>}
                      </button>
                    );
                  })}
                </div>
                <button type="button" className="btn btn-ink" onClick={() => setPanel("home")}>
                  Zurück
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-3xl leading-none">Werkstatt</h2>
                  <span className="font-display text-2xl leading-none tabular-nums">{meta.coins} G</span>
                </div>
                <p className="text-sm font-medium">100 Gold je Minute, Beute ab Minute 3, 250 je Boss. Stufen bleiben.</p>
                <div className="flex gap-2">
                  <button type="button" className={shopTab === "skills" ? "chapter on" : "chapter"} onClick={() => setShopTab("skills")}>
                    <span className="font-display text-lg leading-none">Fähigkeiten</span>
                  </button>
                  <button type="button" className={shopTab === "train" ? "chapter on" : "chapter"} onClick={() => setShopTab("train")}>
                    <span className="font-display text-lg leading-none">Training</span>
                  </button>
                </div>
                {shopTab === "skills" ? (
                  <ul className="shop-list">
                    {[...WEAPON_IDS, ...PASSIVE_IDS].map((id) => {
                      const info = INFO[id];
                      const rank = meta.skills[id] ?? 0;
                      const full = rank >= SKILL_CAP;
                      const cost = skillCost(rank);
                      const next = nextPermLabel(id, rank);
                      return (
                        <li key={id} className="shop-row">
                          <span className="skill-ico sm">
                            <SkillIcon id={id} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold leading-tight">{info.name}</p>
                            <p className="text-xs font-medium text-muted">{full ? "Maximum" : next}</p>
                            <Pips n={rank} max={SKILL_CAP} />
                          </div>
                          <button
                            type="button"
                            className="btn btn-go btn-sm"
                            disabled={full || meta.coins < cost}
                            onClick={() => {
                              const bought = buySkill(meta, id);
                              if (bought) commit(bought);
                            }}
                          >
                            {full ? "Max" : cost}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <>
                <ul className="flex flex-col gap-2">
                  {RANKS.map((row) => {
                    const rank = meta.ranks[row.key];
                    const max = RANK_MAX_PUBLIC[row.key];
                    const cost = rankCost(rank);
                    const full = rank >= max;
                    return (
                      <li key={row.key} className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold leading-tight">{row.name}</p>
                          <p className="text-xs font-medium text-muted">
                            {row.blurb} · Rang {rank}/{max}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="btn btn-go btn-sm"
                          disabled={full || meta.coins < cost}
                          onClick={() => {
                            const next = buyRank(meta, row.key);
                            if (next) commit(next);
                          }}
                        >
                          {full ? "Max" : cost}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="grid grid-cols-3 gap-2 text-xs font-bold">
                  {(["helm", "scarf", "boots"] as const).map((slot) => {
                    const item = meta.gear[slot];
                    const names = { helm: "Helm", scarf: "Schal", boots: "Stiefel" };
                    return (
                      <div key={slot} className="frame">
                        <p>{names[slot]}</p>
                        <p className="text-muted">{item ? ["Gewöhnlich", "Selten", "Episch", "Legendär"][item.rarity] : "Leer"}</p>
                        <p>{gearLine(item)}</p>
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="btn btn-pink"
                  disabled={meta.coins < gearCost(meta.gearRolls)}
                  onClick={() => {
                    const next = rollGear(meta);
                    if (next) commit(next);
                  }}
                >
                  Ausrüstung {gearCost(meta.gearRolls)}
                </button>
                  </>
                )}
                <button type="button" className="btn btn-ghost" onClick={() => setPanel("home")}>
                  Zurück
                </button>
              </>
            )}
          </section>
        )}

        {mode === "armor" && (
          <section className="armor-sheet anim-pop" aria-label="Rüstungs-Wahl">
            <div className="mb-1">
              <h2 className="font-display text-4xl leading-none text-yellow">Rüstung</h2>
              <p className="text-sm font-bold">Die Keule ist Stufe 5. Die Wahl gilt für den ganzen Run.</p>
            </div>
            <div className="flex flex-col gap-3">
              <button type="button" className="armor-card" onClick={() => gameRef.current?.pickArmor("fire")}>
                <img src="/armor-fire.png" alt="" className="armor-pic" />
                <span className="skill-copy">
                  <span className="text-xs font-bold tracking-wide text-pink">1 · Feuerrüstung</span>
                  <span className="font-display text-xl leading-none">Feuerdrache</span>
                  <span className="text-sm leading-snug font-medium">Feuerwellen treffen härter. Getroffene Gegner brennen weiter.</span>
                </span>
              </button>
              <button type="button" className="armor-card" onClick={() => gameRef.current?.pickArmor("ice")}>
                <img src="/armor-ice.png" alt="" className="armor-pic" />
                <span className="skill-copy">
                  <span className="text-xs font-bold tracking-wide text-pink">2 · Eisrüstung</span>
                  <span className="font-display text-xl leading-none">Eisdrache</span>
                  <span className="text-sm leading-snug font-medium">Eisschockwellen. Getroffene Gegner frieren kurz ein und werden langsam.</span>
                </span>
              </button>
            </div>
          </section>
        )}

        {mode === "level" && (
          <section className="sheet anim-pop" aria-label="Skill-Auswahl">
            <div className="mb-2">
              <h2 className="font-display text-4xl leading-none text-yellow">Level</h2>
              <p className="text-sm font-bold">Wähle eine Karte. Tasten 1, 2, 3.</p>
            </div>
            <div className="flex flex-col gap-3">
              {cards.map((card, i) => (
                <button key={card.key} type="button" className="skill" onClick={() => gameRef.current?.choose(card.key)}>
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
            <button
              type="button"
              className="btn btn-ink mt-3"
              disabled={rerolls <= 0}
              onClick={() => gameRef.current?.reroll()}
            >
              Neu würfeln ({rerolls})
            </button>
          </section>
        )}

        {mode === "lucky" && (
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
              <button type="button" className="btn btn-go mt-2" onClick={drawLucky}>
                Ziehen
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-go mt-2"
                disabled={spinning}
                onClick={() => gameRef.current?.closeLucky()}
              >
                Weiter
              </button>
            )}
          </section>
        )}

        {mode === "pause" && (
          <section className="sheet anim-pop">
            <h2 className="font-display text-4xl leading-none">Pause</h2>
            <button type="button" className="btn btn-go" onClick={() => gameRef.current?.resume()}>
              Weiter
            </button>
            <button type="button" className="btn btn-pink" onClick={() => gameRef.current?.giveUp()}>
              Aufgeben
            </button>
          </section>
        )}

        {mode === "dead" && summary && (
          <section className="poster poster-dead anim-pop">
            <div className="dead-scroll">
              <p className="text-xs font-bold text-pink">RUN BEENDET</p>
              <h2 className="logo">Gefallen</h2>
              <ul className="grid grid-cols-2 gap-2 text-sm font-bold">
                <li className="frame">
                  Zeit
                  <span className="mt-1 block font-display text-2xl tabular-nums">{fmtTime(summary.time)}</span>
                </li>
                <li className="frame">
                  Kills
                  <span className="mt-1 block font-display text-2xl tabular-nums">{summary.kills}</span>
                </li>
                <li className="frame">
                  Level
                  <span className="mt-1 block font-display text-2xl tabular-nums">{summary.level}</span>
                </li>
                <li className="frame">
                  Gold
                  <span className="mt-1 block font-display text-2xl tabular-nums">{summary.coins}</span>
                </li>
              </ul>
              <p className="text-sm font-bold">
                {summary.best ? "Neue Bestzeit in diesem Kapitel." : `Bosse: ${summary.bosses}`}
                {summary.warriors > 0 ? ` · ${summary.warriors} Krieger für die Burg` : ""}
              </p>
            </div>
            <div className="dead-actions">
              {summary.reviveCost > 0 && (
                <button type="button" className="btn btn-revive" onClick={() => gameRef.current?.revive()}>
                  <span className="block leading-none">
                    {summary.reviveCost >= 500 ? "Letzte Chance" : "Wiederbeleben"}
                  </span>
                  <span className="btn-sub">{summary.reviveCost} Gold</span>
                </button>
              )}
              <button
                type="button"
                className="btn btn-go"
                onClick={() => gameRef.current?.start(summary.chapter)}
              >
                Nochmal
              </button>
              <button type="button" className="btn btn-ink" onClick={backToMenu}>
                Menü
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
