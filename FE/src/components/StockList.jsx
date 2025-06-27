import "./stockList.css";
import stock from "../img/Stock.png";
import axios from "axios";
import { useEffect, useState } from "react";

const StockList = ({ changeStock }) => {
  const [stockList, setStockList] = useState([]);

  useEffect(() => {
    const fetchStocks = async () => {
      try {
        const res = await axios.get("http://localhost:3000/stocks/info");
        setStockList(res.data); 
      } catch (err) {
        console.log(err);
      }
    };

    fetchStocks();
  }, []);

  return (
    <div id="stocks">
      {stockList.map((stockItem) => (
        <div className="stock" key={stockItem.id} onClick={() => changeStock(stockItem.id)}>
          <img src={stock} alt="" />
          <p>{stockItem.name}</p>
        </div>
      ))}
    </div>
  );
};

export default StockList;
