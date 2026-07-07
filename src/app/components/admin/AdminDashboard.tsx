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
  const [welcomeTemplate, setWelcomeTemplate] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [linkMode, setLinkMode] = useState<"qr" | "phone">("qr");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [qrStatus, setQrStatus] = useState<"not_started" | "initializing" | "waiting_for_qr" | "connected" | "disconnected">("not_started");
  const [isWhatsAppConnected, setIsWhatsAppConnected] = useState(false);

  useEffect(() => {
    let interval: any;
    if (showQRModal && organization) {
      const gatewayBaseUrl = "http://ugpay.tech:3000";
      const sessionId = organization.id;

      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/whatsapp-proxy?action=status&sessionId=${sessionId}&gatewayUrl=${encodeURIComponent(gatewayBaseUrl)}`);
          const data = await res.json();
          if (data.status) setQrStatus(data.status);
          if (data.qr) setQrCodeData(data.qr);
          if (data.status === "connected") {
            setIsWhatsAppConnected(true);
            toast.success("WhatsApp Linked Successfully!");
            setTimeout(() => setShowQRModal(false), 3000);
          }
        } catch (err) {
          console.error("Polling error", err);
        }
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showQRModal, organization]);

  async function handleLinkWhatsApp(phone?: string) {
    if (!organization) return;
    
    try {
      const gatewayBaseUrl = "http://ugpay.tech:3000";
      const sessionId = organization.id;
      
      setShowQRModal(true);
      setQrStatus("initializing");
      setQrCodeData(null);
      
      const payload: any = {
        action: 'start',
        sessionId,
        gatewayUrl: gatewayBaseUrl
      };
      
      if (phone) {
        payload.phone = phone;
      }

      await fetch('/api/whatsapp-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err: any) {
      toast.error("Could not connect to WhatsApp gateway.");
      setShowQRModal(false);
    }
  }

  function handleOpenLinkModal() {
    setShowQRModal(true);
    setQrStatus("not_started");
    setLinkMode("qr");
    setQrCodeData(null);
    
    // Clear any existing session on the server so the user always starts fresh and has to click a button.
    if (organization) {
      fetch('/api/whatsapp-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          sessionId: organization.id,
          gatewayUrl: "http://ugpay.tech:3000"
        })
      }).catch(console.error);
    }
  }

  async function handleUnlinkWhatsApp() {
    if (!organization) return;
    if (!confirm("Are you sure you want to unlink WhatsApp? This will log out the current device and delete the session.")) return;
    
    try {
      const gatewayBaseUrl = "http://ugpay.tech:3000";
      const sessionId = organization.id;
      
      await fetch('/api/whatsapp-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          sessionId,
          gatewayUrl: gatewayBaseUrl
        })
      });
      setIsWhatsAppConnected(false);
      toast.success("WhatsApp successfully unlinked.");
    } catch (err: any) {
      toast.error("Failed to unlink WhatsApp.");
    }
  }
  useEffect(() => {
    if (organization) {
      const list = organization.buddy_groups
        ? organization.buddy_groups.split(",").map((g: string) => g.trim()).filter(Boolean)
        : [];
      setBuddyGroupsList(list);
      setWelcomeTemplate(organization.whatsapp_welcome_template || "");
      
      // Check initial WhatsApp connection status
      fetch(`/api/whatsapp-proxy?action=status&sessionId=${organization.id}&gatewayUrl=${encodeURIComponent("http://ugpay.tech:3000")}`)
        .then(res => res.json())
        .then(data => {
          if (data.status === "connected") setIsWhatsAppConnected(true);
        })
        .catch(console.error);
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
    setSavingSettings(true);
    try {
      const sanitizedTemplate = welcomeTemplate.trim() ? sanitizeInput(welcomeTemplate) : null;
      const { error } = await supabase
        .from("organizations")
        .update({
          whatsapp_welcome_template: sanitizedTemplate,
        })
        .eq("id", organization.id);

      if (error) throw error;
      toast.success("WhatsApp Welcomer Settings updated successfully!");
      await refreshProfile();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to update WhatsApp settings.");
    } finally {
      setSavingSettings(false);
    }
  }

  const activeEventsCount  = events?.filter(e => e.status === "published").length ?? 0;
  const totalRegistrations = registrations?.length ?? 0;
  const totalDonations     = donations?.filter(d => d.status === "completed").reduce((a, d) => a + Number(d.amount), 0) ?? 0;
  const checkedInCount     = registrations?.filter(r => r.status === "checked-in").length ?? 0;

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
              {profile?.role !== "staff" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
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

                  {/* WhatsApp Settings Card */}
                  <div className="bg-white rounded-2xl p-6 border border-border/40 shadow-sm flex flex-col gap-4">
                    <div>
                      <h3 className="text-base font-bold text-foreground" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
                        WhatsApp Welcomer Integration
                      </h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Link your WhatsApp number and configure your welcome message template for registrants.
                      </p>
                    </div>
                    <div className="flex flex-col gap-3">
                      <form onSubmit={handleSaveWhatsAppSettings} className="flex flex-col gap-3 border-b border-border/40 pb-4">
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
                          {savingSettings ? "Saving Settings..." : "Save Template"}
                        </button>
                      </form>
                      {isWhatsAppConnected ? (
                        <button
                          type="button"
                          onClick={handleUnlinkWhatsApp}
                          className="w-full py-3 rounded-xl text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-all cursor-pointer flex items-center justify-center gap-2 border border-red-100 shadow-sm"
                        >
                          Disconnect WhatsApp
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleOpenLinkModal}
                          className="w-full py-3 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer flex items-center justify-center gap-2 border border-slate-200 shadow-sm"
                        >
                          📱 Link WhatsApp Number
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}


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
            </>
          )}
        </main>

        {/* WhatsApp QR Modal */}
        {showQRModal && (
          <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-border shadow-2xl w-full max-w-sm overflow-hidden flex flex-col p-6 items-center text-center animate-in zoom-in-95 duration-150 relative">
              <button
                onClick={() => setShowQRModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
              
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-4 text-emerald-600">
                📱
              </div>
              
              <h3 className="text-base font-black text-foreground mb-1" style={{ color: NAVY }}>
                {qrStatus === "connected" ? "Successfully Connected!" : "Link WhatsApp"}
              </h3>
              
              <div className="flex gap-2 bg-slate-100 p-1 rounded-lg w-full mt-2 mb-4">
                <button 
                  className={`flex-1 text-xs font-bold py-1.5 rounded-md transition-all ${linkMode === 'qr' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground'}`}
                  onClick={() => setLinkMode("qr")}
                >
                  QR Code
                </button>
                <button 
                  className={`flex-1 text-xs font-bold py-1.5 rounded-md transition-all ${linkMode === 'phone' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground'}`}
                  onClick={() => setLinkMode("phone")}
                >
                  Phone Number
                </button>
              </div>

              {linkMode === "phone" && qrStatus !== "waiting_for_qr" && qrStatus !== "connected" && (
                <div className="w-full flex flex-col gap-2 mb-4">
                  <input
                    type="text"
                    placeholder="e.g. 256701234567"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full px-4 py-2 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#17458F]/30"
                  />
                  <button
                    onClick={() => handleLinkWhatsApp(phoneNumber)}
                    disabled={!phoneNumber.trim() || qrStatus === "initializing"}
                    className="w-full py-2 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-50"
                    style={{ background: NAVY }}
                  >
                    Get Pairing Code
                  </button>
                </div>
              )}

              {linkMode === "qr" && (qrStatus === "not_started" || qrStatus === "disconnected") && (
                <div className="w-full flex flex-col gap-2 mb-4">
                  <button
                    onClick={() => handleLinkWhatsApp()}
                    className="w-full py-2 rounded-xl text-xs font-bold text-white transition-all"
                    style={{ background: NAVY }}
                  >
                    Generate QR Code
                  </button>
                </div>
              )}

              <p className="text-xs text-slate-500 mb-6 px-4">
                {qrStatus === "not_started" && "Select your preferred authentication method above."}
                {qrStatus === "initializing" && "Initializing secure connection to your server..."}
                {qrStatus === "waiting_for_qr" && linkMode === "qr" && !qrCodeData?.startsWith("PAIRING_CODE:") && "Open WhatsApp > Linked Devices > Link a Device, and scan the QR code below."}
                {qrStatus === "waiting_for_qr" && qrCodeData?.startsWith("PAIRING_CODE:") && "Open WhatsApp > Linked Devices > Link with phone number instead, and enter the code below."}
                {qrStatus === "connected" && "Your WhatsApp is linked and ready to send automated messages!"}
                {qrStatus === "disconnected" && "Connection lost or logged out. Please try again."}
              </p>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 w-full flex items-center justify-center min-h-[240px]">
                {qrStatus === "not_started" && (
                  <div className="text-4xl opacity-20">👋</div>
                )}
                {qrStatus === "initializing" && (
                  <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
                )}
                
                {qrStatus === "waiting_for_qr" && qrCodeData && !qrCodeData.startsWith("PAIRING_CODE:") && linkMode === "qr" && (
                  <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100 animate-in fade-in zoom-in duration-300">
                    <QRCodeSVG value={qrCodeData} size={200} />
                  </div>
                )}

                {qrStatus === "waiting_for_qr" && qrCodeData?.startsWith("PAIRING_CODE:") && (
                  <div className="flex flex-col items-center gap-2 animate-in fade-in zoom-in duration-300">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Your Pairing Code</span>
                    <div className="bg-white px-6 py-4 rounded-xl shadow-sm border border-slate-200">
                      <p className="text-3xl font-black tracking-widest" style={{ color: NAVY }}>
                        {qrCodeData.split(":")[1]}
                      </p>
                    </div>
                  </div>
                )}
                
                {qrStatus === "connected" && (
                  <div className="w-20 h-20 rounded-full bg-emerald-100 border-4 border-white shadow-lg flex items-center justify-center text-emerald-500 animate-in zoom-in duration-500">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
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
