const io = require("socket.io-client")
const axios = require("axios")

class MarketMakerBot {
  constructor() {
    this.baseURL = "http://localhost:3000"
    this.socketURL = "http://localhost:3003/stock"
    // 두 계정을 번갈아 사용
    this.accounts = [
      {
        accessToken:
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsInVzZXJuYW1lIjoiYWRtaW4yIiwiaWF0IjoxNzUwOTUzMjcyfQ.qL-_-68sO6lPOjqKpmPqq1o4lcsyJM6WvVXhGqkHw7c",
        accountNumber: 1001,
      },
      {
        accessToken:
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsInVzZXJuYW1lIjoiYWRtaW4zIiwiaWF0IjoxNzUwOTUzMzA3fQ.i17g11m4VTXl8teoS87Hx1BvA_0vUmduN16SquoCcfU",
        accountNumber: 1002,
      },
    ]
    this.stockId = 1
    this.socket = null
    this.currentMarketData = null
    this.isRunning = false
    this.previousClose = null
    this.filledPrices = new Set() // 이미 채운 가격들 추적
  }

  // 호가단위 계산
  getTickSize(price) {
    if (price >= 2000 && price < 5000) return 5
    if (price >= 5000 && price < 20000) return 10
    if (price >= 20000 && price < 50000) return 50
    if (price >= 50000 && price < 200000) return 100
    if (price >= 200000 && price < 500000) return 500
    if (price >= 500000) return 1000
    return 1
  }

  // 호가단위에 맞게 가격 조정
  adjustPriceToTickSize(price) {
    const tickSize = this.getTickSize(price)
    return Math.round(price / tickSize) * tickSize
  }

  // previousClose 기준 +-30호가 가격 배열 생성
  generatePriceRange(basePrice) {
    const prices = []
    const tickSize = this.getTickSize(basePrice)

    // -30호가부터 +30호가까지
    for (let i = -300; i <= 300; i++) {
      const price = basePrice + i * tickSize
      if (price > 0) {
        prices.push(this.adjustPriceToTickSize(price))
      }
    }

    return prices
  }

  // 호가별 적절한 물량 계산
  getVolumeForPrice(price, basePrice) {
    const distance = Math.abs(price - basePrice)
    const tickSize = this.getTickSize(basePrice)
    const tickDistance = distance / tickSize

    // 기준가에서 멀수록 적은 물량
    if (tickDistance <= 5) {
      // 기준가 근처 (±5호가): 큰 물량
      return Math.floor(Math.random() * 250) + 100 // 200-700
    } else if (tickDistance <= 15) {
      // 중간 거리 (±6-15호가): 중간 물량
      return Math.floor(Math.random() * 150) + 50 // 100-400
    } else {
      // 먼 거리 (±16-30호가): 작은 물량
      return Math.floor(Math.random() * 50) + 25 // 50-150
    }
  }

  // 주문 실행
  async executeOrder(price, volume, orderType, tradingType) {
    try {
      // 계정 랜덤 선택
      const account = this.accounts[Math.floor(Math.random() * this.accounts.length)]

      const orderData = {
        accountNumber: account.accountNumber,
        stockId: this.stockId,
        price: price,
        number: volume,
        orderType: "limit", // 호가창 채우기용이므로 지정가만 사용
      }

      const endpoint = tradingType === "buy" ? "/stocks/orders/buy" : "/stocks/orders/sell"

      console.log(`📋[호가채우기-${tradingType}] 가격: ${price}, 수량: ${volume}`)

      const response = await axios.post(`${this.baseURL}${endpoint}`, orderData, {
        headers: {
          Cookie: `accessToken=${account.accessToken}`,
          "Content-Type": "application/json",
        },
        timeout: 5000,
      })

      console.log(`✅ ${tradingType} 주문 성공:`, response.data)
      this.filledPrices.add(price)
    } catch (error) {
      console.error(`❌ ${tradingType} 주문 실패:`, error.response?.data || error.message)
    }
  }

