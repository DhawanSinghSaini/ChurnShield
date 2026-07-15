const db = require('../config/db');
const redisClient = require('../config/redis');

const BATCH_SIZE = 100;
const POLL_INTERVAL_MS = 10000; // Run every 10 seconds

async function processBatch() {
  try {
    const poppedEvents = [];
    
    // Pop up to BATCH_SIZE items from the Redis list
    for (let i = 0; i < BATCH_SIZE; i++) {
      const eventStr = await redisClient.lPop('events_queue');
      if (!eventStr) break;
      poppedEvents.push(JSON.parse(eventStr));
    }

    if (poppedEvents.length === 0) {
      return; // Nothing to write
    }

    console.log(`Processing batch of ${poppedEvents.length} events...`);

    // Build a single bulk INSERT SQL query
    const values = [];
    const valuePlaceholders = [];
    let index = 1;

    for (const event of poppedEvents) {
      valuePlaceholders.push(`($${index}, $${index + 1}, $${index + 2}, $${index + 3}, $${index + 4})`);
      values.push(
        event.business_id,
        event.external_user_id,
        event.standardized_metric_type,
        event.native_action_label,
        event.created_at
      );
      index += 5;
    }

    const queryText = `
      INSERT INTO usage_events (business_id, external_user_id, standardized_metric_type, native_action_label, created_at)
      VALUES ${valuePlaceholders.join(', ')}
    `;

    await db.query(queryText, values);
    console.log(`Successfully bulk-inserted ${poppedEvents.length} events into database.`);

  } catch (error) {
    console.error('Error during batch writing process:', error);
  }
}

// Background loop function
async function startWorker() {
  console.log('ChurnShield Batch Event Writer started.');
  
  // Run immediately on start, then loop
  await processBatch();
  
  setInterval(async () => {
    await processBatch();
  }, POLL_INTERVAL_MS);
}

// Ensure database and Redis are loaded before loop starts
setTimeout(() => {
  startWorker();
}, 2000);