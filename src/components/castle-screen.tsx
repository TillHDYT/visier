import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  ArrowLeft,
  ArrowUp,
  Castle as CastleIcon,
  Check,
  Coins,
  Factory,
  Flame,
  Gem,
  Hammer,
  House,
  Mountain,
  Package,
  Pickaxe,
  Shield,
  Sprout,
  Star,
  Smartphone,
  Swords,
  TowerControl,
  Tractor,
  Wheat,
  X,
} from "lucide-react";
import {
  KIND_NAME,
  MAX_LEVEL,
  PRODUCTION,
  RES_NAME,
  STORE_HOURS,
  TIERS,
  capacity,
  castleLevel,
  castleRequirement,
  castleStage,
  collect,
  costFor,
  countOf,
  levelTitle,
  limitFor,
  pending,
  perHour,
  place,
  placeBlock,
  rateOf,
  statsFor,
  tierOf,
  upgrade,
  upgradeBlock,
  upgradeCost,
  upgradeWall,
  wallUpgradeBlock,
  walletOf,
  type Building,
  type BuildingKind,
  type Castle,
  type Cost,
  type Resource,
} from "@/game/castle/model";
import { CastleScene, type PlaceView, type RaidView } from "@/game/castle/scene";
import { WALL_STYLES, wallStyleOf } from "@/game/castle/wall-look";
import { settle, spendable, type Meta } from "@/game/meta";

const KIT_GOLD = 400;

const ICON: Record<BuildingKind, typeof House> = {
  castle: CastleIcon,
  tower: TowerControl,
  house: House,
  field: Sprout,
  farm: Tractor,
  mine: Pickaxe,
  coal: Factory,
  goldmine: Gem,
};

const RES_ICON: Record<Resource, typeof Coins> = { gold: Coins, food: Wheat, stone: Mountain, coal: Flame };

const BUILD_ORDER: BuildingKind[] = ["goldmine", "field", "farm", "mine", "coal", "house", "tower"];

const BLURB: Record<BuildingKind, string> = {
  castle:
    "Herz des Königreichs. Seine Stufe begrenzt alle anderen Gebäude; wechselt sein Aussehen ab Stufe 5, 10, 15 und 20.",
  tower: "Schießt auf Angreifer innerhalb der Mauer.",
  house: "Stellt Verteidiger, die an die Mauer eilen.",
  field: "Erntet Nahrung.",
  farm: "Erntet viel Nahrung.",
  mine: "Bricht Stein für Upgrades.",
  coal: "Brennt Kohle für hohe Stufen.",
  goldmine: "Fördert Gold – auch wenn du nicht spielst.",
};

function fmt(n: number) {
  return n >= 10000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : String(Math.floor(n));
}

type Props = { meta: Meta; onMeta: (next: Meta) => void; onClose: () => void };

