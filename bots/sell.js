const io = require("socket.io-client")
const axios = require("axios")

class EnhancedSellBot {
  constructor() {
    this.baseURL = "http://localhost:3000"
    this.socketURL = "http://localhost:3003/stock"
    this.accessToken =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsInVzZXJuYW1lIjoiYWRtaW4yIiwiaWF0IjoxNzUwOTUzMjcyfQ.qL-_-68sO6lPOjqKpmPqq1o4lcsyJM6WvVXhGqkHw7c"
    this.accountNumber = 1001
    this.stockId = 1
    this.socket = null
    this.currentMarketData = null
    this.isRunning = false

    // 수급 리듬 관리 (매도 버전)
    this.supplyDemandRhythm = {
      active: false,
      phase: "calm", // calm, building, peak, sustaining, fading
      intensity: 0, // 0-10 강도
      duration: 0,
      maxDuration: 0,
      orderFrequency: 1000,
      lastPhaseChange: Date.now(),
    }

    // 기존 패턴들
    this.basicPatterns = {
      burst: { active: false, count: 0, max: 0 },
      wave: { active: false, intensity: 0, direction: 1 },
      spike: { active: false, remaining: 0 },
      rhythm: { active: false, beat: 0, pattern: [] },
    }

    this.crashPatterns = {
      crash: {
        active: false,
        targetPrice: 0,
        currentStep: 0,
        totalSteps: 0,
        stepSize: 0,
        basePrice: 0,
      },
      dump: {
        active: false,
        pressure: 0,
        targetDecrease: 0,
        orderCount: 0,
        maxOrders: 0,
      },
      stepDown: {
        active: false,
        currentLevel: 0,
        levels: [],
        levelProgress: 0,
      },
      breakdown: {
        active: false,
        supportPrice: 0,
        breakdownTarget: 0,
        phase: "distribution",
      },
      panic: {
        active: false,
        intensity: 0,
        acceleration: 0,
        duration: 0,
        elapsed: 0,
      },
    }
  }

