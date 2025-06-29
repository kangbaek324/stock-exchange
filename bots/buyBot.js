const io = require("socket.io-client")
const axios = require("axios")

class BuyBot {
  constructor() {
    this.config = {
      accessToken:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsInVzZXJuYW1lIjoiYWRtaW4zIiwiaWF0IjoxNzUwOTUzMzA3fQ.i17g11m4VTXl8teoS87Hx1BvA_0vUmduN16SquoCcfU",
      accountNumber: 1002,
      baseUrl: "http://localhost:3000",
      socketUrl: "http://localhost:3003/stock",
    }

    this.socket = null
    this.currentData = null
    this.isActive = false
    this.currentPattern = null
    this.patternStartTime = null
    this.patternDuration = 0

    // 매수 패턴들
    this.patterns = [
      { name: "점진적매수", weight: 12, volatility: "낮음", speed: "보통" },
      { name: "급등매수", weight: 8, volatility: "매우높음", speed: "빠름" },
      { name: "지지선매수", weight: 10, volatility: "보통", speed: "보통" },
      { name: "하락매수", weight: 15, volatility: "보통", speed: "빠름" },
      { name: "모멘텀매수", weight: 12, volatility: "높음", speed: "매우빠름" },
      { name: "스캘핑매수", weight: 20, volatility: "낮음", speed: "매우빠름" },
      { name: "돌파매수", weight: 6, volatility: "매우높음", speed: "빠름" },
      { name: "물량수집", weight: 8, volatility: "낮음", speed: "느림" },
      { name: "패닉매수", weight: 3, volatility: "극높음", speed: "매우빠름" },
      { name: "안정매수", weight: 10, volatility: "낮음", speed: "보통" },
      { name: "대량매수", weight: 4, volatility: "높음", speed: "보통" },
      { name: "갭메우기매수", weight: 12, volatility: "보통", speed: "빠름" },
    ]

    this.orderCount = 0
    this.totalVolume = 0

    this.init()
  }

  async init() {
    await this.connectSocket()
    this.selectNewPattern()
    this.startTrading()
  }

  async connectSocket() {
    this.socket = io(this.config.socketUrl, {
      extraHeaders: {
        Cookie: `accessToken=${this.config.accessToken}`,
      },
    })

    this.socket.on("connect", () => {
      console.log("🔵 매수봇 연결됨")
      this.socket.emit("joinStockRoom", 1)
    })

    this.socket.on("stockUpdated", (data) => {
      this.currentData = data
      if (this.isActive) {
        this.processData()
      }
    })

    this.socket.on("disconnect", () => {
      console.log("🔵 매수봇 연결 끊김")
    })
  }

  selectNewPattern() {
    const totalWeight = this.patterns.reduce((sum, p) => sum + p.weight, 0)
    const random = Math.random() * totalWeight
    let currentWeight = 0

    for (const pattern of this.patterns) {
      currentWeight += pattern.weight
      if (random <= currentWeight) {
        this.currentPattern = pattern
        break
      }
    }

    // 패턴별 지속 시간
    switch (this.currentPattern.speed) {
      case "매우빠름":
        this.patternDuration = Math.random() * 30000 + 20000 // 20-50초
        break
      case "빠름":
        this.patternDuration = Math.random() * 60000 + 40000 // 40-100초
        break
      case "보통":
        this.patternDuration = Math.random() * 120000 + 60000 // 1-3분
        break
      case "느림":
        this.patternDuration = Math.random() * 180000 + 120000 // 2-5분
        break
      default:
        this.patternDuration = 60000
    }

    this.patternStartTime = Date.now()

    console.log(`\n🔵 [매수봇] 현재 ${this.currentPattern.name} 패턴 실행중`)
    console.log(`   📊 변동성: ${this.currentPattern.volatility} | 속도: ${this.currentPattern.speed}`)
    console.log(`   ⏱️  지속시간: ${Math.round(this.patternDuration / 1000)}초`)
  }

