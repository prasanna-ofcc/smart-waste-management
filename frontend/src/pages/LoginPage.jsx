// ============================================================
// Login Page – supports login + register tabs, new demo creds
// ============================================================
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const DEMO_USERS = [
  { label: '🏛️ Admin',    email: 'admin@test.com',   role: 'admin' },
  { label: '👷 Worker 1', email: 'worker1@test.com',  role: 'worker' },
  { label: '👷 Worker 2', email: 'worker2@test.com',  role: 'worker' },
  { label: '👤 Public',   email: 'user@test.com',     role: 'public' },
];

function roleDestination(role) {
  if (role === 'admin')  return '/admin';
  if (role === 'worker') return '/worker';
  return '/dashboard';
}

export default function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab]     = useState('login');   // 'login' | 'register'
  const [loading, setLoading] = useState(false);

  const [loginForm, setLoginForm]     = useState({ email: '', password: '' });
  const [regForm,   setRegForm]       = useState({ name: '', email: '', password: '', phone: '' });

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(loginForm.email, loginForm.password);
      toast.success(`Welcome back, ${user.name}!`);
      navigate(roleDestination(user.role));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed.');
    } finally { setLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await register(regForm.name, regForm.email, regForm.password, regForm.phone);
      toast.success(`Account created! Welcome, ${user.name}!`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed.');
    } finally { setLoading(false); }
  };

  const quickLogin = (email) => {
    setLoginForm({ email, password: '123456' });
    setTab('login');
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <div className="logo-circle">🗑️</div>
          <h2>Smart Waste</h2>
          <p>Management System · Demo v2</p>
        </div>

        {/* Tab switcher */}
        <div style={{
          display: 'flex', gap: 4, background: 'rgba(255,255,255,0.05)',
          borderRadius: 8, padding: 4, marginBottom: 20,
        }}>
          {['login', 'register'].map(t => (
            <button
              key={t}
              id={`tab-${t}`}
              type="button"
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 6, border: 'none',
                cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                transition: 'all .2s',
                background: tab === t ? 'var(--blue)' : 'transparent',
                color: tab === t ? '#fff' : 'var(--text-muted)',
              }}
            >
              {t === 'login' ? '🔐 Sign In' : '📝 Register'}
            </button>
          ))}
        </div>

        {/* Login form */}
        {tab === 'login' && (
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input id="login-email" type="email" className="form-input" placeholder="you@example.com"
                value={loginForm.email}
                onChange={e => setLoginForm(f => ({ ...f, email: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input id="login-password" type="password" className="form-input" placeholder="••••••••"
                value={loginForm.password}
                onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))} required />
            </div>
            <button id="login-submit" type="submit" className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: 12 }} disabled={loading}>
              {loading
                ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Signing in...</>
                : '🔐 Sign In'}
            </button>
          </form>
        )}

        {/* Register form */}
        {tab === 'register' && (
          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input id="reg-name" type="text" className="form-input" placeholder="Your name"
                value={regForm.name}
                onChange={e => setRegForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input id="reg-email" type="email" className="form-input" placeholder="you@example.com"
                value={regForm.email}
                onChange={e => setRegForm(f => ({ ...f, email: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Password (min 6 chars)</label>
              <input id="reg-password" type="password" className="form-input" placeholder="••••••••"
                value={regForm.password}
                onChange={e => setRegForm(f => ({ ...f, password: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Phone (optional)</label>
              <input id="reg-phone" type="tel" className="form-input" placeholder="98765 43210"
                value={regForm.phone}
                onChange={e => setRegForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <button id="reg-submit" type="submit" className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: 12 }} disabled={loading}>
              {loading
                ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Creating account...</>
                : '📝 Create Account'}
            </button>
          </form>
        )}

        {/* Demo credentials quick-fill */}
        <div className="demo-creds" style={{ marginTop: 20 }}>
          <p style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
            ⚡ Quick Demo Login
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
            {DEMO_USERS.map(u => (
              <button
                key={u.email}
                id={`quick-${u.role}`}
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: 'center' }}
                onClick={() => quickLogin(u.email)}
              >
                {u.label}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>All passwords: <strong style={{ color: 'var(--text-muted)' }}>123456</strong></p>
        </div>

        {/* Public no-login link */}
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button id="public-link" type="button" className="btn btn-ghost"
            style={{ fontSize: 12 }} onClick={() => navigate('/public')}>
            🌍 Submit request without login →
          </button>
        </div>
      </div>
    </div>
  );
}
