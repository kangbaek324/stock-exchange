import { OrderType, TradingType } from '@prisma/client';

export type OrderMessage = {
    id: string;
    targetId: string | null; // 정정/취소 대상 원주문 (신규면 null)
    accountId: string;
    stockId: string;
    price: string;
    quantity: string;
    filledQuantity: string;
    orderType: OrderType;
    tradingType: TradingType;
    createdAt: string;
};
