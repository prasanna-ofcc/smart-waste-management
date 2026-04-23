@echo off
echo === Smart Waste Management - Supabase Connection Setup ===
echo.
echo Step 1: Create .env files
echo.
echo Backend .env requirements:
echo   - PORT (default 4000)
echo   - JWT_SECRET (pick a random string)
echo   - SUPABASE_URL (from Supabase dashboard)
echo   - SUPABASE_SERVICE_ROLE_KEY (from Supabase dashboard)
echo.
echo Use backend\.env.example as template
echo.
echo Step 2: Initialize Supabase Database
echo.
echo   1. Go to supabase.com and create project
echo   2. Go to SQL Editor
echo   3. Run: backend/db/schema.sql
echo.
echo Step 3: Start Services
echo.
echo   Terminal 1: cd backend ^&^& npm start
echo   Terminal 2: cd frontend ^&^& npm run dev
echo.
echo Step 4: Test
echo.
echo   Open http://localhost:5173
echo   Register as public user
echo   Check Supabase console -^> Database -^> users table
echo.
echo === Setup Complete ===
