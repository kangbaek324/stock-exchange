const io = require("socket.io-client")
const axios = require("axios")

class EnhancedBuyBot {
  constructor() {
    this.baseURL = "http://localhost:3000"
    this.socketURL = "http://localhost:3003/stock"
    this.accessToken =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsInVzZXJuYW1lIjoiYWRtaW4zIiwiaWF0IjoxNzUwOTUzMzA3fQ.i17g11m4VTXl8teoS87Hx1BvA_0vUmduN16SquoCcfU"
    this.accountNumber = 1002
    this.stockId = 1
    this.socket = null
    this.currentMarketData = null
    this.isRunning = false

    // 수급 리듬 관리
    this.supplyDemandRhythm = {
      active: false,
      phase: "calm", // calm, building, peak, sustaining, fading
      intensity: 0, // 0-10 강도
      duration: 0, // 현재 단계 지속 시간
      maxDuration: 0, // 최대 지속 시간
      orderFrequency: 1000, // 주문 간격 (ms)
      lastPhaseChange: Date.now(),
    }

    // 기존 패턴들
    this.basicPatterns = {
      burst: { active: false, count: 0, max: 0 },
      wave: { active: false, intensity: 0, direction: 1 },
      spike: { active: false, remaining: 0 },
      rhythm: { active: false, beat: 0, pattern: [] },
    }

    this.surgePatterns = {
      surge: {
        active: false,
        targetPrice: 0,
        currentStep: 0,
        totalSteps: 0,
        stepSize: 0,
        basePrice: 0,
      },
      rally: {
        active: false,
        momentum: 0,
        targetIncrease: 0,
        orderCount: 0,
        maxOrders: 0,
      },
      stepUp: {
        active: false,
        currentLevel: 0,
        levels: [],
        levelProgress: 0,
      },
      breakout: {
        active: false,
        resistancePrice: 0,
        breakoutTarget: 0,
        phase: "accumulation",
      },
      momentum: {
        active: false,
        velocity: 0,
        acceleration: 0,
        duration: 0,
        elapsed: 0,
      },
    }
  }

