// ============================================================
// BinMap v2 – Leaflet map component
//   • Colored bin markers (red=full, green=empty)
//   • Draggable worker markers
//   • Multiple workers shown simultaneously
//   • Request markers (yellow)
//   • Admin "add bin" click mode
//   • Route polyline
// ============================================================
import React, { useEffect, useCallback, useState } from 'react';
import {
  MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import toast from 'react-hot-toast';
import api from '../services/api';

const COLLECTION_RADIUS_METERS = 10;

function hasValidCoords(lat, lng) {
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
}

function getSafeLabel(value, fallback = 'Bin') {
  const label = typeof value === 'string' ? value : '';
  const parts = label.split('–');
  return parts[1]?.trim() || label || fallback;
}

function toRad(v) {
  return (v * Math.PI) / 180;
}

function distanceMeters(aLat, aLng, bLat, bLng) {
  const R = 6371000;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// Fix default icon path (Vite bundling issue)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ── Icon factories ───────────────────────────────────────

function binIcon(status, routeIdx) {
  const color = status === 'full' ? '#ef4444' : '#22c55e';
  const label = routeIdx != null
    ? `<text x="14" y="15" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="9" font-weight="bold">${routeIdx}</text>`
    : `<text x="14" y="15" text-anchor="middle" font-size="9">🗑</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="38" viewBox="0 0 28 38">
    <path d="M14 1C7.4 1 2 6.4 2 13c0 9 12 24 12 24s12-15 12-24c0-6.6-5.4-12-12-12z"
          fill="${color}" stroke="white" stroke-width="1.5" opacity="0.95"/>
    <circle cx="14" cy="13" r="7" fill="rgba(255,255,255,0.85)"/>
    ${label}
  </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [28, 38], iconAnchor: [14, 38], popupAnchor: [0, -40] });
}

function workerIcon(avatar = '👷', isActive = false) {
  const border = isActive ? '#3b82f6' : '#6b7280';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
    <circle cx="20" cy="20" r="18" fill="${border}" stroke="white" stroke-width="2"/>
    <circle cx="20" cy="20" r="12" fill="rgba(255,255,255,0.15)"/>
    <text x="20" y="26" text-anchor="middle" font-size="15">${avatar}</text>
  </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -22] });
}

function requestIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40">
    <path d="M15 1C8 1 2 7 2 14c0 10 13 26 13 26s13-16 13-26c0-7-6-13-13-13z"
          fill="#f59e0b" stroke="white" stroke-width="1.5"/>
    <circle cx="15" cy="14" r="8" fill="rgba(255,255,255,0.85)"/>
    <text x="15" y="19" text-anchor="middle" font-size="11">⚠</text>
  </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [30, 40], iconAnchor: [15, 40], popupAnchor: [0, -42] });
}

function addBinCursorIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40">
    <path d="M15 1C8 1 2 7 2 14c0 10 13 26 13 26s13-16 13-26c0-7-6-13-13-13z"
          fill="#8b5cf6" stroke="white" stroke-width="1.5"/>
    <circle cx="15" cy="14" r="8" fill="rgba(255,255,255,0.85)"/>
    <text x="15" y="19" text-anchor="middle" font-size="14">+</text>
  </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [30, 40], iconAnchor: [15, 40] });
}

// ── Map click handler (admin add-bin mode) ───────────────
function MapClickHandler({ addBinMode, onMapClick }) {
  useMapEvents({
    click(e) {
      if (addBinMode) onMapClick(e.latlng);
    },
  });
  return null;
}

// ── Main BinMap Component ────────────────────────────────
export default function BinMap({
  bins,
  setBins,
  workers = [],         // [{ id, name, avatar, location }]
  activeWorkerId,       // current user's worker id (for draggable)
  onWorkerMove,         // (lat, lng) called when dragged
  requests = [],        // pickup requests with lat/lng
  route = [],
  showRoute = false,
  role = 'public',
  addBinMode = false,   // admin: click to add
  onAddBin,             // (latlng) callback
  mapCenter,            // [lat, lng] override
}) {
  const CENTER = mapCenter || [10.8700, 78.6950]; // midpoint Thillai + Samayapuram
  const [collectingId, setCollectingId] = useState(null);

  const binsWithCoords = bins.filter((bin) => hasValidCoords(bin.lat, bin.lng));
  const workersWithCoords = workers.filter((worker) => hasValidCoords(worker?.location?.lat, worker?.location?.lng));
  const requestsWithCoords = requests.filter((req) => hasValidCoords(req.lat, req.lng));

  // Route polyline
  const activeWorker = workersWithCoords.find((w) => w.id === activeWorkerId);
  const routeCoords = showRoute && route.length && activeWorker
    ? [
        [activeWorker.location.lat, activeWorker.location.lng],
        ...route.map(b => [b.lat, b.lng]),
      ]
    : [];

  const handleCollect = async (bin) => {
    if (bin.status !== 'full') return toast('Already empty!', { icon: '✅' });

    const myWorker = workersWithCoords.find((w) => w.id === activeWorkerId);
    if (!myWorker) {
      toast.error('Worker live location unavailable.');
      return;
    }

    const meters = distanceMeters(
      Number(myWorker.location.lat),
      Number(myWorker.location.lng),
      Number(bin.lat),
      Number(bin.lng)
    );
    if (meters > COLLECTION_RADIUS_METERS) {
      toast.error('Move closer to the bin to collect.');
      return;
    }

    setCollectingId(bin.id);
    try {
      const res = await api.post(`/bins/${bin.id}/collect`);
      setBins(prev => prev.map(b => b.id === bin.id ? {
        ...res.data.bin,
        fillPercent: typeof res.data.bin.fill_level === 'number' ? res.data.bin.fill_level : 0,
      } : b));
      toast.success(`✅ ${getSafeLabel(bin.label)} collected!`);
    } catch { toast.error('Failed to collect bin.'); }
    finally { setCollectingId(null); }
  };

  return (
    <MapContainer
      center={CENTER}
      zoom={14}
      style={{ height: '100%', width: '100%' }}
      cursor={addBinMode ? 'crosshair' : ''}
    >
      <TileLayer
        attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Map click for add-bin mode */}
      <MapClickHandler addBinMode={addBinMode} onMapClick={onAddBin} />

      {/* Route polyline */}
      {routeCoords.length > 1 && (
        <Polyline positions={routeCoords} color="#3b82f6" weight={3} opacity={0.85} dashArray="8 4" />
      )}

      {/* Worker markers */}
      {workersWithCoords.map(worker => {
        const isMe = worker.id === activeWorkerId;
        const workerLat = Number(worker?.location?.lat);
        const workerLng = Number(worker?.location?.lng);
        return (
          <Marker
            key={worker.id}
            position={[workerLat, workerLng]}
            icon={workerIcon(worker.avatar, isMe)}
            draggable={isMe && (role === 'worker')}
            eventHandlers={isMe && role === 'worker' ? {
              dragend: (e) => {
                const { lat, lng } = e.target.getLatLng();
                onWorkerMove?.(lat, lng);
              },
            } : {}}
          >
            <Popup>
              <div className="bin-popup">
                <div className="bin-popup-header">{worker.avatar} {worker.name}</div>
                <div className="bin-popup-row">
                  <span>Zone</span>
                  <span style={{ color: 'var(--blue)' }}>{worker.zone || 'On duty'}</span>
                </div>
                <div className="bin-popup-row">
                  <span>Position</span>
                  <span style={{ fontSize: 10 }}>
                    {workerLat.toFixed(4)}, {workerLng.toFixed(4)}
                  </span>
                </div>
                {isMe && <p style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>Drag to move your location</p>}
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* Bin markers */}
      {binsWithCoords.map(bin => {
        const routeIdx = route.findIndex(r => r.id === bin.id);
        const inRoute  = showRoute && routeIdx !== -1;
        const myWorker = workersWithCoords.find((w) => w.id === activeWorkerId);
        const inRangeMeters = myWorker
          ? distanceMeters(
              Number(myWorker.location.lat),
              Number(myWorker.location.lng),
              Number(bin.lat),
              Number(bin.lng)
            )
          : null;
        const canCollectByDistance = inRangeMeters != null && inRangeMeters <= COLLECTION_RADIUS_METERS;
        const canCollect = role === 'worker' && canCollectByDistance && bin.status === 'full';
        return (
          <Marker
            key={bin.id}
            position={[bin.lat, bin.lng]}
            icon={binIcon(bin.status, inRoute ? routeIdx + 1 : null)}
          >
            <Popup>
              <div className="bin-popup">
                <div className="bin-popup-header">{getSafeLabel(bin.label)}</div>

                {/* Fill bar */}
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 3 }}>
                  Fill: {bin.fillPercent}%
                </div>
                <div className="fill-bar">
                  <div
                    className={`fill-bar-inner ${bin.status}`}
                    style={{ width: `${bin.fillPercent}%` }}
                  />
                </div>

                <div className="bin-popup-row">
                  <span>Status</span>
                  <span className={`status-badge ${bin.status === 'full' ? 'status-full' : 'status-empty'}`}>
                    {bin.status === 'full' ? '🔴 Full' : '🟢 Empty'}
                  </span>
                </div>

                {role === 'worker' && inRangeMeters != null && (
                  <div className="bin-popup-row">
                    <span>Distance</span>
                    <span style={{ color: canCollectByDistance ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                      {Math.round(inRangeMeters)} m
                    </span>
                  </div>
                )}
                {bin.zone && (
                  <div className="bin-popup-row">
                    <span>Zone</span><span>{bin.zone}</span>
                  </div>
                )}
                {bin.lastCollected && (
                  <div className="bin-popup-row">
                    <span>Last collected</span>
                    <span style={{ fontSize: 10 }}>{new Date(bin.lastCollected).toLocaleTimeString()}</span>
                  </div>
                )}

                {role === 'worker' && (
                  <button
                    id={`collect-${bin.id}`}
                    className="btn btn-success btn-sm"
                    style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
                    onClick={() => handleCollect(bin)}
                    disabled={!canCollect || collectingId === bin.id}
                    title={!canCollectByDistance && bin.status === 'full' ? 'Move closer to the bin to collect.' : ''}
                  >
                    {collectingId === bin.id
                      ? '⏳ Collecting...'
                      : !canCollectByDistance && bin.status === 'full'
                        ? '📍 Move Closer'
                        : bin.status === 'full'
                          ? '✅ Mark Collected'
                          : '✔ Already Empty'}
                  </button>
                )}

                {role === 'admin' && (
                  <button
                    id={`delete-bin-${bin.id}`}
                    className="btn btn-danger btn-xs"
                    style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
                    onClick={async () => {
                      if (!confirm(`Delete ${getSafeLabel(bin.label)}?`)) return;
                      try {
                        await api.delete(`/bins/${bin.id}`);
                        setBins(prev => prev.filter(b => b.id !== bin.id));
                        toast.success('Bin removed.');
                      } catch { toast.error('Failed to remove bin.'); }
                    }}
                  >
                    🗑 Remove Bin
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* Request markers */}
      {requestsWithCoords.map(req => (
        <Marker key={req.id} position={[req.lat, req.lng]} icon={requestIcon()}>
          <Popup>
            <div className="bin-popup">
              <div className="bin-popup-header">⚠️ Pickup Request</div>
              <div className="bin-popup-row"><span>From</span><span>{req.name}</span></div>
              <div className="bin-popup-row">
                <span>Status</span>
                <span className={`status-badge ${req.status === 'pending' ? 'status-pending' : 'status-done'}`}>
                  {req.status}
                </span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
                {req.description}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
