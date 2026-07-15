const nodemailer = require('nodemailer');
const db = require('../config/db');
const redisClient = require('../config/redis');

// Setup SMTP configuration (fallback to test Ethereal account if no env vars present)
async function getMailTransporter() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  } else {
    try {
      const testAccount = await nodemailer.createTestAccount();
      return nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
    } catch (e) {
      console.warn('[Daily Pulse] Failed to initialize Ethereal SMTP transporter:', e.message);
      return null;
    }
  }
}

async function runDailyPulse() {
  console.log('[Daily Pulse] Triggering Daily Pulse Summary reports...');
  try {
    const transporter = await getMailTransporter();
    
    // Get yesterday's date string YYYY-MM-DD
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Fetch all business tenants
    const businessesRes = await db.query('SELECT id, name FROM businesses');
    const businesses = businessesRes.rows;

    for (const bus of businesses) {
      console.log(`[Daily Pulse] Compiling summary digest for: ${bus.name} (${bus.id})`);

      // 1. Fetch risk segmentation counts
      const countsQuery = `
        SELECT 
          COUNT(*) AS total,
          COALESCE(SUM(CASE WHEN risk_classification_status = 'HEALTHY' THEN 1 ELSE 0 END), 0) AS healthy,
          COALESCE(SUM(CASE WHEN risk_classification_status = 'AT_RISK' THEN 1 ELSE 0 END), 0) AS at_risk,
          COALESCE(SUM(CASE WHEN risk_classification_status = 'CRITICAL' THEN 1 ELSE 0 END), 0) AS critical
        FROM customers
        WHERE business_id = $1
      `;
      const countsRes = await db.query(countsQuery, [bus.id]);
      const counts = countsRes.rows[0];

      // 2. Fetch new critical risk customers flagged in past 24 hours
      const alertsQuery = `
        SELECT external_user_id, churn_risk_probability
        FROM customers
        WHERE business_id = $1 
          AND risk_classification_status = 'CRITICAL'
          AND last_computed_at >= NOW() - INTERVAL '24 hours'
        ORDER BY churn_risk_probability DESC
        LIMIT 5
      `;
      const alertsRes = await db.query(alertsQuery, [bus.id]);
      const activeAlerts = alertsRes.rows;

      // 3. Fetch daily events count metrics from Redis
      const successCount = await redisClient.get(`analytics:${bus.id}:${yesterdayStr}:success`) || 0;
      const limitedCount = await redisClient.get(`analytics:${bus.id}:${yesterdayStr}:rate_limited`) || 0;

      // 4. Retrieve administrator list
      const usersQuery = await db.query(
        "SELECT email FROM business_users WHERE business_id = $1 AND role = 'ADMIN'",
        [bus.id]
      );
      const adminEmails = usersQuery.rows.map(u => u.email);

      // Console logger summary fallback
      const pulseSummaryLog = `
=================================================
🛡️ CHURNSHIELD DAILY PULSE: ${bus.name.toUpperCase()}
Date: ${new Date().toDateString()}
-------------------------------------------------
- Total Monitored Customers: ${counts.total}
- HEALTHY: ${counts.healthy} | AT RISK: ${counts.at_risk} | CRITICAL: ${counts.critical}
- Ingested Events (Yesterday): ${successCount} processed, ${limitedCount} rate-limited.
- New Critical Churn Alerts Flagged: ${activeAlerts.length} accounts.
=================================================`;
      console.log(pulseSummaryLog);

      if (adminEmails.length === 0) {
        console.log(`[Daily Pulse] No Admin users configured for ${bus.name}. Skipping email dispatch.`);
        continue;
      }

      // 5. Compose HTML Email Digest
      let newAlertsHtml = '<ul>';
      if (activeAlerts.length > 0) {
        newAlertsHtml += activeAlerts.map(a => `<li>Customer <strong>${a.external_user_id}</strong> (Risk Score: ${Math.round(a.churn_risk_probability * 100)}%)</li>`).join('');
      } else {
        newAlertsHtml += '<li>No new critical alerts flagged today.</li>';
      }
      newAlertsHtml += '</ul>';

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #cbd5e1; padding: 24px; border-radius: 12px; color: #1e293b;">
          <h2 style="color: #6366f1; margin-top: 0; font-size: 22px;">🛡️ ChurnShield Daily Pulse Digest</h2>
          <p>Here is your daily portfolio overview for <strong>${bus.name}</strong> as of ${new Date().toLocaleDateString()}.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <tr style="background: #f8fafc;">
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold;">Metric</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; text-align: center;">Count</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e2e8f0;">Total Monitored Customers</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">${counts.total}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e2e8f0; color: #10b981;">HEALTHY Status</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center; color: #10b981; font-weight: bold;">${counts.healthy}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e2e8f0; color: #f59e0b;">AT RISK Status</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center; color: #f59e0b; font-weight: bold;">${counts.at_risk}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e2e8f0; color: #ef4444;">CRITICAL Status</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center; color: #ef4444; font-weight: bold;">${counts.critical}</td>
            </tr>
            <tr style="background: #f8fafc;">
              <td style="padding: 10px; border: 1px solid #e2e8f0;">Events Processed (Yesterday)</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">${successCount}</td>
            </tr>
          </table>

          <h3 style="color: #0f172a; margin-bottom: 8px;">Top Churn Risk Alerts (Last 24 Hours):</h3>
          ${newAlertsHtml}

          <div style="margin-top: 32px; text-align: center;">
            <a href="https://churnshield-7we8.onrender.com/api/overview/pdf-report" style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Download Executive PDF Summary</a>
          </div>
        </div>
      `;

      if (transporter) {
        try {
          const info = await transporter.sendMail({
            from: '"ChurnShield Digest" <pulse@churnshield.com>',
            to: adminEmails.join(', '),
            subject: `🛡️ Daily Pulse: ${bus.name} - Churn Portfolio Summary`,
            html: emailHtml
          });
          const previewUrl = nodemailer.getTestMessageUrl(info);
          if (previewUrl) {
            console.log(`[Daily Pulse] Email Digest Sent! Preview URL: ${previewUrl}`);
          }
        } catch (mailErr) {
          console.error(`[Daily Pulse] Failed to send email digest for ${bus.name}:`, mailErr.message);
        }
      }
    }

  } catch (error) {
    console.error('[Daily Pulse] Failed executing Daily Pulse run:', error);
  }
}

module.exports = { runDailyPulse };
