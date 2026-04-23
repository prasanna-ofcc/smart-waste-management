# Smart Waste Management - Supabase Connection Reference

## Your Project Structure After Setup

```
smart-waste-management/
├── backend/
│   ├── .env ← FILL THIS with Supabase credentials
│   ├── package.json
│   ├── server.js
│   ├── controllers/
│   ├── services/
│   ├── routes/
│   ├── db/
│   │   └── schema.sql ← RUN THIS in Supabase
│   └── API_REFERENCE.md ← All endpoints
│
├── frontend/
│   ├── .env ← FILL THIS with Supabase URL & API URL
│   ├── package.json
│   └── src/
│
├── QUICKSTART.md ← START HERE (you are here)
├── SUPABASE_SETUP.md ← Full guide
├── GET_CREDENTIALS.md ← How to get keys
├── CONNECTION_DIAGRAM.md ← Architecture
└── README.md
```

## Connection Overview

```
┌─ Frontend (React) ─┐
│   localhost:5173   │
└────────┬───────────┘
         │ HTTP Calls
         ├─ /api/auth/register
         ├─ /api/bins
         ├─ /api/workers
         ├─ /api/requests
         └─ WebSocket
         
┌─ Backend (Express) ──────┐
│   localhost:4000/api      │
└─────────┬────────────────┘
          │ SQL
          │
┌─ Supabase PostgreSQL ─┐
│   Cloud Database      │
│   Persistent Data     │
└───────────────────────┘
```

## What Gets Connected

| Component | URL | What it Does |
|-----------|-----|-------------|
| **Frontend** | http://localhost:5173 | User interface, forms, dashboard |
| **Backend** | http://localhost:4000 | API logic, auth, business rules |
| **Database** | Supabase cloud | Stores all data (users, bins, zones, etc.) |
| **WebSocket** | ws://localhost:4000 | Real-time updates (bin fill, worker status) |

## 3 Critical Files to Complete

### 1. `backend/.env`
```
SUPABASE_URL=https://YOUR_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
JWT_SECRET=any_random_string
```

### 2. `frontend/.env`
```
VITE_API_URL=http://localhost:4000/api
VITE_SUPABASE_URL=https://YOUR_ID.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### 3. `backend/db/schema.sql`
- Run in Supabase SQL Editor (no edits needed)
- Creates all tables automatically

## Data Flow When User Registers

```
1. User fills form (Name, Email, Password)
   ↓
2. Frontend: POST /api/auth/register
   ↓
3. Backend receives request
   ├─ Validates email format
   ├─ Checks email not duplicate
   ├─ Hashes password with bcrypt
   └─ Inserts into Supabase users table
   ↓
4. Supabase stores user record
   ↓
5. Backend returns JWT token
   ↓
6. Frontend stores token in localStorage
   ↓
7. Frontend redirects to dashboard
   ↓
8. Data persists in Supabase! ✓ (never resets)
```

## Commands to Run

**Terminal 1: Start Backend**
```bash
cd backend
npm start
# Output: Smart Waste backend listening on 4000
```

**Terminal 2: Start Frontend**
```bash
cd frontend
npm run dev
# Output: VITE ready... open http://localhost:5173
```

## Testing Connection

In browser, open http://localhost:5173 and:

1. Try **Register** → create account
2. Check Supabase **Database** → **users** table
3. You should see your new user!

If user appears in Supabase → **You're connected!** ✅

## Endpoints You Can Use

See `backend/API_REFERENCE.md` for full list. Here are main ones:

**Auth**
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me

**Bins**
- GET /api/bins (your zone's bins)
- POST /api/bins/:id/collect

**Workers (self)**
- PATCH /api/workers/me/status
- PATCH /api/workers/me/location

**Admin**
- POST /api/admin/workers (create worker)
- POST /api/admin/zones (create zone)
- POST /api/admin/bins (add bin)

**Requests**
- POST /api/requests (report issue)
- GET /api/requests (your requests)

## Database Tables (Automatic)

All these are created by schema.sql:

- **users** - Login, roles, locations
- **zones** - Service areas (6km radius)
- **workers_zones** - Which zones each worker covers
- **bins** - Trash bin locations & status
- **requests** - User reports & collection requests
- **worker_logs** - What workers did (audit trail)
- **activity_logs** - All system activity
- **bin_fill_events** - Bin fill history

## Real-time Updates (WebSocket)

Backend broadcasts when:
- Bin is added/removed/updated
- Worker location changes
- Request is accepted/completed
- Bin gets collected

Frontend receives and **updates dashboard automatically** ✨

## Environment Variables Explained

| Variable | Where | Example | What it's for |
|----------|-------|---------|---------------|
| SUPABASE_URL | Backend .env | https://abc.supabase.co | PostgreSQL endpoint |
| SUPABASE_SERVICE_ROLE_KEY | Backend .env | eyJ... | Backend database access |
| VITE_SUPABASE_ANON_KEY | Frontend .env | eyJ... | Frontend could use for direct DB (not used yet) |
| VITE_API_URL | Frontend .env | http://localhost:4000/api | Backend API endpoint |
| JWT_SECRET | Backend .env | mysecretkey | Signs login tokens |
| PORT | Backend .env | 4000 | What port to run on |

## What happens without Supabase?

❌ No setup = no persistence:
- Data lost on restart
- No real database
- Can't scale
- No security

✅ With Supabase = everything persists:
- Users saved forever
- Bins & zones persist
- Worker history tracked
- Activity audited
- Production-ready

---

**Next Step:** Open `QUICKSTART.md` and follow the 5-minute checklist! 🚀

