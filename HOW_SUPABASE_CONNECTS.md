# How Supabase Connects to Your Project

## 🔗 The Connection Chain

```
Your Computer (localhost)
│
├─ Frontend (http://localhost:5173)
│  │ Uses: `axios` HTTP client
│  └─ Calls: http://localhost:4000/api/* ← Your Backend
│
├─ Backend (http://localhost:4000)
│  │ Uses: @supabase/supabase-js SDK
│  └─ Connects to: https://YOUR_PROJECT.supabase.co ← Supabase Cloud
│
└─ Supabase Cloud
   │ PostgreSQL Database
   └─ Stores: All your data (users, bins, zones, etc.)
```

## 📝 Step-by-Step Connection Process

### 1. **Frontend → Backend Communication**

```javascript
// frontend/.env
VITE_API_URL=http://localhost:4000/api

// frontend/src/services/api.js
const API_URL = import.meta.env.VITE_API_URL || '/api';
const api = axios.create({ baseURL: API_URL });

// Usage in components:
const response = await api.post('/auth/register', { 
  name: 'John',
  email: 'john@example.com',
  password: '123456'
});
```

**What happens:**
1. Frontend sends `POST http://localhost:4000/api/auth/register`
2. Vite dev server proxies it to backend
3. Backend receives request in route handler

### 2. **Backend Connection to Supabase**

```javascript
// backend/.env
SUPABASE_URL=https://abc123.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...long key...

// backend/db/supabase.js
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Usage in services:
const { data, error } = await supabase
  .from('users')
  .insert({ name, email, password_hash });
```

**What happens:**
1. Backend creates Supabase client with credentials
2. Sends SQL query to Supabase (PostgreSQL in cloud)
3. Data is stored in Supabase database
4. Response returns to backend
5. Backend sends response to frontend

### 3. **Complete Data Flow for User Registration**

```
┌─ Frontend (You) ─────────────────────┐
│                                       │
│  User fills form:                    │
│  - Name: John                        │
│  - Email: john@test.com             │
│  - Password: secret123              │
│                                       │
│  Clicks "Register" button            │
│  ↓                                    │
│  axios.post('/api/auth/register')   │
└────────────┬────────────────────────┘
             │
             │ HTTP POST with JSON body
             ↓
┌─ Backend (Express) ──────────────────┐
│                                       │
│  Route handler receives request      │
│  /routes/auth.js → authController    │
│  ↓                                    │
│  authService.registerPublicUser()   │
│  ├─ Validate input (email, password) │
│  ├─ Hash password (bcrypt)           │
│  ├─ userService.createPublicUser()   │
│  │  └─ Check email not duplicate    │
│  └─ (continue...)                   │
│                                       │
└───────────┬─────────────────────────┘
            │
            │ Supabase SDK query
            ↓
┌─ Supabase (Cloud) ───────────────────┐
│                                       │
│  PostgreSQL Database receives        │
│  INSERT INTO users (...)            │
│  VALUES (john, john@test.com, ...)  │
│                                       │
│  ✓ Row inserted into DB              │
│  ✓ Returns user object with ID       │
│                                       │
└───────────┬─────────────────────────┘
            │ Response JSON
            ↓
┌─ Backend (Express) ──────────────────┐
│                                       │
│  User created successfully            │
│  ├─ Sign JWT token                   │
│  └─ Return { token, user }          │
│                                       │
└───────────┬─────────────────────────┘
            │ JSON response
            ↓
┌─ Frontend (You) ─────────────────────┐
│                                       │
│  ✓ Registration successful!          │
│  ├─ Store token in localStorage      │
│  ├─ Store user in localStorage       │
│  └─ Redirect to dashboard           │
│                                       │
│  🎉 User is now persisted in        │
│     Supabase (won't disappear!)      │
│                                       │
└────────────────────────────────────┘
```

## 🔐 Authentication Flow

