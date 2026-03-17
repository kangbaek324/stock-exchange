import { Order } from '@prisma/client';

export type OrderEventedData = {
    type: 'buy' | 'sell' | 'edit' | 'cancel';
    stock: {
        id: number;
        nextPrice: number;
    };
    updatedOrders: Order[];
    volume: number;
    matchedAt: Date;
    matchedList: { price: number; number: number }[];
    prevOrderPrice?: number;
};
