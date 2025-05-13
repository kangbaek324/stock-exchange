const jwtToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsInVzZXJuYW1lIjoiYWRtaW4zIiwiaWF0IjoxNzQ1ODM2NjIzfQ.fYyzTEb6pnbH9-uhv4PPM3n7G76ZAutM7neQdjr6L7g";

// 호가 단위에 맞는 가격을 순차적으로 증가시키기 위한 변수
let currentPrice = 9500;

// 가격을 호가 단위에 맞게 순차적으로 증가시키는 함수
function getNextPrice() {
  let tickSize = 1; // 기본 호가 단위

  // 가격 범위에 맞는 호가 단위 설정
  if (currentPrice >= 200000) {
    tickSize = 1000;
  } else if (currentPrice >= 50000) {
    tickSize = 100;
  } else if (currentPrice >= 20000) {
    tickSize = 50;
  } else if (currentPrice >= 5000) {
    tickSize = 10;
  } else if (currentPrice >= 2000) {
    tickSize = 5;
  }

  // 호가 단위에 맞게 가격을 증가시킴
  currentPrice = Math.floor(currentPrice / tickSize) * tickSize + tickSize;

  // 가격이 100000을 넘으면 다시 9500으로 초기화
  if (currentPrice > 16000) {
    currentPrice = 9500;
  }

  return currentPrice;
}

function sendBuyOrder() {
  const order = {
    accountNumber: 1002,
    stockId: 1,
    price: getNextPrice(), // 호가 단위에 맞는 순차적인 가격
    number: Math.floor(Math.random() * 1000) + 1, // 1에서 1000 사이의 랜덤 수량
    orderType: "market"
  };

  fetch("http://localhost:3000/stock/user/orders/buy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${jwtToken}`
    },
    body: JSON.stringify(order)
  })
  .then(response => response.json())
  .then(data => console.log("Buy Order sent:", data))
  .catch(error => console.error("Error sending buy order:", error));
}

// 1초마다 주식 구매 주문을 보냄
setInterval(sendBuyOrder, 100);
