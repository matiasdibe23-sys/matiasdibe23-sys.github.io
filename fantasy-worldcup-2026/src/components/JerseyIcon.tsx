import type { PosicionJugador } from "@/types/database.types";

const JERSEY_COLORS: Record<
  PosicionJugador,
  { body: string; sleeves: string; collar: string; text: string; stroke: string }
> = {
  POR: { body: "#f59e0b", sleeves: "#d97706", collar: "#78350f", text: "#000000", stroke: "#d97706" },
  DEF: { body: "#3b82f6", sleeves: "#1d4ed8", collar: "#1e3a8a", text: "#ffffff", stroke: "#2563eb" },
  MED: { body: "#8b5cf6", sleeves: "#6d28d9", collar: "#3b0764", text: "#ffffff", stroke: "#7c3aed" },
  DEL: { body: "#ef4444", sleeves: "#b91c1c", collar: "#7f1d1d", text: "#ffffff", stroke: "#dc2626" },
};

// Realistic jersey path — viewBox 0 0 100 110
// Body: x24-x76, Sleeves extend to x1/x99, V-neck collar
const JERSEY =
  "M 34 4 Q 50 22 66 4 L 87 10 L 99 27 L 96 42 L 76 39 L 76 106 L 24 106 L 24 39 L 4 42 L 1 27 L 13 10 Z";

// Sleeve bands (cuffs) for detail
const LEFT_CUFF  = "M 1 27 L 4 42 L 9 41 L 6 27 Z";
const RIGHT_CUFF = "M 91 27 L 94 41 L 99 42 L 96 27 Z";

interface JerseyIconProps {
  posicion: PosicionJugador;
  dorsal?: number | null;
  size?: number;
  highlighted?: boolean;
  muted?: boolean;
}

export default function JerseyIcon({
  posicion,
  dorsal,
  size = 48,
  highlighted = false,
  muted = false,
}: JerseyIconProps) {
  const { body, sleeves, collar, text, stroke } = JERSEY_COLORS[posicion];
  const h = Math.round(size * 1.1);
  const label = dorsal != null ? String(dorsal) : posicion[0];
  const fontSize = dorsal != null && dorsal >= 10 ? 21 : 24;

  return (
    <svg
      viewBox="0 0 100 110"
      width={size}
      height={h}
      style={{
        opacity: muted ? 0.3 : 1,
        overflow: "visible",
        filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
      }}
    >
      {/* Jersey body */}
      <path
        d={JERSEY}
        fill={body}
        stroke={highlighted ? "#ffffff" : stroke}
        strokeWidth={highlighted ? 3 : 1.5}
      />

      {/* Sleeve cuffs (darker) */}
      <path d={LEFT_CUFF}  fill={sleeves} opacity="0.9" />
      <path d={RIGHT_CUFF} fill={sleeves} opacity="0.9" />

      {/* Collar — V-neck band */}
      <path
        d="M 36 6 L 50 22 L 64 6"
        fill="none"
        stroke={collar}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Collar shine */}
      <path
        d="M 37 7 L 50 21 L 63 7"
        fill="none"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Body sheen — vertical highlight */}
      <path
        d="M 44 42 L 44 100"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="8"
      />

      {/* Dorsal number */}
      <text
        x="50"
        y="84"
        textAnchor="middle"
        fill={text}
        fontSize={fontSize}
        fontWeight="900"
        fontFamily="system-ui, -apple-system, Arial Black, sans-serif"
        style={{ userSelect: "none", paintOrder: "stroke" }}
        stroke="rgba(0,0,0,0.2)"
        strokeWidth="1"
      >
        {label}
      </text>

      {/* Highlight ring when drag target */}
      {highlighted && (
        <>
          <path
            d={JERSEY}
            fill="none"
            stroke="white"
            strokeWidth="3"
            opacity="0.7"
          />
          <path
            d={JERSEY}
            fill="white"
            opacity="0.15"
          />
        </>
      )}
    </svg>
  );
}
