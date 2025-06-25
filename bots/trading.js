import { io } from 'socket.io-client';
import fetch from 'node-fetch';

// 설정
const config = {
  wsUrl: 'http://localhost:3003/stock',
  apiBaseUrl: 'http://localhost:3002',
  apiEndpoints: {
    buy: '/stock/user/orders/buy',
    sell: '/stock/user/orders/sell'
  },
  stockId: 1,
  accounts: {
    buy: {
      accountNumber: 1002,
      jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsInVzZXJuYW1lIjoiYWRtaW4zIiwiaWF0IjoxNzQ1ODM2NjIzfQ.fYyzTEb6pnbH9-uhv4PPM3n7G76ZAutM7neQdjr6L7g'
    },
    sell: {
      accountNumber: 1001,
      jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsInVzZXJuYW1lIjoiYWRtaW5yIiwiaWF0IjoxNzQ1ODM2NjAxfQ.wRLPKfHC0erk90HZbZsbSPuApPXz4iH0DoOtaa7_xy4'
    }
  },
  // 세력 설정
  manipulator: {
    // 전략 전환 간격 (밀리초)
    strategyChangeInterval: 60000, // 1분마다 전략 변경 고려
    
    // 강도 설정
    intensityLevels: {
      low: 0.7,    // 약한 강도
      normal: 1.0, // 보통 강도
      high: 1.5,   // 강한 강도
      extreme: 2.5 // 극단적 강도
    },
    
    // 전략 유형 분류
    strategyTypes: {
      bullish: ['accumulation', 'pumping', 'scalping_up', 'volume_imbalance_up'],  // 상승 전략
      bearish: ['shakeout', 'digging', 'scalping_down', 'volume_imbalance_down']   // 하락 전략
    },
    
    // 개미털기 설정
    shakeout: {
      // 가격 하락 유도 강도 (틱 단위)
      pressureIntensity: { min: 3, max: 10 },
      // 하락 유도 후 매집 강도
      buybackIntensity: { min: 1.5, max: 3 },
      // 개미털기 단계
      phases: ['pressure', 'accumulate', 'release'],
      // 각 단계별 지속 시간 (밀리초)
      phaseDuration: { min: 10000, max: 20000 },
      // 매도 주문 크기
      sellOrderSize: { min: 100, max: 500 },
      // 매수 주문 크기
      buyOrderSize: { min: 200, max: 800 },
      // 목표 하락률 (퍼센트)
      targetDropPercent: { min: 2, max: 5 }
    },
    
    // 매집봉 설정
    accumulation: {
      // 매집 단계
      phases: ['silent', 'pump', 'distribute'],
      // 각 단계별 지속 시간 (밀리초)
      phaseDuration: { min: 15000, max: 30000 },
      // 매집 강도 (일반 거래량 대비)
      intensity: { min: 3, max: 8 },
      // 매집 주문 크기
      orderSize: { min: 500, max: 2000 },
      // 가격 상승 목표 (퍼센트)
      priceTarget: { min: 3, max: 8 }
    },
    
    // 골파기 설정
    digging: {
      // 골파기 단계
      phases: ['setup', 'pressure', 'buyback'],
      // 각 단계별 지속 시간 (밀리초)
      phaseDuration: { min: 12000, max: 25000 },
      // 매도 압력 강도
      pressureIntensity: { min: 2, max: 5 },
      // 매집 강도
      buybackIntensity: { min: 2, max: 4 },
      // 매도 주문 크기
      sellOrderSize: { min: 300, max: 1000 },
      // 매수 주문 크기
      buyOrderSize: { min: 400, max: 1200 },
      // 목표 하락률 (퍼센트)
      targetDropPercent: { min: 3, max: 8 }
    },
    
    // 펌핑 설정
    pumping: {
      // 펌핑 단계
      phases: ['prepare', 'execute', 'distribute'],
      // 각 단계별 지속 시간 (밀리초)
      phaseDuration: { min: 10000, max: 20000 },
      // 펌핑 강도
      intensity: { min: 2, max: 6 },
      // 주문 크기
      orderSize: { min: 500, max: 3000 },
      // 가격 상승 목표 (퍼센트)
      priceTarget: { min: 5, max: 15 }
    },
    
    // 스캘핑 (단기 매매) 설정 - 새로운 전략
    scalping_up: {
      // 스캘핑 단계
      phases: ['entry', 'exit'],
      // 각 단계별 지속 시간 (밀리초)
      phaseDuration: { min: 5000, max: 15000 },
      // 진입 주문 크기
      entryOrderSize: { min: 100, max: 300 },
      // 청산 주문 크기
      exitOrderSize: { min: 100, max: 300 },
      // 목표 수익률 (퍼센트)
      targetProfit: { min: 0.5, max: 2 },
      // 손절 수익률 (퍼센트)
      stopLoss: { min: 0.3, max: 1 }
    },
    
    // 하락 스캘핑 설정 - 새로운 전략
    scalping_down: {
      // 스캘핑 단계
      phases: ['entry', 'exit'],
      // 각 단계별 지속 시간 (밀리초)
      phaseDuration: { min: 5000, max: 15000 },
      // 진입 주문 크기
      entryOrderSize: { min: 100, max: 300 },
      // 청산 주문 크기
      exitOrderSize: { min: 100, max: 300 },
      // 목표 수익률 (퍼센트)
      targetProfit: { min: 0.5, max: 2 },
      // 손절 수익률 (퍼센트)
      stopLoss: { min: 0.3, max: 1 }
    },
    
    // 호가 불균형 활용 (상승) - 새로운 전략
    volume_imbalance_up: {
      // 단계
      phases: ['analyze', 'execute'],
      // 각 단계별 지속 시간 (밀리초)
      phaseDuration: { min: 8000, max: 18000 },
      // 불균형 감지 임계값 (매수/매도 비율)
      imbalanceThreshold: 1.5,
      // 주문 크기
      orderSize: { min: 200, max: 800 },
      // 목표 수익률 (퍼센트)
      targetProfit: { min: 1, max: 3 }
    },
    
    // 호가 불균형 활용 (하락) - 새로운 전략
    volume_imbalance_down: {
      // 단계
      phases: ['analyze', 'execute'],
      // 각 단계별 지속 시간 (밀리초)
      phaseDuration: { min: 8000, max: 18000 },
      // 불균형 감지 임계값 (매도/매수 비율)
      imbalanceThreshold: 1.5,
      // 주문 크기
      orderSize: { min: 200, max: 800 },
      // 목표 수익률 (퍼센트)
      targetProfit: { min: 1, max: 3 },
      // 목표 하락률 (퍼센트)
      targetDropPercent: { min: 2, max: 5 }
    },
    
    // 복합 전략 설정
    combined: {
      // 골파기+펌핑 설정
      diggingPumping: {
        strategies: ['digging', 'pumping'],
        pauseBetween: { min: 5000, max: 15000 }
      },
      // 개미털기+매집봉 설정
      shakeoutAccumulation: {
        strategies: ['shakeout', 'accumulation'],
        pauseBetween: { min: 8000, max: 20000 }
      },
      // 3단계 복합 전략
      fullCycle: {
        strategies: ['digging', 'accumulation', 'pumping'],
        pauseBetween: { min: 10000, max: 25000 }
      },
      // 스캘핑 복합 전략 - 새로운 전략
      scalpingCycle: {
        strategies: ['scalping_down', 'scalping_up'],
        pauseBetween: { min: 3000, max: 8000 }
      },
      // 호가 불균형 복합 전략 - 새로운 전략
      imbalanceCycle: {
        strategies: ['volume_imbalance_down', 'volume_imbalance_up'],
        pauseBetween: { min: 5000, max: 12000 }
      }
    },
    
    // 주문 간격 (밀리초)
    orderInterval: { min: 100, max: 500 }
  }
};

// 전략 이름 한글 매핑
const strategyNames = {
  shakeout: '개미털기',
  accumulation: '매집봉',
  digging: '골파기',
  pumping: '펌핑',
  scalping_up: '상승 스캘핑',
  scalping_down: '하락 스캘핑',
  volume_imbalance_up: '호가 불균형 상승',
  volume_imbalance_down: '호가 불균형 하락',
  diggingPumping: '골파기+펌핑',
  shakeoutAccumulation: '개미털기+매집봉',
  fullCycle: '풀사이클',
  scalpingCycle: '스캘핑 사이클',
  imbalanceCycle: '호가 불균형 사이클'
};

