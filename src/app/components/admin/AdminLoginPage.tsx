import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Loader2, AlertCircle, LogIn } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { RotaryLogo } from "../shared/RotaryLogo";
import { GoldButton } from "../shared/Buttons";
import { PageCard } from "../shared/PageCard";
import { NAVY, GOLD } from "../../../lib/constants";
import { getFriendlyErrorMessage } from "../../../lib/errors";

import { LoadingScreen } from "../shared/LoadingScreen";

export function AdminLoginPage() {
  const { signIn, signInWithGoogle, user, profile, loading: authLoading, profileLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  // Already logged in → redirect safely using useEffect
  useEffect(() => {
    if (!authLoading && !profileLoading && user) {
      if (profile) {
        navigate("/admin/dashboard", { replace: true });
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
    navigate("/admin/dashboard");
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4"
      style={{ background: `linear-gradient(135deg, #f0f4fa 0%, #e8edf5 100%)` }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <RotaryLogo size={56} />
          <h1 className="text-2xl font-black mt-4 mb-1" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
            Admin Portal
          </h1>
          <p className="text-sm text-muted-foreground text-center" style={{ fontFamily: "Inter, sans-serif" }}>
            Sign in to manage your Rotary events
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
              <label className="text-sm font-semibold" style={{ fontFamily: "var(--font-sans)" }}>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                className="px-4 py-3 rounded-xl border border-border bg-input-background text-sm focus:outline-none focus:ring-2 transition-all"
              />
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
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-border bg-input-background hover:bg-muted transition-all text-sm font-semibold"
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
                className="font-semibold hover:underline" style={{ color: NAVY }}>
                Create one
              </button>
            </p>
          </div>
        </PageCard>
      </div>
    </div>
  );
}
