// services/redisClient.js
const { createClient } = require('redis');

const redisClient = createClient();

redisClient.on('error', (err) => console.error(`Redis error: ${err}`));

module.exports = { redisClient };