  // 호가단위 체크 및 조정
  adjustPriceToTickSize(price) {
    if (price >= 2000 && price < 5000) {
      return Math.ceil(price / 5) * 5
    } else if (price >= 5000 && price < 20000) {
      return Math.ceil(price / 10) * 10
    } else if (price >= 20000 && price < 50000) {
      return Math.ceil(price / 50) * 50
    } else if (price >= 50000 && price < 200000) {
      return Math.ceil(price / 100) * 100
    } else if (price >= 200000 && price < 500000) {
      return Math.ceil(price / 500) * 500
    } else if (price >= 500000) {
      return Math.ceil(price / 1000) * 1000
    }
    return price
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

  // 수급 리듬 업데이트 (매도 버전)
  updateSupplyDemandRhythm() {
    const now = Date.now()
    const timeSinceLastChange = now - this.supplyDemandRhythm.lastPhaseChange
    const rhythm = this.supplyDemandRhythm

    switch (rhythm.phase) {
      case "calm":
        if (Math.random() < 0.02) {
          // 2.5% 확률로 매도 수급 시작
          rhythm.phase = "building"
          rhythm.intensity = 1
          rhythm.duration = 0
          rhythm.maxDuration = Math.floor(Math.random() * 12000) + 8000 // 8-20초
          rhythm.orderFrequency = 900
          rhythm.lastPhaseChange = now
          console.log("🌊 [매도 수급 리듬] 매도 압력 형성 시작!")
        }
        break

      case "building":
        rhythm.intensity = Math.min(rhythm.intensity + 0.25, 6)
        rhythm.orderFrequency = Math.max(600, 1600 - rhythm.intensity * 160)

        if (timeSinceLastChange > rhythm.maxDuration || rhythm.intensity >= 6) {
          rhythm.phase = "peak"
          rhythm.intensity = Math.floor(Math.random() * 3) + 8 // 8-11 강도
          rhythm.duration = 0
          rhythm.maxDuration = Math.floor(Math.random() * 6000) + 4000 // 4-10초
          rhythm.orderFrequency = 150 + Math.random() * 250 // 30-110ms
          rhythm.lastPhaseChange = now
          console.log(`🔥 [매도 수급 리듬] 매도 폭발! 강도: ${rhythm.intensity}`)
        }
        break

      case "peak":
        if (timeSinceLastChange > rhythm.maxDuration) {
          rhythm.phase = "sustaining"
          rhythm.intensity = Math.floor(rhythm.intensity * 0.75) // 강도 감소
          rhythm.duration = 0
          rhythm.maxDuration = Math.floor(Math.random() * 18000) + 12000 // 12-30초
          rhythm.orderFrequency = 700 + Math.random() * 350
          rhythm.lastPhaseChange = now
          console.log(`📉 [매도 수급 리듬] 매도 압력 유지, 강도: ${rhythm.intensity}`)
        }
        break

      case "sustaining":
        if (timeSinceLastChange > 4000) {
          // 4초마다 강도 감소
          rhythm.intensity = Math.max(1, rhythm.intensity - 0.4)
          rhythm.orderFrequency = Math.min(1200, rhythm.orderFrequency + 60)
          rhythm.lastPhaseChange = now
        }

        if (timeSinceLastChange > rhythm.maxDuration || rhythm.intensity <= 1) {
          rhythm.phase = "fading"
          rhythm.duration = 0
          rhythm.maxDuration = Math.floor(Math.random() * 8000) + 4000 // 4-12초
          rhythm.lastPhaseChange = now
          console.log("📉 [매도 수급 리듬] 매도 압력 소멸 시작")
        }
        break

      case "fading":
        rhythm.intensity = Math.max(0, rhythm.intensity - 0.15)
        rhythm.orderFrequency = Math.min(3500, rhythm.orderFrequency + 250)

        if (timeSinceLastChange > rhythm.maxDuration || rhythm.intensity <= 0) {
          rhythm.phase = "calm"
          rhythm.intensity = 0
          rhythm.orderFrequency = 1200 + Math.random() * 1800 // 1.2-3초
          rhythm.active = false
          rhythm.lastPhaseChange = now
          console.log("😴 [매도 수급 리듬] 매도 압력 종료, 잔잔한 상태로")
        }
        break
    }

    rhythm.active = rhythm.phase !== "calm"
    rhythm.duration = timeSinceLastChange
  }

  // 수급 강도에 따른 주문 수량 결정 (매도 버전)
  getSupplyDemandQuantity() {
    const intensity = this.supplyDemandRhythm.intensity
    const baseQuantity = Math.floor(Math.random() * 60) + 30 // 기존 120+60 -> 60+30

    switch (this.supplyDemandRhythm.phase) {
      case "building":
        return Math.floor(baseQuantity * (1 + intensity * 0.35))
      case "peak":
        return Math.floor(baseQuantity * (2.5 + intensity * 0.6)) // 대량 매도
      case "sustaining":
        return Math.floor(baseQuantity * (1.8 + intensity * 0.25))
      case "fading":
        return Math.floor(baseQuantity * (0.7 + intensity * 0.15))
      default:
        return baseQuantity
    }
  }

  // 하락 유도 갭 채우기 (매도봇 전용)
  async checkAndFillGaps() {
    if (!this.currentMarketData) return

    const currentPrice = this.currentMarketData.stockInfo.price
    const sellOrderbook = this.currentMarketData.sellOrderbookData || []
    const buyOrderbook = this.currentMarketData.buyOrderbookData || []

    // 매수 호가 갭 채우기 - 하락 유도 (낮은 가격에 매도)
    await this.fillGapsForDowntrend(buyOrderbook, currentPrice, "buy")

    // 매도 호가 갭 채우기 - 하락 유도 (낮은 가격에 매도)
    await this.fillGapsForDowntrend(sellOrderbook, currentPrice, "sell")
  }

  async fillGapsForDowntrend(orderbook, currentPrice, type) {
    if (!orderbook || orderbook.length < 2) return

    const sortedOrders = orderbook.map((order) => order.price).sort((a, b) => (type === "sell" ? a - b : b - a))
    const gaps = []

    // 모든 갭 찾기 (기준을 0.3%에��� 0.2%로 강화)
    for (let i = 0; i < sortedOrders.length - 1; i++) {
      const price1 = sortedOrders[i]
      const price2 = sortedOrders[i + 1]
      const percentDiff = Math.abs(((price2 - price1) / price1) * 100)

      if (percentDiff > 0.2) {
        // 0.2% 이상 갭이면 채우기
        gaps.push({
          price1: price1,
          price2: price2,
          gap: percentDiff,
          index: i,
        })
      }
    }

    // 갭이 큰 순서대로 정렬
    gaps.sort((a, b) => b.gap - a.gap)

    // 상위 3개 갭 동시에 채우기
    const topGaps = gaps.slice(0, 3)

    for (const gap of topGaps) {
      console.log(`🔧 [하락유도 갭채우기] ${type} 호가 ${gap.price1} - ${gap.price2} 차이: ${gap.gap.toFixed(2)}%`)
      await this.fillSingleGapForDowntrend(gap.price1, gap.price2, currentPrice)
    }
  }

  async fillSingleGapForDowntrend(price1, price2, currentPrice) {
    const minPrice = Math.min(price1, price2)
    const maxPrice = Math.max(price1, price2)
    const tickSize = this.getTickSize(minPrice)

    const gapTicks = Math.floor((maxPrice - minPrice) / tickSize) - 1
    if (gapTicks <= 0) return

    // 적은 횟수로 많은 수량으로 갭 채우기 (기존 8개 -> 3-4개)
    const fillCount = Math.min(gapTicks, Math.floor(Math.random() * 2) + 3)

    console.log(`🔧 [하락유도 대량갭채우기] ${fillCount}개 호가를 낮은 가격 위주로 채움`)

    for (let i = 1; i <= fillCount; i++) {
      // 하락 유도: 갭의 낮은 가격 쪽에 더 많이 배치 (0% ~ 30% 범위)
      const gapPosition = (i / fillCount) * 0.3 // 0.0 ~ 0.3 범위
      const fillPrice = this.adjustPriceToTickSize(minPrice + tickSize * Math.floor(gapTicks * gapPosition))

      const percentFromCurrent = Math.abs(((fillPrice - currentPrice) / currentPrice) * 100)
      if (percentFromCurrent > 4) continue

      // 수량을 절반으로 감소 (기존 1000-2000 -> 500-1000)
      const volume = Math.floor(Math.random() * 500) + 500

      try {
        const orderData = {
          accountNumber: this.accountNumber,
          stockId: this.stockId,
          price: fillPrice,
          number: volume,
          orderType: "limit",
        }

        console.log(`🔧[하락유도갭채우기-매도 ${i}/${fillCount}] 가격: ${fillPrice}, 수량: ${volume} (하락유도)`)

        axios
          .post(`${this.baseURL}/stocks/orders/sell`, orderData, {
            headers: {
              Cookie: `accessToken=${this.accessToken}`,
              "Content-Type": "application/json",
            },
            timeout: 10000,
          })
          .then((response) => {
            console.log(`✅ 하락유도갭채우기 ${i}/${fillCount} 성공:`, response.data)
          })
          .catch((error) => {
            console.error(`❌ 하락유도갭채우기 ${i}/${fillCount} 실패:`, error.response?.data || error.message)
          })

        if (i < fillCount) {
          await new Promise((resolve) => setTimeout(resolve, 2000 + Math.random() * 1000)) // 2-3초 간격
        }
      } catch (error) {
        console.error("하락유도갭채우기 오류:", error.message)
      }
    }
  }

  // 수급 리듬에 따른 주문 실행
  async executeRhythmBasedOrder() {
    if (!this.currentMarketData) return

    this.updateSupplyDemandRhythm()

    if (!this.supplyDemandRhythm.active) {
      // 잔잔한 상태에서는 기본 주문
      await this.executeBasicSellOrder("base")
      return
    }

    // 수급 강도에 따른 주문
    const rhythm = this.supplyDemandRhythm
    const currentPrice = this.currentMarketData.stockInfo.price
    const buyOrderbook = this.currentMarketData.buyOrderbookData || []

    const orderData = {
      accountNumber: this.accountNumber,
      stockId: this.stockId,
      price: this.getRhythmBasedPrice(currentPrice, buyOrderbook, rhythm),
      number: this.getSupplyDemandQuantity(),
      orderType: rhythm.intensity > 6 ? "market" : "limit", // 강도 높을 때 시장가
    }

    console.log(
      `🌊[매도수급리듬-${rhythm.phase.toUpperCase()}] 강도:${rhythm.intensity} 가격:${orderData.price} 수량:${orderData.number}`,
    )

    try {
      const response = await axios.post(`${this.baseURL}/stocks/orders/sell`, orderData, {
        headers: {
          Cookie: `accessToken=${this.accessToken}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      })
      console.log("✅ 매도수급리듬 주문 성공:", response.data)
    } catch (error) {
      console.error("❌ 매도수급리듬 주문 실패:", error.response?.data || error.message)
    }
  }

  // 수급 리듬에 따른 가격 결정
  getRhythmBasedPrice(currentPrice, buyOrderbook, rhythm) {
    if (!buyOrderbook || buyOrderbook.length === 0) {
      const priceMultiplier = 1 - rhythm.intensity * 0.001 // 강도에 따라 더 낮은 가격
      return this.adjustPriceToTickSize(currentPrice * priceMultiplier)
    }

    const sortedBuys = buyOrderbook.map((o) => o.price).sort((a, b) => b - a)
    let targetPrice

    switch (rhythm.phase) {
      case "building":
        // 형성 단계: 조심스럽게 매도
        targetPrice = sortedBuys[Math.floor(Math.random() * Math.min(3, sortedBuys.length))]
        break
      case "peak":
        // 폭발 단계: 공격적 매도
        targetPrice = sortedBuys[0] - this.getTickSize(sortedBuys[0]) * (1 + Math.floor(Math.random() * 2))
        break
      case "sustaining":
        // 유지 단계: 안정적 매도
        targetPrice = sortedBuys[Math.floor(Math.random() * Math.min(4, sortedBuys.length))]
        break
      case "fading":
        // 소멸 단계: 소극적 매도
        targetPrice = sortedBuys[Math.floor(Math.random() * Math.min(2, sortedBuys.length))] * 1.001
        break
      default:
        targetPrice = currentPrice
    }

    return this.adjustPriceToTickSize(targetPrice)
  }

  // 기존 메서드들 유지...
  getBasicSellPrice(currentPrice, buyOrderbook, isPattern = false) {
    const maxPercentDiff = 4

    if (!buyOrderbook || buyOrderbook.length === 0) {
      const maxVariation = currentPrice * (maxPercentDiff / 100)
      const variation = (Math.random() * 2 - 1) * maxVariation
      const targetPrice = currentPrice + variation
      return this.adjustPriceToTickSize(Math.max(targetPrice, currentPrice * 0.96))
    }

    const sortedBuyPrices = buyOrderbook
      .map((order) => order.price)
      .sort((a, b) => b - a)
      .slice(0, isPattern ? 5 : 3)

    let targetPrice = sortedBuyPrices[Math.floor(Math.random() * sortedBuyPrices.length)]

    const percentDiff = Math.abs(((targetPrice - currentPrice) / currentPrice) * 100)

    if (percentDiff > maxPercentDiff) {
      const maxPrice = currentPrice * (1 + maxPercentDiff / 100)
      const minPrice = currentPrice * (1 - maxPercentDiff / 100)

      if (targetPrice > currentPrice) {
        targetPrice = Math.min(targetPrice, maxPrice)
      } else {
        targetPrice = Math.max(targetPrice, minPrice)
      }
    }

    return this.adjustPriceToTickSize(targetPrice || currentPrice * 0.99)
  }

  getCrashSellPrice(currentPrice, buyOrderbook, targetPrice = null) {
    const maxPercentDiff = 4

    if (!buyOrderbook || buyOrderbook.length === 0) {
      const crashPrice = currentPrice * (0.995 - Math.random() * 0.004)
      return this.adjustPriceToTickSize(crashPrice)
    }

    const sortedBuyPrices = buyOrderbook
      .map((order) => order.price)
      .sort((a, b) => b - a)
      .slice(0, 8)

    for (let i = 0; i < sortedBuyPrices.length - 1; i++) {
      const price1 = sortedBuyPrices[i]
      const price2 = sortedBuyPrices[i + 1]
      const gapPercent = ((price1 - price2) / price2) * 100

      if (gapPercent > 0.3) {
        const fillPrice = price2 + (price1 - price2) * (0.3 + Math.random() * 0.4)
        const adjustedPrice = this.adjustPriceToTickSize(fillPrice)

        const percentFromCurrent = Math.abs(((adjustedPrice - currentPrice) / currentPrice) * 100)
        if (percentFromCurrent <= maxPercentDiff) {
          return adjustedPrice
        }
      }
    }

    const highestBuy = sortedBuyPrices[0]
    const crashPrice = highestBuy - this.getTickSize(highestBuy) * (1 + Math.floor(Math.random() * 3))

    const percentFromCurrent = Math.abs(((crashPrice - currentPrice) / currentPrice) * 100)
    if (percentFromCurrent > maxPercentDiff) {
      return this.adjustPriceToTickSize(currentPrice * (1 - maxPercentDiff / 100))
    }

    return this.adjustPriceToTickSize(crashPrice)
  }

  getBasicOrderQuantity(isPattern = false, patternType = null) {
    const random = Math.random()
    let multiplier = 1

    if (isPattern) {
      switch (patternType) {
        case "burst":
          multiplier = 1.2
          break
        case "wave":
          multiplier = 0.8 + this.basicPatterns.wave.intensity * 0.4
          break
        case "spike":
          multiplier = 2.0
          break
        case "rhythm":
          multiplier = 1.1
          break
      }
    }

    if (random < 0.05) {
      return Math.floor((Math.random() * 250 + 250) * multiplier) // 기존 500+500 -> 250+250
    } else if (random < 0.2) {
      return Math.floor((Math.random() * 100 + 50) * multiplier) // 기존 200+100 -> 100+50
    } else {
      return Math.floor((Math.random() * 25 + 1) * multiplier) // 기존 50+1 -> 25+1
    }
  }

  getCrashOrderQuantity(patternType, intensity = 1) {
    const random = Math.random()
    let baseQuantity

    if (random < 0.1) {
      baseQuantity = Math.floor(Math.random() * 200) + 150 // 기존 400+300 -> 200+150
    } else if (random < 0.3) {
      baseQuantity = Math.floor(Math.random() * 100) + 75 // 기존 200+150 -> 100+75
    } else {
      baseQuantity = Math.floor(Math.random() * 50) + 15 // 기존 100+30 -> 50+15
    }

    switch (patternType) {
      case "crash":
        return Math.floor(baseQuantity * intensity * 1.4)
      case "dump":
        return Math.floor(baseQuantity * intensity * 2.0)
      case "stepDown":
        return Math.floor(baseQuantity * intensity * 1.2)
      case "breakdown":
        return Math.floor(baseQuantity * intensity * 2.5)
      case "panic":
        return Math.floor(baseQuantity * intensity * 1.8)
      default:
        return baseQuantity
    }
  }

  getOrderType(isPattern = false) {
    const marketRatio = isPattern ? 0.7 : 0.5
    return Math.random() < marketRatio ? "market" : "limit"
  }

  async executeBasicSellOrder(orderType = "base") {
    if (!this.currentMarketData) return

    try {
      const currentPrice = this.currentMarketData.stockInfo.price
      const buyOrderbook = this.currentMarketData.buyOrderbookData || []
      const isPattern = orderType !== "base"

      const orderData = {
        accountNumber: this.accountNumber,
        stockId: this.stockId,
        price: this.getBasicSellPrice(currentPrice, buyOrderbook, isPattern),
        number: this.getBasicOrderQuantity(isPattern, orderType),
        orderType: this.getOrderType(isPattern),
      }

      const prefix = orderType === "base" ? "[BASE]" : `[${orderType.toUpperCase()}]`
      console.log(
        `🔥[기본매도${prefix}] 가격: ${orderData.price}, 수량: ${orderData.number}, 타입: ${orderData.orderType}`,
      )

      axios
        .post(`${this.baseURL}/stocks/orders/sell`, orderData, {
          headers: {
            Cookie: `accessToken=${this.accessToken}`,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        })
        .then((response) => {
          console.log("✅ 기본매도 성공:", response.data)
        })
        .catch((error) => {
          console.error("❌ 기본매도 실패:", error.response?.data || error.message)
        })
    } catch (error) {
      console.error("기본매도 주문 오류:", error.message)
    }
  }

  async executeCrashSellOrder(orderType = "base", patternData = {}) {
    if (!this.currentMarketData) return

    try {
      const currentPrice = this.currentMarketData.stockInfo.price
      const buyOrderbook = this.currentMarketData.buyOrderbookData || []
      const isPattern = orderType !== "base"

      const orderData = {
        accountNumber: this.accountNumber,
        stockId: this.stockId,
        price: this.getCrashSellPrice(currentPrice, buyOrderbook, patternData.targetPrice),
        number: this.getCrashOrderQuantity(orderType, patternData.intensity || 1),
        orderType: isPattern ? "limit" : this.getOrderType(isPattern),
      }

      const prefix = orderType === "base" ? "[BASE]" : `[${orderType.toUpperCase()}]`
      console.log(
        `📉[하락매도${prefix}] 가격: ${orderData.price}, 수량: ${orderData.number}, 타입: ${orderData.orderType}`,
      )

      axios
        .post(`${this.baseURL}/stocks/orders/sell`, orderData, {
          headers: {
            Cookie: `accessToken=${this.accessToken}`,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        })
        .then((response) => {
          console.log("✅ 하락매도 성공:", response.data)
        })
        .catch((error) => {
          console.error("❌ 하락매도 실패:", error.response?.data || error.message)
        })
    } catch (error) {
      console.error("하락매도 주문 오류:", error.message)
    }
  }

  // 웹소켓 연결
  connectWebSocket() {
    this.socket = io(this.socketURL, {
      extraHeaders: {
        Cookie: `accessToken=${this.accessToken}`,
      },
    })

    this.socket.on("connect", () => {
      console.log("🔌 강화된 매도봇 웹소켓 연결됨")
      this.socket.emit("joinStockRoom", 1)
    })

    this.socket.on("stockUpdated", (data) => {
      this.currentMarketData = data
      console.log(`📊 [강화된 매도봇-시장데이터] 현재가: ${data.stockInfo.price}`)
    })

    this.socket.on("disconnect", () => {
      console.log("🔌 강화된 매도봇 웹소켓 연결 해제됨")
    })
  }

  // 기본 주문 간격 (수급 리듬 반영)
  getBaseOrderInterval() {
    if (this.supplyDemandRhythm.active) {
      return this.supplyDemandRhythm.orderFrequency
    }
    return Math.random() * 2000 + 1000
  }

  // 갭 채우기 스케줄링
  scheduleGapFilling() {
    if (!this.isRunning) return

    setTimeout(async () => {
      if (this.isRunning && this.currentMarketData) {
        await this.checkAndFillGaps()
      }
      this.scheduleGapFilling()
    }, 5000) // 5초마다 체크
  }

  // 수급 리듬 기반 주문 스케줄링
  scheduleRhythmBasedOrder() {
    if (!this.isRunning) return

    const interval = this.getBaseOrderInterval()
    setTimeout(async () => {
      if (this.isRunning && this.currentMarketData) {
        await this.executeRhythmBasedOrder()
      }
      this.scheduleRhythmBasedOrder()
    }, interval)
  }

  // 봇 시작
  start() {
    console.log("🔥📉 강화된 매도봇 시작...")
    this.isRunning = true
    this.connectWebSocket()

    setTimeout(() => {
      // 수급 리듬 기반 주문 스케줄링
      this.scheduleRhythmBasedOrder()

      // 강화된 갭 채우기 스케줄링
      this.scheduleGapFilling()

      // 기본 패턴들 활성화 (15% 비율)
      this.scheduleBasicPatterns()

      // 하락 패턴들 활성화 (10% 비율)
      this.scheduleCrashPatterns()

      // 패턴 관리자 시작
      this.schedulePatternManager()
    }, 1000)
  }

  // 패턴 관리자 - 전체 패턴 비율 조절
  schedulePatternManager() {
    if (!this.isRunning) return

    setTimeout(
      async () => {
        if (this.isRunning && this.currentMarketData) {
          const random = Math.random() * 100

          if (random < 2) {
            // 2% - 수급 리듬은 자체적으로 관리됨
          } else if (random < 27) {
            // 25% - 기본 패턴들 (기존 15%에서 증가)
            await this.executeRandomBasicPattern()
          } else if (random < 52) {
            // 25% - 하락 패턴들 (기존 10%에서 증가)
            await this.executeRandomCrashPattern()
          } else {
            // 48% - 기본 주문 (기존 73%에서 감소)
          }
        }
        this.schedulePatternManager()
      },
      Math.random() * 2000 + 1500, // 1.5-3.5초 간격 (더 자주 실행)
    )
  }

  // 기본 패턴 스케줄링
  scheduleBasicPatterns() {
    if (!this.isRunning) return

    setTimeout(
      async () => {
        if (this.isRunning) {
          // Burst 패턴 (5% - 기존 3%에서 증가)
          if (Math.random() < 0.05 && !this.basicPatterns.burst.active) {
            this.startBurstPattern()
          }

          // Wave 패턴 (6% - 기존 4%에서 증가)
          if (Math.random() < 0.06 && !this.basicPatterns.wave.active) {
            this.startWavePattern()
          }

          // Spike 패턴 (4% - 기존 2%에서 증가)
          if (Math.random() < 0.04 && !this.basicPatterns.spike.active) {
            this.startSpikePattern()
          }

          // Rhythm 패턴 (5% - 기존 3%에서 증가)
          if (Math.random() < 0.05 && !this.basicPatterns.rhythm.active) {
            this.startRhythmPattern()
          }
        }
        this.scheduleBasicPatterns()
      },
      Math.random() * 3000 + 2000, // 2-5초 간격 (더 자주 체크)
    )
  }

  // 하락 패턴 스케줄링
  scheduleCrashPatterns() {
    if (!this.isRunning) return

    setTimeout(
      async () => {
        if (this.isRunning) {
          // Crash 패턴 (4% - 기존 2%에서 증가)
          if (Math.random() < 0.04 && !this.crashPatterns.crash.active) {
            this.startCrashPattern()
          }

          // Dump 패턴 (4% - 기존 2%에서 증가)
          if (Math.random() < 0.04 && !this.crashPatterns.dump.active) {
            this.startDumpPattern()
          }

          // StepDown 패턴 (4% - 기존 2%에서 증가)
          if (Math.random() < 0.04 && !this.crashPatterns.stepDown.active) {
            this.startStepDownPattern()
          }

          // Breakdown 패턴 (3% - 기존 1.5%에서 증가)
          if (Math.random() < 0.03 && !this.crashPatterns.breakdown.active) {
            this.startBreakdownPattern()
          }

          // Panic 패턴 (5% - 기존 2.5%에서 증가)
          if (Math.random() < 0.05 && !this.crashPatterns.panic.active) {
            this.startPanicPattern()
          }
        }
        this.scheduleCrashPatterns()
      },
      Math.random() * 4000 + 3000, // 3-7초 간격
    )
  }

  // 랜덤 기본 패턴 실행
  async executeRandomBasicPattern() {
    const patterns = ["burst", "wave", "spike", "rhythm"]
    const randomPattern = patterns[Math.floor(Math.random() * patterns.length)]

    console.log(`🎯 [패턴매니저] ${randomPattern} 패턴 실행`)
    await this.executeBasicSellOrder(randomPattern)
  }

  // 랜덤 하락 패턴 실행
  async executeRandomCrashPattern() {
    const patterns = ["crash", "dump", "stepDown", "breakdown", "panic"]
    const randomPattern = patterns[Math.floor(Math.random() * patterns.length)]

    console.log(`📉 [패턴매니저] ${randomPattern} 패턴 실행`)
    await this.executeCrashSellOrder(randomPattern, { intensity: Math.random() * 2 + 1 })
  }

  // 기본 패턴 시작 메서드들
  startBurstPattern() {
    this.basicPatterns.burst.active = true
    this.basicPatterns.burst.count = 0
    this.basicPatterns.burst.max = Math.floor(Math.random() * 8) + 5 // 5-12회
    console.log(`💥 [BURST 패턴] 시작! ${this.basicPatterns.burst.max}회 연속 주문`)
    this.executeBurstPattern()
  }

  startWavePattern() {
    this.basicPatterns.wave.active = true
    this.basicPatterns.wave.intensity = Math.random() * 3 + 1 // 1-4 강도
    this.basicPatterns.wave.direction = 1
    console.log(`🌊 [WAVE 패턴] 시작! 강도: ${this.basicPatterns.wave.intensity.toFixed(1)}`)
    this.executeWavePattern()
  }

  startSpikePattern() {
    this.basicPatterns.spike.active = true
    this.basicPatterns.spike.remaining = Math.floor(Math.random() * 5) + 3 // 3-7회
    console.log(`⚡ [SPIKE 패턴] 시작! ${this.basicPatterns.spike.remaining}회 급속 주문`)
    this.executeSpikePattern()
  }

  startRhythmPattern() {
    this.basicPatterns.rhythm.active = true
    this.basicPatterns.rhythm.beat = 0
    this.basicPatterns.rhythm.pattern = [250, 450, 350, 650, 300, 550] // 리듬 패턴
    console.log(`🎵 [RHYTHM 패턴] 시작! 리듬 패턴 실행`)
    this.executeRhythmPattern()
  }

  // 하락 패턴 시작 메서드들
  startCrashPattern() {
    const currentPrice = this.currentMarketData?.stockInfo?.price || 10000
    this.crashPatterns.crash.active = true
    this.crashPatterns.crash.basePrice = currentPrice
    this.crashPatterns.crash.targetPrice = currentPrice * (0.95 - Math.random() * 0.03) // 2-5% 하락
    this.crashPatterns.crash.currentStep = 0
    this.crashPatterns.crash.totalSteps = Math.floor(Math.random() * 8) + 5
    console.log(`📉 [CRASH 패턴] 시작! 목표: ${this.crashPatterns.crash.targetPrice}`)
    this.executeCrashPatternLoop()
  }

  startDumpPattern() {
    this.crashPatterns.dump.active = true
    this.crashPatterns.dump.pressure = Math.random() * 2 + 1
    this.crashPatterns.dump.orderCount = 0
    this.crashPatterns.dump.maxOrders = Math.floor(Math.random() * 12) + 8
    console.log(`🗑️ [DUMP 패턴] 시작! 압력: ${this.crashPatterns.dump.pressure.toFixed(1)}`)
    this.executeDumpPattern()
  }

  startStepDownPattern() {
    this.crashPatterns.stepDown.active = true
    this.crashPatterns.stepDown.currentLevel = 0
    this.crashPatterns.stepDown.levels = [0.995, 0.99, 0.985, 0.98, 0.975] // 단계별 하락률
    console.log(`📊 [STEPDOWN 패턴] 시작! ${this.crashPatterns.stepDown.levels.length}단계`)
    this.executeStepDownPattern()
  }

  startBreakdownPattern() {
    const currentPrice = this.currentMarketData?.stockInfo?.price || 10000
    this.crashPatterns.breakdown.active = true
    this.crashPatterns.breakdown.supportPrice = currentPrice * 0.985
    this.crashPatterns.breakdown.breakdownTarget = currentPrice * 0.96
    this.crashPatterns.breakdown.phase = "distribution"
    console.log(`💥 [BREAKDOWN 패턴] 시작! 지지선: ${this.crashPatterns.breakdown.supportPrice}`)
    this.executeBreakdownPattern()
  }

  startPanicPattern() {
    this.crashPatterns.panic.active = true
    this.crashPatterns.panic.intensity = Math.random() * 1.5 + 0.5
    this.crashPatterns.panic.acceleration = 0.15
    this.crashPatterns.panic.duration = Math.floor(Math.random() * 20000) + 15000 // 15-35초
    this.crashPatterns.panic.elapsed = 0
    console.log(`😱 [PANIC 패턴] 시작! 강도: ${this.crashPatterns.panic.intensity.toFixed(1)}`)
    this.executePanicPattern()
  }

  // 패턴 실행 메서드들
  async executeBurstPattern() {
    if (!this.basicPatterns.burst.active || !this.isRunning) return

    await this.executeBasicSellOrder("burst")
    this.basicPatterns.burst.count++

    if (this.basicPatterns.burst.count >= this.basicPatterns.burst.max) {
      this.basicPatterns.burst.active = false
      console.log(`💥 [BURST 패턴] 완료!`)
      return
    }

    setTimeout(() => this.executeBurstPattern(), Math.random() * 200 + 100) // 100-300ms
  }

  async executeWavePattern() {
    if (!this.basicPatterns.wave.active || !this.isRunning) return

    await this.executeBasicSellOrder("wave")

    // 웨이브 강도 변화
    this.basicPatterns.wave.intensity += this.basicPatterns.wave.direction * 0.2
    if (this.basicPatterns.wave.intensity >= 4 || this.basicPatterns.wave.intensity <= 0.5) {
      this.basicPatterns.wave.direction *= -1
    }

    setTimeout(
      () => {
        if (Math.random() < 0.1) {
          // 10% 확률로 종료
          this.basicPatterns.wave.active = false
          console.log(`🌊 [WAVE 패턴] 완료!`)
        } else {
          this.executeWavePattern()
        }
      },
      Math.random() * 800 + 400,
    ) // 400-1200ms
  }

  async executeSpikePattern() {
    if (!this.basicPatterns.spike.active || !this.isRunning) return

    await this.executeBasicSellOrder("spike")
    this.basicPatterns.spike.remaining--

    if (this.basicPatterns.spike.remaining <= 0) {
      this.basicPatterns.spike.active = false
      console.log(`⚡ [SPIKE 패턴] 완료!`)
      return
    }

    setTimeout(() => this.executeSpikePattern(), Math.random() * 100 + 50) // 50-150ms
  }

  async executeRhythmPattern() {
    if (!this.basicPatterns.rhythm.active || !this.isRunning) return

    await this.executeBasicSellOrder("rhythm")

    const currentInterval = this.basicPatterns.rhythm.pattern[this.basicPatterns.rhythm.beat]
    this.basicPatterns.rhythm.beat = (this.basicPatterns.rhythm.beat + 1) % this.basicPatterns.rhythm.pattern.length

    setTimeout(() => {
      if (Math.random() < 0.08) {
        // 8% 확률로 종료
        this.basicPatterns.rhythm.active = false
        console.log(`🎵 [RHYTHM 패턴] 완료!`)
      } else {
        this.executeRhythmPattern()
      }
    }, currentInterval)
  }

  async executeCrashPatternLoop() {
    if (!this.crashPatterns.crash.active || !this.isRunning) return

    await this.executeCrashSellOrder("crash", {
      targetPrice: this.crashPatterns.crash.targetPrice,
      intensity: 1.5,
    })

    this.crashPatterns.crash.currentStep++

    if (this.crashPatterns.crash.currentStep >= this.crashPatterns.crash.totalSteps) {
      this.crashPatterns.crash.active = false
      console.log(`📉 [CRASH 패턴] 완료!`)
      return
    }

    setTimeout(() => this.executeCrashPatternLoop(), Math.random() * 1000 + 500) // 500-1500ms
  }

  async executeDumpPattern() {
    if (!this.crashPatterns.dump.active || !this.isRunning) return

    await this.executeCrashSellOrder("dump", { intensity: this.crashPatterns.dump.pressure })
    this.crashPatterns.dump.orderCount++

    if (this.crashPatterns.dump.orderCount >= this.crashPatterns.dump.maxOrders) {
      this.crashPatterns.dump.active = false
      console.log(`🗑️ [DUMP 패턴] 완료!`)
      return
    }

    // 압력 증가
    this.crashPatterns.dump.pressure = Math.min(this.crashPatterns.dump.pressure * 1.1, 3)

    setTimeout(() => this.executeDumpPattern(), Math.random() * 600 + 300) // 300-900ms
  }

  async executeStepDownPattern() {
    if (!this.crashPatterns.stepDown.active || !this.isRunning) return

    const currentLevel = this.crashPatterns.stepDown.levels[this.crashPatterns.stepDown.currentLevel]
    await this.executeCrashSellOrder("stepDown", { intensity: currentLevel })

    this.crashPatterns.stepDown.currentLevel++

    if (this.crashPatterns.stepDown.currentLevel >= this.crashPatterns.stepDown.levels.length) {
      this.crashPatterns.stepDown.active = false
      console.log(`📊 [STEPDOWN 패턴] 완료!`)
      return
    }

    setTimeout(() => this.executeStepDownPattern(), Math.random() * 2000 + 1000) // 1-3초
  }

  async executeBreakdownPattern() {
    if (!this.crashPatterns.breakdown.active || !this.isRunning) return

    const intensity = this.crashPatterns.breakdown.phase === "distribution" ? 1.2 : 2.5
    await this.executeCrashSellOrder("breakdown", { intensity })

    if (this.crashPatterns.breakdown.phase === "distribution" && Math.random() < 0.3) {
      this.crashPatterns.breakdown.phase = "breakdown"
      console.log(`💥 [BREAKDOWN 패턴] 붕괴 단계 진입!`)
    }

    setTimeout(
      () => {
        if (Math.random() < 0.15) {
          // 15% 확률로 종료
          this.crashPatterns.breakdown.active = false
          console.log(`💥 [BREAKDOWN 패턴] 완료!`)
        } else {
          this.executeBreakdownPattern()
        }
      },
      Math.random() * 1500 + 800,
    ) // 800-2300ms
  }

  async executePanicPattern() {
    if (!this.crashPatterns.panic.active || !this.isRunning) return

    await this.executeCrashSellOrder("panic", { intensity: this.crashPatterns.panic.intensity })

    this.crashPatterns.panic.elapsed += 1000
    this.crashPatterns.panic.intensity += this.crashPatterns.panic.acceleration

    if (this.crashPatterns.panic.elapsed >= this.crashPatterns.panic.duration) {
      this.crashPatterns.panic.active = false
      console.log(`😱 [PANIC 패턴] 완료!`)
      return
    }

    setTimeout(() => this.executePanicPattern(), Math.random() * 800 + 400) // 400-1200ms
  }

  // 봇 중지
  stop() {
    console.log("🛑 강화된 매도봇 중지...")
    this.isRunning = false
    if (this.socket) {
      this.socket.disconnect()
    }
  }
}

// 봇 실행
const enhancedSellBot = new EnhancedSellBot()
enhancedSellBot.start()

process.on("SIGINT", () => {
  enhancedSellBot.stop()
  process.exit(0)
})

module.exports = EnhancedSellBot
