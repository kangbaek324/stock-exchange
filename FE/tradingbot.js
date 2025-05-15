import { io } from "socket.io-client"
import fetch from "node-fetch"

// 설정
const config = {
  wsUrl: "http://localhost:3003/stock",
  apiBaseUrl: "http://localhost:3002", // API 기본 URL
  apiEndpoints: {
    buy: "/stock/user/orders/buy", // 매수 주문 엔드포인트
    sell: "/stock/user/orders/sell", // 매도 주문 엔드포인트
  },
  stockId: 1,
  accounts: {
    buy: {
      accountNumber: 1002,
      jwtToken:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsInVzZXJuYW1lIjoiYWRtaW4zIiwiaWF0IjoxNzQ3MzE0NDY1fQ.Tq0XFy1HJY-Ict4BLVUGgMHizoZn45JmQ4f5PKl1WuY",
    },
    sell: {
      accountNumber: 1001,
      jwtToken:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsInVzZXJuYW1lIjoiYWRtaW4yIiwiaWF0IjoxNzQ3MzE3OTMxfQ.4W2LpPcUwYGaI5IxQ40yU6P_iGVc3yd6mxJgNA1seoA",
    },
  },
  orderTypes: ["limit", "market"],
  maxOrderInterval: 150, // 최대 0.15초 간격으로 주문 실행
  minOrderInterval: 200, // 최소 0.2초 간격으로 주문 실행
  minQuantity: 1,
  maxQuantity: 100,
  // 호가 간격 감지 설정
  gapDetection: {
    enabled: true,
    // 호가 간격이 이 비율보다 크면 대량 주문으로 간주 (예: 0.05 = 5%)
    thresholdPercent: 5,
    // 매수/매도 호가 간격이 이 비율보다 크면 대량 주문으로 간주 (예: 0.2 = 20%)
    bidAskGapThresholdPercent: 20,
    // 대량 주문 감지 시 채울 주문 수량 범위
    fillQuantityMin: 50,
    fillQuantityMax: 200,
    // 간격 메우기 방향 설정 (buy: 매수만, sell: 매도만, both: 양쪽 다)
    fillDirection: "both",
    // 중간 가격 주문 방향 (buy: 매수만, sell: 매도만, random: 랜덤)
    midPriceFillDirection: "random",
    // 갭 메우기 단계 수
    gapFillSteps: 5,
    // 시장가 주문 사용 여부
    useMarketOrders: true,
  },
  // 새로운 설정: 시장 변동성 패턴
  volatilityPatterns: {
    enabled: true,
    // 패턴 발생 확률 (0-1)
    occurrenceProbability: 0.15,
    // 패턴 지속 시간 (밀리초)
    minDuration: 10000,  // 10초
    maxDuration: 60000,  // 60초
    // 가격 변동 패턴
    patterns: [
      {
        name: "급등",
        probability: 0.2,
        priceChangePercent: { min: 3, max: 8 },
        orderSizeMultiplier: { min: 2, max: 5 },
        direction: "up"
      },
      {
        name: "급락",
        probability: 0.2,
        priceChangePercent: { min: 3, max: 8 },
        orderSizeMultiplier: { min: 2, max: 5 },
        direction: "down"
      },
      {
        name: "횡보 후 급등",
        probability: 0.15,
        priceChangePercent: { min: 2, max: 5 },
        orderSizeMultiplier: { min: 1.5, max: 3 },
        direction: "sideways-then-up"
      },
      {
        name: "횡보 후 급락",
        probability: 0.15,
        priceChangePercent: { min: 2, max: 5 },
        orderSizeMultiplier: { min: 1.5, max: 3 },
        direction: "sideways-then-down"
      },
      {
        name: "고점 돌파",
        probability: 0.1,
        priceChangePercent: { min: 4, max: 10 },
        orderSizeMultiplier: { min: 3, max: 6 },
        direction: "breakout"
      },
      {
        name: "지지선 붕괴",
        probability: 0.1,
        priceChangePercent: { min: 4, max: 10 },
        orderSizeMultiplier: { min: 3, max: 6 },
        direction: "breakdown"
      },
      {
        name: "변동성 확대",
        probability: 0.1,
        priceChangePercent: { min: 2, max: 6 },
        orderSizeMultiplier: { min: 2, max: 4 },
        direction: "volatile"
      }
    ],
    // 대량 주문 이벤트
    largeOrderEvents: {
      enabled: true,
      probability: 0.3,  // 패턴 실행 중 대량 주문 발생 확률
      sizeMultiplier: { min: 5, max: 15 }
    }
  },
  // 새로운 설정: 가격 조작 패턴
  manipulationPatterns: {
    enabled: true,
    // 패턴 발생 확률 (0-1)
    occurrenceProbability: 0.1,
    // 패턴 종류
    patterns: [
      {
        name: "가격 고정",
        probability: 0.3,
        duration: { min: 5000, max: 15000 },  // 5-15초
        description: "특정 가격대에 대량 매수/매도 주문을 넣어 가격을 고정"
      },
      {
        name: "스포핑",
        probability: 0.3,
        duration: { min: 3000, max: 10000 },  // 3-10초
        description: "대량 주문을 넣었다가 체결 직전에 취소하는 패턴"
      },
      {
        name: "펌핑",
        probability: 0.2,
        duration: { min: 8000, max: 20000 },  // 8-20초
        description: "단계적으로 가격을 끌어올린 후 매도하는 패턴"
      },
      {
        name: "덤핑",
        probability: 0.2,
        duration: { min: 8000, max: 20000 },  // 8-20초
        description: "단계적으로 가격을 끌어내린 후 매수하는 패턴"
      }
    ]
  }
}

// 이전 호가창 데이터를 저장할 변수
let previousOrderBookData = null
// 현재 실행 중인 패턴 정보
let activePattern = null
// 패턴 시작 시간
let patternStartTime = null
// 패턴 종료 예정 시간
let patternEndTime = null
// 패턴 단계 (다단계 패턴용)
let patternStage = 0
// 패턴 목표 가격
let patternTargetPrice = null
// 패턴 기준 가격 (시작 가격)
let patternBasePrice = null
// 가격 이력 저장 (최근 N개)
const priceHistory = []
// 가격 이력 최대 크기
const PRICE_HISTORY_MAX_SIZE = 50

// 현재 가격에 따른 호가 단위 계산
function getTickSize(currentPrice) {
  if (currentPrice >= 200000) {
    return 1000
  } else if (currentPrice >= 50000) {
    return 100
  } else if (currentPrice >= 20000) {
    return 50
  } else if (currentPrice >= 5000) {
    return 10
  } else if (currentPrice >= 2000) {
    return 5
  } else {
    return 1
  }
}

// 최소값과 최대값 사이의 랜덤 정수 생성 (최소값과 최대값 포함)
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// 최소값과 최대값 사이의 랜덤 실수 생성
function getRandomFloat(min, max) {
  return Math.random() * (max - min) + min
}

