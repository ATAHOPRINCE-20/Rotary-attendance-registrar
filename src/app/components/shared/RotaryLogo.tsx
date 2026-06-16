import { GOLD, NAVY, WHITE } from "../../../lib/constants";

export function RotaryLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="45" fill={NAVY} />
      <circle cx="50" cy="50" r="32" fill="none" stroke={GOLD} strokeWidth="6" />
      <circle cx="50" cy="50" r="10" fill={GOLD} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
        <rect
          key={i}
          x="47" y="14"
          width="6" height="14"
          rx="3"
          fill={WHITE}
          transform={`rotate(${angle} 50 50)`}
        />
      ))}
    </svg>
  );
}
