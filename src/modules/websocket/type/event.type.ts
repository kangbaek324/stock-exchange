export interface EventBatch {
    inputSeq: number;
    events: DomainEvent[];
}

// pattern으로 판별하는 discriminated union (consumer switch에서 자동 타입 좁힘)
export type DomainEvent =
    | { pattern: 'trade.executed'; data: TradeExecutedData }
    | { pattern: 'order.open'; data: OrderLifecycleData }
    | { pattern: 'order.filled'; data: OrderLifecycleData }
    | { pattern: 'order.canceled'; data: OrderLifecycleData }
    | { pattern: 'order.rejected'; data: OrderRejectedData }
    | { pattern: 'account.updated'; data: AccountBalanceData }
    | { pattern: 'account.activated'; data: AccountBalanceData }
    | { pattern: 'holding.updated'; data: HoldingUpdatedData };

export type EventName = DomainEvent['pattern'];

// trade.executed — 체결 내역
export interface TradeExecutedData {
    id: string;
    stockId: string;
    price: string;
    quantity: string;
    makerOrderId: string;
    takerOrderId: string;
    executedAt: string;
}

// order.open / order.filled / order.canceled — 주문 상태 전이
export interface OrderLifecycleData {
    orderId: string;
    accountId: string;
    stockId: string;
    price: string;
    quantity: string;
    filledQuantity: string;
}

// order.rejected — 유효성 검사 실패로 거부
export interface OrderRejectedData {
    orderId: string;
    reason: string;
}

// account.updated / account.activated — 계좌 잔고/활성화
export interface AccountBalanceData {
    id: string;
    balance: string;
    availableBalance: string;
}

// holding.updated — 보유종목 변동
export interface HoldingUpdatedData {
    accountId: string;
    stockId: string;
    quantity: string;
    availableQuantity: string;
    average: string;
    totalBuyAmount: string;
}

// stock.listed — 종목 상장/상태 변경
export interface StockListedData {
    id: string;
    price: string;
    status: 'LISTED' | 'SUSPENDED' | 'DELISTED' | 'PENDING';
}
