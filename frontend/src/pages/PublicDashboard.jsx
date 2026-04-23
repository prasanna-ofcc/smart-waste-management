// ============================================================
// Public Dashboard – authenticated public user
//   • View nearby bins (within 2 km)
//   • Submit pickup requests (with map pin)
//   • View own request history
// ============================================================
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import Sidebar from '../components/Sidebar';

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const RADIUS_KM = 2;
const CENTER    = [10.8245, 78.6880]; // Thillai Nagar

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371, r = Math.PI / 180;
  const dL = (lat2 - lat1) * r, dN = (lon2 - lon1) * r;
  const a = Math.sin(dL / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dN / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function binIcon(status) {
  const color = status === 'full' ? '#ef4444' : '#22c55e';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="32" viewBox="0 0 24 32">
    <path d="M12 1C7 1 2 5 2 11c0 8 10 20 10 20s10-12 10-20c0-6-5-10-10-10z"
          fill="${color}" stroke="white" stroke-width="1.5"/>
    <circle cx="12" cy="11" r="5" fill="rgba(255,255,255,0.85)"/>
    <text x="12" y="14" text-anchor="middle" font-size="7">🗑</text>
  </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [24, 32], iconAnchor: [12, 32], popupAnchor: [0, -34] });
}

function requestIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="32" viewBox="0 0 24 32">
    <path d="M12 1C7 1 2 5 2 11c0 8 10 20 10 20s10-12 10-20c0-6-5-10-10-10z"
          fill="#f59e0b" stroke="white" stroke-width="1.5"/>
    <circle cx="12" cy="11" r="5" fill="rgba(255,255,255,0.85)"/>
    <text x="12" y="14" text-anchor="middle" font-size="8">⚠</text>
  </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [24, 32], iconAnchor: [12, 32] });
}

function pinIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="32" viewBox="0 0 24 32">
    <path d="M12 1C7 1 2 5 2 11c0 8 10 20 10 20s10-12 10-20c0-6-5-10-10-10z"
          fill="#8b5cf6" stroke="white" stroke-width="1.5"/>
    <circle cx="12" cy="11" r="5" fill="rgba(255,255,255,0.85)"/>
    <text x="12" y="14" text-anchor="middle" font-size="8">📍</text>
  </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [24, 32], iconAnchor: [12, 32] });
}

function MapClickCapture({ onMapClick, active }) {
  useMapEvents({
    click(e) { if (active) onMapClick(e.latlng); },
  });
  return null;
}

