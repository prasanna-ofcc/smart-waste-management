#!/usr/bin/env node

/**
 * API Test Suite for Smart Waste Management
 * Tests all endpoints to verify data flow
 */

require('dotenv').config();
const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:4000/api';
const TEST_CREDS = {
  admin: { email: 'admin@test.com', password: '123456' },
  worker1: { email: 'worker1@test.com', password: '123456' },
  worker2: { email: 'worker2@test.com', password: '123456' },
};

let tokens = {};
let users = {};

const api = axios.create({ baseURL: API_URL, timeout: 5000 });

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
  } catch (err) {
    console.error(`❌ ${name}`);
    if (err.response?.data) console.error('   ', err.response.data);
    else console.error('   ', err.message);
  }
}

async function login(role) {
  const creds = TEST_CREDS[role];
  const res = await api.post('/auth/login', creds);
  tokens[role] = res.data.token;
  users[role] = res.data.user;
  console.log(`\n🔐 Logged in as ${role}:`, {
    id: users[role].id,
    zone_id: users[role].zone_id,
    location_lat: users[role].location_lat,
    location_lng: users[role].location_lng,
  });
  return res.data;
}

async function adminRequest(endpoint) {
  return api.get(endpoint, {
    headers: { Authorization: `Bearer ${tokens.admin}` },
  });
}

async function worker1Request(endpoint) {
  return api.get(endpoint, {
    headers: { Authorization: `Bearer ${tokens.worker1}` },
  });
}

async function worker2Request(endpoint) {
  return api.get(endpoint, {
    headers: { Authorization: `Bearer ${tokens.worker2}` },
  });
}

async function runTests() {
  console.log('🧪 Smart Waste Management - API Test Suite\n');
  console.log(`API URL: ${API_URL}\n`);

  // ────────────────────────────────────────
  console.log('📝 TEST: Authentication');
  // ────────────────────────────────────────

  await test('Admin login', async () => {
    await login('admin');
    if (!tokens.admin) throw new Error('No token received');
  });

  await test('Worker 1 login', async () => {
    await login('worker1');
    if (!tokens.worker1) throw new Error('No token received');
  });

  await test('Worker 2 login', async () => {
    await login('worker2');
    if (!tokens.worker2) throw new Error('No token received');
  });

  // ────────────────────────────────────────
  console.log('\n🗺️ TEST: Admin Data Access');
  // ────────────────────────────────────────

  await test('Admin: Get all bins', async () => {
    const res = await adminRequest('/bins');
    if (!Array.isArray(res.data)) throw new Error('Response is not an array');
    console.log(`   Found ${res.data.length} bins`);
    if (res.data.length > 0) {
      const sample = res.data[0];
      console.log('   Sample bin:', {
        id: sample.id.slice(0, 8),
        zone_id: sample.zone_id?.slice(0, 8),
        lat: sample.lat,
        lng: sample.lng,
        status: sample.status,
        fill_level: sample.fill_level,
      });
    }
  });

  await test('Admin: Get all workers', async () => {
    const res = await adminRequest('/admin/workers');
    if (!Array.isArray(res.data)) throw new Error('Response is not an array');
    console.log(`   Found ${res.data.length} workers`);
    res.data.forEach((w, i) => {
      console.log(`   Worker ${i + 1}:`, {
        id: w.id.slice(0, 8),
        name: w.name,
        zone_id: w.zone_id?.slice(0, 8),
        zone: w.zone,
        location_lat: w.location_lat,
        location_lng: w.location_lng,
      });
    });
  });

  await test('Admin: Get stats', async () => {
    const res = await adminRequest('/admin/stats');
    console.log('   Stats:', res.data);
  });

  // ────────────────────────────────────────
  console.log('\n👷 TEST: Worker 1 Data Access (Srirangam zone)');
  // ────────────────────────────────────────

  await test('Worker 1: Get assigned bins', async () => {
    const res = await worker1Request('/worker/bins');
    if (!Array.isArray(res.data)) throw new Error('Response is not an array');
    console.log(`   Found ${res.data.length} bins`);
    if (res.data.length > 0) {
      const sample = res.data[0];
      console.log('   Sample bin:', {
        id: sample.id.slice(0, 8),
        zone_id: sample.zone_id?.slice(0, 8),
        label: sample.label,
        status: sample.status,
      });
    }
  });

  await test('Worker 1: Get all workers', async () => {
    const res = await worker1Request('/workers');
    if (!Array.isArray(res.data)) throw new Error('Response is not an array');
    console.log(`   Can see ${res.data.length} workers`);
  });

  // ────────────────────────────────────────
  console.log('\n👷 TEST: Worker 2 Data Access (Thillai Nagar zone)');
  // ────────────────────────────────────────

  await test('Worker 2: Get assigned bins', async () => {
    const res = await worker2Request('/worker/bins');
    if (!Array.isArray(res.data)) throw new Error('Response is not an array');
    console.log(`   Found ${res.data.length} bins`);
    if (res.data.length === 0) {
      console.log('   ⚠️  WARNING: Worker 2 has no bins assigned!');
      console.log('   Checking worker data...');
      console.log('   Worker 2 zone_id:', users.worker2.zone_id);
    } else {
      const sample = res.data[0];
      console.log('   Sample bin:', {
        id: sample.id.slice(0, 8),
        zone_id: sample.zone_id?.slice(0, 8),
        label: sample.label,
        status: sample.status,
      });
    }
  });

  await test('Worker 2: Get all workers', async () => {
    const res = await worker2Request('/workers');
    if (!Array.isArray(res.data)) throw new Error('Response is not an array');
    console.log(`   Can see ${res.data.length} workers`);
  });

  // ────────────────────────────────────────
  console.log('\n🔄 TEST: Data Consistency');
  // ────────────────────────────────────────

  await test('Worker 1 bins are in correct zone', async () => {
    const res = await worker1Request('/worker/bins');
    const worker1ZoneId = users.worker1.zone_id;
    const binsInCorrectZone = res.data.every(b => b.zone_id === worker1ZoneId);
    if (!binsInCorrectZone) {
      console.log(`   ⚠️  Some bins are not in Worker 1's zone (${worker1ZoneId})`);
      res.data.forEach((b, i) => {
        if (b.zone_id !== worker1ZoneId) {
          console.log(`     Bin ${i}: zone=${b.zone_id}`);
        }
      });
      throw new Error('Zone mismatch');
    }
    console.log(`   ✓ All ${res.data.length} bins are in Worker 1's zone`);
  });

  await test('Worker 2 bins are in correct zone', async () => {
    const res = await worker2Request('/worker/bins');
    const worker2ZoneId = users.worker2.zone_id;
    if (!worker2ZoneId) {
      throw new Error('Worker 2 has no zone_id assigned');
    }
    const binsInCorrectZone = res.data.every(b => b.zone_id === worker2ZoneId);
    if (!binsInCorrectZone) {
      console.log(`   ⚠️  Some bins are not in Worker 2's zone (${worker2ZoneId})`);
      res.data.forEach((b, i) => {
        if (b.zone_id !== worker2ZoneId) {
          console.log(`     Bin ${i}: zone=${b.zone_id}`);
        }
      });
      throw new Error('Zone mismatch');
    }
    console.log(`   ✓ All ${res.data.length} bins are in Worker 2's zone`);
  });

  console.log('\n✨ Tests completed!\n');
}

runTests().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
