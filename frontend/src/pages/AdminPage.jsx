// ============================================================
// Admin Page v2
//   • Add bins by clicking the map
//   • Filter full bins / pending requests
//   • Live worker positions
//   • Analytics charts, events log
// ============================================================
import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import api from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';
import BinMap from '../components/BinMap';
import Sidebar from '../components/Sidebar';

const PIE_COLORS = ['#ef4444', '#22c55e'];

function StatCard({ icon, value, label, color = 'blue' }) {
  return (
    <div className={`stat-card ${color}`}>
      <div className={`stat-icon ${color}`}>{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.fill || p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
}

export default function AdminPage() {
  const [activeTab,   setActiveTab]   = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bins,        setBins]        = useState([]);
  const [workers,     setWorkers]     = useState([]);
  const [requests,    setRequests]    = useState([]);
  const [events,      setEvents]      = useState([]);
  const [stats,       setStats]       = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [addBinMode,  setAddBinMode]  = useState(false);
  const [binFilter,   setBinFilter]   = useState('all');   // 'all' | 'full' | 'empty'
  const [reqFilter,   setReqFilter]   = useState('all');   // 'all' | 'pending'

  // ── Load all data ────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const [bRes, wRes, rRes, eRes, sRes] = await Promise.all([
        api.get('/bins'),
        api.get('/admin/workers'),
        api.get('/requests'),
        api.get('/admin/events'),
        api.get('/admin/stats'),
      ]);

      const normalizedBins = bRes.data.map((b) => ({
        ...b,
        fillPercent: typeof b.fill_level === 'number' ? b.fill_level : b.fillPercent || 0,
      }));

      const normalizedWorkers = wRes.data.map((w) => ({
        ...w,
        avatar: (w.name || '?').slice(0, 1).toUpperCase(),
        zone: w.zone || 'Unassigned',
        location: {
          lat: w.location_lat,
          lng: w.location_lng,
        },
      }));

      const normalizedRequests = rRes.data.map((r) => ({
        ...r,
        name: r.name || 'Public User',
        createdAt: r.created_at,
      }));

      setBins(normalizedBins);
      setWorkers(normalizedWorkers);
      setRequests(normalizedRequests);
      setEvents(eRes.data);
      setStats(sRes.data);
    } catch { toast.error('Failed to load admin data.'); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── WebSocket ────────────────────────────────────────
  const handleWs = useCallback((msg) => {
    switch (msg.type) {
      case 'BIN_UPDATED':
        setBins(prev => prev.map(b => b.id === msg.bin.id ? msg.bin : b));
        api.get('/admin/stats').then(r => setStats(r.data)).catch(() => {});
        break;
      case 'BIN_ADDED':
        setBins(prev => [...prev, msg.bin]);
        api.get('/admin/stats').then(r => setStats(r.data)).catch(() => {});
        break;
      case 'BIN_REMOVED':
        setBins(prev => prev.filter(b => b.id !== msg.binId));
        api.get('/admin/stats').then(r => setStats(r.data)).catch(() => {});
        break;
      case 'WORKER_MOVED':
        setWorkers(prev => prev.map(w => w.id === msg.worker.id ? { ...w, location: msg.worker.location } : w));
        break;
      case 'REQUEST_ADDED':
        setRequests(prev => [msg.request, ...prev]);
        toast(`📬 New Request: ${msg.request.description.slice(0, 40)}...`, { duration: 5000 });
        api.get('/admin/stats').then(r => setStats(r.data)).catch(() => {});
        break;
      case 'REQUEST_UPDATED':
        setRequests(prev => prev.map(r => r.id === msg.request.id ? msg.request : r));
        break;
    }
  }, []);
  useWebSocket(handleWs);

  // ── Add bin on map click ─────────────────────────────
  const handleAddBin = async (latlng) => {
    const label = prompt(`Bin label (enter or leave blank for auto):`) || '';
    try {
      const res = await api.post('/bins', {
        lat:   latlng.lat,
        lng:   latlng.lng,
        label: label || undefined,
      });
      setBins(prev => [...prev, {
        ...res.data,
        fillPercent: typeof res.data.fill_level === 'number' ? res.data.fill_level : 0,
      }]);
      toast.success(`✅ Bin added at (${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)})`);
      setAddBinMode(false);
    } catch { toast.error('Failed to add bin.'); }
  };

  // ── Request actions ───────────────────────────────────
  const updateRequest = async (id, status) => {
    try {
      if (status === 'completed') {
        await api.patch(`/requests/${id}/complete`);
      }
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
      toast.success(`Request marked as ${status}.`);
    } catch { toast.error('Update failed.'); }
  };

  // ── Filtered data ─────────────────────────────────────
  const visibleBins = bins.filter(b => {
    if (binFilter === 'full')  return b.status === 'full';
    if (binFilter === 'empty') return b.status === 'empty';
    return true;
  });

  const visibleReqs = requests.filter(r => {
    if (reqFilter === 'pending') return r.status === 'pending';
    return true;
  });

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  // ── Chart data ────────────────────────────────────────
  const barData = bins.slice(0, 12).map(b => ({
    name: b.id.replace('bin-', '#').split('-')[0],
    fill: b.fillPercent,
  }));
  const pieData = stats ? [
    { name: 'Full',  value: stats.fullBins  },
    { name: 'Empty', value: stats.emptyBins },
  ] : [];

  if (loading) return (
    <div className="app-shell">
      <div className="flex-center" style={{ flex: 1 }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          <p className="text-muted">Loading admin panel...</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="app-shell">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        pendingCount={pendingCount}
      />

      <div className="main-content">
        {/* Top bar */}
        <div className="top-bar">
          <button className="mobile-toggle" onClick={() => setSidebarOpen(o => !o)}>☰</button>
          <span className="top-bar-title">
            {{ dashboard:'📊 Dashboard', map:'🗺️ Live Map', workers:'👷 Workers', requests:'📬 Requests', analytics:'📈 Analytics' }[activeTab]}
          </span>
          <div className="status-dot" />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Live</span>
          <button id="refresh-btn" className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={fetchAll}>
            🔄 Refresh
          </button>
        </div>

        {/* ════ DASHBOARD ════ */}
        {activeTab === 'dashboard' && (
          <div className="page-container">
            <div className="content-grid">
              <div className="stats-grid">
                <StatCard icon="🗑️" value={stats?.totalBins}      label="Total Bins"         color="blue"   />
                <StatCard icon="🔴" value={stats?.fullBins}       label="Full Bins"           color="red"    />
                <StatCard icon="🟢" value={stats?.emptyBins}      label="Empty Bins"          color="green"  />
                <StatCard icon="✅" value={stats?.totalCollected}  label="Total Collections"   color="cyan"   />
                <StatCard icon="📬" value={stats?.pendingRequests} label="Pending Requests"    color="amber"  />
                <StatCard icon="👷" value={stats?.workers}         label="Active Workers"      color="purple" />
              </div>

              {/* Recent events */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">📋 Recent Collections</span>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{events.length} total</span>
                </div>
                {events.length === 0 ? (
                  <p style={{ padding: '16px 20px', color: 'var(--text-dim)', fontSize: 13 }}>No collections yet.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead><tr><th>Bin</th><th>Worker</th><th>Time</th></tr></thead>
                      <tbody>
                        {events.slice(0, 8).map(ev => (
                          <tr key={ev.id}>
                            <td style={{ color: 'var(--text-primary)' }}>{ev.binLabel}</td>
                            <td>{ev.workerId}</td>
                            <td>{new Date(ev.timestamp).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ════ MAP ════ */}
        {activeTab === 'map' && (
          <div style={{ flex: 1, height: 'calc(100vh - 60px)', position: 'relative' }}>
            <BinMap
              bins={visibleBins}
              setBins={setBins}
              workers={workers}
              requests={requests.filter(r => r.lat)}
              role="admin"
              addBinMode={addBinMode}
              onAddBin={handleAddBin}
              mapCenter={[10.8700, 78.6950]}
            />

            {/* Map controls overlay */}
            <div className="map-overlay-panel map-top-right">
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: 1 }}>
                ⚙️ MAP CONTROLS
              </p>

              {/* Add bin toggle */}
              <button
                id="add-bin-toggle"
                className={`btn btn-sm ${addBinMode ? 'btn-danger' : 'btn-primary'}`}
                style={{ width: '100%', justifyContent: 'center', marginBottom: 6 }}
                onClick={() => { setAddBinMode(m => !m); toast(addBinMode ? 'Add-bin mode OFF' : '🟣 Click map to place a new bin!', { duration: 3000 }); }}
              >
                {addBinMode ? '✕ Cancel Add Bin' : '➕ Add Bin Mode'}
              </button>

              {addBinMode && (
                <p style={{ fontSize: 10, color: 'var(--amber)', textAlign: 'center', marginBottom: 8 }}>
                  🟣 Click anywhere on the map to add a bin
                </p>
              )}

              {/* Bin filter */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>FILTER BINS</p>
                {['all', 'full', 'empty'].map(f => (
                  <button
                    key={f}
                    id={`filter-${f}`}
                    className={`btn btn-xs ${binFilter === f ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ marginRight: 4, marginBottom: 4 }}
                    onClick={() => setBinFilter(f)}
                  >
                    {f === 'all' ? '🗑️ All' : f === 'full' ? '🔴 Full' : '🟢 Empty'}
                  </button>
                ))}
              </div>

              {/* Workers list */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 8 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>WORKERS</p>
                {workers.map(w => (
                  <div key={w.id} style={{ fontSize: 11, marginBottom: 5 }}>
                    <span>{w.avatar} </span>
                    <strong style={{ color: 'var(--text-primary)' }}>{w.name}</strong>
                    <span style={{ color: 'var(--text-dim)', fontSize: 10, marginLeft: 4 }}>{w.zone}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats overlay */}
            <div className="map-overlay-panel map-bottom-left">
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                📊 OVERVIEW
              </p>
              <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                <span style={{ color: 'var(--red)', fontWeight: 600 }}>🔴 {stats?.fullBins} Full</span>
                <span style={{ color: 'var(--green)', fontWeight: 600 }}>🟢 {stats?.emptyBins} Empty</span>
              </div>
              <div style={{ color: 'var(--amber)', fontSize: 11, marginTop: 4 }}>
                📬 {pendingCount} pending requests
              </div>
            </div>
          </div>
        )}

        {/* ════ WORKERS ════ */}
        {activeTab === 'workers' && (
          <div className="page-container">
            <div className="content-grid">
              <div className="card">
                <div className="card-header">
                  <span className="card-title">👷 Active Workers</span>
                  <span className="status-badge status-empty">{workers.length} Online</span>
                </div>
                <table className="data-table">
                  <thead>
                    <tr><th>Name</th><th>Zone</th><th>Latitude</th><th>Longitude</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {workers.map(w => (
                      <tr key={w.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="user-avatar">{w.avatar}</div>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{w.name}</span>
                          </div>
                        </td>
                        <td>{w.zone}</td>
                        <td style={{ fontSize: 11, fontFamily: 'monospace' }}>{w.location?.lat?.toFixed(5)}</td>
                        <td style={{ fontSize: 11, fontFamily: 'monospace' }}>{w.location?.lng?.toFixed(5)}</td>
                        <td><span className="status-badge status-empty">● On Duty</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ════ REQUESTS ════ */}
        {activeTab === 'requests' && (
          <div className="page-container">
            <div className="content-grid">
              <div className="card">
                <div className="card-header">
                  <span className="card-title">📬 Public Pickup Requests</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {['all', 'pending'].map(f => (
                      <button
                        key={f}
                        id={`req-filter-${f}`}
                        className={`btn btn-xs ${reqFilter === f ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setReqFilter(f)}
                      >
                        {f === 'all' ? 'All' : `Pending (${pendingCount})`}
                      </button>
                    ))}
                  </div>
                </div>
                {visibleReqs.length === 0 ? (
                  <p style={{ padding: '16px 20px', color: 'var(--text-dim)', fontSize: 13 }}>
                    No requests found.
                  </p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr><th>Name</th><th>Location</th><th>Issue</th><th>Time</th><th>Status</th><th>Actions</th></tr>
                      </thead>
                      <tbody>
                        {visibleReqs.map(req => (
                          <tr key={req.id}>
                            <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{req.name}</td>
                            <td style={{ fontSize: 11 }}>{req.address}</td>
                            <td style={{ maxWidth: 180 }}><span title={req.description}>{req.description.slice(0, 40)}{req.description.length > 40 ? '…' : ''}</span></td>
                            <td style={{ fontSize: 11 }}>{new Date(req.createdAt).toLocaleString()}</td>
                            <td>
                              <span className={`status-badge ${req.status === 'pending' ? 'status-pending' : 'status-done'}`}>
                                {req.status}
                              </span>
                            </td>
                            <td>
                              {req.status === 'pending' && (
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button id={`resolve-${req.id}`} className="btn btn-success btn-xs"
                                    onClick={() => updateRequest(req.id, 'completed')}>✅ Complete</button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ════ ANALYTICS ════ */}
        {activeTab === 'analytics' && (
          <div className="page-container">
            <div className="content-grid">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div className="card">
                  <div className="card-header"><span className="card-title">📊 Bin Fill Levels</span></div>
                  <div className="card-body">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={barData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="fill" name="Fill %" radius={[4, 4, 0, 0]}>
                          {barData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill >= 80 ? '#ef4444' : '#22c55e'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="card">
                  <div className="card-header"><span className="card-title">🥧 Full vs Empty</span></div>
                  <div className="card-body flex-center">
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="45%" outerRadius={75} innerRadius={45}
                          paddingAngle={4} dataKey="value">
                          {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
              {stats && (
                <div className="stats-grid">
                  <StatCard icon="✅" value={stats.totalCollected} label="Total Collections" color="green"  />
                  <StatCard icon="📬" value={stats.totalRequests}  label="Total Requests"    color="amber"  />
                  <StatCard icon="🗑️" value={stats.totalBins}      label="Total Bins"        color="blue"   />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
