const { fetchExpectedMove } = require('./optionsHelper');

const prepareData = async (data) => {
	try {
		if (!data || !data.underlying || data.underlying.length === 0) {
			return null;
		}

		const symbol = data.underlying[0];
		const updated = data.updated[0];

		let totalASK_Volume = 0;
		let totalGEX_OI = 0;
		let totalGEX_Volume = 0;

		const optionsLength = data.optionSymbol ? data.optionSymbol.length : 0;

		const strikeMap = {};
		const strikes = [];

		for (let i = 0; i < optionsLength; i++) {
			const strike = data.strike[i];
			const side = data.side[i];
			const optionData = {
				open_interest: data.openInterest[i],
				gamma: data.gamma[i],
				volume: data.volume[i],
				ask: data.ask[i],
			};

			if (!strikeMap[strike]) {
				strikeMap[strike] = {
					strike: strike,
					call: { ASK_Volume: 0, GEX_OI: 0, GEX_Volume: 0 },
					put: { ASK_Volume: 0, GEX_OI: 0, GEX_Volume: 0 },
				};
			}

			if (side === 'call') {
				strikeMap[strike].call.ASK_Volume += optionData.volume * optionData.ask;
				strikeMap[strike].call.GEX_OI += optionData.gamma * optionData.open_interest * 100 * Math.pow(strike, 2) * 0.01;
				strikeMap[strike].call.GEX_Volume += optionData.gamma * optionData.volume * 100 * Math.pow(strike, 2) * 0.01;
				totalASK_Volume += strikeMap[strike].call.ASK_Volume;
				totalGEX_OI += strikeMap[strike].call.GEX_OI;
				totalGEX_Volume += strikeMap[strike].call.GEX_Volume;
			} else if (side === 'put') {
				strikeMap[strike].put.ASK_Volume += optionData.volume * optionData.ask * -1;
				strikeMap[strike].put.GEX_OI += optionData.gamma * optionData.open_interest * -100 * Math.pow(strike, 2) * 0.01;
				strikeMap[strike].put.GEX_Volume += optionData.gamma * optionData.volume * -100 * Math.pow(strike, 2) * 0.01;
				totalASK_Volume += strikeMap[strike].put.ASK_Volume;
				totalGEX_OI += strikeMap[strike].put.GEX_OI;
				totalGEX_Volume += strikeMap[strike].put.GEX_Volume;
			}

			strikes.push(strikeMap[strike]);
		}

		let expectedMove;
		try {
			const { expectedMove: calculatedExpectedMove } = await fetchExpectedMove(symbol);
			expectedMove = calculatedExpectedMove;
		} catch (error) {
			expectedMove = null;
		}

		return {
			Symbol: symbol,
			Updated: updated,
			Total_ASK_Volume: totalASK_Volume,
			Total_GEX_OI: totalGEX_OI,
			Total_GEX_Volume: totalGEX_Volume,
			ExpectedMove: expectedMove,
			Data: strikes,
		};
	} catch (error) {
		return null;
	}
};

module.exports = prepareData;
