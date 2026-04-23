// ============================================================
// App Root – routing with role-based guards
// ============================================================
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage       from './pages/LoginPage';
import WorkerPage      from './pages/WorkerPage';
import AdminPage       from './pages/AdminPage';
import PublicDashboard from './pages/PublicDashboard';
import PublicPage      from './pages/PublicPage';

// ── Spinner while auth hydrates ───────────────────────────
function Loader() {
  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg-primary)',
    }}>
      <div className="spinner" />
    </div>
  );
}

// ── Role-aware protected route ────────────────────────────
function Protected({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user)   return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    // Redirect to correct dashboard
    if (user.role === 'admin')  return <Navigate to="/admin"     replace />;
    if (user.role === 'worker') return <Navigate to="/worker"    replace />;
    return                             <Navigate to="/dashboard" replace />;
  }
  return children;
}

// ── Redirect logged-in users away from login ──────────────
function LoginGuard() {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user)   return <LoginPage />;
  if (user.role === 'admin')  return <Navigate to="/admin"     replace />;
  if (user.role === 'worker') return <Navigate to="/worker"    replace />;
  return                             <Navigate to="/dashboard" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public no-auth form */}
      <Route path="/public"    element={<PublicPage />} />

      {/* Login / root */}
      <Route path="/login"     element={<LoginGuard />} />
      <Route path="/"          element={<LoginGuard />} />

      {/* Worker */}
      <Route path="/worker"    element={<Protected role="worker"><WorkerPage /></Protected>} />

      {/* Admin */}
      <Route path="/admin"     element={<Protected role="admin"><AdminPage /></Protected>} />

      {/* Public dashboard (authenticated) */}
      <Route path="/dashboard" element={<Protected role="public"><PublicDashboard /></Protected>} />

      {/* 404 */}
      <Route path="*"          element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background:   'var(--bg-card)',
              color:        'var(--text-primary)',
              border:       '1px solid var(--border)',
              borderRadius: 8,
              fontSize:     13,
            },
            success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}
