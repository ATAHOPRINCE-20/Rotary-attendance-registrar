import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Menu, X, QrCode, LogIn } from "lucide-react";
import { RotaryLogo } from "./RotaryLogo";
import { GoldButton } from "./Buttons";
import { GOLD, NAVY } from "../../../lib/constants";
import type { Organization } from "../../../types/database";

interface NavBarProps {
  organization?: Organization | null;
  /** current pathname for active link highlighting */
  currentPath?: string;
}

export function NavBar({ organization, currentPath = "" }: NavBarProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { slug } = useParams<{ slug?: string }>();

  const base   = slug ? `/org/${slug}` : "";
  const isAdmin = currentPath.startsWith("/admin");

  const publicLinks = slug
    ? [
        { label: "Home",   to: `${base}` },
        { label: "Events", to: `${base}/events` },
        { label: "Donate", to: `${base}/donate` },
      ]
    : [];

  const isActive = (to: string) => currentPath === to;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo + Name */}
        <button
          onClick={() => navigate(slug ? `${base}` : "/")}
          className="flex items-center gap-3"
        >
          <RotaryLogo size={36} />
          <div className="hidden sm:flex flex-col leading-tight">
            <span
              className="font-black text-sm tracking-wide"
              style={{ color: NAVY, fontFamily: "Montserrat, sans-serif" }}
            >
              {organization?.name ?? "RotaryConnect"}
            </span>
            <span
              className="text-xs text-muted-foreground"
            >

              Service Above Self
            </span>
          </div>
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
            <>
              {slug && (
                <button
                  onClick={() => navigate(`${base}/scan`)}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors"
                  style={{ fontFamily: "Montserrat, sans-serif" }}
                >
                  <QrCode size={15} /> Scan QR
                </button>
              )}
              <button
                onClick={() => navigate("/admin")}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors"
                style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                <LogIn size={14} /> Admin
              </button>
              {slug && (
                <GoldButton
                  onClick={() => navigate(`${base}/events`)}
                  className="py-2 px-4"
                >
                  Register Now
                </GoldButton>
              )}
            </>
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
          {slug && (
            <GoldButton
              onClick={() => { navigate(`${base}/events`); setOpen(false); }}
              className="mt-2 justify-center"
            >
              Register Now
            </GoldButton>
          )}
          <button
            onClick={() => { navigate("/admin"); setOpen(false); }}
            className="text-sm text-muted-foreground hover:text-primary py-2 font-semibold text-left px-4"
            style={{ fontFamily: "Montserrat, sans-serif" }}
          >
            Admin Login
          </button>
        </div>
      )}
    </nav>
  );
}