// 호가창 정보를 기반으로 매수 가격 결정
function determineBuyPrice(orderBook, currentPrice) {
  const tickSize = getTickSize(currentPrice)

  // 매수 주문이 있으면, 가장 높은 매수 호가보다 약간 높게 주문
  if (orderBook.buyorderbookData && orderBook.buyorderbookData.length > 0) {
    const highestBuyPrice = orderBook.buyorderbookData[0].price
    return highestBuyPrice + tickSize
  }

  // 매도 주문이 있으면, 가장 낮은 매도 호가보다 약간 낮게 주문
  if (orderBook.sellorderbookData && orderBook.sellorderbookData.length > 0) {
    const lowestSellPrice = orderBook.sellorderbookData[0].price
    return lowestSellPrice - tickSize
  }

  // 호가창에 주문이 없으면 현재 가격 사용
  return currentPrice
}

// 호가창 정보를 기반으로 매도 가격 결정
function determineSellPrice(orderBook, currentPrice) {
  const tickSize = getTickSize(currentPrice)

  // 매도 주문이 있으면, 가장 낮은 매도 호가보다 약간 낮게 주문
  if (orderBook.sellorderbookData && orderBook.sellorderbookData.length > 0) {
    const lowestSellPrice = orderBook.sellorderbookData[0].price
    return lowestSellPrice - tickSize
  }

  // 매수 주문이 있으면, 가장 높은 매수 호가보다 약간 높게 주문
  if (orderBook.buyorderbookData && orderBook.buyorderbookData.length > 0) {
    const highestBuyPrice = orderBook.buyorderbookData[0].price
    return highestBuyPrice + tickSize
  }

  // 호가창에 주문이 없으면 현재 가격 사용
  return currentPrice
}

// 주문 실행
async function placeOrder(orderType, price, quantity, jwtToken) {
  const isMarketOrder = orderType === "market"
  const isBuyOrder = price > 0 // 양수 가격은 매수, 음수 가격은 매도로 가정

  const orderData = {
    accountNumber: isBuyOrder ? config.accounts.buy.accountNumber : config.accounts.sell.accountNumber,
    stockId: config.stockId,
    price: Math.abs(price), // 가격이 양수인지 확인
    number: quantity,
    orderType: isMarketOrder ? "market" : "limit",
  }

  // 매수/매도에 따라 다른 엔드포인트 사용
  const endpoint = isBuyOrder ? config.apiEndpoints.buy : config.apiEndpoints.sell

  console.log(`${isBuyOrder ? "매수" : "매도"} 주문 실행:`, orderData)

  try {
    const response = await fetch(`${config.apiBaseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${isBuyOrder ? config.accounts.buy.jwtToken : config.accounts.sell.jwtToken}`,
      },
      body: JSON.stringify(orderData),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`주문 실패: ${response.status} ${errorText}`)
    }

    const result = await response.json()
    console.log("주문 성공:", result)
    return result
  } catch (error) {
    console.error("주문 오류:", error.message)
    return null
  }
}

// 대량 주문 감지 및 처리 함수
function detectAndHandleLargeOrderGaps(currentData, previousData) {
  if (!config.gapDetection.enabled || !currentData || !previousData) {
    return false
  }

  const currentPrice = currentData.stockInfo.price

  // 매수/매도 호가 확인
  const hasBuyOrders = currentData.buyorderbookData && currentData.buyorderbookData.length > 0
  const hasSellOrders = currentData.sellorderbookData && currentData.sellorderbookData.length > 0

  // 매수/매도 호가가 모두 있는 경우에만 간격 확인
  if (hasBuyOrders && hasSellOrders) {
    const highestBuyPrice = currentData.buyorderbookData[0].price
    const lowestSellPrice = currentData.sellorderbookData[0].price

    // 매수-매도 호가 간격 계산 (%)
    const bidAskGapPercent = ((lowestSellPrice - highestBuyPrice) / currentPrice) * 100

    // 매수-매도 간격이 임계값보다 큰 경우
    if (bidAskGapPercent > config.gapDetection.bidAskGapThresholdPercent) {
      console.log(
        `대량 주문 감지: 매수-매도 간격 ${bidAskGapPercent.toFixed(2)}% (임계값: ${config.gapDetection.bidAskGapThresholdPercent}%)`,
      )

      // 간격을 메우는 주문 실행
      fillOrderGap(highestBuyPrice, lowestSellPrice, currentPrice)
      return true
    }
  }

  // 이전 데이터와 비교하여 급격한 변화 감지
  if (
    previousData.buyorderbookData &&
    previousData.buyorderbookData.length > 0 &&
    currentData.buyorderbookData &&
    currentData.buyorderbookData.length > 0
  ) {
    const prevHighestBuyPrice = previousData.buyorderbookData[0].price
    const currentHighestBuyPrice = currentData.buyorderbookData[0].price

    // 매수 호가 변화율 계산 (%)
    const buyPriceChangePercent = ((currentHighestBuyPrice - prevHighestBuyPrice) / prevHighestBuyPrice) * 100

    // 매수 호가가 급격히 하락한 경우 (대량 매도 주문 발생)
    if (buyPriceChangePercent < -config.gapDetection.thresholdPercent) {
      console.log(
        `대량 매도 감지: 매수 호가 ${Math.abs(buyPriceChangePercent).toFixed(2)}% 하락 (임계값: ${config.gapDetection.thresholdPercent}%)`,
      )

      // 매수 1호가(현재 최고 매수 호가)를 기준으로 갭 메우기
      fillGapFromBuyOrder(currentData, previousData)
      return true
    }
  }

  if (
    previousData.sellorderbookData &&
    previousData.sellorderbookData.length > 0 &&
    currentData.sellorderbookData &&
    currentData.sellorderbookData.length > 0
  ) {
    const prevLowestSellPrice = previousData.sellorderbookData[0].price
    const currentLowestSellPrice = currentData.sellorderbookData[0].price

    // 매도 호가 변화율 계산 (%)
    const sellPriceChangePercent = ((currentLowestSellPrice - prevLowestSellPrice) / prevLowestSellPrice) * 100

    // 매도 호가가 급격히 상승한 경우 (대량 매수 주문 발생)
    if (sellPriceChangePercent > config.gapDetection.thresholdPercent) {
      console.log(
        `대량 매수 감지: 매도 호가 ${sellPriceChangePercent.toFixed(2)}% 상승 (임계값: ${config.gapDetection.thresholdPercent}%)`,
      )

      // 매도 1호가(현재 최저 매도 호가)를 기준으로 갭 메우기
      fillGapFromSellOrder(currentData, previousData)
      return true
    }
  }

  return false
}

