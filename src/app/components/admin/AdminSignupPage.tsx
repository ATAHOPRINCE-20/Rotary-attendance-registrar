import { useState } from "react";
import { useNavigate } from "react-router";
import { Loader2, AlertCircle, UserPlus } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { RotaryLogo } from "../shared/RotaryLogo";
import { GoldButton } from "../shared/Buttons";
import { PageCard } from "../shared/PageCard";
import { NAVY } from "../../../lib/constants";
import { getFriendlyErrorMessage } from "../../../lib/errors";

export function AdminSignupPage() {
  const { signUp, signInWithGoogle } = useAuth();
  const navigate   = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const orgId = params.get("orgId");
  const role = params.get("role");

  async function handleSignUp() {
    setError(null);
    if (!fullName || !email || !password) { setError("All fields are required."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }

    setLoading(true);
    const { error: err, session } = await signUp(email, password, fullName, orgId, role);
    setLoading(false);
    if (err) { setError(getFriendlyErrorMessage(err)); return; }
    
    if (!session) {
      setIsSubmitted(true);
    } else {
      if (orgId) {
        navigate("/admin/dashboard");
      } else {
        navigate("/org-setup");
      }
    }
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4"
        style={{ background: "linear-gradient(135deg, #f0f4fa 0%, #e8edf5 100%)" }}>
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <RotaryLogo size={56} />
            <h1 className="text-2xl font-black mt-4 mb-1" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
              Check Your Email
            </h1>
            <p className="text-sm text-muted-foreground text-center" style={{ fontFamily: "Inter, sans-serif" }}>
              Confirmation link sent to your email
            </p>
          </div>

          <PageCard>
            <div className="flex flex-col gap-4 text-center">
              <p className="text-sm text-muted-foreground leading-relaxed">
                We've sent a verification link to <strong className="text-foreground">{email}</strong>. Please check your inbox and confirm your email to complete registration.
              </p>
              <GoldButton onClick={() => navigate("/admin")} className="w-full justify-center">
                Back to Sign In
              </GoldButton>
            </div>
          </PageCard>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #f0f4fa 0%, #e8edf5 100%)" }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <RotaryLogo size={56} />
          <h1 className="text-2xl font-black mt-4 mb-1" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
            {orgId ? "Join Organization Team" : "Create Admin Account"}
          </h1>
          <p className="text-sm text-muted-foreground text-center" style={{ fontFamily: "Inter, sans-serif" }}>
            {orgId ? "Set up your account to access your organization dashboard" : "Set up your Rotary club's event management platform"}
          </p>
        </div>

        <PageCard>
          <div className="flex flex-col gap-4">
            {[
              { label: "Full Name", value: fullName, set: setFullName, type: "text",     ph: "e.g. Kwame Asante" },
              { label: "Email",     value: email,    set: setEmail,    type: "email",    ph: "you@rotaryclub.org" },
              { label: "Password",  value: password, set: setPassword, type: "password", ph: "Min 8 characters" },
              { label: "Confirm Password", value: confirm, set: setConfirm, type: "password", ph: "Repeat password" },
            ].map(({ label, value, set, type, ph }) => (
              <div key={label} className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold" style={{ fontFamily: "var(--font-sans)" }}>{label}</label>
                <input
                  type={type}
                  placeholder={ph}
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  className="px-4 py-3 rounded-xl border border-border bg-input-background text-sm focus:outline-none focus:ring-2 transition-all"
                />
              </div>
            ))}

            {error && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
                style={{ backgroundColor: "#FED7D7", color: "#C53030" }}>
                <AlertCircle size={15} />
                <span style={{ fontFamily: "Inter, sans-serif" }}>{error}</span>
              </div>
            )}

            <GoldButton onClick={handleSignUp} className="w-full justify-center py-2.5 mt-1" disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <><UserPlus size={15} /> Create Account</>}
            </GoldButton>

            <div className="relative flex items-center justify-center w-full mt-2 mb-1">
              <div className="absolute border-t border-border w-full"></div>
              <span className="relative bg-background px-3 text-xs text-muted-foreground uppercase tracking-widest font-semibold" style={{ fontFamily: "Inter, sans-serif" }}>OR</span>
            </div>

            <button
              onClick={() => signInWithGoogle(orgId, role)}
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
              Sign Up with Google
            </button>

            <p className="text-center text-xs text-muted-foreground mt-2" style={{ fontFamily: "Inter, sans-serif" }}>
              Already have an account?{" "}
              <button onClick={() => navigate("/admin")}
                className="font-semibold hover:underline" style={{ color: NAVY }}>
                Sign in
              </button>
            </p>
          </div>
        </PageCard>
      </div>
    </div>
  );
}
