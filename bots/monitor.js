const io = require("socket.io-client")

class TradingMonitor {
  constructor() {
    this.config = {
      socketUrl: "http://localhost:3003/stock",
    }

    this.socket = null
    this.marketData = null
    this.startTime = new Date()

    this.init()
  }

  async init() {
    await this.connectSocket()
    this.startMonitoring()
  }

  async connectSocket() {
    this.socket = io(this.config.socketUrl)

    this.socket.on("connect", () => {
      console.log("📡 Monitor connected to socket")
      this.socket.emit("joinStockRoom", 1)
    })

    this.socket.on("stockUpdated", (data) => {
      this.marketData = data
      this.displayMarketStatus()
    })

    this.socket.on("disconnect", () => {
      console.log("📡 Monitor disconnected")
    })
  }

  startMonitoring() {
    console.clear()
    console.log("🚀 Trading Bot Monitor Started")
    console.log("=".repeat(80))

    // 5초마다 화면 업데이트
    setInterval(() => {
      this.displayDashboard()
    }, 5000)
  }

  displayDashboard() {
    console.clear()

    const now = new Date()
    const uptime = Math.floor((now - this.startTime) / 1000)

    console.log("🎯 TRADING BOT MONITOR DASHBOARD")
    console.log("=".repeat(80))
    console.log(`⏰ Current Time: ${now.toLocaleString()}`)
    console.log(`🕐 Monitor Uptime: ${this.formatTime(uptime)}`)
    console.log("")

    if (this.marketData) {
      this.displayMarketInfo()
      this.displayOrderbook()
    } else {
      console.log("⏳ Waiting for market data...")
    }

    console.log("=".repeat(80))
    console.log("💡 Bot Status Updates appear above market data")
    console.log("🔄 Dashboard refreshes every 5 seconds")
  }

  displayMarketInfo() {
    const stock = this.marketData.stockInfo
    const history = this.marketData.stockHistory
    const prevClose = this.marketData.previousClose?.close || stock.price

    const change = stock.price - prevClose
    const changePercent = ((change / prevClose) * 100).toFixed(2)
    const changeIcon = change >= 0 ? "📈" : "📉"
    const changeColor = change >= 0 ? "+" : ""

    console.log("📊 MARKET INFORMATION")
    console.log("-".repeat(40))
    console.log(`🏢 Stock: ${stock.name}`)
    console.log(`💰 Current Price: ${stock.price.toLocaleString()}원`)
    console.log(`${changeIcon} Change: ${changeColor}${change.toLocaleString()}원 (${changeColor}${changePercent}%)`)
    console.log(`📊 High: ${history.high.toLocaleString()}원 | Low: ${history.low.toLocaleString()}원`)
    console.log(`🔓 Open: ${history.open.toLocaleString()}원 | 🔒 Prev Close: ${prevClose.toLocaleString()}원`)
    console.log("")
  }

  displayOrderbook() {
    const buyOrders = this.marketData.buyOrderbookData || []
    const sellOrders = this.marketData.sellOrderbookData || []

    console.log("📋 ORDERBOOK STATUS")
    console.log("-".repeat(60))

    // 매도 호가 (위에서부터)
    console.log("🔴 SELL ORDERS (매도)")
    const sortedSellOrders = sellOrders.sort((a, b) => b.price - a.price).slice(0, 5)

    if (sortedSellOrders.length > 0) {
      sortedSellOrders.forEach((order, index) => {
        const bar = "█".repeat(Math.min(20, Math.floor(order.number / 50)))
        console.log(
          `   ${order.price.toLocaleString().padStart(8)}원 | ${order.number.toString().padStart(6)}주 ${bar}`,
        )
      })
    } else {
      console.log("   No sell orders")
    }

    console.log("   " + "-".repeat(40))

    // 매수 호가 (아래에서부터)
    console.log("🔵 BUY ORDERS (매수)")
    const sortedBuyOrders = buyOrders.sort((a, b) => b.price - a.price).slice(0, 5)

    if (sortedBuyOrders.length > 0) {
      sortedBuyOrders.forEach((order, index) => {
        const bar = "█".repeat(Math.min(20, Math.floor(order.number / 50)))
        console.log(
          `   ${order.price.toLocaleString().padStart(8)}원 | ${order.number.toString().padStart(6)}주 ${bar}`,
        )
      })
    } else {
      console.log("   No buy orders")
    }

    console.log("")

    // 호가 스프레드 계산
    if (sortedBuyOrders.length > 0 && sortedSellOrders.length > 0) {
      const bestBid = Math.max(...buyOrders.map((o) => o.price))
      const bestAsk = Math.min(...sellOrders.map((o) => o.price))
      const spread = bestAsk - bestBid
      const spreadPercent = ((spread / bestBid) * 100).toFixed(3)

      console.log(`📏 Bid-Ask Spread: ${spread.toLocaleString()}원 (${spreadPercent}%)`)
      console.log(`🎯 Best Bid: ${bestBid.toLocaleString()}원 | Best Ask: ${bestAsk.toLocaleString()}원`)
    }

    console.log("")
  }

  displayMarketStatus() {
    // 실시간 거래 정보는 별도로 표시하지 않고 대시보드에서만 표시
  }

  formatTime(seconds) {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`
    } else {
      return `${secs}s`
    }
  }
}

// 모니터 실행
const monitor = new TradingMonitor()

// 종료 처리
process.on("SIGINT", () => {
  console.log("\n👋 Trading Monitor stopped")
  process.exit(0)
})
