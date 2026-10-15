import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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
import UpdatesPage from "./pages/user/UpdatePage";
import About from "./pages/public/About";
import TelegramSetup from "./pages/user/TelegramSetup";
import Terms from "./pages/public/Terms";
import FAQ from "./pages/public/Faqs";

// Create a client for React Query
const queryClient = new QueryClient();

// Protected route wrapper
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  const token = localStorage.getItem("token"); // Added token check here

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-background text-gray-900 font-sans">
          <AppToaster />
          <Routes>
            {/* UPDATED LOGIC: Redirect to dashboard instantly if token exists */}
            <Route path="/" element={token ? <Navigate to="/dashboard" replace /> : <Home />} />
            <Route path="/login" element={token ? <Navigate to="/dashboard" replace /> : <Login />} />
            <Route path="/register" element={token ? <Navigate to="/dashboard" replace /> : <Register />} />
            

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