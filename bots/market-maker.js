const io = require("socket.io-client");
const axios = require("axios");

class MarketMakerBot {
  constructor() {
    this.baseURL = "http://localhost:3000";
    this.socketURL = "http://localhost:3003/stock";
    this.accounts = [
      {
        accessToken:
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsInVzZXJuYW1lIjoiYWRtaW4yIiwiaWF0IjoxNzUwOTUzMjcyfQ.qL-_-68sO6lPOjqKpmPqq1o4lcsyJM6WvVXhGqkHw7c",
        accountNumber: 1001, // 매수 전용
      },
      {
        accessToken:
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsInVzZXJuYW1lIjoiYWRtaW4yIiwiaWF0IjoxNzYxNjY4NzIxfQ.eKagNWSOjYpbV51_IzuDT9spKVsYr_mXB9l2AMknsyU",
        accountNumber: 1002, // 매도 전용
      },
    ];
    this.stockId = 1;
    this.socket = null;
    this.currentMarketData = null;
    this.isRunning = false;
    this.previousClose = 9500;
    this.filledPrices = new Set();
  }

  getTickSize(price) {
    if (price >= 2000 && price < 5000) return 5;
    if (price >= 5000 && price < 20000) return 10;
    if (price >= 20000 && price < 50000) return 50;
    if (price >= 50000 && price < 200000) return 100;
    if (price >= 200000 && price < 500000) return 500;
    if (price >= 500000) return 1000;
    return 1;
  }

  adjustPriceToTickSize(price) {
    const tickSize = this.getTickSize(price);
    return Math.round(price / tickSize) * tickSize;
  }

  generatePriceRange(basePrice) {
    const prices = [];
    const tickSize = this.getTickSize(basePrice);
    for (let i = -100; i <= 100; i++) {
      // -30~+30호가
      const price = basePrice + i * tickSize;
      if (price > 0) prices.push(this.adjustPriceToTickSize(price));
    }
    return prices;
  }

  getVolumeForPrice(price, basePrice) {
    const distance = Math.abs(price - basePrice);
    const tickSize = this.getTickSize(basePrice);
    const tickDistance = distance / tickSize;

    if (tickDistance <= 5) return Math.floor(Math.random() * 500) + 300; // 300~800
    if (tickDistance <= 15) return Math.floor(Math.random() * 300) + 150; // 150~450
    return Math.floor(Math.random() * 100) + 50; // 50~150
  }

  async executeOrder(price, volume, tradingType) {
    try {
      const account =
        tradingType === "buy" ? this.accounts[0] : this.accounts[1];

      const orderData = {
        accountNumber: account.accountNumber,
        stockId: this.stockId,
        price,
        number: volume,
        orderType: "limit",
      };

      const endpoint =
        tradingType === "buy" ? "/stocks/orders/buy" : "/stocks/orders/sell";

      console.log(
        `📋[호가채우기-${tradingType}] 가격: ${price}, 수량: ${volume}`
      );

      const response = await axios.post(
        `${this.baseURL}${endpoint}`,
        orderData,
        {
          headers: {
            Cookie: `accessToken=${account.accessToken}`,
            "Content-Type": "application/json",
          },
          timeout: 5000,
        }
      );

      console.log(`✅ ${tradingType} 주문 성공:`, response.data);
      this.filledPrices.add(price);
    } catch (error) {
      console.error(
        `❌ ${tradingType} 주문 실패:`,
        error.response?.data || error.message
      );
    }
  }

  async fillOrderbook() {
    if (!this.previousClose) return;

    const basePrice = this.previousClose;
    const priceRange = this.generatePriceRange(basePrice);

    console.log(
      `🎯 기준가: ${basePrice}, 호가 범위: ${priceRange[0]} ~ ${
        priceRange[priceRange.length - 1]
      }`
    );

    for (const price of priceRange) {
      if (this.filledPrices.has(price)) continue;

      const volume = this.getVolumeForPrice(price, basePrice);

      if (price < basePrice) await this.executeOrder(price, volume, "buy");
      else if (price > basePrice)
        await this.executeOrder(price, volume, "sell");
      else {
        // 기준가는 매수/매도 각각 한 번만
        await this.executeOrder(price, volume, "buy");
        await this.executeOrder(price, volume, "sell");
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    console.log("🎉 호가창 채우기 완료!");
  }

  connectWebSocket() {
    this.socket = io(this.socketURL, {
      extraHeaders: {
        Cookie: `accessToken=${this.accounts[0].accessToken}`,
      },
    });

    this.socket.on("connect", () => {
      console.log("🔌 마켓메이커 웹소켓 연결됨");
      this.socket.emit("joinStockRoom", 1);
    });

    this.socket.on("stockUpdated", (data) => {
      this.currentMarketData = data;

      if (data.previousClose && data.previousClose.close) {
        const newPreviousClose = data.previousClose.close;
        if (this.previousClose !== newPreviousClose) {
          console.log(
            `📊 [기준가 업데이트] ${this.previousClose} → ${newPreviousClose}`
          );
          this.previousClose = newPreviousClose;
          this.filledPrices.clear();

          setTimeout(() => {
            if (this.isRunning) this.fillOrderbook();
          }, 3000);
        }
      }
    });

    this.socket.on("disconnect", () => {
      console.log("🔌 마켓메이커 웹소켓 연결 해제됨");
    });
  }

  startPeriodicFill() {
    setInterval(() => {
      if (this.isRunning && this.previousClose) {
        if (Math.random() < 0.3) {
          console.log("🔄 호가창 보충 중...");
          this.fillOrderbook();
        }
      }
    }, 3000);
  }

  start() {
    console.log("🎯 마켓메이커 봇 시작...");
    this.isRunning = true;
    this.connectWebSocket();
    setTimeout(() => this.startPeriodicFill(), 3000);
  }

  stop() {
    console.log("🛑 마켓메이커 봇 중지...");
    this.isRunning = false;
    if (this.socket) this.socket.disconnect();
  }
}

const marketMaker = new MarketMakerBot();
marketMaker.start();

process.on("SIGINT", () => {
  marketMaker.stop();
  process.exit(0);
});

module.exports = MarketMakerBot;
