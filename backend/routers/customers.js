const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { exec } = require('child_process');
const path = require('path');
const PDFDocument = require('pdfkit');

// =========================================================================
// GET /api/overview
// =========================================================================
router.get('/overview', requireAuth, async (req, res) => {
  try {
    const businessId = req.business.id;

    const statsQuery = `
      SELECT 
        COUNT(*) AS total_customers,
        COALESCE(SUM(monthly_contract_value), 0) AS total_revenue,
        COALESCE(SUM(CASE WHEN risk_classification_status = 'CRITICAL' THEN monthly_contract_value ELSE 0 END), 0) AS revenue_at_risk,
        COALESCE(MAX(last_computed_at), NOW()) AS last_updated
      FROM customers
      WHERE business_id = $1
    `;
    const statsRes = await db.query(statsQuery, [businessId]);
    const stats = statsRes.rows[0];

    const breakdownQuery = `
      SELECT risk_classification_status AS status, COUNT(*) AS count
      FROM customers
      WHERE business_id = $1
      GROUP BY risk_classification_status
    `;
    const breakdownRes = await db.query(breakdownQuery, [businessId]);
    
    const statusCounts = { HEALTHY: 0, AT_RISK: 0, CRITICAL: 0 };
    breakdownRes.rows.forEach(row => {
      statusCounts[row.status] = parseInt(row.count);
    });

    const topRiskQuery = `
      SELECT id, external_user_id, churn_risk_probability, risk_classification_status, monthly_contract_value
      FROM customers
      WHERE business_id = $1
      ORDER BY churn_risk_probability DESC
      LIMIT 5
    `;
    const topRiskRes = await db.query(topRiskQuery, [businessId]);

    return res.json({
      totalCustomers: parseInt(stats.total_customers),
      totalRevenue: parseFloat(stats.total_revenue),
      revenueAtRisk: parseFloat(stats.revenue_at_risk),
      statusCounts,
      topAtRiskCustomers: topRiskRes.rows,
      lastComputedAt: stats.last_updated
    });

  } catch (error) {
    console.error('Error fetching dashboard overview stats:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// =========================================================================
// GET /api/customers (Paginated, Searchable, Filterable, Sortable + SEGMENTS)
// =========================================================================
router.get('/customers', requireAuth, async (req, res) => {
  try {
    const businessId = req.business.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const statusFilter = req.query.status;
    const searchVal = req.query.search;
    const sortVal = req.query.sort;
    const segment = req.query.segment; // 'vips', 'slipped', 'negative_spike'

    let queryText = 'SELECT id, external_user_id, churn_risk_probability, risk_classification_status, monthly_contract_value, last_computed_at FROM customers WHERE business_id = $1';
    let countQueryText = 'SELECT COUNT(*) FROM customers WHERE business_id = $1';
    
    const queryParams = [businessId];
    const countParams = [businessId];
    let paramIndex = 2;

    // A. Apply Segment Filters
    if (segment === 'vips') {
      const vipsFilter = ` AND risk_classification_status IN ('AT_RISK', 'CRITICAL') 
                           AND monthly_contract_value > (SELECT COALESCE(AVG(monthly_contract_value), 0) FROM customers WHERE business_id = $1)`;
      queryText += vipsFilter;
      countQueryText += vipsFilter;
    } else if (segment === 'slipped') {
      const slippedFilter = ` AND external_user_id NOT IN (SELECT DISTINCT external_user_id FROM usage_events WHERE business_id = $1 AND created_at >= NOW() - INTERVAL '14 days')`;
      queryText += slippedFilter;
      countQueryText += slippedFilter;
    } else if (segment === 'negative_spike') {
      const spikeFilter = ` AND external_user_id IN (SELECT external_user_id FROM usage_events WHERE business_id = $1 AND standardized_metric_type = 'ENGAGEMENT_DROP' AND created_at >= NOW() - INTERVAL '7 days' GROUP BY external_user_id HAVING COUNT(*) >= 3)`;
      queryText += spikeFilter;
      countQueryText += spikeFilter;
    }

    // B. Apply Regular Status Filters
    if (statusFilter && statusFilter !== 'ALL') {
      queryText += ` AND risk_classification_status = $${paramIndex}`;
      countQueryText += ` AND risk_classification_status = $${paramIndex}`;
      queryParams.push(statusFilter);
      countParams.push(statusFilter);
      paramIndex++;
    }

    // C. Apply Search Filter
    if (searchVal) {
      queryText += ` AND external_user_id ILIKE $${paramIndex}`;
      countQueryText += ` AND external_user_id ILIKE $${paramIndex}`;
      queryParams.push(`%${searchVal}%`);
      countParams.push(`%${searchVal}%`);
      paramIndex++;
    }

    // D. Apply Sorting
    if (sortVal === 'value_desc') {
      queryText += ' ORDER BY monthly_contract_value DESC';
    } else if (sortVal === 'value_asc') {
      queryText += ' ORDER BY monthly_contract_value ASC';
    } else if (sortVal === 'risk_asc') {
      queryText += ' ORDER BY churn_risk_probability ASC';
    } else {
      queryText += ' ORDER BY churn_risk_probability DESC';
    }

    queryText += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const countRes = await db.query(countQueryText, countParams);
    const customersRes = await db.query(queryText, queryParams);

    return res.json({
      customers: customersRes.rows,
      totalCount: parseInt(countRes.rows[0].count),
      page,
      limit
    });

  } catch (error) {
    console.error('Error fetching customers page list:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// =========================================================================
// GET /api/customers/:id
// =========================================================================
router.get('/customers/:id', requireAuth, async (req, res) => {
  try {
    const customerId = req.params.id;
    const businessId = req.business.id;

    const customerRes = await db.query(
      'SELECT * FROM customers WHERE id = $1 AND business_id = $2',
      [customerId, businessId]
    );

    if (customerRes.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    const customer = customerRes.rows[0];

    const eventHistoryQuery = `
      SELECT 
        TO_CHAR(DATE_TRUNC('week', created_at), 'YYYY-MM-DD') AS week_start,
        COUNT(*) AS event_count
      FROM usage_events
      WHERE business_id = $1 AND external_user_id = $2
        AND created_at >= NOW() - INTERVAL '8 weeks'
      GROUP BY DATE_TRUNC('week', created_at)
      ORDER BY DATE_TRUNC('week', created_at) ASC
    `;
    const eventHistoryRes = await db.query(eventHistoryQuery, [businessId, customer.external_user_id]);

    return res.json({
      customer,
      eventHistory: eventHistoryRes.rows
    });

  } catch (error) {
    console.error('Error fetching customer details:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// =========================================================================
// NEW: POST /api/customers/:id/notes
// =========================================================================
router.post('/customers/:id/notes', requireAuth, async (req, res) => {
  try {
    const customerId = req.params.id;
    const businessId = req.user.business_id;
    const userId = req.user.id;
    const { note_text } = req.body;

    if (!note_text) {
      return res.status(400).json({ error: 'Note text is required.' });
    }

    const customerCheck = await db.query(
      'SELECT id FROM customers WHERE id = $1 AND business_id = $2',
      [customerId, businessId]
    );
    if (customerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    const result = await db.query(
      `INSERT INTO customer_notes (customer_id, business_user_id, note_text)
       VALUES ($1, $2, $3)
       RETURNING id, note_text, created_at`,
      [customerId, userId, note_text]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding customer note:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// =========================================================================
// NEW: GET /api/customers/:id/activity-feed (Unified Chronological timeline)
// =========================================================================
router.get('/customers/:id/activity-feed', requireAuth, async (req, res) => {
  try {
    const customerId = req.params.id;
    const businessId = req.user.business_id;

    const customerCheck = await db.query(
      'SELECT id, external_user_id FROM customers WHERE id = $1 AND business_id = $2',
      [customerId, businessId]
    );
    if (customerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found.' });
    }
    const customer = customerCheck.rows[0];

    const feedQuery = `
      WITH timeline AS (
        -- 1. CRM Notes
        SELECT 
          n.id::text AS id,
          'note' AS type, 
          u.name AS actor, 
          n.note_text AS content, 
          n.created_at
        FROM customer_notes n
        JOIN business_users u ON n.business_user_id = u.id
        WHERE n.customer_id = $1
        
        UNION ALL
        
        -- 2. Email Outreach Alerts
        SELECT 
          i.id::text AS id,
          'intervention' AS type, 
          'System' AS actor, 
          i.type || ': ' || i.details AS content, 
          i.sent_at AS created_at
        FROM interventions i
        WHERE i.customer_id = $1
        
        UNION ALL
        
        -- 3. Raw Platform Usage Events
        SELECT 
          e.id::text AS id,
          'event' AS type, 
          e.standardized_metric_type AS actor, 
          e.native_action_label AS content, 
          e.created_at
        FROM usage_events e
        WHERE e.business_id = $2 AND e.external_user_id = $3
      )
      SELECT * FROM timeline
      ORDER BY created_at DESC
      LIMIT 50;
    `;

    const feedRes = await db.query(feedQuery, [customerId, businessId, customer.external_user_id]);
    return res.json(feedRes.rows);

  } catch (error) {
    console.error('Error fetching activity feed:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// =========================================================================
// NEW: POST /api/customers/:id/simulate - ML Simulation Playground
// =========================================================================
router.post('/customers/:id/simulate', requireAuth, async (req, res) => {
  try {
    const customerId = req.params.id;
    const businessId = req.user.business_id;
    const { engagement_delta_7d, negative_event_ratio, days_since_last_interaction, contract_weight_index } = req.body;

    if (
      engagement_delta_7d === undefined || 
      negative_event_ratio === undefined || 
      days_since_last_interaction === undefined || 
      contract_weight_index === undefined
    ) {
      return res.status(400).json({ error: 'All 4 simulation features are required.' });
    }

    const customerCheck = await db.query(
      'SELECT id FROM customers WHERE id = $1 AND business_id = $2',
      [customerId, businessId]
    );
    if (customerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const scriptPath = path.join(__dirname, '..', 'ml', 'simulate_inference.py');
    
    // Command formats inputs: python simulate_inference.py <f1> <f2> <f3> <f4>
    const cmd = `"${pythonCmd}" "${scriptPath}" ${parseFloat(engagement_delta_7d)} ${parseFloat(negative_event_ratio)} ${parseFloat(days_since_last_interaction)} ${parseFloat(contract_weight_index)}`;
    
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error('Simulation execution failed:', error);
        return res.status(500).json({ error: 'Failed running ML model simulation.' });
      }
      try {
        const result = JSON.parse(stdout.trim());
        if (result.error) {
          return res.status(400).json({ error: result.error });
        }
        
        const prob = result.churn_risk_probability;
        return res.json({
          customerId,
          simulated_churn_risk_probability: prob,
          risk_classification_status: prob >= 0.75 ? 'CRITICAL' : (prob >= 0.40 ? 'AT_RISK' : 'HEALTHY')
        });
      } catch (parseErr) {
        console.error('Failed parsing simulation output:', parseErr, 'stdout:', stdout);
        return res.status(500).json({ error: 'Error parsing simulation prediction.' });
      }
    });

  } catch (error) {
    console.error('Error in simulation endpoint:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// =========================================================================
// NEW: GET /api/customers/:id/history - Time-series Risk Score Log
// =========================================================================
router.get('/customers/:id/history', requireAuth, async (req, res) => {
  try {
    const customerId = req.params.id;
    const businessId = req.user.business_id;

    const customerCheck = await db.query(
      'SELECT id FROM customers WHERE id = $1 AND business_id = $2',
      [customerId, businessId]
    );
    if (customerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    const historyRes = await db.query(
      `SELECT churn_risk_probability, computed_at 
       FROM customer_risk_history 
       WHERE customer_id = $1 
       ORDER BY computed_at ASC 
       LIMIT 30`,
      [customerId]
    );

    return res.json(historyRes.rows);
  } catch (error) {
    console.error('Error fetching customer risk history:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// =========================================================================
// NEW: GET /api/model-health - MLOps Analytics & Feature Drift
// =========================================================================
router.get('/model-health', requireAuth, async (req, res) => {
  try {
    const businessId = req.user.business_id;

    // 1. Get current risk buckets and user counts
    const distRes = await db.query(
      `SELECT risk_classification_status, COUNT(*) as count 
       FROM customers 
       WHERE business_id = $1 
       GROUP BY risk_classification_status`,
      [businessId]
    );
    
    const distribution = { HEALTHY: 0, AT_RISK: 0, CRITICAL: 0 };
    let totalUsers = 0;
    distRes.rows.forEach(r => {
      distribution[r.risk_classification_status] = parseInt(r.count);
      totalUsers += parseInt(r.count);
    });

    const avgProbRes = await db.query(
      `SELECT COALESCE(AVG(churn_risk_probability), 0) as avg_prob 
       FROM customers 
       WHERE business_id = $1`,
      [businessId]
    );
    const averageRisk = parseFloat(avgProbRes.rows[0].avg_prob);

    // 2. Fetch event counts (30 days vs 7 days) to evaluate feature drift
    const statsRes = await db.query(`
      WITH events_30d AS (
        SELECT 
          COUNT(*)::double precision / 30.0 / NULLIF($2, 0) AS daily_avg_30d,
          COUNT(CASE WHEN standardized_metric_type = 'ENGAGEMENT_DROP' THEN 1 END)::double precision / NULLIF(COUNT(*), 0) AS neg_ratio_30d
        FROM usage_events
        WHERE business_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
      ),
      events_7d AS (
        SELECT 
          COUNT(*)::double precision / 7.0 / NULLIF($2, 0) AS daily_avg_7d,
          COUNT(CASE WHEN standardized_metric_type = 'ENGAGEMENT_DROP' THEN 1 END)::double precision / NULLIF(COUNT(*), 0) AS neg_ratio_7d
        FROM usage_events
        WHERE business_id = $1 AND created_at >= NOW() - INTERVAL '7 days'
      )
      SELECT 
        COALESCE(daily_avg_30d, 0) as daily_avg_30d,
        COALESCE(neg_ratio_30d, 0) as neg_ratio_30d,
        COALESCE(daily_avg_7d, 0) as daily_avg_7d,
        COALESCE(neg_ratio_7d, 0) as neg_ratio_7d
      FROM events_30d, events_7d
    `, [businessId, totalUsers]);

    const featuresStats = statsRes.rows[0] || { daily_avg_30d: 0, neg_ratio_30d: 0, daily_avg_7d: 0, neg_ratio_7d: 0 };

    // Calculate Feature Drift Percentage
    const dailyEventsDrift = featuresStats.daily_avg_30d > 0 
      ? Math.abs(featuresStats.daily_avg_7d - featuresStats.daily_avg_30d) / featuresStats.daily_avg_30d 
      : 0.0;
      
    const negRatioDrift = featuresStats.neg_ratio_30d > 0
      ? Math.abs(featuresStats.neg_ratio_7d - featuresStats.neg_ratio_30d) / featuresStats.neg_ratio_30d
      : 0.0;

    const maxDrift = Math.max(dailyEventsDrift, negRatioDrift);
    let driftStatus = 'STABLE';
    if (maxDrift > 0.25) {
      driftStatus = 'ACTION_REQUIRED';
    } else if (maxDrift > 0.10) {
      driftStatus = 'WARNING';
    }

    return res.json({
      modelName: "churnshield_v1.joblib",
      modelType: "RandomForest/XGBoost",
      status: "HEALTHY",
      driftStatus,
      metrics: {
        averageRisk,
        totalScoredUsers: totalUsers,
        accuracyBaseline: 0.965,
        lastTrained: "2026-06-20"
      },
      driftFeatures: [
        {
          featureName: "engagement_delta_7d (Daily Ingestions)",
          baseline_30d: parseFloat(featuresStats.daily_avg_30d.toFixed(3)),
          active_7d: parseFloat(featuresStats.daily_avg_7d.toFixed(3)),
          driftPercent: parseFloat((dailyEventsDrift * 100).toFixed(2))
        },
        {
          featureName: "negative_event_ratio (Engagement Drops)",
          baseline_30d: parseFloat(featuresStats.neg_ratio_30d.toFixed(3)),
          active_7d: parseFloat(featuresStats.neg_ratio_7d.toFixed(3)),
          driftPercent: parseFloat((negRatioDrift * 100).toFixed(2))
        }
      ]
    });

  } catch (error) {
    console.error('Error fetching model health metrics:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// =========================================================================
// POST /api/developer/webhooks/test - Webhook Sandbox Deliverability
// =========================================================================
router.post('/webhooks/test', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const businessId = req.user.business_id;

    // Fetch config
    const businessQuery = await db.query(
      'SELECT name, webhook_url, webhook_secret FROM businesses WHERE id = $1',
      [businessId]
    );
    const business = businessQuery.rows[0];

    if (!business || !business.webhook_url) {
      return res.status(400).json({ error: 'Webhook URL not configured. Configure it in settings first.' });
    }

    const payload = {
      event: "webhook_test",
      business_id: businessId,
      business_name: business.name,
      message: "This is a signed deliverability test payload from your ChurnShield sandbox.",
      fired_at: new Date().toISOString()
    };

    const payloadStr = JSON.stringify(payload);
    const secret = business.webhook_secret || "default_secret";
    
    // HMAC Signature
    const signature = crypto
      .createHmac('sha256', secret)
      .update(payloadStr)
      .digest('hex');

    const headers = {
      'Content-Type': 'application/json',
      'X-ChurnShield-Signature': `sha256=${signature}`
    };

    const startTime = Date.now();
    let responseStatus = null;
    let responseHeaders = {};
    let responseBody = '';
    let errorMessage = null;

    try {
      const fetchResponse = await fetch(business.webhook_url, {
        method: 'POST',
        headers: headers,
        body: payloadStr,
        signal: AbortSignal.timeout(5000) // Timeout after 5 seconds
      });

      responseStatus = fetchResponse.status;
      
      // Parse Headers map
      fetchResponse.headers.forEach((value, name) => {
        responseHeaders[name] = value;
      });

      responseBody = await fetchResponse.text();
      if (responseBody.length > 500) {
        responseBody = responseBody.substring(0, 500) + '... (truncated)';
      }
    } catch (fetchError) {
      errorMessage = fetchError.message;
    }

    const responseTimeMs = Date.now() - startTime;

    return res.json({
      url: business.webhook_url,
      success: errorMessage === null && responseStatus >= 200 && responseStatus < 300,
      responseTimeMs,
      status: responseStatus,
      errorMessage,
      headers: responseHeaders,
      body: responseBody
    });

  } catch (error) {
    console.error('Error in webhook deliverability test:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// =========================================================================
// NEW: GET /api/customers/:id/interventions - Outreach history logs
// =========================================================================
router.get('/customers/:id/interventions', requireAuth, async (req, res) => {
  try {
    const customerId = req.params.id;
    const businessId = req.user.business_id;

    const customerCheck = await db.query(
      'SELECT id FROM customers WHERE id = $1 AND business_id = $2',
      [customerId, businessId]
    );
    if (customerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    const result = await db.query(
      `SELECT id, type, status, details, sent_at 
       FROM interventions 
       WHERE customer_id = $1 AND business_id = $2 
       ORDER BY sent_at DESC`,
      [customerId, businessId]
    );

    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching customer interventions:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// =========================================================================
// NEW: GET /api/overview/pdf-report - Stream Executive PDF Summary
// =========================================================================
router.get('/overview/pdf-report', requireAuth, async (req, res) => {
  try {
    const businessId = req.user.business_id;
    // 1. Fetch core KPI stats
    const statsQuery = `
      SELECT 
        COUNT(*) AS total_customers,
        COALESCE(SUM(monthly_contract_value), 0) AS total_revenue,
        COALESCE(SUM(CASE WHEN risk_classification_status = 'CRITICAL' THEN monthly_contract_value ELSE 0 END), 0) AS revenue_at_risk
      FROM customers
      WHERE business_id = $1
    `;
    const statsRes = await db.query(statsQuery, [businessId]);
    const stats = statsRes.rows[0];
    // 2. Fetch risk bucket distribution
    const breakdownQuery = `
      SELECT risk_classification_status AS status, COUNT(*) AS count
      FROM customers
      WHERE business_id = $1
      GROUP BY risk_classification_status
    `;
    const breakdownRes = await db.query(breakdownQuery, [businessId]);
    
    const statusCounts = { HEALTHY: 0, AT_RISK: 0, CRITICAL: 0 };
    breakdownRes.rows.forEach(row => {
      statusCounts[row.status] = parseInt(row.count);
    });
    // 3. Fetch top 5 at-risk accounts
    const topRiskQuery = `
      SELECT external_user_id, churn_risk_probability, risk_classification_status, monthly_contract_value
      FROM customers
      WHERE business_id = $1
      ORDER BY churn_risk_probability DESC
      LIMIT 5
    `;
    const topRiskRes = await db.query(topRiskQuery, [businessId]);
    // 4. Initialize PDF document
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=ChurnShield_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    doc.pipe(res);
    // Document header banner
    doc.fontSize(24).fillColor('#6366f1').text('🛡️ ChurnShield Executive Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#475569').text(`Business Portal ID: ${businessId}`, { align: 'center' });
    doc.text(`Generated on: ${new Date().toUTCString()}`, { align: 'center' });
    doc.moveDown(1.5);
    // Section 1: KPI Summary
    doc.fontSize(16).fillColor('#0f172a').text('1. KPI Dashboard Summary', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor('#1e293b');
    doc.text(`• Total Monitored Customers: ${stats.total_customers}`);
    doc.text(`• Total Portfolio Contract Value: $${parseFloat(stats.total_revenue).toLocaleString(undefined, { minimumFractionDigits: 2 })}`);
    doc.text(`• Total Revenue at Critical Risk: $${parseFloat(stats.revenue_at_risk).toLocaleString(undefined, { minimumFractionDigits: 2 })}`);
    doc.moveDown(1.5);
    // Section 2: Segmentation distribution
    doc.fontSize(16).fillColor('#0f172a').text('2. Portfolio Risk Segmentation', { underline: true });
    doc.moveDown(0.5);
    doc.text(`• HEALTHY (Low Risk): ${statusCounts.HEALTHY} accounts`);
    doc.text(`• AT RISK (Medium Risk): ${statusCounts.AT_RISK} accounts`);
    doc.text(`• CRITICAL (High Risk): ${statusCounts.CRITICAL} accounts`);
    doc.moveDown(1.5);
    // Section 3: Risk Table
    doc.fontSize(16).fillColor('#0f172a').text('3. Top 5 Churn Threat Accounts', { underline: true });
    doc.moveDown(0.5);
    // Render table headers
    doc.fontSize(10).fillColor('#475569');
    let y = doc.y;
    doc.text('Customer ID', 50, y);
    doc.text('Contract Value', 180, y);
    doc.text('Risk Category', 300, y);
    doc.text('Risk Score (%)', 420, y);
    
    // Header divider line
    doc.moveTo(50, y + 15).lineTo(550, y + 15).strokeColor('#cbd5e1').stroke();
    doc.moveDown(1);
    // Render table rows
    doc.fillColor('#1e293b');
    topRiskRes.rows.forEach(cust => {
      y = doc.y;
      doc.text(cust.external_user_id, 50, y);
      doc.text(`$${parseFloat(cust.monthly_contract_value).toFixed(2)}`, 180, y);
      doc.text(cust.risk_classification_status, 300, y);
      doc.text(`${Math.round(cust.churn_risk_probability * 100)}%`, 420, y);
      doc.moveDown(1);
    });
    // Close document streaming
    doc.end();
  } catch (error) {
    console.error('Error generating executive PDF report:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router