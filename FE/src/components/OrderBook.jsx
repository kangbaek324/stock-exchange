import "./OrderBook.css";

const OrderBook = ({ stockData }) => {  
  let buyVp = [];
  let sellVp = [];
  let sellPrice = [];
  let buyPrice = [];
  let match = [];
  
  if (stockData == null) {
    return;
  }

  const sellMax = Math.max(...stockData.sellOrderbookData.map(v => v.number));
  const buyMax = Math.max(...stockData.buyOrderbookData.map(v => v.number));
  const maxStandard = Math.max(sellMax, buyMax);
  
  // 매도 호가
  for (let i = 9; i > -1; i--) {
    if (!stockData.sellOrderbookData[i]) {
      sellVp.push(
        <div className="ho" key={i}>
          <div className="volume">
          </div>
          <div className="per">
          </div>
        </div>
      );

      sellPrice.push(
          <div className="priceValue"></div>
      )
    }
    else {
      const volume = stockData.sellOrderbookData[i].number;
      let percent = (volume / maxStandard) * 100;
      if (percent > 100) percent = 100;
      const stickWidth = { width: `${percent.toFixed(1)}%` };
  
      const current = stockData.sellOrderbookData[i].price;
      const previous = stockData.previousClose?.close ?? stockData.stockInfo.price;
      const diff = current - previous;
      const percentChange = ((diff / previous) * 100).toFixed(2);
  
      let perColor;
      if (percentChange > 0) {
        perColor = { color: "red" }
      }
      else if (percentChange < 0) {
        perColor = { color: "blue" }
      }
      else {
        perColor = { color: "black" }
      }
  
      sellVp.push(
        <div className="ho" key={i}>
          <div className="volume">
            <div className="stick" style={stickWidth}>
              {volume}
            </div>
          </div>
          <div className="per" style={perColor}>
            {percentChange > 0 ? "+" : percentChange < 0 ? "" : ""}{percentChange}%
          </div>
        </div>
      );

      const nowPrice = stockData.stockInfo.price
      const price = stockData.sellOrderbookData[i].price;
      const prevClose = stockData.previousClose?.close ?? 0;
      const high = stockData.stockHistory?.high ?? 0;
      const low = stockData.stockHistory?.low ?? 0;

      let colorClass = "blackText";
      if (price > prevClose) {
        colorClass = "redText";
      } else if (price < prevClose) {
        colorClass = "blueText";
      }

      let boderClass = null;
      if (price === nowPrice) {
        boderClass = "nowPrice"
      }

      if (price === high) {
        sellPrice.push(
          <div className={`priceValue ${colorClass} ${boderClass}`}>
            <div className="message">고</div>
            <div className="value">{price}</div>
          </div>
        );
      } 
      else if (price === low) {
        sellPrice.push(
          <div className={`priceValue ${colorClass} ${boderClass}`}>
            <div className="message">저</div>
            <div className="value">{price}</div>
          </div>
        );
      }
      else {
        sellPrice.push(
          <div className={`priceValue ${colorClass} ${boderClass}`}>{price}</div>
        );
      }
    }
  }

  // 매수 호가
  for(let i = 0; i < 10; i++) {
    if (!stockData.buyOrderbookData[i]) {
      buyVp.push(
        <div className="ho">
          <div className="per">
          </div>
          <div className="volume">
          </div>
        </div>
      )

      buyPrice.push(
          <div className="priceValue"></div>
      )
    }
    else {
      const volume = stockData.buyOrderbookData[i].number;
      let percent = (volume / maxStandard) * 100;
      if (percent > 100) percent = 100;
      const stickWidth = { width: `${percent.toFixed(1)}%` };
  
      const current = stockData.buyOrderbookData[i].price;
      const previous = stockData.previousClose?.close ?? stockData.stockInfo.price;
      const diff = current - previous;
      const percentChange = ((diff / previous) * 100).toFixed(2);
  
      let perColor;
      if (percentChange > 0) {
        perColor = { color: "red" }
      }
      else if (percentChange < 0) {
        perColor = { color: "blue" }
      }
      else {
        perColor = { color: "black" }
      }
      
      buyVp.push(
        <div className="ho">
          <div className="per" style={perColor}>
            {percentChange > 0 ? "+" : percentChange < 0 ? "" : ""}{percentChange}%
          </div>
          <div className="volume">
            <div className="stick" style={stickWidth}>
              {stockData.buyOrderbookData[i].number}
            </div>
          </div>
        </div>
      )
  
      const nowPrice = stockData.stockInfo.price
      const price = stockData.buyOrderbookData[i].price;
      const prevClose = stockData.previousClose?.close ?? 0;
      const high = stockData.stockHistory?.high ?? 0;
      const low = stockData.stockHistory?.low ?? 0;

      let colorClass = "blackText";
      if (price > prevClose) {
        colorClass = "redText";
      } else if (price < prevClose) {
        colorClass = "blueText";
      }

      let boderClass;
      if (price === nowPrice) {
        boderClass = "nowPrice"
      }

      if (price === high) {
        buyPrice.push(
          <div className={`priceValue ${colorClass} ${boderClass}`}>
            <div className="message">고</div>
            <div className="value">{price}</div>
          </div>
        );
      } 
      else if (price === low) {
        buyPrice.push(
          <div className={`priceValue ${colorClass} ${boderClass}`}>
            <div className="message">저</div>
            <div className="value">{price}</div>
          </div>
        );
      }
      else {
        buyPrice.push(
          <div className={`priceValue ${colorClass} ${boderClass}`}>{price}</div>
        );
      }
    }
  }

  for(let i = 0; i < 20; i++) {
    let numberColorStyle;

    if (!stockData.match[i]) {
      match.push(
        <div className="matchValue">
          <p></p>
          <p></p>
        </div>
      )
    }
    else {
      if (stockData.match[i].type == "buy") {
        numberColorStyle =  { color: "red" };
      }
      else {
        numberColorStyle = { color: "blue" }
      }
  
      let variablePrice = stockData.match[i].price - stockData.previousClose.close
      let priceColorStyle;
      if (variablePrice > 0) {
        priceColorStyle = { color: "red" }
      }
      else if (variablePrice < 0) {
        priceColorStyle = { color: "blue" }
      }
      else {
        priceColorStyle = { color: "black" }
      }
  
      match.push(
        <div className="matchValue">
          <p style={priceColorStyle}>{stockData.match[i].price}</p>
          <p style={numberColorStyle}>{stockData.match[i].number}</p>
        </div>
      )
    }
  }

  return (
        <div id="orderBook">
          <div id="sell">
            <div className="vp">
              {sellVp}
            </div>
            <div className="price">
              {sellPrice}
            </div>
            <div id="info">
              <div>
                <p>전일종가 {stockData.previousClose?.close ?? stockData.stockInfo.price}원</p>
                <p>시가 {stockData.stockHistory?.open ?? stockData.stockInfo.price}원</p>
                <p>고가 {stockData.stockHistory?.high ?? stockData.stockInfo.price}원</p>
                <p>저가 {stockData.stockHistory?.low ?? stockData.stockInfo.price}원</p>
              </div>
            </div>
          </div>
          <div id="buy">
            <div id="match">
              {match}
            </div>
            <div className="price">
              {buyPrice}
            </div>
            <div className="vp">
              {buyVp}
            </div>
          </div>
        </div>
  )
};

export default OrderBook;
