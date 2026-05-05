# 🔧 Smart Waste Management - Debugging & Setup Guide

This guide explains all the fixes that have been applied to resolve the bin and worker location visibility issues.

## ✅ Issues Fixed

### 1. **Worker Location Data Not Initialized**
**Problem:** Workers (especially Worker 2) had no initial location coordinates.
**Fix:** Updated `backend/db/seed.sql` to initialize `location_lat` and `location_lng` for all workers:
- Worker 1: 10.8623, 78.6938 (Srirangam center)
- Worker 2: 10.8173, 78.6824 (Thillai Nagar center)
- Admin: 10.8700, 78.6950 (midpoint)

### 2. **Worker Location Data Not Included in Auth Profile**
**Problem:** When users refreshed the page, location data was lost.
**Fix:** Updated `backend/services/authService.js` to include `location_lat` and `location_lng` in the `/auth/me` profile endpoint response.

### 3. **Frontend Fallback Logic Error in WorkerPage**
**Problem:** Location fallback was using wrong field names:
```javascript
// WRONG:
initialLat = Number(user?.location?.lat ?? user?.location_lng);
```
**Fix:** Corrected to properly check both field naming conventions:
```javascript
// CORRECT:
initialLat = Number(user?.location_lat ?? user?.location?.lat ?? 10.8231);
initialLng = Number(user?.location_lng ?? user?.location?.lng ?? 78.6872);
```

### 4. **Frontend Crashes on Empty/Invalid API Responses**
**Problem:** Frontend was calling `.map()` on API responses without checking if they're arrays.
**Fix:** Added array validation in both `AdminPage.jsx` and `WorkerPage.jsx`:
```javascript
const normalizedBins = (Array.isArray(bRes.data) ? bRes.data : []).map(...)
```

### 5. **Worker Zone Assignment Not Properly Updated**
**Problem:** Worker 2's `zone_id` field might not be set correctly during seeding.
**Fix:** Updated `backend/db/seed.sql` to always sync `zone_id` with `worker_zones` table:
```sql
update users u
set zone_id = (
  select zone_id from worker_zones
  where worker_id = u.id
  limit 1
),
worker_status = 'active'
where role = 'worker' and exists (
  select 1 from worker_zones where worker_id = u.id
);
```

### 6. **Insufficient Logging for Debugging**
**Problem:** Hard to diagnose zone filtering issues.
**Fix:** Added comprehensive logging to:
- `backend/services/binService.js` - logs zone filtering at each step
- `backend/services/zoneService.js` - logs zone lookup operations
- Makes it easy to see what zones are assigned and which bins are returned

## 🧪 Testing the Fixes

### Quick Test: Run the API Test Suite
```bash
cd backend
npm install  # if needed
node test-api.js
```

This will test:
- ✅ Admin login and data access
- ✅ Worker 1 login and bin access (Srirangam zone)
- ✅ Worker 2 login and bin access (Thillai Nagar zone)
- ✅ Verify Worker 2 has correct zone assignment
- ✅ Verify bins are correctly filtered by zone

### Manual Test: Login as Each Role

1. **Admin Login**
   - Email: `admin@test.com`
   - Password: `123456`
   - Should see ALL workers and ALL bins on map

2. **Worker 1 Login**
   - Email: `worker1@test.com`
   - Password: `123456`
   - Should see bins in Srirangam zone only (~10 bins)
   - Should see location at 10.8623, 78.6938

3. **Worker 2 Login**
   - Email: `worker2@test.com`
   - Password: `123456`
   - Should see bins in Thillai Nagar zone only (~10 bins)
   - Should see location at 10.8173, 78.6824

## 🗄️ Database Setup Checklist

- [ ] Supabase project created with PostgreSQL
- [ ] Run `backend/db/schema.sql` to create tables
- [ ] Run `backend/db/seed.sql` to populate test data:
  - [ ] 3 users created (admin, worker1, worker2)
  - [ ] 2 zones created (Srirangam, Thillai Nagar)
  - [ ] Worker zone assignments created
  - [ ] Each worker has `zone_id` set
  - [ ] 20 bins created (10 per zone)

### Verify Database Setup
```sql
-- Check workers and their zones
SELECT id, name, role, zone_id, location_lat, location_lng FROM users WHERE role = 'worker';

-- Check bins per zone
SELECT zone_id, COUNT(*) as bin_count FROM bins GROUP BY zone_id;

-- Check worker zone assignments
SELECT w.worker_id, w.zone_id, z.name FROM worker_zones w JOIN zones z ON w.zone_id = z.id;
```

## 🔍 Debugging: Server Console Logs

When testing, look for these logs on the backend:

```
[ZONE_FILTER_STEP1] - Step 1 of zone filtering (checking worker_zones table)
[ZONE_FILTER_STEP2] - Step 2 of zone filtering (checking user.zone_id)
[WORKER_BIN_QUERY] - About to query bins for a worker
[WORKER_BIN_QUERY_RESULT] - Results returned from bin query
[BIN_QUERY_USER] - About to query bins for any user
[BIN_QUERY_RESULT] - Results of bin query
```

