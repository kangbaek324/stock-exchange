import { io } from 'socket.io-client';
import fetch from 'node-fetch';

// 설정
const config = {
  wsUrl: 'http://localhost:3003/stock', // 웹소켓은 3003 포트 유지
  apiBaseUrl: 'http://localhost:3002', // API 기본 URL은 3000 포트
  apiEndpoints: {
    buy: '/stock/user/orders/buy',  // 매수 주문 엔드포인트
    sell: '/stock/user/orders/sell' // 매도 주문 엔드포인트
  },
  stockId: 1,
  accounts: {
    buy: {
      accountNumber: 1002,
      jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsInVzZXJuYW1lIjoiYWRtaW4zIiwiaWF0IjoxNzQ3MzE0NDY1fQ.Tq0XFy1HJY-Ict4BLVUGgMHizoZn45JmQ4f5PKl1WuY'
    },
    sell: {
      accountNumber: 1001,
      jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsInVzZXJuYW1lIjoiYWRtaW4yIiwiaWF0IjoxNzQ3MzE3OTMxfQ.4W2LpPcUwYGaI5IxQ40yU6P_iGVc3yd6mxJgNA1seoA'
    }
  },
  orderCount: 3000, // 각 방향(매수/매도)으로 생성할 호가 수
  
  // 일반 주문 수량 범위
  normalQuantity: {
    min: 100,
    max: 400
  },
  
  // 대량 주문 수량 범위
  largeQuantity: {
    min: 2000,
    max: 10000,
    probability: 0.1 // 10% 확률로 대량 주문 발생
  },
  
  // 소량 주문 수량 범위
  smallQuantity: {
    min: 1,
    max: 40,
    probability: 0.15 // 15% 확률로 소량 주문 발생
  },
  
  // 물량 집중 구간 설정
  volumeCluster: {
    // 특정 구간에 물량이 집중되는 확률
    probability: 0.3, // 30% 확률로 물량 집중 구간 생성
    // 집중 구간의 크기 (몇 개의 연속된 호가에 집중할지)
    size: { min: 3, max: 8 },
    // 집중 구간의 물량 배수 (일반 물량의 몇 배로 설정할지)
    multiplier: { min: 5, max: 15 }
  },
  
  orderDelay: 25   // 주문 간 지연 시간 (밀리초)
};

// 현재 가격에 따른 호가 단위 계산
function getTickSize(currentPrice) {
  if (currentPrice >= 200000) {
    return 1000;
  } else if (currentPrice >= 50000) {
    return 100;
  } else if (currentPrice >= 20000) {
    return 50;
  } else if (currentPrice >= 5000) {
    return 10;
  } else if (currentPrice >= 2000) {
    return 5;
  } else {
    return 1;
  }
}

// 최소값과 최대값 사이의 랜덤 정수 생성
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 특정 확률로 true를 반환하는 함수
function probabilityCheck(probability) {
  return Math.random() < probability;
}

// 주문 수량 결정 함수
function determineOrderQuantity(isClusterZone = false) {
  // 물량 집중 구간인 경우
  if (isClusterZone) {
    const multiplier = getRandomInt(
      config.volumeCluster.multiplier.min,
      config.volumeCluster.multiplier.max
    );
    return getRandomInt(config.normalQuantity.min, config.normalQuantity.max) * multiplier;
  }
  
  // 대량 주문 확률 체크
  if (probabilityCheck(config.largeQuantity.probability)) {
    return getRandomInt(config.largeQuantity.min, config.largeQuantity.max);
  }
  
  // 소량 주문 확률 체크
  if (probabilityCheck(config.smallQuantity.probability)) {
    return getRandomInt(config.smallQuantity.min, config.smallQuantity.max);
  }
  
  // 일반 주문
  return getRandomInt(config.normalQuantity.min, config.normalQuantity.max);
}

// 주문 실행
async function placeOrder(isBuy, price, quantity) {
  const orderData = {
    accountNumber: isBuy ? config.accounts.buy.accountNumber : config.accounts.sell.accountNumber,
    stockId: config.stockId,
    price: price,
    number: quantity,
    orderType: 'limit' // 지정가 주문만 사용
  };
  
  const jwtToken = isBuy ? config.accounts.buy.jwtToken : config.accounts.sell.jwtToken;
  const endpoint = isBuy ? config.apiEndpoints.buy : config.apiEndpoints.sell;
  
  console.log(`${isBuy ? '매수' : '매도'} 주문 실행: 가격=${price}, 수량=${quantity}`);
  
  try {
    const response = await fetch(`${config.apiBaseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`
      },
      body: JSON.stringify(orderData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`주문 실패: ${response.status} ${errorText}`);
    }
    
    const result = await response.json();
    console.log('주문 성공:', result);
    return result;
  } catch (error) {
    console.error('주문 오류:', error.message);
    return null;
  }
}

