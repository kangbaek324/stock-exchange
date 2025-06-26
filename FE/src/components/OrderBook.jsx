import "./OrderBook.css";

const OrderBook = ({ stockData }) => {  
  let buyVp = [];
  let sellVp = [];
  let sellPrice = [];
  let buyPrice = [];

  
  if (stockData == null) {
    return;
  }
  
  console.log(stockData)

  for(let i = 9; i > -1; i--) {
    sellVp.push(
      <div className="ho">
        <div className="volume">
          <div className="stick">
            {stockData.sellOrderbookData[i].number}
          </div>
        </div>
        <div className="per"></div>
      </div>
    )

    if (stockData.sellOrderbookData[i].price > 0) {
      sellPrice.push(
        <div className="priceValue redText">{stockData.sellOrderbookData[i].price}</div>
      )
    }
    else if (stockData.sellOrderbookData[i].price < 0) {
      sellPrice.push(
        <div className="priceValue blueText">{stockData.sellOrderbookData[i].price}</div>
      )
    }
    else {
    sellPrice.push(
        <div className="priceValue blackText">{stockData.sellOrderbookData[i].price}</div>
      )
    }
  }

  for(let i = 0; i < 10; i++) {
    console.log()
    buyVp.push(
      <div className="ho">
        <div className="per"></div>
        <div className="volume">
          <div className="stick">
            {stockData.buyOrderbookData[i].number}
          </div>
        </div>
      </div>
    )

    buyPrice.push(
      <div className="priceValue">{stockData.buyOrderbookData[i].price}</div>
    )
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
            <div id="info"></div>
          </div>
          <div id="buy">
            <div id="match"></div>
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
