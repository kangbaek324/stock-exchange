import My from "../components/My";
import OrderBook from "../components/OrderBook";
import StockList from "../components/StockList";
import BcOrderBox from "../components/BcOrderBox";
import EcOrderBox from "../components/EcOrderBox";
import SearchBar from "../components/SearchBar";
import Header from "../components/Header";
import { useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import './stock.css';

const Stock = () => {
  const [stockData, setStockData] = useState(null);
  const [accountData, setAccountData] = useState(null);
  const [myOrderData, setMyOrderData] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [selectedStock, setSelectedStock] = useState();
  const socketRef = useRef(null);

  const changeStock = useCallback((stockId) => {
    if (socketRef.current) {
      socketRef.current.emit("joinStockRoom", stockId);
      setSelectedStock(stockId);
    }
  }, []);

  const changeAccount = useCallback((accountNumber) => {
    if (socketRef.current) {
      socketRef.current.emit("joinAccountRoom", parseInt(accountNumber));
    }
  })

  useEffect(() => {
    socketRef.current = io("http://localhost:3003/stock", {
      transports: ["websocket"],
      withCredentials: true,
    });

    socketRef.current.on("connect", () => {
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

    socketRef.current.on("myOrderUpdated", (data) => {
      setMyOrderData(data);
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
              <My 
                accountData={accountData} 
                changeAccount={changeAccount}
                selectedAccount={selectedAccount}
                setSelectedAccount={setSelectedAccount}
                myOrderData={myOrderData}
                setMyOrderData={setMyOrderData}
              />
            </div>
            <div className="order">
              <BcOrderBox 
                setSelectedAccount={setSelectedAccount}
                selectedAccount={selectedAccount}  
                selectedStock={selectedStock}
                setSelectedStock={setSelectedStock}
              />
              <EcOrderBox
                setSelectedAccount={setSelectedAccount}
                selectedAccount={selectedAccount}
                selectedStock={selectedStock}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};


export default Stock;
