const io = require("socket.io-client");
const axios = require("axios");

class SellBot {
  constructor() {
    this.config = {
      accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      accountNumber: 1001,
      baseUrl: "http://localhost:3000",
      socketUrl: "http://localhost:3003/stock",
    };

    this.socket = null;
    this.currentData = null;
    this.isActive = false;
    this.currentPattern = null;
    this.patternStartTime = null;
    this.patternDuration = 0;

    this.patterns = [
      { name: "점진적매도", weight: 12, speed: "보통" },
      { name: "급락매도", weight: 8, speed: "빠름" },
      { name: "저항선매도", weight: 10, speed: "보통" },
      { name: "익절매도", weight: 15, speed: "빠름" },
      { name: "모멘텀매도", weight: 12, speed: "매우빠름" },
      { name: "스캘핑매도", weight: 20, speed: "매우빠름" },
      { name: "하락돌파매도", weight: 6, speed: "빠름" },
      { name: "물량분산", weight: 8, speed: "느림" },
      { name: "패닉매도", weight: 3, speed: "매우빠름" },
      { name: "안정매도", weight: 10, speed: "보통" },
      { name: "대량매도", weight: 4, speed: "보통" },
    ];

    this.orderCount = 0;
    this.totalVolume = 0;

    this.init();
  }

  async init() {
    await this.connectSocket();
    this.selectNewPattern();
    this.startTrading();
  }

  async connectSocket() {
    this.socket = io(this.config.socketUrl, {
      extraHeaders: { Cookie: `accessToken=${this.config.accessToken}` },
    });

    this.socket.on("connect", () => {
      console.log("🔴 매도봇 연결됨");
      this.socket.emit("joinStockRoom", 1);
    });

    this.socket.on("stockUpdated", (data) => {
      this.currentData = data;
      if (this.isActive) this.processData();
    });

    this.socket.on("disconnect", () => console.log("🔴 매도봇 연결 끊김"));
  }

  selectNewPattern() {
    const totalWeight = this.patterns.reduce((sum, p) => sum + p.weight, 0);
    let random = Math.random() * totalWeight;
    let cumulative = 0;
    for (const pattern of this.patterns) {
      cumulative += pattern.weight;
      if (random <= cumulative) {
        this.currentPattern = pattern;
        break;
      }
    }

    switch (this.currentPattern.speed) {
      case "매우빠름":
        this.patternDuration = Math.random() * 30000 + 20000;
        break;
      case "빠름":
        this.patternDuration = Math.random() * 60000 + 40000;
        break;
      case "보통":
        this.patternDuration = Math.random() * 120000 + 60000;
        break;
      case "느림":
        this.patternDuration = Math.random() * 180000 + 120000;
        break;
      default:
        this.patternDuration = 60000;
    }

    this.patternStartTime = Date.now();
    console.log(`\n🔴 [매도봇] 현재 ${this.currentPattern.name} 패턴 실행중`);
  }

  startTrading() {
    this.isActive = true;
    setInterval(() => {
      if (Date.now() - this.patternStartTime > this.patternDuration)
        this.selectNewPattern();
    }, 500);
    this.scheduleNextTrade();
  }

  scheduleNextTrade() {
    if (!this.isActive) return;

    let interval;
    switch (this.currentPattern?.speed) {
      case "매우빠름":
        interval = Math.random() * 1500 + 500;
        break;
      case "빠름":
        interval = Math.random() * 3000 + 1000;
        break;
      case "보통":
        interval = Math.random() * 5000 + 2000;
        break;
      case "느림":
        interval = Math.random() * 8000 + 5000;
        break;
      default:
        interval = Math.random() * 4000 + 2000;
    }

    setTimeout(async () => {
      if (this.currentData && this.isActive) await this.executeTrade();
      this.scheduleNextTrade();
    }, interval);
  }

  processData() {
    if (!this.currentData || !this.currentData.sellOrderbookData) return;
    this.balanceOrderbook();
  }

  balanceOrderbook() {
    const sellOrders = this.currentData.sellOrderbookData || [];
    const price = this.currentData.stockInfo?.price || 9500;

    for (let i = 1; i <= 5; i++) {
      const targetPrice = this.adjustPriceByTick(
        price + i * this.getTickSize(price)
      );
      const exists = sellOrders.find((o) => o.price === targetPrice);
      if (!exists && Math.random() < 0.25)
        this.placeOrder(
          targetPrice,
          Math.floor(Math.random() * 80 + 20),
          "limit",
          true
        );
    }
  }

  async executeTrade() {
    if (!this.currentData) return;

    const price = this.currentData.stockInfo?.price || 9500;
    const randomTicks = Math.floor(Math.random() * 5) + 1;
    const orderPrice = this.adjustPriceByTick(
      price + randomTicks * this.getTickSize(price)
    );
    const orderQuantity = Math.floor(
      (Math.floor(Math.random() * 200) + 50) / 2
    );
    const orderType = "market";

    await this.placeOrder(orderPrice, orderQuantity, orderType, false);
  }

  async placeOrder(price, quantity, orderType, isBalancing = false) {
    try {
      await axios.post(
        `${this.config.baseUrl}/stocks/orders/sell`,
        {
          accountNumber: this.config.accountNumber,
          stockId: 1,
          price,
          number: quantity,
          orderType,
        },
        {
          headers: {
            Cookie: `accessToken=${this.config.accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!isBalancing) {
        this.orderCount++;
        this.totalVolume += quantity;
        const time = new Date().toLocaleTimeString();
        console.log(
          `🔴 [매도] ${
            this.currentPattern.name
          } | ${price.toLocaleString()}원 ${quantity}주 ${orderType} | ${time}`
        );
        if (this.orderCount % 10 === 0)
          console.log(
            `   📊 누적: ${
              this.orderCount
            }건 ${this.totalVolume.toLocaleString()}주`
          );
      }
    } catch (e) {
      console.error(`🔴 [매도실패] ${e.response?.data?.message || e.message}`);
    }
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

  adjustPriceByTick(price) {
    const tick = this.getTickSize(price);
    return Math.round(price / tick) * tick;
  }
}

const sellBot = new SellBot();