  startTrading() {
    this.isActive = true

    // 패턴 변경 체크
    setInterval(() => {
      if (Date.now() - this.patternStartTime > this.patternDuration) {
        this.selectNewPattern()
      }
    }, 2000)

    // 거래 실행
    this.scheduleNextTrade()
  }

  scheduleNextTrade() {
    if (!this.isActive) return

    let interval
    switch (this.currentPattern?.speed) {
      case "매우빠름":
        interval = Math.random() * 1500 + 500 // 0.5-2초
        break
      case "빠름":
        interval = Math.random() * 3000 + 1000 // 1-4초
        break
      case "보통":
        interval = Math.random() * 5000 + 2000 // 2-7초
        break
      case "느림":
        interval = Math.random() * 8000 + 5000 // 5-13초
        break
      default:
        interval = Math.random() * 4000 + 2000 // 2-6초
    }

    setTimeout(() => {
      if (this.currentData && this.isActive) {
        this.executeTrade()
      }
      this.scheduleNextTrade()
    }, interval)
  }

  processData() {
    if (!this.currentData || !this.currentData.buyOrderbookData || !this.currentData.sellOrderbookData) {
      return
    }

    // 호가 불균형 체크 및 보정
    this.balanceOrderbook()
  }

  balanceOrderbook() {
    const buyOrders = this.currentData.buyOrderbookData || []
    const currentPrice = this.currentData.stockInfo?.price || 9500

    // 매수 호가 5단계 채우기
    for (let i = 1; i <= 5; i++) {
      const targetPrice = this.adjustPriceByTick(currentPrice - i * this.getTickSize(currentPrice))
      const existingOrder = buyOrders.find((order) => order.price === targetPrice)

      if (!existingOrder && Math.random() < 0.25) {
        this.placeOrder(targetPrice, Math.floor(Math.random() * 80) + 20, "limit", true)
      }
    }
  }

  async executeTrade() {
    if (!this.currentData) return

    const currentPrice = this.currentData.stockInfo?.price || 9500
    let orderPrice, orderQuantity, orderType

    switch (this.currentPattern.name) {
      case "점진적매수":
        orderPrice = this.adjustPriceByTick(
          currentPrice - Math.floor(Math.random() * 3) * this.getTickSize(currentPrice),
        )
        orderQuantity = Math.floor(Math.random() * 150) + 50
        orderType = Math.random() < 0.8 ? "limit" : "market"
        break

      case "급등매수":
        orderPrice = this.adjustPriceByTick(
          currentPrice + Math.floor(Math.random() * 4) * this.getTickSize(currentPrice),
        )
        orderQuantity = Math.floor(Math.random() * 800) + 300
        orderType = Math.random() < 0.7 ? "market" : "limit"
        break

      case "지지선매수":
        orderPrice = this.adjustPriceByTick(
          currentPrice - (Math.floor(Math.random() * 2) + 1) * this.getTickSize(currentPrice),
        )
        orderQuantity = Math.floor(Math.random() * 250) + 100
        orderType = "limit"
        break

      case "하락매수":
        orderPrice = this.adjustPriceByTick(
          currentPrice - Math.floor(Math.random() * 2) * this.getTickSize(currentPrice),
        )
        orderQuantity = Math.floor(Math.random() * 400) + 150
        orderType = Math.random() < 0.6 ? "limit" : "market"
        break

      case "모멘텀매수":
        orderPrice = this.adjustPriceByTick(
          currentPrice + Math.floor(Math.random() * 3) * this.getTickSize(currentPrice),
        )
        orderQuantity = Math.floor(Math.random() * 600) + 200
        orderType = Math.random() < 0.5 ? "market" : "limit"
        break

      case "스캘핑매수":
        orderPrice = this.adjustPriceByTick(currentPrice - this.getTickSize(currentPrice))
        orderQuantity = Math.floor(Math.random() * 100) + 30
        orderType = "limit"
        break

      case "돌파매수":
        orderPrice = this.adjustPriceByTick(
          currentPrice + Math.floor(Math.random() * 5) * this.getTickSize(currentPrice),
        )
        orderQuantity = Math.floor(Math.random() * 700) + 400
        orderType = "market"
        break

      case "물량수집":
        orderPrice = this.adjustPriceByTick(
          currentPrice - Math.floor(Math.random() * 2) * this.getTickSize(currentPrice),
        )
        orderQuantity = Math.floor(Math.random() * 200) + 100
        orderType = "limit"
        break

      case "패닉매수":
        orderPrice = this.adjustPriceByTick(
          currentPrice + Math.floor(Math.random() * 6) * this.getTickSize(currentPrice),
        )
        orderQuantity = Math.floor(Math.random() * 1000) + 600
        orderType = "market"
        break

      case "안정매수":
        orderPrice = this.adjustPriceByTick(currentPrice)
        orderQuantity = Math.floor(Math.random() * 180) + 80
        orderType = Math.random() < 0.9 ? "limit" : "market"
        break

      case "대량매수":
        orderQuantity = Math.floor(Math.random() * 900) + 500
        orderPrice = this.adjustPriceByTick(currentPrice)
        orderType = Math.random() < 0.6 ? "limit" : "market"
        break

      case "갭메우기매수":
        const gap = this.findPriceGap()
        if (gap) {
          orderPrice = gap
          orderQuantity = Math.floor(Math.random() * 300) + 100
          orderType = "limit"
        } else {
          return
        }
        break

      default:
        orderPrice = this.adjustPriceByTick(currentPrice)
        orderQuantity = Math.floor(Math.random() * 200) + 50
        orderType = "limit"
    }

    await this.placeOrder(orderPrice, orderQuantity, orderType, false)
  }

