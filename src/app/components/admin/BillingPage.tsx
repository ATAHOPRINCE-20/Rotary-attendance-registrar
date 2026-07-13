import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { toast } from "sonner";
import { NAVY, GOLD } from "../../../lib/constants";
import { AdminLayout } from "../shared/AdminLayout";
import { useAuth } from "../../../context/AuthContext";
import { getLicenseStatus } from "../../../lib/licensing";
import {
  CreditCard,
  X,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Users,
  Award,
  DollarSign,
  Phone,
} from "lucide-react";

export function BillingPage() {
  const { organization, refreshProfile } = useAuth();
  
  // Subscription Billing States
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annually">("monthly");
  const [upgradePhone, setUpgradePhone] = useState("");
  const [initiatingPayment, setInitiatingPayment] = useState(false);
  const [paymentRef, setPaymentRef] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "pending" | "success" | "failed">("idle");
  const [isPolling, setIsPolling] = useState(false);

  // Load prefilled MoMo number
  useEffect(() => {
    if (showBillingModal && organization?.momo_phone) {
      setUpgradePhone(organization.momo_phone);
    }
  }, [showBillingModal, organization]);

  // Initiate Upgrade Payment
  async function handleInitiateSubscriptionUpgrade() {
    if (!organization) return;
    if (!upgradePhone.trim()) {
      toast.error("Please enter a valid Mobile Money number.");
      return;
    }

    setInitiatingPayment(true);
    setPaymentStatus("pending");
    try {
      const amount = billingPeriod === "monthly" ? 100005 : 1000005; // 100k or 1M UGX
      const response = await fetch("/api/initiate-donation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: organization.id,
          amount: amount,
          fullName: `Sub Upgrade - ${organization.name}`,
          paymentMethod: "mobile",
          phone: upgradePhone.trim(),
          category: "subscription"
        }),
      });

      const res = await response.json();
      if (!response.ok) {
        throw new Error(res.error || "Failed to initiate payment");
      }

      setPaymentRef(res.reference);
      setIsPolling(true);
      toast.success(res.isSimulated ? "Simulated Mobile Money prompt initiated!" : "Mobile Money prompt sent. Please enter your PIN.");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to trigger payment. Please try again.");
      setPaymentStatus("idle");
    } finally {
      setInitiatingPayment(false);
    }
  }

  // Poll for Payment Completion
  useEffect(() => {
    let interval: any;
    if (isPolling && paymentRef && organization) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/check-donation?reference=${paymentRef}&organizationId=${organization.id}`);
          const data = await res.json();
          if (data.status === "completed") {
            clearInterval(interval);
            setIsPolling(false);
            setPaymentStatus("success");

            // Perform Supabase update to standard tier
            const duration = billingPeriod === "monthly" ? 30 * 24 * 60 * 60 * 1000 : 365 * 24 * 60 * 60 * 1000;
            const expiresAt = new Date(Date.now() + duration).toISOString();
            
            const { error: updateError } = await supabase
              .from("organizations")
              .update({
                subscription_tier: "standard",
                subscription_expires_at: expiresAt,
                momo_phone: upgradePhone.trim()
              })
              .eq("id", organization.id);

            if (updateError) throw updateError;

            toast.success("Subscription upgraded successfully!");
            await refreshProfile();
            setTimeout(() => {
              setShowBillingModal(false);
              setPaymentStatus("idle");
              setPaymentRef(null);
            }, 2500);

          } else if (data.status === "failed") {
            clearInterval(interval);
            setIsPolling(false);
            setPaymentStatus("failed");
            toast.error("Payment was unsuccessful. Please check your balance or enter a different phone number.");
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 3000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPolling, paymentRef, organization, billingPeriod, upgradePhone]);

  const license = getLicenseStatus(organization);
  const isStandard = license.tier === "standard" || license.tier === "premium";
  const isTrial = license.tier === "trial";
  const expiresDateStr = organization?.subscription_expires_at 
    ? new Date(organization.subscription_expires_at).toLocaleDateString("en-GB") 
    : "";

  return (
    <AdminLayout pageTitle="Subscription & Billing">
      <div className="max-w-4xl mx-auto min-h-screen">
        {/* Page Heading */}
        <div className="mb-6">
          <h1 className="text-2xl font-black" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
            Subscription & Billing
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your club's subscription plan, Mobile Money billing, and license configurations.
          </p>
        </div>

        {/* ── Dashboard Content ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          
          {/* Left panel: Current Subscription Details */}
          <div className="bg-white rounded-2xl p-6 border border-border/40 shadow-sm md:col-span-2 flex flex-col gap-6">
            <div>
              <h3 className="text-base font-bold text-foreground" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
                Plan Overview
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Current active plan settings and features checklist.
              </p>
            </div>

            {/* Plan Info Card */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Current Plan</span>
                  <span className="text-lg font-black mt-0.5 block capitalize" style={{ color: NAVY }}>
                    {license.tier} Plan
                  </span>
                </div>
                <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${
                  isStandard 
                    ? "bg-purple-100 text-purple-800" 
                    : isTrial 
                    ? "bg-indigo-100 text-indigo-800" 
                    : "bg-slate-100 text-slate-800"
                }`}>
                  {license.tier}
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200/60 pt-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    {license.isExpired ? "Subscription Status" : "Renewal / Expiration Date"}
                  </span>
                  <span className={`text-sm font-extrabold mt-0.5 block ${license.isExpired ? "text-rose-600" : "text-slate-700"}`}>
                    {license.isExpired 
                      ? "Expired" 
                      : isStandard 
                      ? expiresDateStr 
                      : isTrial 
                      ? `${license.daysRemaining} days remaining in trial` 
                      : "Indefinite Free Plan"}
                  </span>
                </div>
              </div>

              {license.isExpired && (
                <div className="bg-rose-50 border border-rose-100 rounded-xl p-3.5 flex items-start gap-2.5">
                  <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-rose-800 font-bold leading-normal">
                    Your subscription has expired. Upgraded features (PDF exports, WhatsApp notifications, unlimited directories) are currently locked until subscription renewal.
                  </p>
                </div>
              )}
            </div>

            {/* Feature Access Checklist */}
            <div className="border-t border-slate-100 pt-5">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Included Plan Capabilities</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {[
                  { label: "Automatic Check-in Tracking", active: true },
                  { label: "Roster / Member Directory", active: true, info: license.limits.maxMembers === Infinity ? "Unlimited" : `Up to ${license.limits.maxMembers} members` },
                  { label: "Vercel Calendar Scheduling", active: true, info: license.limits.maxEvents === Infinity ? "Unlimited" : `Up to ${license.limits.maxEvents} events` },
                  { label: "PDF Reports & printed registers", active: license.features.pdfExport },
                  { label: "WhatsApp Welcome Notifications", active: license.features.whatsappComms },
                  { label: "Financial Donation Campaigns", active: license.features.donations },
                  { label: "In-depth Analytics & reporting", active: license.features.analytics },
                  { label: "Buddy Group Metrics", active: license.features.buddyGroups },
                ].map((feat, idx) => (
                  <div key={idx} className="flex items-center gap-2.5">
                    <CheckCircle2 size={16} className={feat.active ? "text-emerald-500 shrink-0" : "text-slate-300 shrink-0"} />
                    <span className={`text-xs ${feat.active ? "text-slate-700 font-semibold" : "text-slate-400 line-through"}`}>
                      {feat.label} {feat.info && <span className="text-[10px] text-muted-foreground ml-1">({feat.info})</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right panel: Payment Prompt Option */}
          <div className="bg-white rounded-2xl p-6 border border-border/40 shadow-sm flex flex-col gap-6 justify-between min-h-[250px]">
            <div>
              <h3 className="text-base font-bold text-foreground" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
                Licensing Actions
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Upgrade or extend your plan using Mobile Money instantly.
              </p>

              <div className="mt-4 flex flex-col gap-1.5 text-left text-xs bg-slate-50 border border-slate-100 rounded-xl p-4">
                <p className="font-bold text-slate-800">Standard Plan Pricing:</p>
                <p className="text-muted-foreground mt-1 flex items-center justify-between">
                  <span>Monthly Plan:</span> <strong style={{ color: NAVY }}>100,000 UGX</strong>
                </p>
                <p className="text-muted-foreground flex items-center justify-between">
                  <span>Annual Plan:</span> <strong style={{ color: NAVY }}>1,000,000 UGX</strong>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowBillingModal(true)}
              className="w-full py-3 rounded-xl text-xs font-bold text-white transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md hover:scale-[1.01] active:scale-[0.99]"
              style={{ background: GOLD }}
            >
              <CreditCard size={14} />
              Upgrade / Renew Now
            </button>
          </div>

        </div>

        {/* ── Subscription Billing Modal ── */}
        {showBillingModal && (
          <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-border shadow-2xl w-full max-w-sm overflow-hidden flex flex-col p-6 animate-in zoom-in-95 duration-150 relative">
              <button
                onClick={() => {
                  if (isPolling) return;
                  setShowBillingModal(false);
                  setPaymentStatus("idle");
                }}
                disabled={initiatingPayment || isPolling}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 disabled:opacity-30"
              >
                <X size={20} />
              </button>
              
              <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
                <CreditCard size={22} />
              </div>
              
              <h3 className="text-base font-black text-foreground mb-1" style={{ color: NAVY }}>
                Upgrade to Standard Plan
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Unlock PDF downloads, WhatsApp integration, and unlimited directories.
              </p>

              {paymentStatus === "idle" && (
                <div className="w-full flex flex-col gap-4">
                  {/* Select Billing Period */}
                  <div className="flex gap-2 bg-slate-100 p-1 rounded-xl w-full">
                    <button 
                      type="button"
                      className={`flex-1 text-xs font-bold py-2 rounded-lg transition-all cursor-pointer ${billingPeriod === 'monthly' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                      onClick={() => setBillingPeriod("monthly")}
                    >
                      Monthly (100k UGX)
                    </button>
                    <button 
                      type="button"
                      className={`flex-1 text-xs font-bold py-2 rounded-lg transition-all cursor-pointer ${billingPeriod === 'annually' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                      onClick={() => setBillingPeriod("annually")}
                    >
                      Annual (1M UGX)
                    </button>
                  </div>

                  {/* MoMo Number Input */}
                  <div className="flex flex-col gap-1 text-left">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">MTN / Airtel Mobile Money Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 256770123456"
                      value={upgradePhone}
                      onChange={(e) => setUpgradePhone(e.target.value)}
                      className="w-full px-4 py-2.5 border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#17458F]/30 bg-input-background"
                    />
                  </div>

                  <button
                    onClick={handleInitiateSubscriptionUpgrade}
                    disabled={!upgradePhone.trim() || initiatingPayment}
                    className="w-full py-3 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-50 mt-2 cursor-pointer"
                    style={{ background: NAVY }}
                  >
                    {initiatingPayment ? "Initiating..." : "💳 Pay with Mobile Money"}
                  </button>
                </div>
              )}

              {paymentStatus === "pending" && (
                <div className="flex flex-col items-center py-6 text-center">
                  <div className="w-10 h-10 border-4 border-slate-200 border-t-[#17458F] rounded-full animate-spin mb-4" />
                  <p className="text-xs font-bold text-slate-800">Processing Subscription Upgrade</p>
                  <p className="text-[11px] text-muted-foreground mt-1 max-w-[240px]">
                    We've triggered a prompt to <strong>{upgradePhone}</strong>. Please check your phone, enter your Mobile Money PIN to approve, and wait here.
                  </p>
                </div>
              )}

              {paymentStatus === "success" && (
                <div className="flex flex-col items-center py-6 text-center">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
                    ✓
                  </div>
                  <p className="text-xs font-black text-emerald-800">Payment Completed Successfully!</p>
                  <p className="text-[11px] text-muted-foreground mt-1 max-w-[240px]">
                    Your subscription has been updated to Standard. Thank you!
                  </p>
                </div>
              )}

              {paymentStatus === "failed" && (
                <div className="flex flex-col items-center py-4 text-center">
                  <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
                    ✕
                  </div>
                  <p className="text-xs font-black text-rose-800">Payment Verification Failed</p>
                  <p className="text-[11px] text-muted-foreground mt-1 mb-4 max-w-[240px]">
                    The payment was cancelled, timed out, or had insufficient funds.
                  </p>
                  <button
                    onClick={() => setPaymentStatus("idle")}
                    className="px-4 py-2 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
