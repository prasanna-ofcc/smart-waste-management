// ============================================================
// Public Page – Submit garbage pickup requests
// ============================================================
import React, { useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

// Fix Leaflet default icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function MapClickCapture({ onMapClick }) {
  const map = useMap();
  React.useEffect(() => {
    map.on('click', (e) => onMapClick(e.latlng));
    return () => map.off('click');
  }, [map, onMapClick]);
  return null;
}

const CENTER = [10.8245, 78.6880];

export default function PublicPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    phone: '',
    description: '',
    address: '',
  });
  const [clickedLatLng, setClickedLatLng] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleMapClick = useCallback((latlng) => {
    setClickedLatLng(latlng);
    setForm(f => ({ ...f, address: `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}` }));
    toast('📍 Location selected!', { duration: 2000 });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.description) {
      toast.error('Please describe the issue.');
      return;
    }
    if (!form.address && !clickedLatLng) {
      toast.error('Please specify a location (type address or click on the map).');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/requests', {
        ...form,
        lat: clickedLatLng?.lat,
        lng: clickedLatLng?.lng,
      });
      toast.success('✅ Request submitted! The municipal team will respond shortly.');
      setSubmitted(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="login-page" style={{ flexDirection: 'column', gap: 0 }}>
        <div className="login-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 60, marginBottom: 16 }}>🎉</div>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans'", fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
            Request Submitted!
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
            Thank you! The Tiruchirappalli Municipal Corporation will review your request.
          </p>
          <button
            id="submit-another-btn"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: 12 }}
            onClick={() => { setSubmitted(false); setForm({ name:'', phone:'', description:'', address:'' }); setClickedLatLng(null); }}
          >
            ➕ Submit Another Request
          </button>
          <button
            id="go-login-btn"
            className="btn btn-ghost"
            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
            onClick={() => navigate('/login')}
          >
            🔐 Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      {/* Top nav */}
      <div className="top-bar" style={{ flexShrink: 0 }}>
        <div style={{ fontSize: 22 }}>🗑️</div>
        <span className="top-bar-title">Smart Waste – Report an Issue</span>
        <button
          id="goto-login"
          className="btn btn-ghost btn-sm"
          style={{ marginLeft: 'auto' }}
          onClick={() => navigate('/login')}
        >
          🔐 Staff Login
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '380px 1fr', overflow: 'hidden' }}>
        {/* Form panel */}
        <div style={{
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border)',
          padding: 24,
          overflowY: 'auto',
        }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans'", fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
              🚮 Request Garbage Pickup
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Click on the map to pin your location, then fill in the form below.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Your Name (optional)</label>
              <input
                id="req-name"
                type="text"
                className="form-input"
                placeholder="e.g. Priya Rajan"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number (optional)</label>
              <input
                id="req-phone"
                type="tel"
                className="form-input"
                placeholder="e.g. 98765 43210"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Location / Address *</label>
              <input
                id="req-address"
                type="text"
                className="form-input"
                placeholder="Or click on the map →"
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              />
              {clickedLatLng && (
                <p style={{ fontSize: 11, color: 'var(--green)', marginTop: 4 }}>
                  ✅ Map location pinned: {clickedLatLng.lat.toFixed(5)}, {clickedLatLng.lng.toFixed(5)}
                </p>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Describe the Issue *</label>
              <textarea
                id="req-description"
                className="form-textarea"
                placeholder="e.g. Overflowing bin near the bus stop on 8th cross street..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                required
              />
            </div>

            <button
              id="submit-request-btn"
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: 12 }}
              disabled={submitting}
            >
              {submitting
                ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Submitting...</>
                : '📤 Submit Request'}
            </button>
          </form>

          {/* Info box */}
          <div style={{
            marginTop: 20,
            padding: 12,
            background: 'rgba(34,197,94,0.06)',
            border: '1px solid rgba(34,197,94,0.15)',
            borderRadius: 8,
          }}>
            <p style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.7 }}>
              💡 Your request is reviewed by the <strong>Tiruchirappalli Municipal Corporation</strong>.
              Average response time: <strong>2–4 hours</strong>.
            </p>
          </div>
        </div>

        {/* Map panel */}
        <div style={{ position: 'relative' }}>
          <MapContainer center={CENTER} zoom={15} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='© OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickCapture onMapClick={handleMapClick} />
            {clickedLatLng && (
              <Marker position={[clickedLatLng.lat, clickedLatLng.lng]} />
            )}
          </MapContainer>

          {/* Map hint */}
          <div style={{
            position: 'absolute',
            top: 16, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.7)',
            color: '#fff',
            fontSize: 12,
            padding: '6px 16px',
            borderRadius: 99,
            zIndex: 1000,
            pointerEvents: 'none',
          }}>
            👆 Click map to select pickup location
          </div>
        </div>
      </div>
    </div>
  );
}