// 매수-매도 간격을 메우는 주문 실행
async function fillOrderGap(buyPrice, sellPrice, currentPrice) {
  const tickSize = getTickSize(currentPrice)
  const midPrice = (buyPrice + sellPrice) / 2

  // 설정된 방향에 따라 주문 실행
  const fillDirection = config.gapDetection.fillDirection

  // 매수 주문 (매도 호가 근처)
  if (fillDirection === "buy" || fillDirection === "both") {
    const buyOrderPrice = sellPrice - tickSize
    const buyQuantity = getRandomInt(config.gapDetection.fillQuantityMin, config.gapDetection.fillQuantityMax)

    console.log(`호가 간격 매수 주문: ${buyOrderPrice}원 x ${buyQuantity}주`)
    await placeOrder("limit", buyOrderPrice, buyQuantity, config.accounts.buy.jwtToken)
  }

  // 매도 주문 (매수 호가 근처)
  if (fillDirection === "sell" || fillDirection === "both") {
    const sellOrderPrice = buyPrice + tickSize
    const sellQuantity = getRandomInt(config.gapDetection.fillQuantityMin, config.gapDetection.fillQuantityMax)

    console.log(`호가 간격 매도 주문: ${sellOrderPrice}원 x ${sellQuantity}주`)
    await placeOrder("limit", -sellOrderPrice, sellQuantity, config.accounts.sell.jwtToken)
  }

  // 중간 가격에 추가 주문 (간격이 큰 경우)
  if ((sellPrice - buyPrice) / tickSize > 10) {
    const midOrderPrice = Math.round(midPrice / tickSize) * tickSize
    const midQuantity = getRandomInt(config.gapDetection.fillQuantityMin, config.gapDetection.fillQuantityMax)

    console.log(`중간 가격 주문 추가: ${midOrderPrice}원 x ${midQuantity}주`)

    // 중간 가격 주문 방향 설정에 따라 처리
    const midDirection = config.gapDetection.midPriceFillDirection

    if (midDirection === "buy") {
      // 매수로만 주문
      await placeOrder("limit", midOrderPrice, midQuantity, config.accounts.buy.jwtToken)
    } else if (midDirection === "sell") {
      // 매도로만 주문
      await placeOrder("limit", -midOrderPrice, midQuantity, config.accounts.sell.jwtToken)
    } else {
      // 랜덤 (기본값)
      if (Math.random() < 0.5) {
        await placeOrder("limit", midOrderPrice, midQuantity, config.accounts.buy.jwtToken)
      } else {
        await placeOrder("limit", -midOrderPrice, midQuantity, config.accounts.sell.jwtToken)
      }
    }
  }
}

