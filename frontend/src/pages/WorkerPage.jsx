// ============================================================
// Worker Page v2
//   • Shows both workers on map (self draggable)
//   • Arrow-button movement panel
//   • Route optimizer from live position
//   • Real-time via WebSocket
// ============================================================
import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import BinMap from '../components/BinMap';
import Sidebar from '../components/Sidebar';

// How far each step moves (degrees ≈ 50 m)
const STEP = 0.0005;

function getBinDisplayLabel(bin) {
  const label = typeof bin?.label === 'string' ? bin.label : '';
  const parts = label.split('–');
  return parts[1]?.trim() || label || 'Bin';
}

function getSafeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export default function WorkerPage() {
  const { user } = useAuth();

  const [bins,        setBins]        = useState([]);
  const [workers,     setWorkers]     = useState([]);
  const [myLocation,  setMyLocation]  = useState(user?.location || { lat: 10.8231, lng: 78.6872 });
  const [route,       setRoute]       = useState([]);
  const [showRoute,   setShowRoute]   = useState(false);
  const [optimizing,  setOptimizing]  = useState(false);
  const [activeTab,   setActiveTab]   = useState('map');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loadingBins, setLoadingBins] = useState(true);

  // keep myLocation in a ref so WS callback is always fresh
  const locRef = useRef(myLocation);
  locRef.current = myLocation;

  // ── Load initial data ──────────────────────────────────
  useEffect(() => {
    Promise.all([api.get('/bins'), api.get('/workers')])
      .then(([bRes, wRes]) => {
        const normalizedBins = bRes.data.map((b) => ({
          ...b,
          fillPercent: typeof b.fill_level === 'number' ? b.fill_level : b.fillPercent || 0,
        }));

        const normalizedWorkers = wRes.data.map((w) => ({
          ...w,
          avatar: (w.name || '?').slice(0, 1).toUpperCase(),
          zone: w.zone || 'Assigned Zone',
          location: {
            lat: w.location_lat,
            lng: w.location_lng,
          },
        }));

        setBins(normalizedBins);
        setWorkers(normalizedWorkers);
        // Init own location from server
        const me = normalizedWorkers.find((w) => w.id === user.id);
        if (me?.location?.lat != null && me?.location?.lng != null) {
          setMyLocation(me.location);
        }
      })
      .catch(() => toast.error('Failed to load data.'))
      .finally(() => setLoadingBins(false));
  }, [user.id]);

  // ── WebSocket handler ─────────────────────────────────
  const handleWs = useCallback((msg) => {
    switch (msg.type) {
      case 'BIN_UPDATED':
        setBins(prev => prev.map(b => b.id === msg.bin.id ? msg.bin : b));
        if (msg.bin.status === 'full') toast(`🔴 ${msg.bin.label} is FULL!`, { duration: 4000 });
        break;
      case 'BIN_ADDED':
        setBins(prev => [...prev, msg.bin]);
        toast('📍 New bin added by admin.', { icon: '🗑️' });
        break;
      case 'BIN_REMOVED':
        setBins(prev => prev.filter(b => b.id !== msg.binId));
        break;
      case 'WORKER_MOVED':
        setWorkers(prev => prev.map(w => w.id === msg.worker.id ? { ...w, location: msg.worker.location } : w));
        break;
      case 'REQUEST_ADDED':
        toast(`📬 New public request near ${msg.request.address}`, { duration: 5000 });
        break;
    }
  }, []);
  useWebSocket(handleWs);

  // ── Push location to server ───────────────────────────
  const pushLocation = useCallback(async (lat, lng) => {
    setMyLocation({ lat, lng });
    setWorkers(prev => prev.map(w => w.id === user.id ? { ...w, location: { lat, lng } } : w));
    try {
      await api.patch('/workers/me/location', { lat, lng });
    } catch {
      toast.error('Location sync failed.');
    }
  }, [user.id]);

  // ── Arrow key movement ────────────────────────────────
  const move = useCallback((dir) => {
    const { lat, lng } = locRef.current;
    const moves = {
      N: [lat + STEP, lng],
      S: [lat - STEP, lng],
      E: [lat, lng + STEP],
      W: [lat, lng - STEP],
    };
    const [nLat, nLng] = moves[dir];
    pushLocation(nLat, nLng);
  }, [pushLocation]);

  // ── Route optimizer ───────────────────────────────────
  const optimizeRoute = async () => {
    setOptimizing(true);
    try {
      const { lat, lng } = locRef.current;
      const res = await api.get('/bins/route/optimize', {
        params: { workerLat: lat, workerLng: lng },
      });
      if (!res.data.route?.length) {
        toast('🎉 All bins are empty!', { icon: '✅' });
        setRoute([]); setShowRoute(false);
        return;
      }
      setRoute(res.data.route);
      setShowRoute(true);
      setActiveTab('map');
      toast.success(`🧭 Route: ${res.data.totalBins} full bins optimized.`);
    } catch { toast.error('Route optimization failed.'); }
    finally { setOptimizing(false); }
  };

  const fullBins  = bins.filter(b => b.status === 'full').length;
  const emptyBins = bins.filter(b => b.status === 'empty').length;

  // Merge live myLocation into workers list
  const workersWithLive = workers.map(w =>
    w.id === user.id ? { ...w, location: myLocation } : w
  );

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
            {activeTab === 'map' ? '🗺️ Live Map' : '🧭 Route Planner'}
          </span>
          <div className="status-dot" />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Live</span>
          <div style={{ display: 'flex', gap: 12, marginLeft: 'auto', fontSize: 12 }}>
            <span style={{ color: 'var(--red)',   fontWeight: 600 }}>🔴 {fullBins} Full</span>
            <span style={{ color: 'var(--green)', fontWeight: 600 }}>🟢 {emptyBins} Empty</span>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {loadingBins ? (
            <div className="flex-center" style={{ height: '100%' }}>
              <div style={{ textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto 12px' }} />
                <p className="text-muted">Loading map...</p>
              </div>
            </div>
          ) : (
            <div style={{ height: '100%', position: 'relative' }}>
              <BinMap
                bins={bins}
                setBins={setBins}
                workers={workersWithLive}
                activeWorkerId={user.id}
                onWorkerMove={pushLocation}
                route={route}
                showRoute={showRoute}
                role="worker"
                mapCenter={[10.8700, 78.6950]}
              />

              {/* ── Overlay: Bin status legend ── */}
              <div className="map-overlay-panel map-top-left" style={{ maxHeight: 320, overflowY: 'auto' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: 1 }}>
                  🗑️ ALL BINS
                </p>
                {bins.map(bin => (
                  <div key={bin.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, marginBottom: 4 }}>
                    <div style={{
                      width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                      background: bin.status === 'full' ? 'var(--red)' : 'var(--green)',
                      boxShadow: bin.status === 'full' ? '0 0 4px var(--red)' : '0 0 4px var(--green)',
                    }} />
                    <span style={{ color: 'var(--text-muted)', flex: 1, lineHeight: 1.3 }}>
                      {bin.id.replace('bin-', '#')} {bin.label.split('–')[1]?.trim() || ''}
                    </span>
                    <span style={{
                      color: bin.status === 'full' ? 'var(--red)' : 'var(--green)',
                      fontWeight: 600, fontSize: 10,
                    }}>{getSafeNumber(bin.fillPercent)}%</span>
                  </div>
                ))}
              </div>

              {/* ── Overlay: Movement Controls ── */}
              <div className="map-overlay-panel map-top-right">
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: 1 }}>
                  🕹️ MOVE LOCATION
                </p>

                {/* D-pad */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 36px)', gap: 4, justifyContent: 'center', marginBottom: 10 }}>
                  {/* Row 1 */}
                  <div />
                  <button id="move-N" className="btn btn-ghost btn-sm"
                    style={{ padding: 6, justifyContent: 'center' }} onClick={() => move('N')}>▲</button>
                  <div />
                  {/* Row 2 */}
                  <button id="move-W" className="btn btn-ghost btn-sm"
                    style={{ padding: 6, justifyContent: 'center' }} onClick={() => move('W')}>◄</button>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: 'rgba(59,130,246,0.15)',
                    border: '1px solid rgba(59,130,246,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14,
                  }}>📍</div>
                  <button id="move-E" className="btn btn-ghost btn-sm"
                    style={{ padding: 6, justifyContent: 'center' }} onClick={() => move('E')}>►</button>
                  {/* Row 3 */}
                  <div />
                  <button id="move-S" className="btn btn-ghost btn-sm"
                    style={{ padding: 6, justifyContent: 'center' }} onClick={() => move('S')}>▼</button>
                  <div />
                </div>

                <p style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', marginBottom: 10 }}>
                  or drag 👷 on map
                </p>
                <p style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center' }}>
                  📍 {getSafeNumber(myLocation.lat).toFixed(4)}, {getSafeNumber(myLocation.lng).toFixed(4)}
                </p>

                <div style={{ borderTop: '1px solid var(--border)', marginTop: 10, paddingTop: 10 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: 1 }}>
                    🧭 ROUTE PLANNER
                  </p>
                  <button
                    id="optimize-btn"
                    className="btn btn-primary btn-sm"
                    style={{ width: '100%', justifyContent: 'center', marginBottom: 4 }}
                    onClick={optimizeRoute}
                    disabled={optimizing}
                  >
                    {optimizing ? '⏳ Calculating...' : '⚡ Optimize Route'}
                  </button>
                  {showRoute && (
                    <button
                      id="clear-route-btn"
                      className="btn btn-ghost btn-sm"
                      style={{ width: '100%', justifyContent: 'center' }}
                      onClick={() => { setRoute([]); setShowRoute(false); }}
                    >🗑️ Clear Route</button>
                  )}
                </div>

                {/* Route list */}
                {showRoute && route.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <p style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>VISIT ORDER</p>
                    {route.map((bin, idx) => (
                      <div key={bin.id} className="route-stop">
                        <div className="route-num">{idx + 1}</div>
                        <div>
                          <div className="route-stop-label">
                            {getBinDisplayLabel(bin)}
                          </div>
                          <div className="route-stop-dist">{bin.distanceFromPrev} km away</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Overlay: Other workers ── */}
              <div className="map-overlay-panel map-bottom-left">
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: 1 }}>
                  👷 WORKERS
                </p>
                {workersWithLive.map(w => (
                  <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, fontSize: 11 }}>
                    <span>{w.avatar}</span>
                    <div>
                      <div style={{ color: w.id === user.id ? 'var(--blue)' : 'var(--text-muted)', fontWeight: 600 }}>
                        {w.name} {w.id === user.id ? '(you)' : ''}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{w.zone}</div>
                    </div>
                    <span className="status-badge status-empty" style={{ marginLeft: 'auto', fontSize: 9 }}>● Active</span>
                  </div>
                ))}
              </div>

              {/* ── Overlay: IoT hint ── */}
              <div className="map-overlay-panel map-bottom-right" style={{ fontSize: 11 }}>
                <p style={{ fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>⏱️ IoT SIMULATION</p>
                <p style={{ color: 'var(--text-dim)', lineHeight: 1.6 }}>
                  Bins turn 🔴 FULL<br />20 min after collection
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
