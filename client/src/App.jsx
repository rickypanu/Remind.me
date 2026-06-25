import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';


import Auth from './pages/auth';
import Dashboard from './pages/dashboard';
import CreateTask from './pages/createtask';
import Profile from './pages/profile';
import About from './pages/about';
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
    <BrowserRouter>
      {/* Background color applied to the whole app */}
      <div className="min-h-screen bg-background text-gray-100 font-sans">
        <Routes>
          {/* Public Route (Login/Signup combined) */}
          <Route path="/" element={<Auth />} />

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
            path="/about" 
            element={
              
                <About />
           
            } 
          />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;