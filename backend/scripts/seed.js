const db = require('../config/db');
const redisClient = require('../config/redis');
const bcrypt = require('bcryptjs');

async function seed() {
  console.log("Starting database seeding...");
  
  try {
    // 1. Clear existing data
    await db.query('TRUNCATE usage_events, customer_risk_history, customer_notes, interventions, customers, business_users, businesses CASCADE;');
    console.log("Database cleared.");

    // 2. Hash Password
    const hashedPassword = await bcrypt.hash('password123', 10);

    // 3. Create Businesses
    const businesses = [
      { name: 'FlixStream', email: 'streaming@flixstream.com', api_key: 'cs_live_streamingkey123', vertical: 'Streaming' },
      { name: 'LearnFlow', email: 'edtech@learnflow.com', api_key: 'cs_live_edtechkey123', vertical: 'EdTech' },
      { name: 'ShopSaaS', email: 'saas@shopsaas.com', api_key: 'cs_live_saaskey123', vertical: 'SaaS' }
    ];

    const seededBusinesses = [];
    for (const b of businesses) {
      const res = await db.query(
        `INSERT INTO businesses (name, email, hashed_password, api_key, industry_vertical) 
         VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, api_key`,
        [b.name, b.email, hashedPassword, b.api_key, b.vertical]
      );
      const business = res.rows[0];
      seededBusinesses.push(business);

      // Cache API key in Redis
      await redisClient.setEx(`apikey:${business.api_key}`, 86400, business.id);

      // 4. Create Business Users (1 Admin and 1 Viewer per business)
      // ADMIN
      await db.query(
        `INSERT INTO business_users (business_id, name, email, hashed_password, role)
         VALUES ($1, $2, $3, $4, 'ADMIN')`,
        [business.id, `${business.name} Admin`, business.email, hashedPassword]
      );

      // VIEWER (For RBAC testing)
      const viewerEmail = business.email.replace('@', '_viewer@');
      await db.query(
        `INSERT INTO business_users (business_id, name, email, hashed_password, role)
         VALUES ($1, $2, $3, $4, 'VIEWER')`,
        [business.id, `${business.name} Viewer`, viewerEmail, hashedPassword]
      );
    }
    console.log(`Seeded 3 businesses and 6 business users (3 Admins, 3 Viewers).`);

    // 5. Create Customers & Events (30 Days History)
    let totalEvents = 0;
    const now = new Date();

    for (const bus of seededBusinesses) {
      console.log(`Generating data for Business ID: ${bus.id}...`);

      for (let i = 1; i <= 200; i++) {
        const externalUserId = `user_${i}`;
        const mcv = (Math.random() * (199.99 - 9.99) + 9.99).toFixed(2);
        
        const isChurner = i % 4 === 0; 

        // Insert Customer
        await db.query(
          `INSERT INTO customers (business_id, external_user_id, monthly_contract_value) 
           VALUES ($1, $2, $3)`,
          [bus.id, externalUserId, mcv]
        );

        // Generate 30 days of events
        for (let day = 30; day >= 1; day--) {
          const eventDate = new Date(now.getTime() - day * 24 * 60 * 60 * 1000);
          
          if (isChurner && day < 15) {
            continue;
          }

          const dailyEventsCount = isChurner ? (Math.random() > 0.6 ? 1 : 0) : Math.floor(Math.random() * 4) + 1;
          
          for (let j = 0; j < dailyEventsCount; j++) {
            let metricType = 'ENGAGEMENT_SUCCESS';
            let actionLabel = 'page_view';

            if (Math.random() > 0.85) {
              metricType = 'ENGAGEMENT_DROP';
              actionLabel = Math.random() > 0.5 ? 'payment_failure' : 'slow_loading_warning';
            } else {
              actionLabel = Math.random() > 0.5 ? 'lesson_watched' : 'dashboard_interaction';
            }

            await db.query(
              `INSERT INTO usage_events (business_id, external_user_id, standardized_metric_type, native_action_label, created_at) 
               VALUES ($1, $2, $3, $4, $5)`,
              [bus.id, externalUserId, metricType, actionLabel, eventDate]
            );
            totalEvents++;
          }
        }
      }
    }

    console.log(`Successfully seeded ${totalEvents} usage events.`);
    console.log("Database seeding completed successfully!");

  } catch (error) {
    console.error("Error seeding database:", error);
  } finally {
    await redisClient.quit();
    process.exit();
  }
}

seed();