import { HttpStatus } from '@nestjs/common';

export const StockError = {
    STOCK_NOT_FOUND: {
        code: 'STOCK_001',
        status: HttpStatus.NOT_FOUND,
        message: '존재하지 않는 종목코드입니다.',
    },
    STOCK_ALREADY_EXIST: {
        code: 'STOCK_002',
        status: HttpStatus.CONFLICT,
        message: '이미 상장된 주식입니다.',
    },
    STOCK_HISTORIES_NOT_FOUND: {
        code: 'STOCK_003',
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: '서버에 오류가 발생했습니다.',
    },
    STOCK_NOT_TRADABLE: {
        code: 'STOCK_004',
        status: HttpStatus.CONFLICT,
        message: '주문이 불가능한 주식입니다.',
    },
} as const;

export type StockErrorKey = keyof typeof StockError;
