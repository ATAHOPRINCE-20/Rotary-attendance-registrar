import { useNavigate } from "react-router";
import { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useAllOrgEvents } from "../../../hooks/useEvents";
import { useOrgRegistrations, useEventRegistrations } from "../../../hooks/useRegistrations";
import { useOrgMembers } from "../../../hooks/useMembers";
import { useOrgDonations } from "../../../hooks/useDonations";
import { supabase } from "../../../lib/supabase";
import { toast } from "sonner";
import { NAVY, GOLD, sanitizeInput, sanitizeRequiredInput } from "../../../lib/constants";
import { AdminLayout } from "../shared/AdminLayout";
import { QRCodeSVG } from "qrcode.react";
import {
  Calendar,
  Users,
  Heart,
  Plus,
  UserCheck,
  TrendingUp,
  ArrowUpRight,
  X,
  AlertTriangle,
  BookOpen,
  MessageSquare,
  Mail,
  CreditCard,
} from "lucide-react";

import { LoadingScreen } from "../shared/LoadingScreen";
import { getLicenseStatus } from "../../../lib/licensing";

export function AdminDashboard() {
  const { profile, organization, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [selectedEventId, setSelectedEventId] = useState<string>("");

  const { data: events,        isLoading: eventsLoading   } = useAllOrgEvents(organization?.id);
  const { data: registrations, isLoading: regsLoading     } = useOrgRegistrations(organization?.id);
  const { data: donations,     isLoading: donationsLoading } = useOrgDonations(organization?.id);
  const { data: eventRegs,     isLoading: eventRegsLoading } = useEventRegistrations(selectedEventId || undefined);
  const { data: members,       isLoading: membersLoading   } = useOrgMembers(organization?.id);

  const loading = eventsLoading || regsLoading || donationsLoading;

  const [buddyGroupsList, setBuddyGroupsList] = useState<string[]>([]);
  const [newGroup, setNewGroup] = useState("");
  const [savingBuddyGroups, setSavingBuddyGroups] = useState(false);

  async function fetchWithAuth(url: string, options: RequestInit = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      }
    });
  }

  useEffect(() => {
    if (organization) {
      const list = organization.buddy_groups
        ? Array.from(new Set<string>(organization.buddy_groups.split(",").map((g: string) => g.trim()).filter(Boolean)))
        : [];
      setBuddyGroupsList(list);
    }
  }, [organization]);

  useEffect(() => {
    if (events && events.length > 0 && !selectedEventId) {
      const publishedEvents = events.filter(e => e.status === "published" && !e.is_archived);
      if (publishedEvents.length > 0) {
        setSelectedEventId(publishedEvents[publishedEvents.length - 1].id);
      } else {
        const activeEvents = events.filter(e => !e.is_archived);
        if (activeEvents.length > 0) {
          setSelectedEventId(activeEvents[activeEvents.length - 1].id);
        } else {
          setSelectedEventId(events[events.length - 1].id);
        }
      }
    }
  }, [events, selectedEventId]);

  async function handleAddGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!newGroup.trim() || !organization) return;

    const groupToAdd = sanitizeRequiredInput(newGroup.trim());
    if (buddyGroupsList.includes(groupToAdd)) {
      toast.error("This buddy group already exists.");
      return;
    }

    const updatedList = [...buddyGroupsList, groupToAdd];
    setSavingBuddyGroups(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({ buddy_groups: updatedList.join(",") })
        .eq("id", organization.id);

      if (error) throw error;
      setBuddyGroupsList(updatedList);
      setNewGroup("");
      toast.success("Group added successfully!");
      await refreshProfile();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to add group.");
    } finally {
      setSavingBuddyGroups(false);
    }
  }

  async function handleDeleteGroup(groupToDelete: string) {
    if (!organization) return;

    const updatedList = buddyGroupsList.filter(g => g !== groupToDelete);
    setSavingBuddyGroups(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({ buddy_groups: updatedList.join(",") })
        .eq("id", organization.id);

      if (error) throw error;
      setBuddyGroupsList(updatedList);
      toast.success("Group removed successfully!");
      await refreshProfile();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to remove group.");
    } finally {
      setSavingBuddyGroups(false);
    }
  }



  const activeEventsCount  = events?.filter(e => e.status === "published" && !e.is_archived).length ?? 0;
  const totalRegistrations = registrations?.length ?? 0;
  const totalDonations     = donations?.filter(d => d.status === "completed").reduce((a, d) => a + Number(d.amount), 0) ?? 0;
  const checkedInCount     = registrations?.filter(r => r.status === "checked-in").length ?? 0;

  // Get active selected event
  const selectedEvent = events?.find(e => e.id === selectedEventId);

  // Parse buddy groups for the selected event
  const selectedEventBuddyGroups = Array.from(new Set<string>(
    selectedEvent?.buddy_groups
      ? selectedEvent.buddy_groups.split(",").map((g: string) => g.trim()).filter(Boolean)
      : organization?.buddy_groups
      ? organization.buddy_groups.split(",").map((g: string) => g.trim()).filter(Boolean)
      : []
  ));

  // Filter registrations for this event
  const eventRegsList = eventRegs ?? [];

  // Count present club members (those checked-in and belonging to a buddy group)
  const presentClubMembers = eventRegsList.filter(r => r.status === "checked-in" && r.buddy_group && r.buddy_group.trim()).length;
  const totalClubMembers = members?.length ?? 0;

  // Buddy group counts for the selected event based on total club members in each group
  const buddyGroupMetrics = selectedEventBuddyGroups.map(group => {
    const totalInGroup = members?.filter(m => m.buddy_group?.trim().toLowerCase() === group.toLowerCase()).length ?? 0;
    const present = eventRegsList.filter(r => r.buddy_group?.trim().toLowerCase() === group.toLowerCase() && r.status === "checked-in").length;
    const percentage = totalInGroup > 0 ? Math.round((present / totalInGroup) * 100) : 0;
    return { group, totalReg: totalInGroup, present, percentage };
  });



  return (
    <AdminLayout
      pageTitle="Dashboard"
      actions={
        profile?.role !== "staff" ? (
          <button
            onClick={() => navigate("/admin/events")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 cursor-pointer"
            style={{ background: NAVY }}
          >
            <Plus size={14} /> New Event
          </button>
        ) : undefined
      }
    >
      <main className="flex-1">
        {/* Page heading */}
        <div className="mb-6">
          <h1 className="text-2xl font-black" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {[
                  {
                    label: "Active Events",
                    val:   activeEventsCount,
                    icon:  Calendar,
                    accent: GOLD,
                    bg:    `${GOLD}18`,
                    trend: "+1 this month",
                    path:  "/admin/events",
                  },
                  {
                    label: "Total Attendees",
                    val:   totalRegistrations,
                    icon:  Users,
                    accent: "#0067C8",
                    bg:    "#0067C818",
                    trend: "Total registered present",
                    path:  "/admin/reports",
                  },
                  {
                    label: "Total Donations",
                    val:   `UGX ${totalDonations.toLocaleString()}`,
                    icon:  Heart,
                    accent: "#E53E3E",
                    bg:    "#E53E3E18",
                    trend: "Raised",
                    path:  profile?.role !== "staff" ? "/admin/analytics" : undefined,
                  },
                ].map((stat, i) => (
                  <div
                    key={i}
                    onClick={stat.path ? () => { if (stat.path) navigate(stat.path); } : undefined}
                    className={`bg-white rounded-2xl p-5 border border-border/40 shadow-sm flex flex-col gap-3 transition-all duration-200 ${
                      stat.path
                        ? "cursor-pointer hover:shadow-md hover:border-slate-300 hover:scale-[1.015] active:scale-[0.985]"
                        : ""
                    }`}
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

              {/* Configuration Settings Grid */}
              {profile?.role !== "staff" && (
                <div className="grid grid-cols-1 mb-6">
                  {/* Club Buddy Groups Card */}
                  <div className="bg-white rounded-2xl p-6 border border-border/40 shadow-sm flex flex-col justify-between gap-4">
                    <div>
                      <h3 className="text-base font-bold text-foreground" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
                        Club Buddy Groups
                      </h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Manage buddy groups shown on registration forms.
                      </p>
                      
                      {/* Visual Buddy Groups list space */}
                      <div className="flex flex-wrap gap-2 mt-4 min-h-[50px] max-h-[160px] overflow-y-auto p-1 bg-slate-50/50 rounded-xl border border-slate-100/50">
                        {buddyGroupsList.length === 0 ? (
                          <p className="text-[11px] text-muted-foreground m-auto">No buddy groups added yet.</p>
                        ) : (
                          buddyGroupsList.map((group, idx) => (
                            <span
                              key={idx}
                              className="bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                            >
                              {group}
                              <button
                                type="button"
                                onClick={() => handleDeleteGroup(group)}
                                className="text-slate-400 hover:text-red-500 font-bold ml-0.5 focus:outline-none"
                                title="Delete group"
                              >
                                <X size={10} />
                              </button>
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    <form onSubmit={handleAddGroup} className="flex flex-col sm:flex-row gap-2 mt-2">
                      <input
                        placeholder="Enter new group name"
                        value={newGroup}
                        onChange={(e) => setNewGroup(e.target.value)}
                        disabled={savingBuddyGroups}
                        className="flex-1 px-4 py-2.5 text-xs rounded-xl border border-border bg-input-background focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={savingBuddyGroups || !newGroup.trim()}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold text-white hover:opacity-90 transition-all cursor-pointer whitespace-nowrap"
                        style={{ background: GOLD }}
                      >
                        {savingBuddyGroups ? "Adding..." : "+ Add Group"}
                      </button>
                    </form>
                  </div>
                </div>
              )}


              {/* ── RECENT TABLES & METRICS ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

                {/* Buddy Group Attendance */}
                <div className="bg-white rounded-2xl border border-border/40 shadow-sm overflow-hidden flex flex-col justify-between min-h-[400px]">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <UserCheck size={16} className="text-indigo-600 shrink-0" />
                      <h3 className="text-sm font-bold truncate" style={{ color: NAVY }}>Buddy Group Attendance</h3>
                    </div>
                    {events && events.length > 0 && (
                      <select
                        value={selectedEventId}
                        onChange={(e) => setSelectedEventId(e.target.value)}
                        className="text-[11px] font-semibold bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#17458F]/20 cursor-pointer max-w-[160px] sm:max-w-[200px] truncate"
                      >
                        {events.map((ev) => (
                          <option key={ev.id} value={ev.id}>
                            {ev.title} {ev.is_archived ? " (Deleted)" : ""}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-start">
                    {eventsLoading ? (
                      <div className="flex items-center justify-center py-12 m-auto">
                        <div className="w-6 h-6 border-2 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
                      </div>
                    ) : !selectedEventId ? (
                      <p className="text-xs text-muted-foreground py-10 text-center m-auto">
                        No events available. Create an event to track attendance.
                      </p>
                    ) : (eventRegsLoading || membersLoading) ? (
                      <div className="flex items-center justify-center py-12 m-auto">
                        <div className="w-6 h-6 border-2 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
                      </div>
                    ) : (
                      <div className="w-full flex flex-col gap-4">
                        {/* Attendance Summary Banner */}
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Event Attendance</span>
                            <p className="text-base font-black mt-0.5" style={{ color: NAVY }}>
                              {presentClubMembers} / {totalClubMembers} Present
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Present %</span>
                            <p className="text-base font-black mt-0.5 text-emerald-600">
                              {totalClubMembers > 0 ? Math.round((presentClubMembers / totalClubMembers) * 100) : 0}%
                            </p>
                          </div>
                        </div>

                        {/* List of Buddy Groups */}
                        <div className="flex flex-col gap-3 max-h-[260px] overflow-y-auto pr-1">
                          {selectedEventBuddyGroups.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-8">
                              No buddy groups configured for this event.
                            </p>
                          ) : (
                            <>
                              {buddyGroupMetrics.map(({ group, totalReg, present, percentage }) => (
                                <div key={group} className="flex flex-col gap-1 hover:bg-slate-50/50 p-1.5 rounded-lg transition-all">
                                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                                    <span className="truncate">{group}</span>
                                    <span className="shrink-0 font-extrabold text-slate-500">
                                      {present} / {totalReg} present <span className="text-indigo-600 ml-1">({percentage}%)</span>
                                    </span>
                                  </div>
                                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-indigo-600 transition-all duration-500"
                                      style={{ width: `${percentage}%` }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Recent Donations */}
                <div className="bg-white rounded-2xl border border-border/40 shadow-sm overflow-hidden flex flex-col justify-between min-h-[400px]">
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
                  <div className="divide-y divide-border/30 overflow-y-auto flex-1">
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
                          <div className="flex items-center gap-2">
                            {d.status === "pending" && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase bg-amber-100 text-amber-600">Pending</span>
                            )}
                            {d.status === "failed" && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase bg-red-100 text-red-600">Failed</span>
                            )}
                            {d.status === "completed" && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase bg-emerald-100 text-emerald-600">Success</span>
                            )}
                            <span className="text-sm font-black" style={{ color: d.status === "completed" ? "#10B981" : d.status === "failed" ? "#EF4444" : "#17458F" }}>
                              +UGX {Number(d.amount).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* System Support & Assistance Card */}
              <div className="bg-white rounded-2xl p-6 border border-border/40 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mt-6">
                <div className="max-w-md">
                  <h3 className="text-base font-bold text-foreground flex items-center gap-1.5" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
                    <span className="text-lg">🛠️</span> System Support & Assistance
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Having issues or need technical help with your club registrar platform? Get in touch with our team for rapid support.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
                  <a
                    href="https://wa.me/256757136062"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-row items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50/50 hover:bg-emerald-50 border border-emerald-200/60 hover:border-emerald-300 transition-all cursor-pointer shadow-sm group w-full sm:w-auto min-w-[200px]"
                  >
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                      <MessageSquare size={16} />
                    </div>
                    <div className="text-left">
                      <div className="text-[10px] text-emerald-600/70 font-semibold tracking-wide uppercase">WhatsApp or Call</div>
                      <div className="text-xs font-black text-emerald-800 font-sans">+256 757 136 062</div>
                    </div>
                  </a>
                  <a
                    href="mailto:support@agoroll.com"
                    className="flex flex-row items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 hover:border-slate-300 transition-all cursor-pointer shadow-sm group w-full sm:w-auto min-w-[200px]"
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-500/10 flex items-center justify-center text-slate-600 group-hover:scale-110 transition-transform">
                      <Mail size={16} />
                    </div>
                    <div className="text-left">
                      <div className="text-[10px] text-slate-500/70 font-semibold tracking-wide uppercase">Email Support</div>
                      <div className="text-xs font-black text-slate-800 font-sans">support@agoroll.com</div>
                    </div>
                  </a>
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