```
Request → Backend checks Authorization header → Validates JWT → Loads user from Supabase → Permits action → Response

┌──────────────────────────────────────────────────────────┐
│ Frontend: Every request includes JWT token              │
│                                                          │
│ axios.defaults.headers.Authorization = 'Bearer TOKEN'  │
│ GET /api/bins                                           │
│ Headers: { Authorization: 'Bearer eyJ...' }            │
└─────────────────────┬──────────────────────────────────┘
                      │
┌─────────────────────┴──────────────────────────────────┐
│ Backend: Authenticate middleware                        │
│                                                          │
│ 1. Extract token from Authorization header             │
│ 2. Verify JWT signature (uses JWT_SECRET)             │
│ 3. Decode token → get user.id                          │
│ 4. Query Supabase: SELECT * FROM users WHERE id=...  │
│ 5. Attach user object to request                       │
│ 6. Pass to route handler                               │
└─────────────────────┬──────────────────────────────────┘
                      │
┌─────────────────────┴──────────────────────────────────┐
│ Route Handler: Access authenticated user               │
│                                                         │
│ const bins = await binService.listBinsForUser(user)   │
│ // Respects user.role and assigns zones               │
│                                                         │
│ return res.json(bins);                                 │
└──────────────────────────────────────────────────────┘
```

## 💾 How Data Persists

**OLD (JSON file) - ❌ DATA RESETS ON RESTART**
```
{ bin data } → saved to db.json
Restart backend → db.json cleared by seedData.js
↓
All data gone 😢
```

**NEW (Supabase) - ✅ DATA ALWAYS PERSISTS**
```
{ bin data } → INSERT INTO bins → Supabase PostgreSQL
↓
Data stored in cloud database (physical hard drive)
↓
Restart backend, frontend, computer doesn't matter
↓
Data still there when you query again 😊
```

## 🌐 Real-time Updates (WebSocket)

```
Backend Simulation (every 30 seconds):
│
├─ SELECT bins WHERE status != 'full'
│ (fetch bins from Supabase)
│
├─ Compute fill_level for each bin
│ (based on elapsed time since collection)
│
├─ If fill_level >= 100:
│ │ UPDATE bins SET status = 'full'
│ └─ (persist in Supabase)
│
└─ Broadcast to all connected WebSocket clients:
  {
    type: 'BIN_UPDATED',
    bin: { id, fill_level, status, ... }
  }

Frontend WebSocket listener:
│
└─ Receives BIN_UPDATED event
   ├─ Updates UI instantly
   └─ Shows updated fill level on map
```

## 📊 Database Schema (Auto-Created)

Run `backend/db/schema.sql` in Supabase SQL Editor → All these tables are created:

```sql
users                -- Auth users (admin, worker, public)
zones                -- Service areas (6km radius each)
workers_zones        -- Many-to-many: worker → zone mapping
bins                 -- Trash bin locations
requests             -- User reports/requests
worker_logs          -- Activity audit trail
activity_logs        -- System audit log
bin_fill_events      -- Fill history for analytics
```

## 🚀 Complete File Setup

| File | What | Example Value |
|------|------|--------|
| `backend/.env` | Server secrets | See below |
| `frontend/.env` | Client config | See below |
| `backend/db/schema.sql` | Database tables | Already written |

### backend/.env Template
```
PORT=4000
JWT_SECRET=replace_with_any_random_string_32_chars_min
JWT_EXPIRES_IN=8h

# From Supabase Settings → API
SUPABASE_URL=https://your_project_id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### frontend/.env Template
```
# Points to your local backend during development
VITE_API_URL=http://localhost:4000/api

# From Supabase Settings → API (public key for optional direct access)
VITE_SUPABASE_URL=https://your_project_id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## ✅ Verification Checklist

```
□ Supabase project created at supabase.com
□ Got SUPABASE_URL from Settings → API
□ Got SUPABASE_SERVICE_ROLE_KEY (secret) from Settings → API
□ Created backend/.env with above values
□ Created frontend/.env with API_URL
□ Ran schema.sql in Supabase SQL Editor (Tables appear)
□ Backend runs: npm start (from backend folder)
□ Frontend runs: npm run dev (from frontend folder)
□ Can register user at http://localhost:5173
□ User appears in Supabase Database → users table ✓
```

## 🔧 Production Considerations

When deploying to production:

1. **Backend:** Set SUPABASE_* env vars in hosting dashboard (not .env file)
2. **Frontend:** Set VITE_API_URL to production backend URL
3. **Database:** Remains on Supabase (no changes needed)
4. **JWT_SECRET:** Use a strong random string in production

Example production .env:
```
# Production Backend
PORT=4000
JWT_SECRET=ab1234cd5678ef9012ab3456cd7890ef1234
SUPABASE_URL=https://project.supabase.co  # same
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # same
```

