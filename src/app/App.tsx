import { lazy, Suspense, ComponentType, Component, ErrorInfo, ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { MemberAuthProvider } from "../context/MemberAuthContext";
import { TenantProvider } from "../context/TenantContext";
import { getSubdomain } from "../lib/subdomain";
import { LoadingScreen } from "./components/shared/LoadingScreen";
import { PWAInstallBanner } from "./components/shared/PWAInstallBanner";

// Helper utility to retry dynamic imports when they fail (e.g. during PWA updates or server deployments)
function lazyWithRetry<T extends ComponentType<any>>(
  componentImport: () => Promise<{ [key: string]: T } | { default: T }>,
  exportName?: string
) {
  return lazy(async () => {
    const pageKey = `lazy-retry-${exportName || "default"}`;
    const hasReloaded = sessionStorage.getItem(pageKey);

    try {
      const module: any = await componentImport();
      
      // Resolve component from exportName, default export, or first key
      let Component: any = null;
      if (exportName && module[exportName]) {
        Component = module[exportName];
      } else if (module.default) {
        Component = module.default;
      } else if (module && typeof module === "object") {
        const keys = Object.keys(module);
        if (keys.length > 0) {
          Component = module[keys[0]];
        }
      }

      if (!Component || (typeof Component !== "function" && typeof Component !== "object")) {
        console.error(`Component resolution failed for '${exportName}'. Module contents:`, module);
        throw new Error(`Export '${exportName}' not found in module.`);
      }

      // Clear reload flag on successful load
      sessionStorage.removeItem(pageKey);
      return { default: Component };
    } catch (error) {
      console.error("Failed to dynamically import component. Error details:", error);

      // Auto-reload once per route if chunk load failed due to new deployment/stale cache
      if (!hasReloaded) {
        sessionStorage.setItem(pageKey, "true");
        window.location.reload();
        return new Promise(() => {}); // Pause until page reloads
      }

      sessionStorage.removeItem(pageKey);

      // Fallback UI in case offline or reloads fail
      return {
        default: (() => (
          <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-background">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
            </div>
            <h2 className="text-lg font-bold" style={{ color: "#17458F" }}>Updating Page Info...</h2>
            <p className="text-xs text-muted-foreground mt-2 max-w-xs leading-relaxed">
              We updated the app content. Tap below to display the latest page info.
            </p>
            <button
              onClick={() => {
                sessionStorage.clear();
                window.location.reload();
              }}
              className="mt-5 px-6 py-2.5 bg-[#F7A81B] hover:bg-[#e09412] text-slate-900 font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer"
            >
              Refresh Page
            </button>
          </div>
        )) as any
      };
    }
  });
}

// Public screens (lazy loaded with retry)
const RootLandingPage = lazyWithRetry(() => import("./components/public/RootLandingPage"), "RootLandingPage");
const TenantLandingPage = lazyWithRetry(() => import("./components/public/TenantLandingPage"), "TenantLandingPage");
const EventsListPage = lazyWithRetry(() => import("./components/public/EventsListPage"), "EventsListPage");
const EventDetailPage = lazyWithRetry(() => import("./components/public/EventDetailPage"), "EventDetailPage");
const RegistrationPage = lazyWithRetry(() => import("./components/public/RegistrationPage"), "RegistrationPage");
const PostRegisterPage = lazyWithRetry(() => import("./components/public/PostRegisterPage"), "PostRegisterPage");
const DonatePage = lazyWithRetry(() => import("./components/public/DonatePage"), "DonatePage");
const MonthlyProgramPage = lazyWithRetry(() => import("./components/public/MonthlyProgramPage"), "MonthlyProgramPage");
const PaymentResultPage = lazyWithRetry(() => import("./components/public/PaymentResultPage"), "PaymentResultPage");

// Admin screens (lazy loaded with retry)
const AdminLoginPage = lazyWithRetry(() => import("./components/admin/AdminLoginPage"), "AdminLoginPage");
const AdminSignupPage = lazyWithRetry(() => import("./components/admin/AdminSignupPage"), "AdminSignupPage");
const OrgSetupPage = lazyWithRetry(() => import("./components/admin/OrgSetupPage"), "OrgSetupPage");
const AdminDashboard = lazyWithRetry(() => import("./components/admin/AdminDashboard"), "AdminDashboard");
const EventsPage = lazyWithRetry(() => import("./components/admin/EventsPage"), "EventsPage");
const EventQRPage = lazyWithRetry(() => import("./components/admin/EventQRPage"), "EventQRPage");
const CheckInPage = lazyWithRetry(() => import("./components/admin/CheckInPage"), "CheckInPage");
const CommsPage = lazyWithRetry(() => import("./components/admin/CommsPage"), "CommsPage");
const AnalyticsPage = lazyWithRetry(() => import("./components/admin/AnalyticsPage"), "AnalyticsPage");
const MembersPage = lazyWithRetry(() => import("./components/admin/MembersPage"), "MembersPage");
const ReportsPage = lazyWithRetry(() => import("./components/admin/ReportsPage"), "ReportsPage");
const AdminWithdrawalsPage = lazyWithRetry(() => import("./components/admin/AdminWithdrawalsPage"), "AdminWithdrawalsPage");
const DirectoryPage = lazyWithRetry(() => import("./components/admin/DirectoryPage"), "DirectoryPage");
const TeamPage = lazyWithRetry(() => import("./components/admin/TeamPage"), "TeamPage");
const DonationCampaignsPage = lazyWithRetry(() => import("./components/admin/DonationCampaignsPage"), "DonationCampaignsPage");
const TenantsPage = lazyWithRetry(() => import("./components/admin/TenantsPage"), "TenantsPage");
const BillingPage = lazyWithRetry(() => import("./components/admin/BillingPage"), "BillingPage");
const SettingsPage = lazyWithRetry(() => import("./components/admin/SettingsPage"), "default");

// Member screens
const MemberLoginPage = lazyWithRetry(() => import("./components/public/MemberLoginPage"), "MemberLoginPage");
const MemberSetupPasswordPage = lazyWithRetry(() => import("./components/public/MemberSetupPasswordPage"), "MemberSetupPasswordPage");
const MemberDuesDashboard = lazyWithRetry(() => import("./components/public/MemberDuesDashboard"), "MemberDuesDashboard");

// Treasurer screen
const TreasurerDashboard = lazyWithRetry(() => import("./components/admin/TreasurerDashboard"), "TreasurerDashboard");

// Auth recovery screen
const ResetPasswordPage = lazyWithRetry(() => import("./components/auth/ResetPasswordPage"), "ResetPasswordPage");



const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

// Dynamic fallback that checks current route to match styling
function RouteLoadingFallback() {
  return <LoadingScreen variant="blue" />;
}

// ─── Protected Route ──────────────────────────────────────────────────────────
function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { user, profile, loading, profileLoading, profileError, refreshProfile } = useAuth();

  // Wait for auth AND profile fetch to both complete before making routing decisions
  if (loading || profileLoading) {
    return <LoadingScreen variant="blue" />;
  }

  if (!user) return <Navigate to="/admin" replace />;

  // Profile fetch errored (network/timeout) — show retry rather than sending to /org-setup
  if (profileError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center"
           style={{ background: "linear-gradient(135deg, #081c3b 0%, #0d2c54 100%)" }}>
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 max-w-sm w-full border border-white/10 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-400/20 flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
                 fill="none" stroke="#F7A81B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16h.01"/><path d="M12 8v4"/>
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
            </svg>
          </div>
          <h2 className="text-white font-black text-lg mb-2">Connection Issue</h2>
          <p className="text-blue-100/70 text-sm leading-relaxed mb-6">
            We couldn't load your profile. Please check your internet connection and try again.
          </p>
          <button
            onClick={() => refreshProfile()}
            className="w-full py-3 bg-[#F7A81B] hover:bg-[#e09412] text-white font-bold rounded-xl transition-all shadow-lg cursor-pointer text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Only redirect to org-setup if profile fetch completed successfully with no record (new user)
  if (!profile) return <Navigate to="/org-setup" replace />;

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    const fallback = (profile.role === "admin" || profile.role === "super_admin")
      ? "/admin/dashboard"
      : profile.role === "treasurer"
      ? "/treasurer/dashboard"
      : "/member/dashboard";
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}

// ─── App Router ───────────────────────────────────────────────────────────────
function AppRoutes() {
  const subdomain = getSubdomain();

  if (subdomain) {
    // Subdomain Mode (e.g. ntinda.agoroll.com): Tenant pages are at the root path
    return (
      <TenantProvider>
        <Routes>
          <Route index                element={<TenantLandingPage />} />
          <Route path="/events"       element={<EventsListPage />} />
          <Route path="/event/:id"    element={<EventDetailPage />} />
          <Route path="/register"     element={<RegistrationPage />} />
          <Route path="/register/:id" element={<RegistrationPage />} />
          <Route path="/post-register" element={<PostRegisterPage />} />
          <Route path="/monthly-program" element={<MonthlyProgramPage />} />
          <Route path="/donate"       element={<DonatePage />} />
          <Route path="/payment-result" element={<PaymentResultPage />} />

          {/* Single Universal Login Route for All Users */}
          <Route path="/login"     element={<AdminLoginPage />} />
          <Route path="/admin"     element={<AdminLoginPage />} />
          <Route path="/signup"    element={<AdminSignupPage />} />
          <Route path="/org-setup" element={<OrgSetupPage />} />
          <Route path="/admin/dashboard"          element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/events"             element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><EventsPage /></ProtectedRoute>} />
          <Route path="/admin/events/:id/qr"      element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><EventQRPage /></ProtectedRoute>} />
          <Route path="/admin/checkin/:eventId"   element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><CheckInPage /></ProtectedRoute>} />
          <Route path="/admin/communications"     element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><CommsPage /></ProtectedRoute>} />
          <Route path="/admin/analytics"          element={<ProtectedRoute allowedRoles={["admin", "super_admin", "treasurer"]}><AnalyticsPage /></ProtectedRoute>} />
          <Route path="/admin/members"            element={<ProtectedRoute allowedRoles={["admin", "super_admin", "treasurer"]}><MembersPage /></ProtectedRoute>} />
          <Route path="/admin/directory"          element={<ProtectedRoute allowedRoles={["admin", "super_admin", "treasurer"]}><DirectoryPage /></ProtectedRoute>} />
          <Route path="/admin/reports"            element={<ProtectedRoute allowedRoles={["admin", "super_admin", "treasurer"]}><ReportsPage /></ProtectedRoute>} />
          <Route path="/admin/withdrawals"        element={<ProtectedRoute allowedRoles={["admin", "super_admin", "treasurer"]}><AdminWithdrawalsPage /></ProtectedRoute>} />
          <Route path="/admin/team"               element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><TeamPage /></ProtectedRoute>} />
          <Route path="/admin/donation-campaigns" element={<ProtectedRoute allowedRoles={["admin", "super_admin", "treasurer"]}><DonationCampaignsPage /></ProtectedRoute>} />
          <Route path="/admin/tenants"            element={<ProtectedRoute allowedRoles={["super_admin"]}><TenantsPage /></ProtectedRoute>} />
          <Route path="/admin/billing"            element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><BillingPage /></ProtectedRoute>} />
          <Route path="/admin/settings"           element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><SettingsPage /></ProtectedRoute>} />
          <Route path="/treasurer/dashboard"      element={<ProtectedRoute allowedRoles={["treasurer", "admin", "super_admin"]}><TreasurerDashboard /></ProtectedRoute>} />

          {/* Auth recovery */}
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Member routes */}
          <Route path="/member/login"          element={<AdminLoginPage />} />
          <Route path="/member/setup-password" element={<MemberSetupPasswordPage />} />
          <Route path="/member/dashboard"      element={<MemberAuthProvider><MemberDuesDashboard /></MemberAuthProvider>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </TenantProvider>
    );
  }

  // Bare Platform Domain Mode (e.g. agoroll.com)
  return (
    <Routes>
      {/* Root landing — platform homepage */}
      <Route path="/"          element={<RootLandingPage />} />

      {/* Admin auth */}
      <Route path="/admin"     element={<AdminLoginPage />} />
      <Route path="/signup"    element={<AdminSignupPage />} />
      <Route path="/org-setup" element={<OrgSetupPage />} />

      {/* Protected admin panel */}
      <Route path="/admin/dashboard"          element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/events"             element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><EventsPage /></ProtectedRoute>} />
      <Route path="/admin/events/:id/qr"      element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><EventQRPage /></ProtectedRoute>} />
      <Route path="/admin/checkin/:eventId"   element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><CheckInPage /></ProtectedRoute>} />
      <Route path="/admin/communications"     element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><CommsPage /></ProtectedRoute>} />
      <Route path="/admin/analytics"          element={<ProtectedRoute allowedRoles={["admin", "super_admin", "treasurer"]}><AnalyticsPage /></ProtectedRoute>} />
      <Route path="/admin/members"            element={<ProtectedRoute allowedRoles={["admin", "super_admin", "treasurer"]}><MembersPage /></ProtectedRoute>} />
      <Route path="/admin/directory"          element={<ProtectedRoute allowedRoles={["admin", "super_admin", "treasurer"]}><DirectoryPage /></ProtectedRoute>} />
      <Route path="/admin/reports"            element={<ProtectedRoute allowedRoles={["admin", "super_admin", "treasurer"]}><ReportsPage /></ProtectedRoute>} />
      <Route path="/admin/withdrawals"        element={<ProtectedRoute allowedRoles={["admin", "super_admin", "treasurer"]}><AdminWithdrawalsPage /></ProtectedRoute>} />
      <Route path="/admin/team"               element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><TeamPage /></ProtectedRoute>} />
      <Route path="/admin/donation-campaigns" element={<ProtectedRoute allowedRoles={["admin", "super_admin", "treasurer"]}><DonationCampaignsPage /></ProtectedRoute>} />
      <Route path="/admin/tenants"            element={<ProtectedRoute allowedRoles={["super_admin"]}><TenantsPage /></ProtectedRoute>} />
      <Route path="/admin/billing"            element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><BillingPage /></ProtectedRoute>} />
      <Route path="/admin/settings"           element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><SettingsPage /></ProtectedRoute>} />
      <Route path="/treasurer/dashboard"      element={<ProtectedRoute allowedRoles={["treasurer", "admin", "super_admin"]}><TreasurerDashboard /></ProtectedRoute>} />

      {/* Auth recovery */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Member routes */}
      <Route path="/member/login"          element={<MemberLoginPage />} />
      <Route path="/member/setup-password" element={<MemberSetupPasswordPage />} />
      <Route path="/member/dashboard"      element={<MemberAuthProvider><MemberDuesDashboard /></MemberAuthProvider>} />

      {/* Tenant (public attendee) routes — subpath fallback scoped to :slug */}
      <Route
        path="/org/:slug/*"
        element={
          <TenantProvider>
            <Routes>
              <Route index               element={<TenantLandingPage />} />
              <Route path="events"       element={<EventsListPage />} />
              <Route path="event/:id"    element={<EventDetailPage />} />
              <Route path="register"     element={<RegistrationPage />} />
              <Route path="register/:id" element={<RegistrationPage />} />
              <Route path="post-register" element={<PostRegisterPage />} />
              <Route path="monthly-program" element={<MonthlyProgramPage />} />
              <Route path="donate"       element={<DonatePage />} />
            </Routes>
          </TenantProvider>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  public state: { hasError: boolean; error: Error | null } = { hasError: false, error: null };

  public static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught React Error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-slate-900 text-white">
          <div className="bg-slate-800/90 backdrop-blur-md rounded-2xl p-8 max-w-md w-full border border-slate-700 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-[#F7A81B] flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
            </div>
            <h2 className="text-lg font-black mb-2 text-white font-sans">App Screen Error</h2>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              An unexpected display issue occurred. Tap below to refresh your app data.
            </p>
            {this.state.error && (
              <div className="bg-slate-950/80 p-3 rounded-xl text-[11px] font-mono text-rose-300 text-left mb-6 overflow-x-auto max-h-32 border border-slate-800">
                {this.state.error.toString()}
              </div>
            )}
            <button
              onClick={() => {
                sessionStorage.clear();
                window.location.reload();
              }}
              className="w-full py-3 bg-[#F7A81B] hover:bg-[#e09412] text-slate-950 font-extrabold rounded-xl transition-all shadow-lg cursor-pointer text-xs uppercase tracking-wider"
            >
              Refresh Page & App Cache
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<RouteLoadingFallback />}>
              <AppRoutes />
            </Suspense>
            <Toaster richColors position="top-right" />
            <PWAInstallBanner />
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
