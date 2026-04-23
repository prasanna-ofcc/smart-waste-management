# Step-by-Step: Get Your Supabase Credentials

## 1. Sign Up to Supabase

Go to **https://supabase.com** → Click **Start your project** → **Sign Up**

Choose:
- Email & password (or GitHub)
- Agree to terms
- Click "Sign up"

## 2. Create a New Project

After signing in:

1. Click **New Project**
2. Fill in:
   - **Project name**: `smart-waste-management`
   - **Database Password**: Create strong password, save it! (you'll need it for direct DB access)
   - **Region**: Pick closest to you (e.g., `us-east-1` for US, `eu-west-1` for EU)
3. Click **Create new project**
4. Wait 2-3 minutes for initialization

## 3. Get Your Credentials

Once project is ready:

### Find SUPABASE_URL:
1. Go to **Settings** (bottom left) → **API**
2. Under **Project URL** section, copy the URL
   - Looks like: `https://xxxxxxxxxxxxx.supabase.co`
3. Save this as `SUPABASE_URL`

### Find SUPABASE_SERVICE_ROLE_KEY:
1. Still in **Settings** → **API**
2. Scroll down to **Project API keys**
3. Find the key labeled **secret** (starts with `eyJ`)
4. Click copy icon
5. Save as `SUPABASE_SERVICE_ROLE_KEY`

### Find SUPABASE_ANON_KEY (for frontend):
1. Same location
2. Find the key labeled **anon/public** (starts with `eyJ`)
3. Copy it
4. Save as `VITE_SUPABASE_ANON_KEY`

## 4. Create Database Tables

1. In Supabase dashboard, click **SQL Editor** (left sidebar)
2. Click **New Query**
3. Delete any template text
4. Copy-paste entire content from: `backend/db/schema.sql`
5. Click **Run** button
6. Wait for success message
7. You should see tables created in **Database** → **Tables**

## 5. Fill in .env Files

### Backend: `backend/.env`
```
PORT=4000
JWT_SECRET=create_a_random_string_here_at_least_32_chars
JWT_EXPIRES_IN=8h
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJXXXXXXXXXXXXXX...
```

### Frontend: `frontend/.env`
```
VITE_API_URL=http://localhost:4000/api
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJXXXXXXXXXXXXXX...
```

## 6. Start Your App

**Terminal 1 - Backend:**
```bash
cd backend
npm start
```

Expected: `Smart Waste backend listening on 4000`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Expected: `VITE v8.0.2 ready in XX ms`

Then open: **http://localhost:5173**

## 7. Test the Connection

1. On frontend, click **Register**
2. Fill in: Name, Email, Password, Phone
3. Click **Submit**
4. Should redirect to dashboard
5. Go to Supabase dashboard
6. Click **Database** → **users** table
7. You should see your new user!

## 8. Troubleshooting

| Error | Solution |
|-------|----------|
| "Missing SUPABASE_URL" | Check `.env` file exists in `backend/` folder |
| "Connection refused" | Make sure backend is running on port 4000 |
| "Invalid API key" | Copy credentials again (no extra spaces) |
| "Cannot INSERT" | Run schema.sql again in Supabase SQL Editor |
| CORS errors | Frontend is trying direct Supabase connection; use backend API instead |

## 9. Verify Everything Works

In Supabase **SQL Editor**, run:

```sql
-- Check users
SELECT id, name, email, role FROM users LIMIT 5;

-- Check zones (initially empty)
SELECT * FROM zones LIMIT 5;

-- Check bins (initially empty)
SELECT * FROM bins LIMIT 5;

-- Check activity
SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 10;
```

If you see data, **You're connected!** 🎉

