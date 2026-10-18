import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";

import Home from "./pages/public/Home";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import Dashboard from "./pages/dashboard/Dashboard";
import CreateTask from "./pages/user/CreateTask";
import Profile from "./pages/user/profile";
import NotFound from "./pages/public/NotFound";
import AppToaster from "./components/AppToaster";
import ConnectionStatus from "./components/ConnectionStatus";
import OfflineBootstrap from "./components/OfflineBootstrap";
import UpdatesPage from "./pages/user/UpdatePage";
import About from "./pages/public/About";
import TelegramSetup from "./pages/user/TelegramSetup";
import Notifications from "./pages/user/Notifications";
import ScrollToTop from "./components/ScrollToTop";
import Terms from "./pages/public/Terms";
import FAQ from "./pages/public/Faqs";
import notify from "./utils/notify";
import { queryClient } from "./utils/queryClient";
import { isLoggedIn, AUTH_EXPIRED_EVENT } from "./utils/auth";

// The token is read every time a route renders (never cached in a variable),
// so logging out or in takes effect on the very next navigation.
const ProtectedRoute = ({ children }) =>
  isLoggedIn() ? children : <Navigate to="/login" replace />;

const PublicOnlyRoute = ({ children }) =>
  isLoggedIn() ? <Navigate to="/dashboard" replace /> : children;

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
          <Routes>
                        <Route path="/" element={<PublicOnlyRoute><Home /></PublicOnlyRoute>} />
            <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
            <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
            

            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route path="/terms" element={<Terms />} />
            <Route path="/faqs" element={<FAQ />} />

            {/* Protected User Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/create-task"
              element={
                <ProtectedRoute>
                  <CreateTask />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/telegram-setup"
              element={
                <ProtectedRoute>
                  <TelegramSetup />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <Notifications />
                </ProtectedRoute>
              }
            />
            <Route
              path="/updates"
              element={
                <ProtectedRoute>
                  <UpdatesPage />
                </ProtectedRoute>
              }
            />
            <Route path="/about" element={<About />}  />
             
            {/* Anything else: friendly 404 page */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;