export default function PublicDashboard() {
  const { user } = useAuth();
  const [activeTab,   setActiveTab]   = useState('map');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bins,        setBins]        = useState([]);
  const [myRequests,  setMyRequests]  = useState([]);
  const [form, setForm] = useState({ description: '', address: '' });
  const [clickedLatLng, setClickedLatLng] = useState(null);
  const [submitting,  setSubmitting]  = useState(false);
  const [pinMode,     setPinMode]     = useState(false);

  // ── Load data ─────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [bRes, rRes] = await Promise.all([
        api.get('/bins'),
        api.get('/requests/mine'),
      ]);
      setBins(bRes.data);
      setMyRequests(rRes.data);
    } catch { toast.error('Failed to load data.'); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── WebSocket ─────────────────────────────────────────
  const handleWs = useCallback((msg) => {
    if (msg.type === 'BIN_UPDATED') setBins(p => p.map(b => b.id === msg.bin.id ? msg.bin : b));
    if (msg.type === 'BIN_ADDED')   setBins(p => [...p, msg.bin]);
    if (msg.type === 'BIN_REMOVED') setBins(p => p.filter(b => b.id !== msg.binId));
  }, []);
  useWebSocket(handleWs);

  // ── Nearby bins (within RADIUS_KM) ───────────────────
  const userLat = user?.location?.lat || CENTER[0];
  const userLng = user?.location?.lng || CENTER[1];
  const nearbyBins = bins.filter(b => haversine(userLat, userLng, b.lat, b.lng) <= RADIUS_KM);
  const fullNearby = nearbyBins.filter(b => b.status === 'full').length;

  // ── Submit request ────────────────────────────────────
  const submitRequest = async (e) => {
    e.preventDefault();
    if (!form.description) return toast.error('Please describe the issue.');
    if (!form.address && !clickedLatLng) return toast.error('Pin a location on the map or enter address.');
    setSubmitting(true);
    try {
      const res = await api.post('/requests', {
        name:        user.name,
        description: form.description,
        address:     form.address || `${clickedLatLng.lat.toFixed(5)}, ${clickedLatLng.lng.toFixed(5)}`,
        lat:         clickedLatLng?.lat,
        lng:         clickedLatLng?.lng,
        userId:      user.id,
      });
      setMyRequests(p => [res.data.request, ...p]);
      toast.success('✅ Request submitted! Admin has been notified.');
      setForm({ description: '', address: '' });
      setClickedLatLng(null);
      setPinMode(false);
      setActiveTab('myrequests');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed.');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="app-shell">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
      />

      <div className="main-content">
        {/* Top bar */}
        <div className="top-bar">
          <button className="mobile-toggle" onClick={() => setSidebarOpen(o => !o)}>☰</button>
          <span className="top-bar-title">
            {{ map: `🗑️ Nearby Bins (${RADIUS_KM}km)`, request: '📢 Report Issue', myrequests: '📋 My Requests' }[activeTab]}
          </span>
          <div style={{ display: 'flex', gap: 12, marginLeft: 'auto', fontSize: 12 }}>
            <span style={{ color: 'var(--red)', fontWeight: 600 }}>🔴 {fullNearby} Full</span>
            <span style={{ color: 'var(--green)', fontWeight: 600 }}>🟢 {nearbyBins.length - fullNearby} Empty</span>
          </div>
        </div>

        {/* ════ MAP ════ */}
        {activeTab === 'map' && (
          <div style={{ flex: 1, height: 'calc(100vh - 60px)', position: 'relative' }}>
            <MapContainer center={CENTER} zoom={15} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='© OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* 2km radius circle */}
              <Circle
                center={[userLat, userLng]}
                radius={RADIUS_KM * 1000}
                pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.05, weight: 1.5, dashArray: '6 4' }}
              />

              {/* Nearby bins only */}
              {nearbyBins.map(bin => (
                <Marker key={bin.id} position={[bin.lat, bin.lng]} icon={binIcon(bin.status)}>
                  <Popup>
                    <div className="bin-popup">
                      <div className="bin-popup-header">{bin.label}</div>
                      <div className="fill-bar">
                        <div className={`fill-bar-inner ${bin.status}`} style={{ width: `${bin.fillPercent}%` }} />
                      </div>
                      <div className="bin-popup-row">
                        <span>Status</span>
                        <span className={`status-badge ${bin.status === 'full' ? 'status-full' : 'status-empty'}`}>
                          {bin.status === 'full' ? '🔴 Full' : '🟢 Empty'}
                        </span>
                      </div>
                      <div className="bin-popup-row">
                        <span>Distance</span>
                        <span>{(haversine(userLat, userLng, bin.lat, bin.lng) * 1000).toFixed(0)} m</span>
                      </div>
                      {bin.status === 'full' && (
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
                          onClick={() => { setActiveTab('request'); setClickedLatLng({ lat: bin.lat, lng: bin.lng }); setForm(f => ({ ...f, address: bin.label })); }}
                        >
                          📢 Report This Bin
                        </button>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>

            {/* Legend overlay */}
            <div className="map-overlay-panel map-top-right">
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>📊 NEARBY ({RADIUS_KM}km)</p>
              <div style={{ fontSize: 12 }}>
                <div style={{ color: 'var(--red)', marginBottom: 4 }}>🔴 {fullNearby} bins need pickup</div>
                <div style={{ color: 'var(--green)' }}>🟢 {nearbyBins.length - fullNearby} bins ok</div>
              </div>
              <button
                className="btn btn-primary btn-sm"
                style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
                onClick={() => setActiveTab('request')}
              >📢 Report Issue</button>
            </div>
          </div>
        )}

        {/* ════ REPORT ISSUE ════ */}
        {activeTab === 'request' && (
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '380px 1fr', overflow: 'hidden', height: 'calc(100vh - 60px)' }}>
            {/* Form */}
            <div style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)', padding: 24, overflowY: 'auto' }}>
              <h2 style={{ fontFamily: "'Plus Jakarta Sans'", fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
                📢 Report Garbage Issue
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
                Hello {user?.name}! Pin your location on the map, then describe the issue.
              </p>
              <form onSubmit={submitRequest}>
                <div className="form-group">
                  <label className="form-label">Location / Address</label>
                  <input id="req-address" type="text" className="form-input"
                    placeholder="Or click map to pin →"
                    value={form.address}
                    onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                  {clickedLatLng && (
                    <p style={{ fontSize: 11, color: 'var(--green)', marginTop: 4 }}>
                      ✅ Pinned: {clickedLatLng.lat.toFixed(5)}, {clickedLatLng.lng.toFixed(5)}
                    </p>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Describe the Issue *</label>
                  <textarea id="req-desc" className="form-textarea"
                    placeholder="e.g. Overflowing bin near bus stop..."
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    required />
                </div>
                <button
                  id="pin-btn"
                  type="button"
                  className={`btn ${pinMode ? 'btn-danger' : 'btn-ghost'} btn-sm`}
                  style={{ marginBottom: 10, width: '100%', justifyContent: 'center' }}
                  onClick={() => { setPinMode(m => !m); toast(pinMode ? 'Pin mode off' : '📍 Click map to pin location', { duration: 3000 }); }}
                >
                  {pinMode ? '✕ Cancel Pin Mode' : '📍 Pin on Map'}
                </button>
                <button id="submit-req" type="submit" className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: 12 }} disabled={submitting}>
                  {submitting
                    ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Submitting...</>
                    : '📤 Submit Request'}
                </button>
              </form>
            </div>

            {/* Map with pin mode */}
            <div style={{ position: 'relative' }}>
              <MapContainer center={CENTER} zoom={15} style={{ height: '100%', width: '100%' }}>
                <TileLayer attribution='© OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapClickCapture onMapClick={(ll) => { setClickedLatLng(ll); setForm(f => ({ ...f, address: '' })); }} active={pinMode} />
                {clickedLatLng && <Marker position={[clickedLatLng.lat, clickedLatLng.lng]} icon={pinIcon()} />}
                {nearbyBins.map(b => (
                  <Marker key={b.id} position={[b.lat, b.lng]} icon={binIcon(b.status)} />
                ))}
              </MapContainer>
              {pinMode && (
                <div style={{
                  position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
                  background: 'rgba(139,92,246,0.9)', color: '#fff', fontSize: 12,
                  padding: '6px 16px', borderRadius: 99, zIndex: 1000, pointerEvents: 'none',
                }}>
                  👆 Click map to pin pickup location
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════ MY REQUESTS ════ */}
        {activeTab === 'myrequests' && (
          <div className="page-container">
            <div className="content-grid">
              <div className="card">
                <div className="card-header">
                  <span className="card-title">📋 My Requests</span>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{myRequests.length} total</span>
                </div>
                {myRequests.length === 0 ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                    <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 12 }}>
                      No requests submitted yet.
                    </p>
                    <button className="btn btn-primary btn-sm" onClick={() => setActiveTab('request')}>
                      📢 Submit First Request
                    </button>
                  </div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr><th>Location</th><th>Issue</th><th>Submitted</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {myRequests.map(req => (
                        <tr key={req.id}>
                          <td style={{ fontSize: 11 }}>{req.address}</td>
                          <td style={{ maxWidth: 220 }}>{req.description.slice(0, 50)}{req.description.length > 50 ? '…' : ''}</td>
                          <td style={{ fontSize: 11 }}>{new Date(req.createdAt).toLocaleString()}</td>
                          <td>
                            <span className={`status-badge ${req.status === 'pending' ? 'status-pending' : req.status === 'resolved' ? 'status-done' : 'status-full'}`}>
                              {req.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
