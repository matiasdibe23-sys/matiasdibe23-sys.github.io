"use client";

import { useId } from "react";

// ── Kit data embebido (idéntico a kits_templates en la DB) ────────
// Clave = pais_codigo_iso de selecciones_nacionales
export const KIT_DATA: Record<string, { p: string; s: string; c: string; pat: KitPattern }> = {
  dz:     { p:"#007749", s:"#FFFFFF", c:"#005a37", pat:"solid"    },
  ar:     { p:"#74ACDF", s:"#FFFFFF", c:"#5090c0", pat:"stripes_v"},
  au:     { p:"#FFD700", s:"#006400", c:"#d4b800", pat:"solid"    },
  at:     { p:"#ED2939", s:"#FFFFFF", c:"#c0202f", pat:"stripes_h"},
  be:     { p:"#000000", s:"#FDDA24", c:"#111111", pat:"stripes_v"},
  ba:     { p:"#003DA5", s:"#FFCD00", c:"#002d7a", pat:"solid"    },
  br:     { p:"#009B3A", s:"#FEDF00", c:"#007a2d", pat:"solid"    },
  cv:     { p:"#003893", s:"#CF1126", c:"#002870", pat:"solid"    },
  ca:     { p:"#FF0000", s:"#FFFFFF", c:"#cc0000", pat:"solid"    },
  co:     { p:"#FDD116", s:"#003087", c:"#d4b200", pat:"solid"    },
  cd:     { p:"#007FFF", s:"#F7D618", c:"#0063c6", pat:"solid"    },
  ci:     { p:"#F77F00", s:"#FFFFFF", c:"#d46a00", pat:"stripes_v"},
  hr:     { p:"#FF2020", s:"#FFFFFF", c:"#cc0000", pat:"checkers" },
  cw:     { p:"#003DA5", s:"#F9E814", c:"#002d7a", pat:"solid"    },
  cz:     { p:"#D7141A", s:"#FFFFFF", c:"#b01015", pat:"stripes_h"},
  ec:     { p:"#FFD100", s:"#003DA5", c:"#d4af00", pat:"stripes_h"},
  eg:     { p:"#C8102E", s:"#FFFFFF", c:"#a00d24", pat:"solid"    },
  "gb-eng":{ p:"#FFFFFF", s:"#CF081F", c:"#cccccc", pat:"solid"   },
  fr:     { p:"#002395", s:"#FFFFFF", c:"#001a70", pat:"solid"    },
  de:     { p:"#FFFFFF", s:"#000000", c:"#cccccc", pat:"solid"    },
  gh:     { p:"#FFFFFF", s:"#006B3F", c:"#e0e0e0", pat:"solid"    },
  ht:     { p:"#00209F", s:"#D21034", c:"#001880", pat:"stripes_h"},
  ir:     { p:"#239F40", s:"#FFFFFF", c:"#1a7d30", pat:"stripes_h"},
  iq:     { p:"#FFFFFF", s:"#CE1126", c:"#e0e0e0", pat:"solid"    },
  jp:     { p:"#1A2F5E", s:"#FFFFFF", c:"#0f1f3e", pat:"solid"    },
  jo:     { p:"#007A3D", s:"#FFFFFF", c:"#005e2f", pat:"solid"    },
  kr:     { p:"#FFFFFF", s:"#CD2E3A", c:"#e0e0e0", pat:"solid"    },
  mx:     { p:"#006847", s:"#FFFFFF", c:"#004f36", pat:"solid"    },
  ma:     { p:"#C1272D", s:"#006233", c:"#9a1e24", pat:"solid"    },
  nl:     { p:"#FF6600", s:"#FFFFFF", c:"#cc5200", pat:"solid"    },
  nz:     { p:"#FFFFFF", s:"#000000", c:"#e0e0e0", pat:"solid"    },
  no:     { p:"#EF2B2D", s:"#FFFFFF", c:"#bf2224", pat:"solid"    },
  pa:     { p:"#FFFFFF", s:"#DA121A", c:"#e0e0e0", pat:"solid"    },
  py:     { p:"#D52B1E", s:"#FFFFFF", c:"#aa2218", pat:"stripes_h"},
  pt:     { p:"#006600", s:"#FF0000", c:"#004d00", pat:"halves_v" },
  qa:     { p:"#8D1B3D", s:"#FFFFFF", c:"#6e1530", pat:"solid"    },
  sa:     { p:"#FFFFFF", s:"#006C35", c:"#e0e0e0", pat:"solid"    },
  "gb-sct":{ p:"#003B8E", s:"#FFFFFF", c:"#002d6e", pat:"solid"   },
  sn:     { p:"#00853F", s:"#FDEF42", c:"#006830", pat:"solid"    },
  za:     { p:"#007A4D", s:"#FFB81C", c:"#005e3b", pat:"solid"    },
  es:     { p:"#AA151B", s:"#F1BF00", c:"#881118", pat:"solid"    },
  se:     { p:"#006AA7", s:"#FECC02", c:"#004e7d", pat:"solid"    },
  ch:     { p:"#FF0000", s:"#FFFFFF", c:"#cc0000", pat:"solid"    },
  tn:     { p:"#E70013", s:"#FFFFFF", c:"#b8000f", pat:"solid"    },
  tr:     { p:"#E30A17", s:"#FFFFFF", c:"#b50812", pat:"solid"    },
  uy:     { p:"#5EB6E4", s:"#FFFFFF", c:"#4a91b8", pat:"solid"    },
  us:     { p:"#002868", s:"#BF0A30", c:"#001f52", pat:"solid"    },
  uz:     { p:"#1EB53A", s:"#FFFFFF", c:"#189030", pat:"stripes_h"},
};

