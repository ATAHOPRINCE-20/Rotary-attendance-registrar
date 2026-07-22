import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Loader2, AlertCircle, LogIn, KeyRound, MessageSquareCode, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../context/AuthContext";
import { RotaryLogo } from "../shared/RotaryLogo";
import { GoldButton } from "../shared/Buttons";
import { PageCard } from "../shared/PageCard";
import { NAVY, GOLD } from "../../../lib/constants";
import { getFriendlyErrorMessage } from "../../../lib/errors";
import { LoadingScreen } from "../shared/LoadingScreen";

export function MemberLoginPage() {
  const navigate = useNavigate();
  const { user: adminUser, loading: adminLoading } = useAuth();
  
  // Login states
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [identifier, setIdentifier] = useState(""); // Email or Phone for OTP
  const [otpCode, setOtpCode]       = useState("");
  
  // UI Flow states
  const [method, setMethod]         = useState<"password" | "otp">("password");
  const [otpStep, setOtpStep]       = useState<"request" | "verify">("request");
  const [error, setError]           = useState<string | null>(null);
  const [infoMessage, setInfo]      = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);
  const [initialLoading, setInitLoading] = useState(true);

  // Check if member already logged in
  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Double check if they are mapped to a member profile
        const { data: member } = await supabase
          .from("members")
          .select("id")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (member) {
          navigate("/member/dashboard", { replace: true });
        }
      }
      setInitLoading(false);
    }
    checkSession();
  }, [navigate]);

  if (initialLoading) {
    return <LoadingScreen variant="light" />;
  }

  // Email/Password login handler
  async function handlePasswordLogin() {
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (err) {
        setError(getFriendlyErrorMessage(err.message));
        setLoading(false);
        return;
      }

      if (data?.user) {
        // Verify they are a member
        const { data: member } = await supabase
          .from("members")
          .select("id")
          .eq("user_id", data.user.id)
          .maybeSingle();

        if (!member) {
          // Signed in user is not a member (might be admin)
          // We let them through if they are admin, but direct them to the appropriate portal
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", data.user.id)
            .maybeSingle();

          if (profile) {
            navigate("/admin/dashboard");
            return;
          }

          // Logout since they don't belong here
          await supabase.auth.signOut();
          setError("Your account is not registered as a club member. Please check with your administrator.");
          setLoading(false);
          return;
        }

        navigate("/member/dashboard");
      }
    } catch (e: any) {
      setError(e.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  async function handleMemberForgotPassword() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError("Please enter your email address above to reset your password.");
      return;
    }
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetErr) throw resetErr;
      setInfo(`Password reset instructions sent to ${cleanEmail}. Please check your email inbox.`);
    } catch (err: any) {
      console.error(err);
      setError(getFriendlyErrorMessage(err.message || err));
    } finally {
      setLoading(false);
    }
  }

  // Request OTP login code (WhatsApp/Email)
  async function handleRequestOtp() {
    if (!identifier) {
      setError("Please enter your registered phone or email address.");
      return;
    }
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      const response = await fetch("/api/member/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", identifier: identifier.trim() })
      });

      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "Failed to send verification code.");
        return;
      }

      setInfo(`Verification code sent via ${result.maskedDestination}. Please check your phone.`);
      setOtpStep("verify");
    } catch (e: any) {
      setError("Network error. Unable to contact authentication server.");
    } finally {
      setLoading(false);
    }
  }

  // Verify OTP login code
  async function handleVerifyOtp() {
    if (!otpCode || otpCode.length < 6) {
      setError("Please enter the 6-digit code.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/member/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          identifier: identifier.trim(),
          otpCode: otpCode.trim()
        })
      });

      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "Verification failed. Please double-check your code.");
        setLoading(false);
        return;
      }

      // Login by navigating to action link
      if (result.actionLink) {
        window.location.href = result.actionLink;
      } else {
        setError("Login session could not be established.");
        setLoading(false);
      }
    } catch (e: any) {
      setError("Verification failed due to a network error.");
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
            Rotary Member Portal
          </h1>
          <p className="text-sm text-muted-foreground text-center">
            Access and clear your club dues
          </p>
        </div>

        <PageCard className="p-6">
          {/* Method Tab Selection */}
          <div className="flex bg-[#F4F6FB] border border-border p-1 rounded-xl mb-6">
            <button
              onClick={() => { setMethod("password"); setError(null); setInfo(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${
                method === "password" ? "bg-white text-[#17458F] shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <KeyRound size={15} /> Password
            </button>
            <button
              onClick={() => { setMethod("otp"); setError(null); setInfo(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${
                method === "otp" ? "bg-white text-[#17458F] shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MessageSquareCode size={15} /> WhatsApp / OTP
            </button>
          </div>

          <div className="flex flex-col gap-5">
            {/* Info Message Box */}
            {infoMessage && (
              <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm bg-emerald-50 border border-emerald-200 text-emerald-700">
                <ShieldCheck size={18} className="shrink-0 mt-0.5" />
                <span>{infoMessage}</span>
              </div>
            )}

            {/* Error Message Box */}
            {error && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm bg-rose-50 border border-rose-200 text-rose-700">
                <AlertCircle size={15} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Method 1: Email and Password Login */}
            {method === "password" && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-foreground">Email Address</label>
                  <input
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handlePasswordLogin()}
                    className="px-4 py-3 rounded-xl border border-border bg-input-background text-foreground placeholder-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#17458F]/20 transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-foreground">Password</label>
                    <button
                      type="button"
                      onClick={() => handleMemberForgotPassword()}
                      className="text-xs font-semibold text-[#17458F] hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handlePasswordLogin()}
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

                <GoldButton onClick={handlePasswordLogin} className="w-full justify-center py-3 text-slate-900 mt-2 hover:brightness-110" disabled={loading}>
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <><LogIn size={16} /> Sign In</>}
                </GoldButton>
              </>
            )}

            {/* Method 2: OTP Verification Login */}
            {method === "otp" && (
              <>
                {otpStep === "request" ? (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-semibold text-foreground">Phone or Email Address</label>
                      <input
                        type="text"
                        placeholder="e.g. +256771000000 or email"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleRequestOtp()}
                        className="px-4 py-3 rounded-xl border border-border bg-input-background text-foreground placeholder-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#17458F]/20 transition-all"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Enter the phone or email registered with your club. We'll send a 6-digit verification code.
                      </p>
                    </div>

                    <GoldButton onClick={handleRequestOtp} className="w-full justify-center py-3 text-slate-900 mt-2 hover:brightness-110" disabled={loading}>
                      {loading ? <Loader2 size={18} className="animate-spin" /> : <>Request Login Code</>}
                    </GoldButton>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-semibold text-foreground text-center">Enter Verification Code</label>
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="123456"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                        onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                        className="px-4 py-3 rounded-xl border border-border bg-input-background text-foreground placeholder-muted-foreground text-center tracking-widest text-lg font-black focus:outline-none focus:ring-2 focus:ring-[#17458F]/20 transition-all font-mono"
                      />
                    </div>

                    <div className="flex flex-col gap-2 mt-2">
                      <GoldButton onClick={handleVerifyOtp} className="w-full justify-center py-3 text-slate-900 hover:brightness-110" disabled={loading}>
                        {loading ? <Loader2 size={18} className="animate-spin" /> : <>Verify & Sign In</>}
                      </GoldButton>

                      <button
                        onClick={() => { setOtpStep("request"); setError(null); setInfo(null); setOtpCode(""); }}
                        className="text-xs text-muted-foreground hover:text-foreground transition-all text-center py-2 underline"
                      >
                        Change phone/email or request new code
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            <div className="border-t border-border pt-4 flex justify-between items-center text-xs text-muted-foreground">
              <span>Rotary District 9213 / 9214</span>
              <button
                onClick={() => navigate("/admin/login")}
                className="text-[#17458F] hover:underline font-bold"
              >
                Access Admin Portal
              </button>
            </div>
          </div>
        </PageCard>
      </div>
    </div>
  );
}
