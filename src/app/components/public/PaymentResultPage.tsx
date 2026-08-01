import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { CheckCircle2, AlertCircle, Mail, ArrowRight, ShieldCheck, Download, Home, Loader2 } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { PageCard } from "../shared/PageCard";
import { GoldButton, OutlineButton } from "../shared/Buttons";
import { NAVY, GOLD } from "../../../lib/constants";
import type { Donation } from "../../../types/database";

// @ts-ignore
import confetti from "canvas-confetti";

export function PaymentResultPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const reference = searchParams.get("reference") || searchParams.get("customer_reference") || "";
  const initialStatus = searchParams.get("status") || "success";

  const [loading, setLoading] = useState(true);
  const [donation, setDonation] = useState<Donation | null>(null);
  const [status, setStatus] = useState<"success" | "failed" | "pending">(
    initialStatus.toLowerCase() === "success" || initialStatus.toLowerCase() === "completed" ? "success" : "failed"
  );

  useEffect(() => {
    async function fetchTransaction() {
      if (!reference) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("donations")
          .select("*")
          .eq("receipt_number", reference)
          .maybeSingle();

        if (data) {
          setDonation(data);
          if (data.status === "completed") {
            setStatus("success");
            confetti({
              particleCount: 150,
              spread: 80,
              origin: { y: 0.6 }
            });
          } else if (data.status === "failed") {
            setStatus("failed");
          }
        }
      } catch (err) {
        console.error("Failed to load payment transaction details:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchTransaction();
  }, [reference]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Loader2 size={36} className="animate-spin text-amber-500 mb-4" />
        <p className="text-sm font-semibold text-muted-foreground">Verifying your payment transaction...</p>
      </div>
    );
  }

  const isSuccess = status === "success";

  return (
    <div 
      className="min-h-screen bg-background flex items-center justify-center px-4 py-12"
      style={{ background: `linear-gradient(135deg, #f0f4fa 0%, #e8edf5 100%)` }}
    >
      <div className="w-full max-w-lg">
        <PageCard className="p-6 md:p-8 flex flex-col items-center text-center gap-6 shadow-2xl border-border/80">
          
          {/* Status Header Badge */}
          {isSuccess ? (
            <div className="w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center text-emerald-600 shadow-lg animate-bounce">
              <CheckCircle2 size={48} />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-full bg-rose-50 border-2 border-rose-200 flex items-center justify-center text-rose-600 shadow-lg">
              <AlertCircle size={48} />
            </div>
          )}

          {/* Heading */}
          <div>
            <span className="text-[10px] uppercase tracking-widest font-extrabold text-[#F7A81B]">
              {isSuccess ? "Payment Verified" : "Transaction Status"}
            </span>
            <h1 className="text-2xl font-black mt-1" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
              {isSuccess ? "Payment Completed Successfully!" : "Payment Unsuccessful"}
            </h1>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed max-w-sm mx-auto">
              {isSuccess
                ? "Your Visa/Mastercard card payment has been processed and confirmed. Thank you for your contribution!"
                : "Your card transaction could not be completed. Please verify your card details or try again."}
            </p>
          </div>

          {/* Mandatory Email Receipt Notification Banner */}
          {isSuccess && (
            <div className="w-full p-4 rounded-xl bg-blue-50/80 border border-blue-200 text-left flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-700 shrink-0 mt-0.5">
                <Mail size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-blue-950">Email Confirmation Sent</h4>
                <p className="text-[11px] text-blue-800 leading-relaxed mt-0.5">
                  An official email containing your complete payment transaction details and receipt has been sent to your email address.
                </p>
              </div>
            </div>
          )}

          {/* Transaction Receipt Breakout */}
          {donation && (
            <div className="w-full rounded-2xl bg-muted/30 border border-border/60 p-4 text-left flex flex-col gap-2.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-border/40">
                <span className="font-extrabold uppercase text-[10px] tracking-wider text-muted-foreground">Receipt Number</span>
                <span className="font-mono font-bold text-foreground text-xs">{donation.receipt_number}</span>
              </div>

              <div className="grid grid-cols-2 gap-1 py-0.5">
                <span className="text-muted-foreground">Payer Name:</span>
                <span className="font-semibold text-right text-foreground">{donation.full_name || "Valued Member"}</span>
              </div>

              <div className="grid grid-cols-2 gap-1 py-0.5">
                <span className="text-muted-foreground">Amount Paid:</span>
                <span className="font-extrabold text-right text-emerald-700 text-sm">
                  UGX {Number(donation.amount).toLocaleString()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1 py-0.5">
                <span className="text-muted-foreground">Allocation / Category:</span>
                <span className="font-medium text-right text-foreground">{donation.category}</span>
              </div>

              <div className="grid grid-cols-2 gap-1 py-0.5">
                <span className="text-muted-foreground">Payment Channel:</span>
                <span className="font-semibold text-right text-indigo-700 flex items-center justify-end gap-1">
                  <ShieldCheck size={13} /> Visa / Mastercard (Relworx)
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1 py-0.5">
                <span className="text-muted-foreground">Date / Time:</span>
                <span className="text-muted-foreground text-right">{new Date(donation.created_at).toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="w-full flex flex-col sm:flex-row gap-3 pt-2">
            <OutlineButton 
              onClick={() => navigate("/")}
              className="flex-1 justify-center py-2.5 text-xs font-bold"
            >
              <Home size={14} /> Back to Home
            </OutlineButton>

            <GoldButton
              onClick={() => navigate("/member/dashboard")}
              className="flex-1 justify-center py-2.5 text-xs font-extrabold text-slate-900 shadow-md"
            >
              Go to Member Portal <ArrowRight size={14} />
            </GoldButton>
          </div>

        </PageCard>
      </div>
    </div>
  );
}
