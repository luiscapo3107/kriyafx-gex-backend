require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const axios = require('axios');
const { createClient } = require('redis');
const cors = require('cors'); // Import CORS


const app = express();
const port = 3001;

const retrieveInterval = 5000; 
const daysToExpire = 0 ; 
const levelsOfStrike = 20; 
const ticker = 'SPY';
const token = process.env.TOKEN; 

// Enable CORS for all routes (adjust as needed for security)
app.use(cors());

// Create a Redis client
const redisClient = createClient();

redisClient.on('error', (err) => console.error(`Redis error: ${err}`));

// Connect to Redis
(async () => {
  try {
    await redisClient.connect();
    console.log('Connected to Redis');
  } catch (error) {
    console.error(`Redis connection error: ${error}`);
  }
})();

const fetchFinancialData = async () => {
  try {
    const response = await axios.get('https://api.marketdata.app/v1/options/chain/'+ticker+'?dte='+daysToExpire+'&strikeLimit='+levelsOfStrike+'&token='+token);
    let data = response.data;
    //console.log('Retrieved data from endpoint:', data);

    const timestamp = data.updated[0]; // to store the time series in the Redis DB

    data = prepareData(data);
    console.log('Prepared data from endpoint:', data);

    // Store data in Redis sorted set with timestamp as the score
    await redisClient.zAdd('options_chain_data_zset', {
      score: timestamp,
      value: JSON.stringify(data),
    });

    // Optionally, limit the size of the sorted set to prevent unbounded growth
    const maxEntries = 100000; // Adjust as needed
    const totalEntries = await redisClient.zCard('options_chain_data_zset');
    if (totalEntries > maxEntries) {
      // Remove the oldest entries
      await redisClient.zRemRangeByRank('options_chain_data_zset', 0, totalEntries - maxEntries - 1);
    }
    
    console.log('Financial data updated in Redis');
  } catch (error) {
    console.error(`Error fetching financial data: ${error}`);
  }
};

const prepareData = (data) => {
  try {
    const symbol = data.underlying[0];
    const updated = data.updated[0];

    // Initialize total variables
    let totalASK_Volume = 0;
    let totalGEX_OI = 0;
    let totalGEX_Volume = 0;

    const optionsLength = data.optionSymbol.length;
    const strikeMap = {};

    for (let i = 0; i < optionsLength; i++) {
      const strike = data.strike[i];
      const side = data.side[i]; // 'call' or 'put'
      const optionData = {
        open_interest: data.openInterest[i],
        gamma: data.gamma[i],
        volume: data.volume[i],
        ask: data.ask[i],
      };

      // Initialize the strike entry if it doesn't exist
      if (!strikeMap[strike]) {
        strikeMap[strike] = {
          strike: strike,
          call: { ASK_Volume: 0, GEX_OI: 0, GEX_Volume: 0 },
          put: { ASK_Volume: 0, GEX_OI: 0, GEX_Volume: 0 },
        };
      }

      // Assign the option data to the appropriate side
      if (side === 'call') {
        // Update ASK_Volume
        strikeMap[strike].call.ASK_Volume += optionData.volume * optionData.ask;

        // Update GEX_OI and GEX_Volume
        strikeMap[strike].call.GEX_OI += optionData.gamma * optionData.open_interest * 100 * Math.pow(strike, 2) * 0.01;
        strikeMap[strike].call.GEX_Volume += optionData.gamma * optionData.volume * 100 * Math.pow(strike, 2) * 0.01;

        // Debug
        console.log(`Strike ${strike} - Call: ASK Volume ${strikeMap[strike].call.ASK_Volume}`);

      } else if (side === 'put') {
        // Update ASK_Volume
        strikeMap[strike].put.ASK_Volume += optionData.volume * optionData.ask * -1;

        // Update GEX_OI and GEX_Volume
        strikeMap[strike].put.GEX_OI += optionData.gamma * optionData.open_interest * (-100) * Math.pow(strike, 2) * 0.01;
        strikeMap[strike].put.GEX_Volume += optionData.gamma * optionData.volume * (-100) * Math.pow(strike, 2) * 0.01;

        // Debug
        console.log(`Strike ${strike} - Put: ASK Volume ${strikeMap[strike].put.ASK_Volume}`);
      }
    }

    // Convert the strikeMap to an array and sort by strike price
    const strikes = Object.values(strikeMap).sort((a, b) => a.strike - b.strike);

    // Accumulate totals after processing all options
    strikes.forEach(strikeData => {
      totalASK_Volume += Math.abs(strikeData.call.ASK_Volume) + Math.abs(strikeData.put.ASK_Volume);
      totalGEX_OI += strikeData.call.GEX_OI + strikeData.put.GEX_OI;
      totalGEX_Volume += strikeData.call.GEX_Volume + strikeData.put.GEX_Volume;
    });

    // Round the totals to integers
    totalASK_Volume = Math.round(totalASK_Volume);
    totalGEX_OI = Math.round(totalGEX_OI);
    totalGEX_Volume = Math.round(totalGEX_Volume);

    // Compute Percentage_ASK_Volume for each call and put, and round values
    strikes.forEach(strikeData => {
      // Round numeric values
      strikeData.call.ASK_Volume = Math.round(strikeData.call.ASK_Volume);
      strikeData.call.GEX_OI = Math.round(strikeData.call.GEX_OI);
      strikeData.call.GEX_Volume = Math.round(strikeData.call.GEX_Volume);

      strikeData.put.ASK_Volume = Math.round(strikeData.put.ASK_Volume);
      strikeData.put.GEX_OI = Math.round(strikeData.put.GEX_OI);
      strikeData.put.GEX_Volume = Math.round(strikeData.put.GEX_Volume);

      // Compute percentages and round to integers
      if (totalASK_Volume !== 0) {
        strikeData.call.Percentage_ASK_Volume = Math.round((Math.abs(strikeData.call.ASK_Volume) / totalASK_Volume) * 100);
        strikeData.put.Percentage_ASK_Volume = Math.round((Math.abs(strikeData.put.ASK_Volume) / totalASK_Volume) * 100);
      } else {
        strikeData.call.Percentage_ASK_Volume = 0;
        strikeData.put.Percentage_ASK_Volume = 0;
      }
    });

    // Construct the final result object
    const result = {
      Symbol: symbol,
      Updated: updated,
      Total_ASK_Volume: totalASK_Volume,
      Total_GEX_OI: totalGEX_OI,
      Total_GEX_Volume: totalGEX_Volume,
      Data: strikes,
    };

    return result;
  } catch (error) {
    console.error(`Error preparing Data: ${error}`);
  }

};

// Fetch data every X seconds
setInterval(fetchFinancialData, retrieveInterval);

// API endpoint to get data from Redis
app.get('/api/options-chain', async (req, res) => { //Get query parameters from Redis DB: GET http://localhost:3000/api/options-chain
  try {
    // Get query parameters for time range (GET http://localhost:3000/api/options-chain?min=1684700000&max=1684705000)
    const minTimestamp = req.query.min ? parseInt(req.query.min) : '-inf';
    const maxTimestamp = req.query.max ? parseInt(req.query.max) : '+inf';

    // Retrieve data from the sorted set within the specified time range
    const dataList = await redisClient.zRangeByScore('options_chain_data_zset', minTimestamp, maxTimestamp);

    // Parse each data point from JSON string to object
    const data = dataList.map((item) => JSON.parse(item));

    res.json(data);
  } catch (error) {
    console.error(`Error retrieving data from Redis: ${error}`);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/', (req, res) => {
  res.send('Express server running...');
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
