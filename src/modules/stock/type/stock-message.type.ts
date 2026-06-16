import { StockStatus } from '@prisma/client';

export type StockMessage = {
    id: number;
    price: string;
    status: StockStatus;
};