// 단계 이름 한글 매핑
const phaseNames = {
  pressure: '압박',
  accumulate: '매집',
  release: '상승유도',
  silent: '조용한 매집',
  pump: '펌핑',
  distribute: '분산',
  buyback: '저가매수',
  prepare: '준비',
  execute: '실행',
  entry: '진입',
  exit: '청산',
  analyze: '분석',
  setup: '설정'
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

// 호가 단위에 맞게 가격 조정
function adjustToTickSize(price) {
  const tickSize = getTickSize(price);
  return Math.round(price / tickSize) * tickSize;
}

// 호가 단위 체크 함수
function tickSizeCheck(price) {
  let check = false;
  
  if (price >= 2000 && price < 5000) {
    if (price % 5 !== 0) check = true;
  } 
  else if (price >= 5000 && price < 20000) {
    if (price % 10 !== 0) check = true;
  } 
  else if (price >= 20000 && price < 50000) {
    if (price % 50 !== 0) check = true;
  } 
  else if (price >= 50000 && price < 200000) {
    if (price % 100 !== 0) check = true;
  } 
  else if (price >= 200000 && price < 500000) {
    if (price % 500 !== 0) check = true;
  } 
  else if (price >= 500000) {
    if (price % 1000 !== 0) check = true;
  }

  if (check) {
    return "잘못된 호가 단위 입니다";
  }
  return null;
}

// 최소값과 최대값 사이의 랜덤 정수 생성
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 최소값과 최대값 사이의 랜덤 소수점 생성
function getRandomFloat(min, max) {
  return min + Math.random() * (max - min);
}

// 주문 실행
async function placeOrder(isBuy, price, quantity) {
  // 호가 단위에 맞게 가격 조정
  const adjustedPrice = adjustToTickSize(price);
  
  // 호가 단위 체크
  const tickCheckResult = tickSizeCheck(adjustedPrice);
  if (tickCheckResult) {
    console.error(`주문 오류: ${tickCheckResult} (원래 가격: ${price}, 조정된 가격: ${adjustedPrice})`);
    return null;
  }
  
  const orderData = {
    accountNumber: isBuy ? config.accounts.buy.accountNumber : config.accounts.sell.accountNumber,
    stockId: config.stockId,
    price: adjustedPrice,
    number: quantity,
    orderType: 'limit'
  };
  
  const jwtToken = isBuy ? config.accounts.buy.jwtToken : config.accounts.sell.jwtToken;
  const endpoint = isBuy ? config.apiEndpoints.buy : config.apiEndpoints.sell;
  
  console.log(`${isBuy ? '매수' : '매도'} 주문 실행: 가격=${adjustedPrice}, 수량=${quantity}`);
  
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

// 지연 함수
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 세력 조작 클래스
class MarketManipulator {
  constructor() {
    this.socket = null;
    this.latestData = null;
    this.currentStrategy = null;
    this.currentPhase = null;
    this.phaseStartTime = 0;
    this.phaseDuration = 0;
    this.basePrice = 0;
    this.targetPrice = 0;
    this.isRunning = false;
    this.orderHistory = [];
    this.profitLoss = 0;
    this.holdings = 0;
    this.averagePrice = 0;
    this.intensity = 'normal'; // 기본 강도
    this.lastStrategyType = null; // 마지막으로 실행한 전략 유형 (상승/하락)
    this.strategyStats = {
      bullish: 0, // 상승 전략 실행 횟수
      bearish: 0  // 하락 전략 실행 횟수
    };
    
    // 사용자 정의 목표 가격/비율 설정
    this.userTargetPrice = null;
    this.userTargetPercent = null;
  }
  
  // 목표 가격 설정 (직접 가격 지정)
  setTargetPrice(price) {
    this.userTargetPrice = price;
    this.userTargetPercent = null; // 가격과 비율 중 하나만 사용
    console.log(`목표 가격 설정: ${price}`);
  }
  
  // 목표 변동 비율 설정 (현재 가격 기준 %)
  setTargetPercent(percent, isUp = true) {
    this.userTargetPercent = {
      value: Math.abs(percent),
      isUp: isUp
    };
    this.userTargetPrice = null; // 가격과 비율 중 하나만 사용
    console.log(`목표 ${isUp ? '상승' : '하락'} 비율 설정: ${Math.abs(percent)}%`);
  }
  
  // 목표 가격 계산 (현재 가격 기준)
  calculateTargetPrice(currentPrice, strategy) {
    // 사용자가 직접 목표 가격을 설정한 경우
    if (this.userTargetPrice !== null) {
      return this.userTargetPrice;
    }
    
    // 사용자가 목표 변동 비율을 설정한 경우
    if (this.userTargetPercent !== null) {
      const factor = this.userTargetPercent.isUp ? 
        (1 + this.userTargetPercent.value / 100) : 
        (1 - this.userTargetPercent.value / 100);
      return currentPrice * factor;
    }
    
    // 기본 설정 사용 (전략별 기본 목표)
    let targetPercent;
    
    if (strategy === 'digging' || strategy === 'shakeout' || strategy === 'volume_imbalance_down' || strategy === 'scalping_down') {
      // 하락 전략의 경우
      targetPercent = this.adjustPriceTargetByIntensity(getRandomFloat(
        config.manipulator[strategy].targetDropPercent.min,
        config.manipulator[strategy].targetDropPercent.max
      )) / 100;
      return currentPrice * (1 - targetPercent);
    } else {
      // 상승 전략의 경우
      const targetKey = strategy === 'pumping' ? 'priceTarget' : 
                        (strategy === 'accumulation' ? 'priceTarget' : 'targetProfit');
      
      targetPercent = this.adjustPriceTargetByIntensity(getRandomFloat(
        config.manipulator[strategy][targetKey].min,
        config.manipulator[strategy][targetKey].max
      )) / 100;
      return currentPrice * (1 + targetPercent);
    }
  }
  
  // 웹소켓 연결 및 초기화
  async initialize() {
    console.log('세력 조작 프로그램 초기화 중...');
    
    this.socket = io(config.wsUrl);
    
    this.socket.on('connect', () => {
      console.log('웹소켓 서버에 연결됨');
      this.socket.emit('joinRoom', config.stockId);
      console.log(`종목 ID ${config.stockId}의 룸에 참가함`);
    });
    
    this.socket.on('disconnect', () => {
      console.log('웹소켓 서버와 연결 끊김');
    });
    
    this.socket.on('error', (error) => {
      console.error('웹소켓 오류:', error);
    });
    
    // 호가창 데이터 업데이트 수신
    this.socket.on('stockUpdated', (data) => {
      this.latestData = data;
      this.basePrice = data.stockInfo.price;
      
      // 호가창 데이터 로깅 (디버깅용)
      if (this.isRunning && Math.random() < 0.05) { // 5% 확률로 로깅
        this.logOrderBookData();
      }
    });
    
    // 첫 번째 데이터를 기다림
    await new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.latestData) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
    
    console.log('초기화 완료. 현재 가격:', this.basePrice);
  }
  
  // 호가창 데이터 로깅
  logOrderBookData() {
    if (!this.latestData || !this.latestData.orderBook) return;
    
    console.log('\n===== 현재 호가창 데이터 =====');
    console.log(`현재가: ${this.latestData.stockInfo.price}`);
    
    // 매도호가 (높은 가격부터 낮은 가격 순)
    console.log('매도호가:');
    const sellOrders = this.latestData.orderBook.filter(order => order.type === 'sell')
      .sort((a, b) => b.price - a.price);
    
    sellOrders.forEach(order => {
      console.log(`  가격: ${order.price}, 수량: ${order.quantity}`);
    });
    
    // 매수호가 (높은 가격부터 낮은 가격 순)
    console.log('매수호가:');
    const buyOrders = this.latestData.orderBook.filter(order => order.type === 'buy')
      .sort((a, b) => b.price - a.price);
    
    buyOrders.forEach(order => {
      console.log(`  가격: ${order.price}, 수량: ${order.quantity}`);
    });
    
    // 호가 불균형 분석
    this.analyzeOrderBookImbalance();
    
    console.log('=============================\n');
  }
  
  // 호가 불균형 분석
  analyzeOrderBookImbalance() {
    if (!this.latestData || !this.latestData.orderBook) return null;
    
    // 매수/매도 총량 계산
    let totalBuyVolume = 0;
    let totalSellVolume = 0;
    
    this.latestData.orderBook.forEach(order => {
      if (order.type === 'buy') {
        totalBuyVolume += order.quantity;
      } else if (order.type === 'sell') {
        totalSellVolume += order.quantity;
      }
    });
    
    // 매수/매도 비율 계산
    const buyToSellRatio = totalSellVolume > 0 ? totalBuyVolume / totalSellVolume : 999;
    const sellToBuyRatio = totalBuyVolume > 0 ? totalSellVolume / totalBuyVolume : 999;
    
    console.log(`매수총량: ${totalBuyVolume}, 매도총량: ${totalSellVolume}`);
    console.log(`매수/매도 비율: ${buyToSellRatio.toFixed(2)}, 매도/매수 비율: ${sellToBuyRatio.toFixed(2)}`);
    
    // 불균형 판단
    const imbalanceThreshold = 1.5; // 불균형 임계값
    
    if (buyToSellRatio > imbalanceThreshold) {
      console.log(`매수 우위 불균형 감지 (${buyToSellRatio.toFixed(2)}배)`);
      return { type: 'buy_dominant', ratio: buyToSellRatio };
    } else if (sellToBuyRatio > imbalanceThreshold) {
      console.log(`매도 우위 불균형 감지 (${sellToBuyRatio.toFixed(2)}배)`);
      return { type: 'sell_dominant', ratio: sellToBuyRatio };
    } else {
      console.log('호가 균형 상태');
      return { type: 'balanced', ratio: 1 };
    }
  }
  
  // 세력 조작 시작
  async start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('세력 조작 시작');
    
    // 전략 선택 및 실행 루프
    while (this.isRunning) {
      // 상승/하락 전략 균형 유지를 위한 전략 유형 선택
      const strategyType = this.selectStrategyType();
      
      // 선택된 유형에 맞는 전략 선택
      const strategy = this.selectStrategyByType(strategyType);
      
      // 랜덤하게 강도 선택
      const intensities = ['low', 'normal', 'high', 'extreme'];
      this.intensity = intensities[Math.floor(Math.random() * intensities.length)];
      
      console.log(`선택된 전략 유형: ${strategyType}, 전략: ${strategyNames[strategy]}, 강도: ${this.intensity}`);
      
      // 전략 실행
      await this.executeStrategy(strategy);
      
      // 전략 통계 업데이트
      if (config.manipulator.strategyTypes.bullish.includes(strategy)) {
        this.strategyStats.bullish++;
      } else if (config.manipulator.strategyTypes.bearish.includes(strategy)) {
        this.strategyStats.bearish++;
      }
      
      // 전략 간 간격
      const pauseDuration = getRandomInt(5000, 15000);
      console.log(`다음 전략까지 ${pauseDuration / 1000}초 대기`);
      console.log(`현재까지 상승 전략: ${this.strategyStats.bullish}회, 하락 전략: ${this.strategyStats.bearish}회 실행`);
      await delay(pauseDuration);
    }
  }
  
  // 상승/하락 전략 균형을 위한 전략 유형 선택
  selectStrategyType() {
    // 상승/하락 전략 실행 횟수 차이 계산
    const diff = this.strategyStats.bullish - this.strategyStats.bearish;
    
    // 차이가 크면 적은 쪽 유형 선택 확률 증가
    if (diff > 2) {
      // 하락 전략 선택 확률 증가
      return Math.random() < 0.7 ? 'bearish' : 'bullish';
    } else if (diff < -2) {
      // 상승 전략 선택 확률 증가
      return Math.random() < 0.7 ? 'bullish' : 'bearish';
    } else {
      // 균형 상태면 50:50 확률
      return Math.random() < 0.5 ? 'bullish' : 'bearish';
    }
  }
  
  // 전략 유형에 맞는 전략 선택
  selectStrategyByType(strategyType) {
    const strategies = config.manipulator.strategyTypes[strategyType];
    return strategies[Math.floor(Math.random() * strategies.length)];
  }
  
  // 세력 조작 중지
  stop() {
    this.isRunning = false;
    console.log('세력 조작 중지');
    this.printResults();
  }
  
  // 전략 실행
  async executeStrategy(strategy) {
    this.currentStrategy = strategy;
    console.log(`전략 실행: ${strategyNames[strategy] || strategy} (강도: ${this.intensity})`);
    
    // 복합 전략인지 확인
    if (['diggingPumping', 'shakeoutAccumulation', 'fullCycle', 'scalpingCycle', 'imbalanceCycle'].includes(strategy)) {
      await this.executeCombinedStrategy(strategy);
    } else {
      // 단일 전략 실행
      switch (strategy) {
        case 'shakeout':
          await this.executeShakeout();
          break;
        case 'accumulation':
          await this.executeAccumulation();
          break;
        case 'digging':
          await this.executeDigging();
          break;
        case 'pumping':
          await this.executePumping();
          break;
        case 'scalping_up':
          await this.executeScalpingUp();
          break;
        case 'scalping_down':
          await this.executeScalpingDown();
          break;
        case 'volume_imbalance_up':
          await this.executeVolumeImbalanceUp();
          break;
        case 'volume_imbalance_down':
          await this.executeVolumeImbalanceDown();
          break;
      }
    }
  }
  
  // 복합 전략 실행
  async executeCombinedStrategy(combinedStrategy) {
    const strategies = config.manipulator.combined[combinedStrategy].strategies;
    console.log(`복합 전략 ${strategyNames[combinedStrategy]} 시작 (${strategies.length}개 전략 포함)`);
    
    for (let i = 0; i < strategies.length; i++) {
      const strategy = strategies[i];
      console.log(`복합 전략 ${i+1}/${strategies.length} 단계: ${strategyNames[strategy]}`);
      
      // 개별 전략 실행
      switch (strategy) {
        case 'shakeout':
          await this.executeShakeout();
          break;
        case 'accumulation':
          await this.executeAccumulation();
          break;
        case 'digging':
          await this.executeDigging();
          break;
        case 'pumping':
          await this.executePumping();
          break;
        case 'scalping_up':
          await this.executeScalpingUp();
          break;
        case 'scalping_down':
          await this.executeScalpingDown();
          break;
        case 'volume_imbalance_up':
          await this.executeVolumeImbalanceUp();
          break;
        case 'volume_imbalance_down':
          await this.executeVolumeImbalanceDown();
          break;
      }
      
      // 마지막 전략이 아니면 잠시 대기
      if (i < strategies.length - 1) {
        const pauseDuration = getRandomInt(
          config.manipulator.combined[combinedStrategy].pauseBetween.min,
          config.manipulator.combined[combinedStrategy].pauseBetween.max
        );
        console.log(`다음 단계까지 ${pauseDuration / 1000}초 대기`);
        await delay(pauseDuration);
      }
    }
    
    console.log(`복합 전략 ${strategyNames[combinedStrategy]} 완료`);
  }
  
  // 강도에 따른 수량 조정
  adjustQuantityByIntensity(quantity) {
    const intensityMultiplier = config.manipulator.intensityLevels[this.intensity];
    return Math.floor(quantity * intensityMultiplier);
  }
  
  // 강도에 따른 가격 목표 조정
  adjustPriceTargetByIntensity(percentage) {
    const intensityMultiplier = config.manipulator.intensityLevels[this.intensity];
    return percentage * intensityMultiplier;
  }
  
  // 개미털기 전략 실행
  async executeShakeout() {
    console.log('개미털기 전략 시작');
    
    // 현재 가격 저장
    const initialPrice = this.latestData.stockInfo.price;
    
    // 목표 가격 계산
    const targetPrice = this.calculateTargetPrice(initialPrice, 'shakeout');
    console.log(`초기 가격: ${initialPrice}, 목표 가격: ${targetPrice} (${((targetPrice - initialPrice) / initialPrice * 100).toFixed(2)}% 변동)`);
    
    // 1단계: 가격 하락 유도 (매도 압박)
    await this.executePhase('shakeout', 'pressure', async () => {
      const tickSize = getTickSize(initialPrice);
      const pressureIntensity = getRandomInt(
        config.manipulator.shakeout.pressureIntensity.min,
        config.manipulator.shakeout.pressureIntensity.max
      );
      
      // 강도에 따른 압박 강도 조정
      const adjustedPressureIntensity = Math.floor(pressureIntensity * config.manipulator.intensityLevels[this.intensity]);
      
      // 호가창 데이터 분석하여 매도 전략 최적화
      const orderBookAnalysis = this.analyzeOrderBookImbalance();
      let additionalPressure = 1;
      
      if (orderBookAnalysis && orderBookAnalysis.type === 'buy_dominant') {
        // 매수 우위 시장에서는 더 강한 매도 압력 필요
        additionalPressure = Math.min(orderBookAnalysis.ratio, 2);
        console.log(`매수 우위 시장 감지: 매도 압력 ${additionalPressure.toFixed(2)}배 증가`);
      }
      
      // 목표 가격까지 도달하기 위한 매도 단계 계산
      const priceDiff = initialPrice - targetPrice;
      const steps = Math.max(5, Math.ceil(priceDiff / tickSize)); // 최소 5단계
      
      console.log(`목표 가격 ${targetPrice}까지 ${steps}단계에 걸쳐 매도 실행`);
      
      // 여러 호가에 걸쳐 매도 주문 분산
      for (let i = 0; i < steps; i++) {
        // 현재 가격 확인
        const currentPrice = this.latestData.stockInfo.price;
        
        // 목표 가격에 도달했는지 확인
        if (currentPrice <= targetPrice) {
          console.log(`목표 가격 ${targetPrice}에 도달했습니다. 현재 가격: ${currentPrice}`);
          break;
        }
        
        // 매도 가격 계산 (현재 가격에서 점점 낮게)
        const sellPrice = currentPrice - (i * tickSize);
        
        // 매도 수량 계산 (단계가 진행될수록 수량 증가)
        const quantityFactor = 1 + (i / steps);
        const quantity = Math.floor(this.adjustQuantityByIntensity(getRandomInt(
          config.manipulator.shakeout.sellOrderSize.min,
          config.manipulator.shakeout.sellOrderSize.max
        )) * additionalPressure * quantityFactor);
        
        await placeOrder(false, sellPrice, quantity);
        this.recordOrder(false, sellPrice, quantity);
        
        console.log(`매도 단계 ${i + 1}/${steps}: 가격=${sellPrice}, 수량=${quantity}, 목표까지=${(sellPrice - targetPrice).toFixed(2)}`);
        
        await delay(getRandomInt(
          config.manipulator.orderInterval.min,
          config.manipulator.orderInterval.max
        ));
        
        // 가격 변화 모니터링을 위해 추가 대기
        if (i % 3 === 0) {
          console.log(`가격 변화 모니터링 중... 현재 가격: ${this.latestData.stockInfo.price}`);
          await delay(getRandomInt(500, 1500));
        }
      }
      
      // 최종 상태 확인
      const finalPrice = this.latestData.stockInfo.price;
      console.log(`매도 압박 완료. 초기 가격: ${initialPrice}, 목표 가격: ${targetPrice}, 최종 가격: ${finalPrice}`);
      console.log(`목표 달성률: ${Math.min(100, Math.max(0, (initialPrice - finalPrice) / (initialPrice - targetPrice) * 100)).toFixed(2)}%`);
    });
    
    // 2단계: 저가 매집
    await this.executePhase('shakeout', 'accumulate', async () => {
      // 현재 가격 확인 (하락 후)
      const currentPrice = this.latestData.stockInfo.price;
      const tickSize = getTickSize(currentPrice);
      
      // 매집 강도 설정 및 강도에 따른 조정
      const buybackIntensity = getRandomFloat(
        config.manipulator.shakeout.buybackIntensity.min,
        config.manipulator.shakeout.buybackIntensity.max
      ) * config.manipulator.intensityLevels[this.intensity];
      
      // 호가창 데이터 분석하여 매수 전략 최적화
      const orderBookAnalysis = this.analyzeOrderBookImbalance();
      let adjustedBuybackIntensity = buybackIntensity;
      
      if (orderBookAnalysis && orderBookAnalysis.type === 'sell_dominant') {
        // 매도 우위 시장에서는 더 강한 매수 필요
        adjustedBuybackIntensity = buybackIntensity * Math.min(orderBookAnalysis.ratio, 2);
        console.log(`매도 우위 시장 감지: 매수 강도 ${Math.min(orderBookAnalysis.ratio, 2).toFixed(2)}배 증가`);
      }
      
      // 저가에서 대량 매수
      for (let i = 0; i < 5; i++) {
        const price = currentPrice + (i * tickSize);
        const quantity = Math.floor(getRandomInt(
          config.manipulator.shakeout.buyOrderSize.min,
          config.manipulator.shakeout.buyOrderSize.max
        ) * adjustedBuybackIntensity);
        
        await placeOrder(true, price, quantity);
        this.recordOrder(true, price, quantity);
        
        await delay(getRandomInt(
          config.manipulator.orderInterval.min,
          config.manipulator.orderInterval.max
        ));
      }
    });
    
    // 3단계: 가격 상승 유도
    await this.executePhase('shakeout', 'release', async () => {
      const currentPrice = this.latestData.stockInfo.price;
      const tickSize = getTickSize(currentPrice);
      
      // 강도에 따른 상승 유도 조정
      const releaseIntensity = config.manipulator.intensityLevels[this.intensity];
      const steps = Math.floor(3 * releaseIntensity);
      
      // 상승 유도를 위한 매수 주문
      for (let i = 0; i < steps; i++) {
        const price = currentPrice + ((i + 1) * tickSize);
        const quantity = this.adjustQuantityByIntensity(getRandomInt(
          config.manipulator.shakeout.buyOrderSize.min / 2,
          config.manipulator.shakeout.buyOrderSize.max / 2
        ));
        
        await placeOrder(true, price, quantity);
        this.recordOrder(true, price, quantity);
        
        await delay(getRandomInt(
          config.manipulator.orderInterval.min,
          config.manipulator.orderInterval.max
        ));
      }
    });
    
    console.log('개미털기 전략 완료');
  }
  
  // 매집봉 전략 실행
  async executeAccumulation() {
    console.log('매집봉 전략 시작 (펌프 앤 덤프 방식)');
    
    // 시작 가격 저장 (나중에 비교용)
    const initialPrice = this.latestData.stockInfo.price;
    console.log(`초기 가격: ${initialPrice}`);
    
    // 1단계: 조용한 매집 (소규모 매수로 준비)
    await this.executePhase('accumulation', 'silent', async () => {
      const currentPrice = this.latestData.stockInfo.price;
      const tickSize = getTickSize(currentPrice);
      
      // 호가창 데이터 분석
      const orderBookAnalysis = this.analyzeOrderBookImbalance();
      let silentFactor = 1;
      
      if (orderBookAnalysis && orderBookAnalysis.type === 'sell_dominant') {
        // 매도 우위 시장에서는 더 적극적인 매집 가능
        silentFactor = Math.min(orderBookAnalysis.ratio, 1.5);
        console.log(`매도 우위 시장 감지: 조용한 매집 강도 ${silentFactor.toFixed(2)}배 증가`);
    }
    
    // 소규모 매수로 조용히 매집
    for (let i = 0; i < 5; i++) {
      const price = currentPrice - (i * tickSize);
      const quantity = Math.floor(this.adjustQuantityByIntensity(getRandomInt(
        config.manipulator.accumulation.orderSize.min / 4,
        config.manipulator.accumulation.orderSize.max / 4
      )) * silentFactor);
      
      await placeOrder(true, price, quantity);
      this.recordOrder(true, price, quantity);
      
      await delay(getRandomInt(
        config.manipulator.orderInterval.min * 2,
        config.manipulator.orderInterval.max * 2
      ));
    }
  });
  
  // 2단계: 급등 유도 (대규모 매수로 가격 급등 유도)
  let peakPrice = 0;
  await this.executePhase('accumulation', 'pump', async () => {
    const currentPrice = this.latestData.stockInfo.price;
    const tickSize = getTickSize(currentPrice);
    
    // 목표 가격 계산
    const targetPrice = this.calculateTargetPrice(currentPrice, 'accumulation');
    console.log(`급등 목표 가격: ${targetPrice} (현재 대비 ${((targetPrice - currentPrice) / currentPrice * 100).toFixed(2)}% 상승)`);
    
    // 급격한 상승을 위한 대규모 매수 주문
    const steps = 8;
    const priceStep = (targetPrice - currentPrice) / steps;
    
    for (let i = 0; i < steps; i++) {
      // 현재 가격 확인
      const updatedPrice = this.latestData.stockInfo.price;
      
      // 목표 가격에 도달했는지 확인
      if (updatedPrice >= targetPrice) {
        console.log(`목표 가격 ${targetPrice}에 도달했습니다. 현재 가격: ${updatedPrice}`);
        peakPrice = updatedPrice;
        break;
      }
      
      const price = updatedPrice + (priceStep * (i + 1));
      const roundedPrice = Math.round(price / tickSize) * tickSize;
      
      // 매수 수량은 점점 증가하도록 설정
      const quantityFactor = 1 + (i / steps);
      const quantity = Math.floor(this.adjustQuantityByIntensity(getRandomInt(
        config.manipulator.accumulation.orderSize.min,
        config.manipulator.accumulation.orderSize.max
      )) * quantityFactor);
      
      await placeOrder(true, roundedPrice, quantity);
      this.recordOrder(true, roundedPrice, quantity);
      
      // 마지막 주문의 가격을 피크 가격으로 저장
      if (i === steps - 1) {
        peakPrice = roundedPrice;
      }
      
      console.log(`매수 단계 ${i + 1}/${steps}: 가격=${roundedPrice}, 수량=${quantity}, 목표까지=${(targetPrice - roundedPrice).toFixed(2)}`);
      
      await delay(getRandomInt(
        config.manipulator.orderInterval.min / 2, // 더 빠른 주문 간격
        config.manipulator.orderInterval.max / 2
      ));
      
      // 가격 변화 모니터링을 위해 추가 대기
      if (i % 2 === 0) {
        console.log(`가격 변화 모니터링 중... 현재 가격: ${this.latestData.stockInfo.price}`);
        await delay(getRandomInt(500, 1000));
      }
    }
    
    console.log(`급등 완료. 피크 가격: ${peakPrice}`);
  });
  
  // 3단계: 고점 매도 (가격이 원래 가격 근처로 돌아올 때까지 매도)
  await this.executePhase('accumulation', 'distribute', async () => {
    const tickSize = getTickSize(peakPrice);
    
    // 매도 시작 가격 (피크 가격보다 약간 낮게)
    let sellStartPrice = peakPrice - tickSize;
    
    console.log(`매도 시작 가격: ${sellStartPrice}, 목표 하락 가격: ${initialPrice * 1.05}`);
    
    // 호가창 데이터 분석
    const orderBookAnalysis = this.analyzeOrderBookImbalance();
    let distributeFactor = 1;
    
    if (orderBookAnalysis && orderBookAnalysis.type === 'buy_dominant') {
      // 매수 우위 시장에서는 더 많은 물량 분산 가능
      distributeFactor = Math.min(orderBookAnalysis.ratio, 2);
      console.log(`매수 우위 시장 감지: 매도 강도 ${distributeFactor.toFixed(2)}배 증가`);
    }
    
    // 매도 단계 설정
    const sellSteps = 10;
    let currentSellStep = 0;
    
    // 가격이 원래 가격 근처로 돌아올 때까지 매도 반복
    while (currentSellStep < sellSteps) {
      // 현재 가격 확인
      const currentPrice = this.latestData.stockInfo.price;
      
      // 가격이 초기 가격의 105% 이하로 떨어졌으면 매도 중단
      if (currentPrice <= initialPrice * 1.05) {
        console.log(`가격이 초기 가격 근처로 돌아옴: ${currentPrice} <= ${initialPrice * 1.05}`);
        break;
      }
      
      // 매도 가격 계산 (현재 가격 기준으로 약간 낮게)
      const sellPrice = Math.max(currentPrice - (currentSellStep * tickSize), initialPrice);
      
      // 매도 수량 계산 (단계가 진행될수록 수량 증가)
      const quantityFactor = 1 + (currentSellStep / sellSteps);
      const quantity = Math.floor(this.adjustQuantityByIntensity(getRandomInt(
        config.manipulator.accumulation.orderSize.min / 2,
        config.manipulator.accumulation.orderSize.max / 2
      )) * distributeFactor * quantityFactor);
      
      // 매도 주문 실행
      await placeOrder(false, sellPrice, quantity);
      this.recordOrder(false, sellPrice, quantity);
      
      console.log(`매도 단계 ${currentSellStep + 1}/${sellSteps}: 가격=${sellPrice}, 수량=${quantity}`);
      
      // 다음 단계로
      currentSellStep++;
      
      // 잠시 대기
      await delay(getRandomInt(
        config.manipulator.orderInterval.min,
        config.manipulator.orderInterval.max
      ));
      
      // 가격 변화 모니터링을 위해 추가 대기
      if (currentSellStep % 3 === 0) {
        console.log(`가격 변화 모니터링 중... 현재 가격: ${this.latestData.stockInfo.price}`);
        await delay(getRandomInt(1000, 3000));
      }
    }
    
    // 마지막 매도 (남은 물량 정리)
    const finalPrice = this.latestData.stockInfo.price;
    const finalQuantity = this.adjustQuantityByIntensity(getRandomInt(
      config.manipulator.accumulation.orderSize.min,
      config.manipulator.accumulation.orderSize.max
    )) * distributeFactor;
    
    await placeOrder(false, finalPrice, finalQuantity);
    this.recordOrder(false, finalPrice, finalQuantity);
    
    console.log(`최종 매도 완료: 가격=${finalPrice}, 수량=${finalQuantity}`);
    console.log(`초기 가격: ${initialPrice}, 피크 가격: ${peakPrice}, 최종 가격: ${finalPrice}`);
    console.log(`가격 변화: ${((finalPrice - initialPrice) / initialPrice * 100).toFixed(2)}%`);
  });
  
  console.log('매집봉 전략 완료 (펌프 앤 덤프)');
}
  
  // 골파기 전략 실행 (목표 가격/비율 설정 기능 추가)
  async executeDigging() {
    console.log('골파기 전략 시작');
    
    // 현재 가격 저장
    const initialPrice = this.latestData.stockInfo.price;
    
    // 목표 가격 계산
    const targetPrice = this.calculateTargetPrice(initialPrice, 'digging');
    console.log(`초기 가격: ${initialPrice}, 목표 가격: ${targetPrice} (${((targetPrice - initialPrice) / initialPrice * 100).toFixed(2)}% 변동)`);
    
    // 1단계: 설정 및 초기 매도
    await this.executePhase('digging', 'setup', async () => {
      const currentPrice = this.latestData.stockInfo.price;
      const tickSize = getTickSize(currentPrice);
      
      // 호가창 데이터 분석
      const orderBookAnalysis = this.analyzeOrderBookImbalance();
      let setupFactor = 1;
      
      if (orderBookAnalysis && orderBookAnalysis.type === 'buy_dominant') {
        // 매수 우위 시장에서는 더 많은 물량 분산 가능
        setupFactor = Math.min(orderBookAnalysis.ratio, 1.8);
        console.log(`매수 우위 시장 감지: 초기 매도 강도 ${setupFactor.toFixed(2)}배 증가`);
      }
      
      // 소규모 매도로 시작
      for (let i = 0; i < 5; i++) {
        const price = currentPrice + (i * tickSize);
        const quantity = Math.floor(this.adjustQuantityByIntensity(getRandomInt(
          config.manipulator.digging.sellOrderSize.min / 3,
          config.manipulator.digging.sellOrderSize.max / 3
        )) * setupFactor);
        
        await placeOrder(false, price, quantity);
        this.recordOrder(false, price, quantity);
        
        await delay(getRandomInt(
          config.manipulator.orderInterval.min,
          config.manipulator.orderInterval.max
        ));
      }
    });
    
    // 2단계: 가격 하락 유도 (매도 압박) - 목표 가격까지
    await this.executePhase('digging', 'pressure', async () => {
      // 매도 압력 강도 설정 및 강도에 따른 조정
      const pressureIntensity = Math.floor(getRandomInt(
        config.manipulator.digging.pressureIntensity.min,
        config.manipulator.digging.pressureIntensity.max
      ) * config.manipulator.intensityLevels[this.intensity]);
      
      // 목표 가격까지 도달하기 위한 매도 단계 계산
      const currentPrice = this.latestData.stockInfo.price;
      const tickSize = getTickSize(currentPrice);
      const priceDiff = currentPrice - targetPrice;
      const steps = Math.max(5, Math.ceil(priceDiff / tickSize)); // 최소 5단계
      
      console.log(`목표 가격 ${targetPrice}까지 ${steps}단계에 걸쳐 매도 실행`);
      
      // 여러 호가에 걸쳐 매도 주문 분산
      for (let i = 0; i < steps; i++) {
        // 현재 가격 확인
        const updatedPrice = this.latestData.stockInfo.price;
        
        // 목표 가격에 도달했는지 확인
        if (updatedPrice <= targetPrice) {
          console.log(`목표 가격 ${targetPrice}에 도달했습니다. 현재 가격: ${updatedPrice}`);
          break;
        }
        
        // 매도 가격 계산 (현재 가격에서 점점 낮게)
        const sellPrice = updatedPrice - (i * tickSize);
        
        // 매도 수량 계산 (단계가 진행될수록 수량 증가)
        const quantityFactor = 1 + (i / steps);
        const quantity = Math.floor(this.adjustQuantityByIntensity(getRandomInt(
          config.manipulator.digging.sellOrderSize.min,
          config.manipulator.digging.sellOrderSize.max
        )) * quantityFactor);
        
        await placeOrder(false, sellPrice, quantity);
        this.recordOrder(false, sellPrice, quantity);
        
        console.log(`매도 단계 ${i + 1}/${steps}: 가격=${sellPrice}, 수량=${quantity}, 목표까지=${(sellPrice - targetPrice).toFixed(2)}`);
        
        await delay(getRandomInt(
          config.manipulator.orderInterval.min,
          config.manipulator.orderInterval.max
        ));
        
        // 가격 변화 모니터링을 위해 추가 대기
        if (i % 3 === 0) {
          console.log(`가격 변화 모니터링 중... 현재 가격: ${this.latestData.stockInfo.price}`);
          await delay(getRandomInt(500, 1500));
        }
      }
      
      // 최종 상태 확인
      const finalPrice = this.latestData.stockInfo.price;
      console.log(`매도 압박 완료. 초기 가격: ${initialPrice}, 목표 가격: ${targetPrice}, 최종 가격: ${finalPrice}`);
      console.log(`목표 달성률: ${Math.min(100, Math.max(0, (initialPrice - finalPrice) / (initialPrice - targetPrice) * 100)).toFixed(2)}%`);
    });
    
    // 3단계: 저가 매집
    await this.executePhase('digging', 'buyback', async () => {
      const currentPrice = this.latestData.stockInfo.price;
      const tickSize = getTickSize(currentPrice);
      
      // 매집 강도 설정 및 강도에 따른 조정
      const buybackIntensity = getRandomFloat(
        config.manipulator.digging.buybackIntensity.min,
        config.manipulator.digging.buybackIntensity.max
      ) * config.manipulator.intensityLevels[this.intensity];
      
      // 호가창 데이터 분석
      const orderBookAnalysis = this.analyzeOrderBookImbalance();
      let adjustedBuybackIntensity = buybackIntensity;
      
      if (orderBookAnalysis && orderBookAnalysis.type === 'sell_dominant') {
        // 매도 우위 시장에서는 더 강한 매수 필요
        adjustedBuybackIntensity = buybackIntensity * Math.min(orderBookAnalysis.ratio, 1.8);
        console.log(`매도 우위 시장 감지: 저가 매집 강도 ${Math.min(orderBookAnalysis.ratio, 1.8).toFixed(2)}배 증가`);
      }
      
      // 저가에서 대량 매수
      for (let i = 0; i < 8; i++) {
        const price = currentPrice + (i * tickSize / 2);
        const quantity = Math.floor(getRandomInt(
          config.manipulator.digging.buyOrderSize.min,
          config.manipulator.digging.buyOrderSize.max
        ) * adjustedBuybackIntensity);
        
        await placeOrder(true, price, Math.floor(quantity));
        this.recordOrder(true, price, Math.floor(quantity));
        
        await delay(getRandomInt(
          config.manipulator.orderInterval.min,
          config.manipulator.orderInterval.max
        ));
      }
    });
    
    console.log('골파기 전략 완료');
  }
  
  // 펌핑 전략 실행
  async executePumping() {
    console.log('펌핑 전략 시작');
    
    // 현재 가격 저장
    const initialPrice = this.latestData.stockInfo.price;
    
    // 목표 가격 계산
    const targetPrice = this.calculateTargetPrice(initialPrice, 'pumping');
    console.log(`초기 가격: ${initialPrice}, 목표 가격: ${targetPrice} (${((targetPrice - initialPrice) / initialPrice * 100).toFixed(2)}% 변동)`);
    
    // 1단계: 준비 (소규모 매수로 가격 지지)
    await this.executePhase('pumping', 'prepare', async () => {
      const currentPrice = this.latestData.stockInfo.price;
      const tickSize = getTickSize(currentPrice);
      
      // 호가창 데이터 분석
      const orderBookAnalysis = this.analyzeOrderBookImbalance();
      let prepareFactor = 1;
      
      if (orderBookAnalysis && orderBookAnalysis.type === 'sell_dominant') {
        // 매도 우위 시장에서는 더 강한 준비 필요
        prepareFactor = Math.min(orderBookAnalysis.ratio, 1.5);
        console.log(`매도 우위 시장 감지: 준비 단계 강도 ${prepareFactor.toFixed(2)}배 증가`);
      }
      
      // 소규모 매수로 가격 지지
      for (let i = 0; i < 4; i++) {
        const price = currentPrice - (i * tickSize);
        const quantity = Math.floor(this.adjustQuantityByIntensity(getRandomInt(
          config.manipulator.pumping.orderSize.min / 3,
          config.manipulator.pumping.orderSize.max / 3
        )) * prepareFactor);
        
        await placeOrder(true, price, quantity);
        this.recordOrder(true, price, quantity);
        
        await delay(getRandomInt(
          config.manipulator.orderInterval.min,
          config.manipulator.orderInterval.max
        ));
      }
    });
    
    // 2단계: 실행 (대규모 매수로 가격 급등 유도)
    await this.executePhase('pumping', 'execute', async () => {
      const currentPrice = this.latestData.stockInfo.price;
      const tickSize = getTickSize(currentPrice);
      
      // 펌핑 강도 설정 및 강도에 따른 조정
      const pumpingIntensity = getRandomFloat(
        config.manipulator.pumping.intensity.min,
        config.manipulator.pumping.intensity.max
      ) * config.manipulator.intensityLevels[this.intensity];
      
      // 목표 가격까지 도달하기 위한 매수 단계 계산
      const priceDiff = targetPrice - currentPrice;
      const steps = Math.max(6, Math.ceil(priceDiff / tickSize)); // 최소 6단계
      
      console.log(`목표 가격 ${targetPrice}까지 ${steps}단계에 걸쳐 매수 실행`);
      
      // 급격한 상승을 위한 대규모 매수 주문
      for (let i = 0; i < steps; i++) {
        // 현재 가격 확인
        const updatedPrice = this.latestData.stockInfo.price;
        
        // 목표 가격에 도달했는지 확인
        if (updatedPrice >= targetPrice) {
          console.log(`목표 가격 ${targetPrice}에 도달했습니다. 현재 가격: ${updatedPrice}`);
          break;
        }
        
        // 매수 가격 계산 (현재 가격에서 점점 높게)
        const buyPrice = updatedPrice + (priceDiff * (i + 1) / steps);
        const roundedPrice = Math.round(buyPrice / tickSize) * tickSize;
        
        // 매수 수량 계산 (단계가 진행될수록 수량 증가)
        const quantityFactor = 1 + (i / steps);
        const quantity = Math.floor(getRandomInt(
          config.manipulator.pumping.orderSize.min,
          config.manipulator.pumping.orderSize.max
        ) * pumpingIntensity * quantityFactor);
        
        await placeOrder(true, roundedPrice, quantity);
        this.recordOrder(true, roundedPrice, quantity);
        
        console.log(`매수 단계 ${i + 1}/${steps}: 가격=${roundedPrice}, 수량=${quantity}, 목표까지=${(targetPrice - roundedPrice).toFixed(2)}`);
        
        await delay(getRandomInt(
          config.manipulator.orderInterval.min / 2, // 더 빠른 주문 간격
          config.manipulator.orderInterval.max / 2
        ));
        
        // 가격 변화 모니터링을 위해 추가 대기
        if (i % 2 === 0) {
          console.log(`가격 변화 모니터링 중... 현재 가격: ${this.latestData.stockInfo.price}`);
          await delay(getRandomInt(500, 1000));
        }
      }
      
      // 최종 상태 확인
      const finalPrice = this.latestData.stockInfo.price;
      console.log(`매수 실행 완료. 초기 가격: ${initialPrice}, 목표 가격: ${targetPrice}, 최종 가격: ${finalPrice}`);
      console.log(`목표 달성률: ${Math.min(100, Math.max(0, (finalPrice - initialPrice) / (targetPrice - initialPrice) * 100)).toFixed(2)}%`);
    });
    
    // 3단계: 분산 (고점에서 일부 매도)
    await this.executePhase('pumping', 'distribute', async () => {
      const currentPrice = this.latestData.stockInfo.price;
      const tickSize = getTickSize(currentPrice);
      
      // 호가창 데이터 분석
      const orderBookAnalysis = this.analyzeOrderBookImbalance();
      let distributeFactor = 1;
      
      if (orderBookAnalysis && orderBookAnalysis.type === 'buy_dominant') {
        // 매수 우위 시장에서는 더 많은 물량 분산 가능
        distributeFactor = Math.min(orderBookAnalysis.ratio, 2);
        console.log(`매수 우위 시장 감지: 고점 분산 강도 ${distributeFactor.toFixed(2)}배 증가`);
      }
      
      // 고점에서 일부 매도
      for (let i = 0; i < 3; i++) {
        const price = currentPrice - (i * tickSize);
        const quantity = Math.floor(this.adjustQuantityByIntensity(getRandomInt(
          config.manipulator.pumping.orderSize.min / 4,
          config.manipulator.pumping.orderSize.max / 4
        )) * distributeFactor);
        
        await placeOrder(false, price, quantity);
        this.recordOrder(false, price, quantity);
        
        await delay(getRandomInt(
          config.manipulator.orderInterval.min,
          config.manipulator.orderInterval.max
        ));
      }
    });
    
    console.log('펌핑 전략 완료');
  }
  
  // 상승 스캘핑 전략 실행 (새로운 전략)
  async executeScalpingUp() {
    console.log('상승 스캘핑 전략 시작');
    
    // 현재 가격 저장
    const initialPrice = this.latestData.stockInfo.price;
    
    // 1단계: 진입 (빠른 매수)
    await this.executePhase('scalping_up', 'entry', async () => {
      const currentPrice = this.latestData.stockInfo.price;
      const tickSize = getTickSize(currentPrice);
      
      // 호가창 데이터 분석
      const orderBookAnalysis = this.analyzeOrderBookImbalance();
      let entryFactor = 1;
      
      if (orderBookAnalysis) {
        if (orderBookAnalysis.type === 'sell_dominant') {
          // 매도 우위 시장에서는 더 적극적인 진입
          entryFactor = Math.min(orderBookAnalysis.ratio, 1.5);
          console.log(`매도 우위 시장 감지: 진입 강도 ${entryFactor.toFixed(2)}배 증가`);
        } else if (orderBookAnalysis.type === 'buy_dominant' && orderBookAnalysis.ratio > 2) {
          // 매수 우위가 너무 강하면 진입 강도 감소
          entryFactor = 0.7;
          console.log(`강한 매수 우위 시장 감지: 진입 강도 감소`);
        }
      }
      
      // 빠른 매수 주문
      for (let i = 0; i < 3; i++) {
        const price = currentPrice + (i * tickSize);
        const quantity = Math.floor(this.adjustQuantityByIntensity(getRandomInt(
          config.manipulator.scalping_up.entryOrderSize.min,
          config.manipulator.scalping_up.entryOrderSize.max
        )) * entryFactor);
        
        await placeOrder(true, price, quantity);
        this.recordOrder(true, price, quantity);
        
        await delay(getRandomInt(
          config.manipulator.orderInterval.min / 2,
          config.manipulator.orderInterval.max / 2
        ));
      }
      
      // 목표 가격 계산
      this.targetPrice = this.calculateTargetPrice(currentPrice, 'scalping_up');
      console.log(`스캘핑 목표 가격: ${this.targetPrice} (현재 대비 ${((this.targetPrice - currentPrice) / currentPrice * 100).toFixed(2)}% 상승)`);
    });
    
    // 2단계: 청산 (목표 가격에 매도)
    await this.executePhase('scalping_up', 'exit', async () => {
      const currentPrice = this.latestData.stockInfo.price;
      const tickSize = getTickSize(currentPrice);
      
      // 목표 가격 도달 여부 확인
      const targetReached = currentPrice >= this.targetPrice;
      console.log(`현재 가격: ${currentPrice}, 목표 가격: ${this.targetPrice}, 목표 달성: ${targetReached}`);
      
      // 청산 가격 설정
      const exitPrice = targetReached ? currentPrice : currentPrice - tickSize;
      
      // 청산 주문
      for (let i = 0; i < 2; i++) {
        const price = exitPrice - (i * tickSize);
        const quantity = this.adjustQuantityByIntensity(getRandomInt(
          config.manipulator.scalping_up.exitOrderSize.min,
          config.manipulator.scalping_up.exitOrderSize.max
        ));
        
        await placeOrder(false, price, quantity);
        this.recordOrder(false, price, quantity);
        
        await delay(getRandomInt(
          config.manipulator.orderInterval.min,
          config.manipulator.orderInterval.max
        ));
      }
      
      console.log(`스캘핑 청산 완료. 결과: ${targetReached ? '목표 달성' : '목표 미달'}`);
      console.log(`초기 가격: ${initialPrice}, 목표 가격: ${this.targetPrice}, 최종 가격: ${currentPrice}`);
      console.log(`가격 변화: ${((currentPrice - initialPrice) / initialPrice * 100).toFixed(2)}%`);
    });
    
    console.log('상승 스캘핑 전략 완료');
  }
  
  // 하락 스캘핑 전략 실행 (새로운 전략)
  async executeScalpingDown() {
    console.log('하락 스캘핑 전략 시작');
    
    // 현재 가격 저장
    const initialPrice = this.latestData.stockInfo.price;
    
    // 1단계: 진입 (빠른 매도)
    await this.executePhase('scalping_down', 'entry', async () => {
      const currentPrice = this.latestData.stockInfo.price;
      const tickSize = getTickSize(currentPrice);
      
      // 호가창 데이터 분석
      const orderBookAnalysis = this.analyzeOrderBookImbalance();
      let entryFactor = 1;
      
      if (orderBookAnalysis) {
        if (orderBookAnalysis.type === 'buy_dominant') {
          // 매수 우위 시장에서는 더 적극적인 진입
          entryFactor = Math.min(orderBookAnalysis.ratio, 1.5);
          console.log(`매수 우위 시장 감지: 진입 강도 ${entryFactor.toFixed(2)}배 증가`);
        } else if (orderBookAnalysis.type === 'sell_dominant' && orderBookAnalysis.ratio > 2) {
          // 매도 우위가 너무 강하면 진입 강도 감소
          entryFactor = 0.7;
          console.log(`강한 매도 우위 시장 감지: 진입 강도 감소`);
        }
      }
      
      // 목표 가격 계산
      this.targetPrice = this.calculateTargetPrice(currentPrice, 'scalping_down');
      console.log(`하락 스캘핑 목표 가격: ${this.targetPrice} (현재 대비 ${((this.targetPrice - currentPrice) / currentPrice * 100).toFixed(2)}% 하락)`);
      
      // 빠른 매도 주문
      for (let i = 0; i < 3; i++) {
        const price = currentPrice - (i * tickSize);
        const quantity = Math.floor(this.adjustQuantityByIntensity(getRandomInt(
          config.manipulator.scalping_down.entryOrderSize.min,
          config.manipulator.scalping_down.entryOrderSize.max
        )) * entryFactor);
        
        await placeOrder(false, price, quantity);
        this.recordOrder(false, price, quantity);
        
        await delay(getRandomInt(
          config.manipulator.orderInterval.min / 2,
          config.manipulator.orderInterval.max / 2
        ));
      }
    });
    
    // 2단계: 청산 (목표 가격에 매수)
    await this.executePhase('scalping_down', 'exit', async () => {
      const currentPrice = this.latestData.stockInfo.price;
      const tickSize = getTickSize(currentPrice);
      
      // 목표 가격 도달 여부 확인
      const targetReached = currentPrice <= this.targetPrice;
      console.log(`현재 가격: ${currentPrice}, 목표 가격: ${this.targetPrice}, 목표 달성: ${targetReached}`);
      
      // 청산 가격 설정
      const exitPrice = targetReached ? currentPrice : currentPrice + tickSize;
      
      // 청산 주문
      for (let i = 0; i < 2; i++) {
        const price = exitPrice + (i * tickSize);
        const quantity = this.adjustQuantityByIntensity(getRandomInt(
          config.manipulator.scalping_down.exitOrderSize.min,
          config.manipulator.scalping_down.exitOrderSize.max
        ));
        
        await placeOrder(true, price, quantity);
        this.recordOrder(true, price, quantity);
        
        await delay(getRandomInt(
          config.manipulator.orderInterval.min,
          config.manipulator.orderInterval.max
        ));
      }
      
      console.log(`하락 스캘핑 청산 완료. 결과: ${targetReached ? '목표 달성' : '목표 미달'}`);
      console.log(`초기 가격: ${initialPrice}, 목표 가격: ${this.targetPrice}, 최종 가격: ${currentPrice}`);
      console.log(`가격 변화: ${((currentPrice - initialPrice) / initialPrice * 100).toFixed(2)}%`);
    });
    
    console.log('하락 스캘핑 전략 완료');
  }
  
  // 호가 불균형 활용 상승 전략 (새로운 전략)
  async executeVolumeImbalanceUp() {
    console.log('호가 불균형 상승 전략 시작');
    
    // 현재 가격 저장
    const initialPrice = this.latestData.stockInfo.price;
    
    // 1단계: 호가창 분석
    await this.executePhase('volume_imbalance_up', 'analyze', async () => {
      // 호가창 데이터 분석
      const orderBookAnalysis = this.analyzeOrderBookImbalance();
      
      if (!orderBookAnalysis) {
        console.log('호가창 데이터 분석 실패, 기본 전략 사용');
        return;
      }
      
      console.log(`호가 불균형 분석 결과: ${orderBookAnalysis.type}, 비율: ${orderBookAnalysis.ratio.toFixed(2)}`);
      
      // 목표 가격 계산
      this.targetPrice = this.calculateTargetPrice(initialPrice, 'volume_imbalance_up');
      
      // 매수/매도 불균형 임계값 설정
      const imbalanceThreshold = config.manipulator.volume_imbalance_up.imbalanceThreshold;
      
      if (orderBookAnalysis.type === 'buy_dominant' && orderBookAnalysis.ratio >= imbalanceThreshold) {
        console.log(`매수 우위 불균형 감지 (${orderBookAnalysis.ratio.toFixed(2)} >= ${imbalanceThreshold}), 상승 전략 강화`);
        // 매수 우위가 강하면 목표 가격 상향 조정
        this.targetPrice = this.targetPrice * 1.2;
      }
      
      console.log(`목표 가격 설정: ${this.targetPrice} (현재 대비 ${((this.targetPrice - initialPrice) / initialPrice * 100).toFixed(2)}% 상승)`);
    });
    
    // 2단계: 전략 실행
    await this.executePhase('volume_imbalance_up', 'execute', async () => {
      const currentPrice = this.latestData.stockInfo.price;
      const tickSize = getTickSize(currentPrice);
      
      // 호가창 데이터 재분석
      const orderBookAnalysis = this.analyzeOrderBookImbalance();
      let executeFactor = 1;
      
      if (orderBookAnalysis && orderBookAnalysis.type === 'buy_dominant') {
        // 매수 우위 시장에서는 더 적극적인 실행
        executeFactor = Math.min(orderBookAnalysis.ratio, 2);
        console.log(`매수 우위 시장 감지: 실행 강도 ${executeFactor.toFixed(2)}배 증가`);
      }
      
      // 목표 가격까지 도달하기 위한 매수 단계 계산
      const priceDiff = this.targetPrice - currentPrice;
      const steps = Math.max(5, Math.ceil(priceDiff / tickSize)); // 최소 5단계
      
      console.log(`목표 가격 ${this.targetPrice}까지 ${steps}단계에 걸쳐 매수 실행`);
      
      // 매수 주문 실행
      for (let i = 0; i < steps; i++) {
        // 현재 가격 확인
        const updatedPrice = this.latestData.stockInfo.price;
        
        // 목표 가격에 도달했는지 확인
        if (updatedPrice >= this.targetPrice) {
          console.log(`목표 가격 ${this.targetPrice}에 도달했습니다. 현재 가격: ${updatedPrice}`);
          break;
        }
        
        // 매수 가격 계산 (현재 가격에서 점점 높게)
        const buyPrice = updatedPrice + (priceDiff * (i + 1) / steps);
        const roundedPrice = Math.round(buyPrice / tickSize) * tickSize;
        
        // 매수 수량 계산 (단계가 진행될수록 수량 증가)
        const quantityFactor = 1 + (i / steps);
        const quantity = Math.floor(this.adjustQuantityByIntensity(getRandomInt(
          config.manipulator.volume_imbalance_up.orderSize.min,
          config.manipulator.volume_imbalance_up.orderSize.max
        )) * executeFactor * quantityFactor);
        
        await placeOrder(true, roundedPrice, quantity);
        this.recordOrder(true, roundedPrice, quantity);
        
        console.log(`매수 단계 ${i + 1}/${steps}: 가격=${roundedPrice}, 수량=${quantity}, 목표까지=${(this.targetPrice - roundedPrice).toFixed(2)}`);
        
        await delay(getRandomInt(
          config.manipulator.orderInterval.min,
          config.manipulator.orderInterval.max
        ));
        
        // 가격 변화 모니터링을 위해 추가 대기
        if (i % 2 === 0) {
          console.log(`가격 변화 모니터링 중... 현재 가격: ${this.latestData.stockInfo.price}`);
          await delay(getRandomInt(500, 1000));
        }
      }
      
      // 최종 상태 확인
      const finalPrice = this.latestData.stockInfo.price;
      console.log(`전략 실행 완료. 초기 가격: ${initialPrice}, 목표 가격: ${this.targetPrice}, 최종 가격: ${finalPrice}`);
      console.log(`목표 달성률: ${Math.min(100, Math.max(0, (finalPrice - initialPrice) / (this.targetPrice - initialPrice) * 100)).toFixed(2)}%`);
    });
    
    console.log('호가 불균형 상승 전략 완료');
  }
  
  // 호가 불균형 활용 하락 전략 (새로운 전략)
  async executeVolumeImbalanceDown() {
    console.log('호가 불균형 하락 전략 시작');
    
    // 현재 가격 저장
    const initialPrice = this.latestData.stockInfo.price;
    
    // 1단계: 호가창 분석
    await this.executePhase('volume_imbalance_down', 'analyze', async () => {
      // 호가창 데이터 분석
      const orderBookAnalysis = this.analyzeOrderBookImbalance();
      
      if (!orderBookAnalysis) {
        console.log('호가창 데이터 분석 실패, 기본 전략 사용');
        return;
      }
      
      console.log(`호가 불균형 분석 결과: ${orderBookAnalysis.type}, 비율: ${orderBookAnalysis.ratio.toFixed(2)}`);
      
      // 목표 가격 계산
      this.targetPrice = this.calculateTargetPrice(initialPrice, 'volume_imbalance_down');
      
      // 매수/매도 불균형 임계값 설정
      const imbalanceThreshold = config.manipulator.volume_imbalance_down.imbalanceThreshold;
      
      if (orderBookAnalysis.type === 'sell_dominant' && orderBookAnalysis.ratio >= imbalanceThreshold) {
        console.log(`매도 우위 불균형 감지 (${orderBookAnalysis.ratio.toFixed(2)} >= ${imbalanceThreshold}), 하락 전략 강화`);
        // 매도 우위가 강하면 목표 가격 하향 조정
        const targetDropPercent = this.adjustPriceTargetByIntensity(getRandomFloat(
          config.manipulator.volume_imbalance_down.targetDropPercent.min,
          config.manipulator.volume_imbalance_down.targetDropPercent.max
        )) / 100 * 1.2; // 20% 더 강한 하락 목표
        
        this.targetPrice = initialPrice * (1 - targetDropPercent);
      }
      
      console.log(`목표 가격 설정: ${this.targetPrice} (현재 대비 ${((this.targetPrice - initialPrice) / initialPrice * 100).toFixed(2)}% 하락)`);
    });
    
    // 2단계: 전략 실행
    await this.executePhase('volume_imbalance_down', 'execute', async () => {
      const currentPrice = this.latestData.stockInfo.price;
      const tickSize = getTickSize(currentPrice);
      
      // 호가창 데이터 재분석
      const orderBookAnalysis = this.analyzeOrderBookImbalance();
      let executeFactor = 1;
      
      if (orderBookAnalysis && orderBookAnalysis.type === 'sell_dominant') {
        // 매도 우위 시장에서는 더 적극적인 실행
        executeFactor = Math.min(orderBookAnalysis.ratio, 2);
        console.log(`매도 우위 시장 감지: 실행 강도 ${executeFactor.toFixed(2)}배 증가`);
      }
      
      // 목표 가격까지 도달하기 위한 매도 단계 계산
      const priceDiff = currentPrice - this.targetPrice;
      const steps = Math.max(5, Math.ceil(priceDiff / tickSize)); // 최소 5단계
      
      console.log(`목표 가격 ${this.targetPrice}까지 ${steps}단계에 걸쳐 매도 실행`);
      
      // 매도 주문 실행
      for (let i = 0; i < steps; i++) {
        // 현재 가격 확인
        const updatedPrice = this.latestData.stockInfo.price;
        
        // 목표 가격에 도달했는지 확인
        if (updatedPrice <= this.targetPrice) {
          console.log(`목표 가격 ${this.targetPrice}에 도달했습니다. 현재 가격: ${updatedPrice}`);
          break;
        }
        
        // 매도 가격 계산 (현재 가격에서 점점 낮게)
        const sellPrice = updatedPrice - (priceDiff * (i + 1) / steps);
        const roundedPrice = Math.round(sellPrice / tickSize) * tickSize;
        
        // 매도 수량 계산 (단계가 진행될수록 수량 증가)
        const quantityFactor = 1 + (i / steps);
        const quantity = Math.floor(this.adjustQuantityByIntensity(getRandomInt(
          config.manipulator.volume_imbalance_down.orderSize.min,
          config.manipulator.volume_imbalance_down.orderSize.max
        )) * executeFactor * quantityFactor);
        
        await placeOrder(false, roundedPrice, quantity);
        this.recordOrder(false, roundedPrice, quantity);
        
        console.log(`매도 단계 ${i + 1}/${steps}: 가격=${roundedPrice}, 수량=${quantity}, 목표까지=${(roundedPrice - this.targetPrice).toFixed(2)}`);
        
        await delay(getRandomInt(
          config.manipulator.orderInterval.min,
          config.manipulator.orderInterval.max
        ));
        
        // 가격 변화 모니터링을 위해 추가 대기
        if (i % 2 === 0) {
          console.log(`가격 변화 모니터링 중... 현재 가격: ${this.latestData.stockInfo.price}`);
          await delay(getRandomInt(500, 1000));
        }
      }
      
      // 최종 상태 확인
      const finalPrice = this.latestData.stockInfo.price;
      console.log(`전략 실행 완료. 초기 가격: ${initialPrice}, 목표 가격: ${this.targetPrice}, 최종 가격: ${finalPrice}`);
      console.log(`목표 달성률: ${Math.min(100, Math.max(0, (initialPrice - finalPrice) / (initialPrice - this.targetPrice) * 100)).toFixed(2)}%`);
    });
    
    console.log('호가 불균형 하락 전략 완료');
  }
  
  // 단계 실행 헬퍼 함수
  async executePhase(strategy, phase, action) {
    this.currentPhase = phase;
    this.phaseStartTime = Date.now();
    
    // 단계 지속 시간 설정
    this.phaseDuration = getRandomInt(
      config.manipulator[strategy].phaseDuration.min,
      config.manipulator[strategy].phaseDuration.max
    );
    
    console.log(`${strategyNames[strategy]} 전략 ${phaseNames[phase]} 단계 시작 (${this.phaseDuration / 1000}초 동안 실행)`);
    
    // 단계 액션 실행
    await action();
    
    console.log(`${strategyNames[strategy]} 전략 ${phaseNames[phase]} 단계 완료`);
  }
  
  // 주문 기록
  recordOrder(isBuy, price, quantity) {
    this.orderHistory.push({
      type: isBuy ? 'buy' : 'sell',
      price,
      quantity,
      timestamp: Date.now()
    });
    
    // 보유량 및 평균 가격 업데이트
    if (isBuy) {
      const oldValue = this.holdings * this.averagePrice;
      this.holdings += quantity;
      this.averagePrice = (oldValue + (price * quantity)) / this.holdings;
    } else {
      // 매도 시 손익 계산
      if (this.holdings > 0) {
        const sellQuantity = Math.min(quantity, this.holdings);
        this.profitLoss += sellQuantity * (price - this.averagePrice);
        this.holdings -= sellQuantity;
        
        // 모든 보유량을 매도한 경우
        if (this.holdings === 0) {
          this.averagePrice = 0;
        }
      }
    }
  }
  
  // 결과 출력
  printResults() {
    console.log('\n===== 세력 조작 결과 =====');
    console.log(`총 주문 수: ${this.orderHistory.length}`);
    console.log(`매수 주문: ${this.orderHistory.filter(o => o.type === 'buy').length}`);
    console.log(`매도 주문: ${this.orderHistory.filter(o => o.type === 'sell').length}`);
    console.log(`현재 보유량: ${this.holdings}`);
    console.log(`평균 매수 가격: ${this.averagePrice.toFixed(2)}`);
    console.log(`실현 손익: ${this.profitLoss.toFixed(2)}`);
    
    if (this.holdings > 0) {
      const currentPrice = this.latestData.stockInfo.price;
      const unrealizedPL = this.holdings * (currentPrice - this.averagePrice);
      console.log(`미실현 손익: ${unrealizedPL.toFixed(2)}`);
      console.log(`총 손익: ${(this.profitLoss + unrealizedPL).toFixed(2)}`);
    } else {
      console.log(`총 손익: ${this.profitLoss.toFixed(2)}`);
    }
    
    console.log(`상승 전략 실행 횟수: ${this.strategyStats.bullish}`);
    console.log(`하락 전략 실행 횟수: ${this.strategyStats.bearish}`);
    console.log('==========================\n');
  }
}

// 메인 함수
async function main() {
  const manipulator = new MarketManipulator();
  
  // 초기화
  await manipulator.initialize();
  
  // 목표 가격 또는 비율 설정 예시 (선택적)
  // manipulator.setTargetPrice(45000); // 직접 가격 설정
  // manipulator.setTargetPercent(5, false); // 5% 하락 목표 설정
  
  // 세력 조작 시작
  await manipulator.start();
  
  // Ctrl+C 처리
  process.on('SIGINT', () => {
    console.log('\n프로그램 종료 중...');
    manipulator.stop();
    process.exit();
  });
}

// 프로그램 실행
main().catch(error => {
  console.error('프로그램 오류:', error);
});