  // 호가단위 체크 및 조정
  adjustPriceToTickSize(price) {
    if (price >= 2000 && price < 5000) {
      return Math.floor(price / 5) * 5
    } else if (price >= 5000 && price < 20000) {
      return Math.floor(price / 10) * 10
    } else if (price >= 20000 && price < 50000) {
      return Math.floor(price / 50) * 50
    } else if (price >= 50000 && price < 200000) {
      return Math.floor(price / 100) * 100
    } else if (price >= 200000 && price < 500000) {
      return Math.floor(price / 500) * 500
    } else if (price >= 500000) {
      return Math.floor(price / 1000) * 1000
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

  // 수급 리듬 업데이트
  updateSupplyDemandRhythm() {
    const now = Date.now()
    const timeSinceLastChange = now - this.supplyDemandRhythm.lastPhaseChange
    const rhythm = this.supplyDemandRhythm

    // 단계별 전환 로직
    switch (rhythm.phase) {
      case "calm":
        // 잔잔한 상태에서 수급 시작 확률
        if (Math.random() < 0.02) {
          // 3% 확률로 수급 시작
          rhythm.phase = "building"
          rhythm.intensity = 1
          rhythm.duration = 0
          rhythm.maxDuration = Math.floor(Math.random() * 15000) + 10000 // 10-25초
          rhythm.orderFrequency = 800
          rhythm.lastPhaseChange = now
          console.log("🌊 [수급 리듬] 수급 형성 시작!")
        }
        break

      case "building":
        rhythm.intensity = Math.min(rhythm.intensity + 0.2, 5)
        rhythm.orderFrequency = Math.max(500, 1500 - rhythm.intensity * 150)

        if (timeSinceLastChange > rhythm.maxDuration || rhythm.intensity >= 5) {
          rhythm.phase = "peak"
          rhythm.intensity = Math.floor(Math.random() * 3) + 7 // 7-10 강도
          rhythm.duration = 0
          rhythm.maxDuration = Math.floor(Math.random() * 8000) + 5000 // 5-13초
          rhythm.orderFrequency = 200 + Math.random() * 300 // 50-150ms
          rhythm.lastPhaseChange = now
          console.log(`🔥 [수급 리듬] 수급 폭발! 강도: ${rhythm.intensity}`)
        }
        break

      case "peak":
        if (timeSinceLastChange > rhythm.maxDuration) {
          rhythm.phase = "sustaining"
          rhythm.intensity = Math.floor(rhythm.intensity * 0.7) // 강도 감소
          rhythm.duration = 0
          rhythm.maxDuration = Math.floor(Math.random() * 20000) + 15000 // 15-35초
          rhythm.orderFrequency = 800 + Math.random() * 400
          rhythm.lastPhaseChange = now
          console.log(`📈 [수급 리듬] 수급 유지 단계, 강도: ${rhythm.intensity}`)
        }
        break

      case "sustaining":
        // 유지 단계에서 점진적 감소
        if (timeSinceLastChange > 5000) {
          // 5초마다 강도 감소
          rhythm.intensity = Math.max(1, rhythm.intensity - 0.5)
          rhythm.orderFrequency = Math.min(1000, rhythm.orderFrequency + 50)
          rhythm.lastPhaseChange = now
        }

        if (timeSinceLastChange > rhythm.maxDuration || rhythm.intensity <= 1) {
          rhythm.phase = "fading"
          rhythm.duration = 0
          rhythm.maxDuration = Math.floor(Math.random() * 10000) + 5000 // 5-15초
          rhythm.lastPhaseChange = now
          console.log("📉 [수급 리듬] 수급 소멸 시작")
        }
        break

      case "fading":
        rhythm.intensity = Math.max(0, rhythm.intensity - 0.1)
        rhythm.orderFrequency = Math.min(3000, rhythm.orderFrequency + 200)

        if (timeSinceLastChange > rhythm.maxDuration || rhythm.intensity <= 0) {
          rhythm.phase = "calm"
          rhythm.intensity = 0
          rhythm.orderFrequency = 1000 + Math.random() * 2000 // 1-3초
          rhythm.active = false
          rhythm.lastPhaseChange = now
          console.log("😴 [수급 리듬] 수급 종료, 잔잔한 상태로")
        }
        break
    }

    rhythm.active = rhythm.phase !== "calm"
    rhythm.duration = timeSinceLastChange
  }

  // 수급 강도에 따른 주문 수량 결정
  getSupplyDemandQuantity() {
    const intensity = this.supplyDemandRhythm.intensity
    const baseQuantity = Math.floor(Math.random() * 50) + 25 // 기존 100+50 -> 50+25

    switch (this.supplyDemandRhythm.phase) {
      case "building":
        return Math.floor(baseQuantity * (1 + intensity * 0.3))
      case "peak":
        return Math.floor(baseQuantity * (2 + intensity * 0.5)) // 대량 주문
      case "sustaining":
        return Math.floor(baseQuantity * (1.5 + intensity * 0.2))
      case "fading":
        return Math.floor(baseQuantity * (0.8 + intensity * 0.1))
      default:
        return baseQuantity
    }
  }

  // 상승 유도 갭 채우기 (매수봇 전용)
  async checkAndFillGaps() {
    if (!this.currentMarketData) return

    const currentPrice = this.currentMarketData.stockInfo.price
    const sellOrderbook = this.currentMarketData.sellOrderbookData || []
    const buyOrderbook = this.currentMarketData.buyOrderbookData || []

    // 매도 호가 갭 채우기 - 상승 유도 (높은 가격에 매수)
    await this.fillGapsForUptrend(sellOrderbook, currentPrice, "sell")

    // 매수 호가 갭 채우기 - 상승 유도 (높은 가격에 매수)
    await this.fillGapsForUptrend(buyOrderbook, currentPrice, "buy")
  }

  async fillGapsForUptrend(orderbook, currentPrice, type) {
    if (!orderbook || orderbook.length < 2) return

    const sortedOrders = orderbook.map((order) => order.price).sort((a, b) => (type === "sell" ? a - b : b - a))
    const gaps = []

    // 모든 갭 찾기 (기준을 0.3%에서 0.2%로 강화)
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
      console.log(`🔧 [상승유도 갭채우기] ${type} 호가 ${gap.price1} - ${gap.price2} 차이: ${gap.gap.toFixed(2)}%`)
      await this.fillSingleGapForUptrend(gap.price1, gap.price2, currentPrice)
    }
  }

  async fillSingleGapForUptrend(price1, price2, currentPrice) {
    const minPrice = Math.min(price1, price2)
    const maxPrice = Math.max(price1, price2)
    const tickSize = this.getTickSize(minPrice)

    const gapTicks = Math.floor((maxPrice - minPrice) / tickSize) - 1
    if (gapTicks <= 0) return

    // 적은 횟수로 많은 수량으로 갭 채우기 (기존 8개 -> 3-4개)
    const fillCount = Math.min(gapTicks, Math.floor(Math.random() * 2) + 3)

    console.log(`🔧 [상승유도 대량갭채우기] ${fillCount}개 호가를 높은 가격 위주로 채움`)

    for (let i = 1; i <= fillCount; i++) {
      // 상승 유도: 갭의 높은 가격 쪽에 더 많이 배치 (70% 이상 높은 쪽)
      const gapPosition = 0.7 + (i / fillCount) * 0.3 // 0.7 ~ 1.0 범위
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

        console.log(`🔧[상승유도갭채우기-매수 ${i}/${fillCount}] 가격: ${fillPrice}, 수량: ${volume} (상승유도)`)

        axios
          .post(`${this.baseURL}/stocks/orders/buy`, orderData, {
            headers: {
              Cookie: `accessToken=${this.accessToken}`,
              "Content-Type": "application/json",
            },
            timeout: 10000,
          })
          .then((response) => {
            console.log(`✅ 상승유도갭채우기 ${i}/${fillCount} 성공:`, response.data)
          })
          .catch((error) => {
            console.error(`❌ 상승유도갭채우기 ${i}/${fillCount} 실패:`, error.response?.data || error.message)
          })

        if (i < fillCount) {
          await new Promise((resolve) => setTimeout(resolve, 2000 + Math.random() * 1000)) // 2-3초 간격
        }
      } catch (error) {
        console.error("상승유도갭채우기 오류:", error.message)
      }
    }
  }

