import { useNavigate, useLocation } from "react-router";
import { ReactNode } from "react";
import { useAuth } from "../../../context/AuthContext";
import { RotaryLogo } from "./RotaryLogo";
import { NAVY, GOLD } from "../../../lib/constants";
import {
  LayoutDashboard,
  Calendar,
  MessageSquare,
  BarChart3,
  Globe,
  LogOut,
  Bell,
  Search,
} from "lucide-react";

const MENU_ITEMS = [
  { label: "Dashboard",      to: "/admin/dashboard",      icon: LayoutDashboard },
  { label: "Events",         to: "/admin/events",         icon: Calendar        },
  { label: "Communications", to: "/admin/communications", icon: MessageSquare   },
  { label: "Analytics",      to: "/admin/analytics",      icon: BarChart3       },
];

interface AdminLayoutProps {
  children: ReactNode;
  /** Label shown in the top-bar (e.g. "Events") */
  pageTitle?: string;
  /** Slot for primary action button in the top-bar */
  actions?: ReactNode;
}

export function AdminLayout({ children, pageTitle, actions }: AdminLayoutProps) {
  const { profile, organization, signOut } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const initials = profile?.full_name
    ?.split(" ")
    .map(w => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() ?? "AD";

  return (
    <div className="flex h-screen bg-[#f4f6fb] overflow-hidden">

      {/* ── SIDEBAR ───────────────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 h-full border-r border-border/60 bg-white">

        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-border/40">
          {organization?.logo_url ? (
            <img src={organization.logo_url} className="h-9 w-auto object-contain rounded-md" alt={organization.name} />
          ) : (
            <RotaryLogo size={36} />
          )}
          <div className="leading-tight overflow-hidden">
            <p
              className="font-black text-xs truncate"
              style={{ color: NAVY, fontFamily: "Montserrat, sans-serif" }}
            >
              {organization?.name ?? "RotaryConnect"}
            </p>
            <p className="text-[10px] text-muted-foreground">Service Above Self</p>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-5 flex flex-col gap-1 overflow-y-auto">
          <p className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase px-3 mb-2">
            Menu
          </p>
          {MENU_ITEMS.map(({ label, to, icon: Icon }) => {
            const active = location.pathname === to;
            return (
              <button
                key={to}
                onClick={() => navigate(to)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
                  active
                    ? "text-white shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                style={{ background: active ? NAVY : undefined }}
              >
                <Icon size={16} />
                {label}
              </button>
            );
          })}

          <div className="mt-6">
            <p className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase px-3 mb-2">
              General
            </p>
            <button
              onClick={() => window.open(`/org/${organization?.slug}`, "_blank")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
            >
              <Globe size={16} />
              Public Portal
            </button>
            <button
              onClick={signOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-all"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </nav>

        {/* User card */}
        <div className="p-4 border-t border-border/40">
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-muted transition-all cursor-default">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0"
              style={{ background: `linear-gradient(135deg, ${NAVY}, #0067C8)` }}
            >
              {initials}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-foreground truncate">{profile?.full_name ?? "Admin"}</p>
              <p className="text-[10px] text-muted-foreground truncate">{profile?.role ?? "admin"}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── CONTENT ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-border/40 shrink-0">
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="flex items-center gap-2 bg-[#f4f6fb] rounded-xl px-4 py-2.5 w-52">
              <Search size={14} className="text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground">{pageTitle ?? "Search…"}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="w-9 h-9 rounded-xl bg-[#f4f6fb] flex items-center justify-center hover:bg-muted transition-all">
              <Bell size={16} className="text-muted-foreground" />
            </button>

            {/* Injected action buttons */}
            {actions}

            {/* Avatar */}
            <div className="flex items-center gap-2.5 pl-1">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0"
                style={{ background: `linear-gradient(135deg, ${NAVY}, #0067C8)` }}
              >
                {initials}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-bold text-foreground">{profile?.full_name ?? "Admin"}</p>
                <p className="text-[10px] text-muted-foreground">{organization?.name}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page body */}
        <main className="flex-1 overflow-y-auto px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
