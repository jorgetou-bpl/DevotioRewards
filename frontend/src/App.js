import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SettingsProvider } from "./context/SettingsContext";
import { Toaster } from "sonner";
import { AppLayout } from "./components/AppLayout";

// Pages
import LoginPage from "./pages/LoginPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import ScannerPage from "./pages/ScannerPage";
import ResultPage from "./pages/ResultPage";
import SettingsPage from "./pages/SettingsPage";
import HomePage from "./pages/HomePage";
import HistorialPage from "./pages/HistorialPage";
import ClientesPage from "./pages/ClientesPage";
import TarjetasPage from "./pages/TarjetasPage";
import UbicacionesPage from "./pages/UbicacionesPage";
import AdminSetupPage from "./pages/AdminSetupPage";
import WorkspaceAdminPage from "./pages/WorkspaceAdminPage";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import CustomerProfilePage from "./pages/CustomerProfilePage";
import NotificationsPage from "./pages/NotificationsPage";

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

// Admin Route Component — like ProtectedRoute, but also requires
// workspace_admin/super_admin (e.g. Customer Base/Profile, Tarjetas,
// Mensajería, Ubicaciones).
const AdminRoute = ({ children }) => {
  const { isAuthenticated, loading, user } = useAuth();

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

  if (!['workspace_admin', 'super_admin'].includes(user?.role)) {
    return <Navigate to="/" replace />;
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
      {/* No auth gating — the reset token itself is the credential, and a
          currently-logged-in browser (e.g. testing, shared device) must
          still be able to reach this form instead of being redirected
          away by PublicRoute's isAuthenticated check. */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout><HomePage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/scanner"
        element={
          <ProtectedRoute>
            <AppLayout><ScannerPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/historial"
        element={
          <ProtectedRoute>
            <AppLayout><HistorialPage /></AppLayout>
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
      {/* Buscar cliente ("/search") was folded into the Clientes page's own
          search bar — see plan item 4 — so it no longer needs a route. */}
      <Route path="/search" element={<Navigate to="/clientes" replace />} />
      {/* Operations now lives at "/" (Home) — redirect the old bookmark/PWA-shortcut path */}
      <Route path="/operations" element={<Navigate to="/" replace />} />
      <Route
        path="/clientes"
        element={
          <AdminRoute>
            <AppLayout><ClientesPage /></AppLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/clientes/:phone"
        element={
          <AdminRoute>
            <CustomerProfilePage />
          </AdminRoute>
        }
      />
      <Route
        path="/tarjetas"
        element={
          <AdminRoute>
            <AppLayout><TarjetasPage /></AppLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/ubicaciones"
        element={
          <AdminRoute>
            <AppLayout><UbicacionesPage /></AppLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <AdminRoute>
            <AppLayout><NotificationsPage /></AppLayout>
          </AdminRoute>
        }
      />
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
