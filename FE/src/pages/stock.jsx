import My from "../components/My";
import OrderBook from "../components/OrderBook";
import OrderBox from "../components/OrderBox";
import StockList from "../components/stockList";
import SearchBar from "../components/SearchBar"
import Header from "../components/Header"
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import './stock.css';

const Stock = () => {
  const mySelect = 1;
  const [stockData, setStockData] = useState(null);

  useEffect(() => {
    const socket = io("http://localhost:3003/stock", {
      transports: ["websocket"],
      withCredentials: true,
    });

    socket.on("connect", () => {
      console.log("연결됨")

      socket.emit("joinStockRoom", 1);

      socket.on("errorCustom", (err) => {
        console.log(err)
      })
  
      socket.on("stockUpdated", (data) => {
        setStockData(data);
      });

    })

    return () => {
      socket.disconnect(); 
    };
  }, [])

  return (
    <div className="super-main">
      {/* <SearchBar></SearchBar> */}
      <main>
        <Header></Header>
        <div className="main">
          <div className="stockInfo">
            <StockList></StockList>
            <OrderBook stockData={stockData}></OrderBook>
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
