const redis = require('redis');
require('dotenv').config();

const client = redis.createClient({
  url: process.env.REDIS_URL
});

client.on('error', (err) => {
  console.error('Redis Client Connection Error:', err);
});

client.on('connect', () => {
  console.log('Successfully connected to Redis');
});

// Asynchronously open connection
client.connect();

module.exports = client;