  // 호가창 채우기 실행
  async fillOrderbook() {
    if (!this.previousClose) return

    const basePrice = this.previousClose
    const priceRange = this.generatePriceRange(basePrice)

    console.log(`🎯 기준가: ${basePrice}, 호가 범위: ${priceRange[0]} ~ ${priceRange[priceRange.length - 1]}`)

    // 각 가격에 대해 매수/매도 주문 배치
    for (const price of priceRange) {
      // 이미 채운 가격은 스킵 (중복 방지)
      if (this.filledPrices.has(price)) continue

      const volume = this.getVolumeForPrice(price, basePrice)

      // 기준가보다 낮으면 매수 주문, 높으면 매도 주문
      if (price < basePrice) {
        await this.executeOrder(price, volume, "limit", "buy")
      } else if (price > basePrice) {
        await this.executeOrder(price, volume, "limit", "sell")
      } else {
        // 기준가에는 매수/매도 둘 다 배치
        await this.executeOrder(price, volume, "limit", "buy")
        await new Promise((resolve) => setTimeout(resolve, 100))
        await this.executeOrder(price, volume, "limit", "sell")
      }

      // 주문 간 간격 (서버 부하 방지)
      await new Promise((resolve) => setTimeout(resolve, 50))
    }

    console.log("🎉 호가창 채우기 완료!")
  }

  // 웹소켓 연결
  connectWebSocket() {
    this.socket = io(this.socketURL, {
      extraHeaders: {
        Cookie: `accessToken=${this.accounts[0].accessToken}`,
      },
    })

    this.socket.on("connect", () => {
      console.log("🔌 마켓메이커 웹소켓 연결됨")
      this.socket.emit("joinStockRoom", 1)
    })

    this.socket.on("stockUpdated", (data) => {
      this.currentMarketData = data

      // previousClose 가격 업데이트
      if (data.previousClose && data.previousClose.close) {
        const newPreviousClose = data.previousClose.close

        // previousClose가 변경되었거나 처음 설정될 때만 호가창 채우기
        if (this.previousClose !== newPreviousClose) {
          console.log(`📊 [기준가 업데이트] ${this.previousClose} → ${newPreviousClose}`)
          this.previousClose = newPreviousClose
          this.filledPrices.clear() // 기존 채운 가격 초기화

          // 3초 후 호가창 채우기 시작 (초기 데이터 안정화 대기)
          setTimeout(() => {
            if (this.isRunning) {
              this.fillOrderbook()
            }
          }, 3000)
        }
      }
    })

    this.socket.on("disconnect", () => {
      console.log("🔌 마켓메이커 웹소켓 연결 해제됨")
    })
  }

  // 주기적 호가창 보충
  startPeriodicFill() {
    setInterval(() => {
      if (this.isRunning && this.previousClose) {
        // 30% 확률로 호가창 보충
        if (Math.random() < 0.3) {
          console.log("🔄 호가창 보충 중...")
          this.fillOrderbook()
        }
      }
    }, 3000) // 30초마다 체크
  }

  // 봇 시작
  start() {
    console.log("🎯 마켓메이커 봇 시작...")
    this.isRunning = true
    this.connectWebSocket()

    // 주기적 호가창 보충 시작
    setTimeout(() => {
      this.startPeriodicFill()
    }, 3000) // 10초 후 시작
  }

  // 봇 중지
  stop() {
    console.log("🛑 마켓메이커 봇 중지...")
    this.isRunning = false
    if (this.socket) {
      this.socket.disconnect()
    }
  }
}

// 봇 실행
const marketMaker = new MarketMakerBot()
marketMaker.start()

// 프로세스 종료 시 정리
process.on("SIGINT", () => {
  marketMaker.stop()
  process.exit(0)
})

module.exports = MarketMakerBot
