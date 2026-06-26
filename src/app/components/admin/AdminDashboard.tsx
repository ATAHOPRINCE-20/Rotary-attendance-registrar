import { useNavigate } from "react-router";
import { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useAdminEvents } from "../../../hooks/useEvents";
import { useOrgRegistrations } from "../../../hooks/useRegistrations";
import { useOrgDonations } from "../../../hooks/useDonations";
import { supabase } from "../../../lib/supabase";
import { toast } from "sonner";
import { NAVY, GOLD, sanitizeInput } from "../../../lib/constants";
import { AdminLayout } from "../shared/AdminLayout";
import {
  Calendar,
  Users,
  Heart,
  Plus,
  UserCheck,
  TrendingUp,
  ArrowUpRight,
} from "lucide-react";

import { LoadingScreen } from "../shared/LoadingScreen";

export function AdminDashboard() {
  const { profile, organization, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const { data: events,        isLoading: eventsLoading   } = useAdminEvents(organization?.id);
  const { data: registrations, isLoading: regsLoading     } = useOrgRegistrations(organization?.id);
  const { data: donations,     isLoading: donationsLoading } = useOrgDonations(organization?.id);

  const loading = eventsLoading || regsLoading || donationsLoading;

  const [clubBuddyGroups, setClubBuddyGroups] = useState("");
  const [savingBuddyGroups, setSavingBuddyGroups] = useState(false);

  useEffect(() => {
    if (organization) {
      setClubBuddyGroups(organization.buddy_groups || "");
    }
  }, [organization]);

  async function handleSaveBuddyGroups(e: React.FormEvent) {
    e.preventDefault();
    if (!organization) return;

    setSavingBuddyGroups(true);
    try {
      const sanitizedBuddyGroups = sanitizeInput(clubBuddyGroups);
      const { error } = await supabase
        .from("organizations")
        .update({ buddy_groups: sanitizedBuddyGroups })
        .eq("id", organization.id);

      if (error) throw error;
      toast.success("Club buddy groups updated successfully!");
      await refreshProfile();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to update buddy groups.");
    } finally {
      setSavingBuddyGroups(false);
    }
  }

  const activeEventsCount  = events?.filter(e => e.status === "published").length ?? 0;
  const totalRegistrations = registrations?.length ?? 0;
  const totalDonations     = donations?.reduce((a, d) => a + Number(d.amount), 0) ?? 0;
  const checkedInCount     = registrations?.filter(r => r.status === "checked-in").length ?? 0;

  return (
    <AdminLayout
      pageTitle="Dashboard"
      actions={
        <button
          onClick={() => navigate("/admin/events")}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90"
          style={{ background: NAVY }}
        >
          <Plus size={14} /> New Event
        </button>
      }
    >
      <main className="flex-1">
        {/* Page heading */}
        <div className="mb-6">
          <h1 className="text-2xl font-black" style={{ color: NAVY, fontFamily: "Montserrat, sans-serif" }}>
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Plan, manage and track your Rotary club with ease.
          </p>
        </div>

          {/* ── STAT CARDS ── */}
          {loading ? (
            <LoadingScreen variant="light" fullScreen={false} />
          ) : (
            <>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
                {[
                  {
                    label: "Active Events",
                    val:   activeEventsCount,
                    icon:  Calendar,
                    accent: GOLD,
                    bg:    `${GOLD}18`,
                    trend: "+1 this month",
                  },
                  {
                    label: "Registrations",
                    val:   totalRegistrations,
                    icon:  Users,
                    accent: "#0067C8",
                    bg:    "#0067C818",
                    trend: "Total attendees",
                  },
                  {
                    label: "Checked In",
                    val:   `${checkedInCount}/${totalRegistrations}`,
                    icon:  UserCheck,
                    accent: "#48BB78",
                    bg:    "#48BB7818",
                    trend: "At door",
                  },
                  {
                    label: "Total Donations",
                    val:   `UGX ${totalDonations.toLocaleString()}`,
                    icon:  Heart,
                    accent: "#E53E3E",
                    bg:    "#E53E3E18",
                    trend: "Raised",
                  },
                ].map((stat, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-2xl p-5 border border-border/40 shadow-sm flex flex-col gap-3"
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: stat.bg, color: stat.accent }}
                      >
                        <stat.icon size={18} />
                      </div>
                      <ArrowUpRight size={14} className="text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold">{stat.label}</p>
                      <p className="text-2xl font-black mt-0.5" style={{ color: NAVY }}>{stat.val}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <TrendingUp size={10} className="text-emerald-500" />
                      {stat.trend}
                    </p>
                  </div>
                ))}
              </div>

              {/* Club Buddy Groups Settings Card */}
              <div className="bg-white rounded-2xl p-6 border border-border/40 shadow-sm flex flex-col gap-4 mb-6">
                <div>
                  <h3 className="text-base font-bold text-foreground" style={{ color: NAVY, fontFamily: "Montserrat, sans-serif" }}>
                    Club Buddy Groups 
                  </h3>
                  {/* <p className="text-xs text-muted-foreground mt-0.5">
                    Set default buddy groups (comma-separated) that will always appear in the registration dropdown for your club's events.
                  </p> */}
                </div>
                <form onSubmit={handleSaveBuddyGroups} className="flex gap-2">
                  <input
                    placeholder="e.g. Table 1, Table 2, Table 3, Table 4"
                    value={clubBuddyGroups}
                    onChange={(e) => setClubBuddyGroups(e.target.value)}
                    className="flex-1 px-4 py-2.5 text-xs rounded-xl border border-border bg-input-background focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={savingBuddyGroups}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-white hover:opacity-90 transition-all cursor-pointer"
                    style={{ background: GOLD }}
                  >
                    {savingBuddyGroups ? "Saving..." : "Save Groups"}
                  </button>
                </form>
              </div>

              {/* ── RECENT TABLES ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* Recent Registrations */}
                <div className="bg-white rounded-2xl border border-border/40 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
                    <div className="flex items-center gap-2">
                      <Users size={15} style={{ color: NAVY }} />
                      <h3 className="text-sm font-bold" style={{ color: NAVY }}>Recent Registrations</h3>
                    </div>
                    <button
                      onClick={() => navigate("/admin/events")}
                      className="text-[11px] font-bold hover:underline"
                      style={{ color: GOLD }}
                    >
                      View all
                    </button>
                  </div>
                  <div className="divide-y divide-border/30">
                    {!registrations || registrations.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-10 text-center">No registrations yet.</p>
                    ) : (
                      registrations.slice(0, 6).map((r: any) => (
                        <div key={r.id} className="flex items-center justify-between px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-7 h-7 rounded-full text-white text-[10px] font-black flex items-center justify-center shrink-0"
                              style={{ background: `linear-gradient(135deg, ${NAVY}, #0067C8)` }}
                            >
                              {r.full_name?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-foreground">{r.full_name}</p>
                              <p className="text-[10px] text-muted-foreground">{r.events?.title ?? "Event"}</p>
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                              r.status === "checked-in"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {r.status}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Recent Donations */}
                <div className="bg-white rounded-2xl border border-border/40 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
                    <div className="flex items-center gap-2">
                      <Heart size={15} style={{ color: "#E53E3E" }} />
                      <h3 className="text-sm font-bold" style={{ color: NAVY }}>Recent Donations</h3>
                    </div>
                    <button
                      onClick={() => navigate("/admin/analytics")}
                      className="text-[11px] font-bold hover:underline"
                      style={{ color: GOLD }}
                    >
                      View all
                    </button>
                  </div>
                  <div className="divide-y divide-border/30">
                    {!donations || donations.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-10 text-center">No donations yet.</p>
                    ) : (
                      donations.slice(0, 6).map((d) => (
                        <div key={d.id} className="flex items-center justify-between px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-7 h-7 rounded-full text-white text-[10px] font-black flex items-center justify-center shrink-0"
                              style={{ background: "linear-gradient(135deg,#E53E3E,#F56565)" }}
                            >
                              {(d.full_name ?? "A").charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-foreground">{d.full_name ?? "Anonymous"}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {DONATION_CATEGORIES.find(c => c.id === d.category)?.label ?? "General Allocation"}
                              </p>
                            </div>
                          </div>
                          <span className="text-sm font-black" style={{ color: "#17458F" }}>
                            +UGX {Number(d.amount).toLocaleString()}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
    </AdminLayout>
  );
}

const DONATION_CATEGORIES = [
  { id: "community",    label: "Community Service Projects" },
  { id: "sponsorship",  label: "Event Sponsorship" },
  { id: "development",  label: "Club Development" },
  { id: "general",      label: "General Contribution" },
];
