import { useState } from "react";
import { useNavigate } from "react-router";
import { Loader2, AlertCircle, UserPlus } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { RotaryLogo } from "../shared/RotaryLogo";
import { GoldButton } from "../shared/Buttons";
import { PageCard } from "../shared/PageCard";
import { NAVY } from "../../../lib/constants";

export function AdminSignupPage() {
  const { signUp } = useAuth();
  const navigate   = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  async function handleSignUp() {
    setError(null);
    if (!fullName || !email || !password) { setError("All fields are required."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }

    setLoading(true);
    const { error: err, session } = await signUp(email, password, fullName);
    setLoading(false);
    if (err) { setError(err); return; }
    
    if (!session) {
      setIsSubmitted(true);
    } else {
      navigate("/org-setup");
    }
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4"
        style={{ background: "linear-gradient(135deg, #f0f4fa 0%, #e8edf5 100%)" }}>
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <RotaryLogo size={56} />
            <h1 className="text-2xl font-black mt-4 mb-1" style={{ color: NAVY, fontFamily: "Montserrat, sans-serif" }}>
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
          <h1 className="text-2xl font-black mt-4 mb-1" style={{ color: NAVY, fontFamily: "Montserrat, sans-serif" }}>
            Create Admin Account
          </h1>
          <p className="text-sm text-muted-foreground text-center" style={{ fontFamily: "Inter, sans-serif" }}>
            Set up your Rotary club's event management platform
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
                <label className="text-sm font-semibold" style={{ fontFamily: "Montserrat, sans-serif" }}>{label}</label>
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

            <GoldButton onClick={handleSignUp} className="w-full justify-center py-3 mt-1" disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <><UserPlus size={15} /> Create Account</>}
            </GoldButton>

            <p className="text-center text-xs text-muted-foreground" style={{ fontFamily: "Inter, sans-serif" }}>
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
