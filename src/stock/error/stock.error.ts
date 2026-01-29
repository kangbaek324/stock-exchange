import { HttpStatus } from '@nestjs/common';

export const StockError = {
    STOCK_NOT_FOUND: {
        code: 'STOCK_001',
        status: HttpStatus.NOT_FOUND,
        message: '존재하지 않는 종목코드입니다.',
    },
} as const;

export type StockErrorKey = keyof typeof StockError;
