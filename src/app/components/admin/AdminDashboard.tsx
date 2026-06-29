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
  X,
  AlertTriangle,
} from "lucide-react";

import { LoadingScreen } from "../shared/LoadingScreen";

export function AdminDashboard() {
  const { profile, organization, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const { data: events,        isLoading: eventsLoading   } = useAdminEvents(organization?.id);
  const { data: registrations, isLoading: regsLoading     } = useOrgRegistrations(organization?.id);
  const { data: donations,     isLoading: donationsLoading } = useOrgDonations(organization?.id);

  const loading = eventsLoading || regsLoading || donationsLoading;

  const [buddyGroupsList, setBuddyGroupsList] = useState<string[]>([]);
  const [newGroup, setNewGroup] = useState("");
  const [savingBuddyGroups, setSavingBuddyGroups] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [welcomeTemplate, setWelcomeTemplate] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    if (organization) {
      const list = organization.buddy_groups
        ? organization.buddy_groups.split(",").map((g: string) => g.trim()).filter(Boolean)
        : [];
      setBuddyGroupsList(list);
      setWebhookUrl(organization.whatsapp_webhook_url || "");
      setWelcomeTemplate(organization.whatsapp_welcome_template || "");
    }
  }, [organization]);

  async function handleAddGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!newGroup.trim() || !organization) return;

    const groupToAdd = sanitizeInput(newGroup.trim());
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
  async function handleSaveWhatsAppSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!organization) return;

    const oldUrl = (organization.whatsapp_webhook_url || "").trim();
    const newUrl = webhookUrl.trim();

    // If the Webhook URL is changed, show the modern warning modal first
    if (newUrl !== oldUrl) {
      setShowConfirmModal(true);
    } else {
      await saveSettingsDirectly();
    }
  }

  async function saveSettingsDirectly() {
    if (!organization) return;
    setSavingSettings(true);
    try {
      const sanitizedUrl = webhookUrl.trim() ? sanitizeInput(webhookUrl) : null;
      const sanitizedTemplate = welcomeTemplate.trim() ? sanitizeInput(welcomeTemplate) : null;
      const { error } = await supabase
        .from("organizations")
        .update({
          whatsapp_webhook_url: sanitizedUrl,
          whatsapp_welcome_template: sanitizedTemplate,
        })
        .eq("id", organization.id);

      if (error) throw error;
      toast.success("WhatsApp Welcomer Settings updated successfully!");
      await refreshProfile();
      setShowConfirmModal(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to update WhatsApp settings.");
    } finally {
      setSavingSettings(false);
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
                    label: "Total Attendees",
                    val:   totalRegistrations,
                    icon:  Users,
                    accent: "#0067C8",
                    bg:    "#0067C818",
                    trend: "Total registered present",
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

              {/* Configuration Settings Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Club Buddy Groups Card */}
                <div className="bg-white rounded-2xl p-6 border border-border/40 shadow-sm flex flex-col justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-foreground" style={{ color: NAVY, fontFamily: "Montserrat, sans-serif" }}>
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

                  <form onSubmit={handleAddGroup} className="flex gap-2 mt-2">
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

                {/* WhatsApp Settings Card */}
                <div className="bg-white rounded-2xl p-6 border border-border/40 shadow-sm flex flex-col gap-4">
                  <div>
                    <h3 className="text-base font-bold text-foreground" style={{ color: NAVY, fontFamily: "Montserrat, sans-serif" }}>
                      WhatsApp Welcomer Integration
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Configure webhook endpoint to dispatch automated WhatsApp welcome messages.
                    </p>
                  </div>
                  <form onSubmit={handleSaveWhatsAppSettings} className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Webhook Endpoint URL</label>
                      <input
                        placeholder="https://your-webhook-endpoint.com/whatsapp"
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        className="w-full px-4 py-2.5 text-xs rounded-xl border border-border bg-input-background focus:outline-none font-mono"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Welcome Template Message</label>
                      <textarea
                        placeholder="Template (use tags: {full_name}, {event_title}, {qr_ref}, {org_name})"
                        value={welcomeTemplate}
                        onChange={(e) => setWelcomeTemplate(e.target.value)}
                        rows={3}
                        className="w-full px-4 py-2.5 text-xs rounded-xl border border-border bg-input-background focus:outline-none resize-none"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={savingSettings}
                      className="w-full py-2.5 rounded-xl text-xs font-bold text-white hover:opacity-90 transition-all cursor-pointer mt-1"
                      style={{ background: NAVY }}
                    >
                      {savingSettings ? "Saving Settings..." : "Save WhatsApp Settings"}
                    </button>
                  </form>
                </div>
              </div>


              {/* ── RECENT TABLES ── */}
              <div className="grid grid-cols-1 gap-5">

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

        {/* Modern Webhook Warning Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-md overflow-hidden flex flex-col p-6 gap-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3 text-red-500">
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground" style={{ fontFamily: "Montserrat, sans-serif" }}>
                    Warning: Changing Webhook URL
                  </h3>
                  <p className="text-[10px] text-muted-foreground">Critical configuration update</p>
                </div>
              </div>
              
              <div className="text-xs text-muted-foreground leading-relaxed py-2 border-y border-border/40">
                You are modifying the <strong>WhatsApp Webhook URL</strong>. This endpoint routes your automated welcome messages to registrants.
                <br /><br />
                If the new URL is incorrect or your gateway is offline, <strong>automated WhatsApp messages will fail to deliver</strong>.
              </div>
              
              <div className="flex gap-3 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 border border-border bg-transparent hover:bg-muted text-foreground text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveSettingsDirectly}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Confirm Change
                </button>
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
  );
}

const DONATION_CATEGORIES = [
  { id: "community",    label: "Community Service Projects" },
  { id: "sponsorship",  label: "Event Sponsorship" },
  { id: "development",  label: "Club Development" },
  { id: "general",      label: "General Contribution" },
];
