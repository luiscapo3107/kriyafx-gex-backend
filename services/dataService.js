//TODO - test refactoring 

const fetchFinancialData = require('./utils/financialData');

module.exports = fetchFinancialData;

/*
// services/dataService.js
const axios = require('axios');
const { redisClient } = require('./redisClient');
const prepareData = require('../utils/dataPreparation');
const config = require('../config/config');
const { DateTime } = require('luxon'); // Import DateTime

const isMarketOpen = async () => {
    try {
      // Get current time in CET/CEST
      const nowCET = DateTime.now().setZone('Europe/Berlin');
  
      // Define the start and end times in CET/CEST
      const marketOpenTime = nowCET.set({ hour: 15, minute: 25, second: 0, millisecond: 0 });
      const marketCloseTime = nowCET.set({ hour: 22, minute: 30, second: 0, millisecond: 0 });
  
      // Check if current time is between marketOpenTime and marketCloseTime
      const isWithinMarketHours = nowCET >= marketOpenTime && nowCET <= marketCloseTime;
  
      if (!isWithinMarketHours) {
        console.log('Outside specified hours. Skipping market status check.');
        return false;
      }
  
      // Now, check the market status from the API
      const response = await axios.get(`https://api.marketdata.app/v1/markets/status/?token=${config.token}`);
      const status = response.data.status[0];
      console.log(`Market status: ${status}`);
  
      return status === 'open';
    } catch (error) {
      console.error(`Error checking market status: ${error}`);
      // Return false to prevent data fetching if we can't determine market status
      return false;
    }
  };

const fetchSPYLastPrice = async () => {
  try {
    const response = await axios.get(`https://api.marketdata.app/v1/stocks/quotes/SPY`);
    const data = response.data;

    if (data.s !== 'ok') {
      throw new Error('Failed to fetch SPY last price');
    }

    // Extract only the 'last' price and 'updated' timestamp
    const spyLastPrice = {
      Symbol: 'SPY',
      Updated: DateTime.fromSeconds(data.updated[0]).toISO(),
      Last: data.last[0],
      updatedUnix: data.updated[0], // For timestamp comparison
    };

    return spyLastPrice;
  } catch (error) {
    console.error(`Error fetching SPY last price: ${error}`);
    throw error; // Re-throw to handle in fetchFinancialData
  }
};

const fetchFinancialData = () => {
  setInterval(async () => {
    try {

        const marketOpen = await isMarketOpen();
            if (!marketOpen) {
            console.log('Market is closed. Skipping data fetch.');
            return;
        }
        const response = await axios.get(
            `https://api.marketdata.app/v1/options/chain/${config.ticker}?dte=${config.daysToExpire}&strikeLimit=${config.levelsOfStrike}&token=${config.token}`
        );
        let data = response.data;

        const timestamp = data.updated[0];

        data = prepareData(data);
        console.log('Prepared data from endpoint:', data);

        // Fetch SPY Last Price
        const spyLastPrice = await fetchSPYLastPrice();
        console.log('Fetched SPY last price:', spyLastPrice);

        //Combine Options Data and SPY Last Price 
        const combinedData = {
          Options: data, // Existing Options data
          Price: spyLastPrice.Last // Last Price of SPY
        }

        // Store data in Redis sorted set with timestamp as the score
        await redisClient.zAdd('options_chain_data_zset', {
            score: timestamp,
            value: JSON.stringify(combinedData),
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
*/