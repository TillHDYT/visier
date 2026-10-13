import { memo } from "react";
import { Pause, TriangleAlert } from "lucide-react";
import { fmtTime } from "@/game/content";
import type { Hud as HudData, Mode } from "@/game/engine";
import { Slots } from "./ui";

function pct(value: number, max: number) {
  return Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
}

type Props = {
  hud: HudData;
  mode: Mode;
  onPause: () => void;
  onBreath: (on: boolean) => void;
};

/** Anzeige während eines Laufs: Zeit, Leisten, Warnungen, Waffenplätze. */
export const Hud = memo(function Hud({ hud, mode, onPause, onBreath }: Props) {
  const playing = mode === "play";
  return (
    <div className="hud">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-baseline justify-between font-display">
            <span className="inked text-lg leading-none">Lv {hud.level}</span>
            <span className="inked tabular-nums text-2xl leading-none">{fmtTime(hud.time)}</span>
            <span className="inked font-sans text-sm font-bold">Welle {hud.waveN}</span>
          </div>
          <div className="bar xp" aria-label="Erfahrung">
            <span style={{ width: `${pct(hud.xp, hud.xpNeed)}%` }} />
          </div>
          <div className="bar hp mt-1" aria-label="Leben">
            <span style={{ width: `${pct(hud.hp, hud.maxHp)}%` }} />
          </div>
          <p className="inked mt-1 text-xs font-bold">
            {hud.wave} · {hud.kills} Kills · {hud.gold} Gold
          </p>
          {hud.boss && (
            <div className="mt-2">
              <p className="inked text-xs font-bold">{hud.boss.name}</p>
              <div className="bar boss">
                <span style={{ width: `${pct(hud.boss.hp, hud.boss.max)}%` }} />
              </div>
            </div>
          )}
        </div>
        {playing && (
          <button type="button" className="icon-btn" aria-label="Pause" onClick={onPause}>
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

      {!hud.moved && playing && !hud.warning && <p className="warn warn-hint">Ziehen zum Laufen</p>}

      {hud.dragon && playing && (
        <button
          type="button"
          className="breath-btn"
          aria-label="Feueratem"
          onPointerDown={(e) => {
            e.preventDefault();
            onBreath(true);
          }}
          onPointerUp={() => onBreath(false)}
          onPointerCancel={() => onBreath(false)}
          onPointerLeave={() => onBreath(false)}
        >
          Atem
        </button>
      )}

      <div className="dock">
        <Slots items={hud.weapons} />
        <Slots items={hud.passives} />
      </div>
    </div>
  );
});
