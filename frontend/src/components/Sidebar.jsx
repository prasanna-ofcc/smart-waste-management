// ============================================================
// Sidebar – role-aware navigation (admin / worker / public)
// ============================================================
import React from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const NAV = {
  admin: [
    { id: 'dashboard', label: 'Dashboard',     icon: '📊' },
    { id: 'map',       label: 'Live Map',       icon: '🗺️' },
    { id: 'workers',   label: 'Workers',        icon: '👷' },
    { id: 'requests',  label: 'Requests',       icon: '📬', badge: true },
    { id: 'analytics', label: 'Analytics',      icon: '📈' },
  ],
  worker: [
    { id: 'map',   label: 'Live Map',       icon: '🗺️' },
    { id: 'route', label: 'Route Planner',  icon: '🧭' },
  ],
  public: [
    { id: 'map',      label: 'Nearby Bins',    icon: '🗑️' },
    { id: 'request',  label: 'Report Issue',   icon: '📢' },
    { id: 'myrequests', label: 'My Requests',  icon: '📋' },
  ],
};

const ROLE_BADGE = {
  admin:  { cls: 'badge-admin',  label: 'Admin' },
  worker: { cls: 'badge-worker', label: 'Worker' },
  public: { cls: 'badge-public', label: 'Public' },
};

export default function Sidebar({ activeTab, setActiveTab, isOpen, setIsOpen, pendingCount = 0 }) {
  const { user, logout } = useAuth();
  const role = user?.role || 'public';
  const items = NAV[role] || NAV.public;
  const badge = ROLE_BADGE[role] || ROLE_BADGE.public;

  const handleLogout = () => { logout(); toast.success('Logged out.'); };

  return (
    <>
      {isOpen && (
        <div className="sidebar-backdrop" onClick={() => setIsOpen(false)} />
      )}

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="logo-icon">🗑️</div>
          <h1>Smart Waste<br />Management</h1>
          <span className={`badge ${badge.cls}`}>{badge.label}</span>
        </div>

        {/* Nav items */}
        <nav className="sidebar-nav">
          <div className="nav-section-label">Navigation</div>
          {items.map(item => (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => { setActiveTab(item.id); setIsOpen(false); }}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
              {item.badge && pendingCount > 0 && (
                <span className="nav-badge">{pendingCount}</span>
              )}
            </button>
          ))}
        </nav>

        {/* User card */}
        <div className="sidebar-footer">
          <div className="user-card">
            <div className="user-avatar">{user?.avatar || '👤'}</div>
            <div className="user-info">
              <div className="user-name">{user?.name || 'User'}</div>
              <div className="user-role">{user?.zone || role}</div>
            </div>
            <button
              id="logout-btn"
              className="logout-btn"
              onClick={handleLogout}
              title="Logout"
            >⏏️</button>
          </div>
        </div>
      </aside>
    </>
  );
}
