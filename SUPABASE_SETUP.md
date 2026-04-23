# Supabase Setup Guide

## Step 1: Create Supabase Project

1. Go to https://supabase.com and sign up (free tier available)
2. Create a new project:
   - Name: `smart-waste-management`
   - Database Password: save it securely
   - Region: closest to you
3. Wait for project to initialize (~2 min)

## Step 2: Get Connection Keys

1. In Supabase dashboard, go to **Settings → API**
2. Copy these values:
   - **SUPABASE_URL**: Project URL (looks like `https://xxxxx.supabase.co`)
   - **SUPABASE_SERVICE_ROLE_KEY**: Service Role Key (long secret starting with `eyJ...`)
   - **SUPABASE_ANON_KEY**: Anon Public Key (for frontend)

## Step 3: Create Backend .env File

Backend folder: `backend/.env`

```
PORT=4000
JWT_SECRET=your_secure_jwt_secret_here_change_this
JWT_EXPIRES_IN=8h

SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

## Step 4: Create Frontend .env File

Frontend folder: `frontend/.env`

```
VITE_API_URL=http://localhost:4000/api
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=eyJXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

## Step 5: Initialize Database Schema

1. In Supabase, go to **SQL Editor**
2. Create a new query
3. Copy-paste all content from `backend/db/schema.sql`
4. Click **Run** and wait for completion

## Step 6: Start Backend

```bash
cd backend
npm start
```

Expected output:
```
Smart Waste backend listening on 4000
REST: http://localhost:4000/api
WS: ws://localhost:4000
```

## Step 7: Start Frontend

```bash
cd frontend
npm run dev
```

## Step 8: Test Connection

1. Open http://localhost:5173 (frontend)
2. Try to register a new user
3. Should persist in Supabase Database → Users table

## Verify Database is Working

In Supabase SQL Editor, run:

```sql
select count(*) from users;
select count(*) from zones;
select count(*) from bins;
```

If numbers increase after actions, everything works!

## Troubleshooting

### "Missing SUPABASE_URL" error
- Make sure .env file exists in backend folder
- Values must not have quotes
- Restart backend after saving .env

### Connection refused on port 4000
- Kill existing process: `npx kill-port 4000`

### "Service role key invalid"
- Check for extra spaces or quotes in .env
- Re-copy from Supabase dashboard

### Database locked / permission errors
- Check SUPABASE_SERVICE_ROLE_KEY is correct
- Should start with `eyJ` and be 300+ characters