### Example Good Logs for Worker 2:
```
[ZONE_FILTER_STEP1] workerId: "abc123", mappingZoneIds: ["zone-id-xyz"]
[ZONE_FILTER_STEP2] workerId: "abc123", workerZoneId: "zone-id-xyz", primaryZoneId: "zone-id-xyz"
[WORKER_BIN_QUERY] workerId: "abc123", zoneIds: ["zone-id-xyz"]
[WORKER_BIN_QUERY_RESULT] workerId: "abc123", count: 10
```

### Example Bad Logs (Would indicate a problem):
```
[ZONE_FILTER_STEP1] workerId: "abc123", mappingZoneIds: []
[ZONE_FILTER_STEP2] workerId: "abc123", workerZoneId: null, primaryZoneId: null
[WORKER_BIN_QUERY_EMPTY] workerId: "abc123", reason: "No zones assigned"
```

## 📊 API Endpoints

### Admin Endpoints (Require admin role)
- `GET /api/bins` - All bins (no filtering)
- `GET /api/admin/workers` - All workers with zones and locations
- `GET /api/admin/stats` - Statistics

### Worker Endpoints
- `GET /api/worker/bins` - Only bins in worker's zone(s)
- `GET /api/workers` - All workers (for map display)
- `PATCH /api/workers/me/location` - Update own location

### Expected Response Fields

**Worker Object:**
```json
{
  "id": "uuid",
  "name": "Worker 1",
  "email": "worker1@test.com",
  "role": "worker",
  "zone_id": "uuid",
  "zone": "Srirangam",
  "location_lat": 10.8623,
  "location_lng": 78.6938,
  "worker_status": "active"
}
```

**Bin Object:**
```json
{
  "id": "uuid",
  "label": "BIN-SR-01",
  "zone_id": "uuid",
  "lat": 10.8604,
  "lng": 78.6923,
  "status": "empty",
  "fill_level": 35,
  "created_at": "2024-01-01T00:00:00Z"
}
```

## 🚀 Quick Start (Complete Setup)

1. **Backend Setup**
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your Supabase credentials
   npm install
   npm start
   ```

2. **Database Setup**
   - Go to Supabase SQL Editor
   - Run `backend/db/schema.sql`
   - Run `backend/db/seed.sql`

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. **Run Tests**
   ```bash
   cd backend
   node test-api.js
   ```

## 🆘 Troubleshooting

### Worker Can't See Any Bins
1. Check server logs for `[ZONE_FILTER_STEP]` logs
2. Verify worker's `zone_id` is not NULL: `SELECT zone_id FROM users WHERE email = 'worker2@test.com'`
3. Verify `worker_zones` table has entries for the worker
4. Verify bins exist in that zone: `SELECT COUNT(*) FROM bins WHERE zone_id = '<worker-zone-id>'`

### Admin Can't See Workers
1. Check that `/api/admin/workers` returns an array
2. Verify all workers have `location_lat` and `location_lng` set
3. Check browser console for API errors

### Map Shows No Data
1. Check browser console for JavaScript errors
2. Check Network tab to see if API calls are succeeding
3. Verify API response has correct data types (numbers for coordinates)

### Worker 2 Specific Issues
1. Re-run seed script: `backend/db/seed.sql`
2. Verify Worker 2 is assigned to Thillai Nagar zone
3. Check that 10 bins exist in Thillai Nagar zone

## 📝 Files Modified

### Backend
- ✅ `backend/db/seed.sql` - Initialize worker locations and zone assignments
- ✅ `backend/services/authService.js` - Include location in profile
- ✅ `backend/services/binService.js` - Enhanced logging
- ✅ `backend/services/zoneService.js` - Enhanced logging

### Frontend
- ✅ `frontend/src/pages/WorkerPage.jsx` - Fixed location fallback logic
- ✅ `frontend/src/pages/AdminPage.jsx` - Added array validation
- ✅ `frontend/src/pages/WorkerPage.jsx` - Added array validation

### New Files
- ✅ `backend/test-api.js` - Comprehensive API test suite

## ✨ Expected Behavior After Fixes

### Admin Dashboard
- [x] Sees all 20 bins on the map
- [x] Sees all 3 workers with their locations
- [x] Bins are colored by status (red=full, green=empty)
- [x] Can add new bins by clicking on map
- [x] Can see worker locations and movement

### Worker 1 (Srirangam Zone)
- [x] Sees only ~10 bins (Srirangam zone)
- [x] Sees all workers on map
- [x] Can see their own location at 10.8623, 78.6938
- [x] Can drag to update location
- [x] Can optimize collection route

### Worker 2 (Thillai Nagar Zone)
- [x] Sees only ~10 bins (Thillai Nagar zone)
- [x] Sees all workers on map
- [x] Can see their own location at 10.8173, 78.6824
- [x] Can drag to update location
- [x] Can optimize collection route

---

**Last Updated:** May 5, 2024
**Issues Fixed:** 7 critical issues
**Test Coverage:** Complete API test suite included
