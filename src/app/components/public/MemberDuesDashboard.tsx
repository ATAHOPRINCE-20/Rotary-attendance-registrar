import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useMemberAuth } from "../../../context/MemberAuthContext";
import { supabase } from "../../../lib/supabase";
import type { MemberDuesBalance, Donation } from "../../../types/database";
import { RotaryLogo } from "../shared/RotaryLogo";
import { GoldButton, OutlineButton } from "../shared/Buttons";
import { PageCard } from "../shared/PageCard";
import { 
  LogOut, Wallet, ShieldCheck, Smartphone, 
  Sparkles, RefreshCw, CheckCircle2, AlertCircle,
  HelpCircle, Calendar, Coins, Loader2,
  Clock, MapPin, ArrowRight, Menu, X, Receipt, Printer, FileText
} from "lucide-react";
import { toast } from "sonner";
import { LoadingScreen } from "../shared/LoadingScreen";
import { NAVY, GOLD } from "../../../lib/constants";
import { usePublicEvents } from "../../../hooks/useEvents";
import type { Event } from "../../../types/database";

// @ts-ignore
import confetti from "canvas-confetti";

export function MemberDuesDashboard() {
  const { member, organization, loading: authLoading, signOut } = useMemberAuth();
  const navigate = useNavigate();

  const [dues, setDues] = useState<MemberDuesBalance[]>([]);
  const [loadingDues, setLoadingDues] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Payment History state
  const [history, setHistory] = useState<Donation[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Receipt Modal state
  const [selectedReceipt, setSelectedReceipt] = useState<Donation | null>(null);

  // Modal / Payment states
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedDue, setSelectedDue] = useState<MemberDuesBalance | null>(null);
  const [payAmount, setPayAmount] = useState<string>("");
  const [phone, setPhone] = useState("");
  const [initiating, setInitiating] = useState(false);
  
  // Polling states
  const [isPolling, setIsPolling] = useState(false);
  const [pollingRef, setPollingRef] = useState("");
  const [successDetails, setSuccessDetails] = useState<any | null>(null);

  // Selected event for detail modal
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  // Fetch events using usePublicEvents hook
  const { data: upcomingEvents, isLoading: loadingEvents } = usePublicEvents(organization?.id);

  // Tab & Mobile Menu layout states
  const [activeTab, setActiveTab] = useState<"dues" | "events" | "history">("dues");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !member) {
      navigate("/member/login", { replace: true });
    }
  }, [authLoading, member, navigate]);

  const loadDuesLedger = async () => {
    if (!member) return;
    setLoadingDues(true);
    setError(null);

    try {
      const { data, error: dbErr } = await supabase
        .from("member_dues_balances")
        .select(`
          *,
          dues_categories (
            name,
            description,
            currency
          )
        `)
        .eq("member_id", member.id)
        .order("created_at", { ascending: false });

      if (dbErr) {
        throw new Error(dbErr.message);
      }

      const formatted = (data || []).map((b: any) => ({
        ...b,
        dues_category: b.dues_categories || b.dues_category || { name: "Membership Dues", description: "", currency: "UGX" }
      }));

      setDues(formatted as any[]);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to load dues ledger.");
    } finally {
      setLoadingDues(false);
    }
  };

  const loadPaymentHistory = async () => {
    if (!member || !organization) return;
    setLoadingHistory(true);
    try {
      const { data, error: err } = await supabase
        .from("donations")
        .select("*")
        .eq("organization_id", organization.id)
        .or(`email.eq.${member.email},phone.eq.${member.phone || ""}`)
        .order("created_at", { ascending: false });

      if (err) throw err;
      setHistory(data || []);
    } catch (e: any) {
      console.error("Error loading payment history:", e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (member) {
      loadDuesLedger();
      loadPaymentHistory();
      setPhone(member.phone || "");
    }
  }, [member]);

  // Polling loop for mobile money payments
  useEffect(() => {
    let timer: any;
    if (isPolling && pollingRef && organization?.id) {
      const checkStatus = async () => {
        try {
          const res = await fetch(`/api/check-donation?reference=${pollingRef}&organizationId=${organization.id}`);
          const statusData = await res.json();
          if (statusData.success) {
            if (statusData.status === "completed") {
              setIsPolling(false);
              setPaymentModalOpen(false);
              setSuccessDetails(statusData.donation);
              confetti({
                particleCount: 150,
                spread: 85,
                origin: { y: 0.6 }
              });
              toast.success("Dues payment verified!");
              loadDuesLedger(); // Reload ledger
              loadPaymentHistory(); // Reload history
            } else if (statusData.status === "failed") {
              setIsPolling(false);
              toast.error("Payment failed. Please verify your phone balance and PIN.");
            }
          }
        } catch (err) {
          console.error("Error checking payment status:", err);
        }
      };

      checkStatus();
      timer = setInterval(checkStatus, 2500);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPolling, pollingRef, organization]);

  if (authLoading || !member) {
    return <LoadingScreen variant="dark" />;
  }

  // Calculate totals
  const totalDue = dues.reduce((acc, curr) => acc + Number(curr.amount_due), 0);
  const totalPaid = dues.reduce((acc, curr) => acc + Number(curr.amount_paid), 0);
  const totalBalance = Math.max(0, totalDue - totalPaid);

  function openPayment(due: MemberDuesBalance) {
    setSelectedDue(due);
    const balance = due.amount_due - due.amount_paid;
    setPayAmount(balance.toString());
    setPaymentModalOpen(true);
  }

  async function handlePaymentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDue || !organization || !member) return;

    const numAmount = parseFloat(payAmount);
    if (isNaN(numAmount) || numAmount < 500) {
      toast.error("Minimum payment amount is UGX 500.");
      return;
    }

    if (!phone) {
      toast.error("Please enter a phone number for Mobile Money.");
      return;
    }

    setInitiating(true);
    try {
      const payload = {
        organizationId: organization.id,
        memberId: member.id,
        duesCategoryId: selectedDue.dues_category_id,
        fullName: member.full_name,
        email: member.email,
        amount: numAmount,
        currency: "UGX",
        category: selectedDue.dues_category?.name || "Dues Payment",
        paymentMethod: "mobile",
        phone: phone.replace("+", ""),
        slug: organization.slug
      };

      const response = await fetch("/api/initiate-donation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const res = await response.json();
      if (!response.ok || !res.success) {
        throw new Error(res.error || "Failed to initiate payment.");
      }

      setPollingRef(res.reference);
      setIsPolling(true);

    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to process checkout.");
    } finally {
      setInitiating(false);
    }
  }

  const initials = member?.full_name
    ?.split(" ")
    .map((w: string) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() ?? "ME";

  return (
    <div className="flex h-screen bg-[#f4f6fb] overflow-hidden font-sans">
      {/* ── SIDEBAR ───────────────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 h-full border-r border-border/60 bg-white">
        {/* Logo */}
        <div className="flex flex-col items-center justify-center px-5 py-6 border-b border-border/40 min-h-[110px]">
          <RotaryLogo size={56} />
          <p
            className="font-extrabold text-xs mt-3 tracking-wider uppercase text-center truncate max-w-[200px]"
            style={{ color: NAVY }}
          >
            {organization?.name ?? "agoroll"}
          </p>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-5 flex flex-col gap-1 overflow-y-auto">
          <p className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase px-3 mb-2">
            Menu
          </p>
          <button
            onClick={() => setActiveTab("dues")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-300 ease-out relative cursor-pointer ${
              activeTab === "dues"
                ? "font-extrabold text-[#001D4A] bg-muted/30"
                : "font-semibold text-muted-foreground hover:bg-slate-100 hover:text-[#001D4A] hover:scale-105 hover:translate-x-1 hover:shadow-sm"
            }`}
          >
            <Wallet size={16} />
            <span className="flex-1 text-left">Dues & Ledger</span>
          </button>
          
          <button
            onClick={() => setActiveTab("history")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-300 ease-out relative cursor-pointer ${
              activeTab === "history"
                ? "font-extrabold text-[#001D4A] bg-muted/30"
                : "font-semibold text-muted-foreground hover:bg-slate-100 hover:text-[#001D4A] hover:scale-105 hover:translate-x-1 hover:shadow-sm"
            }`}
          >
            <Receipt size={16} />
            <span className="flex-1 text-left">Payment History</span>
          </button>

          <button
            onClick={() => setActiveTab("events")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-300 ease-out relative cursor-pointer ${
              activeTab === "events"
                ? "font-extrabold text-[#001D4A] bg-muted/30"
                : "font-semibold text-muted-foreground hover:bg-slate-100 hover:text-[#001D4A] hover:scale-105 hover:translate-x-1 hover:shadow-sm"
            }`}
          >
            <Calendar size={16} />
            <span className="flex-1 text-left">Club Events</span>
          </button>

          <div className="mt-6 border-t border-border/40 pt-4">
            <button
              onClick={signOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-red-50 hover:text-red-600 hover:scale-105 hover:translate-x-1 hover:shadow-sm transition-all duration-300 ease-out cursor-pointer"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </nav>

        {/* User card */}
        <div className="p-4 border-t border-border/40">
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-slate-50 transition-all cursor-default">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0"
              style={{ background: `linear-gradient(135deg, ${NAVY}, #0067C8)` }}
            >
              {initials}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-foreground truncate">{member?.full_name ?? "Member"}</p>
              <p className="text-[10px] text-muted-foreground truncate">Club Member</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── CONTENT AREA ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Top bar (Header) */}
        <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-border/40 shrink-0 min-h-[73px]">
          <div className="flex items-center gap-2">
            {/* Hamburger button for mobile */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 mr-1 rounded-xl bg-[#f4f6fb] hover:bg-muted text-foreground transition-all cursor-pointer"
              title="Open menu"
            >
              <Menu size={18} />
            </button>
            <h2 className="text-sm font-extrabold uppercase tracking-wider animate-in fade-in max-w-[240px] truncate" style={{ color: NAVY }}>
              {activeTab === "dues" ? (organization?.name || "Member Portal") : activeTab === "history" ? "Payment History & Receipts" : "Upcoming Club Events"}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === "dues" && (
              <button
                onClick={loadDuesLedger}
                className="flex items-center gap-1.5 text-xs text-[#F7A81B] hover:opacity-85 font-black px-3.5 py-2 bg-slate-50 border border-slate-200/60 rounded-xl cursor-pointer shadow-sm hover:shadow transition-all"
                disabled={loadingDues}
              >
                <RefreshCw size={12} className={loadingDues ? "animate-spin" : ""} /> Refresh Statement
              </button>
            )}
          </div>
        </header>

        {/* Scrollable Main body */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
          {activeTab === "dues" ? (
            <div className="flex flex-col gap-6 max-w-4xl">
              {/* Welcome Section */}
              <div className="mb-2">
                <h2 className="text-xl md:text-2xl font-black font-sans" style={{ color: NAVY }}>
                  Welcome, Rotarian {member?.full_name.split(" ")[0]}!
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Dues statement for {member?.buddy_group ? `Buddy Group: ${member.buddy_group}` : "your active club membership"}
                </p>
              </div>

              {/* Ledger Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-border/40 shadow-sm p-5 rounded-2xl flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${NAVY}18`, color: NAVY }}>
                    <Coins size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider text-[9px]">Total Billed</p>
                    <h3 className="text-xl font-black mt-1" style={{ color: NAVY }}>
                      UGX {totalDue.toLocaleString()}
                    </h3>
                  </div>
                </div>

                <div className="bg-white border border-border/40 shadow-sm p-5 rounded-2xl flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider text-[9px]">Total Paid</p>
                    <h3 className="text-xl font-black text-emerald-600 mt-1">
                      UGX {totalPaid.toLocaleString()}
                    </h3>
                  </div>
                </div>

                <div className="bg-white border border-border/40 shadow-sm p-5 rounded-2xl flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                    <Wallet size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider text-[9px]">Outstanding Balance</p>
                    <h3 className="text-xl font-black text-rose-600 mt-1">
                      UGX {totalBalance.toLocaleString()}
                    </h3>
                  </div>
                </div>
              </div>

              {/* Success Modal Details */}
              {successDetails && (
                <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl flex flex-col sm:flex-row items-center gap-4 text-emerald-800 shadow-sm">
                  <CheckCircle2 size={36} className="text-emerald-600 shrink-0" />
                  <div className="flex-1 text-center sm:text-left">
                    <h4 className="font-bold text-sm">Payment Verified Successfully!</h4>
                    <p className="text-xs text-slate-600 mt-1">
                      Your payment of <strong className="text-emerald-700">UGX {successDetails.amount.toLocaleString()}</strong> has been posted to your ledger balance. Receipt: <strong>{successDetails.receipt_number}</strong>.
                    </p>
                  </div>
                  <button
                    onClick={() => setSuccessDetails(null)}
                    className="text-xs font-semibold px-4 py-2 bg-[#F4F6FB] border border-border text-slate-700 hover:bg-muted transition-all rounded-lg cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Ledger statements */}
              <div className="bg-white border border-border/40 rounded-2xl overflow-hidden shadow-sm">
                <div className="border-b border-border/40 bg-muted/10 px-6 py-4 flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-wider font-heading" style={{ color: NAVY }}>
                    Dues Statement Ledger
                  </h3>
                  <span className="text-[10px] bg-[#F4F6FB] border border-border px-2 py-1 rounded text-muted-foreground font-semibold uppercase tracking-wider">
                    Uganda Shilling (UGX)
                  </span>
                </div>

                {loadingDues ? (
                  <div className="py-20 flex flex-col items-center gap-3">
                    <Loader2 size={32} className="animate-spin" style={{ color: GOLD }} />
                    <p className="text-xs text-muted-foreground">Loading statements...</p>
                  </div>
                ) : error ? (
                  <div className="py-12 px-6 flex flex-col items-center gap-3 text-center">
                    <AlertCircle size={36} className="text-rose-500" />
                    <p className="text-sm text-foreground">{error}</p>
                    <OutlineButton onClick={loadDuesLedger} className="mt-2 text-xs">
                      Retry Load
                    </OutlineButton>
                  </div>
                ) : dues.length === 0 ? (
                  <div className="py-20 flex flex-col items-center gap-3 text-center">
                    <HelpCircle size={40} className="text-slate-400" />
                    <p className="text-sm text-foreground font-semibold">No dues configured</p>
                    <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                      Your account is currently clear of all billing statements. Check back later or contact your club treasurer.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/30">
                    {dues.map((due) => {
                      const outstanding = due.amount_due - due.amount_paid;
                      const pctPaid = due.amount_due > 0 ? Math.min(100, Math.round((due.amount_paid / due.amount_due) * 100)) : 100;

                      return (
                        <div key={due.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/10 transition-all">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-extrabold text-md" style={{ color: NAVY }}>
                                {due.dues_category?.name || "Membership Dues"}
                              </h4>
                              
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                due.status === "paid" 
                                  ? "bg-emerald-50 border border-emerald-200 text-emerald-600"
                                  : due.status === "partially_paid"
                                  ? "bg-yellow-50 border border-yellow-200 text-yellow-600"
                                  : "bg-rose-50 border border-rose-200 text-rose-600"
                              }`}>
                                {due.status.replace("_", " ")}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                              {due.dues_category?.description || "Ongoing club subscription or fundraiser pot allocation."}
                            </p>

                            {/* Inline Visual Progress Bar */}
                            <div className="w-full max-w-xs mt-3">
                              <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold mb-1">
                                <span>UGX {due.amount_paid.toLocaleString()} paid of UGX {due.amount_due.toLocaleString()}</span>
                                <span>{pctPaid}%</span>
                              </div>
                              <div className="h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-200/50">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${pctPaid}%`,
                                    backgroundColor: pctPaid >= 100 ? "#10B981" : pctPaid > 0 ? "#F59E0B" : "#CBD5E1"
                                  }}
                                />
                              </div>
                            </div>
                            
                            {due.due_date && (
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-2 font-semibold">
                                <Calendar size={11} /> Due Date: {new Date(due.due_date).toLocaleDateString()}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-6 sm:text-right shrink-0">
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Statement Ledger</span>
                              <div className="text-xs text-slate-600">
                                Due: <strong className="text-foreground">UGX {due.amount_due.toLocaleString()}</strong>
                              </div>
                              <div className="text-xs text-emerald-600">
                                Paid: <strong>UGX {due.amount_paid.toLocaleString()}</strong>
                              </div>
                            </div>

                            {outstanding > 0 ? (
                              <GoldButton
                                onClick={() => openPayment(due)}
                                className="px-5 py-2 text-xs font-black shadow-md hover:scale-[1.03]"
                              >
                                Pay UGX {outstanding.toLocaleString()}
                              </GoldButton>
                            ) : (
                              <span className="h-9 px-4 flex items-center justify-center text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl">
                                Fully Cleared
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Info Banner */}
              <div className="bg-white border border-border/40 shadow-sm p-5 rounded-2xl text-xs text-muted-foreground leading-relaxed flex items-start gap-3">
                <ShieldCheck size={18} className="text-[#F7A81B] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block mb-1" style={{ color: NAVY }}>🔒 Security & Privacy Notice</span>
                  Payments are securely processed directly on the mobile networks via Relworx. This portal handles dues ledger tracking and payment receipts. If you believe there is a balance error, please contact your Club Treasurer.
                </div>
              </div>
            </div>
          ) : activeTab === "history" ? (
            <div className="flex flex-col gap-6 max-w-4xl">
              <div>
                <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: GOLD }}>
                  Receipts & Statement
                </p>
                <h1 className="text-2xl font-black" style={{ color: NAVY }}>
                  Payment History
                </h1>
                <p className="text-xs text-muted-foreground mt-1">
                  View and download receipts for past dues payments and contributions.
                </p>
              </div>

              <div className="bg-white border border-border/40 rounded-2xl overflow-hidden shadow-sm">
                <div className="border-b border-border/40 bg-muted/10 px-6 py-4 flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-wider" style={{ color: NAVY }}>
                    Completed Transactions
                  </h3>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-bold uppercase">
                    {history.length} Receipts Available
                  </span>
                </div>

                {loadingHistory ? (
                  <div className="py-20 flex flex-col items-center gap-3">
                    <Loader2 size={32} className="animate-spin" style={{ color: GOLD }} />
                    <p className="text-xs text-muted-foreground">Loading payment receipts...</p>
                  </div>
                ) : history.length === 0 ? (
                  <div className="py-16 text-center px-4">
                    <Receipt className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-semibold text-slate-700">No payment history found</p>
                    <p className="text-xs text-slate-400 mt-1">Receipts for your payments will appear here once cleared.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border bg-slate-50/50 font-bold text-muted-foreground uppercase text-[9px] tracking-wider">
                          <th className="px-5 py-3.5">Date</th>
                          <th className="px-5 py-3.5">Category / Description</th>
                          <th className="px-5 py-3.5">Receipt #</th>
                          <th className="px-5 py-3.5 text-right">Amount Paid</th>
                          <th className="px-5 py-3.5 text-center">Status</th>
                          <th className="px-5 py-3.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {history.map((tx) => (
                          <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-5 py-3.5 font-semibold text-slate-700">
                              {new Date(tx.created_at).toLocaleDateString("en-GB", {
                                day: "numeric", month: "short", year: "numeric",
                              })}
                            </td>
                            <td className="px-5 py-3.5 font-bold text-foreground">
                              {tx.category || "Club Contribution"}
                            </td>
                            <td className="px-5 py-3.5 font-mono text-[11px] text-slate-500">
                              {tx.receipt_number || tx.id.slice(0, 8)}
                            </td>
                            <td className="px-5 py-3.5 text-right font-black text-emerald-600">
                              {tx.currency || "UGX"} {Number(tx.amount).toLocaleString()}
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                                tx.status === "completed"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : tx.status === "pending"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-red-100 text-red-600"
                              }`}>
                                <CheckCircle2 size={8} /> {tx.status}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <button
                                onClick={() => setSelectedReceipt(tx)}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                              >
                                <FileText size={11} /> Receipt
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6 max-w-6xl">
              {/* Welcome Section for events */}
              <div>
                <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: GOLD }}>
                  Upcoming Gatherings
                </p>
                <h1 className="text-2xl font-black" style={{ color: NAVY }}>
                  Club Events Directory
                </h1>
                <p className="text-xs text-muted-foreground mt-1">
                  View scheduled fellowship and service projects, and register your attendance.
                </p>
              </div>

              {loadingEvents ? (
                <div className="py-20 flex flex-col items-center gap-3 bg-white border border-border/40 rounded-2xl shadow-sm">
                  <Loader2 size={32} className="animate-spin text-slate-400" />
                  <p className="text-xs text-muted-foreground">Loading club events...</p>
                </div>
              ) : !upcomingEvents || upcomingEvents.length === 0 ? (
                <div className="py-20 flex flex-col items-center gap-4 text-center bg-white border border-border/40 rounded-2xl shadow-sm">
                  <Calendar size={48} className="text-slate-300" />
                  <h3 className="text-md font-bold" style={{ color: NAVY }}>No Scheduled Events</h3>
                  <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                    There are no upcoming gatherings configured. fellowship details will appear here once scheduled.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {upcomingEvents.map((ev) => {
                    const eventDate = new Date(ev.date);
                    return (
                      <PageCard key={ev.id} className="overflow-hidden hover:shadow-md transition-all duration-200 flex flex-col h-full">
                        {ev.cover_image_url && (
                          <div className="w-full h-36 bg-muted overflow-hidden flex-shrink-0">
                            <img
                              src={ev.cover_image_url}
                              alt={ev.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span
                                className="text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: `${GOLD}15`, color: GOLD }}
                              >
                                {ev.type || "General"}
                              </span>
                              {ev.capacity && (
                                <span className="text-[9px] font-semibold text-muted-foreground bg-slate-100 px-2 py-0.5 rounded-full">
                                  Cap: {ev.capacity}
                                </span>
                              )}
                            </div>
                            <h3 className="text-sm font-black leading-snug text-slate-800 line-clamp-2" style={{ fontFamily: "var(--font-sans)" }}>
                              {ev.title}
                            </h3>
                            {ev.description && (
                              <p className="text-[11px] text-muted-foreground line-clamp-2 mt-2 leading-relaxed">
                                {ev.description}
                              </p>
                            )}
                          </div>

                          <div className="pt-3 border-t border-border/40 flex flex-col gap-1 text-[10px] text-slate-500">
                            <span className="flex items-center gap-1.5">
                              <Calendar size={11} style={{ color: GOLD }} />
                              {eventDate.toLocaleDateString("en-US", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              })} at {eventDate.toLocaleTimeString("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </span>
                            {ev.location && (
                              <span className="flex items-center gap-1.5 truncate">
                                <MapPin size={11} style={{ color: GOLD }} />
                                {ev.location}
                              </span>
                            )}
                            <button
                              onClick={() => setSelectedEvent(ev)}
                              className="text-[10px] text-[#F7A81B] hover:text-[#e09412] font-black mt-2 self-start flex items-center gap-0.5 cursor-pointer font-sans"
                            >
                              View Details <ArrowRight size={11} />
                            </button>
                          </div>
                        </div>
                      </PageCard>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="lg:hidden bg-white border-t border-border/50 shrink-0 px-2 py-2 flex items-center justify-around pb-[calc(env(safe-area-inset-bottom)+0.5rem)] shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.05)] animate-in slide-in-from-bottom">
          <button
            onClick={() => setActiveTab("dues")}
            className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all duration-200 cursor-pointer"
            style={{
              color: activeTab === "dues" ? NAVY : "#64748B",
            }}
          >
            <Wallet size={18} style={{ strokeWidth: activeTab === "dues" ? 2.5 : 2 }} />
            <span className="text-[9px] font-bold">Dues & Ledger</span>
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all duration-200 cursor-pointer"
            style={{
              color: activeTab === "history" ? NAVY : "#64748B",
            }}
          >
            <Receipt size={18} style={{ strokeWidth: activeTab === "history" ? 2.5 : 2 }} />
            <span className="text-[9px] font-bold">History</span>
          </button>
          
          <button
            onClick={() => setActiveTab("events")}
            className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all duration-200 cursor-pointer"
            style={{
              color: activeTab === "events" ? NAVY : "#64748B",
            }}
          >
            <Calendar size={18} style={{ strokeWidth: activeTab === "events" ? 2.5 : 2 }} />
            <span className="text-[9px] font-bold">Events</span>
          </button>

          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-[#64748B] hover:text-foreground transition-all duration-200 cursor-pointer"
          >
            <Menu size={18} />
            <span className="text-[9px] font-bold">Menu</span>
          </button>
        </nav>
      </div>

      {/* ── MOBILE DRAWER OVERLAY ────────────────────────────────────── */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex bg-black/50 backdrop-blur-sm animate-in fade-in">
          {/* Drawer Panel */}
          <aside className="w-60 h-full bg-white flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
            {/* Logo & Close button */}
            <div className="flex items-center justify-between px-5 py-5 border-b border-border/40">
              <div className="flex-1 flex items-center justify-center gap-2">
                <RotaryLogo size={36} />
                <p className="font-extrabold text-xs uppercase truncate max-w-[140px]" style={{ color: NAVY }}>
                  {organization?.name ?? "agoroll"}
                </p>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground shrink-0 ml-2 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Nav links */}
            <nav className="flex-1 px-3 py-5 flex flex-col gap-1 overflow-y-auto">
              <p className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase px-3 mb-2">
                Menu
              </p>
              <button
                onClick={() => {
                  setActiveTab("dues");
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 relative cursor-pointer ${
                  activeTab === "dues"
                    ? "bg-muted text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Wallet size={16} />
                <span className="flex-1 text-left">Dues & Ledger</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab("history");
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 relative cursor-pointer ${
                  activeTab === "history"
                    ? "bg-muted text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Receipt size={16} />
                <span className="flex-1 text-left">Payment History</span>
              </button>
              
              <button
                onClick={() => {
                  setActiveTab("events");
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 relative cursor-pointer ${
                  activeTab === "events"
                    ? "bg-muted text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Calendar size={16} />
                <span className="flex-1 text-left">Upcoming Events</span>
              </button>

              <div className="mt-6 border-t border-border/40 pt-4">
                <button
                  onClick={() => {
                    signOut();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-all cursor-pointer"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            </nav>

            {/* User card */}
            <div className="p-4 border-t border-border/40">
              <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-slate-50 transition-all cursor-default">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0"
                  style={{ background: `linear-gradient(135deg, ${NAVY}, #0067C8)` }}
                >
                  {initials}
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-bold text-foreground truncate">{member?.full_name ?? "Member"}</p>
                  <p className="text-[10px] text-muted-foreground truncate">Club Member</p>
                </div>
              </div>
            </div>
          </aside>

          {/* Click outside to close area */}
          <div className="flex-1 bg-transparent" onClick={() => setIsMobileMenuOpen(false)} />
        </div>
      )}

      {/* Payment Checkout Modal */}
      {paymentModalOpen && selectedDue && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <PageCard className="w-full max-w-md overflow-hidden flex flex-col p-6 animate-in zoom-in-95 duration-150 text-foreground shadow-2xl gap-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-md font-bold uppercase tracking-wider" style={{ color: NAVY }}>
                Dues Payment Checkout
              </h3>
              <button
                onClick={() => { if (!isPolling) setPaymentModalOpen(false); }}
                className="text-slate-600 hover:text-foreground transition-all text-xs font-semibold px-2.5 py-1 bg-[#F4F6FB] hover:bg-muted rounded-lg border border-border cursor-pointer"
                disabled={isPolling || initiating}
              >
                Close
              </button>
            </div>

            {isPolling ? (
              <div className="flex flex-col items-center text-center py-6 gap-5">
                <div className="w-16 h-16 bg-yellow-50 border border-yellow-100 rounded-full flex items-center justify-center text-yellow-600 animate-bounce">
                  <Smartphone className="w-8 h-8" />
                </div>
                
                <div>
                  <h4 className="text-md font-bold" style={{ color: NAVY }}>Awaiting Authorization</h4>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed px-4">
                    We've pushed a mobile money prompt to your phone: <strong>{phone}</strong>.
                    <br /><br />
                    Please check your phone, enter your <strong>Mobile Money PIN</strong> to complete the payment of <strong>UGX {parseFloat(payAmount).toLocaleString()}</strong>.
                  </p>
                </div>

                <div className="w-full pt-4 border-t border-border flex flex-col gap-2">
                  <span className="text-[10px] text-yellow-600 font-bold uppercase tracking-wider animate-pulse flex items-center justify-center gap-1.5">
                    <Sparkles size={11}/> Confirmed pending gateway webhook...
                  </span>
                  <OutlineButton
                    onClick={() => setIsPolling(false)}
                    className="w-full justify-center mt-2"
                  >
                    Cancel and Retry
                  </OutlineButton>
                </div>
              </div>
            ) : (
              <form onSubmit={handlePaymentSubmit} className="flex flex-col gap-4">
                <div className="bg-muted/10 border border-border p-4 rounded-xl flex flex-col gap-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Allocation</span>
                  <div className="text-sm font-bold" style={{ color: NAVY }}>{selectedDue.dues_category?.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Outstanding Balance: UGX {(selectedDue.amount_due - selectedDue.amount_paid).toLocaleString()}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Payment Amount (UGX)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value.replace(/\D/g, ""))}
                    className="px-4 py-3 rounded-xl border border-border bg-input-background text-foreground placeholder-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#17458F]/20 transition-all font-mono font-bold"
                    required
                  />
                  <p className="text-[10px] text-slate-400">
                    You can pay the full amount or clear it partially (min: UGX 500).
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Mobile Money Phone Number</label>
                  <input
                    type="tel"
                    placeholder="e.g. 0772123456"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="px-4 py-3 rounded-xl border border-border bg-input-background text-foreground placeholder-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#17458F]/20 transition-all font-mono"
                    required
                  />
                  <p className="text-[10px] text-slate-400">
                    This phone will receive the mobile money authorization PIN request.
                  </p>
                </div>

                <GoldButton
                  type="submit"
                  disabled={initiating}
                  className="w-full justify-center py-3 text-slate-900 mt-2 hover:brightness-110"
                >
                  {initiating ? <Loader2 size={18} className="animate-spin" /> : <>Request Mobile Money Prompt</>}
                </GoldButton>
              </form>
            )}
          </PageCard>
        </div>
      )}

      {/* Printable Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <PageCard className="w-full max-w-md bg-white border border-border rounded-2xl shadow-2xl p-6 flex flex-col gap-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-2">
                <RotaryLogo size={28} />
                <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                  {organization?.name || "Rotary Club"}
                </span>
              </div>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="text-xs text-slate-500 hover:text-slate-800 font-bold px-2 py-1 bg-slate-100 rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Receipt Body */}
            <div className="flex flex-col gap-4 bg-slate-50/70 border border-slate-200/60 p-5 rounded-2xl text-xs">
              <div className="text-center pb-3 border-b border-slate-200/60">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Official Payment Receipt</p>
                <h3 className="text-xl font-black mt-1" style={{ color: NAVY }}>
                  {selectedReceipt.currency || "UGX"} {Number(selectedReceipt.amount).toLocaleString()}
                </h3>
                <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  <CheckCircle2 size={10} /> Payment Verified
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-slate-600 text-[11px]">
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Receipt No</span>
                  <span className="font-mono font-bold text-slate-800">{selectedReceipt.receipt_number || selectedReceipt.id.slice(0, 8)}</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Date</span>
                  <span className="font-bold text-slate-800">
                    {new Date(selectedReceipt.created_at).toLocaleDateString("en-GB", {
                      day: "numeric", month: "short", year: "numeric"
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Payer Name</span>
                  <span className="font-bold text-slate-800">{selectedReceipt.full_name || member?.full_name}</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Allocation</span>
                  <span className="font-bold text-slate-800">{selectedReceipt.category || "Membership Dues"}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Payment Method</span>
                  <span className="font-bold text-slate-800 capitalize">{selectedReceipt.payment_method || "Mobile Money"}</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Gateway</span>
                  <span className="font-bold text-slate-800">Relworx API</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <GoldButton
                onClick={() => window.print()}
                className="flex-1 justify-center py-2.5 text-xs font-bold shadow"
              >
                <Printer size={14} /> Print / Save PDF
              </GoldButton>
              <OutlineButton
                onClick={() => setSelectedReceipt(null)}
                className="justify-center py-2.5 text-xs"
              >
                Done
              </OutlineButton>
            </div>
          </PageCard>
        </div>
      )}

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <PageCard className="w-full max-w-lg overflow-hidden flex flex-col p-6 animate-in zoom-in-95 duration-150 text-foreground shadow-2xl gap-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full" style={{ backgroundColor: `${GOLD}20`, color: GOLD }}>
                {selectedEvent.type || "General"}
              </span>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-slate-600 hover:text-foreground transition-all text-xs font-semibold px-2.5 py-1 bg-[#F4F6FB] hover:bg-muted rounded-lg border border-border cursor-pointer"
              >
                Close
              </button>
            </div>

            {selectedEvent.cover_image_url && (
              <div className="w-full h-48 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                <img
                  src={selectedEvent.cover_image_url}
                  alt={selectedEvent.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-black leading-snug" style={{ color: NAVY }}>
                {selectedEvent.title}
              </h3>
              
              <div className="flex flex-wrap gap-4 text-xs text-slate-500 my-2">
                <span className="flex items-center gap-1.5">
                  <Calendar size={13} style={{ color: GOLD }} />
                  {new Date(selectedEvent.date).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                  })}
                </span>
                {selectedEvent.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin size={13} style={{ color: GOLD }} />
                    {selectedEvent.location}
                  </span>
                )}
              </div>

              {selectedEvent.description && (
                <p className="text-xs text-muted-foreground leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200/50">
                  {selectedEvent.description}
                </p>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-border">
              <OutlineButton onClick={() => setSelectedEvent(null)} className="text-xs">
                Close Details
              </OutlineButton>
            </div>
          </PageCard>
        </div>
      )}
    </div>
  );
}

export default MemberDuesDashboard;
