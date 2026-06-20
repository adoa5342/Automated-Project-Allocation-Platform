import React from 'react'
import ReactDOM from 'react-dom/client'

import '../styles/globals.css'

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Admin from './index';
import Results from './result';
import Survey from './survey';
import Login from './login';

import { AuthProvider } from "./authenticationContext";
import ProtectedRoute from "./protectedRoute";

const rootElement = document.getElementById('root')

if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);

  root.render(
    <React.StrictMode>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomeRedirect />} />

            {/* Public Routes */}
            <Route path="/login" element={<Login />} />

            {/* Protected Routes */}
            <Route element={<ProtectedRoute allowedRoles={["student", "admin"]} />}>
              <Route path="/survey" element={<Survey />} />
              <Route path="/results" element={<Results />} />
            </Route>

            {/* Admin-only */}
            <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
              <Route path="/admin" element={<Admin />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Login />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </React.StrictMode>
  );
}

function HomeRedirect() {
  return <Navigate to="/login" replace />;
}
