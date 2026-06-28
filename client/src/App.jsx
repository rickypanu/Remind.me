import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import Homepage from './pages/HomePage';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Dashboard from './pages/dashboard';
import CreateTask from './pages/createtask';
import Profile from './pages/profile';
import About from './pages/about';
import FAQ from './pages/faqs';
import TermsAndPrivacy from './pages/terms';
import Report from './pages/report';

// Create a client for React Query
const queryClient = new QueryClient();

// A wrapper component to protect private routes
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  
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
            <Route path="/login" element={<Login/>} />
            <Route path="/register" element={<Register/>} />

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
            <Route 
              path="/about" 
              element={
                <About />
              } 
            />
            <Route 
              path="/faqs" 
              element={
                <FAQ />
              } 
            />
            <Route 
              path="/terms" 
              element={
                <TermsAndPrivacy />
              } 
            />
            
            {/* Catch-all Route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;