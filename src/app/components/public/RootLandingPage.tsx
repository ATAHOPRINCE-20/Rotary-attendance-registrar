import { useNavigate } from "react-router"
import { RotaryLogo } from "../shared/RotaryLogo"
import { GoldButton } from "../shared/Buttons"
import { PageCard } from "../shared/PageCard"
import { NAVY } from "../../../lib/constants"

export function RootLandingPage() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#f0f8ff] to-[#e6f2ff]">
      <RotaryLogo size={80} />
      <h1 className="text-4xl font-extrabold mt-6 mb-2" style={{ color: NAVY, fontFamily: "Montserrat, sans-serif" }}>
        Rotary Connect
      </h1>
      <p className="text-lg text-muted-foreground mb-8">
        Create and manage Rotary events, QR check‑ins, and donations.
      </p>
      <PageCard>
        <div className="flex flex-col gap-4 items-center">
          <GoldButton onClick={() => navigate("/admin")}>Admin Login</GoldButton>
          <GoldButton onClick={() => navigate("/org/example")}>Demo Club</GoldButton>
        </div>
      </PageCard>
    </div>
  )
}
