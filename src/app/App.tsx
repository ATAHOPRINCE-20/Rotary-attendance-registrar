import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { TenantProvider } from "../context/TenantContext";

// Public screens
import { RootLandingPage }   from "./components/public/RootLandingPage";
import { TenantLandingPage } from "./components/public/TenantLandingPage";
import { EventsListPage }    from "./components/public/EventsListPage";
import { EventDetailPage }   from "./components/public/EventDetailPage";
import { RegistrationPage }  from "./components/public/RegistrationPage";
import { PostRegisterPage }  from "./components/public/PostRegisterPage";
import { DonatePage }        from "./components/public/DonatePage";
import { QRScannerPage }     from "./components/public/QRScannerPage";

// Admin screens
import { AdminLoginPage }    from "./components/admin/AdminLoginPage";
import { AdminSignupPage }   from "./components/admin/AdminSignupPage";
import { OrgSetupPage }      from "./components/admin/OrgSetupPage";
import { AdminDashboard }    from "./components/admin/AdminDashboard";
import { EventsPage }        from "./components/admin/EventsPage";
import { EventQRPage }       from "./components/admin/EventQRPage";
import { CheckInPage }       from "./components/admin/CheckInPage";
import { CommsPage }         from "./components/admin/CommsPage";
import { AnalyticsPage }     from "./components/admin/AnalyticsPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

// ─── Protected Route ──────────────────────────────────────────────────────────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/admin" replace />;

  // Has user but no profile yet → send to org setup
  if (!profile) return <Navigate to="/org-setup" replace />;

  return <>{children}</>;
}

// ─── App Router ───────────────────────────────────────────────────────────────
function AppRoutes() {
  return (
    <Routes>
      {/* Root landing — platform homepage */}
      <Route path="/"          element={<RootLandingPage />} />

      {/* Admin auth */}
      <Route path="/admin"     element={<AdminLoginPage />} />
      <Route path="/signup"    element={<AdminSignupPage />} />
      <Route path="/org-setup" element={<OrgSetupPage />} />

      {/* Protected admin panel */}
      <Route path="/admin/dashboard"          element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/events"             element={<ProtectedRoute><EventsPage /></ProtectedRoute>} />
      <Route path="/admin/events/:id/qr"      element={<ProtectedRoute><EventQRPage /></ProtectedRoute>} />
      <Route path="/admin/checkin/:eventId"   element={<ProtectedRoute><CheckInPage /></ProtectedRoute>} />
      <Route path="/admin/communications"     element={<ProtectedRoute><CommsPage /></ProtectedRoute>} />
      <Route path="/admin/analytics"          element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />

      {/* Tenant (public attendee) routes — all scoped to :slug */}
      <Route
        path="/org/:slug/*"
        element={
          <TenantProvider>
            <Routes>
              <Route index               element={<TenantLandingPage />} />
              <Route path="events"       element={<EventsListPage />} />
              <Route path="event/:id"    element={<EventDetailPage />} />
              <Route path="register/:id" element={<RegistrationPage />} />
              <Route path="post-register" element={<PostRegisterPage />} />
              <Route path="donate"       element={<DonatePage />} />
              <Route path="scan"         element={<QRScannerPage />} />
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
          <AppRoutes />
          <Toaster richColors position="top-right" />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
