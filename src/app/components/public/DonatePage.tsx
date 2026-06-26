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
import { LoadingScreen } from "../shared/LoadingScreen";

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
  const [amount, setAmount] = useState<number>(25000);
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
        currency: "UGX",
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
    return <LoadingScreen variant="blue" />;
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
              Your contribution of <strong className="text-foreground">UGX {donationSuccess.amount.toLocaleString()}</strong> helps us make a difference in communities worldwide.
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
    <div className="min-h-screen bg-background pt-24 pb-12 flex items-center justify-center">
      <NavBar organization={organization} currentPath={window.location.pathname} />
      <div className="max-w-md w-full px-4">
        <PageCard className="text-center flex flex-col items-center gap-6">
          <ShieldAlert className="w-16 h-16 text-amber-500 animate-pulse" />
          <h1 className="text-2xl font-black" style={{ color: NAVY, fontFamily: "Montserrat, sans-serif" }}>
            Donations Offline
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Online donations are temporarily offline at this time. Thank you for your support and willingness to contribute!
          </p>
          <GoldButton onClick={() => navigate(`/org/${slug}`)} className="w-full justify-center">
            Back to Home
          </GoldButton>
        </PageCard>
      </div>
    </div>
  );
}