  // 수급 리듬에 따른 주문 실행
  async executeRhythmBasedOrder() {
    if (!this.currentMarketData) return

    this.updateSupplyDemandRhythm()

    if (!this.supplyDemandRhythm.active) {
      // 잔잔한 상태에서는 기본 주문
      await this.executeBasicBuyOrder("base")
      return
    }

    // 수급 강도에 따른 주문
    const rhythm = this.supplyDemandRhythm
    const currentPrice = this.currentMarketData.stockInfo.price
    const sellOrderbook = this.currentMarketData.sellOrderbookData || []

    const orderData = {
      accountNumber: this.accountNumber,
      stockId: this.stockId,
      price: this.getRhythmBasedPrice(currentPrice, sellOrderbook, rhythm),
      number: this.getSupplyDemandQuantity(),
      orderType: rhythm.intensity > 5 ? "market" : "limit", // 강도 높을 때 시장가
    }

    console.log(
      `🌊[수급리듬-${rhythm.phase.toUpperCase()}] 강도:${rhythm.intensity} 가격:${orderData.price} 수량:${orderData.number}`,
    )

    try {
      const response = await axios.post(`${this.baseURL}/stocks/orders/buy`, orderData, {
        headers: {
          Cookie: `accessToken=${this.accessToken}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      })
      console.log("✅ 수급리듬 주문 성공:", response.data)
    } catch (error) {
      console.error("❌ 수급리듬 주문 실패:", error.response?.data || error.message)
    }
  }

  // 수급 리듬에 따른 가격 결정
  getRhythmBasedPrice(currentPrice, sellOrderbook, rhythm) {
    if (!sellOrderbook || sellOrderbook.length === 0) {
      const priceMultiplier = 1 + rhythm.intensity * 0.001 // 강도에 따라 더 높은 가격
      return this.adjustPriceToTickSize(currentPrice * priceMultiplier)
    }

    const sortedSells = sellOrderbook.map((o) => o.price).sort((a, b) => a - b)
    let targetPrice

    switch (rhythm.phase) {
      case "building":
        // 형성 단계: 조심스럽게 매수
        targetPrice = sortedSells[Math.floor(Math.random() * Math.min(3, sortedSells.length))]
        break
      case "peak":
        // 폭발 단계: 공격적 매수
        targetPrice = sortedSells[0] + this.getTickSize(sortedSells[0]) * (1 + Math.floor(Math.random() * 2))
        break
      case "sustaining":
        // 유지 단계: 안정적 매수
        targetPrice = sortedSells[Math.floor(Math.random() * Math.min(4, sortedSells.length))]
        break
      case "fading":
        // 소멸 단계: 소극적 매수
        targetPrice = sortedSells[Math.floor(Math.random() * Math.min(2, sortedSells.length))] * 0.999
        break
      default:
        targetPrice = currentPrice
    }

    return this.adjustPriceToTickSize(targetPrice)
  }

  // 기존 메서드들 유지...
  getBasicBuyPrice(currentPrice, sellOrderbook, isPattern = false) {
    const maxPercentDiff = 4

    if (!sellOrderbook || sellOrderbook.length === 0) {
      const maxVariation = currentPrice * (maxPercentDiff / 100)
      const variation = (Math.random() * 2 - 1) * maxVariation
      const targetPrice = currentPrice + variation
      return this.adjustPriceToTickSize(Math.max(targetPrice, currentPrice * 0.96))
    }

    const sortedSellPrices = sellOrderbook
      .map((order) => order.price)
      .sort((a, b) => a - b)
      .slice(0, isPattern ? 5 : 3)

    let targetPrice = sortedSellPrices[Math.floor(Math.random() * sortedSellPrices.length)]

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

    return this.adjustPriceToTickSize(targetPrice || currentPrice * 1.01)
  }

  getSurgeBuyPrice(currentPrice, sellOrderbook, targetPrice = null) {
    const maxPercentDiff = 4

    if (!sellOrderbook || sellOrderbook.length === 0) {
      const surgePrice = currentPrice * (1.001 + Math.random() * 0.004)
      return this.adjustPriceToTickSize(surgePrice)
    }

    const sortedSellPrices = sellOrderbook
      .map((order) => order.price)
      .sort((a, b) => a - b)
      .slice(0, 8)

    for (let i = 0; i < sortedSellPrices.length - 1; i++) {
      const price1 = sortedSellPrices[i]
      const price2 = sortedSellPrices[i + 1]
      const gapPercent = ((price2 - price1) / price1) * 100

      if (gapPercent > 0.3) {
        const fillPrice = price1 + (price2 - price1) * (0.3 + Math.random() * 0.4)
        const adjustedPrice = this.adjustPriceToTickSize(fillPrice)

        const percentFromCurrent = Math.abs(((adjustedPrice - currentPrice) / currentPrice) * 100)
        if (percentFromCurrent <= maxPercentDiff) {
          return adjustedPrice
        }
      }
    }

    const lowestSell = sortedSellPrices[0]
    const surgePrice = lowestSell + this.getTickSize(lowestSell) * (1 + Math.floor(Math.random() * 3))

    const percentFromCurrent = Math.abs(((surgePrice - currentPrice) / currentPrice) * 100)
    if (percentFromCurrent > maxPercentDiff) {
      return this.adjustPriceToTickSize(currentPrice * (1 + maxPercentDiff / 100))
    }

    return this.adjustPriceToTickSize(surgePrice)
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

  getSurgeOrderQuantity(patternType, intensity = 1) {
    const random = Math.random()
    let baseQuantity

    if (random < 0.1) {
      baseQuantity = Math.floor(Math.random() * 150) + 100 // 기존 300+200 -> 150+100
    } else if (random < 0.3) {
      baseQuantity = Math.floor(Math.random() * 75) + 50 // 기존 150+100 -> 75+50
    } else {
      baseQuantity = Math.floor(Math.random() * 40) + 10 // 기존 80+20 -> 40+10
    }

    switch (patternType) {
      case "surge":
        return Math.floor(baseQuantity * intensity * 1.3)
      case "rally":
        return Math.floor(baseQuantity * intensity * 1.8)
      case "stepUp":
        return Math.floor(baseQuantity * intensity * 1.1)
      case "breakout":
        return Math.floor(baseQuantity * intensity * 2.2)
      case "momentum":
        return Math.floor(baseQuantity * intensity * 1.5)
      default:
        return baseQuantity
    }
  }

  getOrderType(isPattern = false) {
    const marketRatio = isPattern ? 0.7 : 0.5
    return Math.random() < marketRatio ? "market" : "limit"
  }

  async executeBasicBuyOrder(orderType = "base") {
    if (!this.currentMarketData) return

    try {
      const currentPrice = this.currentMarketData.stockInfo.price
      const sellOrderbook = this.currentMarketData.sellOrderbookData || []
      const isPattern = orderType !== "base"

      const orderData = {
        accountNumber: this.accountNumber,
        stockId: this.stockId,
        price: this.getBasicBuyPrice(currentPrice, sellOrderbook, isPattern),
        number: this.getBasicOrderQuantity(isPattern, orderType),
        orderType: this.getOrderType(isPattern),
      }

      const prefix = orderType === "base" ? "[BASE]" : `[${orderType.toUpperCase()}]`
      console.log(
        `🚀[기본매수${prefix}] 가격: ${orderData.price}, 수량: ${orderData.number}, 타입: ${orderData.orderType}`,
      )

      axios
        .post(`${this.baseURL}/stocks/orders/buy`, orderData, {
          headers: {
            Cookie: `accessToken=${this.accessToken}`,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        })
        .then((response) => {
          console.log("✅ 기본매수 성공:", response.data)
        })
        .catch((error) => {
          console.error("❌ 기본매수 실패:", error.response?.data || error.message)
        })
    } catch (error) {
      console.error("기본매수 주문 오류:", error.message)
    }
  }

  async executeSurgeBuyOrder(orderType = "base", patternData = {}) {
    if (!this.currentMarketData) return

    try {
      const currentPrice = this.currentMarketData.stockInfo.price
      const sellOrderbook = this.currentMarketData.sellOrderbookData || []
      const isPattern = orderType !== "base"

      const orderData = {
        accountNumber: this.accountNumber,
        stockId: this.stockId,
        price: this.getSurgeBuyPrice(currentPrice, sellOrderbook, patternData.targetPrice),
        number: this.getSurgeOrderQuantity(orderType, patternData.intensity || 1),
        orderType: isPattern ? "limit" : this.getOrderType(isPattern),
      }

      const prefix = orderType === "base" ? "[BASE]" : `[${orderType.toUpperCase()}]`
      console.log(
        `📈[상승매수${prefix}] 가격: ${orderData.price}, 수량: ${orderData.number}, 타입: ${orderData.orderType}`,
      )

      axios
        .post(`${this.baseURL}/stocks/orders/buy`, orderData, {
          headers: {
            Cookie: `accessToken=${this.accessToken}`,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        })
        .then((response) => {
          console.log("✅ 상승매수 성공:", response.data)
        })
        .catch((error) => {
          console.error("❌ 상승매수 실패:", error.response?.data || error.message)
        })
    } catch (error) {
      console.error("상승매수 주문 오류:", error.message)
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
      console.log("🔌 강화된 매수봇 웹소켓 연결됨")
      this.socket.emit("joinStockRoom", 1)
    })

    this.socket.on("stockUpdated", (data) => {
      this.currentMarketData = data
      console.log(`📊 [강화된 매수봇-시장데이터] 현재가: ${data.stockInfo.price}`)
    })

    this.socket.on("disconnect", () => {
      console.log("🔌 강화된 매수봇 웹소켓 연결 해제됨")
    })
  }

  // 기본 주문 간격 (수급 리듬 반영)
  getBaseOrderInterval() {
    if (this.supplyDemandRhythm.active) {
      return this.supplyDemandRhythm.orderFrequency
    }
    return Math.random() * 2000 + 1000
  }

  // 패턴별 주문 간격
  getPatternInterval(patternType) {
    switch (patternType) {
      case "burst":
        return Math.random() * 100 + 50
      case "wave":
        const waveSpeed = 300 - this.basicPatterns.wave.intensity * 200
        return Math.random() * 200 + waveSpeed
      case "spike":
        return Math.random() * 50 + 25
      case "rhythm":
        return this.basicPatterns.rhythm.pattern[this.basicPatterns.rhythm.beat] || 200
      default:
        return 1000
    }
  }

  // 기존 패턴 메서드들 유지 (생략)...

  // 갭 채우기 스케줄링 (더 자주)
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
            // 25% - 상승 패턴들 (기존 10%에서 증가)
            await this.executeRandomSurgePattern()
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

  // 상승 패턴 스케줄링
  scheduleSurgePatterns() {
    if (!this.isRunning) return

    setTimeout(
      async () => {
        if (this.isRunning) {
          // Surge 패턴 (4% - 기존 2%에서 증가)
          if (Math.random() < 0.04 && !this.surgePatterns.surge.active) {
            this.startSurgePattern()
          }

          // Rally 패턴 (4% - 기존 2%에서 증가)
          if (Math.random() < 0.04 && !this.surgePatterns.rally.active) {
            this.startRallyPattern()
          }

          // StepUp 패턴 (4% - 기존 2%에서 증가)
          if (Math.random() < 0.04 && !this.surgePatterns.stepUp.active) {
            this.startStepUpPattern()
          }

          // Breakout 패턴 (3% - 기존 1.5%에서 증가)
          if (Math.random() < 0.03 && !this.surgePatterns.breakout.active) {
            this.startBreakoutPattern()
          }

          // Momentum 패턴 (5% - 기존 2.5%에서 증가)
          if (Math.random() < 0.05 && !this.surgePatterns.momentum.active) {
            this.startMomentumPattern()
          }
        }
        this.scheduleSurgePatterns()
      },
      Math.random() * 4000 + 3000,
    ) // 3-7초 간격
  }

  // 랜덤 기본 패턴 실행
  async executeRandomBasicPattern() {
    const patterns = ["burst", "wave", "spike", "rhythm"]
    const randomPattern = patterns[Math.floor(Math.random() * patterns.length)]

    console.log(`🎯 [패턴매니저] ${randomPattern} 패턴 실행`)
    await this.executeBasicBuyOrder(randomPattern)
  }

  // 랜덤 상승 패턴 실행
  async executeRandomSurgePattern() {
    const patterns = ["surge", "rally", "stepUp", "breakout", "momentum"]
    const randomPattern = patterns[Math.floor(Math.random() * patterns.length)]

    console.log(`🚀 [패턴매니저] ${randomPattern} 패턴 실행`)
    await this.executeSurgeBuyOrder(randomPattern, { intensity: Math.random() * 2 + 1 })
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
    this.basicPatterns.rhythm.pattern = [200, 400, 300, 600, 250, 500] // 리듬 패턴
    console.log(`🎵 [RHYTHM 패턴] 시작! 리듬 패턴 실행`)
    this.executeRhythmPattern()
  }

  // 상승 패턴 시작 메서드들
  startSurgePattern() {
    const currentPrice = this.currentMarketData?.stockInfo?.price || 10000
    this.surgePatterns.surge.active = true
    this.surgePatterns.surge.basePrice = currentPrice
    this.surgePatterns.surge.targetPrice = currentPrice * (1.02 + Math.random() * 0.03) // 2-5% 상승
    this.surgePatterns.surge.currentStep = 0
    this.surgePatterns.surge.totalSteps = Math.floor(Math.random() * 8) + 5
    console.log(`📈 [SURGE 패턴] 시작! 목표: ${this.surgePatterns.surge.targetPrice}`)
    this.executeSurgePatternLoop()
  }

  startRallyPattern() {
    this.surgePatterns.rally.active = true
    this.surgePatterns.rally.momentum = Math.random() * 2 + 1
    this.surgePatterns.rally.orderCount = 0
    this.surgePatterns.rally.maxOrders = Math.floor(Math.random() * 12) + 8
    console.log(`🚀 [RALLY 패턴] 시작! 모멘텀: ${this.surgePatterns.rally.momentum.toFixed(1)}`)
    this.executeRallyPattern()
  }

  startStepUpPattern() {
    this.surgePatterns.stepUp.active = true
    this.surgePatterns.stepUp.currentLevel = 0
    this.surgePatterns.stepUp.levels = [1.005, 1.01, 1.015, 1.02, 1.025] // 단계별 상승률
    console.log(`📊 [STEPUP 패턴] 시작! ${this.surgePatterns.stepUp.levels.length}단계`)
    this.executeStepUpPattern()
  }

  startBreakoutPattern() {
    const currentPrice = this.currentMarketData?.stockInfo?.price || 10000
    this.surgePatterns.breakout.active = true
    this.surgePatterns.breakout.resistancePrice = currentPrice * 1.015
    this.surgePatterns.breakout.breakoutTarget = currentPrice * 1.04
    this.surgePatterns.breakout.phase = "accumulation"
    console.log(`💥 [BREAKOUT 패턴] 시작! 저항선: ${this.surgePatterns.breakout.resistancePrice}`)
    this.executeBreakoutPattern()
  }

  startMomentumPattern() {
    this.surgePatterns.momentum.active = true
    this.surgePatterns.momentum.velocity = Math.random() * 1.5 + 0.5
    this.surgePatterns.momentum.acceleration = 0.1
    this.surgePatterns.momentum.duration = Math.floor(Math.random() * 20000) + 15000 // 15-35초
    this.surgePatterns.momentum.elapsed = 0
    console.log(`⚡ [MOMENTUM 패턴] 시작! 속도: ${this.surgePatterns.momentum.velocity.toFixed(1)}`)
    this.executeMomentumPattern()
  }

  // 패턴 실행 메서드들
  async executeBurstPattern() {
    if (!this.basicPatterns.burst.active || !this.isRunning) return

    await this.executeBasicBuyOrder("burst")
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

    await this.executeBasicBuyOrder("wave")

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

    await this.executeBasicBuyOrder("spike")
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

    await this.executeBasicBuyOrder("rhythm")

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

  async executeSurgePatternLoop() {
    if (!this.surgePatterns.surge.active || !this.isRunning) return

    await this.executeSurgeBuyOrder("surge", {
      targetPrice: this.surgePatterns.surge.targetPrice,
      intensity: 1.5,
    })

    this.surgePatterns.surge.currentStep++

    if (this.surgePatterns.surge.currentStep >= this.surgePatterns.surge.totalSteps) {
      this.surgePatterns.surge.active = false
      console.log(`📈 [SURGE 패턴] 완료!`)
      return
    }

    setTimeout(() => this.executeSurgePatternLoop(), Math.random() * 1000 + 500) // 500-1500ms
  }

  async executeRallyPattern() {
    if (!this.surgePatterns.rally.active || !this.isRunning) return

    await this.executeSurgeBuyOrder("rally", { intensity: this.surgePatterns.rally.momentum })
    this.surgePatterns.rally.orderCount++

    if (this.surgePatterns.rally.orderCount >= this.surgePatterns.rally.maxOrders) {
      this.surgePatterns.rally.active = false
      console.log(`🚀 [RALLY 패턴] 완료!`)
      return
    }

    // 모멘텀 증가
    this.surgePatterns.rally.momentum = Math.min(this.surgePatterns.rally.momentum * 1.1, 3)

    setTimeout(() => this.executeRallyPattern(), Math.random() * 600 + 300) // 300-900ms
  }

  async executeStepUpPattern() {
    if (!this.surgePatterns.stepUp.active || !this.isRunning) return

    const currentLevel = this.surgePatterns.stepUp.levels[this.surgePatterns.stepUp.currentLevel]
    await this.executeSurgeBuyOrder("stepUp", { intensity: currentLevel })

    this.surgePatterns.stepUp.currentLevel++

    if (this.surgePatterns.stepUp.currentLevel >= this.surgePatterns.stepUp.levels.length) {
      this.surgePatterns.stepUp.active = false
      console.log(`📊 [STEPUP 패턴] 완료!`)
      return
    }

    setTimeout(() => this.executeStepUpPattern(), Math.random() * 2000 + 1000) // 1-3초
  }

  async executeBreakoutPattern() {
    if (!this.surgePatterns.breakout.active || !this.isRunning) return

    const intensity = this.surgePatterns.breakout.phase === "accumulation" ? 1.2 : 2.5
    await this.executeSurgeBuyOrder("breakout", { intensity })

    if (this.surgePatterns.breakout.phase === "accumulation" && Math.random() < 0.3) {
      this.surgePatterns.breakout.phase = "breakout"
      console.log(`💥 [BREAKOUT 패턴] 돌파 단계 진입!`)
    }

    setTimeout(
      () => {
        if (Math.random() < 0.15) {
          // 15% 확률로 종료
          this.surgePatterns.breakout.active = false
          console.log(`💥 [BREAKOUT 패턴] 완료!`)
        } else {
          this.executeBreakoutPattern()
        }
      },
      Math.random() * 1500 + 800,
    ) // 800-2300ms
  }

  async executeMomentumPattern() {
    if (!this.surgePatterns.momentum.active || !this.isRunning) return

    await this.executeSurgeBuyOrder("momentum", { intensity: this.surgePatterns.momentum.velocity })

    this.surgePatterns.momentum.elapsed += 1000
    this.surgePatterns.momentum.velocity += this.surgePatterns.momentum.acceleration

    if (this.surgePatterns.momentum.elapsed >= this.surgePatterns.momentum.duration) {
      this.surgePatterns.momentum.active = false
      console.log(`⚡ [MOMENTUM 패턴] 완료!`)
      return
    }

    setTimeout(() => this.executeMomentumPattern(), Math.random() * 800 + 400) // 400-1200ms
  }

  // 봇 시작
  start() {
    console.log("🚀📈 강화된 매수봇 시작...")
    this.isRunning = true
    this.connectWebSocket()

    setTimeout(() => {
      // 수급 리듬 기반 주문 스케줄링
      this.scheduleRhythmBasedOrder()

      // 강화된 갭 채우기 스케줄링
      this.scheduleGapFilling()

      // 기본 패턴들 활성화 (15% 비율)
      this.scheduleBasicPatterns()

      // 상승 패턴들 활성화 (10% 비율)
      this.scheduleSurgePatterns()

      // 패턴 관리자 시작
      this.schedulePatternManager()
    }, 1000)
  }

  // 봇 중지
  stop() {
    console.log("🛑 강화된 매수봇 중지...")
    this.isRunning = false
    if (this.socket) {
      this.socket.disconnect()
    }
  }
}

// 봇 실행
const enhancedBuyBot = new EnhancedBuyBot()
enhancedBuyBot.start()

process.on("SIGINT", () => {
  enhancedBuyBot.stop()
  process.exit(0)
})

module.exports = EnhancedBuyBot
