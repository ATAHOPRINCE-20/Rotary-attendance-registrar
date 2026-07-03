import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router";
import { useTenant } from "../../../context/TenantContext";
import { useSubmitDonation } from "../../../hooks/useDonations";
import { PageCard, TextInput, SelectInput } from "../shared/PageCard";
import { GoldButton, OutlineButton } from "../shared/Buttons";
import { NavBar } from "../shared/NavBar";
import { NAVY, GOLD, DONATION_CATEGORIES, formatUgandanPhone } from "../../../lib/constants";
import { Heart, CreditCard, Smartphone, CheckCircle2, ShieldCheck, Sparkles, Award } from "lucide-react";
import { toast } from "sonner";
import { LoadingScreen } from "../shared/LoadingScreen";

// @ts-ignore
import confetti from "canvas-confetti";

export function DonatePage() {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const regId = searchParams.get("reg_id");

  const { organization, loading: tenantLoading } = useTenant();

  // Form states
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState<number>(25000);
  const [customAmount, setCustomAmount] = useState("");
  const [category, setCategory] = useState("community");
  const paymentMethod = "mobile";
  const [phone, setPhone] = useState("");
  
  // Payment progress states
  const [initiating, setInitiating] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [pollingReference, setPollingReference] = useState("");
  const [donationSuccess, setDonationSuccess] = useState<any | null>(null);

  const selectedAmount = amount === 0 ? parseFloat(customAmount) || 0 : amount;

  // Presets
  const presets = [
    { value: 10000, label: "10k" },
    { value: 25000, label: "25k" },
    { value: 50000, label: "50k" },
    { value: 100000, label: "100k" },
  ];

  // 1. Check for card redirects is bypassed since card payments are disabled.

  // 2. Mobile money status polling loop
  useEffect(() => {
    let timer: any;
    if (isPolling && pollingReference && organization?.id) {
      const checkStatus = async () => {
        try {
          const res = await fetch(`/api/check-donation?reference=${pollingReference}&organizationId=${organization.id}`);
          const statusData = await res.json();
          if (statusData.success) {
            if (statusData.status === "completed") {
              setIsPolling(false);
              setDonationSuccess(statusData.donation);
              confetti({
                particleCount: 150,
                spread: 80,
                origin: { y: 0.6 }
              });
              toast.success("Thank you for your donation!");
            } else if (statusData.status === "failed") {
              setIsPolling(false);
              toast.error("Payment failed. Please verify your phone has enough funds or try again.");
            }
          }
        } catch (err) {
          console.error("Error polling donation status:", err);
        }
      };

      // Check immediately, then poll every 2.5s
      checkStatus();
      timer = setInterval(checkStatus, 2500);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPolling, pollingReference, organization]);

  // 3. Initiate payment request
  async function handleDonate(e: React.FormEvent) {
    e.preventDefault();

    if (selectedAmount <= 0) {
      toast.error("Please enter a valid donation amount.");
      return;
    }

    if (paymentMethod === "mobile" && !phone) {
      toast.error("Please enter a valid phone number for Mobile Money.");
      return;
    }

    setInitiating(true);

    try {
      const payload = {
        organizationId: organization?.id || "",
        eventId: null,
        registrationId: regId || null,
        fullName: fullName.trim() || "Anonymous",
        email: email.trim() || null,
        amount: selectedAmount,
        currency: "UGX",
        category,
        paymentMethod,
        phone: paymentMethod === "mobile" ? phone.replace("+", "") : null,
        slug: slug
      };

      const response = await fetch("/api/initiate-donation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const res = await response.json();

      if (!response.ok || !res.success) {
        throw new Error(res.error || "Failed to initiate payment");
      }

      if (paymentMethod === "card") {
        // Card redirects to Relworx session page
        if (res.payment_url) {
          window.location.href = res.payment_url;
        } else {
          throw new Error("No card checkout payment URL returned");
        }
      } else {
        // Mobile Money triggers status polling dialog
        setPollingReference(res.reference);
        setIsPolling(true);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Donation failed. Please try again.");
    } finally {
      setInitiating(false);
    }
  }

  if (tenantLoading) {
    return <LoadingScreen variant="blue" />;
  }

  // 4. Success / Thank You screen
  if (donationSuccess) {
    return (
      <div className="min-h-screen bg-background pt-24 pb-12 flex items-center justify-center">
        <NavBar organization={organization} currentPath={window.location.pathname} />
        <div className="max-w-md w-full px-4">
          <PageCard className="text-center flex flex-col items-center gap-6 bg-white/95 backdrop-blur shadow-xl border-border">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
              <Award className="w-10 h-10 text-emerald-600 animate-pulse" />
            </div>
            
            <div>
              <h1 className="text-2xl font-black tracking-tight" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
                Thank You, Donor!
              </h1>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed px-2">
                Your generous contribution of <strong className="text-foreground">UGX {donationSuccess.amount.toLocaleString()}</strong> has been verified. You help us touch lives.
              </p>
            </div>

            <div className="bg-muted/40 p-4 rounded-xl border border-border/80 w-full text-left text-xs flex flex-col gap-2.5 font-sans">
              <p className="font-bold text-center pb-2 border-b border-border/50 tracking-wider text-muted-foreground uppercase">
                Official Receipt Details
              </p>
              <div className="grid grid-cols-3 py-0.5"><span className="text-muted-foreground">Receipt No:</span><span className="col-span-2 font-mono font-bold text-foreground text-right">{donationSuccess.receipt_number}</span></div>
              <div className="grid grid-cols-3 py-0.5"><span className="text-muted-foreground">Donor Name:</span><span className="col-span-2 font-semibold text-foreground text-right">{donationSuccess.full_name || "Anonymous"}</span></div>
              <div className="grid grid-cols-3 py-0.5"><span className="text-muted-foreground">Allocation:</span><span className="col-span-2 text-foreground text-right">{DONATION_CATEGORIES.find(c => c.id === donationSuccess.category)?.label}</span></div>
              <div className="grid grid-cols-3 py-0.5"><span className="text-muted-foreground">Gateway:</span><span className="col-span-2 text-foreground text-right uppercase font-semibold text-indigo-600 flex items-center justify-end gap-1"><ShieldCheck size={12}/> Relworx Gateway</span></div>
              <div className="grid grid-cols-3 py-0.5"><span className="text-muted-foreground">Date/Time:</span><span className="col-span-2 text-muted-foreground text-right">{new Date(donationSuccess.created_at).toLocaleString()}</span></div>
            </div>

            <GoldButton onClick={() => navigate(`/org/${slug}`)} className="w-full justify-center shadow-lg shadow-orange-500/10">
              Back to Club Home
            </GoldButton>
          </PageCard>
        </div>
      </div>
    );
  }

  // 5. Checkout Form
  return (
    <div className="min-h-screen bg-background pt-24 pb-12 flex items-center justify-center">
      <NavBar organization={organization} currentPath={window.location.pathname} />
      <div className="max-w-md w-full px-4">
        <PageCard className="flex flex-col gap-6 shadow-xl border-border bg-white">
          
          {/* Header Card */}
          <div className="flex flex-col items-center text-center gap-2">
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 shadow-sm border border-amber-100">
              <Heart className="w-6 h-6 fill-amber-500" />
            </div>
            <h1 className="text-xl font-black mt-1" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
              Support Rotary Connect
            </h1>
            <p className="text-xs text-muted-foreground leading-relaxed px-4">
              Invest in service. Select a donation amount below or enter a custom sum to support our local projects.
            </p>
          </div>

          <form onSubmit={handleDonate} className="flex flex-col gap-4">
            
            {/* Amount Presets */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Select Amount (UGX)</label>
              <div className="grid grid-cols-4 gap-2">
                {presets.map((p) => {
                  const isSelected = amount === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => {
                        setAmount(p.value);
                        setCustomAmount("");
                      }}
                      className={`py-2.5 rounded-xl font-extrabold border text-xs transition-all hover:scale-[1.03] cursor-pointer ${
                        isSelected
                          ? "border-[#F7A81B] bg-[#F7A81B]/10 text-[#F7A81B] shadow-sm shadow-orange-500/5"
                          : "border-border text-muted-foreground hover:bg-slate-50"
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
              
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Or type custom amount in UGX"
                value={customAmount}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/\D/g, "");
                  setAmount(0);
                  setCustomAmount(cleaned);
                }}
                className="w-full px-4 py-3 rounded-xl border border-border bg-input-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#F7A81B] transition-all mt-1.5"
              />
            </div>

            {/* Donor Fields */}
            <div className="grid grid-cols-1 gap-3.5">
              <TextInput
                label="Full Name"
                placeholder="Enter your name (leave blank for Anonymous)"
                value={fullName}
                onChange={setFullName}
              />
              <TextInput
                label="Email Address (Optional)"
                type="email"
                placeholder="donor@example.com"
                value={email}
                onChange={setEmail}
              />
              <SelectInput
                label="Direct Donation Contribution To"
                value={category}
                onChange={setCategory}
                options={DONATION_CATEGORIES.map(c => ({ value: c.id, label: c.label }))}
              />
            </div>

            {/* Phone Number Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-foreground" style={{ fontFamily: "var(--font-sans)" }}>
                Phone Number <span style={{ color: "#F7A81B" }}>*</span>
              </label>
              <input
                type="text"
                autoComplete="off"
                placeholder="e.g. 0772 123456 or 0701 123456"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={() => {
                  const formatted = formatUgandanPhone(phone);
                  if (formatted) setPhone(formatted);
                }}
                required
                className="px-4 py-3 rounded-xl border border-border bg-input-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#F7A81B] transition-all font-mono"
              />
            </div>

            {/* Submit Button */}
            <GoldButton
              type="submit"
              disabled={initiating}
              className="w-full justify-center py-3 mt-2 text-base font-bold shadow-lg shadow-orange-500/10 cursor-pointer"
            >
              {initiating ? "Processing Request..." : `Donate UGX ${selectedAmount.toLocaleString()}`}
            </GoldButton>

            <OutlineButton
              onClick={() => navigate(`/org/${slug}`)}
              className="w-full justify-center"
            >
              Cancel
            </OutlineButton>

          </form>
        </PageCard>
      </div>

      {/* 6. Polling Progress Overlay */}
      {isPolling && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-sm overflow-hidden flex flex-col p-6 gap-6 items-center text-center animate-in zoom-in-95 duration-150">
            <div className="relative flex items-center justify-center">
              <div className="w-16 h-16 rounded-full border-4 border-t-[#F7A81B] border-border/40 animate-spin shrink-0"></div>
              <Heart size={20} className="absolute text-[#F7A81B] animate-pulse" />
            </div>
            
            <div>
              <h3 className="text-base font-black" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
                Authorizing Transaction
              </h3>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed px-2">
                We've pushed a payment request prompt to your phone: <strong>{phone}</strong>.
                <br /><br />
                Please unlock your screen, <strong>enter your Mobile Money PIN</strong> to authorize the deduction of <strong>UGX {selectedAmount.toLocaleString()}</strong>.
              </p>
            </div>

            <div className="w-full pt-4 border-t border-border/50 flex flex-col gap-2">
              <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider animate-pulse flex items-center justify-center gap-1">
                <Sparkles size={10}/> Waiting for gateway confirmation...
              </p>
              <OutlineButton
                onClick={() => setIsPolling(false)}
                className="w-full justify-center mt-2 cursor-pointer"
              >
                Cancel and Retry
              </OutlineButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
