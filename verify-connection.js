#!/usr/bin/env node

/**
 * Quick Connection Checker
 * Run: node verify-connection.js
 */

require('dotenv').config();
const axios = require('axios');

const checks = [];

// 1. Check backend env
console.log('🔍 Checking Backend Configuration...\n');

const backendEnv = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ Present' : '✗ Missing',
  JWT_SECRET: process.env.JWT_SECRET ? '✓ Present' : '✗ Missing',
  PORT: process.env.PORT || 4000,
};

Object.entries(backendEnv).forEach(([key, value]) => {
  console.log(`  ${key}: ${value}`);
});

console.log('\n📋 Backend Setup \n');
console.log(`  PORT: http://localhost:${process.env.PORT || 4000}`);
console.log(`  API:  http://localhost:${process.env.PORT || 4000}/api`);
console.log(`  WS:   ws://localhost:${process.env.PORT || 4000}`);

console.log('\n✅ To connect:\n');
console.log('  1. cd backend');
console.log('  2. npm start');
console.log('\n  Frontend will connect to http://localhost:4000/api\n');

// 2. Validate Supabase URL format
console.log('🔐 Supabase Connection Check\n');

if (process.env.SUPABASE_URL) {
  const isValidUrl = process.env.SUPABASE_URL.includes('supabase.co');
  console.log(`  URL Format: ${isValidUrl ? '✓ Valid' : '✗ Invalid'}`);
  console.log(`  URL: ${process.env.SUPABASE_URL}`);
} else {
  console.log('  ✗ SUPABASE_URL not set');
}

if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const isValidKey = process.env.SUPABASE_SERVICE_ROLE_KEY.length > 100;
  console.log(`  Key Format: ${isValidKey ? '✓ Valid length' : '✗ Too short'}`);
} else {
  console.log('  ✗ SUPABASE_SERVICE_ROLE_KEY not set');
}

console.log('\n💾 Database Schema\n');
console.log('  Tables to create:');
console.log('    - users (for auth & roles)');
console.log('    - zones (service areas)');
console.log('    - workers_zones (many-to-many)');
console.log('    - bins (location & status)');
console.log('    - requests (user reports)');
console.log('    - worker_logs (activity)');
console.log('    - activity_logs (audit)');
console.log('    - bin_fill_events (history)');

console.log('\n📂 Schema File: backend/db/schema.sql\n');

console.log('🚀 Quick Start\n');
console.log('  1. Go to https://supabase.com');
console.log('  2. Create a new project');
console.log('  3. Copy SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY to backend/.env');
console.log('  4. In Supabase SQL Editor, run: backend/db/schema.sql');
console.log('  5. npm start in backend');
console.log('  6. npm run dev in frontend');
console.log('');
