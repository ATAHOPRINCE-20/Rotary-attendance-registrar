import { useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router";
import { useTenant } from "../../../context/TenantContext";
import { useSubmitDonation } from "../../../hooks/useDonations";
import { PageCard, TextInput, SelectInput } from "../shared/PageCard";
import { GoldButton, OutlineButton } from "../shared/Buttons";
import { NavBar } from "../shared/NavBar";
import { NAVY, GOLD, DONATION_CATEGORIES, PAYMENT_METHODS } from "../../../lib/constants";
import { Heart, CheckCircle2, ShieldAlert, Award } from "lucide-react";
import { toast } from "sonner";

export function DonatePage() {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const regId = searchParams.get("reg_id");

  const { organization, loading: tenantLoading } = useTenant();
  const mutation = useSubmitDonation();

  // Form states
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState<number>(25);
  const [customAmount, setCustomAmount] = useState("");
  const [category, setCategory] = useState("community");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [donationSuccess, setDonationSuccess] = useState<any | null>(null);

  const selectedAmount = amount === 0 ? parseFloat(customAmount) || 0 : amount;

  async function handleDonate(e: React.FormEvent) {
    e.preventDefault();

    if (selectedAmount <= 0) {
      toast.error("Please enter a valid donation amount.");
      return;
    }

    try {
      const res = await mutation.mutateAsync({
        event_id: null,
        organization_id: organization?.id || "",
        registration_id: regId || null,
        full_name: fullName.trim() || "Anonymous",
        email: email.trim() || null,
        amount: selectedAmount,
        currency: "USD",
        category,
        payment_method: paymentMethod,
        status: "completed", // Simulation sets it directly to completed for now
      });

      setDonationSuccess(res);
      toast.success("Thank you for your donation!");
    } catch (err: any) {
      console.error(err);
      toast.error("Donation failed. Please try again.");
    }
  }

  if (tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-4 border-[#17458F] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (donationSuccess) {
    return (
      <div className="min-h-screen bg-background pt-24 pb-12 flex items-center justify-center">
        <NavBar organization={organization} currentPath={window.location.pathname} />
        <div className="max-w-md w-full px-4">
          <PageCard className="text-center flex flex-col items-center gap-6">
            <Award className="w-16 h-16 text-[#F7A81B] animate-pulse" />
            <h1 className="text-2xl font-black" style={{ color: NAVY, fontFamily: "Montserrat, sans-serif" }}>
              Thank You!
            </h1>
            <p className="text-sm text-muted-foreground">
              Your contribution of <strong className="text-foreground">${donationSuccess.amount.toFixed(2)}</strong> helps us make a difference in communities worldwide.
            </p>

            <div className="bg-muted/30 p-4 rounded-xl border border-border w-full text-left text-sm flex flex-col gap-2">
              <p className="font-semibold text-center pb-2 border-b border-border/50" style={{ color: NAVY }}>
                OFFICIAL DONATION RECEIPT
              </p>
              <p className="text-xs"><strong>Receipt ID:</strong> {donationSuccess.receipt_number}</p>
              <p className="text-xs"><strong>Donor:</strong> {donationSuccess.full_name}</p>
              <p className="text-xs"><strong>Category:</strong> {DONATION_CATEGORIES.find(c => c.id === donationSuccess.category)?.label}</p>
              <p className="text-xs"><strong>Payment Method:</strong> {PAYMENT_METHODS.find(p => p.id === donationSuccess.payment_method)?.label}</p>
              <p className="text-xs"><strong>Date:</strong> {new Date(donationSuccess.created_at).toLocaleString()}</p>
            </div>

            <GoldButton onClick={() => navigate(`/org/${slug}`)} className="w-full justify-center">
              Back to Home
            </GoldButton>
          </PageCard>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-12">
      <NavBar organization={organization} currentPath={window.location.pathname} />

      <div className="max-w-xl mx-auto px-4">
        <PageCard>
          <div className="flex flex-col items-center gap-2 mb-6 text-center">
            <Heart className="w-12 h-12" style={{ color: GOLD }} />
            <h1 className="text-2xl font-black" style={{ color: NAVY, fontFamily: "Montserrat, sans-serif" }}>
              Support Our Cause
            </h1>
            <p className="text-sm text-muted-foreground">
              Your donations go directly toward local and international community service.
            </p>
          </div>

          <form onSubmit={handleDonate} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold" style={{ fontFamily: "Montserrat, sans-serif" }}>
                Select Amount (USD)
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[10, 25, 50, 100].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => { setAmount(val); setCustomAmount(""); }}
                    className={`py-3 rounded-xl border text-sm font-bold transition-all ${
                      amount === val
                        ? "border-[#17458F] bg-[#17458F] text-white"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    ${val}
                  </button>
                ))}
              </div>

              <div className="mt-2">
                <TextInput
                  label="Custom Amount ($)"
                  type="number"
                  placeholder="Enter custom amount"
                  value={customAmount}
                  onChange={(val) => {
                    setAmount(0);
                    setCustomAmount(val);
                  }}
                />
              </div>
            </div>

            <SelectInput
              label="Fund Allocation / Category"
              options={DONATION_CATEGORIES.map(c => ({ value: c.id, label: c.label }))}
              value={category}
              onChange={setCategory}
            />

            <SelectInput
              label="Payment Method"
              options={PAYMENT_METHODS.map(p => ({ value: p.id, label: p.label }))}
              value={paymentMethod}
              onChange={setPaymentMethod}
            />

            <div className="border-t border-border pt-4 mt-2 flex flex-col gap-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Donor Details (Optional)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <TextInput
                  label="Full Name"
                  placeholder="Anonymous"
                  value={fullName}
                  onChange={setFullName}
                />
                <TextInput
                  label="Email Address"
                  type="email"
                  placeholder="For receipt delivery"
                  value={email}
                  onChange={setEmail}
                />
              </div>
            </div>

            <GoldButton type="submit" disabled={mutation.isPending} className="w-full justify-center py-4 mt-2">
              {mutation.isPending ? "Processing..." : `Donate $${selectedAmount.toFixed(2)}`}
            </GoldButton>
          </form>
        </PageCard>
      </div>
    </div>
  );
}
