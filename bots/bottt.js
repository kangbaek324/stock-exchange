import { io } from "socket.io-client"
import fetch from "node-fetch"

// 설정
const config = {
  wsUrl: "http://localhost:3003/stock",
  apiBaseUrl: "http://localhost:3002", // API 기본 URL
  apiEndpoints: {
    buy: "/stocks/orders/buy", // 매수 주문 엔드포인트
    sell: "/stocks/orders/sell", // 매도 주문 엔드포인트
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
  maxOrderInterval: 500, // 최대 0.1초 간격으로 주문 실행
  minOrderInterval: 100, // 최소 0.25초 간격으로 주문 실행
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
}

// 이전 호가창 데이터를 저장할 변수
let previousOrderBookData = null

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
  const isBuyOrder = 1 > 0 // 양수 가격은 매수, 음수 가격은 매도로 가정

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

  const socket = io(config.wsUrl, {
    transportOptions: {
      polling: {
        extraHeaders: {
          Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsInVzZXJuYW1lIjoiYWRtaW4zIiwiaWF0IjoxNzQ3MzE0NDY1fQ.Tq0XFy1HJY-Ict4BLVUGgMHizoZn45JmQ4f5PKl1WuY',
        },
      },
    },
  });

  socket.on("connect", () => {
    console.log("웹소켓 서버에 연결됨")
    socket.emit("joinStockRoom", config.stockId)
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

    // 이전 데이터가 있으면 대량 주문 감지 및 처리
    if (previousOrderBookData) {
      const largeOrderDetected = detectAndHandleLargeOrderGaps(latestOrderBookData, previousOrderBookData)

      // 대량 주문이 감지되면 로그 출력
      if (largeOrderDetected) {
        console.log("대량 주문 감지 및 처리 완료")
      }
    }
  })

  // 랜덤 간격으로 주문 실행 함수
  function scheduleNextOrder() {
    // 0.25초에서 0.5초 사이의 랜덤한 시간 후에 주문 실행
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
