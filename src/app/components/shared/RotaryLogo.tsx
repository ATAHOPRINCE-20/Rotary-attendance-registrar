export function RotaryLogo({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src="/assets/rotary_gold_logo.png"
      alt="Rotary International"
      width={size}
      height={size}
      {...{ fetchpriority: "high" }}
      decoding="async"
      className={`object-contain ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
    />
  );
}
