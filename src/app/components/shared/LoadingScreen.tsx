import { RotaryLogo } from "./RotaryLogo";

interface LoadingScreenProps {
  variant?: "light" | "dark" | "blue";
  fullScreen?: boolean;
}

export function LoadingScreen({ variant = "blue", fullScreen = true }: LoadingScreenProps) {
  // Styles based on variant
  const bgClass =
    variant === "blue"
      ? "bg-gradient-to-br from-[#081c3b] via-[#0d2c54] to-[#17458F] text-white"
      : variant === "light"
      ? "bg-background text-foreground"
      : "bg-neutral-950 text-white";

  const containerStyle = variant === "light" 
    ? { background: "linear-gradient(135deg, #f0f4fa 0%, #e8edf5 100%)" }
    : undefined;

  const containerClass = `${fullScreen ? "fixed inset-0 z-[9999]" : "w-full h-full py-12"} flex flex-col items-center justify-center ${bgClass} transition-all duration-300`;

  // Spinner styles
  const spinnerBorderColor = variant === "blue" ? "border-amber-400" : "border-[#17458F]";

  return (
    <div className={containerClass} style={containerStyle}>
      <style>{`
        @keyframes rotary-gear-spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        @keyframes rotary-spinner-spin {
          to {
            transform: rotate(360deg);
          }
        }
        .animate-gear-spin {
          animation: rotary-gear-spin 10s linear infinite;
        }
        .animate-spinner-spin {
          animation: rotary-spinner-spin 1.2s linear infinite;
        }
      `}</style>
      <div className="relative flex flex-col items-center justify-center scale-95 md:scale-100">
        {/* Glow effect for logo */}
        {variant === "blue" && (
          <div className="absolute w-28 h-28 rounded-full bg-amber-500/10 blur-xl pointer-events-none" />
        )}
        
        {/* Gear logo with rotating animation */}
        <div className="relative z-10 animate-gear-spin mb-6 p-3 rounded-full bg-white/5 backdrop-blur-sm shadow-lg border border-white/10">
          <RotaryLogo size={64} />
        </div>

        {/* Loading Spinner */}
        <div className={`w-8 h-8 rounded-full border-4 ${spinnerBorderColor} border-t-transparent animate-spinner-spin mb-4`} />
        
        {/* Loading Text */}
        <p 
          className="text-xs uppercase tracking-[0.25em] font-extrabold opacity-80"
          style={{ 
            fontFamily: "Montserrat, sans-serif",
            color: variant === "blue" ? "#F7A81B" : "#17458F"
          }}
        >
          Loading
        </p>
      </div>
    </div>
  );
}
