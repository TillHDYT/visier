import { useState } from "react";
import { Castle, Lock } from "lucide-react";
import { CHAPTERS, INFO, PASSIVE_IDS, WEAPON_IDS, fmtTime } from "@/game/content";
import { SkillIcon } from "@/game/icons";
import {
  BOOSTER_CAP,
  BOOSTER_COST,
  RANK_MAX_PUBLIC,
  RARITY_NAME,
  SKILL_CAP,
  SKIN_INFO,
  SLOT_NAME,
  UNLIMITED,
  buyBooster,
  buyRank,
  buySkill,
  buySkin,
  chapterUnlocked,
  equipSkin,
  gearCost,
  gearLine,
  rankCost,
  rollGear,
  settle,
  skillCost,
  spendable,
  type Meta,
} from "@/game/meta";
import { nextPermLabel } from "@/game/skills";
import { Pips } from "./ui";

export type Panel = "home" | "shop" | "options" | "castle" | "market" | "skins";

const RANKS: { key: keyof Meta["ranks"]; name: string; blurb: string }[] = [
  { key: "hp", name: "Leben", blurb: "+18 HP je Rang" },
  { key: "dmg", name: "Schaden", blurb: "+6% je Rang" },
  { key: "spd", name: "Tempo", blurb: "+3,5% je Rang" },
  { key: "mag", name: "Magnet", blurb: "+16 Reichweite" },
  { key: "start", name: "Startstab", blurb: "+1 Stern am Stab" },
];

type Props = {
  meta: Meta;
  panel: Exclude<Panel, "castle">;
  onPanel: (panel: Panel) => void;
  onMeta: (next: Meta) => void;
  onStart: (chapter: number) => void;
  onPrime: () => void;
};

/** Hauptmenü mit seinen Unterseiten (Optionen, Shop, Skins, Werkstatt). */
export function MenuScreen({ meta, panel, onPanel, onMeta, onStart, onPrime }: Props) {
  // Läden rechnen mit `shop`; im Testmodus ist dort unbegrenzt Gold, das echte bleibt.
  const shop = spendable(meta);
  const apply = (next: Meta | null) => {
    if (next) onMeta(settle(meta, next));
  };
  return (
    <section className={panel === "shop" ? "poster" : "poster poster-home"} onPointerDown={onPrime}>
      <p className="text-xs font-bold tracking-[0.22em] text-muted">HEXENMEISTER</p>
      <h1 className="logo">VISIER</h1>
      {panel !== "shop" && (
        <p className="max-w-[22rem] text-base leading-snug font-medium">
          Eine Hand bewegt. Der Stab schießt von allein.
        </p>
      )}
      {panel === "home" && <Home meta={meta} onPanel={onPanel} onMeta={onMeta} onStart={onStart} />}
      {panel === "options" && <Options meta={meta} onMeta={onMeta} onBack={() => onPanel("home")} />}
      {panel === "market" && <Market meta={shop} apply={apply} onBack={() => onPanel("home")} />}
      {panel === "skins" && <Skins meta={shop} apply={apply} onBack={() => onPanel("home")} />}
      {panel === "shop" && <Workshop meta={shop} apply={apply} onBack={() => onPanel("home")} />}
    </section>
  );
}

