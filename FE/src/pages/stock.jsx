import My from "../components/My";
import OrderBook from "../components/OrderBook";
import OrderBox from "../components/OrderBox";
import StockList from "../components/stockList";
import SearchBar from "../components/SearchBar"
import Header from "../components/Header"
import { useEffect } from 'react';
import { io } from 'socket.io-client';
import './stock.css';

const Stock = () => {
  const mySelect = 1;

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
        console.log("서버로부터 받은 주문 정보:", data);
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
