import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../context/AuthContext";
import { supabase } from "../../../lib/supabase";
import { useOrgDonations } from "../../../hooks/useDonations";
import {
  useOrgWithdrawals,
  useRequestWithdrawal,
  useBankProducts,
  useValidateBankTransfer,
  type BankTransferValidationResult,
} from "../../../hooks/useWithdrawals";
import { AdminLayout } from "../shared/AdminLayout";
import { PageCard, TextInput } from "../shared/PageCard";
import { GoldButton, OutlineButton } from "../shared/Buttons";
import { NAVY, GOLD } from "../../../lib/constants";
import {
  Wallet,
  ArrowDownToLine,
  ArrowUpRight,
  History,
  Phone,
  User,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Building2,
  Smartphone,
  ShieldCheck,
  RefreshCw,
  CreditCard,
  Banknote,
} from "lucide-react";
import { toast } from "sonner";
import { LoadingScreen } from "../shared/LoadingScreen";

export function AdminWithdrawalsPage() {
  const { organization } = useAuth();
  const qc = useQueryClient();

  // Queries
  const { data: donations, isLoading: donLoading } = useOrgDonations(organization?.id);
  const { data: withdrawals, isLoading: withLoading } = useOrgWithdrawals(organization?.id);
  const { data: bankProducts, isLoading: banksLoading } = useBankProducts();

  const requestWithdrawalMutation = useRequestWithdrawal();
  const validateBankMutation = useValidateBankTransfer();

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

  // Active Payout Method: "mobile_money" | "bank_transfer"
  const [payoutMethod, setPayoutMethod] = useState<"mobile_money" | "bank_transfer">("mobile_money");

  // Mobile Money Form State
  const [phone, setPhone] = useState("");
  const [recipientName, setRecipientName] = useState("");

  // Bank Transfer Form State
  const [selectedBankCode, setSelectedBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  // Shared Form State
  const [amount, setAmount] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<BankTransferValidationResult | null>(null);

  // Clear validation when any bank form input changes
  function resetBankValidation() {
    if (validationResult) {
      setValidationResult(null);
    }
  }

  // Financial Calculations
  const completedDonations = donations?.filter((d) => d.status === "completed") ?? [];

  const totalDigitalRaised = completedDonations
    .filter((d) => d.payment_method !== "cash")
    .reduce((sum, d) => sum + Number(d.amount), 0);

  const totalCashCollected = completedDonations
    .filter((d) => d.payment_method === "cash")
    .reduce((sum, d) => sum + Number(d.amount), 0);

  const totalRaised = totalDigitalRaised + totalCashCollected;

  const totalWithdrawn = withdrawals
    ?.filter((w) => w.status === "completed" || w.status === "pending")
    .reduce((sum, w) => sum + Number(w.amount), 0) ?? 0;

  // Electronic withdrawable balance (digital collections minus payouts)
  const netBalance = Math.max(0, totalDigitalRaised - totalWithdrawn);

  // ── Step 1: Validate Bank Transfer ──
  async function handleValidateBankTransfer(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!selectedBankCode) {
      setFormError("Please select a target bank.");
      return;
    }
    if (!accountNumber.trim()) {
      setFormError("Beneficiary Bank Account Number is required.");
      return;
    }
    if (!accountName.trim()) {
      setFormError("Beneficiary Account Holder Name is required.");
      return;
    }
    if (!contactPhone.trim()) {
      setFormError("Contact Phone Number is required.");
      return;
    }
    const payoutAmount = Number(amount);
    if (isNaN(payoutAmount) || payoutAmount < 5000) {
      setFormError("Minimum withdrawal amount is UGX 5,000.");
      return;
    }
    if (payoutAmount > netBalance) {
      setFormError(`Insufficient electronic balance. Max withdrawable is UGX ${netBalance.toLocaleString()}.`);
      return;
    }

    setValidating(true);
    try {
      const res = await validateBankMutation.mutateAsync({
        organizationId: organization!.id,
        accountNo: accountNumber.trim(),
        amount: payoutAmount,
        productCode: selectedBankCode,
        accountName: accountName.trim(),
        contactPhone: contactPhone.trim(),
      });

      setValidationResult(res);
      toast.success("Bank transfer details verified successfully!");
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || "Failed to validate bank transfer details.");
      setValidationResult(null);
    } finally {
      setValidating(false);
    }
  }

  // ── Step 2 / Standard Submission ──
  async function handleRequestPayout(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const payoutAmount = Number(amount);
    if (isNaN(payoutAmount) || payoutAmount < 5000) {
      setFormError("Minimum withdrawal amount is UGX 5,000.");
      return;
    }

    if (payoutAmount > netBalance) {
      setFormError(`Insufficient electronic balance. You can withdraw up to UGX ${netBalance.toLocaleString()} (physical cash in hand is excluded).`);
      return;
    }

    if (payoutMethod === "mobile_money") {
      if (!phone.trim()) {
        setFormError("Recipient phone number is required.");
        return;
      }
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
          payoutMethod: "mobile_money",
        });

        toast.success("Mobile Money payout request successfully submitted!");
        setPhone("");
        setRecipientName("");
        setAmount("");
      } catch (err: any) {
        console.error(err);
        setFormError(err.message || "Failed to process mobile money payout.");
      } finally {
        setRequesting(false);
      }
    } else {
      // Bank Transfer Purchase Execution
      if (!validationResult) {
        setFormError("Please validate bank details before executing the transfer.");
        return;
      }

      const targetBankObj = bankProducts?.find((b) => b.code === selectedBankCode);
      const bankName = targetBankObj?.name || selectedBankCode;

      setRequesting(true);
      try {
        await requestWithdrawalMutation.mutateAsync({
          organizationId: organization!.id,
          amount: payoutAmount,
          phone: contactPhone.trim(),
          recipientName: validationResult.customer_name || accountName.trim(),
          payoutMethod: "bank_transfer",
          bankCode: selectedBankCode,
          bankName: bankName,
          accountNumber: accountNumber.trim(),
          validationReference: validationResult.validation_reference,
          chargeAmount: Number(validationResult.charge) || 0,
        });

        toast.success("Bank transfer request successfully submitted!");
        // Reset bank form
        setAccountNumber("");
        setAccountName("");
        setContactPhone("");
        setAmount("");
        setValidationResult(null);
      } catch (err: any) {
        console.error(err);
        setFormError(err.message || "Failed to execute bank transfer payout.");
      } finally {
        setRequesting(false);
      }
    }
  }

  // Pre-format phone numbers
  function handlePhoneChange(val: string) {
    const cleaned = val.replace(/[^\d+]/g, "");
    setPhone(cleaned);
  }

  function handleContactPhoneChange(val: string) {
    const cleaned = val.replace(/[^\d+]/g, "");
    setContactPhone(cleaned);
    resetBankValidation();
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
            Liquidate your collected donations directly to your Mobile Money wallet or directly into a Bank Account.
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
                  <span title="Total funds collected (Digital + Cash)">
                    <HelpCircle size={14} className="text-muted-foreground cursor-help" />
                  </span>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-bold tracking-wider uppercase">Total Funds Raised</p>
                  <p className="text-xl font-black mt-0.5" style={{ color: NAVY }}>UGX {totalRaised.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                    Digital: UGX {totalDigitalRaised.toLocaleString()} • Cash: UGX {totalCashCollected.toLocaleString()}
                  </p>
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
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">Mobile & Bank payouts</p>
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
                  <span title="Electronic funds available to liquidate. Physical cash collections are excluded.">
                    <HelpCircle size={14} className="text-muted-foreground cursor-help" />
                  </span>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-bold tracking-wider uppercase">Withdrawable Balance</p>
                  <p className="text-xl font-black mt-0.5" style={{ color: NAVY }}>UGX {netBalance.toLocaleString()}</p>
                  <p className="text-[10px] text-amber-600 font-semibold mt-0.5">
                    Excludes UGX {totalCashCollected.toLocaleString()} cash in hand
                  </p>
                </div>
              </div>
            </div>

            {/* ── CONTENT GRID ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Request Payout Form */}
              <div className="lg:col-span-5">
                <PageCard className="p-6 bg-white border border-border/40 shadow-sm flex flex-col gap-5">
                  
                  {/* Header & Method Selector */}
                  <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
                      <ArrowDownToLine size={16} />
                      Request Liquidation Payout
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Choose your payout channel and enter recipient details.
                    </p>

                    {/* Method Toggle Buttons */}
                    <div className="grid grid-cols-2 gap-2 mt-4 p-1 bg-slate-100 rounded-xl">
                      <button
                        type="button"
                        onClick={() => {
                          setPayoutMethod("mobile_money");
                          setFormError(null);
                        }}
                        className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                          payoutMethod === "mobile_money"
                            ? "bg-white text-[#17458F] shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        <Smartphone size={14} />
                        Mobile Money
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPayoutMethod("bank_transfer");
                          setFormError(null);
                        }}
                        className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                          payoutMethod === "bank_transfer"
                            ? "bg-white text-[#17458F] shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        <Building2 size={14} />
                        Bank Transfer
                      </button>
                    </div>
                  </div>

                  {/* ── FORM 1: MOBILE MONEY ── */}
                  {payoutMethod === "mobile_money" && (
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
                        {requesting ? "Processing..." : "Submit Mobile Money Payout"}
                      </GoldButton>
                    </form>
                  )}

                  {/* ── FORM 2: BANK TRANSFER ── */}
                  {payoutMethod === "bank_transfer" && (
                    <div className="flex flex-col gap-4">
                      
                      {/* Select Bank */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                          <Building2 size={12} />
                          Target Bank
                        </label>
                        <select
                          value={selectedBankCode}
                          onChange={(e) => {
                            setSelectedBankCode(e.target.value);
                            resetBankValidation();
                          }}
                          className="w-full px-3 py-2.5 text-xs rounded-xl border border-border bg-input-background text-foreground font-semibold focus:outline-none"
                          disabled={banksLoading || validating || requesting}
                        >
                          <option value="">-- Select Destination Bank --</option>
                          {bankProducts?.map((bank) => (
                            <option key={bank.code} value={bank.code}>
                              {bank.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Bank Account Number */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                          <CreditCard size={12} />
                          Beneficiary Bank Account Number
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 9030012345678"
                          value={accountNumber}
                          onChange={(e) => {
                            setAccountNumber(e.target.value);
                            resetBankValidation();
                          }}
                          className="w-full px-4 py-2.5 text-xs rounded-xl border border-border bg-input-background text-foreground font-semibold focus:outline-none"
                          disabled={validating || requesting}
                        />
                      </div>

                      {/* Account Holder Name */}
                      <TextInput
                        label="Beneficiary Account Name"
                        placeholder="e.g. Asimwe Edgar"
                        value={accountName}
                        onChange={(val) => {
                          setAccountName(val);
                          resetBankValidation();
                        }}
                        required
                      />

                      {/* Contact Phone */}
                      <TextInput
                        label="Recipient Contact Phone Number"
                        placeholder="e.g. 0773000000"
                        value={contactPhone}
                        onChange={handleContactPhoneChange}
                        type="tel"
                        required
                      />

                      {/* Transfer Amount */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Amount (UGX)</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-muted-foreground">UGX</span>
                          <input
                            type="number"
                            placeholder="e.g. 100000"
                            value={amount}
                            onChange={(e) => {
                              setAmount(e.target.value);
                              resetBankValidation();
                            }}
                            className="w-full pl-14 pr-4 py-2.5 text-xs rounded-xl border border-border bg-input-background text-foreground font-semibold focus:outline-none"
                            required
                            disabled={validating || requesting}
                          />
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setAmount(netBalance.toString());
                              resetBankValidation();
                            }}
                            className="text-[10px] font-bold text-[#17458F] hover:underline"
                            disabled={netBalance <= 0 || validating || requesting}
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

                      {/* ── VALIDATION RESULT BOX ── */}
                      {validationResult && (
                        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/70 flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                              <ShieldCheck size={14} className="text-emerald-600" />
                              Bank Account Verified
                            </span>
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">
                              Ref: {validationResult.validation_reference}
                            </span>
                          </div>

                          <div className="flex flex-col gap-1.5 text-xs pt-2 border-t border-amber-200/60">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] text-muted-foreground uppercase font-bold">Account Holder</span>
                              <span className="font-extrabold text-slate-900">{validationResult.customer_name}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] text-muted-foreground uppercase font-bold">Total Org Balance Withdrawal</span>
                              <span className="font-extrabold text-slate-900">UGX {Number(amount).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] text-muted-foreground uppercase font-bold">Bank Transfer Fee (Fee Deducted)</span>
                              <span className="font-extrabold text-amber-700">- UGX {Number(validationResult.charge).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center pt-1.5 border-t border-amber-200/80">
                              <span className="text-[10px] text-emerald-900 uppercase font-black">Net Credited to Recipient Bank Account</span>
                              <span className="font-black text-emerald-700 text-xs">
                                UGX {(validationResult.net_amount ?? Math.max(0, Number(amount) - Number(validationResult.charge))).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* STEP 1: VALIDATE vs STEP 2: CONFIRM */}
                      {!validationResult ? (
                        <OutlineButton
                          type="button"
                          onClick={handleValidateBankTransfer}
                          disabled={validating || netBalance <= 0}
                          className="w-full py-2.5 justify-center font-bold text-xs gap-2 border-[#17458F] text-[#17458F] hover:bg-[#17458F]/5"
                        >
                          {validating ? (
                            <>
                              <RefreshCw size={14} className="animate-spin" />
                              Verifying Account with Bank...
                            </>
                          ) : (
                            <>
                              <ShieldCheck size={14} />
                              Validate Bank Account Details
                            </>
                          )}
                        </OutlineButton>
                      ) : (
                        <form onSubmit={handleRequestPayout}>
                          <GoldButton
                            type="submit"
                            disabled={requesting || netBalance <= 0}
                            className="w-full py-2.5 justify-center font-bold text-xs gap-2"
                          >
                            {requesting ? "Processing Transfer..." : "Confirm & Execute Bank Transfer"}
                          </GoldButton>
                        </form>
                      )}

                    </div>
                  )}

                </PageCard>
              </div>

              {/* Right Column: Transactions History */}
              <div className="lg:col-span-7">
                <PageCard className="bg-white border border-border/40 shadow-sm overflow-hidden p-0">
                  <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <History size={16} style={{ color: NAVY }} />
                      <h3 className="text-sm font-bold" style={{ color: NAVY }}>Payout History</h3>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-semibold">
                      Total {withdrawals?.length || 0} records
                    </span>
                  </div>

                  {!withdrawals || withdrawals.length === 0 ? (
                    <div className="text-center py-20 px-4">
                      <History className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                      <p className="text-sm font-semibold text-foreground">No withdrawals logged yet</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Payout records will appear here as soon as you request a liquidation.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* DESKTOP TABLE VIEW */}
                      <div className="hidden sm:block w-full">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-border bg-muted/5 font-bold text-muted-foreground uppercase text-[9px] tracking-wider">
                              <th className="px-5 py-3">Channel / Reference</th>
                              <th className="px-5 py-3">Recipient Details</th>
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

                              const isBank = w.payout_method === "bank_transfer";

                              return (
                                <tr key={w.id} className="hover:bg-muted/5 transition-colors">
                                  <td className="px-5 py-3.5">
                                    <div className="flex items-center gap-1.5">
                                      {isBank ? (
                                        <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-blue-100 text-blue-700 flex items-center gap-1">
                                          <Building2 size={10} />
                                          Bank
                                        </span>
                                      ) : (
                                        <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-amber-100 text-amber-700 flex items-center gap-1">
                                          <Smartphone size={10} />
                                          MoMo
                                        </span>
                                      )}
                                      <span className="font-bold text-foreground">{w.reference}</span>
                                    </div>
                                    <p className="text-[9px] text-muted-foreground mt-1">{date}</p>
                                  </td>

                                  <td className="px-5 py-3.5">
                                    <p className="font-semibold text-foreground flex items-center gap-1">
                                      <User size={10} className="text-muted-foreground" />
                                      {w.recipient_name || "Club Wallet"}
                                    </p>

                                    {isBank ? (
                                      <div className="text-[10px] text-muted-foreground mt-0.5 flex flex-col gap-0.5">
                                        <span className="font-medium text-slate-700 flex items-center gap-1">
                                          <Building2 size={10} className="text-blue-600" />
                                          {w.bank_name || w.bank_code || "Bank Transfer"}
                                        </span>
                                        {w.account_number && (
                                          <span className="font-mono text-[9px]">Acc: {w.account_number}</span>
                                        )}
                                      </div>
                                    ) : (
                                      <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1 font-mono">
                                        <Phone size={10} />
                                        {w.recipient_phone}
                                      </p>
                                    )}
                                  </td>

                                  <td className="px-5 py-3.5 text-right font-black text-foreground">
                                    <p>UGX {Number(w.amount).toLocaleString()}</p>
                                    {w.charge_amount ? (
                                      <p className="text-[9px] text-muted-foreground font-normal">
                                        Fee: UGX {Number(w.charge_amount).toLocaleString()}
                                      </p>
                                    ) : null}
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
                      </div>

                      {/* MOBILE CARD STACK VIEW */}
                      <div className="block sm:hidden divide-y divide-border/30">
                        {withdrawals.map((w) => {
                          const date = new Date(w.created_at).toLocaleDateString("en-GB", {
                            day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
                          });

                          const isBank = w.payout_method === "bank_transfer";

                          return (
                            <div key={w.id} className="p-4 flex flex-col gap-2.5 bg-white min-w-0">
                              <div className="flex items-start justify-between gap-2 min-w-0">
                                <div className="min-w-0 flex-1 overflow-hidden">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    {isBank ? (
                                      <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-blue-100 text-blue-700">
                                        Bank Transfer
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-amber-100 text-amber-700">
                                        Mobile Money
                                      </span>
                                    )}
                                  </div>
                                  <h4 className="font-bold text-sm text-foreground truncate">{w.recipient_name || "Club Wallet"}</h4>
                                  <p className="text-[11px] font-mono text-muted-foreground mt-0.5 truncate">
                                    {isBank ? `${w.bank_name || ''} - ${w.account_number || ''}` : w.recipient_phone}
                                  </p>
                                </div>

                                {w.status === "pending" && (
                                  <span className="px-2 py-0.5 rounded text-[8px] font-extrabold uppercase bg-amber-100 text-amber-600 shrink-0">
                                    Pending
                                  </span>
                                )}
                                {w.status === "failed" && (
                                  <span className="px-2 py-0.5 rounded text-[8px] font-extrabold uppercase bg-red-100 text-red-600 shrink-0">
                                    Failed
                                  </span>
                                )}
                                {w.status === "completed" && (
                                  <span className="px-2 py-0.5 rounded text-[8px] font-extrabold uppercase bg-emerald-100 text-emerald-600 shrink-0">
                                    Success
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs min-w-0 gap-2">
                                <span className="text-[10px] text-muted-foreground font-mono truncate min-w-0">Ref: {w.reference} • {date}</span>
                                <span className="font-black text-rose-600 shrink-0">UGX {Number(w.amount).toLocaleString()}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
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
