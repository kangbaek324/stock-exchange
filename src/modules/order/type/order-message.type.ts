import { OrderType, TradingType } from '@prisma/client';

// MQ로 push되는 order.created 메시지
export type OrderMessage = {
    id: string;
    targetId: string | null; // 정정/취소 대상 원주문 (신규면 null)
    accountId: number;
    stockId: number;
    price: string;
    quantity: string;
    filledQuantity: string;
    orderType: OrderType;
    tradingType: TradingType;
};
