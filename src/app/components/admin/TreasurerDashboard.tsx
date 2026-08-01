import React, { useState, useMemo, useRef } from "react";
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
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Mail,
  MessageSquare,
  AlertCircle,
  Calendar as CalendarIcon,
} from "lucide-react";
import { toast } from "sonner";
import { LoadingScreen } from "../shared/LoadingScreen";
import type { Donation, Withdrawal } from "../../../types/database";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GroupedMemberDues {
  member_id: string;
  member_name: string;
  email: string;
  phone?: string;
  total_due: number;
  total_paid: number;
  total_outstanding: number;
  overall_status: "paid" | "partially_paid" | "unpaid";
  items: ExtendedDuesBalance[];
}

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

  // Tab state & refs for auto-focus scrolling
  const [activeTab, setActiveTab] = useState<"overview" | "dues" | "donations" | "withdrawals" | "mydues">("overview");
  const tabNavRef = useRef<HTMLDivElement>(null);
  const tabBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function handleTabSelect(tabId: "overview" | "dues" | "donations" | "withdrawals" | "mydues") {
    setActiveTab(tabId);
    const targetBtn = tabBtnRefs.current[tabId];
    if (targetBtn) {
      targetBtn.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }

  function scrollTabNav(direction: "left" | "right") {
    if (tabNavRef.current) {
      const scrollAmount = direction === "left" ? -180 : 180;
      tabNavRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  }

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

  // Accordion State for Member Dues
  const [expandedMembers, setExpandedMembers] = useState<Record<string, boolean>>({});

  // Customized Payment Reminder Modal State
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [selectedReminderGroup, setSelectedReminderGroup] = useState<GroupedMemberDues | null>(null);
  const [sendEmailChannel, setSendEmailChannel] = useState(true);
  const [sendWhatsAppChannel, setSendWhatsAppChannel] = useState(true);
  const [customMessage, setCustomMessage] = useState("");
  const [sendingReminder, setSendingReminder] = useState(false);

  // Cash Payment / Donation Recording State
  const [cashModalOpen, setCashModalOpen] = useState(false);
  const [cashEntryType, setCashEntryType] = useState<"dues" | "donation">("dues");

  // Cash Form Fields
  const [cashMemberId, setCashMemberId] = useState("");
  const [cashDuesBalanceId, setCashDuesBalanceId] = useState("");
  const [cashDonorName, setCashDonorName] = useState("");
  const [cashDonorEmail, setCashDonorEmail] = useState("");
  const [cashDonorPhone, setCashDonorPhone] = useState("");
  const [cashCategory, setCashCategory] = useState("Happy Shilling");
  const [cashAmount, setCashAmount] = useState("");
  const [recordingCash, setRecordingCash] = useState(false);

  // Personal Dues Payment Modal State (Treasurer pays own dues via mobile money)
  const [myPayModalOpen, setMyPayModalOpen] = useState(false);
  const [mySelectedDue, setMySelectedDue] = useState<ExtendedDuesBalance | null>(null);
  const [myPayAmount, setMyPayAmount] = useState("");
  const [myPayPhone, setMyPayPhone] = useState("");
  const [myPayInitiating, setMyPayInitiating] = useState(false);
  const [myPayPolling, setMyPayPolling] = useState(false);
  const [myPayPollingRef, setMyPayPollingRef] = useState("");

  async function handleMyDuesPaymentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mySelectedDue || !organization || !myMemberRecord) return;
    const numAmount = parseFloat(myPayAmount);
    if (isNaN(numAmount) || numAmount < 500) {
      toast.error("Minimum payment is UGX 500.");
      return;
    }
    if (!myPayPhone) {
      toast.error("Please enter your phone number for Mobile Money.");
      return;
    }
    setMyPayInitiating(true);
    try {
      const payload = {
        organizationId: organization.id,
        memberId: myMemberRecord.id,
        duesCategoryId: mySelectedDue.dues_category_id,
        fullName: myMemberRecord.full_name,
        email: myMemberRecord.email,
        amount: numAmount,
        currency: "UGX",
        category: mySelectedDue.dues_categories?.name || "Dues Payment",
        paymentMethod: "mobile",
        phone: myPayPhone.replace("+", ""),
        slug: organization.slug,
      };
      const res = await fetch("/api/initiate-donation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let resData: any;
      try {
        resData = await res.json();
      } catch (parseErr) {
        console.error("Failed to parse JSON response from initiate-donation:", parseErr);
        throw new Error(`Server returned an error (${res.status}). Please try again later.`);
      }

      if (!res.ok || !resData.success) throw new Error(resData?.error || "Failed to initiate payment.");
      setMyPayPollingRef(resData.reference || "");
      setMyPayPolling(true);
      toast.success("Payment initiated! Please approve the prompt on your phone.");
    } catch (err: any) {
      toast.error(err.message || "Payment failed.");
    } finally {
      setMyPayInitiating(false);
    }
  }

  function openCashModalForMember(memberId?: string) {
    setCashEntryType("dues");
    if (memberId) {
      setCashMemberId(memberId);
      const group = groupedMemberDues.find((g) => g.member_id === memberId);
      const unpaidItem = group?.items.find((i) => i.status !== "paid");
      if (unpaidItem) {
        setCashDuesBalanceId(unpaidItem.id);
        const outstanding = Math.max(0, Number(unpaidItem.amount_due) - Number(unpaidItem.amount_paid));
        setCashAmount(outstanding.toString());
      } else {
        setCashDuesBalanceId("");
        setCashAmount("");
      }
    } else {
      setCashMemberId("");
      setCashDuesBalanceId("");
      setCashAmount("");
    }
    setCashModalOpen(true);
  }

  function toggleAccordion(memberId: string) {
    setExpandedMembers((prev) => ({
      ...prev,
      [memberId]: !prev[memberId],
    }));
  }

  function openReminderModal(group: GroupedMemberDues) {
    setSelectedReminderGroup(group);
    const orgName = organization?.name || "Rotary Club";
    const portalUrl = `${window.location.origin}/member/login`;

    const categoryLines = group.items
      .filter((i) => i.status !== "paid")
      .map((i) => `• ${i.dues_categories?.name || "General Dues"}: UGX ${Math.max(0, Number(i.amount_due) - Number(i.amount_paid)).toLocaleString()}`)
      .join("\n");

    const defaultMsg =
      `Hello ${group.member_name},\n\n` +
      `This is a friendly payment reminder from ${orgName} regarding your club dues statement.\n\n` +
      `*Total Outstanding*: UGX ${group.total_outstanding.toLocaleString()}\n\n` +
      `*Fund Categories Breakdown*:\n${categoryLines || "• Outstanding Dues Statement"}\n\n` +
      `Please access your member portal to clear your balance:\n${portalUrl}\n\n` +
      `Thank you for your support!`;

    setCustomMessage(defaultMsg);
    setReminderModalOpen(true);
  }

  async function handleSendReminder() {
    if (!selectedReminderGroup) return;
    if (!sendEmailChannel && !sendWhatsAppChannel) {
      toast.error("Please select at least one delivery channel (Email or WhatsApp).");
      return;
    }

    setSendingReminder(true);
    let emailSent = false;
    let whatsappSent = false;
    const errors: string[] = [];

    try {
      // 1. Send Email if selected
      if (sendEmailChannel && selectedReminderGroup.email) {
        const sessionData = await supabase.auth.getSession();
        const token = sessionData.data.session?.access_token;

        const itemRowsHtml = selectedReminderGroup.items
          .map((i) => {
            const due = Number(i.amount_due);
            const paid = Number(i.amount_paid);
            const out = Math.max(0, due - paid);
            return `
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #edf2f7; font-weight: bold;">${i.dues_categories?.name || "General Dues"}</td>
                <td style="padding: 10px; border-bottom: 1px solid #edf2f7; text-align: right;">UGX ${due.toLocaleString()}</td>
                <td style="padding: 10px; border-bottom: 1px solid #edf2f7; text-align: right; color: #10b981;">UGX ${paid.toLocaleString()}</td>
                <td style="padding: 10px; border-bottom: 1px solid #edf2f7; text-align: right; color: #e53e3e; font-weight: bold;">UGX ${out.toLocaleString()}</td>
              </tr>
            `;
          })
          .join("");

        const htmlContent = `
          <div style="font-family: sans-serif; max-width: 580px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h2 style="color: #002D62; margin: 0;">${organization?.name || 'Rotary Club'}</h2>
              <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Dues Statement & Payment Reminder</p>
            </div>
            
            <p style="color: #1e293b; font-size: 14px;">Dear <strong>${selectedReminderGroup.member_name}</strong>,</p>
            <p style="color: #475569; font-size: 14px; line-height: 1.6;">
              Please review your current dues statement for <strong>${organization?.name || 'Rotary Club'}</strong> below.
            </p>

            <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin: 20px 0;">
              <thead>
                <tr style="background-color: #f8fafc; color: #475569; font-size: 11px; text-transform: uppercase;">
                  <th style="padding: 8px 10px; text-align: left;">Category</th>
                  <th style="padding: 8px 10px; text-align: right;">Billed</th>
                  <th style="padding: 8px 10px; text-align: right;">Paid</th>
                  <th style="padding: 8px 10px; text-align: right;">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                ${itemRowsHtml}
              </tbody>
            </table>

            <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; text-align: center; margin-bottom: 24px;">
              <span style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold;">Total Outstanding Balance</span>
              <div style="font-size: 24px; font-weight: 900; color: #e53e3e; margin-top: 4px;">
                UGX ${selectedReminderGroup.total_outstanding.toLocaleString()}
              </div>
            </div>

            <div style="text-align: center;">
              <a href="${window.location.origin}/member/login" 
                 style="background-color: #F7A81B; color: #1e293b; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
                Access Portal & Clear Dues
              </a>
            </div>

            <p style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 30px;">
              Thank you for your prompt attention and continued support.
            </p>
          </div>
        `;

        const emailRes = await fetch("/api/send-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            orgId: organization?.id,
            toEmail: selectedReminderGroup.email,
            toName: selectedReminderGroup.member_name,
            subject: `Payment Reminder: Dues Statement for ${organization?.name || 'Rotary Club'}`,
            htmlContent
          })
        });

        if (emailRes.ok) {
          emailSent = true;
        } else {
          const errJson = await emailRes.json().catch(() => ({}));
          errors.push(errJson.error || "Email delivery failed");
        }
      }

      // 2. Send WhatsApp if selected
      if (sendWhatsAppChannel && selectedReminderGroup.phone) {
        const sessionData = await supabase.auth.getSession();
        const token = sessionData.data.session?.access_token;
        const cleanPhone = selectedReminderGroup.phone.replace(/\D/g, "");
        const fullPhone = cleanPhone.startsWith("0") ? "256" + cleanPhone.substring(1) : (cleanPhone.length === 9 ? "256" + cleanPhone : cleanPhone);

        const waRes = await fetch("/api/send-whatsapp", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            webhookUrl: `http://ugpay.tech:3000/send-whatsapp/${organization?.id}`,
            phone: fullPhone,
            message: customMessage
          })
        });

        if (waRes.ok) {
          whatsappSent = true;
        } else {
          const waErr = await waRes.json().catch(() => ({}));
          errors.push(waErr.error || "WhatsApp gateway rejected message");
        }
      } else if (sendWhatsAppChannel && !selectedReminderGroup.phone) {
        errors.push("No registered phone number for WhatsApp");
      }

      if (emailSent || whatsappSent) {
        const sentChannels = [];
        if (emailSent) sentChannels.push("Email");
        if (whatsappSent) sentChannels.push("WhatsApp");
        toast.success(`Reminder sent via ${sentChannels.join(" & ")} to ${selectedReminderGroup.member_name}!`);
        setReminderModalOpen(false);
      } else {
        toast.error(`Failed to send reminder: ${errors.join(", ")}`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to send reminder");
    } finally {
      setSendingReminder(false);
    }
  }

  async function handleRecordCashPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!organization) return;

    const numAmount = parseFloat(cashAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid cash amount.");
      return;
    }

    setRecordingCash(true);
    try {
      const cashReceipt = `CASH-${Date.now().toString().slice(-8)}`;

      if (cashEntryType === "dues") {
        if (!cashMemberId || !cashDuesBalanceId) {
          toast.error("Please select a member and dues category.");
          setRecordingCash(false);
          return;
        }

        // 1. Fetch current dues balance item
        const { data: currentDue, error: fetchErr } = await supabase
          .from("member_dues_balances")
          .select("*, members(full_name, email, phone), dues_categories(name)")
          .eq("id", cashDuesBalanceId)
          .single();

        if (fetchErr || !currentDue) {
          throw new Error(fetchErr?.message || "Dues record not found.");
        }

        const dueAmount = Number(currentDue.amount_due);
        const newPaid = Number(currentDue.amount_paid) + numAmount;
        const newStatus = newPaid >= dueAmount ? "paid" : "partially_paid";

        // 2. Update member_dues_balances
        const { error: updateErr } = await supabase
          .from("member_dues_balances")
          .update({
            amount_paid: newPaid,
            status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", cashDuesBalanceId);

        if (updateErr) throw updateErr;

        // 3. Log cash payment in donations table
        const { error: donErr } = await supabase.from("donations").insert({
          organization_id: organization.id,
          full_name: currentDue.members?.full_name || "Member",
          email: currentDue.members?.email || null,
          phone_number: currentDue.members?.phone || null,
          amount: numAmount,
          currency: "UGX",
          category: currentDue.dues_categories?.name || "Dues Cash Payment",
          payment_method: "cash",
          status: "completed",
          receipt_number: cashReceipt,
        });

        if (donErr) throw donErr;

        toast.success(`Cash payment of UGX ${numAmount.toLocaleString()} recorded for ${currentDue.members?.full_name}! Receipt: ${cashReceipt}`);
      } else {
        // General Voluntary Cash Donation / Contribution
        if (!cashDonorName) {
          toast.error("Please enter donor name.");
          setRecordingCash(false);
          return;
        }

        const { error: donErr } = await supabase.from("donations").insert({
          organization_id: organization.id,
          full_name: cashDonorName,
          email: cashDonorEmail || null,
          phone_number: cashDonorPhone || null,
          amount: numAmount,
          currency: "UGX",
          category: cashCategory || "General Cash Donation",
          payment_method: "cash",
          status: "completed",
          receipt_number: cashReceipt,
        });

        if (donErr) throw donErr;

        toast.success(`Cash contribution of UGX ${numAmount.toLocaleString()} recorded from ${cashDonorName}! Receipt: ${cashReceipt}`);
      }

      // Reset & Invalidate
      setCashModalOpen(false);
      setCashMemberId("");
      setCashDuesBalanceId("");
      setCashDonorName("");
      setCashDonorEmail("");
      setCashDonorPhone("");
      setCashAmount("");
      queryClient.invalidateQueries({ queryKey: ["treasurer-dues-balances-extended", organization.id] });
      queryClient.invalidateQueries({ queryKey: ["treasurer-donations", organization.id] });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to record cash payment.");
    } finally {
      setRecordingCash(false);
    }
  }

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

  // ── Treasurer's Own Member Record & Dues ──────────────────────────────────
  const { data: myMemberRecord } = useQuery<{ id: string; full_name: string; email: string; phone?: string } | null>({
    queryKey: ["treasurer-own-member", organization?.id, profile?.id],
    enabled: !!organization?.id && !!profile?.id,
    queryFn: async () => {
      // Try matching by user_id first, then by email
      const { data: byUserId } = await supabase
        .from("members")
        .select("id, full_name, email, phone")
        .eq("organization_id", organization!.id)
        .eq("user_id", profile!.id)
        .maybeSingle();

      if (byUserId) return byUserId;

      if (profile?.email) {
        const { data: byEmail } = await supabase
          .from("members")
          .select("id, full_name, email, phone")
          .eq("organization_id", organization!.id)
          .ilike("email", profile.email)
          .maybeSingle();
        return byEmail || null;
      }
      return null;
    },
  });

  const { data: myDuesBalances, refetch: refetchMyDues } = useQuery<ExtendedDuesBalance[]>({
    queryKey: ["treasurer-my-dues", myMemberRecord?.id],
    enabled: !!myMemberRecord?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_dues_balances")
        .select("*, dues_categories(name)")
        .eq("member_id", myMemberRecord!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((b: any) => ({
        ...b,
        members: myMemberRecord,
      })) as ExtendedDuesBalance[];
    },
  });

  const loading = donLoading || withLoading || duesLoading;

  // ── Financial Calculations ────────────────────────────────────────────────

  const completedDonations  = donations?.filter((d) => d.status === "completed") ?? [];
  const digitalDonations    = completedDonations.filter((d) => d.payment_method !== "cash");
  const cashDonations       = completedDonations.filter((d) => d.payment_method === "cash");

  const totalDigitalRaised  = digitalDonations.reduce((s, d) => s + Number(d.amount), 0);
  const totalCashCollected  = cashDonations.reduce((s, d) => s + Number(d.amount), 0);
  const totalRaised         = totalDigitalRaised + totalCashCollected;

  const totalWithdrawn      = withdrawals
    ?.filter((w) => w.status === "completed" || w.status === "pending")
    .reduce((s, w) => s + Number(w.amount), 0) ?? 0;

  // Electronic Mobile Money Balance available for electronic withdrawal (excludes cash)
  const netBalance          = Math.max(0, totalDigitalRaised - totalWithdrawn);
  const pendingDonations    = donations?.filter((d) => d.status === "pending").length ?? 0;

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

      // Check existing dues statements for selected category to prevent duplicate billing
      const { data: existingRecords, error: checkErr } = await supabase
        .from("member_dues_balances")
        .select("member_id")
        .eq("dues_category_id", selectedCatId)
        .in("member_id", targetMembers);

      if (checkErr) throw checkErr;

      const alreadyAssignedSet = new Set(existingRecords?.map((r) => r.member_id) ?? []);
      const eligibleMembers = targetMembers.filter((id) => !alreadyAssignedSet.has(id));

      if (eligibleMembers.length === 0) {
        if (targetType === "single") {
          toast.error("This member has already been assigned this dues category.");
        } else {
          toast.info("All selected members have already been assigned this dues category.");
        }
        setAssigning(false);
        return;
      }

      const numAmount = parseFloat(assignAmount);
      const records = eligibleMembers.map((memId) => ({
        member_id: memId,
        dues_category_id: selectedCatId,
        amount_due: numAmount,
        amount_paid: 0,
        due_date: assignDueDate ? new Date(assignDueDate).toISOString() : null,
        status: "unpaid",
      }));

      const { error } = await supabase.from("member_dues_balances").insert(records);
      if (error) throw error;

      const skippedCount = alreadyAssignedSet.size;
      if (skippedCount > 0 && targetType === "all") {
        toast.success(
          `Dues assigned to ${records.length} member(s). ${skippedCount} member(s) were skipped as they were already assigned this due.`
        );
      } else {
        toast.success(`Dues assigned successfully to ${records.length} member(s)!`);
      }

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

  // ── Grouped Member Dues Balances ──────────────────────────────────────────

  const groupedMemberDues = useMemo(() => {
    const map = new Map<string, GroupedMemberDues>();

    (duesBalances || []).forEach((item) => {
      const memId = item.member_id || item.id;
      const memName = item.members?.full_name || "Unknown Member";
      const memEmail = item.members?.email || "";
      const memPhone = item.members?.phone || "";

      if (!map.has(memId)) {
        map.set(memId, {
          member_id: memId,
          member_name: memName,
          email: memEmail,
          phone: memPhone,
          total_due: 0,
          total_paid: 0,
          total_outstanding: 0,
          overall_status: "unpaid",
          items: [],
        });
      }

      const group = map.get(memId)!;
      group.items.push(item);
      group.total_due += Number(item.amount_due || 0);
      group.total_paid += Number(item.amount_paid || 0);
    });

    const result: GroupedMemberDues[] = [];
    map.forEach((group) => {
      group.total_outstanding = Math.max(0, group.total_due - group.total_paid);
      if (group.total_outstanding === 0) {
        group.overall_status = "paid";
      } else if (group.total_paid > 0) {
        group.overall_status = "partially_paid";
      } else {
        group.overall_status = "unpaid";
      }

      const matchesSearch =
        group.member_name.toLowerCase().includes(duesSearch.toLowerCase()) ||
        group.email.toLowerCase().includes(duesSearch.toLowerCase()) ||
        group.items.some((i) => (i.dues_categories?.name || "").toLowerCase().includes(duesSearch.toLowerCase()));

      const matchesStatus =
        duesStatusFilter === "all" ||
        group.overall_status === duesStatusFilter ||
        group.items.some((i) => i.status === duesStatusFilter);

      if (matchesSearch && matchesStatus) {
        result.push(group);
      }
    });

    return result;
  }, [duesBalances, duesSearch, duesStatusFilter]);

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
    <>
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

        {/* ── TAB NAVIGATION (AUTO-SCROLLING & SMOOTH SLIDING) ── */}
        <div className="relative flex items-center group">
          {/* Scroll Left Arrow (Mobile/Tablet) */}
          <button
            onClick={() => scrollTabNav("left")}
            className="absolute left-0 z-20 p-1.5 rounded-full bg-white/90 shadow-md border border-slate-200 text-slate-700 hover:text-[#17458F] hidden sm:flex lg:hidden items-center justify-center -ml-2 cursor-pointer transition-all"
            title="Scroll tabs left"
          >
            <ChevronLeft size={14} />
          </button>

          <div
            ref={tabNavRef}
            className="flex items-center gap-2 sm:gap-6 border-b border-border/60 overflow-x-auto scrollbar-none snap-x snap-mandatory scroll-smooth w-full py-0.5 px-1"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {[
              { id: "overview",    label: "Financial Overview", shortLabel: "Overview",     icon: Activity },
              { id: "dues",        label: "Dues Management",    shortLabel: "Dues",         icon: Users },
              { id: "donations",   label: "Payment Tracking",   shortLabel: "Payments",     icon: Heart },
              { id: "withdrawals", label: "Withdrawals Log",    shortLabel: "Withdrawals",  icon: History },
              { id: "mydues",      label: "My Dues",            shortLabel: "My Dues",      icon: Wallet },
            ].map(({ id, label, shortLabel, icon: Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  ref={(el) => { tabBtnRefs.current[id] = el; }}
                  onClick={() => handleTabSelect(id as any)}
                  className={`flex items-center gap-2 py-3 px-3 sm:px-2 text-xs font-bold transition-all cursor-pointer whitespace-nowrap border-b-2 -mb-px shrink-0 snap-center rounded-t-xl ${
                    active
                      ? "border-[#17458F] text-[#17458F] font-black bg-blue-50/40 sm:bg-transparent"
                      : "border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50/80"
                  }`}
                >
                  <Icon size={15} className={active ? "text-[#17458F]" : "text-slate-400"} />
                  <span className="hidden sm:inline">{label}</span>
                  <span className="inline sm:hidden">{shortLabel}</span>
                </button>
              );
            })}
          </div>

          {/* Scroll Right Arrow (Mobile/Tablet) */}
          <button
            onClick={() => scrollTabNav("right")}
            className="absolute right-0 z-20 p-1.5 rounded-full bg-white/90 shadow-md border border-slate-200 text-slate-700 hover:text-[#17458F] hidden sm:flex lg:hidden items-center justify-center -mr-2 cursor-pointer transition-all"
            title="Scroll tabs right"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* ── TAB 1: OVERVIEW ── */}
        {activeTab === "overview" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            {/* KPI STAT CARDS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Total Revenue"
                value={`UGX ${totalRaised.toLocaleString()}`}
                icon={TrendingUp}
                iconBg="#10B98118"
                iconColor="#10B981"
                sub={`Digital: ${totalDigitalRaised.toLocaleString()} • Cash: ${totalCashCollected.toLocaleString()}`}
              />
              <StatCard
                label="Withdrawable Balance"
                value={`UGX ${netBalance.toLocaleString()}`}
                icon={Wallet}
                iconBg={`${GOLD}18`}
                iconColor={GOLD}
                accent
                sub="Mobile Money only (Cash excluded)"
              />
              <StatCard
                label="Cash in Hand"
                value={`UGX ${totalCashCollected.toLocaleString()}`}
                icon={Coins}
                iconBg="#17458F14"
                iconColor={NAVY}
                sub={`${cashDonations.length} physical cash entries`}
              />
              <StatCard
                label="Total Withdrawn"
                value={`UGX ${totalWithdrawn.toLocaleString()}`}
                icon={ArrowUpRight}
                iconBg="#E53E3E18"
                iconColor="#E53E3E"
                sub={`${withdrawals?.length ?? 0} transactions`}
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
            {/* Header controls with Assign, Cash & Category buttons */}
            <PageCard className="p-4 bg-white border border-border/40 shadow-sm flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
              {/* Search & Filter Controls */}
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
                <div className="relative w-full sm:w-72">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search member or dues category..."
                    value={duesSearch}
                    onChange={(e) => setDuesSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-border/60 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#17458F]/20 transition-all"
                  />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                  <Filter size={13} className="text-muted-foreground shrink-0 hidden sm:block" />
                  <select
                    value={duesStatusFilter}
                    onChange={(e) => setDuesStatusFilter(e.target.value)}
                    className="w-full sm:w-auto bg-slate-50 border border-border/60 rounded-xl text-xs py-2 px-3 font-semibold text-slate-700 focus:outline-none"
                  >
                    <option value="all">All Payment Statuses</option>
                    <option value="unpaid">Unpaid Only</option>
                    <option value="partially_paid">Partially Paid</option>
                    <option value="paid">Fully Paid</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons Toolbar */}
              <div className="flex items-center gap-2.5 w-full xl:w-auto shrink-0 flex-wrap sm:flex-nowrap">
                <button
                  onClick={() => setAssignModalOpen(true)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-slate-900 text-xs font-black rounded-xl transition-all shadow-sm hover:brightness-105 cursor-pointer whitespace-nowrap"
                  style={{ background: GOLD }}
                >
                  <Plus size={15} /> Assign Dues
                </button>

                <button
                  onClick={() => openCashModalForMember()}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer whitespace-nowrap"
                >
                  <Coins size={15} /> Record Cash
                </button>

                <button
                  onClick={() => setCategoryModalOpen(true)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200/80 transition-all cursor-pointer whitespace-nowrap"
                >
                  <Layers size={15} /> New Category
                </button>
              </div>
            </PageCard>

            {/* Dues table (Grouped Member Accordion View - Mobile Responsive) */}
            <PageCard className="overflow-hidden p-0 bg-white border border-border/40 shadow-sm">
              {groupedMemberDues.length === 0 ? (
                <div className="py-16 text-center">
                  <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No matching member dues records found</p>
                  <p className="text-xs text-slate-400 mt-1">Click "Assign Dues" above to bill members.</p>
                </div>
              ) : (
                <>
                  {/* DESKTOP TABLE VIEW (hidden on mobile screens) */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border bg-slate-50/50 font-bold text-muted-foreground uppercase text-[9px] tracking-wider">
                          <th className="px-4 py-3.5 w-8"></th>
                          <th className="px-5 py-3.5">Member</th>
                          <th className="px-5 py-3.5 text-center">Assigned Funds</th>
                          <th className="px-5 py-3.5 text-right">Total Billed</th>
                          <th className="px-5 py-3.5 text-right">Total Paid</th>
                          <th className="px-5 py-3.5 text-right">Net Outstanding</th>
                          <th className="px-5 py-3.5 text-center">Status</th>
                          <th className="px-5 py-3.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {groupedMemberDues.map((group) => {
                          const isExpanded = Boolean(expandedMembers[group.member_id]);
                          const initial = group.member_name.charAt(0).toUpperCase();

                          return (
                            <React.Fragment key={group.member_id}>
                              {/* Main Parent Accordion Row */}
                              <tr
                                className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                                  isExpanded ? "bg-slate-50/90" : ""
                                }`}
                                onClick={() => toggleAccordion(group.member_id)}
                              >
                                <td className="px-4 py-3.5 text-slate-400">
                                  {isExpanded ? (
                                    <ChevronUp size={16} className="text-[#17458F]" />
                                  ) : (
                                    <ChevronDown size={16} />
                                  )}
                                </td>
                                <td className="px-5 py-3.5 font-bold text-foreground">
                                  <div className="flex items-center gap-2.5">
                                    <div
                                      className="w-7 h-7 rounded-full text-white text-[10px] font-black flex items-center justify-center shrink-0"
                                      style={{ background: `linear-gradient(135deg, ${NAVY}, #0067C8)` }}
                                    >
                                      {initial}
                                    </div>
                                    <div>
                                      <p className="font-bold text-foreground">{group.member_name}</p>
                                      <p className="text-[10px] text-muted-foreground font-normal">
                                        {group.email || "No email"}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-5 py-3.5 text-center font-bold text-slate-700">
                                  {group.items.length} {group.items.length === 1 ? "Category" : "Categories"}
                                </td>
                                <td className="px-5 py-3.5 text-right font-bold text-slate-700">
                                  UGX {group.total_due.toLocaleString()}
                                </td>
                                <td className="px-5 py-3.5 text-right font-bold text-emerald-600">
                                  UGX {group.total_paid.toLocaleString()}
                                </td>
                                <td className="px-5 py-3.5 text-right font-black text-rose-600">
                                  UGX {group.total_outstanding.toLocaleString()}
                                </td>
                                <td className="px-5 py-3.5 text-center">
                                  <StatusBadge status={group.overall_status} />
                                </td>
                                <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                                  {group.overall_status !== "paid" ? (
                                    <button
                                      onClick={() => openReminderModal(group)}
                                      className="inline-flex items-center gap-1 text-[10px] font-black text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg transition-all cursor-pointer shadow-xs"
                                    >
                                      <Send size={11} /> Remind
                                    </button>
                                  ) : (
                                    <span className="text-[10px] text-emerald-600 font-bold">Cleared</span>
                                  )}
                                </td>
                              </tr>

                              {/* Expanded Sub-Accordion View */}
                              {isExpanded && (
                                <tr className="bg-slate-50/50">
                                  <td colSpan={8} className="p-4 pl-12 border-t border-b border-border/30">
                                    <div className="bg-white rounded-xl border border-border/60 p-4 shadow-xs">
                                      <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/30">
                                        <span className="text-[11px] font-bold text-[#17458F] uppercase tracking-wider">
                                          Assigned Fund Categories ({group.items.length})
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-medium">
                                          {group.phone ? `Registered WhatsApp: ${group.phone}` : "No phone number registered"}
                                        </span>
                                      </div>

                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="text-[9px] text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100 pb-1">
                                            <th className="py-2 text-left">Fund Category Name</th>
                                            <th className="py-2 text-right">Amount Billed</th>
                                            <th className="py-2 text-right">Amount Paid</th>
                                            <th className="py-2 text-right">Outstanding Balance</th>
                                            <th className="py-2 text-center">Status</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                          {group.items.map((item) => {
                                            const due = Number(item.amount_due);
                                            const paid = Number(item.amount_paid);
                                            const out = Math.max(0, due - paid);

                                            return (
                                              <tr key={item.id} className="hover:bg-slate-50/60">
                                                <td className="py-2.5 font-bold text-slate-800">
                                                  {item.dues_categories?.name || "General Dues"}
                                                </td>
                                                <td className="py-2.5 text-right font-medium text-slate-700">
                                                  UGX {due.toLocaleString()}
                                                </td>
                                                <td className="py-2.5 text-right font-medium text-emerald-600">
                                                  UGX {paid.toLocaleString()}
                                                </td>
                                                <td className="py-2.5 text-right font-bold text-rose-600">
                                                  UGX {out.toLocaleString()}
                                                </td>
                                                <td className="py-2.5 text-center">
                                                  <StatusBadge status={item.status} />
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* MOBILE CARD STACK VIEW (visible on mobile screens, no horizontal scroll) */}
                  <div className="block md:hidden divide-y divide-border/40">
                    {groupedMemberDues.map((group) => {
                      const isExpanded = Boolean(expandedMembers[group.member_id]);
                      const initial = group.member_name.charAt(0).toUpperCase();

                      return (
                        <div key={group.member_id} className="p-4 flex flex-col gap-3 bg-white">
                          {/* Card Header: Member Name & Status First */}
                          <div className="flex items-center justify-between gap-2 min-w-0">
                            <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
                              <div
                                className="w-9 h-9 rounded-full text-white text-xs font-black flex items-center justify-center shrink-0"
                                style={{ background: `linear-gradient(135deg, ${NAVY}, #0067C8)` }}
                              >
                                {initial}
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className="font-bold text-sm text-foreground leading-tight truncate">{group.member_name}</h4>
                                <p className="text-[11px] text-muted-foreground truncate">{group.email || "No email"}</p>
                              </div>
                            </div>
                            <StatusBadge status={group.overall_status} />
                          </div>

                          {/* Key Figures: Outstanding & Billed */}
                          <div className="bg-slate-50 p-3 rounded-xl border border-border/50 grid grid-cols-3 gap-2 text-center">
                            <div>
                              <span className="text-[9px] uppercase font-bold text-slate-400 block">Billed</span>
                              <span className="text-xs font-bold text-slate-700">UGX {group.total_due.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-[9px] uppercase font-bold text-slate-400 block">Paid</span>
                              <span className="text-xs font-bold text-emerald-600">UGX {group.total_paid.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-[9px] uppercase font-bold text-slate-400 block">Outstanding</span>
                              <span className="text-xs font-black text-rose-600">UGX {group.total_outstanding.toLocaleString()}</span>
                            </div>
                          </div>

                          {/* Action Bar */}
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={() => toggleAccordion(group.member_id)}
                              className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1 cursor-pointer"
                            >
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              <span>{group.items.length} {group.items.length === 1 ? "Fund" : "Funds"}</span>
                            </button>

                            {group.overall_status !== "paid" && (
                              <button
                                onClick={() => openReminderModal(group)}
                                className="py-2 px-4 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-black rounded-xl flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                              >
                                <Send size={12} /> Remind
                              </button>
                            )}
                          </div>

                          {/* Expanded Mobile Fund Breakdown */}
                          {isExpanded && (
                            <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-border/60 flex flex-col gap-2">
                              <span className="text-[10px] font-bold text-[#17458F] uppercase tracking-wider">
                                Assigned Categories ({group.items.length})
                              </span>
                              <div className="flex flex-col gap-2 divide-y divide-slate-200/60">
                                {group.items.map((item) => {
                                  const due = Number(item.amount_due);
                                  const paid = Number(item.amount_paid);
                                  const out = Math.max(0, due - paid);
                                  return (
                                    <div key={item.id} className="pt-2 first:pt-0 flex items-center justify-between text-xs">
                                      <div>
                                        <span className="font-bold text-slate-800 block">{item.dues_categories?.name || "General Dues"}</span>
                                        <span className="text-[10px] text-slate-500">Paid: UGX {paid.toLocaleString()} of UGX {due.toLocaleString()}</span>
                                      </div>
                                      <div className="text-right">
                                        <span className="font-black text-rose-600 block">UGX {out.toLocaleString()}</span>
                                        <StatusBadge status={item.status} />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
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

            {/* Donations Table (Mobile Responsive) */}
            <PageCard className="overflow-hidden p-0 bg-white border border-border/40 shadow-sm">
              {filteredDonations.length === 0 ? (
                <div className="py-16 text-center">
                  <Heart className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No donations found</p>
                </div>
              ) : (
                <>
                  {/* DESKTOP VIEW */}
                  <div className="hidden md:block w-full">
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

                  {/* MOBILE CARD VIEW */}
                  <div className="block md:hidden divide-y divide-border/30">
                    {filteredDonations.map((d) => (
                      <div key={d.id} className="p-4 flex flex-col gap-2.5 bg-white">
                        <div className="flex items-start justify-between gap-2 min-w-0">
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <h4 className="font-bold text-sm text-foreground truncate">{d.full_name || "Anonymous Donor"}</h4>
                            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{d.phone_number || (d as any).phone || d.email || "No contact info"}</p>
                          </div>
                          <StatusBadge status={d.status} />
                        </div>
                        <div className="flex items-center justify-between pt-1 text-xs border-t border-slate-100 min-w-0">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-bold text-slate-700 uppercase shrink-0 truncate max-w-[140px]">
                            {d.category || "General"}
                          </span>
                          <div className="text-right shrink-0">
                            <span className="font-black text-slate-900 block">
                              {d.currency || "UGX"} {Number(d.amount).toLocaleString()}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(d.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
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
                <>
                  {/* DESKTOP VIEW */}
                  <div className="hidden md:block w-full">
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

                  {/* MOBILE CARD VIEW */}
                  <div className="block md:hidden divide-y divide-border/30">
                    {filteredWithdrawals.map((w) => (
                      <div key={w.id} className="p-4 flex flex-col gap-2 bg-white">
                        <div className="flex items-start justify-between gap-2 min-w-0">
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <h4 className="font-bold text-sm text-foreground truncate">{w.recipient_name || "Club Treasurer"}</h4>
                            <p className="text-[11px] font-mono text-muted-foreground mt-0.5 truncate">{w.recipient_phone}</p>
                          </div>
                          <StatusBadge status={w.status} />
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                          <span className="text-[10px] text-slate-400">
                            {new Date(w.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                          <span className="font-black text-rose-600">
                            UGX {Number(w.amount).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </PageCard>
          </div>
        )}

        {/* ── TAB 5: MY DUES ── */}
        {activeTab === "mydues" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            <PageCard>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-black" style={{ color: NAVY }}>My Personal Dues Statement</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {myMemberRecord
                      ? `Dues for ${myMemberRecord.full_name}`
                      : "Your member dues record will appear here once your profile is linked to a member account."}
                  </p>
                </div>
              </div>

              {!myMemberRecord ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <AlertCircle size={40} className="text-amber-400" />
                  <p className="font-bold text-sm text-slate-700">No Member Profile Linked</p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Your admin account is not yet linked to a member record. Ask your club admin to add your email address to the Members directory.
                  </p>
                </div>
              ) : !myDuesBalances || myDuesBalances.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <CheckCircle2 size={40} className="text-emerald-400" />
                  <p className="font-bold text-sm text-slate-700">All Clear!</p>
                  <p className="text-xs text-muted-foreground">You have no dues assigned to your account.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {/* Summary row */}
                  <div className="grid grid-cols-3 gap-3 mb-2">
                    {[
                      { label: "Total Billed", value: myDuesBalances.reduce((s, b) => s + Number(b.amount_due), 0), color: NAVY },
                      { label: "Total Paid", value: myDuesBalances.reduce((s, b) => s + Number(b.amount_paid), 0), color: "#10B981" },
                      { label: "Outstanding", value: Math.max(0, myDuesBalances.reduce((s, b) => s + Number(b.amount_due) - Number(b.amount_paid), 0)), color: "#E53E3E" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-center">
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">{label}</p>
                        <p className="text-sm font-black mt-1" style={{ color }}>UGX {value.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>

                  {/* Individual dues rows */}
                  <div className="rounded-xl border border-border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] text-slate-500 font-black uppercase tracking-wider">
                          <th className="px-4 py-3 text-left">Category</th>
                          <th className="px-4 py-3 text-right">Billed</th>
                          <th className="px-4 py-3 text-right">Paid</th>
                          <th className="px-4 py-3 text-right">Outstanding</th>
                          <th className="px-4 py-3 text-center">Status</th>
                          <th className="px-4 py-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {myDuesBalances.map((due) => {
                          const outstanding = Math.max(0, Number(due.amount_due) - Number(due.amount_paid));
                          return (
                            <tr key={due.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="px-4 py-3 font-bold text-foreground">
                                {due.dues_categories?.name || "General Dues"}
                                {due.due_date && (
                                  <p className="text-[10px] text-muted-foreground font-normal mt-0.5">
                                    Due: {new Date(due.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                                  </p>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right font-mono">UGX {Number(due.amount_due).toLocaleString()}</td>
                              <td className="px-4 py-3 text-right font-mono text-emerald-700">UGX {Number(due.amount_paid).toLocaleString()}</td>
                              <td className="px-4 py-3 text-right font-mono font-black text-rose-600">UGX {outstanding.toLocaleString()}</td>
                              <td className="px-4 py-3 text-center">
                                <StatusBadge status={due.status} />
                              </td>
                              <td className="px-4 py-3 text-center">
                                {outstanding > 0 ? (
                                  <button
                                    onClick={() => {
                                      setMySelectedDue(due);
                                      setMyPayAmount(outstanding.toString());
                                      setMyPayPhone("");
                                      setMyPayPolling(false);
                                      setMyPayPollingRef("");
                                      setMyPayModalOpen(true);
                                    }}
                                    className="px-3 py-1.5 rounded-xl text-[10px] font-black text-white cursor-pointer hover:brightness-105 transition-all flex items-center gap-1 mx-auto"
                                    style={{ background: NAVY }}
                                  >
                                    <Coins size={11} /> Pay Now
                                  </button>
                                ) : (
                                  <span className="text-emerald-600 font-black text-[10px] flex items-center gap-1 justify-center">
                                    <CheckCircle2 size={11} /> Settled
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </PageCard>
          </div>
        )}
      </div>

      {/* ── MODAL 1: ASSIGN DUES TO MEMBERS ── */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <PageCard className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white border border-border rounded-2xl shadow-2xl p-4 sm:p-6 flex flex-col gap-5 animate-in zoom-in-95">
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

      {/* ── MODAL 3: CUSTOMIZED PAYMENT REMINDER MODAL ── */}
      {reminderModalOpen && selectedReminderGroup && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <PageCard className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white border border-border rounded-2xl shadow-2xl p-4 sm:p-6 flex flex-col gap-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div>
                <h3 className="text-md font-black uppercase tracking-wider text-[#17458F]">
                  Send Payment Reminder
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Recipient: <strong className="text-slate-800">{selectedReminderGroup.member_name}</strong>
                </p>
              </div>
              <button
                onClick={() => setReminderModalOpen(false)}
                className="text-xs text-slate-500 hover:text-slate-800 font-bold px-2 py-1 bg-slate-100 rounded-lg cursor-pointer"
                disabled={sendingReminder}
              >
                Close
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {/* Delivery Channels */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Delivery Channels</label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                      sendEmailChannel ? "bg-indigo-50/60 border-indigo-300 text-indigo-900" : "bg-slate-50 border-border text-slate-500"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={sendEmailChannel}
                      onChange={(e) => setSendEmailChannel(e.target.checked)}
                      className="rounded text-[#17458F]"
                    />
                    <Mail size={16} className="text-indigo-600 shrink-0" />
                    <div className="flex flex-col">
                      <span>Email Statement</span>
                      <span className="text-[10px] font-normal text-slate-500">{selectedReminderGroup.email || "No email"}</span>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                      sendWhatsAppChannel ? "bg-emerald-50/60 border-emerald-300 text-emerald-900" : "bg-slate-50 border-border text-slate-500"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={sendWhatsAppChannel}
                      onChange={(e) => setSendWhatsAppChannel(e.target.checked)}
                      className="rounded text-emerald-600"
                    />
                    <MessageSquare size={16} className="text-emerald-600 shrink-0" />
                    <div className="flex flex-col">
                      <span>WhatsApp Message</span>
                      <span className="text-[10px] font-normal text-slate-500">{selectedReminderGroup.phone || "No phone"}</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Outstanding Statement Breakdown Box */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-border/60 flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-600">Total Billed:</span>
                  <span className="font-bold text-slate-800">UGX {selectedReminderGroup.total_due.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-600">Total Paid:</span>
                  <span className="font-bold text-emerald-600">UGX {selectedReminderGroup.total_paid.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-xs border-t border-slate-200 pt-1.5 font-black">
                  <span className="text-rose-600">Net Outstanding:</span>
                  <span className="text-rose-600 text-sm">UGX {selectedReminderGroup.total_outstanding.toLocaleString()}</span>
                </div>
              </div>

              {/* Editable Message Textarea */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Customized Message Preview</label>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  className="w-full h-36 px-4 py-3 rounded-xl border border-border bg-slate-50 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#17458F]/20 resize-none leading-relaxed"
                  placeholder="Type your customized message here..."
                />
              </div>

              {/* Action Submit */}
              <button
                onClick={handleSendReminder}
                disabled={sendingReminder}
                className="w-full py-3 text-slate-900 font-black text-xs rounded-xl shadow cursor-pointer flex items-center justify-center gap-2 hover:brightness-105 transition-all"
                style={{ background: GOLD }}
              >
                {sendingReminder ? <Loader2 size={16} className="animate-spin" /> : <><Send size={15} /> Send Customized Reminder Now</>}
              </button>
            </div>
          </PageCard>
        </div>
      )}

      {/* ── MODAL 4: RECORD CASH PAYMENT & DONATION MODAL ── */}
      {cashModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <PageCard className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white border border-border rounded-2xl shadow-2xl p-4 sm:p-6 flex flex-col gap-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div>
                <h3 className="text-md font-black uppercase tracking-wider text-[#17458F]">
                  Record Cash Entry
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Record dues or voluntary contributions received in physical cash.
                </p>
              </div>
              <button
                onClick={() => setCashModalOpen(false)}
                className="text-xs text-slate-500 hover:text-slate-800 font-bold px-2 py-1 bg-slate-100 rounded-lg cursor-pointer"
                disabled={recordingCash}
              >
                Close
              </button>
            </div>

            {/* Entry Mode Switcher */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setCashEntryType("dues")}
                className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  cashEntryType === "dues" ? "bg-white text-[#17458F] shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Member Dues Payment
              </button>
              <button
                type="button"
                onClick={() => setCashEntryType("donation")}
                className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  cashEntryType === "donation" ? "bg-white text-[#17458F] shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Voluntary Cash Donation
              </button>
            </div>

            <form onSubmit={handleRecordCashPayment} className="flex flex-col gap-4">
              {cashEntryType === "dues" ? (
                <>
                  {/* Member Selection */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Select Member</label>
                    <select
                      value={cashMemberId}
                      onChange={(e) => openCashModalForMember(e.target.value)}
                      className="px-4 py-2.5 rounded-xl border border-border bg-slate-50 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#17458F]/20"
                      required
                    >
                      <option value="">-- Choose Member --</option>
                      {groupedMemberDues.map((m) => (
                        <option key={m.member_id} value={m.member_id}>
                          {m.member_name} (Outstanding: UGX {m.total_outstanding.toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Dues Category Selection */}
                  {cashMemberId && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Assigned Fund Category</label>
                      <select
                        value={cashDuesBalanceId}
                        onChange={(e) => {
                          const balId = e.target.value;
                          setCashDuesBalanceId(balId);
                          const memberGroup = groupedMemberDues.find((g) => g.member_id === cashMemberId);
                          const selectedItem = memberGroup?.items.find((i) => i.id === balId);
                          if (selectedItem) {
                            const outstanding = Math.max(0, Number(selectedItem.amount_due) - Number(selectedItem.amount_paid));
                            setCashAmount(outstanding.toString());
                          }
                        }}
                        className="px-4 py-2.5 rounded-xl border border-border bg-slate-50 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#17458F]/20"
                        required
                      >
                        <option value="">-- Choose Category --</option>
                        {groupedMemberDues
                          .find((g) => g.member_id === cashMemberId)
                          ?.items.map((item) => {
                            const due = Number(item.amount_due);
                            const paid = Number(item.amount_paid);
                            const out = Math.max(0, due - paid);
                            return (
                              <option key={item.id} value={item.id}>
                                {item.dues_categories?.name || "General Dues"} (Billed: {due.toLocaleString()}, Net Due: UGX {out.toLocaleString()})
                              </option>
                            );
                          })}
                      </select>
                    </div>
                  )}

                  {/* Cash Amount */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Cash Amount Received (UGX)</label>
                    <input
                      type="number"
                      placeholder="e.g. 100000"
                      value={cashAmount}
                      onChange={(e) => setCashAmount(e.target.value)}
                      className="px-4 py-2.5 rounded-xl border border-border bg-slate-50 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#17458F]/20"
                      required
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* Donor Name */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Donor Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Rtn. John Doe or Visiting Guest"
                      value={cashDonorName}
                      onChange={(e) => setCashDonorName(e.target.value)}
                      className="px-4 py-2.5 rounded-xl border border-border bg-slate-50 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#17458F]/20"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Email (Optional)</label>
                      <input
                        type="email"
                        placeholder="donor@example.com"
                        value={cashDonorEmail}
                        onChange={(e) => setCashDonorEmail(e.target.value)}
                        className="px-4 py-2.5 rounded-xl border border-border bg-slate-50 text-xs focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Phone (Optional)</label>
                      <input
                        type="tel"
                        placeholder="0770000000"
                        value={cashDonorPhone}
                        onChange={(e) => setCashDonorPhone(e.target.value)}
                        className="px-4 py-2.5 rounded-xl border border-border bg-slate-50 text-xs focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Donation Category */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Contribution Category</label>
                    <input
                      type="text"
                      placeholder="e.g. Happy Shilling, Service Project, Fellowship Meal"
                      value={cashCategory}
                      onChange={(e) => setCashCategory(e.target.value)}
                      className="px-4 py-2.5 rounded-xl border border-border bg-slate-50 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#17458F]/20"
                      required
                    />
                  </div>

                  {/* Cash Amount */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Cash Amount Received (UGX)</label>
                    <input
                      type="number"
                      placeholder="e.g. 50000"
                      value={cashAmount}
                      onChange={(e) => setCashAmount(e.target.value)}
                      className="px-4 py-2.5 rounded-xl border border-border bg-slate-50 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#17458F]/20"
                      required
                    />
                  </div>
                </>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={recordingCash}
                className="w-full py-3 text-white font-black text-xs rounded-xl shadow cursor-pointer flex items-center justify-center gap-2 hover:brightness-105 transition-all mt-2"
                style={{ background: NAVY }}
              >
                {recordingCash ? <Loader2 size={16} className="animate-spin" /> : <><Coins size={15} /> Record Cash Entry & Generate Receipt</>}
              </button>
            </form>
          </PageCard>
        </div>
      )}
    </AdminLayout>

    {/* ── MY DUES PAYMENT MODAL ── */}
    {myPayModalOpen && mySelectedDue && (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <PageCard className="w-full max-w-sm flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black" style={{ color: NAVY }}>Pay My Dues via Mobile Money</h2>
            <button onClick={() => setMyPayModalOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
              <span className="text-slate-500 text-lg font-bold">×</span>
            </button>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Category</p>
            <p className="text-sm font-black mt-0.5" style={{ color: NAVY }}>
              {mySelectedDue.dues_categories?.name || "General Dues"}
            </p>
            <div className="flex gap-4 mt-2 text-xs">
              <span>Billed: <strong>UGX {Number(mySelectedDue.amount_due).toLocaleString()}</strong></span>
              <span>Paid: <strong className="text-emerald-700">UGX {Number(mySelectedDue.amount_paid).toLocaleString()}</strong></span>
              <span>Outstanding: <strong className="text-rose-600">UGX {Math.max(0, Number(mySelectedDue.amount_due) - Number(mySelectedDue.amount_paid)).toLocaleString()}</strong></span>
            </div>
          </div>

          {myPayPolling ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 size={32} className="animate-spin text-[#17458F]" />
              <p className="text-sm font-bold text-muted-foreground">Waiting for Mobile Money confirmation...</p>
              <p className="text-xs text-muted-foreground">Please approve the prompt on your phone. This may take up to 60 seconds.</p>
              <button
                onClick={() => { setMyPayPolling(false); setMyPayModalOpen(false); refetchMyDues(); }}
                className="mt-2 px-4 py-2 rounded-xl text-xs font-bold border border-border hover:bg-slate-50 cursor-pointer"
              >
                Close & Refresh Later
              </button>
            </div>
          ) : (
            <form onSubmit={handleMyDuesPaymentSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Amount to Pay (UGX)</label>
                <input
                  type="number"
                  placeholder="e.g. 100000"
                  value={myPayAmount}
                  onChange={(e) => setMyPayAmount(e.target.value)}
                  className="px-4 py-2.5 rounded-xl border border-border bg-slate-50 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#17458F]/20"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Mobile Money Phone</label>
                <input
                  type="tel"
                  placeholder="0770000000"
                  value={myPayPhone}
                  onChange={(e) => setMyPayPhone(e.target.value)}
                  className="px-4 py-2.5 rounded-xl border border-border bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#17458F]/20"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={myPayInitiating}
                className="w-full py-3 text-white font-black text-xs rounded-xl shadow cursor-pointer flex items-center justify-center gap-2 hover:brightness-105 transition-all"
                style={{ background: NAVY }}
              >
                {myPayInitiating ? <Loader2 size={16} className="animate-spin" /> : <><Coins size={15} /> Pay via Mobile Money</>}
              </button>
            </form>
          )}
        </PageCard>
      </div>
    )}
    </>
  );
}

export default TreasurerDashboard;
