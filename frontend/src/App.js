import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SettingsProvider } from "./context/SettingsContext";
import { Toaster } from "sonner";

// Pages
import LoginPage from "./pages/LoginPage";
import ScannerPage from "./pages/ScannerPage";
import ResultPage from "./pages/ResultPage";
import SettingsPage from "./pages/SettingsPage";
import SearchPage from "./pages/SearchPage";
import OperationsPage from "./pages/OperationsPage";
import AdminSetupPage from "./pages/AdminSetupPage";
import WorkspaceAdminPage from "./pages/WorkspaceAdminPage";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Public Route Component (redirect if already logged in)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <OperationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/scanner"
        element={
          <ProtectedRoute>
            <ScannerPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/result"
        element={
          <ProtectedRoute>
            <ResultPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/search"
        element={
          <ProtectedRoute>
            <SearchPage />
          </ProtectedRoute>
        }
      />
      {/* Operations now lives at "/" (Home) — redirect the old bookmark/PWA-shortcut path */}
      <Route path="/operations" element={<Navigate to="/" replace />} />
      {/* Admin Setup - Hidden route, no authentication required */}
      {/* Admin Setup - Redirects to unified dashboard */}
      <Route path="/admin/setup" element={<Navigate to="/admin/dashboard" replace />} />
      {/* Super Admin Dashboard - Master code required */}
      <Route path="/admin/dashboard" element={<SuperAdminDashboard />} />
      {/* Workspace Admin Panel - Protected */}
      <Route
        path="/admin/workspace"
        element={
          <ProtectedRoute>
            <WorkspaceAdminPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <SettingsProvider>
            <AppRoutes />
            <Toaster 
              position="top-center"
              toastOptions={{
                style: {
                  background: 'white',
                  color: '#09090B',
                  border: '2px solid #09090B',
                },
              }}
            />
            {/* Grain overlay for texture */}
            <div className="grain-overlay" />
          </SettingsProvider>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
