import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import Homepage from "./pages/general/HomePage";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import Dashboard from "./pages/user/dashboard";
import CreateTask from "./pages/user/createtask";
import Profile from "./pages/user/profile";
import About from "./pages/general/about";
import FAQ from "./pages/general/faqs";
import TermsAndPrivacy from "./pages/general/terms";
import Report from "./pages/user/report";
import TelegramSettings from "./pages/general/TelegramSettings";
import UpdatePage from "./pages/user/updatepage";

// Import Squad components
import SquadLobby from "./pages/squad/SquadLobby";
import SquadDashboard from "./pages/squad/SquadDashboard";
import SquadAnalytics from "./pages/squad/SquadAnalytics";

// Create a client for React Query
const queryClient = new QueryClient();

// Helper to safely get user info from localStorage or JWT Token
const getCurrentUser = () => {
  const token = localStorage.getItem("token");
  const storedUser = localStorage.getItem("user");

  if (storedUser) {
    try {
      return JSON.parse(storedUser);
    } catch (e) {
      console.error("Error parsing stored user", e);
    }
  }

  if (token) {
    try {
      // Decode JWT payload token fallback
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error("Error decoding token", e);
    }
  }

  return null;
};

// Protected route wrapper
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function App() {
  const currentUser = getCurrentUser();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-background text-gray-100 font-sans">
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Homepage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

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
              path="/reminder/report"
              element={
                <ProtectedRoute>
                  <Report />
                </ProtectedRoute>
              }
            />

            {/* Squad Routes */}
            <Route
              path="/squad"
              element={
                <ProtectedRoute>
                  <SquadLobby />
                </ProtectedRoute>
              }
            />
            <Route
              path="/squad/:squadId"
              element={
                <ProtectedRoute>
                  <SquadDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/squad/:squadId/analytics"
              element={
                <ProtectedRoute>
                  <SquadAnalytics />
                </ProtectedRoute>
              }
            />

            {/* Telegram Settings Page */}
            <Route path="/telegram" element={<ProtectedRoute><TelegramSettings /></ProtectedRoute>} />
            
            {/* Other Pages */}
            <Route
              path="/update"
              element={
                <ProtectedRoute>
                  <UpdatePage />
                </ProtectedRoute>
              }
            />
            <Route path="/about" element={<About />} />
            <Route path="/faqs" element={<FAQ />} />
            <Route path="/terms" element={<TermsAndPrivacy />} />

            {/* Catch-all Route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;