const express = require('express');
const axios = require('axios');
const { createClient } = require('redis');
const cors = require('cors'); // Import CORS

const app = express();
const port = 3000;

const retrieveInterval = 5000; 
const daysToExpire = 0 ; 
const levelsOfStrike = 20; 
const ticker = 'QQQ';
const token = 'Ny1XUmd1Ry0wSGtuNC1kVGN1UFNjVHVUMkNXNEFmY19PVjlzUG5kMXM3WT0';

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
    console.log('Retrieved data from endpoint:', data);

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
          call: null,
          put: null,
          ASK_Volume: 0,
          GEX_OI: 0,
          GEX_Volume: 0,
        };
      }

      // Assign the option data to the appropriate side
      if (side === 'call') {
        strikeMap[strike].call = optionData;

        // Update ASK_Volume
        strikeMap[strike].ASK_Volume += optionData.volume * optionData.ask;

        // Update GEX_OI and GEX_Volume
        strikeMap[strike].GEX_OI += optionData.gamma * optionData.open_interest * 100 * strike^2 * 0.01; //https://perfiliev.com/blog/how-to-calculate-gamma-exposure-and-zero-gamma-level/
        strikeMap[strike].GEX_Volume += optionData.gamma * optionData.volume * 100 * strike^2 * 0.01; // Option's Gamma * Contract Size * Open Interest * Spot Price ^ 2 * 0.01
        
        // Debug
        console.log(`Strike ${strike} - Call: GEX_OI ${strikeMap[strike].GEX_OI}`)
      } else if (side === 'put') {
        strikeMap[strike].put = optionData;

        // Update ASK_Volume
        strikeMap[strike].ASK_Volume += optionData.volume * optionData.ask * -1;

        // Update GEX_OI and GEX_Volume
        strikeMap[strike].GEX_OI += optionData.gamma * optionData.open_interest * (-100) * strike^2 * 0.01; //https://perfiliev.com/blog/how-to-calculate-gamma-exposure-and-zero-gamma-level/
        strikeMap[strike].GEX_Volume += optionData.gamma * optionData.volume * (-100) * strike^2 * 0.01; // Option's Gamma * Contract Size * Open Interest * Spot Price ^ 2 * 0.01
        
        //Debug
        console.log(`Strike ${strike} - Put: GEX_OI ${strikeMap[strike].GEX_OI}`)
      }

      // Accumulate totals
      totalASK_Volume += strikeMap[strike].ASK_Volume;
      totalGEX_OI += strikeMap[strike].GEX_OI;
      totalGEX_Volume += strikeMap[strike].GEX_Volume;

    }

    // Utility function to round numbers to 0 decimal places
    const round = (num, decimals = 0) => {
      return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
    };

    // Convert the strikeMap to an array and sort by strike price
    const resultArray = Object.values(strikeMap).sort((a, b) => a.strike - b.strike);

    // Round the calculated values for each strike
    resultArray.forEach((strike) => {
      strike.ASK_Volume = round(strike.ASK_Volume);
      strike.GEX_OI = round(strike.GEX_OI);
      strike.GEX_Volume = round(strike.GEX_Volume);
    });

    // Round the totals
    totalASK_Volume = round(totalASK_Volume);
    totalGEX_OI = round(totalGEX_OI);
    totalGEX_Volume = round(totalGEX_Volume);

    // Construct the final result object
    const result = {
      Symbol: symbol,
      Updated: updated,
      Total_ASK_Volume: totalASK_Volume,
      Total_GEX_OI: totalGEX_OI,
      Total_GEX_Volume: totalGEX_Volume,      
      Data: resultArray,
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