// 지연 함수 (주문 간 간격을 두기 위함)
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 호가창 설정 함수
async function setupOrderBook(currentPrice) {
  const tickSize = getTickSize(currentPrice);
  console.log(`현재 가격: ${currentPrice}, 호가 단위: ${tickSize}`);
  
  // 매수 호가 물량 집중 구간 설정
  let buyClusterStart = -1;
  let buyClusterEnd = -1;
  
  if (probabilityCheck(config.volumeCluster.probability)) {
    const clusterSize = getRandomInt(
      config.volumeCluster.size.min,
      config.volumeCluster.size.max
    );
    buyClusterStart = getRandomInt(1, config.orderCount - clusterSize);
    buyClusterEnd = buyClusterStart + clusterSize;
    console.log(`매수 물량 집중 구간 설정: ${buyClusterStart}~${buyClusterEnd} 호가`);
  }
  
  // 매수 호가 100개 생성 (현재 가격보다 낮은 가격)
  console.log('매수 호가 생성 중...');
  for (let i = 1; i <= config.orderCount; i++) {
    const price = currentPrice - (i * tickSize);
    
    // 물량 집중 구간인지 확인
    const isClusterZone = (i >= buyClusterStart && i <= buyClusterEnd);
    const quantity = determineOrderQuantity(isClusterZone);
    
    await placeOrder(true, price, quantity);
    await delay(config.orderDelay); // 주문 간 지연
  }
  
  // 매도 호가 물량 집중 구간 설정
  let sellClusterStart = -1;
  let sellClusterEnd = -1;
  
  if (probabilityCheck(config.volumeCluster.probability)) {
    const clusterSize = getRandomInt(
      config.volumeCluster.size.min,
      config.volumeCluster.size.max
    );
    sellClusterStart = getRandomInt(1, config.orderCount - clusterSize);
    sellClusterEnd = sellClusterStart + clusterSize;
    console.log(`매도 물량 집중 구간 설정: ${sellClusterStart}~${sellClusterEnd} 호가`);
  }
  
  // 매도 호가 100개 생성 (현재 가격보다 높은 가격)
  console.log('매도 호가 생성 중...');
  for (let i = 0; i < config.orderCount; i++) {
    const price = currentPrice + ((i + 1) * tickSize); // 현재 가격보다 1틱 위부터 시작
    
    // 물량 집중 구간인지 확인
    const isClusterZone = (i >= sellClusterStart && i <= sellClusterEnd);
    const quantity = determineOrderQuantity(isClusterZone);
    
    await placeOrder(false, price, quantity);
    await delay(config.orderDelay); // 주문 간 지연
  }
  
  console.log('호가창 설정 완료!');
}

// 메인 함수
async function main() {
  console.log('호가창 설정 프로그램 시작...');
  
  // 웹소켓 연결 및 현재 가격 가져오기
  const socket = io(config.wsUrl);
  
  // 프로미스를 사용하여 첫 번째 데이터를 기다림
  const firstDataPromise = new Promise((resolve) => {
    socket.on('connect', () => {
      console.log('웹소켓 서버에 연결됨');
      socket.emit('joinRoom', config.stockId);
      console.log(`종목 ID ${config.stockId}의 룸에 참가함`);
    });
    
    socket.on('stockUpdated', (data) => {
      console.log('종목 데이터 수신:', data.stockInfo);
      resolve(data);
    });
    
    socket.on('error', (error) => {
      console.error('웹소켓 오류:', error);
    });
  });
  
  // 첫 번째 데이터를 기다리고 호가창 설정 시작
  try {
    const data = await firstDataPromise;
    const currentPrice = data.stockInfo.price;
    
    // 호가창 설정
    await setupOrderBook(currentPrice);
    
    // 작업 완료 후 소켓 연결 종료
    socket.disconnect();
    console.log('프로그램 종료');
  } catch (error) {
    console.error('오류 발생:', error);
  }
}

// 프로그램 실행
main();