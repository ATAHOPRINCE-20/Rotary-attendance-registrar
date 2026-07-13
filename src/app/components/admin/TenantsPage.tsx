import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../../lib/supabase";
import { toast } from "sonner";
import { NAVY, GOLD } from "../../../lib/constants";
import { AdminLayout } from "../shared/AdminLayout";
import { useNavigate } from "react-router";
import { useAuth } from "../../../context/AuthContext";
import {
  Building,
  Search,
  X,
  Calendar,
  Users,
  CreditCard,
  TrendingUp,
  Globe,
  Settings,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  Phone,
  LogIn,
} from "lucide-react";
import { Organization } from "../../../types/database";

export function TenantsPage() {
  const navigate = useNavigate();
  const { impersonateOrganization } = useAuth();

  const [tenants, setTenants] = useState<Organization[]>([]);
  const [members, setMembers] = useState<{ id: string; organization_id: string }[]>([]);
  const [events, setEvents] = useState<{ id: string; organization_id: string }[]>([]);
  const [donations, setDonations] = useState<{ amount: number; organization_id: string; status: string }[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Edit Modal State
  const [selectedTenant, setSelectedTenant] = useState<Organization | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editTier, setEditTier] = useState<"free" | "standard" | "premium">("free");
  const [editExpiry, setEditExpiry] = useState("");
  const [editSuspended, setEditSuspended] = useState(false);
  const [editMomoPhone, setEditMomoPhone] = useState("");

  // Load all system data
  async function loadData() {
    setLoading(true);
    try {
      // Run queries in parallel bypassing organization filter using super_admin role policies
      const [orgsRes, memsRes, evtsRes, donsRes] = await Promise.all([
        supabase.from("organizations").select("*").order("name"),
        supabase.from("members").select("id, organization_id"),
        supabase.from("events").select("id, organization_id"),
        supabase.from("donations").select("amount, organization_id, status"),
      ]);

      if (orgsRes.error) throw orgsRes.error;
      if (memsRes.error) throw memsRes.error;
      if (evtsRes.error) throw evtsRes.error;
      if (donsRes.error) throw donsRes.error;

      setTenants(orgsRes.data || []);
      setMembers(memsRes.data || []);
      setEvents(evtsRes.data || []);
      setDonations(donsRes.data || []);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to load tenant management directory.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Compute aggregated stats
  const tenantStats = useMemo(() => {
    const stats: Record<
      string,
      { membersCount: number; eventsCount: number; donationsTotal: number }
    > = {};

    tenants.forEach((t) => {
      stats[t.id] = { membersCount: 0, eventsCount: 0, donationsTotal: 0 };
    });

    members.forEach((m) => {
      if (stats[m.organization_id]) stats[m.organization_id].membersCount++;
    });

    events.forEach((e) => {
      if (stats[e.organization_id]) stats[e.organization_id].eventsCount++;
    });

    donations.forEach((d) => {
      if (d.status === "completed" && stats[d.organization_id]) {
        stats[d.organization_id].donationsTotal += Number(d.amount);
      }
    });

    return stats;
  }, [tenants, members, events, donations]);

  // Overall KPIs
  const kpis = useMemo(() => {
    const total = tenants.length;
    const active = tenants.filter(t => !t.is_suspended).length;
    const totalMembers = members.length;
    const totalRev = donations
      .filter((d) => d.status === "completed")
      .reduce((a, d) => a + Number(d.amount), 0);

    return { total, active, totalMembers, totalRev };
  }, [tenants, members, donations]);

  // Filtered tenants list
  const filteredTenants = useMemo(() => {
    return tenants.filter((t) => {
      const matchSearch =
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.district && t.district.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchTier = tierFilter === "all" || t.subscription_tier === tierFilter;
      
      const isSuspendedVal = t.is_suspended ?? false;
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "suspended" && isSuspendedVal) ||
        (statusFilter === "active" && !isSuspendedVal);

      return matchSearch && matchTier && matchStatus;
    });
  }, [tenants, searchTerm, tierFilter, statusFilter]);

  // Open Edit Modal
  function handleOpenEdit(tenant: Organization) {
    setSelectedTenant(tenant);
    setEditTier((tenant.subscription_tier as any) || "free");
    setEditExpiry(tenant.subscription_expires_at ? tenant.subscription_expires_at.split("T")[0] : "");
    setEditSuspended(tenant.is_suspended ?? false);
    setEditMomoPhone(tenant.momo_phone || "");
  }

  // Submit Edit Form
  async function handleSaveTenant(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTenant) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({
          subscription_tier: editTier,
          subscription_expires_at: editExpiry ? new Date(editExpiry).toISOString() : null,
          is_suspended: editSuspended,
          momo_phone: editMomoPhone.trim() || null,
        })
        .eq("id", selectedTenant.id);

      if (error) throw error;

      toast.success(`Tenant ${selectedTenant.name} updated successfully!`);
      setSelectedTenant(null);
      await loadData();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to update tenant configuration.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminLayout pageTitle="Tenants Directory">
      <div className="flex-1 min-h-screen">
        {/* Page Heading */}
        <div className="mb-6">
          <h1 className="text-2xl font-black" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
            Tenants Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitor, license, and configure billing settings for all club subdomains.
          </p>
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[
            {
              label: "Total Registered Tenants",
              val: kpis.total,
              icon: Building,
              color: "#0067C8",
              bg: "#0067C812",
            },
            {
              label: "Active Subscriptions",
              val: kpis.active,
              icon: CheckCircle2,
              color: "#10B981",
              bg: "#10B98112",
            },
            {
              label: "Aggregated System Members",
              val: kpis.totalMembers,
              icon: Users,
              color: GOLD,
              bg: `${GOLD}12`,
            },
            {
              label: "System Donation Revenue",
              val: `UGX ${kpis.totalRev.toLocaleString()}`,
              icon: TrendingUp,
              color: "#E53E3E",
              bg: "#E53E3E12",
            },
          ].map((c, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-5 border border-border/40 shadow-sm flex flex-col gap-2"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: c.bg, color: c.color }}
              >
                <c.icon size={18} />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{c.label}</p>
                <p className="text-xl font-black mt-0.5" style={{ color: NAVY }}>
                  {c.val}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Controls & Filter Bar ── */}
        <div className="bg-white rounded-2xl p-5 border border-border/40 shadow-sm mb-6 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              placeholder="Search club name, slug, or district..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-border bg-input-background focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2.5 focus:outline-none font-semibold text-slate-700 cursor-pointer"
            >
              <option value="all">All Subscription Tiers</option>
              <option value="free">Free Tier</option>
              <option value="standard">Standard Tier</option>
              <option value="premium">Premium Tier</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2.5 focus:outline-none font-semibold text-slate-700 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Tenants Only</option>
              <option value="suspended">Suspended Tenants Only</option>
            </select>
          </div>
        </div>

        {/* ── Tenants Table ── */}
        <div className="bg-white rounded-2xl border border-border/40 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-[#17458F] rounded-full animate-spin" />
            </div>
          ) : filteredTenants.length === 0 ? (
            <p className="text-sm text-muted-foreground py-16 text-center">No tenants match the specified filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/25 text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider">
                    <th className="py-4 px-4">Club / District</th>
                    <th className="py-4 px-3">Portal URL</th>
                    <th className="py-4 px-3 text-center">Members</th>
                    <th className="py-4 px-3 text-center">Events</th>
                    <th className="py-4 px-3 text-center">Donations (UGX)</th>
                    <th className="py-4 px-3">Subscription</th>
                    <th className="py-4 px-3">Status</th>
                    <th className="py-4 px-4 text-center">Manage</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTenants.map((t) => {
                    const stats = tenantStats[t.id] || { membersCount: 0, eventsCount: 0, donationsTotal: 0 };
                    const isSuspended = t.is_suspended ?? false;
                    const tier = t.subscription_tier || "free";
                    const expiresAt = t.subscription_expires_at;

                    // Compute expiry date status
                    const isExpired = expiresAt ? new Date(expiresAt).getTime() < Date.now() : false;

                    return (
                      <tr key={t.id} className="border-b border-border/30 hover:bg-slate-50/40 transition-colors">
                        <td className="py-4 px-4 font-bold text-foreground">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[#17458F]/5 border border-[#17458F]/10 flex items-center justify-center shrink-0">
                              {t.logo_url ? (
                                <img
                                  src={t.logo_url.startsWith("http") ? t.logo_url : window.location.origin + t.logo_url}
                                  alt={t.name}
                                  className="w-full h-full object-contain p-0.5 rounded-lg"
                                />
                              ) : (
                                <span className="font-extrabold text-[10px]" style={{ color: NAVY }}>
                                  {t.name.substring(0, 2).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-foreground truncate max-w-[160px]">{t.name}</p>
                              <p className="text-[10px] text-muted-foreground font-medium">District {t.district || "—"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-3">
                          <a
                            href={`https://${t.slug}.agoroll.com`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline font-semibold flex items-center gap-1.5"
                          >
                            <Globe size={12} />
                            {t.slug}
                          </a>
                        </td>
                        <td className="py-4 px-3 text-center font-bold text-foreground">{stats.membersCount}</td>
                        <td className="py-4 px-3 text-center font-bold text-foreground">{stats.eventsCount}</td>
                        <td className="py-4 px-3 text-center font-extrabold text-emerald-700">
                          {stats.donationsTotal.toLocaleString()}
                        </td>
                        <td className="py-4 px-3">
                          <div className="flex flex-col gap-0.5">
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md inline-block w-fit ${
                              tier === "premium"
                                ? "bg-purple-100 text-purple-800"
                                : tier === "standard"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-slate-100 text-slate-800"
                            }`}>
                              {tier}
                            </span>
                            <span className={`text-[10px] font-semibold mt-0.5 ${isExpired ? 'text-rose-600 font-bold' : 'text-muted-foreground'}`}>
                              {expiresAt
                                ? `${isExpired ? 'Expired' : 'Expires'}: ${new Date(expiresAt).toLocaleDateString("en-GB")}`
                                : "No Expiration"}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            isSuspended
                              ? "bg-rose-100 text-rose-800 border border-rose-200"
                              : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          }`}>
                            {isSuspended ? "Suspended" : "Active"}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => {
                                impersonateOrganization(t.id);
                                toast.success(`Now impersonating ${t.name}. Redirecting to dashboard...`);
                                navigate("/admin/dashboard");
                              }}
                              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
                              title="Impersonate club admin"
                            >
                              <LogIn size={14} />
                            </button>
                            <button
                              onClick={() => handleOpenEdit(t)}
                              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                              title="Manage subscription"
                            >
                              <Settings size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Edit License / Subscription Modal ── */}
        {selectedTenant && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-border shadow-2xl w-full max-w-md overflow-hidden flex flex-col p-6 animate-in zoom-in-95 duration-150 relative">
              <button
                onClick={() => setSelectedTenant(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border/40">
                <div className="w-10 h-10 rounded-xl bg-[#17458F]/5 text-[#17458F] border border-[#17458F]/10 flex items-center justify-center">
                  <Building size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground" style={{ color: NAVY }}>
                    Configure Subscription
                  </h3>
                  <p className="text-[10px] text-muted-foreground font-medium">{selectedTenant.name}</p>
                </div>
              </div>

              <form onSubmit={handleSaveTenant} className="flex flex-col gap-4">
                {/* Subscription Tier */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Subscription Tier</label>
                  <select
                    value={editTier}
                    onChange={(e) => setEditTier(e.target.value as any)}
                    className="w-full px-3 py-2.5 text-xs rounded-xl border border-border bg-input-background focus:outline-none font-semibold text-slate-700"
                  >
                    <option value="free">Free Plan</option>
                    <option value="standard">Standard Plan</option>
                    <option value="premium">Premium Plan</option>
                  </select>
                </div>

                {/* Expiration Date */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Expiration Date (Leave blank for indefinite)</label>
                  <input
                    type="date"
                    value={editExpiry}
                    onChange={(e) => setEditExpiry(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs rounded-xl border border-border bg-input-background focus:outline-none"
                  />
                </div>

                {/* Mobile Money Phone Number */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                    <Phone size={10} className="text-muted-foreground" />
                    MTN/Airtel MoMo Number for push invoices
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 256770123456"
                    value={editMomoPhone}
                    onChange={(e) => setEditMomoPhone(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs rounded-xl border border-border bg-input-background focus:outline-none"
                  />
                </div>

                {/* Status: Suspended Switch */}
                <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl my-1">
                  <div className="flex items-center gap-2">
                    {editSuspended ? (
                      <Lock size={16} className="text-rose-600" />
                    ) : (
                      <Unlock size={16} className="text-emerald-600" />
                    )}
                    <div>
                      <p className="text-xs font-bold text-foreground">Suspend Access</p>
                      <p className="text-[9px] text-muted-foreground font-medium">Instantly restrict administrative access</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditSuspended(!editSuspended)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase border cursor-pointer transition-all ${
                      editSuspended
                        ? "bg-rose-50 border-rose-200 text-rose-700"
                        : "bg-slate-100 border-slate-200 text-slate-700"
                    }`}
                  >
                    {editSuspended ? "Suspended" : "Active"}
                  </button>
                </div>

                {/* Modal Actions */}
                <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setSelectedTenant(null)}
                    className="px-4 py-2 text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-border cursor-pointer transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 text-xs font-bold text-white hover:opacity-90 rounded-xl cursor-pointer transition-all shadow-sm flex items-center justify-center min-w-[90px]"
                    style={{ backgroundColor: NAVY }}
                  >
                    {submitting ? "Saving..." : "Save Settings"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
