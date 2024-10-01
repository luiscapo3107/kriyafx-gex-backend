// controllers/dataController.js
const { redisClient } = require('../services/redisClient');

const getOptionsChain = async (req, res) => {
  try {
    const minTimestamp = req.query.min ? parseInt(req.query.min) : '-inf';
    const maxTimestamp = req.query.max ? parseInt(req.query.max) : '+inf';

    const dataList = await redisClient.zRangeByScore('options_chain_data_zset', minTimestamp, maxTimestamp);

    const data = dataList.map((item) => JSON.parse(item));

    res.json(data);
  } catch (error) {
    console.error(`Error retrieving data from Redis: ${error}`);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getOptionsChain,
};
