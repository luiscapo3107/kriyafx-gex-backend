const axios = require('axios');
const config = require('../config/config');
const { DateTime } = require('luxon');
require('dotenv').config();

const isMarketOpen = async () => {
    try {
        const nowCET = DateTime.now().setZone('Europe/Berlin');
        const marketOpenTime = nowCET.set({ 
            hour: parseInt(process.env.MARKET_OPEN_HOUR), 
            minute: parseInt(process.env.MARKET_OPEN_MINUTE) 
        });
        const marketCloseTime = nowCET.set({ 
            hour: parseInt(process.env.MARKET_CLOSE_HOUR), 
            minute: parseInt(process.env.MARKET_CLOSE_MINUTE) 
        });

        const isWithinMarketHours = nowCET >= marketOpenTime && nowCET <= marketCloseTime;

        if (!isWithinMarketHours) {
            console.log('Outside specified hours. Skipping market status check.');
            return false;
        }

        const response = await axios.get(`https://api.marketdata.app/v1/markets/status/?token=${config.token}`);
        const status = response.data.status[0];
        console.log(`Market status: ${status}`);

        return status === 'open';
    } catch (error) {
        console.error(`Error checking market status: ${error}`);
        return false;
    }
};

module.exports = isMarketOpen;