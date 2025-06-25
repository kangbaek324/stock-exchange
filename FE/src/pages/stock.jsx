import My from "../components/My";
import OrderBook from "../components/Orderbook";
import OrderBox from "../components/OrderBox";
import StockList from "../components/stockList";
import SearchBar from "../components/SearchBar"
import Header from "../components/Header"
import './stock.css';

const Stock = () => {
  const mySelect = 1;

  return (
    <div className="super-main">
      {/* <SearchBar></SearchBar> */}
      <main>
        <Header></Header>
        <div className="main">
          <div className="stockInfo">
            <StockList></StockList>
            <OrderBook></OrderBook>
          </div>
          <div className="myInfo">
            <div className="my">
              <My></My>
            </div>
            <div className="order">
                <OrderBox
                  optionName1={"BUY"}
                  optionName2={"SELL"}
                ></OrderBox>
                <OrderBox
                  optionName1={"EDIT"}
                  optionName2={"CANCEL"}
                ></OrderBox>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Stock;
