import { ReactNode } from "react";
import { GOLD, NAVY, WHITE } from "../../../lib/constants";

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}

export function GoldButton({ children, onClick, className = "", type = "button", disabled }: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:brightness-105 active:scale-95 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      style={{ backgroundColor: GOLD, color: WHITE, fontFamily: "Montserrat, sans-serif" }}
    >
      {children}
    </button>
  );
}

export function NavyButton({ children, onClick, className = "", type = "button", disabled }: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 border-2 hover:bg-primary hover:text-white active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      style={{ borderColor: NAVY, color: NAVY, fontFamily: "Montserrat, sans-serif" }}
    >
      {children}
    </button>
  );
}

export function OutlineButton({ children, onClick, className = "", type = "button", disabled }: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 border border-border bg-card hover:bg-muted active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      style={{ fontFamily: "Montserrat, sans-serif" }}
    >
      {children}
    </button>
  );
}