  async placeOrder(price, quantity, orderType, isBalancing = false) {
    try {
      const orderData = {
        accountNumber: this.config.accountNumber,
        stockId: 1,
        price: price,
        number: quantity,
        orderType: orderType,
      }

      const response = await axios.post(`${this.config.baseUrl}/stocks/orders/buy`, orderData, {
        headers: {
          Cookie: `accessToken=${this.config.accessToken}`,
          "Content-Type": "application/json",
        },
      })

      if (!isBalancing) {
        this.orderCount++
        this.totalVolume += quantity

        const currentTime = new Date().toLocaleTimeString()
        console.log(
          `🔵 [매수] ${this.currentPattern.name} | ${price.toLocaleString()}원 ${quantity}주 ${orderType} | ${currentTime}`,
        )

        // 10건마다 통계 출력
        if (this.orderCount % 10 === 0) {
          console.log(`   📊 누적: ${this.orderCount}건 ${this.totalVolume.toLocaleString()}주`)
        }
      }
    } catch (error) {
      console.error(`🔵 [매수실패] ${error.response?.data?.message || error.message}`)
    }
  }

  getTickSize(price) {
    if (price >= 2000 && price < 5000) return 5
    if (price >= 5000 && price < 20000) return 10
    if (price >= 20000 && price < 50000) return 50
    if (price >= 50000 && price < 200000) return 100
    if (price >= 200000 && price < 500000) return 500
    if (price >= 500000) return 1000
    return 1
  }

  adjustPriceByTick(price) {
    const tickSize = this.getTickSize(price)
    return Math.round(price / tickSize) * tickSize
  }

  findPriceGap() {
    if (!this.currentData || !this.currentData.buyOrderbookData) return null

    const currentPrice = this.currentData.stockInfo?.price || 9500
    const tickSize = this.getTickSize(currentPrice)

    for (let i = 1; i <= 3; i++) {
      const targetPrice = this.adjustPriceByTick(currentPrice - i * tickSize)
      const existingOrder = this.currentData.buyOrderbookData.find((order) => order.price === targetPrice)
      if (!existingOrder) {
        return targetPrice
      }
    }

    return null
  }
}

// 봇 실행
const buyBot = new BuyBot()
