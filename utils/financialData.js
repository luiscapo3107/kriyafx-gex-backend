const axios = require('axios');
const { redisClient } = require('./redisClient');
const prepareData = require('./dataPreparation');
const config = require('../config/config');
const fetchSPYLastPrice = require('./fetchSPY');
const isMarketOpen = require('./marketStatus');

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

            const spyLastPrice = await fetchSPYLastPrice();
            console.log('Fetched SPY last price:', spyLastPrice);

            const combinedData = {
                Options: data,
                Price: spyLastPrice.Last,
            };

            await redisClient.zAdd('options_chain_data_zset', {
                score: timestamp,
                value: JSON.stringify(combinedData),
            });

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