function Home({ meta, onPanel, onMeta, onStart }: Pick<Props, "meta" | "onPanel" | "onMeta" | "onStart">) {
  const chapter = chapterUnlocked(meta, meta.selectedChapter) ? meta.selectedChapter : 1;
  return (
    <>
      <div className="flex gap-2">
        {CHAPTERS.map((ch) => {
          const open = chapterUnlocked(meta, ch.id);
          return (
            <button
              key={ch.id}
              type="button"
              className={chapter === ch.id ? "chapter on" : "chapter"}
              disabled={!open}
              onClick={() => onMeta({ ...meta, selectedChapter: ch.id })}
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
      {/* Hauptmodus: das Glutreich (Burg). Der Survivor-Lauf startet über „Überleben“. */}
      <button type="button" className="btn btn-go btn-hero" onClick={() => onPanel("castle")}>
        <Castle size={30} strokeWidth={2.6} aria-hidden />
        <span>Glutreich</span>
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-pink" onClick={() => onStart(chapter)}>
          Überleben
        </button>
        <button type="button" className="btn btn-ink" onClick={() => onPanel("market")}>
          Shop
        </button>
        <button type="button" className="btn btn-ink" onClick={() => onPanel("skins")}>
          Skins
        </button>
        <button type="button" className="btn btn-ink" onClick={() => onPanel("options")}>
          Optionen
        </button>
      </div>
      <div className="flex items-center justify-between text-sm font-bold">
        <span className="tabular-nums">{meta.test ? "∞ Gold · Testmodus" : `${meta.coins} Gold`}</span>
        <span>{meta.runs} Läufe</span>
      </div>
      <button type="button" className="btn btn-ink mt-auto" onClick={() => onPanel("shop")}>
        Fähigkeiten
      </button>
    </>
  );
}

function Toggle({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="opt-row" aria-pressed={on} onClick={onToggle}>
      <span>{label}</span>
      <span className={on ? "switch on" : "switch"}>{on ? "An" : "Aus"}</span>
    </button>
  );
}

function Options({ meta, onMeta, onBack }: { meta: Meta; onMeta: (m: Meta) => void; onBack: () => void }) {
  return (
    <>
      <h2 className="font-display text-3xl leading-none">Optionen</h2>
      <Toggle label="Musik" on={meta.music} onToggle={() => onMeta({ ...meta, music: !meta.music })} />
      <Toggle
        label="Effekte"
        on={meta.sfxOn}
        onToggle={() => onMeta({ ...meta, sfxOn: !meta.sfxOn, mute: meta.sfxOn })}
      />
      <Toggle label="Wackeln" on={meta.shake} onToggle={() => onMeta({ ...meta, shake: !meta.shake })} />
      <Toggle
        label="Testmodus: unendlich Gold & Rohstoffe"
        on={meta.test}
        onToggle={() => onMeta({ ...meta, test: !meta.test })}
      />
      <p className="text-sm font-medium text-muted">
        Musik und Effekte laufen getrennt. Im Testmodus kostet nichts; dein echtes Gold und deine Rohstoffe bleiben
        dabei unverändert und sind nach dem Ausschalten wieder da.
      </p>
      <button type="button" className="btn btn-go mt-auto" onClick={onBack}>
        Zurück
      </button>
    </>
  );
}

type ShopProps = { meta: Meta; apply: (next: Meta | null) => void; onBack: () => void };

function Header({ title, coins }: { title: string; coins: number }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="font-display text-3xl leading-none">{title}</h2>
      <span className="font-display text-2xl leading-none tabular-nums">{coins >= UNLIMITED ? "∞" : coins} G</span>
    </div>
  );
}

function Market({ meta, apply, onBack }: ShopProps) {
  return (
    <>
      <Header title="Shop" coins={meta.coins} />
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
                onClick={() => apply(buySkin(meta, skin.id))}
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
        onClick={() => apply(buyBooster(meta))}
      >
        Booster-Pack {meta.castle.boosters}/{BOOSTER_CAP} · {BOOSTER_COST}
      </button>
      <p className="text-xs font-medium text-muted">Jedes Pack macht die Türme deiner Burg 10 % stärker.</p>
      <button type="button" className="btn btn-ink" onClick={onBack}>
        Zurück
      </button>
    </>
  );
}

function Skins({ meta, apply, onBack }: ShopProps) {
  return (
    <>
      <Header title="Skins" coins={meta.coins} />
      <p className="text-sm font-medium text-muted">
        Mauer-Skins gelten bis Schloss-Stufe 4. Danach trägt die Mauer den Stil des Schlosses (Gift, Eis, Feuer,
        Mordor).
      </p>
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
              onClick={() => apply(equipSkin(meta, skin.id))}
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
      <button type="button" className="btn btn-ink" onClick={onBack}>
        Zurück
      </button>
    </>
  );
}

function Workshop({ meta, apply, onBack }: ShopProps) {
  const [tab, setTab] = useState<"skills" | "train">("skills");
  return (
    <>
      <Header title="Werkstatt" coins={meta.coins} />
      <p className="text-sm font-medium">100 Gold je Minute, Beute ab Minute 3, 250 je Boss. Stufen bleiben.</p>
      <div className="flex gap-2">
        <button type="button" className={tab === "skills" ? "chapter on" : "chapter"} onClick={() => setTab("skills")}>
          <span className="font-display text-lg leading-none">Fähigkeiten</span>
        </button>
        <button type="button" className={tab === "train" ? "chapter on" : "chapter"} onClick={() => setTab("train")}>
          <span className="font-display text-lg leading-none">Training</span>
        </button>
      </div>
      {tab === "skills" ? (
        <ul className="shop-list">
          {[...WEAPON_IDS, ...PASSIVE_IDS].map((id) => {
            const rank = meta.skills[id] ?? 0;
            const full = rank >= SKILL_CAP;
            const cost = skillCost(rank);
            return (
              <li key={id} className="shop-row">
                <span className="skill-ico sm">
                  <SkillIcon id={id} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold leading-tight">{INFO[id].name}</p>
                  <p className="text-xs font-medium text-muted">{full ? "Maximum" : nextPermLabel(id, rank)}</p>
                  <Pips n={rank} max={SKILL_CAP} />
                </div>
                <button
                  type="button"
                  className="btn btn-go btn-sm"
                  disabled={full || meta.coins < cost}
                  onClick={() => apply(buySkill(meta, id))}
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
                    onClick={() => apply(buyRank(meta, row.key))}
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
              return (
                <div key={slot} className="frame">
                  <p>{SLOT_NAME[slot]}</p>
                  <p className="text-muted">{item ? RARITY_NAME[item.rarity] : "Leer"}</p>
                  <p>{gearLine(item)}</p>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="btn btn-pink"
            disabled={meta.coins < gearCost(meta.gearRolls)}
            onClick={() => apply(rollGear(meta))}
          >
            Ausrüstung {gearCost(meta.gearRolls)}
          </button>
          <p className="text-xs font-medium text-muted">
            Ein schwächeres Teil ersetzt deins nicht; dann gibt es 20 % zurück.
          </p>
        </>
      )}
      <button type="button" className="btn btn-ghost" onClick={onBack}>
        Zurück
      </button>
    </>
  );
}
