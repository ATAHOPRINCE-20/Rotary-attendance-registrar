import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Menu, X, QrCode, LogIn } from "lucide-react";
import { RotaryLogo } from "./RotaryLogo";
import { GoldButton } from "./Buttons";
import { GOLD, NAVY } from "../../../lib/constants";
import type { Organization } from "../../../types/database";
import { useAuth } from "../../../context/AuthContext";

interface NavBarProps {
  organization?: Organization | null;
  /** current pathname for active link highlighting */
  currentPath?: string;
}

export function NavBar({ organization, currentPath = "" }: NavBarProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { slug } = useParams<{ slug?: string }>();
  const { user } = useAuth();

  const base   = slug ? `/org/${slug}` : "";
  const isAdmin = currentPath.startsWith("/admin");

  const publicLinks = slug
    ? [
        { label: "Home",   to: `${base}` },
        { label: "Events", to: `${base}/events` },
      ]
    : [];

  const isActive = (to: string) => currentPath === to;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <button
          onClick={() => navigate(slug ? `${base}` : "/")}
          className="flex items-center justify-center cursor-pointer transition-transform hover:scale-105 duration-200"
          style={{ height: "40px", width: "40px" }}
        >
          <RotaryLogo size={40} />
        </button>

        {/* Desktop links */}
        {!isAdmin && (
          <div className="hidden md:flex items-center gap-1">
            {publicLinks.map((l) => (
              <button
                key={l.to}
                onClick={() => navigate(l.to)}
                className="px-4 py-2 text-sm font-semibold text-foreground hover:text-primary transition-colors duration-150"
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  color:      isActive(l.to) ? NAVY : undefined,
                  boxShadow:  isActive(l.to) ? `inset 0 -2px 0 ${GOLD}` : "none",
                }}
              >
                {l.label}
              </button>
            ))}
          </div>
        )}

        {/* Right side */}
        <div className="hidden md:flex items-center gap-3">
          {!isAdmin && (
            user ? (
              <button
                onClick={() => navigate("/admin/dashboard")}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                Dashboard
              </button>
            ) : null
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen(!open)}
          className="md:hidden p-2 rounded-lg hover:bg-muted"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-card border-t border-border px-4 py-4 flex flex-col gap-2">
          {publicLinks.map((l) => (
            <button
              key={l.to}
              onClick={() => { navigate(l.to); setOpen(false); }}
              className="w-full text-left px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted rounded-xl transition-all"
              style={{
                fontFamily:  "Montserrat, sans-serif",
                color:       isActive(l.to) ? NAVY : undefined,
                borderLeft:  isActive(l.to) ? `3px solid ${GOLD}` : "3px solid transparent",
              }}
            >
              {l.label}
            </button>
          ))}
          {/* Removed Register Now button */}
          {!isAdmin && (
            user ? (
              <button
                onClick={() => { navigate("/admin/dashboard"); setOpen(false); }}
                className="text-sm text-muted-foreground hover:text-primary py-2 font-semibold text-left px-4"
                style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                Dashboard
              </button>
            ) : null
          )}
        </div>
      )}
    </nav>
  );
}
