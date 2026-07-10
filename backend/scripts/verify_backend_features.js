const db = require('../config/db');
const redisClient = require('../config/redis');
const { execSync } = require('child_process');
const path = require('path');

const BASE_URL = 'http://localhost:8000';
let token = '';
let customerId = '';
let testBusinessId = '';

async function testStep(name, fn) {
  try {
    process.stdout.write(`Testing: ${name}... `);
    await fn();
    console.log('✅ PASS');
  } catch (err) {
    console.log('❌ FAIL');
    console.error('Error Details:', err.message);
    process.exit(1);
  }
}

async function runTests() {
  console.log("=================================================");
  console.log("CHURNSHIELD END-TO-END BACKEND VERIFICATION RUN");
  console.log("=================================================");

  // Ensure Redis client connection is active
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }

  // 1. Auth Login (RBAC Check)
  await testStep('Multi-Tenant Auth Login (POST /api/auth/login)', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'streaming@flixstream.com', password: 'password123' })
    });
    if (!res.ok) throw new Error(`Auth failed with status ${res.status}`);
    const data = await res.json();
    token = data.access_token;
    testBusinessId = data.business.id;
    if (!token) throw new Error('No JWT token returned');
  });

  // 2. Auth Session Verification
  await testStep('Verify Session (GET /api/auth/me)', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (data.user.role !== 'ADMIN') throw new Error(`Invalid role returned: ${data.user.role}`);
  });

  // 3. Get Team Members
  await testStep('List Team Members (GET /api/users)', async () => {
    const res = await fetch(`${BASE_URL}/api/users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('No users list returned');
  });

  // 4. Fetch Customers list and segments
  await testStep('Filter Customer Segments (GET /api/customers?segment=vips)', async () => {
    const res = await fetch(`${BASE_URL}/api/customers?segment=vips`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data.customers)) throw new Error('Customers list missing');
    if (data.customers.length > 0) {
      customerId = data.customers[0].id;
    }
  });

  // 5. Ingest usage event via API key
  await testStep('Ingest Usage Event & Increment Redis Counters (POST /v1/track)', async () => {
    const res = await fetch(`${BASE_URL}/v1/track`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-API-Key': 'cs_live_streamingkey123'
      },
      body: JSON.stringify({
        user_id: 'user_1',
        action_label: 'page_view',
        event_type: 'ENGAGEMENT_SUCCESS'
      })
    });
    if (res.status !== 202) throw new Error(`Expected 202 Accepted, got ${res.status}`);
  });

  // 6. Simulate Real-time inference
  await testStep('ML simulation playground (POST /api/customers/:id/simulate)', async () => {
    if (!customerId) throw new Error('No test customer ID found.');
    const res = await fetch(`${BASE_URL}/api/customers/${customerId}/simulate`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        engagement_delta_7d: 0.1,
        negative_event_ratio: 0.8,
        days_since_last_interaction: 3,
        contract_weight_index: 1.2
      })
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (data.simulated_churn_risk_probability === undefined) throw new Error('Simulation value missing');
  });

  // 7. Verify Ingestion Analytics
  await testStep('Ingestion Analytics (GET /api/developer/metrics)', async () => {
    const res = await fetch(`${BASE_URL}/api/developer/metrics`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    const todayLog = data[data.length - 1];
    if (todayLog.total === 0) throw new Error('No requests counted for today');
  });

  // 8. Run Python pipeline and verify Time-Series risk logs
  await testStep('Trigger ML pipeline & History snapshot (ml_pipeline.py)', async () => {
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const scriptPath = path.join(__dirname, '..', 'ml', 'ml_pipeline.py');
    execSync(`"${pythonCmd}" "${scriptPath}"`);

    const historyCheck = await db.query(
      'SELECT id FROM customer_risk_history WHERE customer_id = $1', 
      [customerId]
    );
    if (historyCheck.rows.length === 0) throw new Error('No risk history row created');
  });

  // 9. Fetch model health drift sheet
  await testStep('MLOps Model Health metrics (GET /api/model-health)', async () => {
    const res = await fetch(`${BASE_URL}/api/model-health`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (data.driftStatus === undefined) throw new Error('Drift status missing');
  });

  // 10. Run Daily Pulse digest
  await testStep('Generate Daily Pulse Summary Digest', async () => {
    const { runDailyPulse } = require('../workers/dailyPulse');
    await runDailyPulse();
  });

  // 11. PDF Report generation
  await testStep('Executive PDF Report Stream (GET /api/overview/pdf-report)', async () => {
    const res = await fetch(`${BASE_URL}/api/overview/pdf-report`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength < 500) throw new Error('PDF file buffer corrupt or empty');
  });

  console.log("=================================================");
  console.log("🎉 ALL 11 BACKEND EXTENSIONS VERIFIED SUCCESSFULLY!");
  console.log("=================================================");
  process.exit(0);
}

runTests().catch(err => {
  console.error("Test suite failed:", err);
  process.exit(1);
});