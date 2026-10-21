import { scoreBand } from "@/lib/lead-score";

export function ScoreEmoji({ score, className }: { score: number; className?: string }) {
  const band = scoreBand(score);
  const color =
    band === "hot"
      ? "text-emerald-500"
      : band === "warm"
        ? "text-amber-500"
        : band === "cold"
          ? "text-orange-500"
          : "text-red-500";

  // Face scales from 20px to 38px as the score grows.
  const size = 20 + (score / 100) * 18;
  const stroke = size * 0.075;

  // Mouth curve grows from a frown (-4) to a big grin (+8) as score increases.
  const curve = (score - 35) / 100 * 12;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${color} ${className ?? ""}`}
      style={{ width: size, height: size, strokeWidth: stroke }}
      aria-label={`Lead score ${score}`}
    >
      {/* Face */}
      <circle cx="12" cy="12" r="10" />
      {/* Eyes */}
      <circle cx="8" cy="9" r="1.5" fill="currentColor" />
      <circle cx="16" cy="9" r="1.5" fill="currentColor" />
      {/* Smile / frown */}
      <path d={`M 7 15 Q 12 ${15 + curve} 17 15`} />
    </svg>
  );
}
