import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUp,
  BrickWall,
  Castle as CastleIcon,
  Check,
  Coins,
  House,
  Star,
  Swords,
  TowerControl,
  Trash2,
  X,
} from "lucide-react";
import {
  KIND_NAME,
  LEVEL_TITLE,
  MAX_LEVEL,
  PLACE_COST,
  castleLevel,
  countOf,
  limitFor,
  placeBlock,
  removeWall,
  statsFor,
  upgrade,
  upgradeBlock,
  upgradeCost,
  upgradeWalls,
  wallsAt,
  type Building,
  type BuildingKind,
  type Castle,
} from "@/game/castle/model";
import { CastleScene, type PlaceView, type RaidView } from "@/game/castle/scene";
import type { Meta } from "@/game/meta";

const KIT_GOLD = 280;

const ICON: Record<BuildingKind, typeof House> = {
  wall: BrickWall,
  tower: TowerControl,
  house: House,
  castle: CastleIcon,
};

type Props = { meta: Meta; onMeta: (next: Meta) => void; onClose: () => void };

/** Burg-Modus: Königreich bauen, upgraden und Angriffe manuell starten. */
export function CastleScreen({ meta, onMeta, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<CastleScene | null>(null);
  const metaRef = useRef(meta);
  metaRef.current = meta;
  const kitRef = useRef(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [placing, setPlacing] = useState<PlaceView | null>(null);
  const [raid, setRaid] = useState<RaidView | null>(null);
  const [toast, setToast] = useState<{ text: string; n: number } | null>(null);

  const say = useCallback((text: string) => setToast((t) => ({ text, n: (t?.n ?? 0) + 1 })), []);

  const commit = useCallback(
    (castle: Castle, coins: number) => onMeta({ ...metaRef.current, castle, coins }),
    [onMeta],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const m = metaRef.current;
    const scene = new CastleScene(canvas, m.castle, m.coins, {
      onSelect: setSelected,
      onCommit: commit,
      onToast: say,
      onRaid: setRaid,
      onPlace: setPlacing,
    });
    scene.setData(m.castle, m.coins, m.warriors, m.sfxOn);
    sceneRef.current = scene;
    return () => {
      scene.destroy();
      sceneRef.current = null;
    };
  }, [commit, say]);

  useEffect(() => {
    sceneRef.current?.setData(meta.castle, meta.coins, meta.warriors, meta.sfxOn);
  }, [meta]);

  // Startpaket beim allerersten Besuch.
  useEffect(() => {
    if (kitRef.current || metaRef.current.castle.kit) return;
    kitRef.current = true;
    const m = metaRef.current;
    onMeta({ ...m, coins: m.coins + KIT_GOLD, castle: { ...m.castle, kit: true } });
    say(`Startpaket: +${KIT_GOLD} Gold`);
  }, [onMeta, say]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const castle = meta.castle;
  const coins = meta.coins;
  const level = castleLevel(castle);
  const building = selected !== null ? (castle.buildings.find((b) => b.id === selected) ?? null) : null;
  const scene = () => sceneRef.current;

  function doUpgrade(b: Building) {
    const r = upgrade(castle, b.id, coins);
    if (!r) return;
    commit(r.castle, r.coins);
    scene()?.celebrate(b.id, b.level + 1);
  }

  function doUpgradeWalls(lvl: number) {
    const r = upgradeWalls(castle, lvl, coins);
    if (!r.count) return;
    commit(r.castle, r.coins);
    for (const b of castle.buildings) {
      if (b.kind === "wall" && b.level === lvl && r.castle.buildings.find((it) => it.id === b.id)?.level === lvl + 1) {
        scene()?.celebrate(b.id, lvl + 1, false);
      }
    }
    say(`${r.count} Mauern auf Stufe ${lvl + 1}`);
  }

  function doRemove(b: Building) {
    const next = removeWall(castle, b.id);
    if (!next) return;
    scene()?.select(null);
    commit(next, coins);
  }

  function pick(kind: BuildingKind) {
    if (kind === "castle") {
      const keep = castle.buildings.find((b) => b.kind === "castle");
      if (keep) scene()?.focus(keep.id);
      return;
    }
    const block = placeBlock(castle, kind, coins);
    if (block) {
      say(block);
      return;
    }
    scene()?.beginPlace(kind);
  }

  function finishRaid() {
    if (raid?.result === "win") {
      const m = metaRef.current;
      onMeta({ ...m, coins: m.coins + raid.reward, castle: { ...m.castle, raid: m.castle.raid + 1 } });
    }
    scene()?.endRaid();
  }

  return (
    <section className="kingdom" aria-label="Burg">
      <canvas ref={canvasRef} className="kingdom-canvas" aria-label="Königreich" />

      <header className="kingdom-top">
        <button type="button" className="icon-btn" aria-label="Zurück zum Menü" onClick={onClose}>
          <ArrowLeft size={20} strokeWidth={2.6} />
        </button>
        <span className="kingdom-gold">
          <Coins size={18} strokeWidth={2.6} aria-hidden /> <span className="tabular-nums">{coins}</span>
        </span>
        {raid ? (
          <span className="kingdom-raid-label">Angriff {raid.level}</span>
        ) : (
          <button type="button" className="btn btn-pink kingdom-attack" onClick={() => scene()?.startRaid()}>
            <Swords size={18} strokeWidth={2.6} aria-hidden /> Angriff {castle.raid}
          </button>
        )}
      </header>

      {raid && !raid.result && (
        <div className="kingdom-raid">
          <div className="flex items-center justify-between text-sm font-bold">
            <span>
              Gegner {raid.left}/{raid.total}
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
          <h2 className="font-display text-4xl leading-none">{raid.result === "win" ? "Sieg!" : "Gefallen"}</h2>
          <p className="text-sm font-bold">
            {raid.result === "win"
              ? `Die Burg hält. +${raid.reward} Gold, der nächste Angriff wird härter.`
              : "Das Schloss ist gefallen. Alles wird wieder aufgebaut – upgrade Mauern und Türme und versuch es nochmal."}
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
          {placing.kind === "wall" ? (
            <>
              <p className="font-display text-xl leading-none">Mauern bauen</p>
              <p className="text-sm font-medium">
                Tippen oder ziehen setzt Mauern ({PLACE_COST.wall} Gold je Stück). Mit zwei Fingern bewegst du die
                Karte.
              </p>
              <p className="text-xs font-bold text-muted">
                {countOf(castle, "wall")}/{limitFor("wall", level)} Mauern
              </p>
              <button type="button" className="btn btn-go" onClick={() => scene()?.cancelPlace()}>
                <Check size={18} strokeWidth={2.8} aria-hidden /> Fertig
              </button>
            </>
          ) : (
            <>
              <p className="font-display text-xl leading-none">
                {KIND_NAME[placing.kind]} platzieren · {PLACE_COST[placing.kind as "tower" | "house"]} Gold
              </p>
              <p className="text-sm font-medium">Ziehe das Gebäude an seinen Platz.</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="btn btn-ink" onClick={() => scene()?.cancelPlace()}>
                  <X size={18} strokeWidth={2.8} aria-hidden /> Abbrechen
                </button>
                <button
                  type="button"
                  className="btn btn-go"
                  disabled={!placing.valid}
                  onClick={() => scene()?.confirmPlace()}
                >
                  <Check size={18} strokeWidth={2.8} aria-hidden /> Bauen
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {!raid && !placing && building && (
        <BuildingPanel
          castle={castle}
          building={building}
          coins={coins}
          onUpgrade={() => doUpgrade(building)}
          onUpgradeWalls={() => doUpgradeWalls(building.level)}
          onRemove={() => doRemove(building)}
          onClose={() => scene()?.select(null)}
        />
      )}

      {!raid && !placing && !building && (
        <nav className="kingdom-tools" aria-label="Bauen">
          {(["wall", "tower", "house", "castle"] as const).map((kind) => {
            const Icon = ICON[kind];
            const n = countOf(castle, kind);
            const max = limitFor(kind, level);
            return (
              <button key={kind} type="button" className="kingdom-tool" onClick={() => pick(kind)}>
                <Icon size={26} strokeWidth={2.4} aria-hidden />
                <span className="font-display text-base leading-none">{KIND_NAME[kind]}</span>
                <span className="text-xs font-bold tabular-nums">
                  {kind === "castle" ? `Stufe ${level}` : `${n}/${max} · ${PLACE_COST[kind]} G`}
                </span>
              </button>
            );
          })}
        </nav>
      )}
    </section>
  );
}

type PanelProps = {
  castle: Castle;
  building: Building;
  coins: number;
  onUpgrade: () => void;
  onUpgradeWalls: () => void;
  onRemove: () => void;
  onClose: () => void;
};

function statLine(kind: BuildingKind, level: number, boosters: number): string {
  const s = statsFor(kind, level, boosters);
  const parts = [`${s.hp} Leben`];
  if (s.dmg) parts.push(`${s.dmg} Schaden`);
  if (s.range) parts.push(`${s.range.toLocaleString("de-DE")} Reichweite`);
  if (s.defenders) parts.push(`${s.defenders} Verteidiger`);
  if (kind === "castle") parts.push(`erlaubt Stufe ${level}`);
  return parts.join(" · ");
}

function BuildingPanel({ castle, building: b, coins, onUpgrade, onUpgradeWalls, onRemove, onClose }: PanelProps) {
  const cost = upgradeCost(b);
  const block = upgradeBlock(castle, b, coins);
  const max = b.level >= MAX_LEVEL;
  const walls = b.kind === "wall" ? wallsAt(castle, b.level) : null;
  const Icon = ICON[b.kind];
  return (
    <div className="kingdom-panel">
      <div className="flex items-start gap-3">
        <span className="kingdom-badge" aria-hidden>
          <Icon size={26} strokeWidth={2.4} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl leading-none">
            {KIND_NAME[b.kind]} · {LEVEL_TITLE[b.kind][b.level - 1]}
          </p>
          <span className="kingdom-stars" aria-label={`Stufe ${b.level} von ${MAX_LEVEL}`}>
            {Array.from({ length: MAX_LEVEL }, (_, i) => (
              <Star key={i} size={16} strokeWidth={2.4} className={i < b.level ? "on" : ""} aria-hidden />
            ))}
            <span className="text-xs font-bold">
              Stufe {b.level}/{MAX_LEVEL}
            </span>
          </span>
        </div>
        <button type="button" className="icon-btn" aria-label="Schließen" onClick={onClose}>
          <X size={18} strokeWidth={2.6} />
        </button>
      </div>
      <p className="text-xs font-bold">{statLine(b.kind, b.level, castle.boosters)}</p>
      {!max && (
        <p className="text-xs font-bold text-pink">
          Stufe {b.level + 1} „{LEVEL_TITLE[b.kind][b.level]}“: {statLine(b.kind, b.level + 1, castle.boosters)}
        </p>
      )}
      <button type="button" className="btn btn-go kingdom-upgrade" disabled={!!block} onClick={onUpgrade}>
        {max ? (
          "Maximale Stufe"
        ) : (
          <>
            <ArrowUp size={18} strokeWidth={2.8} aria-hidden /> Upgrade · {cost} Gold
          </>
        )}
      </button>
      {block && !max && <p className="text-xs font-bold text-muted">{block}</p>}
      {walls && walls.count > 1 && !max && b.level < castleLevel(castle) && (
        <button type="button" className="btn btn-ink btn-sm" disabled={coins < walls.cost} onClick={onUpgradeWalls}>
          Alle {walls.count} Mauern Stufe {b.level} upgraden · je {walls.cost} G
        </button>
      )}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted">Gebäude festhalten und ziehen, um es zu verschieben.</p>
        {b.kind === "wall" && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onRemove} aria-label="Mauer abreißen">
            <Trash2 size={16} strokeWidth={2.6} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
