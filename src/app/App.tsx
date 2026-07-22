import { lazy, Suspense, ComponentType } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { MemberAuthProvider } from "../context/MemberAuthContext";
import { TenantProvider } from "../context/TenantContext";
import { getSubdomain } from "../lib/subdomain";
import { LoadingScreen } from "./components/shared/LoadingScreen";

// Helper utility to retry dynamic imports when they fail (e.g. during PWA updates or offline states)
function lazyWithRetry<T extends ComponentType<any>>(
  componentImport: () => Promise<{ [key: string]: T } | { default: T }>,
  exportName?: string
) {
  return lazy(async () => {
    const hasReloaded = sessionStorage.getItem("pwa-retry-reload");
    try {
      const module = await componentImport();
      if (hasReloaded) {
        sessionStorage.removeItem("pwa-retry-reload");
      }
      return exportName ? { default: (module as any)[exportName] } : (module as { default: T });
    } catch (error) {
      console.error("Failed to dynamically import component. Error details:", error);
      
      // Only reload once to prevent infinite loops if there is a real server-side issue
      if (!hasReloaded) {
        sessionStorage.setItem("pwa-retry-reload", "true");
        window.location.reload();
      }
      
      // Fallback UI in case offline or reloads fail
      return {
        default: (() => (
          <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-background">
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16h.01"/><path d="M12 8v4"/><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/></svg>
            </div>
            <h2 className="text-lg font-bold" style={{ color: "#17458F" }}>Connection Error</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-xs leading-relaxed">
              We encountered a network issue loading this section. Please make sure you are connected to the internet.
            </p>
            <button
              onClick={() => {
                sessionStorage.removeItem("pwa-retry-reload");
                window.location.reload();
              }}
              className="mt-6 px-6 py-2.5 bg-[#F7A81B] hover:bg-[#e09412] text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer"
            >
              Retry Connection
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
  const isDocAdmin = window.location.pathname.startsWith("/admin") || 
                     window.location.pathname.startsWith("/org-setup") || 
                     window.location.pathname.startsWith("/signup");
  return <LoadingScreen variant={isDocAdmin ? "light" : "blue"} />;
}

// ─── Protected Route ──────────────────────────────────────────────────────────
function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { user, profile, loading, profileLoading, profileError, refreshProfile } = useAuth();

  // Wait for auth AND profile fetch to both complete before making routing decisions
  if (loading || profileLoading) {
    return <LoadingScreen variant="light" />;
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
    const fallback = profile.role === "member"
      ? "/member/dashboard"
      : profile.role === "treasurer"
      ? "/treasurer/dashboard"
      : "/admin/dashboard";
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
          <Route path="/donate"       element={<DonatePage />} />

          {/* Admin routes remain accessible via the subdomain */}
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
          <Route path="/member/login"          element={<MemberLoginPage />} />
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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<RouteLoadingFallback />}>
            <AppRoutes />
          </Suspense>
          <Toaster richColors position="top-right" />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
