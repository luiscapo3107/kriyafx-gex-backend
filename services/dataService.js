// services/dataService.js
const axios = require('axios');
const { redisClient } = require('./redisClient');
const prepareData = require('../utils/dataPreparation');
const config = require('../config/config');

const fetchFinancialData = () => {
  setInterval(async () => {
    try {
      const response = await axios.get(
        `https://api.marketdata.app/v1/options/chain/${config.ticker}?dte=${config.daysToExpire}&strikeLimit=${config.levelsOfStrike}&token=${config.token}`
      );
      let data = response.data;

      const timestamp = data.updated[0];

      data = prepareData(data);
      console.log('Prepared data from endpoint:', data);

      // Store data in Redis sorted set with timestamp as the score
      await redisClient.zAdd('options_chain_data_zset', {
        score: timestamp,
        value: JSON.stringify(data),
      });

      // Limit the size of the sorted set
      const maxEntries = config.redisMaxEntries;
      const totalEntries = await redisClient.zCard('options_chain_data_zset');
      if (totalEntries > maxEntries) {
        await redisClient.zRemRangeByRank('options_chain_data_zset', 0, totalEntries - maxEntries - 1);
      }

      console.log('Financial data updated in Redis');
    } catch (error) {
      console.error(`Error fetching financial data: ${error}`);
    }
  }, config.retrieveInterval);
};

module.exports = fetchFinancialData;
