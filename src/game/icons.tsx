type Props = { id: string; className?: string };

const ink = "#1a120c";

export function SkillIcon({ id, className }: Props) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <Body id={id} />
    </svg>
  );
}

function Body({ id }: { id: string }) {
  switch (id) {
    case "staff":
      return (
        <>
          <rect x="30" y="18" width="6" height="38" rx="2" fill="#3a3538" stroke={ink} strokeWidth="3" />
          <path d="M24 20 L33 6 L42 20 Z" fill="#4a4448" stroke={ink} strokeWidth="3" />
          <path d="M33 4 L39 14 L33 20 L27 14 Z" fill="#ff2a2a" stroke={ink} strokeWidth="3" />
        </>
      );
    case "mace":
      return (
        <>
          <rect x="30" y="28" width="6" height="28" rx="2" fill="#2a2a2e" stroke={ink} strokeWidth="3" />
          <path d="M33 8 L40 16 L48 14 L42 22 L50 28 L40 30 L44 40 L33 32 L22 40 L26 30 L16 28 L24 22 L18 14 L26 16 Z" fill="#2a2a2e" stroke={ink} strokeWidth="3" />
          <ellipse cx="33" cy="24" rx="5" ry="7" fill="#ff1a1a" stroke={ink} strokeWidth="3" />
        </>
      );
    case "katana":
      return (
        <>
          <path d="M14 50 L46 14" stroke="#fff6ea" strokeWidth="8" strokeLinecap="round" />
          <path d="M14 50 L46 14" stroke={ink} strokeWidth="3" strokeLinecap="round" />
          <rect x="40" y="28" width="12" height="8" rx="2" transform="rotate(-42 46 32)" fill="#ff3d81" stroke={ink} strokeWidth="3" />
        </>
      );
    case "demon":
      return (
        <>
          <path d="M10 52 L50 10" stroke="#ff3d81" strokeWidth="12" strokeLinecap="round" />
          <path d="M10 52 L50 10" stroke={ink} strokeWidth="3" strokeLinecap="round" />
          <path d="M18 28 L28 18" stroke="#ffd000" strokeWidth="4" strokeLinecap="round" />
        </>
      );
    case "shotgun":
      return (
        <>
          <rect x="10" y="28" width="36" height="12" rx="3" fill="#ffd000" stroke={ink} strokeWidth="3" />
          <rect x="40" y="24" width="12" height="6" rx="2" fill="#fff6ea" stroke={ink} strokeWidth="3" />
          <rect x="18" y="40" width="10" height="8" rx="2" fill="#e0233a" stroke={ink} strokeWidth="3" />
        </>
      );
    case "gatling":
      return (
        <>
          <rect x="8" y="22" width="40" height="22" rx="4" fill="#3a424c" stroke={ink} strokeWidth="3" />
          <rect x="40" y="18" width="16" height="5" rx="2" fill="#ffd000" stroke={ink} strokeWidth="3" />
          <rect x="40" y="26" width="16" height="5" rx="2" fill="#ffd000" stroke={ink} strokeWidth="3" />
          <rect x="40" y="34" width="16" height="5" rx="2" fill="#ffd000" stroke={ink} strokeWidth="3" />
          <circle cx="18" cy="33" r="4" fill="#ff3d81" stroke={ink} strokeWidth="3" />
        </>
      );
    case "kunai":
      return (
        <>
          <path d="M32 8 L40 40 L32 36 L24 40 Z" fill="#fff6ea" stroke={ink} strokeWidth="3" />
          <rect x="29" y="38" width="6" height="16" rx="2" fill="#2f6bff" stroke={ink} strokeWidth="3" />
        </>
      );
    case "shuriken":
      return (
        <>
          <path d="M32 6 L38 26 L58 32 L38 38 L32 58 L26 38 L6 32 L26 26 Z" fill="#7ef0ff" stroke={ink} strokeWidth="3" />
          <circle cx="32" cy="32" r="5" fill="#ff3d81" stroke={ink} strokeWidth="3" />
        </>
      );
    case "guardian":
      return (
        <>
          <circle cx="32" cy="32" r="16" fill="#8eb6ff" stroke={ink} strokeWidth="4" />
          <circle cx="32" cy="32" r="6" fill="#2f6bff" stroke={ink} strokeWidth="3" />
        </>
      );
    case "starwheel":
      return (
        <>
          <path d="M32 6 L38 24 L58 24 L42 36 L48 56 L32 44 L16 56 L22 36 L6 24 L26 24 Z" fill="#ffd000" stroke={ink} strokeWidth="3" />
        </>
      );
    case "force":
      return (
        <>
          <circle cx="32" cy="32" r="18" fill="none" stroke="#2f6bff" strokeWidth="8" />
          <circle cx="32" cy="32" r="18" fill="none" stroke={ink} strokeWidth="3" />
          <circle cx="32" cy="32" r="5" fill="#ffd000" stroke={ink} strokeWidth="3" />
        </>
      );
    case "aegis":
      return (
        <>
          <circle cx="32" cy="32" r="22" fill="none" stroke="#ff3d81" strokeWidth="8" />
          <circle cx="32" cy="32" r="22" fill="none" stroke={ink} strokeWidth="3" />
          <circle cx="32" cy="32" r="12" fill="none" stroke="#ffd000" strokeWidth="5" />
          <circle cx="32" cy="32" r="4" fill="#fff6ea" stroke={ink} strokeWidth="3" />
        </>
      );
    case "molotov":
      return (
        <>
          <path d="M26 30 L24 50 H40 L38 30 Z" fill="#3dce6a" stroke={ink} strokeWidth="3" />
          <rect x="28" y="22" width="8" height="10" fill="#fff6ea" stroke={ink} strokeWidth="3" />
          <path d="M32 8 C36 16 28 18 32 24 C40 16 36 10 32 8 Z" fill="#ff6a2a" stroke={ink} strokeWidth="3" />
        </>
      );
    case "inferno":
      return (
        <>
          <path d="M32 6 C44 22 50 28 46 42 C42 54 22 54 18 42 C14 28 22 20 26 28 C28 16 30 12 32 6 Z" fill="#ff6a2a" stroke={ink} strokeWidth="3" />
          <path d="M32 24 C36 32 38 36 36 44 C30 48 26 42 28 34 C28 30 30 26 32 24 Z" fill="#ffd000" stroke={ink} strokeWidth="3" />
        </>
      );
    case "lightning":
      return <path d="M36 4 L18 34 H30 L24 60 L48 26 H34 Z" fill="#ffd000" stroke={ink} strokeWidth="3" />;
    case "storm":
      return (
        <>
          <path d="M28 6 L14 32 H24 L20 52 L38 24 H28 Z" fill="#ffd000" stroke={ink} strokeWidth="3" />
          <path d="M40 14 L30 36 H38 L34 58 L52 30 H42 Z" fill="#7ef0ff" stroke={ink} strokeWidth="3" />
        </>
      );
    case "drones":
      return (
        <>
          <rect x="22" y="26" width="20" height="14" rx="3" fill="#d7fff6" stroke={ink} strokeWidth="3" />
          <circle cx="16" cy="22" r="6" fill="#fff6ea" stroke={ink} strokeWidth="3" />
          <circle cx="48" cy="22" r="6" fill="#fff6ea" stroke={ink} strokeWidth="3" />
          <rect x="28" y="30" width="8" height="5" fill="#e0233a" />
        </>
      );
    case "titan":
      return (
        <>
          <rect x="16" y="24" width="32" height="20" rx="4" fill="#ff3d81" stroke={ink} strokeWidth="4" />
          <circle cx="12" cy="18" r="8" fill="#ffd000" stroke={ink} strokeWidth="3" />
          <circle cx="52" cy="18" r="8" fill="#ffd000" stroke={ink} strokeWidth="3" />
          <circle cx="14" cy="48" r="7" fill="#fff6ea" stroke={ink} strokeWidth="3" />
          <circle cx="50" cy="48" r="7" fill="#fff6ea" stroke={ink} strokeWidth="3" />
          <rect x="26" y="30" width="12" height="7" fill="#ffd000" stroke={ink} strokeWidth="3" />
        </>
      );
    case "boomerang":
      return (
        <path
          d="M18 46 C10 28 22 10 40 14 C30 18 28 26 34 30 C42 22 54 28 48 42 C40 36 30 40 18 46 Z"
          fill="#ffd000"
          stroke={ink}
          strokeWidth="3"
        />
      );
    case "magnetboom":
      return (
        <>
          <path d="M14 48 C8 26 24 8 44 16 C32 18 30 28 38 32 C46 22 56 32 48 46 C38 38 26 42 14 48 Z" fill="#ff3d81" stroke={ink} strokeWidth="3" />
          <path d="M46 18 V30 M40 22 H52" stroke="#ffd000" strokeWidth="4" strokeLinecap="round" />
        </>
      );
    case "soccer":
      return (
        <>
          <circle cx="32" cy="32" r="18" fill="#fff6ea" stroke={ink} strokeWidth="4" />
          <path d="M32 20 L38 30 L32 34 L26 30 Z" fill={ink} />
        </>
      );
    case "comet":
      return (
        <>
          <path d="M8 40 L30 28 L22 18" stroke="#ffd000" strokeWidth="8" strokeLinecap="round" />
          <circle cx="40" cy="26" r="14" fill="#ff6a2a" stroke={ink} strokeWidth="4" />
        </>
      );
    case "boots":
      return (
        <>
          <path d="M16 16 H30 V36 H44 V48 H14 Z" fill="#ffd000" stroke={ink} strokeWidth="3" />
          <path d="M34 22 H46 V40 H34" fill="#ff3d81" stroke={ink} strokeWidth="3" />
        </>
      );
    case "glove":
      return <path d="M18 36 V22 H24 V14 H30 V22 H34 V12 H40 V22 H44 V16 H50 V40 C50 50 18 52 18 36 Z" fill="#ff3d81" stroke={ink} strokeWidth="3" />;
    case "chrono":
      return (
        <>
          <circle cx="32" cy="34" r="16" fill="#fff6ea" stroke={ink} strokeWidth="4" />
          <path d="M32 34 L32 22 M32 34 L42 38" stroke={ink} strokeWidth="3" strokeLinecap="round" />
          <rect x="28" y="12" width="8" height="6" fill="#2f6bff" stroke={ink} strokeWidth="3" />
        </>
      );
    case "magnet":
      return <path d="M16 18 H28 V34 C28 42 36 42 36 34 V18 H48 V36 C48 52 16 52 16 36 Z" fill="#e0233a" stroke={ink} strokeWidth="3" />;
    case "heart":
      return <path d="M32 52 L12 32 C6 24 12 12 22 14 C28 16 32 22 32 22 C32 22 36 16 42 14 C52 12 58 24 52 32 Z" fill="#ff3d81" stroke={ink} strokeWidth="3" />;
    case "lens":
      return (
        <>
          <circle cx="28" cy="28" r="14" fill="#7ef0ff" stroke={ink} strokeWidth="4" />
          <path d="M38 38 L52 52" stroke={ink} strokeWidth="6" strokeLinecap="round" />
        </>
      );
    case "blood":
      return <path d="M32 8 C44 24 52 30 48 42 C44 54 20 54 16 42 C12 30 22 22 32 8 Z" fill="#e0233a" stroke={ink} strokeWidth="3" />;
    case "ammo":
      return (
        <>
          <rect x="8" y="26" width="48" height="14" rx="7" fill="#c9a227" stroke={ink} strokeWidth="3" />
          <rect x="16" y="22" width="6" height="22" rx="2" fill="#ffd000" stroke={ink} strokeWidth="3" />
          <rect x="28" y="20" width="6" height="24" rx="2" fill="#ffd000" stroke={ink} strokeWidth="3" />
          <rect x="40" y="22" width="6" height="22" rx="2" fill="#ffd000" stroke={ink} strokeWidth="3" />
        </>
      );
    case "scroll":
      return (
        <>
          <rect x="16" y="12" width="32" height="40" rx="4" fill="#fff6ea" stroke={ink} strokeWidth="3" />
          <path d="M22 24 H42 M22 32 H42 M22 40 H34" stroke={ink} strokeWidth="3" strokeLinecap="round" />
        </>
      );
    case "scope":
      return (
        <>
          <circle cx="32" cy="32" r="16" fill="none" stroke="#ffd000" strokeWidth="6" />
          <circle cx="32" cy="32" r="16" fill="none" stroke={ink} strokeWidth="3" />
          <path d="M32 12 V22 M32 42 V52 M12 32 H22 M42 32 H52" stroke={ink} strokeWidth="3" />
          <circle cx="32" cy="32" r="3" fill="#e0233a" />
        </>
      );
    case "plate":
      return <path d="M32 8 L52 16 V32 C52 46 32 56 32 56 C32 56 12 46 12 32 V16 Z" fill="#8eb6ff" stroke={ink} strokeWidth="3" />;
    case "purse":
      return (
        <>
          <circle cx="32" cy="34" r="16" fill="#ffd000" stroke={ink} strokeWidth="4" />
          <rect x="28" y="14" width="8" height="10" rx="2" fill="#ff3d81" stroke={ink} strokeWidth="3" />
          <text x="32" y="40" textAnchor="middle" fontSize="16" fontWeight="700" fill={ink}>
            G
          </text>
        </>
      );
    case "coins":
      return (
        <>
          <circle cx="26" cy="36" r="12" fill="#ffd000" stroke={ink} strokeWidth="3" />
          <circle cx="38" cy="28" r="12" fill="#ffe56a" stroke={ink} strokeWidth="3" />
        </>
      );
    case "heal":
      return (
        <>
          <rect x="26" y="10" width="12" height="44" rx="3" fill="#fff6ea" stroke={ink} strokeWidth="3" />
          <rect x="10" y="26" width="44" height="12" rx="3" fill="#3dce6a" stroke={ink} strokeWidth="3" />
        </>
      );
    case "tank":
      return (
        <>
          <rect x="8" y="28" width="40" height="18" rx="4" fill="#5f6b3a" stroke={ink} strokeWidth="3" />
          <rect x="10" y="22" width="28" height="8" rx="2" fill="#2a3038" stroke={ink} strokeWidth="3" />
          <rect x="10" y="44" width="28" height="8" rx="2" fill="#2a3038" stroke={ink} strokeWidth="3" />
          <circle cx="30" cy="36" r="7" fill="#6d7a42" stroke={ink} strokeWidth="3" />
          <rect x="36" y="33" width="18" height="6" rx="2" fill={ink} />
          <rect x="22" y="33" width="8" height="5" fill="#2f6bff" />
        </>
      );
    case "ufo":
      return (
        <>
          <ellipse cx="32" cy="36" rx="22" ry="10" fill="#d7fff6" stroke={ink} strokeWidth="3" />
          <path d="M20 34 Q32 14 44 34" fill="#8eb6ff" stroke={ink} strokeWidth="3" />
          <circle cx="18" cy="36" r="3" fill="#ff3d81" stroke={ink} strokeWidth="2" />
          <circle cx="32" cy="38" r="3" fill="#ffd000" stroke={ink} strokeWidth="2" />
          <circle cx="46" cy="36" r="3" fill="#ff3d81" stroke={ink} strokeWidth="2" />
          <path d="M26 46 L22 58 H42 L38 46" fill="#ffd000" stroke={ink} strokeWidth="3" />
        </>
      );
    default:
      return <path d="M32 8 L38 26 L58 28 L42 40 L48 58 L32 46 L16 58 L22 40 L6 28 L26 26 Z" fill="#ffd000" stroke={ink} strokeWidth="3" />;
  }
}
