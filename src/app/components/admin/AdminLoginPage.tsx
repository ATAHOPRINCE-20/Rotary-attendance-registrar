import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Loader2, AlertCircle, LogIn } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { RotaryLogo } from "../shared/RotaryLogo";
import { GoldButton } from "../shared/Buttons";
import { PageCard } from "../shared/PageCard";
import { NAVY, GOLD } from "../../../lib/constants";

import { LoadingScreen } from "../shared/LoadingScreen";

export function AdminLoginPage() {
  const { signIn, user, profile, loading: authLoading, profileLoading } = useAuth();
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
    if (err) { setError(err); return; }
    navigate("/admin/dashboard");
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4"
      style={{ background: `linear-gradient(135deg, #f0f4fa 0%, #e8edf5 100%)` }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <RotaryLogo size={56} />
          <h1 className="text-2xl font-black mt-4 mb-1" style={{ color: NAVY, fontFamily: "Montserrat, sans-serif" }}>
            Admin Portal
          </h1>
          <p className="text-sm text-muted-foreground text-center" style={{ fontFamily: "Inter, sans-serif" }}>
            Sign in to manage your Rotary events
          </p>
        </div>

        <PageCard>
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold" style={{ fontFamily: "Montserrat, sans-serif" }}>Email Address</label>
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
              <label className="text-sm font-semibold" style={{ fontFamily: "Montserrat, sans-serif" }}>Password</label>
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

            <p className="text-center text-xs text-muted-foreground" style={{ fontFamily: "Inter, sans-serif" }}>
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
