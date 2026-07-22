import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../../context/AuthContext";
import { supabase } from "../../../lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "../shared/AdminLayout";
import { PageCard } from "../shared/PageCard";
import { NAVY, GOLD } from "../../../lib/constants";
import { RotaryLogo } from "../shared/RotaryLogo";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Coins,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  XCircle,
  BarChart3,
  Users,
  Heart,
  History,
  PiggyBank,
  Activity,
  ArrowRight,
  Search,
  Send,
  Filter,
  FileSpreadsheet,
  Plus,
  Loader2,
  Check,
  Layers,
  Calendar as CalendarIcon,
} from "lucide-react";
import { toast } from "sonner";
import { LoadingScreen } from "../shared/LoadingScreen";
import type { Donation, Withdrawal } from "../../../types/database";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtendedDuesBalance {
  id: string;
  member_id: string;
  dues_category_id: string;
  amount_due: number;
  amount_paid: number;
  due_date?: string;
  status: "unpaid" | "partially_paid" | "paid";
  created_at: string;
  members?: {
    full_name: string;
    email: string;
    phone?: string;
  };
  dues_categories?: {
    name: string;
  };
}

interface DuesCategory {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  billing_frequency: "one-off" | "monthly" | "quarterly" | "annually";
  default_amount: number;
  currency: string;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  accent,
  sub,
  trend,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  accent?: boolean;
  sub?: string;
  trend?: { value: string; up: boolean };
}) {
  return (
    <div
      className="bg-white rounded-2xl p-5 border border-border/40 shadow-sm flex flex-col gap-3 transition-all hover:shadow-md hover:-translate-y-0.5"
      style={accent ? { borderLeft: `4px solid ${GOLD}` } : {}}
    >
      <div className="flex items-center justify-between">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: iconBg, color: iconColor }}
        >
          <Icon size={18} />
        </div>
        {trend && (
          <span
            className={`flex items-center gap-0.5 text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
              trend.up
                ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-600"
            }`}
          >
            {trend.up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {trend.value}
          </span>
        )}
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground font-bold tracking-wider uppercase">
          {label}
        </p>
        <p className="text-xl font-black mt-0.5" style={{ color: NAVY }}>
          {value}
        </p>
        {sub && (
          <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
        )}
      </div>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string; icon: React.ElementType }> = {
    completed:      { label: "Completed", className: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
    pending:        { label: "Pending",   className: "bg-amber-100 text-amber-700",   icon: Clock       },
    failed:         { label: "Failed",    className: "bg-red-100 text-red-600",       icon: XCircle     },
    paid:           { label: "Paid",           className: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
    partially_paid: { label: "Partial",        className: "bg-blue-100 text-blue-700",       icon: Clock       },
    unpaid:         { label: "Unpaid",         className: "bg-slate-100 text-slate-600",     icon: Clock       },
  };
  const cfg = map[status] ?? { label: status, className: "bg-slate-100 text-slate-600", icon: Clock };
  const Ico = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-extrabold uppercase ${cfg.className}`}>
      <Ico size={8} /> {cfg.label}
    </span>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function TreasurerDashboard() {
  const { profile, organization } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Tab state
  const [activeTab, setActiveTab] = useState<"overview" | "dues" | "donations" | "withdrawals">("overview");

  // Search & Filter states
  const [duesSearch, setDuesSearch] = useState("");
  const [duesStatusFilter, setDuesStatusFilter] = useState<string>("all");

  const [donSearch, setDonSearch] = useState("");
  const [donStatusFilter, setDonStatusFilter] = useState<string>("all");

  const [withSearch, setWithSearch] = useState("");

  // Modal states for Assigning Dues & Creating Categories
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  // Assign Dues Form State
  const [selectedCatId, setSelectedCatId] = useState("");
  const [assignAmount, setAssignAmount] = useState("");
  const [assignDueDate, setAssignDueDate] = useState("");
  const [targetType, setTargetType] = useState<"all" | "single">("all");
  const [singleMemberId, setSingleMemberId] = useState("");
  const [assigning, setAssigning] = useState(false);

  // New Category Form State
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");
  const [catFrequency, setCatFrequency] = useState<"one-off" | "monthly" | "quarterly" | "annually">("annually");
  const [catDefaultAmount, setCatDefaultAmount] = useState("");
  const [creatingCat, setCreatingCat] = useState(false);

  // ── Data Queries ──────────────────────────────────────────────────────────

  const { data: donations, isLoading: donLoading } = useQuery<Donation[]>({
    queryKey: ["treasurer-donations", organization?.id],
    enabled: !!organization?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("donations")
        .select("*")
        .eq("organization_id", organization!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: withdrawals, isLoading: withLoading } = useQuery<Withdrawal[]>({
    queryKey: ["treasurer-withdrawals", organization?.id],
    enabled: !!organization?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawals")
        .select("*")
        .eq("organization_id", organization!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: duesBalances, isLoading: duesLoading } = useQuery<ExtendedDuesBalance[]>({
    queryKey: ["treasurer-dues-balances-extended", organization?.id],
    enabled: !!organization?.id,
    queryFn: async () => {
      const { data: members, error: memErr } = await supabase
        .from("members")
        .select("id, full_name, email, phone")
        .eq("organization_id", organization!.id);

      if (memErr) throw memErr;
      if (!members || members.length === 0) return [];

      const memberIds = members.map((m) => m.id);

      const { data: balances, error: balErr } = await supabase
        .from("member_dues_balances")
        .select("*, dues_categories(name)")
        .in("member_id", memberIds)
        .order("created_at", { ascending: false });

      if (balErr) throw balErr;

      const memberMap = new Map(members.map((m) => [m.id, m]));

      return (balances || []).map((b: any) => ({
        ...b,
        members: memberMap.get(b.member_id),
      })) as ExtendedDuesBalance[];
    },
  });

  const { data: duesCategories } = useQuery<DuesCategory[]>({
    queryKey: ["dues-categories", organization?.id],
    enabled: !!organization?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dues_categories")
        .select("*")
        .eq("organization_id", organization!.id)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: membersList } = useQuery<{ id: string; full_name: string; email: string }[]>({
    queryKey: ["all-members-list", organization?.id],
    enabled: !!organization?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id, full_name, email")
        .eq("organization_id", organization!.id)
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  const loading = donLoading || withLoading || duesLoading;

  // ── Financial Calculations ────────────────────────────────────────────────

  const completedDonations = donations?.filter((d) => d.status === "completed") ?? [];
  const totalRaised        = completedDonations.reduce((s, d) => s + Number(d.amount), 0);
  const totalWithdrawn     = withdrawals
    ?.filter((w) => w.status === "completed" || w.status === "pending")
    .reduce((s, w) => s + Number(w.amount), 0) ?? 0;
  const netBalance         = totalRaised - totalWithdrawn;
  const pendingDonations   = donations?.filter((d) => d.status === "pending").length ?? 0;

  const totalDuesBilled   = duesBalances?.reduce((s, b) => s + Number(b.amount_due), 0) ?? 0;
  const totalDuesCollected = duesBalances?.reduce((s, b) => s + Number(b.amount_paid), 0) ?? 0;
  const duesOutstanding   = totalDuesBilled - totalDuesCollected;
  const duesCollectionRate =
    totalDuesBilled > 0 ? Math.round((totalDuesCollected / totalDuesBilled) * 100) : 0;

  const initials = profile?.full_name
    ?.split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() ?? "TR";

  // ── CSV Export Function ───────────────────────────────────────────────────

  function exportDonationsCSV() {
    if (!donations || donations.length === 0) {
      toast.error("No donations data to export.");
      return;
    }

    const headers = ["ID", "Donor Name", "Email", "Phone", "Amount", "Currency", "Category", "Status", "Date"];
    const rows = donations.map((d) => [
      d.id,
      `"${d.full_name || "Anonymous"}"`,
      `"${d.email || ""}"`,
      `"${d.phone_number || (d as any).phone || ""}"`,
      d.amount,
      d.currency || "UGX",
      `"${d.category || "General"}"`,
      d.status,
      new Date(d.created_at).toISOString(),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `donations_export_${organization?.slug || "club"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Donations exported as CSV!");
  }

  // ── Handlers for Assigning Dues & Creating Categories ───────────────────────

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!organization || !catName || !catDefaultAmount) return;

    setCreatingCat(true);
    try {
      const { error } = await supabase.from("dues_categories").insert({
        organization_id: organization.id,
        name: catName,
        description: catDesc || null,
        billing_frequency: catFrequency,
        default_amount: parseFloat(catDefaultAmount),
        currency: "UGX",
      });

      if (error) throw error;

      toast.success(`Dues category "${catName}" created!`);
      setCatName("");
      setCatDesc("");
      setCatDefaultAmount("");
      setCategoryModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["dues-categories", organization.id] });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to create category");
    } finally {
      setCreatingCat(false);
    }
  }

  async function handleAssignDues(e: React.FormEvent) {
    e.preventDefault();
    if (!organization || !selectedCatId || !assignAmount) {
      toast.error("Please select a category and amount.");
      return;
    }

    setAssigning(true);
    try {
      let targetMembers: string[] = [];

      if (targetType === "all") {
        targetMembers = membersList?.map((m) => m.id) ?? [];
      } else {
        if (!singleMemberId) {
          toast.error("Please select a member.");
          setAssigning(false);
          return;
        }
        targetMembers = [singleMemberId];
      }

      if (targetMembers.length === 0) {
        toast.error("No members found to assign dues.");
        setAssigning(false);
        return;
      }

      const numAmount = parseFloat(assignAmount);
      const records = targetMembers.map((memId) => ({
        member_id: memId,
        dues_category_id: selectedCatId,
        amount_due: numAmount,
        amount_paid: 0,
        due_date: assignDueDate ? new Date(assignDueDate).toISOString() : null,
        status: "unpaid",
      }));

      const { error } = await supabase.from("member_dues_balances").insert(records);
      if (error) throw error;

      toast.success(`Dues assigned successfully to ${records.length} member(s)!`);
      setAssignModalOpen(false);
      setSelectedCatId("");
      setAssignAmount("");
      setAssignDueDate("");
      setSingleMemberId("");
      queryClient.invalidateQueries({ queryKey: ["treasurer-dues-balances-extended", organization.id] });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to assign dues.");
    } finally {
      setAssigning(false);
    }
  }

  // ── Filtered Dues Balances ────────────────────────────────────────────────

  const filteredDues = (duesBalances ?? []).filter((b) => {
    const nameMatch = b.members?.full_name?.toLowerCase().includes(duesSearch.toLowerCase()) ||
                      b.dues_categories?.name?.toLowerCase().includes(duesSearch.toLowerCase());
    const statusMatch = duesStatusFilter === "all" || b.status === duesStatusFilter;
    return nameMatch && statusMatch;
  });

  // ── Filtered Donations ────────────────────────────────────────────────────

  const filteredDonations = (donations ?? []).filter((d) => {
    const matchSearch = (d.full_name || "").toLowerCase().includes(donSearch.toLowerCase()) ||
                        (d.category || "").toLowerCase().includes(donSearch.toLowerCase()) ||
                        (d.email || "").toLowerCase().includes(donSearch.toLowerCase());
    const matchStatus = donStatusFilter === "all" || d.status === donStatusFilter;
    return matchSearch && matchStatus;
  });

  // ── Filtered Withdrawals ──────────────────────────────────────────────────

  const filteredWithdrawals = (withdrawals ?? []).filter((w) => {
    return (w.recipient_name || "").toLowerCase().includes(withSearch.toLowerCase()) ||
           (w.recipient_phone || "").includes(withSearch);
  });

  if (loading) return <LoadingScreen variant="light" />;

  return (
    <AdminLayout pageTitle="Treasurer Dashboard">
      <div className="flex flex-col gap-6 max-w-7xl mx-auto">

        {/* ── WELCOME HEADER ── */}
        <div
          className="rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 overflow-hidden relative"
          style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #0a2c6d 60%, #0067C8 100%)` }}
        >
          {/* Left content */}
          <div className="flex items-center gap-4 z-10 relative">
            <div
              className="w-12 h-12 rounded-full text-white font-black text-lg flex items-center justify-center shrink-0 border-2 border-white/20"
              style={{ background: "rgba(247,168,27,0.25)" }}
            >
              {initials}
            </div>
            <div>
              <p className="text-white/60 text-[11px] font-bold uppercase tracking-widest">
                Club Treasurer Portal
              </p>
              <h1
                className="text-white text-xl font-black mt-0.5"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                {organization?.name ?? "Your Club"}
              </h1>
              <p className="text-white/60 text-xs mt-0.5">
                Welcome back, {profile?.full_name?.split(" ")[0] ?? "Treasurer"}
              </p>
            </div>
          </div>

          {/* Right: logo */}
          <div className="opacity-10 absolute right-6 top-1/2 -translate-y-1/2">
            <RotaryLogo size={96} />
          </div>

          {/* Quick-access badges */}
          <div className="flex gap-2 flex-wrap z-10 relative">
            <button
              onClick={() => navigate("/admin/withdrawals")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition-all cursor-pointer border border-white/10"
            >
              <Wallet size={13} /> Withdrawals
            </button>
            <button
              onClick={() => navigate("/admin/analytics")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer border border-transparent"
              style={{ background: GOLD, color: "#1A1C22" }}
            >
              <BarChart3 size={13} /> Analytics
            </button>
          </div>
        </div>

        {/* ── TAB NAVIGATION ── */}
        <div className="flex items-center gap-2 border-b border-border/60 pb-1 overflow-x-auto">
          {[
            { id: "overview",    label: "Financial Overview", icon: Activity },
            { id: "dues",        label: "Dues Management",    icon: Users },
            { id: "donations",   label: "Payment Tracking",   icon: Heart },
            { id: "withdrawals", label: "Withdrawals Log",    icon: History },
          ].map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  active
                    ? "bg-white text-slate-900 shadow-sm border border-border/60"
                    : "text-muted-foreground hover:bg-white/50 hover:text-slate-900"
                }`}
                style={active ? { borderBottom: `2px solid ${NAVY}` } : {}}
              >
                <Icon size={14} style={{ color: active ? NAVY : undefined }} />
                {label}
              </button>
            );
          })}
        </div>

        {/* ── TAB 1: OVERVIEW ── */}
        {activeTab === "overview" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            {/* KPI STAT CARDS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Total Donations"
                value={`UGX ${totalRaised.toLocaleString()}`}
                icon={TrendingUp}
                iconBg="#10B98118"
                iconColor="#10B981"
                sub={`${completedDonations.length} payments`}
              />
              <StatCard
                label="Net Balance"
                value={`UGX ${netBalance.toLocaleString()}`}
                icon={Wallet}
                iconBg={`${GOLD}18`}
                iconColor={GOLD}
                accent
                sub="Available to withdraw"
              />
              <StatCard
                label="Total Withdrawn"
                value={`UGX ${totalWithdrawn.toLocaleString()}`}
                icon={ArrowUpRight}
                iconBg="#E53E3E18"
                iconColor="#E53E3E"
                sub={`${withdrawals?.length ?? 0} transactions`}
              />
              <StatCard
                label="Pending Donations"
                value={String(pendingDonations)}
                icon={Clock}
                iconBg="#F59E0B18"
                iconColor="#F59E0B"
                sub="Awaiting confirmation"
              />
            </div>

            {/* DUES KPI CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard
                label="Dues Billed"
                value={`UGX ${totalDuesBilled.toLocaleString()}`}
                icon={Coins}
                iconBg={`${NAVY}12`}
                iconColor={NAVY}
                sub="Total dues assigned to members"
              />
              <StatCard
                label="Dues Collected"
                value={`UGX ${totalDuesCollected.toLocaleString()}`}
                icon={PiggyBank}
                iconBg="#10B98118"
                iconColor="#10B981"
                sub={`${duesCollectionRate}% collection rate`}
                trend={{ value: `${duesCollectionRate}%`, up: duesCollectionRate >= 50 }}
              />
              <StatCard
                label="Outstanding Dues"
                value={`UGX ${duesOutstanding.toLocaleString()}`}
                icon={Activity}
                iconBg="#E53E3E18"
                iconColor="#E53E3E"
                sub={`${duesBalances?.filter((b) => b.status !== "paid").length ?? 0} unpaid accounts`}
              />
            </div>

            {/* DUES COLLECTION BREAKDOWN SUMMARY CARD */}
            <PageCard className="p-6 bg-white border border-border/40 shadow-sm max-w-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users size={16} style={{ color: NAVY }} />
                  <h3 className="text-sm font-black" style={{ color: NAVY }}>
                    Club Dues Collection Status
                  </h3>
                </div>
                <button
                  onClick={() => setActiveTab("dues")}
                  className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  Manage Dues <ArrowRight size={12} />
                </button>
              </div>

              {/* Collection Rate Bar */}
              <div className="mb-5">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Overall Collection Progress
                  </span>
                  <span className="text-sm font-black" style={{ color: NAVY }}>
                    {duesCollectionRate}%
                  </span>
                </div>
                <div className="h-3 rounded-full bg-slate-100 overflow-hidden border border-slate-200/60">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${duesCollectionRate}%`,
                      background: duesCollectionRate >= 80
                        ? "#10B981"
                        : duesCollectionRate >= 50
                        ? GOLD
                        : "#E53E3E",
                    }}
                  />
                </div>
              </div>

              {/* Status Breakdown Grid */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    label: "Fully Paid",
                    count: duesBalances?.filter((b) => b.status === "paid").length ?? 0,
                    color: "#10B981",
                    bg: "#10B98112",
                  },
                  {
                    label: "Partially Paid",
                    count: duesBalances?.filter((b) => b.status === "partially_paid").length ?? 0,
                    color: "#F59E0B",
                    bg: "#F59E0B12",
                  },
                  {
                    label: "Unpaid",
                    count: duesBalances?.filter((b) => b.status === "unpaid").length ?? 0,
                    color: "#E53E3E",
                    bg: "#E53E3E12",
                  },
                ].map(({ label, count, color, bg }) => (
                  <div
                    key={label}
                    className="flex flex-col items-center justify-center p-3 rounded-xl text-center"
                    style={{ background: bg }}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color }}>
                      {label}
                    </span>
                    <span className="text-base font-black" style={{ color }}>
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </PageCard>
          </div>
        )}

        {/* ── TAB 2: DUES MANAGEMENT ── */}
        {activeTab === "dues" && (
          <div className="flex flex-col gap-5 animate-in fade-in duration-200">
            {/* Header controls with Assign & Category buttons */}
            <PageCard className="p-4 bg-white border border-border/40 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search member or dues category..."
                    value={duesSearch}
                    onChange={(e) => setDuesSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-border/60 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#17458F]/20"
                  />
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Filter size={13} className="text-muted-foreground" />
                  <select
                    value={duesStatusFilter}
                    onChange={(e) => setDuesStatusFilter(e.target.value)}
                    className="bg-slate-50 border border-border/60 rounded-xl text-xs py-2 px-3 focus:outline-none"
                  >
                    <option value="all">All Statuses</option>
                    <option value="unpaid">Unpaid</option>
                    <option value="partially_paid">Partially Paid</option>
                    <option value="paid">Fully Paid</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={() => setCategoryModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  <Layers size={14} /> New Dues Category
                </button>
                <button
                  onClick={() => setAssignModalOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 text-slate-900 text-xs font-black rounded-xl transition-all shadow-sm cursor-pointer"
                  style={{ background: GOLD }}
                >
                  <Plus size={14} /> Assign Dues
                </button>
              </div>
            </PageCard>

            {/* Dues table */}
            <PageCard className="overflow-hidden p-0 bg-white border border-border/40 shadow-sm">
              {filteredDues.length === 0 ? (
                <div className="py-16 text-center">
                  <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No matching dues records found</p>
                  <p className="text-xs text-slate-400 mt-1">Click "Assign Dues" above to bill members.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-slate-50/50 font-bold text-muted-foreground uppercase text-[9px] tracking-wider">
                        <th className="px-5 py-3.5">Member</th>
                        <th className="px-5 py-3.5">Dues Category</th>
                        <th className="px-5 py-3.5 text-right">Amount Due</th>
                        <th className="px-5 py-3.5 text-right">Amount Paid</th>
                        <th className="px-5 py-3.5 text-right">Outstanding</th>
                        <th className="px-5 py-3.5 text-center">Status</th>
                        <th className="px-5 py-3.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {filteredDues.map((b) => {
                        const due = Number(b.amount_due);
                        const paid = Number(b.amount_paid);
                        const outstanding = Math.max(0, due - paid);
                        const memberName = b.members?.full_name || "Unknown Member";

                        return (
                          <tr key={b.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-5 py-3.5 font-bold text-foreground">
                              {memberName}
                              {b.members?.email && (
                                <p className="text-[10px] text-muted-foreground font-normal">{b.members.email}</p>
                              )}
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="px-2.5 py-1 rounded bg-slate-100 text-[10px] font-bold text-slate-700">
                                {b.dues_categories?.name || "General Dues"}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right font-bold text-slate-700">
                              UGX {due.toLocaleString()}
                            </td>
                            <td className="px-5 py-3.5 text-right font-bold text-emerald-600">
                              UGX {paid.toLocaleString()}
                            </td>
                            <td className="px-5 py-3.5 text-right font-black text-rose-600">
                              UGX {outstanding.toLocaleString()}
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              <StatusBadge status={b.status} />
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              {b.status !== "paid" ? (
                                <button
                                  onClick={() =>
                                    toast.success(`Payment reminder queued for ${memberName}`)
                                  }
                                  className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                                >
                                  <Send size={11} /> Remind
                                </button>
                              ) : (
                                <span className="text-[10px] text-emerald-600 font-bold">Cleared</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </PageCard>
          </div>
        )}

        {/* ── TAB 3: PAYMENT TRACKING (DONATIONS) ── */}
        {activeTab === "donations" && (
          <div className="flex flex-col gap-5 animate-in fade-in duration-200">
            {/* Header controls & Export button */}
            <PageCard className="p-4 bg-white border border-border/40 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search donor name or category..."
                    value={donSearch}
                    onChange={(e) => setDonSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-border/60 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#17458F]/20"
                  />
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Filter size={13} className="text-muted-foreground" />
                  <select
                    value={donStatusFilter}
                    onChange={(e) => setDonStatusFilter(e.target.value)}
                    className="bg-slate-50 border border-border/60 rounded-xl text-xs py-2 px-3 focus:outline-none"
                  >
                    <option value="all">All Statuses</option>
                    <option value="completed">Completed</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
              </div>

              <button
                onClick={exportDonationsCSV}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
              >
                <FileSpreadsheet size={14} /> Export CSV
              </button>
            </PageCard>

            {/* Donations Table */}
            <PageCard className="overflow-hidden p-0 bg-white border border-border/40 shadow-sm">
              {filteredDonations.length === 0 ? (
                <div className="py-16 text-center">
                  <Heart className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No donations found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-slate-50/50 font-bold text-muted-foreground uppercase text-[9px] tracking-wider">
                        <th className="px-5 py-3.5">Donor Name</th>
                        <th className="px-5 py-3.5">Contact</th>
                        <th className="px-5 py-3.5">Category</th>
                        <th className="px-5 py-3.5 text-right">Amount</th>
                        <th className="px-5 py-3.5 text-center">Status</th>
                        <th className="px-5 py-3.5 text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {filteredDonations.map((d) => (
                        <tr key={d.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-5 py-3.5 font-bold text-foreground">
                            {d.full_name || "Anonymous Donor"}
                          </td>
                          <td className="px-5 py-3.5 text-muted-foreground">
                            {d.phone_number || (d as any).phone || d.email || "—"}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-bold text-slate-700 uppercase">
                              {d.category || "General"}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right font-black text-foreground">
                            {d.currency || "UGX"} {Number(d.amount).toLocaleString()}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <StatusBadge status={d.status} />
                          </td>
                          <td className="px-5 py-3.5 text-right text-muted-foreground">
                            {new Date(d.created_at).toLocaleDateString("en-GB", {
                              day: "numeric", month: "short", year: "numeric",
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </PageCard>
          </div>
        )}

        {/* ── TAB 4: WITHDRAWALS ── */}
        {activeTab === "withdrawals" && (
          <div className="flex flex-col gap-5 animate-in fade-in duration-200">
            {/* Search Bar */}
            <PageCard className="p-4 bg-white border border-border/40 shadow-sm flex items-center justify-between">
              <div className="relative w-full sm:w-72">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search recipient name or phone..."
                  value={withSearch}
                  onChange={(e) => setWithSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-border/60 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#17458F]/20"
                />
              </div>

              <button
                onClick={() => navigate("/admin/withdrawals")}
                className="flex items-center gap-1.5 px-4 py-2 text-white font-bold text-xs rounded-xl shadow-sm cursor-pointer"
                style={{ background: NAVY }}
              >
                <Wallet size={14} /> Manage Withdrawals
              </button>
            </PageCard>

            {/* Withdrawals Log */}
            <PageCard className="overflow-hidden p-0 bg-white border border-border/40 shadow-sm">
              {filteredWithdrawals.length === 0 ? (
                <div className="py-16 text-center">
                  <History className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No withdrawal records found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-slate-50/50 font-bold text-muted-foreground uppercase text-[9px] tracking-wider">
                        <th className="px-5 py-3.5">Recipient</th>
                        <th className="px-5 py-3.5">Phone Number</th>
                        <th className="px-5 py-3.5 text-right">Amount</th>
                        <th className="px-5 py-3.5 text-center">Status</th>
                        <th className="px-5 py-3.5 text-right">Date Requested</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {filteredWithdrawals.map((w) => (
                        <tr key={w.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-5 py-3.5 font-bold text-foreground">
                            {w.recipient_name || "Club Treasurer"}
                          </td>
                          <td className="px-5 py-3.5 font-mono text-muted-foreground">
                            {w.recipient_phone}
                          </td>
                          <td className="px-5 py-3.5 text-right font-black text-rose-600">
                            UGX {Number(w.amount).toLocaleString()}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <StatusBadge status={w.status} />
                          </td>
                          <td className="px-5 py-3.5 text-right text-muted-foreground">
                            {new Date(w.created_at).toLocaleDateString("en-GB", {
                              day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </PageCard>
          </div>
        )}
      </div>

      {/* ── MODAL 1: ASSIGN DUES TO MEMBERS ── */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <PageCard className="w-full max-w-md bg-white border border-border rounded-2xl shadow-2xl p-6 flex flex-col gap-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-md font-black uppercase tracking-wider" style={{ color: NAVY }}>
                Assign Dues to Members
              </h3>
              <button
                onClick={() => setAssignModalOpen(false)}
                className="text-xs text-slate-500 hover:text-slate-800 font-bold px-2 py-1 bg-slate-100 rounded-lg cursor-pointer"
                disabled={assigning}
              >
                Close
              </button>
            </div>

            <form onSubmit={handleAssignDues} className="flex flex-col gap-4">
              {/* Select Dues Category */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Dues Category</label>
                <select
                  value={selectedCatId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedCatId(id);
                    const cat = duesCategories?.find((c) => c.id === id);
                    if (cat) {
                      setAssignAmount(String(cat.default_amount));
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl border border-border bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#17458F]/20 font-bold"
                  required
                >
                  <option value="">Select a Category...</option>
                  {duesCategories?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Default: UGX {Number(c.default_amount).toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount Due */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Amount Due (UGX)</label>
                <input
                  type="number"
                  placeholder="e.g. 150000"
                  value={assignAmount}
                  onChange={(e) => setAssignAmount(e.target.value)}
                  className="px-4 py-2.5 rounded-xl border border-border bg-slate-50 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#17458F]/20"
                  required
                />
              </div>

              {/* Due Date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Due Date (Optional)</label>
                <input
                  type="date"
                  value={assignDueDate}
                  onChange={(e) => setAssignDueDate(e.target.value)}
                  className="px-4 py-2.5 rounded-xl border border-border bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#17458F]/20"
                />
              </div>

              {/* Target Selection */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Assign To</label>
                <div className="flex items-center gap-4 bg-slate-50 p-2.5 rounded-xl border border-border">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="targetType"
                      value="all"
                      checked={targetType === "all"}
                      onChange={() => setTargetType("all")}
                    />
                    All Members ({membersList?.length ?? 0})
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="targetType"
                      value="single"
                      checked={targetType === "single"}
                      onChange={() => setTargetType("single")}
                    />
                    Single Member
                  </label>
                </div>
              </div>

              {/* Single member picker */}
              {targetType === "single" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Select Member</label>
                  <select
                    value={singleMemberId}
                    onChange={(e) => setSingleMemberId(e.target.value)}
                    className="px-4 py-2.5 rounded-xl border border-border bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#17458F]/20 font-bold"
                    required={targetType === "single"}
                  >
                    <option value="">Choose a member...</option>
                    {membersList?.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name} ({m.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={assigning}
                  className="flex-1 py-3 text-slate-900 font-black text-xs rounded-xl shadow cursor-pointer flex items-center justify-center gap-2"
                  style={{ background: GOLD }}
                >
                  {assigning ? <Loader2 size={16} className="animate-spin" /> : <>Assign Dues Statement</>}
                </button>
              </div>
            </form>
          </PageCard>
        </div>
      )}

      {/* ── MODAL 2: CREATE DUES CATEGORY ── */}
      {categoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <PageCard className="w-full max-w-md bg-white border border-border rounded-2xl shadow-2xl p-6 flex flex-col gap-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-md font-black uppercase tracking-wider" style={{ color: NAVY }}>
                Create Dues Category
              </h3>
              <button
                onClick={() => setCategoryModalOpen(false)}
                className="text-xs text-slate-500 hover:text-slate-800 font-bold px-2 py-1 bg-slate-100 rounded-lg cursor-pointer"
                disabled={creatingCat}
              >
                Close
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Category Name</label>
                <input
                  type="text"
                  placeholder="e.g. Annual Membership Fee 2026"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="px-4 py-2.5 rounded-xl border border-border bg-slate-50 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#17458F]/20"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Default Amount (UGX)</label>
                <input
                  type="number"
                  placeholder="e.g. 200000"
                  value={catDefaultAmount}
                  onChange={(e) => setCatDefaultAmount(e.target.value)}
                  className="px-4 py-2.5 rounded-xl border border-border bg-slate-50 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#17458F]/20"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Billing Frequency</label>
                <select
                  value={catFrequency}
                  onChange={(e) => setCatFrequency(e.target.value as any)}
                  className="px-4 py-2.5 rounded-xl border border-border bg-slate-50 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#17458F]/20"
                >
                  <option value="annually">Annually</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="monthly">Monthly</option>
                  <option value="one-off">One-Off Fundraiser</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Description (Optional)</label>
                <textarea
                  placeholder="Brief note for members..."
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  className="px-4 py-2.5 rounded-xl border border-border bg-slate-50 text-xs focus:outline-none focus:ring-2 focus:ring-[#17458F]/20 h-20 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={creatingCat}
                className="w-full py-3 text-white font-bold text-xs rounded-xl shadow cursor-pointer flex items-center justify-center gap-2"
                style={{ background: NAVY }}
              >
                {creatingCat ? <Loader2 size={16} className="animate-spin" /> : <>Save Dues Category</>}
              </button>
            </form>
          </PageCard>
        </div>
      )}
    </AdminLayout>
  );
}

export default TreasurerDashboard;