// 대량 매도 주문 발생 시 매수 1호가를 기준으로 갭 메우기
async function fillGapFromBuyOrder(currentData, previousData) {
  // 현재 매수 1호가 (최고 매수 호가)
  const currentBuyPrice = currentData.buyorderbookData[0].price
  // 이전 매수 1호가
  const prevBuyPrice = previousData.buyorderbookData[0].price
  // 현재 매도 1호가 (최저 매도 호가)
  const currentSellPrice = currentData.sellorderbookData[0].price

  const currentPrice = currentData.stockInfo.price
  const tickSize = getTickSize(currentPrice)

  console.log(`대량 매도 주문 갭 메우기: 매수 1호가 ${currentBuyPrice}원, 매도 1호가 ${currentSellPrice}원`)

  // 매수 1호가와 매도 1호가 사이의 간격 계산
  const gapSize = currentSellPrice - currentBuyPrice
  const numTicks = Math.floor(gapSize / tickSize)

  // 갭이 너무 작으면 처리하지 않음
  if (numTicks <= 1) {
    console.log(`갭이 너무 작아 처리하지 않음: ${gapSize}원 (${numTicks} 틱)`)
    return
  }

  // 매수 주문으로 갭 메우기 (매수 1호가 기준으로 상승하는 방향)
  const steps = Math.min(config.gapDetection.gapFillSteps, numTicks - 1)
  const stepSize = gapSize / (steps + 1)

  console.log(`매수 1호가 기준 갭 메우기: ${currentBuyPrice}원 → ${currentSellPrice}원 (${steps}단계)`)

  for (let i = 1; i <= steps; i++) {
    const price = currentBuyPrice + stepSize * i
    const roundedPrice = Math.round(price / tickSize) * tickSize
    const quantity = getRandomInt(config.gapDetection.fillQuantityMin, config.gapDetection.fillQuantityMax)

    console.log(`매수 주문 ${i}/${steps}: ${roundedPrice}원 x ${quantity}주`)
    await placeOrder("limit", roundedPrice, quantity, config.accounts.buy.jwtToken)

    // 약간의 지연 추가
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  // 시장가 매수 주문 추가 (즉시 체결)
  if (config.gapDetection.useMarketOrders) {
    const marketQuantity = getRandomInt(
      config.gapDetection.fillQuantityMin / 2,
      config.gapDetection.fillQuantityMax / 2,
    )
    console.log(`시장가 매수 추가: ${marketQuantity}주`)
    await placeOrder("market", currentPrice, marketQuantity, config.accounts.buy.jwtToken)
  }
}

// 대량 매수 주문 발생 시 매도 1호가를 기준으로 갭 메우기
async function fillGapFromSellOrder(currentData, previousData) {
  // 현재 매도 1호가 (최저 매도 호가)
  const currentSellPrice = currentData.sellorderbookData[0].price
  // 이전 매도 1호가
  const prevSellPrice = previousData.sellorderbookData[0].price
  // 현재 매수 1호가 (최고 매수 호가)
  const currentBuyPrice = currentData.buyorderbookData[0].price

  const currentPrice = currentData.stockInfo.price
  const tickSize = getTickSize(currentPrice)

  console.log(`대량 매수 주문 갭 메우기: 매수 1호가 ${currentBuyPrice}원, 매도 1호가 ${currentSellPrice}원`)

  // 매수 1호가와 매도 1호가 사이의 간격 계산
  const gapSize = currentSellPrice - currentBuyPrice
  const numTicks = Math.floor(gapSize / tickSize)

  // 갭이 너무 작으면 처리하지 않음
  if (numTicks <= 1) {
    console.log(`갭이 너무 작아 처리하지 않음: ${gapSize}원 (${numTicks} 틱)`)
    return
  }

  // 매도 주문으로 갭 메우기 (매도 1호가 기준으로 하락하는 방향)
  const steps = Math.min(config.gapDetection.gapFillSteps, numTicks - 1)
  const stepSize = gapSize / (steps + 1)

  console.log(`매도 1호가 기준 갭 메우기: ${currentSellPrice}원 → ${currentBuyPrice}원 (${steps}단계)`)

  for (let i = 1; i <= steps; i++) {
    const price = currentSellPrice - stepSize * i
    const roundedPrice = Math.round(price / tickSize) * tickSize
    const quantity = getRandomInt(config.gapDetection.fillQuantityMin, config.gapDetection.fillQuantityMax)

    console.log(`매도 주문 ${i}/${steps}: ${roundedPrice}원 x ${quantity}주`)
    await placeOrder("limit", -roundedPrice, quantity, config.accounts.sell.jwtToken)

    // 약간의 지연 추가
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  // 시장가 매도 주문 추가 (즉시 체결)
  if (config.gapDetection.useMarketOrders) {
    const marketQuantity = getRandomInt(
      config.gapDetection.fillQuantityMin / 2,
      config.gapDetection.fillQuantityMax / 2,
    )
    console.log(`시장가 매도 추가: ${marketQuantity}주`)
    await placeOrder("market", -currentPrice, marketQuantity, config.accounts.sell.jwtToken)
  }
}

// 가격 이력에 현재 가격 추가
function updatePriceHistory(currentPrice) {
  priceHistory.push(currentPrice)
  if (priceHistory.length > PRICE_HISTORY_MAX_SIZE) {
    priceHistory.shift() // 가장 오래된 가격 제거
  }
}

// 가격 변동성 계산 (표준편차 사용)
function calculateVolatility() {
  if (priceHistory.length < 5) return 0

  // 평균 계산
  const sum = priceHistory.reduce((acc, price) => acc + price, 0)
  const mean = sum / priceHistory.length

  // 분산 계산
  const variance = priceHistory.reduce((acc, price) => acc + Math.pow(price - mean, 2), 0) / priceHistory.length

  // 표준편차 반환 (변동성)
  return Math.sqrt(variance)
}

// 가격 추세 계산 (최근 N개 가격의 기울기)
function calculateTrend() {
  if (priceHistory.length < 5) return 0

  // 간단한 선형 회귀 기울기 계산
  const n = priceHistory.length
  const indices = Array.from({ length: n }, (_, i) => i)
  
  const sumX = indices.reduce((acc, x) => acc + x, 0)
  const sumY = priceHistory.reduce((acc, y) => acc + y, 0)
  const sumXY = indices.reduce((acc, x, i) => acc + x * priceHistory[i], 0)
  const sumXX = indices.reduce((acc, x) => acc + x * x, 0)
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
  
  return slope
}

// 새로운 변동성 패턴 시작
function startVolatilityPattern(currentData) {
  if (!config.volatilityPatterns.enabled) return false
  
  // 이미 패턴이 실행 중이면 건너뜀
  if (activePattern) return false
  
  // 패턴 발생 확률에 따라 결정
  if (Math.random() > config.volatilityPatterns.occurrenceProbability) return false
  
  const currentPrice = currentData.stockInfo.price
  
  // 패턴 선택 (확률 기반)
  const patterns = config.volatilityPatterns.patterns
  let cumulativeProbability = 0
  const randomValue = Math.random()
  
  let selectedPattern = null
  for (const pattern of patterns) {
    cumulativeProbability += pattern.probability
    if (randomValue <= cumulativeProbability) {
      selectedPattern = pattern
      break
    }
  }
  
  if (!selectedPattern) {
    selectedPattern = patterns[patterns.length - 1] // 마지막 패턴 선택
  }
  
  // 패턴 지속 시간 설정
  const duration = getRandomInt(config.volatilityPatterns.minDuration, config.volatilityPatterns.maxDuration)
  
  // 패턴 목표 가격 설정
  const changePercent = getRandomFloat(
    selectedPattern.priceChangePercent.min,
    selectedPattern.priceChangePercent.max
  )
  
  let targetPrice = currentPrice
  
  if (selectedPattern.direction === "up" || selectedPattern.direction === "breakout") {
    // 상승 패턴
    targetPrice = currentPrice * (1 + changePercent / 100)
  } else if (selectedPattern.direction === "down" || selectedPattern.direction === "breakdown") {
    // 하락 패턴
    targetPrice = currentPrice * (1 - changePercent / 100)
  } else if (selectedPattern.direction === "sideways-then-up") {
    // 횡보 후 상승
    targetPrice = currentPrice * (1 + changePercent / 100)
  } else if (selectedPattern.direction === "sideways-then-down") {
    // 횡보 후 하락
    targetPrice = currentPrice * (1 - changePercent / 100)
  } else if (selectedPattern.direction === "volatile") {
    // 변동성 확대 (목표 가격은 의미 없음)
    targetPrice = currentPrice
  }
  
  // 패턴 정보 설정
  activePattern = {
    type: "volatility",
    name: selectedPattern.name,
    direction: selectedPattern.direction,
    orderSizeMultiplier: getRandomFloat(
      selectedPattern.orderSizeMultiplier.min,
      selectedPattern.orderSizeMultiplier.max
    ),
    startPrice: currentPrice,
    targetPrice: targetPrice,
    changePercent: changePercent
  }
  
  patternStartTime = Date.now()
  patternEndTime = patternStartTime + duration
  patternStage = 0
  patternBasePrice = currentPrice
  
  console.log(`[패턴 시작] ${selectedPattern.name}: 현재가 ${currentPrice}원 → 목표가 ${targetPrice.toFixed(0)}원 (${changePercent.toFixed(2)}% ${selectedPattern.direction === "up" || selectedPattern.direction === "breakout" ? "상승" : selectedPattern.direction === "down" || selectedPattern.direction === "breakdown" ? "하락" : "변동"}), 지속시간: ${(duration/1000).toFixed(1)}초`)
  
  return true
}

// 조작 패턴 시작
function startManipulationPattern(currentData) {
  if (!config.manipulationPatterns.enabled) return false
  
  // 이미 패턴이 실행 중이면 건너뜀
  if (activePattern) return false
  
  // 패턴 발생 확률에 따라 결정
  if (Math.random() > config.manipulationPatterns.occurrenceProbability) return false
  
  const currentPrice = currentData.stockInfo.price
  
  // 패턴 선택 (확률 기반)
  const patterns = config.manipulationPatterns.patterns
  let cumulativeProbability = 0
  const randomValue = Math.random()
  
  let selectedPattern = null
  for (const pattern of patterns) {
    cumulativeProbability += pattern.probability
    if (randomValue <= cumulativeProbability) {
      selectedPattern = pattern
      break
    }
  }
  
  if (!selectedPattern) {
    selectedPattern = patterns[patterns.length - 1] // 마지막 패턴 선택
  }
  
  // 패턴 지속 시간 설정
  const duration = getRandomInt(selectedPattern.duration.min, selectedPattern.duration.max)
  
  // 패턴 정보 설정
  activePattern = {
    type: "manipulation",
    name: selectedPattern.name,
    description: selectedPattern.description
  }
  
  patternStartTime = Date.now()
  patternEndTime = patternStartTime + duration
  patternStage = 0
  patternBasePrice = currentPrice
  
  console.log(`[조작 패턴 시작] ${selectedPattern.name}: ${selectedPattern.description}, 지속시간: ${(duration/1000).toFixed(1)}초`)
  
  return true
}

// 패턴 실행 함수
async function executeActivePattern(currentData) {
  if (!activePattern) return false
  
  const currentTime = Date.now()
  const currentPrice = currentData.stockInfo.price
  const tickSize = getTickSize(currentPrice)
  
  // 패턴 종료 시간이 지났는지 확인
  if (currentTime > patternEndTime) {
    console.log(`[패턴 종료] ${activePattern.name} 패턴 종료`)
    activePattern = null
    patternStartTime = null
    patternEndTime = null
    patternStage = 0
    return false
  }
  
  // 패턴 유형에 따라 다른 실행 로직
  if (activePattern.type === "volatility") {
    await executeVolatilityPattern(currentData)
  } else if (activePattern.type === "manipulation") {
    await executeManipulationPattern(currentData)
  }
  
  return true
}

// 변동성 패턴 실행
async function executeVolatilityPattern(currentData) {
  const currentPrice = currentData.stockInfo.price
  const tickSize = getTickSize(currentPrice)
  const elapsedTime = Date.now() - patternStartTime
  const totalDuration = patternEndTime - patternStartTime
  const progressRatio = elapsedTime / totalDuration
  
  // 패턴 방향에 따른 주문 실행
  if (activePattern.direction === "up") {
    // 상승 패턴: 매수 주문 위주로 실행
    const targetPrice = activePattern.targetPrice
    const currentTarget = patternBasePrice + (targetPrice - patternBasePrice) * progressRatio
    
    // 현재 가격이 목표보다 낮으면 매수 주문 실행
    if (currentPrice < currentTarget) {
      const buyPrice = currentPrice + tickSize
      const quantity = getRandomInt(
        config.minQuantity * activePattern.orderSizeMultiplier,
        config.maxQuantity * activePattern.orderSizeMultiplier
      )
      
      console.log(`[${activePattern.name}] 상승 유도 매수 주문: ${buyPrice}원 x ${quantity}주 (목표: ${currentTarget.toFixed(0)}원)`)
      await placeOrder("limit", buyPrice, quantity, config.accounts.buy.jwtToken)
      
      // 대량 주문 이벤트 발생 확률
      if (config.volatilityPatterns.largeOrderEvents.enabled && 
          Math.random() < config.volatilityPatterns.largeOrderEvents.probability) {
        const largeQuantity = getRandomInt(
          config.maxQuantity * config.volatilityPatterns.largeOrderEvents.sizeMultiplier.min,
          config.maxQuantity * config.volatilityPatterns.largeOrderEvents.sizeMultiplier.max
        )
        
        console.log(`[${activePattern.name}] 대량 매수 주문 발생: ${buyPrice}원 x ${largeQuantity}주`)
        await placeOrder("limit", buyPrice, largeQuantity, config.accounts.buy.jwtToken)
      }
    }
  } else if (activePattern.direction === "down") {
    // 하락 패턴: 매도 주문 위주로 실행
    const targetPrice = activePattern.targetPrice
    const currentTarget = patternBasePrice + (targetPrice - patternBasePrice) * progressRatio
    
    // 현재 가격이 목표보다 높으면 매도 주문 실행
    if (currentPrice > currentTarget) {
      const sellPrice = currentPrice - tickSize
      const quantity = getRandomInt(
        config.minQuantity * activePattern.orderSizeMultiplier,
        config.maxQuantity * activePattern.orderSizeMultiplier
      )
      
      console.log(`[${activePattern.name}] 하락 유도 매도 주문: ${sellPrice}원 x ${quantity}주 (목표: ${currentTarget.toFixed(0)}원)`)
      await placeOrder("limit", -sellPrice, quantity, config.accounts.sell.jwtToken)
      
      // 대량 주문 이벤트 발생 확률
      if (config.volatilityPatterns.largeOrderEvents.enabled && 
          Math.random() < config.volatilityPatterns.largeOrderEvents.probability) {
        const largeQuantity = getRandomInt(
          config.maxQuantity * config.volatilityPatterns.largeOrderEvents.sizeMultiplier.min,
          config.maxQuantity * config.volatilityPatterns.largeOrderEvents.sizeMultiplier.max
        )
        
        console.log(`[${activePattern.name}] 대량 매도 주문 발생: ${sellPrice}원 x ${largeQuantity}주`)
        await placeOrder("limit", -sellPrice, largeQuantity, config.accounts.sell.jwtToken)
      }
    }
  } else if (activePattern.direction === "sideways-then-up") {
    // 횡보 후 상승 패턴
    if (progressRatio < 0.6) {
      // 첫 60%는 횡보 (매수/매도 혼합)
      const isBuy = Math.random() < 0.5
      const price = isBuy ? currentPrice + tickSize : currentPrice - tickSize
      const quantity = getRandomInt(config.minQuantity, config.maxQuantity)
      
      console.log(`[${activePattern.name}] 횡보 단계 ${isBuy ? "매수" : "매도"} 주문: ${price}원 x ${quantity}주`)
      await placeOrder("limit", isBuy ? price : -price, quantity, isBuy ? config.accounts.buy.jwtToken : config.accounts.sell.jwtToken)
    } else {
      // 나머지 40%는 상승 (매수 위주)
      const targetPrice = activePattern.targetPrice
      const adjustedProgress = (progressRatio - 0.6) / 0.4 // 0-1 범위로 정규화
      const currentTarget = patternBasePrice + (targetPrice - patternBasePrice) * adjustedProgress
      
      if (currentPrice < currentTarget) {
        const buyPrice = currentPrice + tickSize
        const quantity = getRandomInt(
          config.minQuantity * activePattern.orderSizeMultiplier,
          config.maxQuantity * activePattern.orderSizeMultiplier
        )
        
        console.log(`[${activePattern.name}] 상승 단계 매수 주문: ${buyPrice}원 x ${quantity}주 (목표: ${currentTarget.toFixed(0)}원)`)
        await placeOrder("limit", buyPrice, quantity, config.accounts.buy.jwtToken)
      }
    }
  } else if (activePattern.direction === "sideways-then-down") {
    // 횡보 후 하락 패턴
    if (progressRatio < 0.6) {
      // 첫 60%는 횡보 (매수/매도 혼합)
      const isBuy = Math.random() < 0.5
      const price = isBuy ? currentPrice + tickSize : currentPrice - tickSize
      const quantity = getRandomInt(config.minQuantity, config.maxQuantity)
      
      console.log(`[${activePattern.name}] 횡보 단계 ${isBuy ? "매수" : "매도"} 주문: ${price}원 x ${quantity}주`)
      await placeOrder("limit", isBuy ? price : -price, quantity, isBuy ? config.accounts.buy.jwtToken : config.accounts.sell.jwtToken)
    } else {
      // 나머지 40%는 하락 (매도 위주)
      const targetPrice = activePattern.targetPrice
      const adjustedProgress = (progressRatio - 0.6) / 0.4 // 0-1 범위로 정규화
      const currentTarget = patternBasePrice + (targetPrice - patternBasePrice) * adjustedProgress
      
      if (currentPrice > currentTarget) {
        const sellPrice = currentPrice - tickSize
        const quantity = getRandomInt(
          config.minQuantity * activePattern.orderSizeMultiplier,
          config.maxQuantity * activePattern.orderSizeMultiplier
        )
        
        console.log(`[${activePattern.name}] 하락 단계 매도 주문: ${sellPrice}원 x ${quantity}주 (목표: ${currentTarget.toFixed(0)}원)`)
        await placeOrder("limit", -sellPrice, quantity, config.accounts.sell.jwtToken)
      }
    }
  } else if (activePattern.direction === "breakout") {
    // 고점 돌파 패턴
    if (progressRatio < 0.3) {
      // 첫 30%는 소량 매수로 가격 서서히 상승
      const buyPrice = currentPrice + tickSize
      const quantity = getRandomInt(config.minQuantity, Math.floor(config.maxQuantity / 2))
      
      console.log(`[${activePattern.name}] 초기 단계 소량 매수: ${buyPrice}원 x ${quantity}주`)
      await placeOrder("limit", buyPrice, quantity, config.accounts.buy.jwtToken)
    } else if (progressRatio < 0.4) {
      // 30-40%는 대량 매수로 급등 유도
      const buyPrice = currentPrice + tickSize * 2
      const quantity = getRandomInt(
        config.maxQuantity * activePattern.orderSizeMultiplier,
        config.maxQuantity * activePattern.orderSizeMultiplier * 1.5
      )
      
      console.log(`[${activePattern.name}] 돌파 단계 대량 매수: ${buyPrice}원 x ${quantity}주`)
      await placeOrder("limit", buyPrice, quantity, config.accounts.buy.jwtToken)
      
      // 시장가 매수 추가
      const marketQuantity = getRandomInt(
        config.maxQuantity * activePattern.orderSizeMultiplier / 2,
        config.maxQuantity * activePattern.orderSizeMultiplier
      )
      console.log(`[${activePattern.name}] 돌파 단계 시장가 매수: ${marketQuantity}주`)
      await placeOrder("market", currentPrice, marketQuantity, config.accounts.buy.jwtToken)
    } else {
      // 나머지는 매수/매도 혼합으로 변동성 유지
      const isBuy = Math.random() < 0.6 // 60% 확률로 매수
      const price = isBuy ? currentPrice + tickSize : currentPrice - tickSize
      const quantity = getRandomInt(
        config.minQuantity * activePattern.orderSizeMultiplier / 2,
        config.maxQuantity * activePattern.orderSizeMultiplier / 2
      )
      
      console.log(`[${activePattern.name}] 유지 단계 ${isBuy ? "매수" : "매도"} 주문: ${price}원 x ${quantity}주`)
      await placeOrder("limit", isBuy ? price : -price, quantity, isBuy ? config.accounts.buy.jwtToken : config.accounts.sell.jwtToken)
    }
  } else if (activePattern.direction === "breakdown") {
    // 지지선 붕괴 패턴
    if (progressRatio < 0.3) {
      // 첫 30%는 소량 매도로 가격 서서히 하락
      const sellPrice = currentPrice - tickSize
      const quantity = getRandomInt(config.minQuantity, Math.floor(config.maxQuantity / 2))
      
      console.log(`[${activePattern.name}] 초기 단계 소량 매도: ${sellPrice}원 x ${quantity}주`)
      await placeOrder("limit", -sellPrice, quantity, config.accounts.sell.jwtToken)
    } else if (progressRatio < 0.4) {
      // 30-40%는 대량 매도로 급락 유도
      const sellPrice = currentPrice - tickSize * 2
      const quantity = getRandomInt(
        config.maxQuantity * activePattern.orderSizeMultiplier,
        config.maxQuantity * activePattern.orderSizeMultiplier * 1.5
      )
      
      console.log(`[${activePattern.name}] 붕괴 단계 대량 매도: ${sellPrice}원 x ${quantity}주`)
      await placeOrder("limit", -sellPrice, quantity, config.accounts.sell.jwtToken)
      
      // 시장가 매도 추가
      const marketQuantity = getRandomInt(
        config.maxQuantity * activePattern.orderSizeMultiplier / 2,
        config.maxQuantity * activePattern.orderSizeMultiplier
      )
      console.log(`[${activePattern.name}] 붕괴 단계 시장가 매도: ${marketQuantity}주`)
      await placeOrder("market", -currentPrice, marketQuantity, config.accounts.sell.jwtToken)
    } else {
      // 나머지는 매수/매도 혼합으로 변동성 유지
      const isBuy = Math.random() < 0.4 // 40% 확률로 매수
      const price = isBuy ? currentPrice + tickSize : currentPrice - tickSize
      const quantity = getRandomInt(
        config.minQuantity * activePattern.orderSizeMultiplier / 2,
        config.maxQuantity * activePattern.orderSizeMultiplier / 2
      )
      
      console.log(`[${activePattern.name}] 유지 단계 ${isBuy ? "매수" : "매도"} 주문: ${price}원 x ${quantity}주`)
      await placeOrder("limit", isBuy ? price : -price, quantity, isBuy ? config.accounts.buy.jwtToken : config.accounts.sell.jwtToken)
    }
  } else if (activePattern.direction === "volatile") {
    // 변동성 확대 패턴 (급등락 반복)
    const volatilityStage = Math.floor(progressRatio * 10) % 2 // 0 또는 1
    
    if (volatilityStage === 0) {
      // 짝수 단계: 매수 주문으로 가격 상승
      const buyPrice = currentPrice + tickSize * getRandomInt(1, 3)
      const quantity = getRandomInt(
        config.minQuantity * activePattern.orderSizeMultiplier,
        config.maxQuantity * activePattern.orderSizeMultiplier
      )
      
      console.log(`[${activePattern.name}] 변동성 상승 단계 매수: ${buyPrice}원 x ${quantity}주`)
      await placeOrder("limit", buyPrice, quantity, config.accounts.buy.jwtToken)
    } else {
      // 홀수 단계: 매도 주문으로 가격 하락
      const sellPrice = currentPrice - tickSize * getRandomInt(1, 3)
      const quantity = getRandomInt(
        config.minQuantity * activePattern.orderSizeMultiplier,
        config.maxQuantity * activePattern.orderSizeMultiplier
      )
      
      console.log(`[${activePattern.name}] 변동성 하락 단계 매도: ${sellPrice}원 x ${quantity}주`)
      await placeOrder("limit", -sellPrice, quantity, config.accounts.sell.jwtToken)
    }
  }
}

// 조작 패턴 실행
async function executeManipulationPattern(currentData) {
  const currentPrice = currentData.stockInfo.price
  const tickSize = getTickSize(currentPrice)
  
  if (activePattern.name === "가격 고정") {
    // 가격 고정 패턴: 특정 가격대에 대량 매수/매도 주문을 넣어 가격을 고정
    if (patternStage === 0) {
      // 첫 단계: 목표 가격 설정 (현재 가격 기준)
      patternTargetPrice = currentPrice
      patternStage = 1
      console.log(`[${activePattern.name}] 목표 가격 설정: ${patternTargetPrice}원`)
    }
    
    // 현재 가격이 목표 가격보다 높으면 매도 주문
    if (currentPrice > patternTargetPrice + tickSize) {
      const sellPrice = currentPrice - tickSize
      const quantity = getRandomInt(config.maxQuantity * 2, config.maxQuantity * 5)
      
      console.log(`[${activePattern.name}] 가격 하락 유도 매도: ${sellPrice}원 x ${quantity}주`)
      await placeOrder("limit", -sellPrice, quantity, config.accounts.sell.jwtToken)
    }
    // 현재 가격이 목표 가격보다 낮으면 매수 주문
    else if (currentPrice < patternTargetPrice - tickSize) {
      const buyPrice = currentPrice + tickSize
      const quantity = getRandomInt(config.maxQuantity * 2, config.maxQuantity * 5)
      
      console.log(`[${activePattern.name}] 가격 상승 유도 매수: ${buyPrice}원 x ${quantity}주`)
      await placeOrder("limit", buyPrice, quantity, config.accounts.buy.jwtToken)
    }
    // 가격이 목표 범위 내에 있으면 소량 주문으로 유지
    else {
      const isBuy = Math.random() < 0.5
      const price = isBuy ? currentPrice + tickSize : currentPrice - tickSize
      const quantity = getRandomInt(config.minQuantity, config.maxQuantity)
      
      console.log(`[${activePattern.name}] 가격 유지 ${isBuy ? "매수" : "매도"}: ${price}원 x ${quantity}주`)
      await placeOrder("limit", isBuy ? price : -price, quantity, isBuy ? config.accounts.buy.jwtToken : config.accounts.sell.jwtToken)
    }
  } else if (activePattern.name === "스포핑") {
    // 스포핑 패턴: 대량 주문을 넣었다가 체결 직전에 취소하는 패턴
    // (실제 취소는 구현할 수 없으므로 시뮬레이션)
    const elapsedTime = Date.now() - patternStartTime
    const totalDuration = patternEndTime - patternStartTime
    const progressRatio = elapsedTime / totalDuration
    
    if (progressRatio < 0.4) {
      // 첫 40%: 대량 매수 주문 (상승 유도)
      if (patternStage === 0) {
        const buyPrice = currentPrice + tickSize
        const quantity = getRandomInt(config.maxQuantity * 5, config.maxQuantity * 10)
        
        console.log(`[${activePattern.name}] 대량 매수 주문 표시: ${buyPrice}원 x ${quantity}주 (실제 체결 안됨)`)
        // 실제로는 주문하지 않고 로그만 출력 (스포핑 시뮬레이션)
        
        // 소량 실제 매수 주문으로 가격 상승 유도
        const smallQuantity = getRandomInt(config.minQuantity, config.maxQuantity)
        console.log(`[${activePattern.name}] 소량 실제 매수: ${buyPrice}원 x ${smallQuantity}주`)
        await placeOrder("limit", buyPrice, smallQuantity, config.accounts.buy.jwtToken)
        
        patternStage = 1
      }
    } else if (progressRatio < 0.8) {
      // 40-80%: 대량 매도 주문 (하락 유도)
      if (patternStage === 1) {
        const sellPrice = currentPrice - tickSize
        const quantity = getRandomInt(config.maxQuantity * 5, config.maxQuantity * 10)
        
        console.log(`[${activePattern.name}] 대량 매도 주문 표시: ${sellPrice}원 x ${quantity}주 (실제 체결 안됨)`)
        // 실제로는 주문하지 않고 로그만 출력 (스포핑 시뮬레이션)
        
        // 소량 실제 매도 주문으로 가격 하락 유도
        const smallQuantity = getRandomInt(config.minQuantity, config.maxQuantity)
        console.log(`[${activePattern.name}] 소량 실제 매도: ${sellPrice}원 x ${smallQuantity}주`)
        await placeOrder("limit", -sellPrice, smallQuantity, config.accounts.sell.jwtToken)
        
        patternStage = 2
      }
    } else {
      // 마지막 20%: 정상 거래로 복귀
      if (patternStage === 2) {
        console.log(`[${activePattern.name}] 스포핑 종료, 정상 거래 복귀`)
        patternStage = 3
      }
      
      // 일반 주문 실행
      const isBuy = Math.random() < 0.5
      const price = isBuy ? currentPrice + tickSize : currentPrice - tickSize
      const quantity = getRandomInt(config.minQuantity, config.maxQuantity)
      
      console.log(`[${activePattern.name}] 정상 거래 ${isBuy ? "매수" : "매도"}: ${price}원 x ${quantity}주`)
      await placeOrder("limit", isBuy ? price : -price, quantity, isBuy ? config.accounts.buy.jwtToken : config.accounts.sell.jwtToken)
    }
  } else if (activePattern.name === "펌핑") {
    // 펌핑 패턴: 단계적으로 가격을 끌어올린 후 매도하는 패턴
    const elapsedTime = Date.now() - patternStartTime
    const totalDuration = patternEndTime - patternStartTime
    const progressRatio = elapsedTime / totalDuration
    
    if (progressRatio < 0.7) {
      // 첫 70%: 단계적 매수로 가격 상승
      const buyPrice = currentPrice + tickSize * getRandomInt(1, 3)
      const quantity = getRandomInt(config.maxQuantity, config.maxQuantity * 3)
      
      console.log(`[${activePattern.name}] 상승 유도 매수: ${buyPrice}원 x ${quantity}주 (진행: ${(progressRatio * 100).toFixed(0)}%)`)
      await placeOrder("limit", buyPrice, quantity, config.accounts.buy.jwtToken)
      
      // 가끔 시장가 매수로 급등 유도
      if (Math.random() < 0.2) {
        const marketQuantity = getRandomInt(config.maxQuantity, config.maxQuantity * 2)
        console.log(`[${activePattern.name}] 급등 유도 시장가 매수: ${marketQuantity}주`)
        await placeOrder("market", currentPrice, marketQuantity, config.accounts.buy.jwtToken)
      }
    } else {
      // 나머지 30%: 대량 매도로 수익 실현
      const sellPrice = currentPrice - tickSize
      const quantity = getRandomInt(config.maxQuantity * 2, config.maxQuantity * 5)
      
      console.log(`[${activePattern.name}] 수익 실현 매도: ${sellPrice}원 x ${quantity}주 (진행: ${(progressRatio * 100).toFixed(0)}%)`)
      await placeOrder("limit", -sellPrice, quantity, config.accounts.sell.jwtToken)
      
      // 가끔 시장가 매도로 빠른 수익 실현
      if (Math.random() < 0.3) {
        const marketQuantity = getRandomInt(config.maxQuantity, config.maxQuantity * 3)
        console.log(`[${activePattern.name}] 빠른 수익 실현 시장가 매도: ${marketQuantity}주`)
        await placeOrder("market", -currentPrice, marketQuantity, config.accounts.sell.jwtToken)
      }
    }
  } else if (activePattern.name === "덤핑") {
    // 덤핑 패턴: 단계적으로 가격을 끌어내린 후 매수하는 패턴
    const elapsedTime = Date.now() - patternStartTime
    const totalDuration = patternEndTime - patternStartTime
    const progressRatio = elapsedTime / totalDuration
    
    if (progressRatio < 0.7) {
      // 첫 70%: 단계적 매도로 가격 하락
      const sellPrice = currentPrice - tickSize * getRandomInt(1, 3)
      const quantity = getRandomInt(config.maxQuantity, config.maxQuantity * 3)
      
      console.log(`[${activePattern.name}] 하락 유도 매도: ${sellPrice}원 x ${quantity}주 (진행: ${(progressRatio * 100).toFixed(0)}%)`)
      await placeOrder("limit", -sellPrice, quantity, config.accounts.sell.jwtToken)
      
      // 가끔 시장가 매도로 급락 유도
      if (Math.random() < 0.2) {
        const marketQuantity = getRandomInt(config.maxQuantity, config.maxQuantity * 2)
        console.log(`[${activePattern.name}] 급락 유도 시장가 매도: ${marketQuantity}주`)
        await placeOrder("market", -currentPrice, marketQuantity, config.accounts.sell.jwtToken)
      }
    } else {
      // 나머지 30%: 대량 매수로 저가 매집
      const buyPrice = currentPrice + tickSize
      const quantity = getRandomInt(config.maxQuantity * 2, config.maxQuantity * 5)
      
      console.log(`[${activePattern.name}] 저가 매집 매수: ${buyPrice}원 x ${quantity}주 (진행: ${(progressRatio * 100).toFixed(0)}%)`)
      await placeOrder("limit", buyPrice, quantity, config.accounts.buy.jwtToken)
      
      // 가끔 시장가 매수로 빠른 매집
      if (Math.random() < 0.3) {
        const marketQuantity = getRandomInt(config.maxQuantity, config.maxQuantity * 3)
        console.log(`[${activePattern.name}] 빠른 매집 시장가 매수: ${marketQuantity}주`)
        await placeOrder("market", currentPrice, marketQuantity, config.accounts.buy.jwtToken)
      }
    }
  }
}

// 주문 로직 실행 함수
function executeOrderLogic(latestData) {
  if (!latestData || !latestData.stockInfo) {
    console.log("아직 호가창 데이터가 없습니다. 주문을 건너뜁니다.")
    return
  }

  const currentPrice = latestData.stockInfo.price

  // 매수 또는 매도 랜덤 결정
  const isBuy = Math.random() < 0.5

  // 주문 유형과 현재 호가창에 따라 가격 결정
  let price
  if (isBuy) {
    price = determineBuyPrice(latestData, currentPrice)
  } else {
    price = determineSellPrice(latestData, currentPrice)
  }

  // 가격이 호가 단위에 맞도록 조정
  const tickSize = getTickSize(currentPrice)
  price = Math.round(price / tickSize) * tickSize

  // 주문 유형 랜덤 결정 (지정가 또는 시장가)
  const isMarketOrder = Math.random() < 0.2 // 20% 확률로 시장가 주문

  // 랜덤 수량 생성
  const quantity = getRandomInt(config.minQuantity, config.maxQuantity)

  // 주문 실행
  placeOrder(
    isMarketOrder ? "market" : "limit",
    isBuy ? price : -price, // 음수 가격은 매도 표시
    quantity,
    isBuy ? config.accounts.buy.jwtToken : config.accounts.sell.jwtToken,
  )
}

// 트레이딩 봇 시작 메인 함수
function startTradingBot() {
  console.log("트레이딩 봇 시작 중...")

  // 가장 최근 호가창 데이터를 저장할 변수
  let latestOrderBookData = null

  const socket = io(config.wsUrl)

  socket.on("connect", () => {
    console.log("웹소켓 서버에 연결됨")
    socket.emit("joinRoom", config.stockId)
    console.log(`종목 ID ${config.stockId}의 룸에 참가함`)
  })

  socket.on("disconnect", () => {
    console.log("웹소켓 서버와 연결 끊김")
  })

  socket.on("error", (error) => {
    console.error("웹소켓 오류:", error)
  })

  // 호가창 데이터 업데이트 수신
  socket.on("stockUpdated", (data) => {
    // 이전 데이터 저장
    previousOrderBookData = latestOrderBookData

    // 최신 데이터 저장
    latestOrderBookData = data
    
    // 현재 가격 이력 업데이트
    if (data.stockInfo && data.stockInfo.price) {
      updatePriceHistory(data.stockInfo.price)
    }

    // 이전 데이터가 있으면 대량 주문 감지 및 처리
    if (previousOrderBookData) {
      const largeOrderDetected = detectAndHandleLargeOrderGaps(latestOrderBookData, previousOrderBookData)

      // 대량 주문이 감지되면 로그 출력
      if (largeOrderDetected) {
        console.log("대량 주문 감지 및 처리 완료")
      }
    }
    
    // 활성 패턴이 없으면 새 패턴 시작 시도
    if (!activePattern) {
      // 변동성 패턴 시작 시도
      const volatilityStarted = startVolatilityPattern(latestOrderBookData)
      
      // 변동성 패턴이 시작되지 않았으면 조작 패턴 시작 시도
      if (!volatilityStarted) {
        startManipulationPattern(latestOrderBookData)
      }
    }
    // 활성 패턴이 있으면 실행
    else {
      executeActivePattern(latestOrderBookData)
    }
  })

  // 랜덤 간격으로 주문 실행 함수
  function scheduleNextOrder() {
    // 활성 패턴이 있으면 일반 주문은 건너뜀
    if (activePattern) {
      setTimeout(() => {
        console.log("활성 패턴 실행 중, 일반 주문 건너뜀")
        scheduleNextOrder()
      }, getRandomInt(config.minOrderInterval * 2, config.maxOrderInterval * 2))
      return
    }
    
    // 0.2초에서 0.5초 사이의 랜덤한 시간 후에 주문 실행
    const nextOrderDelay = getRandomInt(config.minOrderInterval, config.maxOrderInterval)

    setTimeout(() => {
      console.log(`${nextOrderDelay}ms 간격으로 주문 실행`)
      executeOrderLogic(latestOrderBookData)
      // 다음 주문 예약
      scheduleNextOrder()
    }, nextOrderDelay)
  }

  // 첫 번째 주문 예약
  scheduleNextOrder()
}

// 트레이딩 봇 시작
startTradingBot()

export default startTradingBot