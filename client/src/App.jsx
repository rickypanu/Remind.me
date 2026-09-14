import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import Home from "./pages/public/Home";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import Dashboard from "./pages/dashboard/dashboard";
import CreateTask from "./pages/user/CreateTask";
import Profile from "./pages/user/Profile";
import UpdatesPage from "./pages/user/UpdatePage";
import About from "./pages/public/About";
import TelegramSetup from "./pages/user/TelegramSetup";
import Terms from "./pages/public/Terms";
import FAQ from "./pages/public/Faqs";

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
          .join(""),
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
  const token = localStorage.getItem("token"); // Added token check here

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-background text-gray-100 font-sans">
          <Routes>
            {/* UPDATED LOGIC: Redirect to dashboard instantly if token exists */}
            <Route path="/" element={token ? <Navigate to="/dashboard" replace /> : <Home />} />
            <Route path="/login" element={token ? <Navigate to="/dashboard" replace /> : <Login />} />
            <Route path="/register" element={token ? <Navigate to="/dashboard" replace /> : <Register />} />

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
              path="/updates"
              element={
                <ProtectedRoute>
                  <UpdatesPage />
                </ProtectedRoute>
              }
            />
            <Route path="/about" element={<About />}  />
             
            {/* Catch-all Route UPDATED */}
            <Route path="*" element={<Navigate to={token ? "/dashboard" : "/"} replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;