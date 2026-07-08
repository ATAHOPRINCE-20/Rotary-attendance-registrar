import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../context/AuthContext";
import { supabase } from "../../../lib/supabase";
import { useOrgDonations } from "../../../hooks/useDonations";
import { useOrgWithdrawals, useRequestWithdrawal } from "../../../hooks/useWithdrawals";
import { AdminLayout } from "../shared/AdminLayout";
import { PageCard, TextInput } from "../shared/PageCard";
import { GoldButton, OutlineButton } from "../shared/Buttons";
import { NAVY, GOLD } from "../../../lib/constants";
import {
  Wallet,
  ArrowDownToLine,
  ArrowUpRight,
  TrendingUp,
  History,
  Phone,
  User,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { LoadingScreen } from "../shared/LoadingScreen";

export function AdminWithdrawalsPage() {
  const { organization } = useAuth();
  const qc = useQueryClient();

  // Queries
  const { data: donations,   isLoading: donLoading } = useOrgDonations(organization?.id);
  const { data: withdrawals, isLoading: withLoading } = useOrgWithdrawals(organization?.id);
  const requestWithdrawalMutation = useRequestWithdrawal();

  // Poll status of pending withdrawals in the background
  useEffect(() => {
    if (!withdrawals || withdrawals.length === 0 || !organization?.id) return;

    const pending = withdrawals.filter((w) => w.status === "pending");
    if (pending.length === 0) return;

    const checkPending = () => {
      pending.forEach(async (w) => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;

          const response = await fetch(`/api/check-withdrawal?reference=${w.reference}&organizationId=${organization.id}`, {
            headers: {
              ...(token ? { "Authorization": `Bearer ${token}` } : {}),
            }
          });
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.status !== "pending") {
              qc.invalidateQueries({ queryKey: ["org-withdrawals", organization.id] });
              qc.invalidateQueries({ queryKey: ["org-donations", organization.id] });
            }
          }
        } catch (error) {
          console.error("Error checking withdrawal status:", error);
        }
      });
    };

    checkPending();
    const interval = setInterval(checkPending, 5000);
    return () => clearInterval(interval);
  }, [withdrawals, organization?.id, qc]);

  const loading = donLoading || withLoading;

  // Form State
  const [phone, setPhone] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [amount, setAmount] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Financial Calculations
  const totalRaised = donations
    ?.filter((d) => d.status === "completed")
    .reduce((sum, d) => sum + Number(d.amount), 0) ?? 0;

  const totalWithdrawn = withdrawals
    ?.filter((w) => w.status === "completed" || w.status === "pending")
    .reduce((sum, w) => sum + Number(w.amount), 0) ?? 0;

  const netBalance = totalRaised - totalWithdrawn;

  // Form submission
  async function handleRequestPayout(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!phone.trim() || !amount.trim()) {
      setFormError("Recipient phone number and payout amount are required.");
      return;
    }

    const payoutAmount = Number(amount);
    if (isNaN(payoutAmount) || payoutAmount <= 0) {
      setFormError("Please enter a valid amount greater than zero.");
      return;
    }

    if (payoutAmount > netBalance) {
      setFormError(`Insufficient balance. You can withdraw up to UGX ${netBalance.toLocaleString()}.`);
      return;
    }

    // Format phone digits check
    const digitsOnly = phone.replace(/\D/g, "");
    if (digitsOnly.length < 9) {
      setFormError("Please enter a valid phone number.");
      return;
    }

    setRequesting(true);
    try {
      await requestWithdrawalMutation.mutateAsync({
        organizationId: organization!.id,
        amount: payoutAmount,
        phone: phone.trim(),
        recipientName: recipientName.trim(),
      });

      toast.success("Payout request successfully submitted!");
      // Reset form
      setPhone("");
      setRecipientName("");
      setAmount("");
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || "Failed to process withdrawal payout.");
    } finally {
      setRequesting(false);
    }
  }

  // Pre-format phone numbers
  function handlePhoneChange(val: string) {
    // Keep only numbers and plus sign
    const cleaned = val.replace(/[^\d+]/g, "");
    setPhone(cleaned);
  }

  return (
    <AdminLayout pageTitle="Withdrawals & Liquidations">
      <div className="flex flex-col gap-6 max-w-7xl mx-auto">
        
        {/* Header Block */}
        <div className="mb-2">
          <h1 className="text-2xl font-black flex items-center gap-2.5" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
            <Wallet size={26} className="text-[#F7A81B]" />
            Withdrawals & Liquidation
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
            Liquidate your collected donations directly to your mobile money wallet. Monitor balances and audit payout history.
          </p>
        </div>

        {loading ? (
          <LoadingScreen variant="light" fullScreen={false} />
        ) : (
          <>
            {/* ── METRIC STAT CARDS ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Total Raised */}
              <div className="bg-white rounded-2xl p-5 border border-border/40 shadow-sm flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: "#10B98118", color: "#10B981" }}
                  >
                    <CheckCircle2 size={18} />
                  </div>
                  <span title="Total completed donations received">
                    <HelpCircle size={14} className="text-muted-foreground cursor-help" />
                  </span>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-bold tracking-wider uppercase">Total Raised</p>
                  <p className="text-xl font-black mt-0.5" style={{ color: NAVY }}>UGX {totalRaised.toLocaleString()}</p>
                </div>
              </div>

              {/* Total Paid Out */}
              <div className="bg-white rounded-2xl p-5 border border-border/40 shadow-sm flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: "#E53E3E18", color: "#E53E3E" }}
                  >
                    <ArrowUpRight size={18} />
                  </div>
                  <span title="Total withdrawn or pending payouts">
                    <HelpCircle size={14} className="text-muted-foreground cursor-help" />
                  </span>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-bold tracking-wider uppercase">Total Withdrawn</p>
                  <p className="text-xl font-black mt-0.5" style={{ color: NAVY }}>UGX {totalWithdrawn.toLocaleString()}</p>
                </div>
              </div>

              {/* Net Available Balance */}
              <div className="bg-white rounded-2xl p-5 border border-border/40 shadow-sm flex flex-col gap-3" style={{ borderLeft: `4px solid ${GOLD}` }}>
                <div className="flex items-center justify-between">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: `${GOLD}18`, color: GOLD }}
                  >
                    <Wallet size={18} />
                  </div>
                  <span title="Funds available to withdraw">
                    <HelpCircle size={14} className="text-muted-foreground cursor-help" />
                  </span>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-bold tracking-wider uppercase">Withdrawable Balance</p>
                  <p className="text-xl font-black mt-0.5" style={{ color: NAVY }}>UGX {netBalance.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* ── CONTENT GRID ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Request Payout Form */}
              <div className="lg:col-span-4">
                <PageCard className="p-6 bg-white border border-border/40 shadow-sm flex flex-col gap-5">
                  <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
                      <ArrowDownToLine size={16} />
                      Request Mobile Payout
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Initiate an instant transfer to any MTN or Airtel Mobile Money account.
                    </p>
                  </div>

                  <form onSubmit={handleRequestPayout} className="flex flex-col gap-4">
                    <TextInput
                      label="Recipient Phone Number"
                      placeholder="e.g. 0772000000 or +25675..."
                      value={phone}
                      onChange={handlePhoneChange}
                      type="tel"
                      required
                    />

                    <TextInput
                      label="Recipient Full Name (Optional)"
                      placeholder="e.g. John Doe"
                      value={recipientName}
                      onChange={setRecipientName}
                    />

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Amount (UGX)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-muted-foreground">UGX</span>
                        <input
                          type="number"
                          placeholder="e.g. 50000"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="w-full pl-14 pr-4 py-2.5 text-xs rounded-xl border border-border bg-input-background text-foreground font-semibold focus:outline-none"
                          required
                        />
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <button
                          type="button"
                          onClick={() => setAmount(netBalance.toString())}
                          className="text-[10px] font-bold text-[#17458F] hover:underline"
                          disabled={netBalance <= 0}
                        >
                          Withdraw max
                        </button>
                        <span className="text-[9px] text-muted-foreground">Max: UGX {netBalance.toLocaleString()}</span>
                      </div>
                    </div>

                    {formError && (
                      <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-[11px] bg-destructive/10 text-destructive leading-normal">
                        <AlertCircle size={14} className="shrink-0 mt-0.5" />
                        <span className="font-semibold">{formError}</span>
                      </div>
                    )}

                    <GoldButton
                      type="submit"
                      disabled={requesting || netBalance <= 0}
                      className="w-full py-2.5 justify-center font-bold text-xs"
                    >
                      {requesting ? "Processing..." : "Submit Payout Request"}
                    </GoldButton>
                  </form>
                </PageCard>
              </div>

              {/* Right Column: Transactions History */}
              <div className="lg:col-span-8">
                <PageCard className="bg-white border border-border/40 shadow-sm overflow-hidden p-0">
                  <div className="px-5 py-4 border-b border-border/40 flex items-center gap-2">
                    <History size={16} style={{ color: NAVY }} />
                    <h3 className="text-sm font-bold" style={{ color: NAVY }}>Payout History</h3>
                  </div>

                  <div className="overflow-x-auto">
                    {!withdrawals || withdrawals.length === 0 ? (
                      <div className="text-center py-20 px-4">
                        <History className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                        <p className="text-sm font-semibold text-foreground">No withdrawals logged yet</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Payout records will appear here as soon as you request a liquidation.
                        </p>
                      </div>
                    ) : (
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-border bg-muted/5 font-bold text-muted-foreground uppercase text-[9px] tracking-wider">
                            <th className="px-5 py-3">Reference / Date</th>
                            <th className="px-5 py-3">Recipient</th>
                            <th className="px-5 py-3 text-right">Amount</th>
                            <th className="px-5 py-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {withdrawals.map((w) => {
                            const date = new Date(w.created_at).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            });

                            return (
                              <tr key={w.id} className="hover:bg-muted/5 transition-colors">
                                <td className="px-5 py-3.5">
                                  <p className="font-bold text-foreground">{w.reference}</p>
                                  <p className="text-[9px] text-muted-foreground mt-0.5">{date}</p>
                                </td>
                                <td className="px-5 py-3.5">
                                  <p className="font-semibold text-foreground flex items-center gap-1">
                                    <User size={10} className="text-muted-foreground" />
                                    {w.recipient_name || "Club Wallet"}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                                    <Phone size={10} />
                                    {w.recipient_phone}
                                  </p>
                                </td>
                                <td className="px-5 py-3.5 text-right font-black text-foreground">
                                  UGX {Number(w.amount).toLocaleString()}
                                </td>
                                <td className="px-5 py-3.5 text-center">
                                  {w.status === "pending" && (
                                    <span className="px-2 py-0.5 rounded text-[8px] font-extrabold uppercase bg-amber-100 text-amber-600">
                                      Pending
                                    </span>
                                  )}
                                  {w.status === "failed" && (
                                    <span className="px-2 py-0.5 rounded text-[8px] font-extrabold uppercase bg-red-100 text-red-600">
                                      Failed
                                    </span>
                                  )}
                                  {w.status === "completed" && (
                                    <span className="px-2 py-0.5 rounded text-[8px] font-extrabold uppercase bg-emerald-100 text-emerald-600">
                                      Success
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </PageCard>
              </div>

            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

export default AdminWithdrawalsPage;
