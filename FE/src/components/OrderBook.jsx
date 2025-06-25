import "./OrderBook.css";
import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const OrderBook = () => {
  useEffect(() => {
  const socket = io("http://localhost:3003/stock"); 

    socket.emit()
    socket.on("order_data", (data) => {
      console.log("서버로부터 받은 주문 정보:", data);
    });

    return () => {
      socket.disconnect(); 
    };
  }, []);
  
  let buyVp = [];
  let sellVp = [];
  let sellPrice = [];
  let buyPrice = [];

  for(let i = 1; i <= 10; i++) {
    sellVp.push(
      <div className="ho">
        <div className="volume"></div>
        <div className="per"></div>
      </div>
    )

    sellPrice.push(
      <div className="priceValue"></div>
    )
  }

  for(let i = 10; i >= 1; i--) {
    buyVp.push(
      <div className="ho">
        <div className="per"></div>
        <div className="volume"></div>
      </div>
    )

    buyPrice.push(
      <div className="priceValue"></div>
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
