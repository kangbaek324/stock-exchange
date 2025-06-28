import My from "../components/My";
import OrderBook from "../components/OrderBook";
import OrderBox from "../components/OrderBox";
import StockList from "../components/StockList";
import SearchBar from "../components/SearchBar";
import Header from "../components/Header";
import { useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import './stock.css';

const Stock = () => {
  const [stockData, setStockData] = useState(null);
  const [accountData, setAccountData] = useState(null);
  const socketRef = useRef(null);

  const changeStock = useCallback((stockId) => {
    if (socketRef.current) {
      socketRef.current.emit("joinStockRoom", stockId);
    }
  }, []);

  const changeAccount = useCallback((accountNumber) => {
    if (socketRef.current) {
      socketRef.current.emit("joinAccountRoom", accountNumber);
    }
  })

  useEffect(() => {
    socketRef.current = io("http://localhost:3003/stock", {
      transports: ["websocket"],
      withCredentials: true,
    });

    socketRef.current.on("connect", () => {
      console.log("연결됨");
      socketRef.current.emit("joinStockRoom", 1);
      socketRef.current.emit("joinAccountRoom")
    });

    socketRef.current.on("errorCustom", (err) => {
      console.log(err);
    });

    socketRef.current.on("stockUpdated", (data) => {
      setStockData(data);
    });

    socketRef.current.on("accountUpdated", (data) => {
      setAccountData(data);
    })

    return () => {
      socketRef.current.disconnect();
    };
  }, []);

  return (
    <div className="super-main">
      {/* <SearchBar /> */}
      <main>
        <Header stockData={stockData} />
        <div className="main">
          <div className="stockInfo">
            <StockList changeStock={changeStock}/>
            <OrderBook stockData={stockData} />
          </div>
          <div className="myInfo">
            <div className="my">
              <My accountData={accountData}/>
            </div>
            <div className="order">
              <OrderBox optionName1={"BUY"} optionName2={"SELL"} />
              <OrderBox optionName1={"EDIT"} optionName2={"CANCEL"} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};


export default Stock;
