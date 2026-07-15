const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const db = require('../config/db');
const redisClient = require('../config/redis');
const { requireAuth, requireRole } = require('../middleware/auth');

// 1. POST /api/keys - ADMIN only
router.post('/keys', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const businessId = req.business.id;
    const newApiKey = `cs_live_${crypto.randomBytes(16).toString('hex')}`;

    const businessQuery = await db.query('SELECT api_key FROM businesses WHERE id = $1', [businessId]);
    const oldApiKey = businessQuery.rows[0]?.api_key;
    
    if (oldApiKey) {
      await redisClient.del(`apikey:${oldApiKey}`);
    }

    await db.query('UPDATE businesses SET api_key = $1 WHERE id = $2', [newApiKey, businessId]);

    const cacheKey = `apikey:${newApiKey}`;
    await redisClient.setEx(cacheKey, 86400, businessId);

    return res.json({
      message: 'API Key generated successfully.',
      api_key: newApiKey
    });

  } catch (error) {
    console.error('Error generating API key:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 2. DELETE /api/keys - ADMIN only
router.delete('/keys', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const businessId = req.business.id;

    const businessQuery = await db.query('SELECT api_key FROM businesses WHERE id = $1', [businessId]);
    const currentKey = businessQuery.rows[0]?.api_key;

    if (currentKey) {
      await redisClient.del(`apikey:${currentKey}`);
    }

    await db.query('UPDATE businesses SET api_key = NULL WHERE id = $1', [businessId]);

    return res.json({ message: 'API Key revoked successfully.' });

  } catch (error) {
    console.error('Error revoking API key:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// NEW: GET /api/keys - ADMIN only to retrieve current API key
router.get('/keys', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const businessId = req.business.id;
    const result = await db.query('SELECT api_key FROM businesses WHERE id = $1', [businessId]);
    return res.json({ api_key: result.rows[0]?.api_key || null });
  } catch (error) {
    console.error('Error retrieving API key:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// NEW: GET /api/developer/webhook-config - Retrieve webhook URL and secret
router.get('/developer/webhook-config', requireAuth, async (req, res) => {
  try {
    const businessId = req.user.business_id;
    const result = await db.query('SELECT webhook_url, webhook_secret FROM businesses WHERE id = $1', [businessId]);
    return res.json(result.rows[0] || { webhook_url: null, webhook_secret: null });
  } catch (error) {
    console.error('Error retrieving webhook config:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// NEW: PUT /api/developer/webhook-config - Update webhook URL and secret (ADMIN only)
router.put('/developer/webhook-config', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const businessId = req.business.id;
    const { webhook_url, webhook_secret } = req.body;

    await db.query(
      'UPDATE businesses SET webhook_url = $1, webhook_secret = $2 WHERE id = $3',
      [webhook_url || null, webhook_secret || null, businessId]
    );

    return res.json({ message: 'Webhook configuration updated successfully.' });
  } catch (error) {
    console.error('Error updating webhook config:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// =========================================================================
// NEW: GET /api/developer/metrics - Past 7 days of Redis Ingestion Analytics
// =========================================================================
router.get('/developer/metrics', requireAuth, async (req, res) => {
  try {
    const businessId = req.user.business_id;
    const metrics = [];
    
    // Get last 7 UTC days (including today)
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const dateStr = d.toISOString().split('T')[0];

      const successVal = await redisClient.get(`analytics:${businessId}:${dateStr}:success`) || 0;
      const rateLimitedVal = await redisClient.get(`analytics:${businessId}:${dateStr}:rate_limited`) || 0;
      const totalVal = await redisClient.get(`analytics:${businessId}:${dateStr}:total`) || 0;

      metrics.push({
        date: dateStr,
        success: parseInt(successVal),
        rate_limited: parseInt(rateLimitedVal),
        total: parseInt(totalVal)
      });
    }

    return res.json(metrics);
  } catch (error) {
    console.error('Error fetching developer metrics:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;