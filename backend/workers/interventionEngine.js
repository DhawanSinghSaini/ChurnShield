const nodemailer = require('nodemailer');
const db = require('../config/db');

// Setup Ethereal dynamic mail testing if SMTP env vars are absent
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
    const testAccount = await nodemailer.createTestAccount();
    console.log(`[Intervention] Dynamic Ethereal SMTP configured. User: ${testAccount.user}`);
    return nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
  }
}

async function runInterventionEngine() {
  console.log('[Intervention] Checking for new critical risk customer interventions...');
  try {
    const transporter = await getMailTransporter();

    // Query critical customers who have NOT had an EMAIL_ALERT in the past 24 hours
    const criticalQuery = `
      SELECT 
        c.id AS customer_id, 
        c.business_id, 
        c.external_user_id, 
        c.churn_risk_probability, 
        c.risk_classification_status,
        c.shap_explanation,
        b.name AS business_name,
        b.email AS business_email
      FROM customers c
      JOIN businesses b ON c.business_id = b.id
      WHERE c.risk_classification_status = 'CRITICAL'
        AND c.id NOT IN (
          SELECT DISTINCT customer_id 
          FROM interventions 
          WHERE type = 'EMAIL_ALERT' 
            AND sent_at >= NOW() - INTERVAL '24 hours'
        )
    `;

    const criticalRes = await db.query(criticalQuery);
    const criticalList = criticalRes.rows;

    if (criticalList.length === 0) {
      console.log('[Intervention] No new critical customers requiring alerts.');
      return;
    }

    console.log(`[Intervention] Found ${criticalList.length} new critical accounts. Dispatching alerts...`);

    for (const customer of criticalList) {
      // Fetch CS representatives (team users) to mail alerts to
      const usersQuery = await db.query(
        'SELECT email, name FROM business_users WHERE business_id = $1',
        [customer.business_id]
      );
      const recipientEmails = usersQuery.rows.map(u => u.email);
      
      if (recipientEmails.length === 0) {
        recipientEmails.push(customer.business_email);
      }

      // Format SHAP explanations into email list
      let reasonsHtml = '';
      try {
        const shapData = typeof customer.shap_explanation === 'string' 
          ? JSON.parse(customer.shap_explanation) 
          : customer.shap_explanation;
          
        if (Array.isArray(shapData) && shapData.length > 0) {
          reasonsHtml = '<ul>' + shapData.map(r => `<li><strong>${r.feature}</strong>: ${r.label} (Impact: ${r.impact})</li>`).join('') + '</ul>';
        } else {
          reasonsHtml = '<p>No risk parameters provided.</p>';
        }
      } catch (e) {
        reasonsHtml = '<p>Failed loading risk details.</p>';
      }

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #e2e8f0; padding: 24px; border-radius: 8px;">
          <h2 style="color: #ef4444; margin-top: 0;">⚠️ ChurnShield Critical Risk Alert</h2>
          <p>An automated churn threat has been detected for <strong>${customer.business_name}</strong>.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
          <p><strong>Customer ID:</strong> ${customer.external_user_id}</p>
          <p><strong>Churn Risk Probability:</strong> <span style="font-size: 18px; font-weight: bold; color: #ef4444;">${Math.round(customer.churn_risk_probability * 100)}%</span></p>
          <p><strong>Status:</strong> CRITICAL</p>
          
          <h3 style="margin-top: 24px; color: #1e293b;">Primary Risk Drivers (SHAP Explanations):</h3>
          ${reasonsHtml}
          
          <div style="margin-top: 32px; text-align: center;">
            <a href="https://churn-shield-lime.vercel.app/dashboard/customers/${customer.customer_id}" style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Customer Profile</a>
          </div>
        </div>
      `;

      try {
        const info = await transporter.sendMail({
          from: '"ChurnShield Alert" <alerts@churnshield.com>',
          to: recipientEmails.join(', '),
          subject: `⚠️ Churn Alert: Customer ${customer.external_user_id} is at ${Math.round(customer.churn_risk_probability * 100)}% Risk`,
          html: emailHtml
        });

        // Output review URL for local debugging testing
        const testUrl = nodemailer.getTestMessageUrl(info);
        if (testUrl) {
          console.log(`[Intervention] Test Mail Sent! Preview URL: ${testUrl}`);
        }

        // Insert Sent Log
        await db.query(
          `INSERT INTO interventions (customer_id, business_id, type, status, details)
           VALUES ($1, $2, 'EMAIL_ALERT', 'SENT', $3)`,
          [
            customer.customer_id, 
            customer.business_id, 
            `Email notification sent to: ${recipientEmails.join(', ')}. SMTP ID: ${info.messageId}`
          ]
        );

      } catch (mailError) {
        console.error(`[Intervention] Failed to send alert email for customer ${customer.external_user_id}:`, mailError);
        
        // Insert Failed Log
        await db.query(
          `INSERT INTO interventions (customer_id, business_id, type, status, details)
           VALUES ($1, $2, 'EMAIL_ALERT', 'FAILED', $3)`,
          [
            customer.customer_id, 
            customer.business_id, 
            `Failed sending email: ${mailError.message}`
          ]
        );
      }
    }

  } catch (error) {
    console.error('[Intervention] Error in intervention loop:', error);
  }
}

module.exports = { runInterventionEngine };
