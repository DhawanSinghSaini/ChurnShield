const express = require('express');
const router = express.Router();
const db = require('../config/db');
const redisClient = require('../config/redis');

// Helper function to log metrics to Redis with 30-day expiry
async function incrAnalytics(businessId, metric) {
  try {
    const dateStr = new Date().toISOString().split('T')[0];
    const key = `analytics:${businessId}:${dateStr}:${metric}`;
    const count = await redisClient.incr(key);
    if (count === 1) {
      await redisClient.expire(key, 2592000); // 30 days TTL
    }
  } catch (err) {
    console.error('Failed to log ingestion analytics to Redis:', err);
  }
}

// Helper function to validate API Key using Redis cache (fallback to DB)
async function validateApiKey(apiKey) {
  const cacheKey = `apikey:${apiKey}`;
  
  // 1. Try reading from cache
  let businessId = await redisClient.get(cacheKey);
  if (businessId) return businessId;

  // 2. Cache miss: Query Database
  const result = await db.query('SELECT id FROM businesses WHERE api_key = $1', [apiKey]);
  if (result.rows.length === 0) {
    return null;
  }
  
  businessId = result.rows[0].id;
  
  // 3. Cache the key in Redis for 24 hours (86400 seconds)
  await redisClient.setEx(cacheKey, 86400, businessId);
  return businessId;
}

router.post('/track', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const { user_id, action_label, event_type } = req.body;

    // 1. Header Validation
    if (!apiKey) {
      return res.status(401).json({ error: 'Unauthorized: Missing X-API-Key header.' });
    }

    // 2. Body Schema Validation
    if (!user_id || !action_label || !event_type) {
      return res.status(422).json({ error: 'Unprocessable Entity: Missing required payload fields.' });
    }
    if (event_type !== 'ENGAGEMENT_SUCCESS' && event_type !== 'ENGAGEMENT_DROP') {
      return res.status(422).json({ error: 'Unprocessable Entity: event_type must be ENGAGEMENT_SUCCESS or ENGAGEMENT_DROP.' });
    }

    // 3. API Key Validation
    const businessId = await validateApiKey(apiKey);
    if (!businessId) {
      return res.status(401).json({ error: 'Unauthorized: Invalid API Key.' });
    }

    // Increment Total Daily Ingestion Counter
    await incrAnalytics(businessId, 'total');

    // 4. Rate Limiting (Max 1000 requests per minute per business)
    const currentMinute = Math.floor(Date.now() / 60000);
    const rateKey = `ratelimit:${businessId}:${currentMinute}`;

    const requestCount = await redisClient.incr(rateKey);
    if (requestCount === 1) {
      await redisClient.expire(rateKey, 120); // 2 minutes window expiry
    }

    if (requestCount > 1000) {
      // Increment Rate Limited Analytics Counter
      await incrAnalytics(businessId, 'rate_limited');
      return res.status(429).json({ error: 'Too Many Requests: Rate limit exceeded.' });
    }

    // 5. Build queue payload
    const queuePayload = {
      business_id: businessId,
      external_user_id: user_id,
      standardized_metric_type: event_type,
      native_action_label: action_label,
      created_at: new Date().toISOString()
    };

    // 6. Push to Redis events queue list
    await redisClient.rPush('events_queue', JSON.stringify(queuePayload));

    // Increment Successful Ingestion Analytics Counter
    await incrAnalytics(businessId, 'success');

    // Return 202 Accepted
    return res.status(202).json({
      status: 'Accepted',
      message: 'Event queued successfully.'
    });

  } catch (error) {
    console.error('Error handling track event:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;