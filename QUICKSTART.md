# ⚡ QUICK START (5 Minutes)

## ✅ Checklist - Follow in Order

### 1️⃣ Get Supabase (2 min)
- [ ] Go to https://supabase.com
- [ ] Click "Start your project" / Sign up
- [ ] Create new project: `smart-waste-management`
- [ ] Wait for initialized ✓

### 2️⃣ Copy Credentials (1 min)
- [ ] Open project → Settings → API
- [ ] Copy **Project URL** → save as SUPABASE_URL
- [ ] Copy secret key (**secret**) → save as SUPABASE_SERVICE_ROLE_KEY  
- [ ] Copy public key (**anon/public**) → save as VITE_SUPABASE_ANON_KEY

### 3️⃣ Set Up Backend (1 min)
```bash
cd backend
# Edit .env with your values:
# - SUPABASE_URL
# - SUPABASE_SERVICE_ROLE_KEY
```

### 4️⃣ Initialize Database (1 min)
- [ ] In Supabase → SQL Editor → New Query
- [ ] Copy-paste: `backend/db/schema.sql`
- [ ] Click Run
- [ ] Wait for ✓ success

### 5️⃣ Start Backend
```bash
npm start
# Should see: Smart Waste backend listening on 4000
```

### 6️⃣ Start Frontend (in new terminal)
```bash
cd frontend
npm run dev
# Open: http://localhost:5173
```

### 7️⃣ Test
- [ ] Show URL should be displayed
- [ ] Click **Register**
- [ ] Fill: Name, Email, Password, Phone
- [ ] Click **Submit**
- [ ] Check Supabase Database → Users table
- [ ] You should see the user ✓

**Done!** 🎉

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `backend/.env` | Backend config (Supabase keys) |
| `frontend/.env` | Frontend config (API URL) |
| `backend/db/schema.sql` | Database schema to run in Supabase |
| `SUPABASE_SETUP.md` | Detailed setup guide |
| `GET_CREDENTIALS.md` | How to get credentials |
| `CONNECTION_DIAGRAM.md` | Visual architecture |

---

## 🚨 Common Issues

**"SUPABASE_URL is missing"**
→ Check `backend/.env` exists and has the URL

**"Port 4000 already in use"**
→ Kill process: `npx kill-port 4000`

**"Cannot INSERT into users"**
→ Run schema.sql again in Supabase SQL Editor

**Frontend shows "API error"**
→ Make sure backend is running: `cd backend && npm start`

---

## 🔗 What Happens When You Register

```
You fill form
    ↓
Frontend sends POST to http://localhost:4000/api/auth/register
    ↓
Backend validates + hashes password
    ↓
Backend inserts user into Supabase users table
    ↓
Backend returns JWT token
    ↓
Frontend stores token, redirects to dashboard
    ↓
Your data persists in Supabase! ✓
```

---

## ✨ Need Help?

Read in order:
1. `SUPABASE_SETUP.md` - Full setup walkthrough
2. `GET_CREDENTIALS.md` - Step-by-step credential collection
3. `CONNECTION_DIAGRAM.md` - Architecture & data flow
4. `backend/API_REFERENCE.md` - All available endpoints

