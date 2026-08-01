import { useTenant } from "../../../context/TenantContext";
import { NavBar } from "../shared/NavBar";
import { MonthlyProgramView } from "./MonthlyProgramView";

export function MonthlyProgramPage() {
  const { organization } = useTenant();

  return (
    <div className="min-h-screen bg-background pt-24 pb-16">
      <NavBar organization={organization} currentPath={window.location.pathname} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <MonthlyProgramView />
      </div>
    </div>
  );
}
