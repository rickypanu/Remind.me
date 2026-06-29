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

// Import BOTH Squad components
import SquadLobby from "./pages/squad/SquadLobby";
import SquadDashboard from "./pages/squad/SquadDashboard";

// Create a client for React Query
const queryClient = new QueryClient();

// A wrapper component to protect private routes
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("token");

  // If there is no token, kick them back to the Auth page
  if (!token) {
    return <Navigate to="/" replace />;
  }

  // Otherwise, render the requested page
  return children;
};

function App() {
  return (
    // Wrap the entire app so React Query can manage data globally
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {/* Background color applied to the whole app */}
        <div className="min-h-screen bg-background text-gray-100 font-sans">
          <Routes>
            {/* Public Route (Login/Signup combined) */}
            <Route path="/" element={<Homepage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected Routes */}
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
              path="/report"
              element={
                <ProtectedRoute>
                  <Report />
                </ProtectedRoute>
              }
            />
            
            {/* === NEW SQUAD ROUTES === */}
            
            {/* 1. The Lobby: View all squads, join, or create */}
            <Route
              path="/squad"
              element={
                <ProtectedRoute>
                  <SquadLobby />
                </ProtectedRoute>
              }
            />
            
            {/* 2. The Dashboard: Dynamic route for a specific squad */}
            <Route
              path="/squad/:squadId"
              element={
                <ProtectedRoute>
                  <SquadDashboard />
                </ProtectedRoute>
              }
            />
            
            {/* ========================== */}

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