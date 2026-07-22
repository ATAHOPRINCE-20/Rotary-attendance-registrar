import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Loader2, AlertCircle, LogIn, CheckCircle2, X, Eye, EyeOff } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../context/AuthContext";
import { RotaryLogo } from "../shared/RotaryLogo";
import { GoldButton } from "../shared/Buttons";
import { PageCard } from "../shared/PageCard";
import { NAVY, GOLD } from "../../../lib/constants";
import { getFriendlyErrorMessage } from "../../../lib/errors";
import { toast } from "sonner";
import { LoadingScreen } from "../shared/LoadingScreen";

export function AdminLoginPage() {
  const { signIn, signInWithGoogle, user, profile, loading: authLoading, profileLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  // Forgot password modal state
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // Already logged in → redirect safely using useEffect
  useEffect(() => {
    if (!authLoading && !profileLoading && user) {
      if (profile) {
        const dest = profile.role === "member"
          ? "/member/dashboard"
          : profile.role === "treasurer"
          ? "/treasurer/dashboard"
          : "/admin/dashboard";
        navigate(dest, { replace: true });
      } else {
        navigate("/org-setup", { replace: true });
      }
    }
  }, [authLoading, profileLoading, user, profile, navigate]);

  // Wait until loading finishes or redirect is in progress
  if (authLoading || (user && profileLoading)) {
    return <LoadingScreen variant="light" />;
  }

  async function handleLogin() {
    if (!email || !password) { setError("Please enter your email and password."); return; }
    setError(null);
    setLoading(true);
    const { error: err } = await signIn(email, password);
    setLoading(false);
    if (err) { setError(getFriendlyErrorMessage(err)); return; }
    if (profile?.role === "member") {
      navigate("/member/dashboard");
    } else if (profile?.role === "treasurer") {
      navigate("/treasurer/dashboard");
    } else {
      navigate("/admin/dashboard");
    }
  }

  async function handleSendResetEmail(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const cleanEmail = resetEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setResetError("Please enter your email address.");
      return;
    }
    setResetError(null);
    setResetLoading(true);

    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetErr) {
        throw new Error(resetErr.message);
      }

      setResetSuccess(true);
      toast.success("Password reset instructions sent!");
    } catch (err: any) {
      console.error(err);
      setResetError(getFriendlyErrorMessage(err.message || err));
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4"
      style={{ background: `linear-gradient(135deg, #f0f4fa 0%, #e8edf5 100%)` }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <RotaryLogo size={56} />
          <h1 className="text-2xl font-black mt-4 mb-1" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
            Agoroll Portal
          </h1>
          <p className="text-sm text-muted-foreground text-center" style={{ fontFamily: "Inter, sans-serif" }}>
            Sign in to access your Agoroll account
          </p>
        </div>

        <PageCard>
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold" style={{ fontFamily: "var(--font-sans)" }}>Email Address</label>
              <input
                type="email"
                placeholder="you@rotaryclub.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                className="px-4 py-3 rounded-xl border border-border bg-input-background text-sm focus:outline-none focus:ring-2 transition-all"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold" style={{ fontFamily: "var(--font-sans)" }}>Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email);
                    setResetSuccess(false);
                    setResetError(null);
                    setResetModalOpen(true);
                  }}
                  className="text-xs font-semibold hover:underline cursor-pointer"
                  style={{ color: NAVY }}
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
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  className="w-full px-4 py-3 pr-11 rounded-xl border border-border bg-input-background text-sm focus:outline-none focus:ring-2 transition-all"
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

            {error && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
                style={{ backgroundColor: "#FED7D7", color: "#C53030" }}>
                <AlertCircle size={15} />
                <span style={{ fontFamily: "Inter, sans-serif" }}>{error}</span>
              </div>
            )}

            <GoldButton onClick={handleLogin} className="w-full justify-center py-2.5" disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <><LogIn size={15} /> Sign In</>}
            </GoldButton>

            <div className="relative flex items-center justify-center w-full my-1">
              <div className="absolute border-t border-border w-full"></div>
              <span className="relative bg-background px-3 text-xs text-muted-foreground uppercase tracking-widest font-semibold" style={{ fontFamily: "Inter, sans-serif" }}>OR</span>
            </div>

            <button
              onClick={() => signInWithGoogle()}
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-border bg-input-background hover:bg-muted transition-all text-sm font-semibold cursor-pointer"
              style={{ color: NAVY, fontFamily: "var(--font-sans)" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25C22.56 11.47 22.49 10.72 22.36 10H12V14.26H17.92C17.67 15.63 16.89 16.79 15.73 17.57V20.34H19.3C21.39 18.42 22.56 15.6 22.56 12.25Z" fill="#4285F4"/>
                <path d="M12 23C14.97 23 17.46 22.02 19.3 20.34L15.73 17.57C14.73 18.24 13.48 18.66 12 18.66C9.13 18.66 6.7 16.72 5.82 14.13H2.15V16.98C3.96 20.58 7.68 23 12 23Z" fill="#34A853"/>
                <path d="M5.82 14.13C5.59 13.46 5.46 12.74 5.46 12C5.46 11.26 5.59 10.54 5.82 9.87V7.02H2.15C1.41 8.5 1 10.2 1 12C1 13.8 1.41 15.5 2.15 16.98L5.82 14.13Z" fill="#FBBC05"/>
                <path d="M12 5.34C13.62 5.34 15.06 5.9 16.2 6.99L19.38 3.8C17.45 2 14.97 1 12 1C7.68 1 3.96 3.42 2.15 7.02L5.82 9.87C6.7 7.28 9.13 5.34 12 5.34Z" fill="#EA4335"/>
              </svg>
              Sign In with Google
            </button>

            <p className="text-center text-xs text-muted-foreground mt-2" style={{ fontFamily: "Inter, sans-serif" }}>
              No account?{" "}
              <button onClick={() => navigate("/signup")}
                className="font-semibold hover:underline cursor-pointer" style={{ color: NAVY }}>
                Create one
              </button>
            </p>
          </div>
        </PageCard>
      </div>

      {/* Forgot Password Modal */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-border rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setResetModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X size={18} />
            </button>

            <h3 className="text-lg font-black mb-1" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
              Reset Your Password
            </h3>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              Enter your email address and we'll send you a link to reset your password.
            </p>

            {resetSuccess ? (
              <div className="flex flex-col items-center text-center py-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
                  <CheckCircle2 size={28} />
                </div>
                <h4 className="font-bold text-sm mb-1" style={{ color: NAVY }}>Check Your Email</h4>
                <p className="text-xs text-slate-600 mb-5 leading-relaxed">
                  We've sent password reset instructions to <strong>{resetEmail}</strong>.
                </p>
                <GoldButton
                  onClick={() => setResetModalOpen(false)}
                  className="w-full justify-center text-xs py-2"
                >
                  Done
                </GoldButton>
              </div>
            ) : (
              <form onSubmit={handleSendResetEmail} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold" style={{ fontFamily: "var(--font-sans)" }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="you@rotaryclub.org"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="px-4 py-2.5 rounded-xl border border-border bg-input-background text-sm focus:outline-none focus:ring-2 transition-all"
                  />
                </div>

                {resetError && (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs bg-red-100 text-red-700">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{resetError}</span>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setResetModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <GoldButton
                    type="submit"
                    className="flex-1 justify-center py-2.5 text-xs"
                    disabled={resetLoading}
                  >
                    {resetLoading ? <Loader2 size={15} className="animate-spin" /> : "Send Reset Link"}
                  </GoldButton>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
