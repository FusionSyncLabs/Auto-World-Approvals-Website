interface BrandMarkProps {
  className?: string;
  size?: number;
  title?: string;
}

/**
 * Auto World Approvals brand mark.
 * Refined shield with stylized "AW" monogram and an underlying road arc,
 * rendered as crisp SVG for any size (header, favicon, OG).
 */
export function BrandMark({ className = "", size = 40, title }: BrandMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role={title ? "img" : "presentation"}
      aria-label={title}
      className={className}
    >
      <defs>
        <linearGradient id="awa-shield" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0B2A6B" />
          <stop offset="100%" stopColor="#0A1F4F" />
        </linearGradient>
        <linearGradient id="awa-spark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5BA8FF" />
          <stop offset="100%" stopColor="#2E6BFF" />
        </linearGradient>
      </defs>

      {/* Shield */}
      <path
        d="M32 3 L57 12 V31 C57 47 46 56 32 61 C18 56 7 47 7 31 V12 Z"
        fill="url(#awa-shield)"
        stroke="url(#awa-spark)"
        strokeWidth="1.25"
      />

      {/* Road arc */}
      <path
        d="M14 44 C24 38 40 38 50 44"
        fill="none"
        stroke="url(#awa-spark)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        d="M22 47 L26 47 M30 47 L34 47 M38 47 L42 47"
        stroke="#5BA8FF"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.7"
      />

      {/* AW monogram */}
      <g fill="#FFFFFF">
        {/* A */}
        <path d="M22.2 36 L26.6 18 H29.4 L33.8 36 H30.7 L29.75 31.9 H26.25 L25.3 36 Z M26.85 29.3 H29.15 L28 24.1 Z" />
        {/* W */}
        <path d="M34.4 18 H37.2 L38.9 30.2 L40.95 18 H43.05 L45.1 30.2 L46.8 18 H49.6 L46.6 36 H43.9 L42 24.4 L40.1 36 H37.4 Z" />
      </g>

      {/* Spark accent */}
      <circle cx="49" cy="14" r="2" fill="#5BA8FF" />
    </svg>
  );
}
