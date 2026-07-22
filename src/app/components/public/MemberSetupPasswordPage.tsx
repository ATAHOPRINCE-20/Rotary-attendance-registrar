import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Loader2, AlertCircle, ShieldAlert, KeyRound, CheckCircle, Eye, EyeOff } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { RotaryLogo } from "../shared/RotaryLogo";
import { GoldButton } from "../shared/Buttons";
import { PageCard } from "../shared/PageCard";
import { LoadingScreen } from "../shared/LoadingScreen";
import { NAVY, GOLD } from "../../../lib/constants";

export function MemberSetupPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    async function checkAndVerify() {
      // 1. Check if there are query parameters first (bypasses Supabase dashboard site URL redirect issues)
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      const email = params.get("email");

      if (token && email) {
        setCheckingSession(true);
        try {
          const { data, error: verifyErr } = await supabase.auth.verifyOtp({
            email,
            token,
            type: "recovery"
          });
          
          if (verifyErr) {
            setError(verifyErr.message || "Failed to verify invitation token.");
            setHasSession(false);
          } else if (data?.session) {
            setHasSession(true);
            setError(null);
          }
        } catch (e: any) {
          setError(e.message || "Failed to verify invitation token.");
          setHasSession(false);
        }
        setCheckingSession(false);
        return;
      }

      // 2. Regular session fallback
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setHasSession(true);
      } else {
        const hash = window.location.hash;
        if (hash && (hash.includes("access_token") || hash.includes("error"))) {
          setHasSession(true);
        } else {
          setHasSession(false);
        }
      }
      setCheckingSession(false);
    }

    checkAndVerify();
  }, []);

  if (checkingSession) {
    return <LoadingScreen variant="dark" />;
  }

  async function handleSetupPassword() {
    if (!password || !confirmPassword) {
      setError("Please fill in both password fields.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const { data, error: updateError } = await supabase.auth.updateUser({
        password: password.trim()
      });

      if (updateError) {
        setError(updateError.message || "Failed to update password. Link may have expired.");
        setLoading(false);
        return;
      }

      if (data.user) {
        const userId = data.user.id;
        const userEmail = data.user.email;

        // Auto-link user_id in members table if matching by email
        if (userEmail) {
          await supabase
            .from("members")
            .update({ user_id: userId })
            .ilike("email", userEmail);
        }

        // Ensure a profile row exists with role 'member' if no profile
        const { data: existingProf } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", userId)
          .maybeSingle();

        if (!existingProf && userEmail) {
          const { data: memberRec } = await supabase
            .from("members")
            .select("organization_id, full_name")
            .ilike("email", userEmail)
            .maybeSingle();

          if (memberRec) {
            await supabase.from("profiles").insert({
              id: userId,
              organization_id: memberRec.organization_id,
              full_name: memberRec.full_name,
              role: "member"
            });
          }
        }
      }

      setSuccess(true);
      
      // Auto redirect after 2.5 seconds
      setTimeout(() => {
        navigate("/member/dashboard");
      }, 2500);

    } catch (e: any) {
      setError(e.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4"
      style={{ background: `linear-gradient(135deg, #f0f4fa 0%, #e8edf5 100%)` }}>
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <RotaryLogo size={64} />
          <h1 className="text-2xl font-black mt-4 mb-1" style={{ color: NAVY }}>
            Account Setup
          </h1>
          <p className="text-sm text-muted-foreground text-center">
            Configure a password to activate your member portal
          </p>
        </div>

        <PageCard className="p-6">
          {success ? (
            <div className="flex flex-col items-center text-center py-6 gap-4">
              <CheckCircle size={56} className="text-emerald-500 animate-bounce" />
              <h2 className="text-xl font-bold" style={{ color: NAVY }}>Password Set Successfully!</h2>
              <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                Your account is active. We are redirecting you to your Member Dashboard now...
              </p>
              <Loader2 size={24} className="animate-spin text-yellow-500 mt-2" />
            </div>
          ) : !hasSession ? (
            <div className="flex flex-col items-center text-center py-6 gap-4">
              <ShieldAlert size={56} className="text-rose-500" />
              <h2 className="text-lg font-bold" style={{ color: NAVY }}>Invalid or Expired Link</h2>
              <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                This invitation link appears to be invalid or has expired. Please contact your club administrator to request a new invite, or try logging in with WhatsApp.
              </p>
              <button
                onClick={() => navigate("/member/login")}
                className="mt-4 px-5 py-2.5 bg-[#F4F6FB] border border-border hover:bg-muted transition-all text-xs font-semibold rounded-xl text-foreground"
              >
                Go to Member Login
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-3 bg-[#17458F]/5 border border-[#17458F]/10 p-4 rounded-xl">
                <KeyRound size={24} className="text-yellow-500 shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Please set a secure password. You will use this password alongside your email address to log in to the portal in the future.
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm bg-rose-50 border border-rose-200 text-rose-700">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-foreground">New Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSetupPassword()}
                    className="w-full px-4 py-3 pr-11 rounded-xl border border-border bg-input-background text-foreground placeholder-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#17458F]/20 transition-all"
                  />
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
                <label className="text-sm font-semibold text-foreground">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Repeat your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSetupPassword()}
                    className="w-full px-4 py-3 pr-11 rounded-xl border border-border bg-input-background text-foreground placeholder-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#17458F]/20 transition-all"
                  />
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

              <GoldButton onClick={handleSetupPassword} className="w-full justify-center py-3 text-slate-900 mt-2 hover:brightness-110" disabled={loading}>
                {loading ? <Loader2 size={18} className="animate-spin" /> : <>Activate Account</>}
              </GoldButton>
            </div>
          )}
        </PageCard>
      </div>
    </div>
  );
}
