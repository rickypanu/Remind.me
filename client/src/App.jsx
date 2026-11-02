import React, { Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";

import AppToaster from "./components/AppToaster";
import ConnectionStatus from "./components/ConnectionStatus";
import OfflineBootstrap from "./components/OfflineBootstrap";
import RouteAnnouncer from "./components/RouteAnnouncer";
import RouteErrorBoundary from "./components/RouteErrorBoundary";
import RouteSkeleton from "./components/RouteSkeleton";
import UpdatePrompt from "./components/UpdatePrompt";
import ScrollToTop from "./components/ScrollToTop";
import notify from "./utils/notify";
import { queryClient } from "./utils/queryClient";
import { isLoggedIn, AUTH_EXPIRED_EVENT } from "./utils/auth";
import { lazyRoute } from "./utils/lazyRoute";

// Every page is its own chunk (finding P1): /login no longer downloads the dashboard, FAQs or Terms.
// The service worker precaches all chunks after the first visit, so offline navigation still works.
const Home = lazyRoute(() => import("./pages/public/Home"));
const About = lazyRoute(() => import("./pages/public/About"));
const FAQ = lazyRoute(() => import("./pages/public/Faqs"));
const Terms = lazyRoute(() => import("./pages/public/Terms"));
const NotFound = lazyRoute(() => import("./pages/public/NotFound"));
const Login = lazyRoute(() => import("./pages/auth/Login"));
const Register = lazyRoute(() => import("./pages/auth/Register"));
const ForgotPassword = lazyRoute(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazyRoute(() => import("./pages/auth/ResetPassword"));
const Dashboard = lazyRoute(() => import("./pages/dashboard/Dashboard"));
const CreateTask = lazyRoute(() => import("./pages/user/CreateTask"));
const Profile = lazyRoute(() => import("./pages/user/profile"));
const TelegramSetup = lazyRoute(() => import("./pages/user/TelegramSetup"));
const Notifications = lazyRoute(() => import("./pages/user/Notifications"));
const UpdatesPage = lazyRoute(() => import("./pages/user/UpdatePage"));

// The token is read every time a route renders (never cached in a variable),
// so logging out or in takes effect on the very next navigation.
const ProtectedRoute = ({ children }) => (isLoggedIn() ? children : <Navigate to="/login" replace />);

const PublicOnlyRoute = ({ children }) => (isLoggedIn() ? <Navigate to="/dashboard" replace /> : children);

// Sends the user to the login page when the API reports an expired session.
function AuthWatcher() {
  const navigate = useNavigate();
  useEffect(() => {
    const onExpired = () => {
      notify.error("Your session has ended. Please log in again.");
      navigate("/login", { replace: true });
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, [navigate]);
  return null;
}

const guarded = (page) => <ProtectedRoute>{page}</ProtectedRoute>;

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-background text-gray-900 font-sans">
          <AppToaster />
          <OfflineBootstrap />
          <ConnectionStatus />
          <AuthWatcher />
          <ScrollToTop />
          <RouteAnnouncer />
          <UpdatePrompt />
          <RouteErrorBoundary>
            <Suspense fallback={<RouteSkeleton />}>
              <Routes>
                <Route path="/" element={<PublicOnlyRoute><Home /></PublicOnlyRoute>} />
                <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
                <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />

                <Route path="/terms" element={<Terms />} />
                <Route path="/faqs" element={<FAQ />} />
                <Route path="/about" element={<About />} />

                {/* Protected user routes */}
                <Route path="/dashboard" element={guarded(<Dashboard />)} />
                <Route path="/create-task" element={guarded(<CreateTask />)} />
                <Route path="/profile" element={guarded(<Profile />)} />
                <Route path="/telegram-setup" element={guarded(<TelegramSetup />)} />
                <Route path="/notifications" element={guarded(<Notifications />)} />
                <Route path="/updates" element={guarded(<UpdatesPage />)} />

                {/* Anything else: friendly 404 page */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </RouteErrorBoundary>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