/** Königreich: Gebäude bauen, upgraden, ernten; Angriffe starten. */
export function CastleScreen({ meta, onMeta, onClose }: Props) {
  const glRef = useRef<HTMLCanvasElement>(null);
  const uiRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<CastleScene | null>(null);
  const rootRef = useRef<HTMLElement>(null);
  // Die Burg läuft immer im Querformat. Hält man das Handy hochkant, wird sie
  // um 90° gedreht gezeigt: Man legt das Handy quer (auch mit Rotationssperre).
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const turned = !!box && box.h > box.w;
  const turnedRef = useRef(turned);
  turnedRef.current = turned;
  const metaRef = useRef(meta);
  metaRef.current = meta;
  const kitRef = useRef(false);
  const [selected, setSelected] = useState<number | "wall" | null>(null);
  const [placing, setPlacing] = useState<PlaceView | null>(null);
  const [raid, setRaid] = useState<RaidView | null>(null);
  const [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState<{ text: string; n: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [failed, setFailed] = useState(false);

  const say = useCallback((text: string) => setToast((t) => ({ text, n: (t?.n ?? 0) + 1 })), []);
  const commit = useCallback(
    // Im Testmodus bleiben echtes Gold und echte Rohstoffe unangetastet.
    (castle: Castle, coins: number) => onMeta(settle(metaRef.current, { ...metaRef.current, castle, coins })),
    [onMeta],
  );

  const harvest = useCallback(
    (ids?: number[]) => {
      const m = metaRef.current;
      const t = Date.now();
      const before = m.castle.buildings;
      const h = collect(m.castle, m.coins, t, ids);
      const parts = Object.entries(h.got).filter(([, v]) => v);
      if (!parts.length) return;
      onMeta({ ...m, castle: h.castle, coins: h.coins });
      for (const b of before) {
        const amount = pending(b, t);
        const p = PRODUCTION[b.kind];
        if (p && amount > 0 && (!ids || ids.includes(b.id))) sceneRef.current?.harvested(b.id, amount, p.res);
      }
    },
    [onMeta],
  );

  useEffect(() => {
    const gl = glRef.current;
    const ui = uiRef.current;
    if (!gl || !ui) return;
    const m = metaRef.current;
    let scene: CastleScene;
    try {
      scene = new CastleScene(gl, ui, m.castle, m.coins, {
        onSelect: setSelected,
        onCommit: commit,
        onCollect: (ids) => harvest(ids),
        onToast: say,
        onRaid: setRaid,
        onPlace: setPlacing,
      });
    } catch {
      setFailed(true);
      return;
    }
    scene.setData(m.castle, m.coins, m.warriors, m.sfxOn);
    scene.setTurned(turnedRef.current);
    sceneRef.current = scene;
    return () => {
      scene.destroy();
      sceneRef.current = null;
    };
  }, [commit, harvest, say]);

  useEffect(() => {
    sceneRef.current?.setData(meta.castle, meta.coins, meta.warriors, meta.sfxOn);
  }, [meta]);

  // Größe des Spielbereichs beobachten (Hoch- oder Querformat?)
  useEffect(() => {
    const parent = rootRef.current?.parentElement;
    if (!parent) return;
    const measure = () => setBox({ w: parent.clientWidth, h: parent.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    sceneRef.current?.setTurned(turned);
  }, [turned]);

  // Uhr für Produktionsanzeigen
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Startpaket und Hinweis auf AFK-Gold
  useEffect(() => {
    if (kitRef.current) return;
    kitRef.current = true;
    const m = metaRef.current;
    const gold = m.castle.buildings.reduce(
      (sum, b) => sum + (PRODUCTION[b.kind]?.res === "gold" ? pending(b, Date.now()) : 0),
      0,
    );
    if (!m.castle.kit) {
      onMeta({ ...m, coins: m.coins + KIT_GOLD, castle: { ...m.castle, kit: true } });
      say(`Willkommen im Königreich: +${KIT_GOLD} Gold`);
    } else if (gold > 0) say(`Deine Goldminen haben ${gold} Gold gefördert – antippen zum Einsammeln`);
  }, [onMeta, say]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Bezahlt wird mit `view`: im Testmodus mit unbegrenzt Gold und Rohstoffen.
  const view = spendable(meta);
  const castle = view.castle;
  const coins = view.coins;
  const wallet = walletOf(castle, coins);
  const level = castleLevel(castle);
  const building = typeof selected === "number" ? (castle.buildings.find((b) => b.id === selected) ?? null) : null;
  const scene = () => sceneRef.current;
  const ready = castle.buildings.some((b) => pending(b, now) >= Math.max(1, rateOf(b) * 0.05));

  function doUpgrade(b: Building) {
    const r = upgrade(castle, b.id, coins);
    if (!r) return;
    if (meta.test) {
      // Testmodus: Upgrade ist gratis, die Ernte des Gebäudes kommt ins echte Lager.
      const h = collect(meta.castle, meta.coins, Date.now(), [b.id]);
      onMeta({ ...meta, castle: { ...r.castle, res: h.castle.res }, coins: h.coins });
    } else commit(r.castle, r.coins);
    scene()?.celebrate(b.id, b.level + 1);
  }

  function doWall() {
    const r = upgradeWall(castle, coins);
    if (!r) return;
    commit(r.castle, r.coins);
    scene()?.celebrate("wall", r.castle.wall);
  }

  function startPlace(kind: BuildingKind) {
    setSheet(false);
    const block = placeBlock(castle, kind, coins);
    if (block) {
      say(block);
      return;
    }
    scene()?.beginPlace(kind);
  }

  function confirmPlace() {
    const spot = scene()?.confirmPlace();
    if (!spot) return;
    const r = place(castle, spot.kind, spot.x, spot.y, coins);
    if (!r) {
      say("Hier ist kein Platz");
      return;
    }
    commit(r.castle, r.coins);
    scene()?.celebrate(r.castle.nextId - 1, 1, false);
  }

  function finishRaid() {
    if (raid?.result === "win") {
      const m = metaRef.current;
      onMeta({ ...m, coins: m.coins + raid.reward, castle: { ...m.castle, raid: m.castle.raid + 1 } });
    }
    scene()?.endRaid();
  }

  if (failed) {
    return (
      <section className="kingdom kingdom-fallback">
        <p className="font-display text-2xl">3D wird hier nicht unterstützt</p>
        <p className="text-sm font-medium">
          Dein Browser kann WebGL nicht starten. Versuch es in einem aktuellen Browser.
        </p>
        <button type="button" className="btn btn-go" onClick={onClose}>
          Zurück
        </button>
      </section>
    );
  }

  // Hochkant gehalten: Breite und Höhe tauschen und um 90° drehen
  const turnStyle: CSSProperties | undefined =
    turned && box
      ? {
          width: box.h,
          height: box.w,
          left: (box.w - box.h) / 2,
          top: (box.h - box.w) / 2,
          right: "auto",
          bottom: "auto",
          transform: "rotate(90deg)",
        }
      : undefined;

  return (
    <>
      {turned && (
        <div className="turn-hint" aria-hidden>
          <Smartphone size={54} strokeWidth={2.2} className="turn-hint-phone" />
          <span>Handy quer halten</span>
        </div>
      )}
      <section ref={rootRef} className="kingdom" style={turnStyle} aria-label="Königreich">
        <canvas ref={glRef} className="kingdom-canvas" aria-hidden />
        <canvas ref={uiRef} className="kingdom-canvas kingdom-ui" aria-label="Königreich, ziehen zum Bewegen" />

        <header className="kingdom-top">
          <button type="button" className="icon-btn" aria-label="Zurück zum Menü" onClick={onClose}>
            <ArrowLeft size={20} strokeWidth={2.6} />
          </button>
          <div className="kingdom-res" aria-label="Rohstoffe">
            {(["gold", "food", "stone", "coal"] as Resource[]).map((r) => {
              const Icon = RES_ICON[r];
              return (
                <span key={r} className={`res res-${r}`} title={RES_NAME[r]}>
                  <Icon size={15} strokeWidth={2.6} aria-hidden />
                  <span className="tabular-nums">{meta.test ? "∞" : fmt(wallet[r])}</span>
                </span>
              );
            })}
          </div>
        </header>

        {!raid && (
          <div className="kingdom-side">
            <button type="button" className="btn btn-pink kingdom-attack" onClick={() => scene()?.startRaid()}>
              <Swords size={18} strokeWidth={2.6} aria-hidden /> Angriff {castle.raid}
            </button>
            {ready && (
              <button type="button" className="btn btn-go kingdom-attack" onClick={() => harvest()}>
                <Package size={18} strokeWidth={2.6} aria-hidden /> Alles ernten
              </button>
            )}
          </div>
        )}

        {raid && !raid.result && (
          <div className="kingdom-raid">
            <div className="flex items-center justify-between text-sm font-bold">
              <span>
                Angriff {raid.level} · Gegner {raid.left}/{raid.total}
              </span>
              <span>Schloss</span>
            </div>
            <div className="bar hp" aria-label="Schloss-Leben">
              <span style={{ width: `${(raid.keepHp / Math.max(1, raid.keepMax)) * 100}%` }} />
            </div>
            <button type="button" className="btn btn-ink btn-sm" onClick={() => scene()?.endRaid()}>
              Aufgeben
            </button>
          </div>
        )}

        {raid?.result && (
          <div className="kingdom-result anim-pop" role="dialog" aria-label="Ergebnis">
            <h2 className="font-display text-4xl leading-none">{raid.result === "win" ? "Sieg!" : "Bresche!"}</h2>
            <p className="text-sm font-bold">
              {raid.result === "win"
                ? `Die Mauer hält. +${raid.reward} Gold, der nächste Angriff wird härter.`
                : "Die Angreifer sind durchgebrochen. Nichts geht verloren – baue Mauer und Türme aus."}
            </p>
            <button type="button" className="btn btn-go" onClick={finishRaid}>
              {raid.result === "win" ? `+${raid.reward} Gold einsammeln` : "Weiter"}
            </button>
          </div>
        )}

        {toast && (
          <p key={toast.n} className="kingdom-toast anim-pop" role="status">
            {toast.text}
          </p>
        )}

        {!raid && placing && (
          <div className="kingdom-panel">
            <p className="font-display text-xl leading-none">{KIND_NAME[placing.kind]} bauen</p>
            <CostRow cost={costFor(placing.kind, 1)} wallet={wallet} />
            <p className="text-sm font-medium">Ziehe das Gebäude an seinen Platz innerhalb der Mauer.</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn btn-ink" onClick={() => scene()?.cancelPlace()}>
                <X size={18} strokeWidth={2.8} aria-hidden /> Abbrechen
              </button>
              <button type="button" className="btn btn-go" disabled={!placing.valid} onClick={confirmPlace}>
                <Check size={18} strokeWidth={2.8} aria-hidden /> Bauen
              </button>
            </div>
          </div>
        )}

        {!raid && !placing && building && (
          <BuildingPanel
            castle={castle}
            building={building}
            coins={coins}
            now={now}
            onUpgrade={() => doUpgrade(building)}
            onHarvest={() => harvest([building.id])}
            onClose={() => scene()?.select(null)}
          />
        )}

        {!raid && !placing && selected === "wall" && (
          <WallPanel castle={castle} coins={coins} onUpgrade={doWall} onClose={() => scene()?.select(null)} />
        )}

        {!raid && !placing && selected === null && !sheet && (
          <button type="button" className="kingdom-build" onClick={() => setSheet(true)} aria-label="Bauen">
            <Hammer size={30} strokeWidth={2.4} aria-hidden />
            <span className="font-display text-sm leading-none">Bauen</span>
          </button>
        )}

        {!raid && !placing && sheet && (
          <div className="kingdom-sheet anim-pop" role="dialog" aria-label="Bauen">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl leading-none">Bauen</h2>
              <button type="button" className="icon-btn" aria-label="Schließen" onClick={() => setSheet(false)}>
                <X size={18} strokeWidth={2.6} />
              </button>
            </div>
            <ul className="kingdom-list">
              {BUILD_ORDER.map((kind) => {
                const Icon = ICON[kind];
                const n = countOf(castle, kind);
                const max = limitFor(kind, level);
                const p = PRODUCTION[kind];
                const block = placeBlock(castle, kind, coins);
                return (
                  <li key={kind}>
                    <button
                      type="button"
                      className="kingdom-item"
                      onClick={() => startPlace(kind)}
                      aria-disabled={!!block}
                    >
                      <span className="kingdom-badge" aria-hidden>
                        <Icon size={24} strokeWidth={2.4} />
                      </span>
                      <span className="min-w-0 flex-1 text-left">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="font-display text-lg leading-none">{KIND_NAME[kind]}</span>
                          <span className={n >= max ? "text-xs font-bold text-pink" : "text-xs font-bold"}>
                            {n}/{max}
                          </span>
                        </span>
                        <span className="block text-xs font-medium">
                          {p ? `+${perHour(kind, 1)} ${RES_NAME[p.res]}/Std. · ` : ""}
                          {BLURB[kind]}
                        </span>
                        <CostRow cost={costFor(kind, 1)} wallet={wallet} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs font-medium text-muted">Mehr Plätze gibt es mit jeder Schloss-Stufe.</p>
          </div>
        )}
      </section>
    </>
  );
}

function CostRow({ cost, wallet }: { cost: Cost; wallet: Record<Resource, number> }) {
  return (
    <span className="cost-row">
      {(Object.entries(cost) as [Resource, number][]).map(([r, v]) => {
        const Icon = RES_ICON[r];
        return (
          <span key={r} className={wallet[r] < v ? "cost lack" : "cost"}>
            <Icon size={13} strokeWidth={2.6} aria-hidden /> {fmt(v)}
          </span>
        );
      })}
    </span>
  );
}

/** Fünf Sterne für die Stile, darunter vier Punkte für die Zwischenstufen. */
function Stars({ level }: { level: number }) {
  const { tier, sub } = tierOf(level);
  return (
    <span className="kingdom-stars" aria-label={`Stufe ${level} von ${MAX_LEVEL}`}>
      {Array.from({ length: TIERS }, (_, i) => (
        <Star key={i} size={16} strokeWidth={2.4} className={i < tier ? "on" : ""} aria-hidden />
      ))}
      <span className="kingdom-pips" aria-hidden>
        {Array.from({ length: 4 }, (_, i) => (
          <i key={i} className={i <= sub ? "on" : ""} />
        ))}
      </span>
      <span className="text-xs font-bold">
        Stufe {level}/{MAX_LEVEL}
      </span>
    </span>
  );
}

function statLine(kind: BuildingKind, level: number, boosters: number): string {
  const p = PRODUCTION[kind];
  if (p) {
    const rate = perHour(kind, level);
    return `${fmt(rate)} ${RES_NAME[p.res]} pro Stunde · Speicher ${fmt(rate * STORE_HOURS)}`;
  }
  const s = statsFor(kind, level, boosters);
  const parts = [`${s.hp} Leben`];
  if (s.dmg) parts.push(`${s.dmg} Schaden`);
  if (s.range) parts.push(`${s.range.toLocaleString("de-DE")} Reichweite`);
  if (s.defenders) parts.push(`${s.defenders} Verteidiger`);
  if (kind === "castle") parts.push(`erlaubt Stufe ${level}`);
  return parts.join(" · ");
}

/** Was das Schloss für die nächste Stufe braucht und wann es sein Aussehen wechselt. */
function CastleGoal({ castle }: { castle: Castle }) {
  const req = castleRequirement(castle);
  const { stage, next } = castleStage(req.target - 1);
  const coming = castleStage(req.target).stage;
  return (
    <div className="kingdom-goal">
      <p className="text-xs font-bold">
        {coming.key !== stage.key
          ? `Mit Stufe ${req.target} wird es zum ${coming.name}!`
          : next
            ? `${next.name} ab Stufe ${next.from} – jede Stufe färbt das Schloss mehr in den neuen Stil.`
            : ""}
      </p>
      <ul>
        <li className={req.wallOk ? "ok" : ""}>
          {req.wallOk ? <Check size={14} strokeWidth={3} aria-hidden /> : <X size={14} strokeWidth={3} aria-hidden />}
          Stadtmauer Stufe {req.min} ({castle.wall})
        </li>
        <li className={req.ready >= req.needed ? "ok" : ""}>
          {req.ready >= req.needed ? (
            <Check size={14} strokeWidth={3} aria-hidden />
          ) : (
            <X size={14} strokeWidth={3} aria-hidden />
          )}
          {Math.min(req.ready, req.needed)}/{req.needed} Gebäude auf Stufe {req.min}
        </li>
      </ul>
    </div>
  );
}

type PanelProps = {
  castle: Castle;
  building: Building;
  coins: number;
  now: number;
  onUpgrade: () => void;
  onHarvest: () => void;
  onClose: () => void;
};

function BuildingPanel({ castle, building: b, coins, now, onUpgrade, onHarvest, onClose }: PanelProps) {
  const cost = upgradeCost(b);
  const block = upgradeBlock(castle, b, coins);
  const Icon = ICON[b.kind];
  const p = PRODUCTION[b.kind];
  const stored = pending(b, now);
  const wallet = walletOf(castle, coins);
  return (
    <div className="kingdom-panel">
      <div className="flex items-start gap-3">
        <span className="kingdom-badge" aria-hidden>
          <Icon size={26} strokeWidth={2.4} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl leading-none">
            {KIND_NAME[b.kind]} · {levelTitle(b.kind, b.level)}
          </p>
          <Stars level={b.level} />
        </div>
        <button type="button" className="icon-btn" aria-label="Schließen" onClick={onClose}>
          <X size={18} strokeWidth={2.6} />
        </button>
      </div>
      <p className="text-xs font-bold">{statLine(b.kind, b.level, castle.boosters)}</p>
      {p && (
        <div className="flex items-center gap-2">
          <div className="bar xp min-w-0 flex-1" aria-label="Lager">
            <span style={{ width: `${(stored / Math.max(1, capacity(b))) * 100}%` }} />
          </div>
          <button type="button" className="btn btn-ink btn-sm" disabled={stored <= 0} onClick={onHarvest}>
            Ernten {stored > 0 ? `+${fmt(stored)}` : ""}
          </button>
        </div>
      )}
      {cost && (
        <p className="text-xs font-bold text-pink">
          Stufe {b.level + 1} „{levelTitle(b.kind, b.level + 1)}“: {statLine(b.kind, b.level + 1, castle.boosters)}
        </p>
      )}
      {cost && b.kind === "castle" && <CastleGoal castle={castle} />}
      {cost && <CostRow cost={cost} wallet={wallet} />}
      <button type="button" className="btn btn-go kingdom-upgrade" disabled={!!block} onClick={onUpgrade}>
        {cost ? (
          <>
            <ArrowUp size={18} strokeWidth={2.8} aria-hidden /> Upgrade auf Stufe {b.level + 1}
          </>
        ) : (
          "Maximale Stufe"
        )}
      </button>
      {block && cost && <p className="text-xs font-bold text-muted">{block}</p>}
      <p className="text-xs font-medium text-muted">Gebäude festhalten und ziehen, um es zu verschieben.</p>
    </div>
  );
}

function WallPanel({
  castle,
  coins,
  onUpgrade,
  onClose,
}: {
  castle: Castle;
  coins: number;
  onUpgrade: () => void;
  onClose: () => void;
}) {
  const l = castle.wall;
  const block = wallUpgradeBlock(castle, coins);
  const now = statsFor("wall", l);
  const next = l < MAX_LEVEL ? statsFor("wall", l + 1) : null;
  const keep = castleLevel(castle);
  const style = WALL_STYLES.find((s) => s.key === wallStyleOf(keep).style) ?? null;
  // Wie bei Stufen-Titeln: ab Gift-Stil zählt der Mauer-Stil statt der Bauform.
  const title = (level: number) => style?.name ?? levelTitle("wall", level);
  return (
    <div className="kingdom-panel">
      <div className="flex items-start gap-3">
        <span className="kingdom-badge" aria-hidden>
          <Shield size={26} strokeWidth={2.4} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl leading-none">Stadtmauer · {title(l)}</p>
          <Stars level={l} />
        </div>
        <button type="button" className="icon-btn" aria-label="Schließen" onClick={onClose}>
          <X size={18} strokeWidth={2.6} />
        </button>
      </div>
      <p className="text-xs font-bold">
        Fest um das ganze Königreich · {now.hp} Leben je Abschnitt · Mauertürme {now.dmg} Schaden
      </p>
      <ul className="wall-styles" aria-label="Mauer-Stile">
        {WALL_STYLES.map((s) => (
          <li
            key={s.key}
            className={s.key === style?.key ? "on" : keep >= s.from ? "" : "locked"}
            aria-current={s.key === style?.key ? "true" : undefined}
          >
            <img src={s.preview} alt={keep >= s.from ? "" : "gesperrt"} />
            <span>{s.name}</span>
            <span className="text-muted">ab Schloss {s.from}</span>
          </li>
        ))}
      </ul>
      {next && (
        <p className="text-xs font-bold text-pink">
          Stufe {l + 1} „{title(l + 1)}“: {next.hp} Leben · {next.dmg} Schaden
        </p>
      )}
      {next && <CostRow cost={costFor("wall", l + 1)} wallet={walletOf(castle, coins)} />}
      <button type="button" className="btn btn-go kingdom-upgrade" disabled={!!block} onClick={onUpgrade}>
        {next ? (
          <>
            <ArrowUp size={18} strokeWidth={2.8} aria-hidden /> Mauer auf Stufe {l + 1}
          </>
        ) : (
          "Maximale Stufe"
        )}
      </button>
      {block && next && <p className="text-xs font-bold text-muted">{block}</p>}
    </div>
  );
}
