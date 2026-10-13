import { Coins, Heart, Magnet, Rocket, Star, Sword, Zap } from "lucide-react";
import { INFO, type Sym } from "@/game/content";
import { SkillIcon } from "@/game/icons";

/** Stufenpunkte, z. B. 3 von 5. */
export function Pips({ n, max }: { n: number; max: number }) {
  if (max <= 0) return null;
  return (
    <span className="flex gap-1" aria-hidden>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < n ? "pip on" : "pip"} />
      ))}
    </span>
  );
}

export function SymMark({ sym, className }: { sym: Sym; className?: string }) {
  const props = { className, strokeWidth: 2.4, "aria-hidden": true as const };
  if (sym === "sword" || sym === "blade") return <Sword {...props} />;
  if (sym === "magnet") return <Magnet {...props} />;
  if (sym === "rocket") return <Rocket {...props} />;
  if (sym === "heart") return <Heart {...props} />;
  if (sym === "star") return <Star {...props} />;
  if (sym === "coin") return <Coins {...props} />;
  return <Zap {...props} />;
}

/** Sechs Plätze für Waffen oder Passive in der unteren Leiste. */
export function Slots({ items }: { items: { id: string; star: number }[] }) {
  return (
    <div className="chip-row">
      {Array.from({ length: 6 }, (_, i) => {
        const it = items[i];
        if (!it) return <div key={`empty-${i}`} className="chip empty" />;
        const info = INFO[it.id];
        return (
          <div key={it.id} className={info?.tone === "evo" ? "chip evo" : "chip"} title={info?.name ?? it.id}>
            <SkillIcon id={it.id} className="chip-ico" />
            <span className="tabular-nums">{it.star}</span>
          </div>
        );
      })}
    </div>
  );
}