// Fallback kit cuando no hay ISO o no está en el mapa
const FALLBACK_KIT = { p:"#475569", s:"#94a3b8", c:"#334155", pat:"solid" as KitPattern };

export type KitPattern = "solid" | "stripes_v" | "stripes_h" | "checkers" | "halves_v" | "hoops";

// ── Paths del SVG de la camiseta (viewBox 0 0 100 110) ────────────
const JERSEY   = "M 34 4 Q 50 22 66 4 L 87 10 L 99 27 L 96 42 L 76 39 L 76 106 L 24 106 L 24 39 L 4 42 L 1 27 L 13 10 Z";
const L_CUFF   = "M 1 27 L 4 42 L 9 41 L 6 27 Z";
const R_CUFF   = "M 91 27 L 94 41 L 99 42 L 96 27 Z";
const COLLAR   = "M 36 6 L 50 22 L 64 6";
// Highlight (sheen) en parte superior de la camiseta
const SHEEN    = "M 42 6 Q 50 15 58 6 L 72 10 L 74 22 L 26 22 L 28 10 Z";

interface NationalKitIconProps {
  isoCode: string | null | undefined;
  dorsal?: number | null;
  size?: number;
  highlighted?: boolean;
}

export default function NationalKitIcon({
  isoCode, dorsal, size = 50, highlighted = false,
}: NationalKitIconProps) {
  const uid = useId().replace(/:/g, "");
  const kit = (isoCode && KIT_DATA[isoCode]) ? KIT_DATA[isoCode] : FALLBACK_KIT;

  const fillId  = `kit_fill_${uid}`;
  const glowId  = `kit_glow_${uid}`;

  // ── Definición del fill según patrón ─────────────────────────────
  let fillDef: React.ReactNode;
  let bodyFill: string;

  switch (kit.pat) {
    case "stripes_v":
      bodyFill = `url(#${fillId})`;
      fillDef = (
        <pattern id={fillId} x="0" y="0" width="14" height="110" patternUnits="userSpaceOnUse">
          <rect width="7"  height="110" fill={kit.p} />
          <rect x="7" width="7" height="110" fill={kit.s} />
        </pattern>
      );
      break;
    case "stripes_h":
      bodyFill = `url(#${fillId})`;
      fillDef = (
        <pattern id={fillId} x="0" y="0" width="100" height="14" patternUnits="userSpaceOnUse">
          <rect width="100" height="7"  fill={kit.p} />
          <rect y="7" width="100" height="7" fill={kit.s} />
        </pattern>
      );
      break;
    case "checkers":
      bodyFill = `url(#${fillId})`;
      fillDef = (
        <pattern id={fillId} x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill={kit.p} />
          <rect x="6" width="6" height="6" fill={kit.s} />
          <rect y="6" width="6" height="6" fill={kit.s} />
          <rect x="6" y="6" width="6" height="6" fill={kit.p} />
        </pattern>
      );
      break;
    case "halves_v":
      bodyFill = `url(#${fillId})`;
      fillDef = (
        <linearGradient id={fillId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="50%" stopColor={kit.p} />
          <stop offset="50%" stopColor={kit.s} />
        </linearGradient>
      );
      break;
    case "hoops":
      bodyFill = `url(#${fillId})`;
      fillDef = (
        <pattern id={fillId} x="0" y="0" width="100" height="22" patternUnits="userSpaceOnUse">
          <rect width="100" height="11" fill={kit.p} />
          <rect y="11" width="100" height="11" fill={kit.s} />
        </pattern>
      );
      break;
    default: // solid
      bodyFill = kit.p;
      fillDef = null;
      break;
  }

  const scale = size / 100;

  return (
    <svg
      viewBox="0 0 100 110"
      width={size}
      height={size * 1.1}
      style={{ filter: highlighted
        ? "drop-shadow(0 0 6px rgba(255,255,255,0.7))"
        : "drop-shadow(0 2px 4px rgba(0,0,0,0.6))"
      }}
      aria-hidden="true"
    >
      <defs>
        {fillDef}
        {/* Glow filter for highlighted state */}
        <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* ── Cuerpo principal ── */}
      <path d={JERSEY} fill={bodyFill} stroke={kit.c} strokeWidth="1.5" />

      {/* ── Mangas (color secundario) ── */}
      <path d={L_CUFF} fill={kit.s} stroke={kit.c} strokeWidth="1" />
      <path d={R_CUFF} fill={kit.s} stroke={kit.c} strokeWidth="1" />

      {/* ── Cuello V ── */}
      <path d={COLLAR} fill="none" stroke={kit.s} strokeWidth="2" strokeLinecap="round" />

      {/* ── Brillo/sheen ── */}
      <path d={SHEEN} fill="rgba(255,255,255,0.07)" />

      {/* ── Dorsal ── */}
      {dorsal != null && (
        <text
          x="50"
          y="82"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={dorsal >= 10 ? "20" : "24"}
          fontWeight="900"
          fontFamily="system-ui, sans-serif"
          fill={kit.s}
          stroke={kit.c}
          strokeWidth="0.5"
          paintOrder="stroke"
        >
          {dorsal}
        </text>
      )}
    </svg>
  );
}
