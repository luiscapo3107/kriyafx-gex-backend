// utils/dataPreparation.js
//TODO: Add Expected Move as a basis of the implied volatility to add the 1 Day expected move range: check out formula in https://www.home.saxo/content/articles/equities/understanding-and-calculating-the-expected-move-of-a-stock-etf-index-07072023
// Expected Move = Price * IV % * DTE^2 /365 or Using the price of a straddle when at 0DTE > Expected Move = cost of ATM Call + cost of ATM Put - Call por arriba, Put por abajo. Tengo que mirar en 0DTE el precio en ATM strike actual)
//Look up the option chain and add the price of the at-the-money call option and that of the at-the-money put option. Then multiply that value by 85% to get the expected moves
const prepareData = (data) => {
    try {
      const symbol = data.underlying[0];
      const updated = data.updated[0];
  
      let totalASK_Volume = 0;
      let totalGEX_OI = 0;
      let totalGEX_Volume = 0;
  
      const optionsLength = data.optionSymbol.length;
      const strikeMap = {};
  
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
        } else if (side === 'put') {
          strikeMap[strike].put.ASK_Volume += optionData.volume * optionData.ask * -1;
          strikeMap[strike].put.GEX_OI += optionData.gamma * optionData.open_interest * -100 * Math.pow(strike, 2) * 0.01;
          strikeMap[strike].put.GEX_Volume += optionData.gamma * optionData.volume * -100 * Math.pow(strike, 2) * 0.01;
        }
      }
  
      const strikes = Object.values(strikeMap).sort((a, b) => a.strike - b.strike);
  
      strikes.forEach((strikeData) => {
        totalASK_Volume += strikeData.call.ASK_Volume + strikeData.put.ASK_Volume;
        totalGEX_OI += strikeData.call.GEX_OI + strikeData.put.GEX_OI;
        totalGEX_Volume += strikeData.call.GEX_Volume + strikeData.put.GEX_Volume;
      });
  
      totalASK_Volume = Math.round(totalASK_Volume);
      totalGEX_OI = Math.round(totalGEX_OI);
      totalGEX_Volume = Math.round(totalGEX_Volume);
  
      strikes.forEach((strikeData) => {
        strikeData.call.ASK_Volume = Math.round(strikeData.call.ASK_Volume);
        strikeData.call.GEX_OI = Math.round(strikeData.call.GEX_OI);
        strikeData.call.GEX_Volume = Math.round(strikeData.call.GEX_Volume);
  
        strikeData.put.ASK_Volume = Math.round(strikeData.put.ASK_Volume);
        strikeData.put.GEX_OI = Math.round(strikeData.put.GEX_OI);
        strikeData.put.GEX_Volume = Math.round(strikeData.put.GEX_Volume);

        strikeData.Net_ASK_Volume = strikeData.call.ASK_Volume - strikeData.put.ASK_Volume; 
  
        if (totalASK_Volume !== 0) {
          strikeData.call.Percentage_ASK_Volume = Math.round(
            (Math.abs(strikeData.call.ASK_Volume) / Math.abs(totalASK_Volume)) * 100
          );
          strikeData.put.Percentage_ASK_Volume = Math.round(
            (Math.abs(strikeData.put.ASK_Volume) / Math.abs(totalASK_Volume)) * 100
          );
        } else {
          strikeData.call.Percentage_ASK_Volume = 0;
          strikeData.put.Percentage_ASK_Volume = 0;
        }
      });
  
      return {
        Symbol: symbol,
        Updated: updated,
        Total_ASK_Volume: totalASK_Volume,
        Total_GEX_OI: totalGEX_OI,
        Total_GEX_Volume: totalGEX_Volume,
        Data: strikes,
      };
    } catch (error) {
      console.error(`Error preparing Data: ${error}`);
    }
  };
  
  module.exports = prepareData;
  