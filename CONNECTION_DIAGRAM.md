# Supabase + Your Project Connection Flow

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Your Frontend (React)                         │
│              http://localhost:5173                               │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ API Calls (axios)                                         │  │
│  │ - Login/Register                                          │  │
│  │ - Create Bins                                             │  │
│  │ - Update Status                                           │  │
│  │ - WebSocket (real-time)                                  │  │
│  └─────────────────┬──────────────────────────────────────────┘  │
└────────────────────┼──────────────────────────────────────────────┘
                     │ HTTP + WS
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Your Backend (Express + Node)                   │
│            http://localhost:4000/api                            │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Controllers / Services                                   │   │
│  │ - Auth (JWT)                                             │   │
│  │ - User Management                                        │   │
│  │ - Bin Operations                                         │   │
│  │ - Request Handling                                       │   │
│  │ - Real-time WebSocket                                    │   │
│  └──────────────────┬───────────────────────────────────────┘   │
└─────────────────────┼──────────────────────────────────────────────┘
                      │ SQL Queries + SDK
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase (PostgreSQL)                        │
│         https://YOUR_PROJECT.supabase.co                       │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Tables                                                   │   │
│  │ - users (auth, roles, locations)                         │   │
│  │ - zones (service areas, 6km radius)                      │   │
│  │ - workers_zones (many-to-many mapping)                   │   │
│  │ - bins (location, fill_level, timestamps)               │   │
│  │ - requests (user reports, status)                        │   │
│  │ - worker_logs (activity tracking)                        │   │
│  │ - activity_logs (audit trail)                            │   │
│  │ - bin_fill_events (fill history)                         │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Connection Steps

### 1. **Frontend Registers User**
   - User fills form → POST /api/auth/register
   - Backend validates → hashes password
   - Creates user row in Supabase DB
   - Returns JWT token
   - Frontend stores token in localStorage

### 2. **Frontend Makes Authenticated Request**
   - Headers: `Authorization: Bearer JWT_TOKEN`
   - Backend verifies JWT signature
   - Fetches user from Supabase DB
   - Loads user roles, zones, locations
   - Executes operation (create bin, collect, etc.)
   - Database persists all changes

### 3. **Real-time Updates (WebSocket)**
   - Server runs bin fill simulation every 30s
   - Updates bin fill_level in DB
   - Broadcasts changes to all connected clients
   - Frontend updates UI instantly

## Data Flow Examples

### Adding a Bin (Admin)
```
Frontend                  Backend                Supabase
  │                         │                        │
  ├─POST /bins──────────────>│                        │
  │  {label, lat, lng,       │                        │
  │   zoneId}                │                        │
  │                          ├─INSERT bins────────────>│
  │                          │ (admin_id, auth,       │
  │                          │  timestamps)           │
  │                          │                        │
  │                          │<─bin record created────┤
  │                          │                        │
  │<─200 + bin object────────┤                        │
  │                          │                        │
  │<─WS: BIN_ADDED──────────┤                        │
  │   (broadcast to all)     │                        │
  │                          │                        │
```

### Worker Collecting a Bin
```
Frontend                  Backend                Supabase
  │                         │                        │
  ├─POST /bins/:id/collect─>│                        │
  │                          ├─SELECT bins────────────>│
  │                          │                        │
  │                          │<─bin details───────────┤
  │                          │                        │
  │                          ├─CHECK worker zone match
  │                          │                        │
  │                          ├─UPDATE bins────────────>│
  │                          │ (status=empty,          │
  │                          │  fill_started_at=now)   │
  │                          │                        │
  │                          ├─INSERT worker_logs────>│
  │                          │                        │
  │<─200 + updated bin───────┤                        │
  │                          │                        │
  │<─WS: BIN_UPDATED────────┤                        │
  │                          │                        │
```

### Auto-Fill Simulation (Every 30s)
```
Backend                    Supabase
  │                            │
  ├─SELECT bins (not full)────>│
  │                            │
  │<─bin records───────────────┤
  │                            │
  ├─Compute fill_level based on elapsed time
  │ (20 minutes = 100% full)
  │
  ├─UPDATE bins────────────────>│
  │ if fill_level >= 100        │
  │   then status = 'full'
  │                            │
  ├─WebSocket broadcast────────>
  │ BIN_UPDATED events to
  │ all connected clients
  │
```

## Security Flow

```
User Input                Backend                 Database
  │                        │                         │
  ├─Email + Password──────>│                        │
  │                        ├─Validate input         │
  │                        ├─Hash password (bcrypt)│
  │                        ├─Check email unique────>│
  │                        │                        │
  │                        │<─unique constraint OK──┤
  │                        │                        │
  │                        ├─INSERT user───────────>│
  │                        │                        │
  │                        │<─user created─────────┤
  │                        │                        │
  │                        ├─JWT sign token        │
  │<─{token, user}────────┤                        │
  │                        │                        │
  │ (store token locally)
  │
  ├─API request───────────>│                        │
  │  Header: Bearer TOKEN   ├─Verify JWT signature │
  │                        ├─Load user from DB────>│
  │                        │                        │
  │                        │<─user + roles─────────┤
  │                        ├─Role check (admin?)   │
  │                        │                        │
  │                        ├─Execute operation────>│
  │<─result────────────────┤                        │
  │
```

## Environment Variables Connection

```
Frontend (.env)           Backend (.env)          Supabase
  │                          │                      │
  VITE_API_URL               │                      │
  (points to backend)        │                      │
                             │                      │
  VITE_SUPABASE_ANON_KEY     │                      │
  (for direct client ops)    │     SUPABASE_URL ────────────────>
                             │     (PostgreSQL endpoint)
                             │                      │
                             SUPABASE_SERVICE_ROLE_KEY
                             (for backend auth)    │
                             └────────────────────>│
                                (can read/write all)
```

