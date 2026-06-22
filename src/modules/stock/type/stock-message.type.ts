import { StockStatus } from '@prisma/client';

export type StockMessage = {
    id: string;
    price: string;
    status: StockStatus;
};
