import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { supabase } from "../../../lib/supabase";
import { RotaryLogo } from "../shared/RotaryLogo";
import { PageCard } from "../shared/PageCard";
import { GoldButton } from "../shared/Buttons";
import { NAVY, GOLD } from "../../../lib/constants";
import { Loader2, AlertCircle, CheckCircle2, Lock, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { getFriendlyErrorMessage } from "../../../lib/errors";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isRecoverySession, setIsRecoverySession] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if we have an active session from the recovery link
    async function checkRecoverySession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsRecoverySession(true);
      } else {
        // Listen for auth state change in case hash is processed asynchronously
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
          if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
            setIsRecoverySession(true);
          }
        });
        
        // Timeout check if no recovery session detected after 2 seconds
        setTimeout(() => {
          setIsRecoverySession((prev) => (prev === null ? false : prev));
        }, 2000);

        return () => subscription.unsubscribe();
      }
    }
    checkRecoverySession();
  }, []);

  async function handleResetPassword(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setError(null);

    if (!newPassword || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match. Please verify and try again.");
      return;
    }

    setLoading(true);

    try {
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateErr) {
        throw new Error(updateErr.message);
      }

      setSuccess(true);
      setTimeout(() => {
        navigate("/admin", { replace: true });
      }, 3000);
    } catch (err: any) {
      console.error(err);
      setError(getFriendlyErrorMessage(err.message || err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: "linear-gradient(135deg, #f0f4fa 0%, #e8edf5 100%)" }}
    >
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <RotaryLogo size={56} />
          <h1
            className="text-2xl font-black mt-4 mb-1"
            style={{ color: NAVY, fontFamily: "var(--font-sans)" }}
          >
            Reset Your Password
          </h1>
          <p className="text-sm text-slate-500">
            Enter your new secure password below
          </p>
        </div>

        <PageCard>
          {success ? (
            <div className="flex flex-col items-center text-center p-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: "#DEF7EC", color: "#03543F" }}
              >
                <CheckCircle2 size={32} />
              </div>
              <h3
                className="text-lg font-bold mb-2"
                style={{ color: NAVY, fontFamily: "var(--font-sans)" }}
              >
                Password Updated!
              </h3>
              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                Your password has been successfully updated. Redirecting you to the login page...
              </p>
              <GoldButton
                onClick={() => navigate("/admin")}
                className="w-full justify-center"
              >
                Go to Login Now
              </GoldButton>
            </div>
          ) : isRecoverySession === false ? (
            <div className="flex flex-col items-center text-center p-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: "#FEE2E2", color: "#991B1B" }}
              >
                <AlertCircle size={32} />
              </div>
              <h3
                className="text-lg font-bold mb-2"
                style={{ color: NAVY, fontFamily: "var(--font-sans)" }}
              >
                Invalid or Expired Link
              </h3>
              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                The password reset link you followed is invalid or has expired. Please request a new password reset link.
              </p>
              <GoldButton
                onClick={() => navigate("/admin")}
                className="w-full justify-center"
              >
                <ArrowLeft size={16} /> Back to Login
              </GoldButton>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold" style={{ fontFamily: "var(--font-sans)" }}>
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-11 pl-10 rounded-xl border border-border bg-input-background text-sm focus:outline-none focus:ring-2 transition-all"
                  />
                  <Lock size={18} className="absolute left-3 top-3.5 text-slate-400" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold" style={{ fontFamily: "var(--font-sans)" }}>
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-11 pl-10 rounded-xl border border-border bg-input-background text-sm focus:outline-none focus:ring-2 transition-all"
                  />
                  <Lock size={18} className="absolute left-3 top-3.5 text-slate-400" />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    title={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
                  style={{ backgroundColor: "#FED7D7", color: "#C53030" }}
                >
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <GoldButton
                type="submit"
                className="w-full justify-center py-2.5 mt-2"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  "Update Password"
                )}
              </GoldButton>

              <button
                type="button"
                onClick={() => navigate("/admin")}
                className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors mt-2"
              >
                <ArrowLeft size={14} /> Back to Login
              </button>
            </form>
          )}
        </PageCard>
      </div>
    </div>
  );
}
