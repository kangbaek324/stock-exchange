# Kronex (Stock Exchange)

개발기간: 2025년 6월 ~ 2026년 3월

개발인원: 1인 개발

> 모의 주식 거래소 프로젝트입니다.

## Flow

이 서비스는 다음과 같은 사용자 플로우를 가집니다.

사용자가 주문 제출 → RabbitMQ 메시지 큐에 저장 → 매칭 서버에서 순차 처리 → 주문 체결

## 💫 Features

### Auth

- 회원가입
- 로그인

### Exchange

- 매수, 매도 주문 (지정가, 시장가)
- 주문 정정, 취소
- 체결 / 미체결 조회
- 차트 조회 (1분, 5분, 30분, 1시간, 1일)
- 호가창 조회
- 내 계좌 조회
- 송금

## 📂 Architecture

- System
  
  <img width="921" height="425" alt="image(3)" src="https://github.com/user-attachments/assets/895e4dfd-9038-4281-be77-3363866a24ce" />

- ERD
  
  <img width="872" height="975" alt="image(4)" src="https://github.com/user-attachments/assets/a3659c97-4f8a-403a-8aed-2a879bd02bcf" />

## 🛠️ Stack

### Backend

- Languages: TypeScript
- Frameworks: NestJS
- Database: MySQL
- Cache: Redis
- Message Queue: RabbitMQ

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- MySQL
- Redis
- RabbitMQ

### Installation

```bash
git clone https://github.com/KRONEX-Stock-Exchange/stock-exchange-backend.git
cd stock-exchange-backend
npm install
```

### Environment Variables

루트 디렉토리에 `.env` 파일을 생성하고 아래 변수를 설정하세요.

```env
SERVER_PORT=

DATABASE_URL=mysql://USER:PASSWORD@HOST:PORT/DB_NAME

REDIS_HOST=
REDIS_PORT=
REDIS_PASSWORD=

RABBITMQ_URL=amqp://USER:PASSWORD@HOST:PORT

ACCESS_TOKEN_SECRET=
REFRESH_TOKEN_SECRET=

WEBSOCKET_PORT=
```

### Database Setup

```bash
npx prisma migrate deploy
npm run prisma:seed
```

### Run

```bash
# 개발 모드
npm run start:dev

# 프로덕션
npm run build
npm run start:prod
```

## 📁 Repository

Mathcing Server <a href="https://github.com/KRONEX-Stock-Exchange/kronex-matching-server">here</a>
