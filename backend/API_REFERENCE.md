# Smart Waste Backend (Supabase)

## Setup

1. Create a Supabase project.
2. Run SQL from db/schema.sql in Supabase SQL Editor.
3. Run SQL from db/seed.sql in Supabase SQL Editor.
4. Create backend .env from .env.example.
5. Install dependencies: npm install
6. Start API: npm start

## Authentication

- POST /api/auth/register
  - body: { name, email, password, phone? }
- POST /api/auth/login
  - body: { email, password }
- GET /api/auth/me
  - auth: Bearer JWT
- GET /api/profile
  - auth: Bearer JWT
  - returns: { id, name, email, phone, role, profile_image, assigned_zones? }
- PUT /api/profile
  - auth: Bearer JWT
  - body: { name?, email?, phone?, profile_image? }

## Admin Endpoints

- GET /api/admin/workers
- POST /api/admin/workers
  - body: { name, email, password, phone? }
- GET /api/admin/zones
- POST /api/admin/zones
  - body: { name, centerLat, centerLng, radiusKm? }
- POST /api/admin/zones/assign
  - body: { workerId, zoneId }
- PUT /api/admin/zones/assignments
  - body: { workerId, zoneIds: [] }
- POST /api/admin/bins
  - body: { zone_id, location?, lat?, lng?, label? }
- DELETE /api/admin/bins/:id

## Worker Endpoints

- PATCH /api/workers/me/status
  - body: { status: "active" | "inactive" }
- PATCH /api/workers/me/location
  - body: { lat, lng }
- GET /api/workers/me/requests
- PATCH /api/workers/requests/:id/accept
- PATCH /api/workers/requests/:id/complete

## Bin Endpoints

- GET /api/bins
  - workers see only assigned-zone bins
- GET /api/bins/nearby?lat=..&lng=..&radiusKm=6
- POST /api/bins
  - auth: admin only
  - body: { zone_id, location?, lat?, lng?, label? }
- POST /api/bins/:id/collect
  - auth: worker only
  - only succeeds when worker is within 10 meters of bin GPS location
  - if too far: { message: "Move closer to the bin to collect." }
- PATCH /api/bins/:id/status
  - body: { status, fillLevel }

## Request Endpoints

- POST /api/requests
  - body: {
      type: "garbage_collection" | "new_bin_placement",
      locationLat,
      locationLng,
      address?,
      description?
    }
  - works for public users and authenticated users
- GET /api/requests
  - admin: all
  - worker: pending + accepted by worker
  - public: own requests
- PATCH /api/requests/:id/complete
  - admin completion endpoint

## Analytics Endpoints (Admin)

- GET /api/analytics/workers/performance
- GET /api/analytics/bins/usage
- GET /api/analytics/requests/stats

## Real-time WebSocket Messages

- BIN_ADDED
- BIN_REMOVED
- BIN_UPDATED
- WORKER_MOVED
- WORKER_UPDATED
- REQUEST_ADDED
- REQUEST_UPDATED
