# Kronex Server

Kronex 거래소의 REST API 서버입니다.

개발기간: 2025년 6월 ~ 2026년 6월

개발인원: 1인 개발

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Core APIs](#core-apis)
- [Getting Started](#getting-started)
- [Related Repositories](#related-repositories)

## Overview

Kronex는 모의 거래소 프로젝트입니다.

이 저장소는 클라이언트와 엔진 사이의 데이터를 전달하는 API Server입니다.

#### Request Flow

```text
Client
  -> API Server
  -> MySQL
  -> RabbitMQ Command Queue
  -> Kronex Engine
  -> MySQL / Event Queue

Realtime Server
  -> Client (WebSocket)
```

## Features

- JWT 기반 사용자 인증
- 계좌 개설 및 거래 계좌 관리
- 종목 상장 관리
- 매수, 매도, 정정, 취소 주문
- 지정가·시장가 주문
- 종목별 캔들 차트 데이터

## Tech Stack

| Category      | Technology    |
| ------------- | ------------- |
| Language      | TypeScript    |
| Framework     | NestJS        |
| ORM           | Prisma        |
| Database      | MySQL         |
| Message Queue | RabbitMQ      |
| Auth          | JWT, Passport |
| API Docs      | Swagger       |
| Test          | Jest          |

## Architecture

<img width="517" height="649" alt="Kronex Architecture" src="https://github.com/user-attachments/assets/be8ed93d-9791-4fb2-a4e6-020b51729d44" />

### ERD

<img width="872" height="975" alt="ERD" src="https://github.com/user-attachments/assets/a3659c97-4f8a-403a-8aed-2a879bd02bcf" />

## Core APIs

| Method | Path                            | Description    |
| ------ | ------------------------------- | -------------- |
| `POST` | `/api/accounts`                 | 계좌 개설      |
| `POST` | `/api/stocks/:id/orders/buy`    | 매수 주문 접수 |
| `POST` | `/api/stocks/:id/orders/sell`   | 매도 주문 접수 |
| `GET`  | `/api/stocks/:id/chart?type=1m` | 차트 조회      |

## Getting Started

### Prerequisites

- Node.js 20+
- MySQL
- RabbitMQ
- npm

### 1. Installation

```bash
git clone git@github.com:KRONEX-Stock-Exchange/kronex-server.git
cd kronex-server
npm install
```

### 2. Environment Variables

루트 디렉토리에 `.env` 파일을 생성하고 아래 값을 설정합니다.

```env
SERVER_PORT=3000

DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/DATABASE"
RABBITMQ_URL="amqp://USER:PASSWORD@HOST:PORT"

ACCESS_TOKEN_SECRET="access-token-secret"
REFRESH_TOKEN_SECRET="refresh-token-secret"
```

### 3. Database Setup

```bash
npx prisma migrate deploy
npm run prisma:seed
```

개발 중 schema 변경을 적용해야 한다면 migration을 생성합니다.

```bash
npx prisma migrate dev
```

### 4. Run

```bash
# development
npm run start:dev

# production
npm run build
npm run start:prod
```

## Related Repositories

| Repository | Description |
| --- | --- |
| [kronex-engine](https://github.com/KRONEX-Stock-Exchange/kronex-engine) | 원장 및 호가창을 관리하는 엔진 |
| [kronex-realtime-server](https://github.com/KRONEX-Stock-Exchange/kronex-realtime-server) | 실시간 이벤트를 전달하는 웹소켓 서버 |
