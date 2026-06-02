import { HttpStatus } from '@nestjs/common';

export const OrderError = {
    ORDER_NOT_FOUND: {
        code: 'ORDER_001',
        status: HttpStatus.NOT_FOUND,
        message: '존재 하지 않는 주문입니다.',
    },
    INVALID_ORDER_PRICE: {
        code: 'ORDER_002',
        status: HttpStatus.BAD_REQUEST,
        message: '유효하지 않은 주문 가격입니다.',
    },
    INVALID_ORDER_TICK_SIZE: {
        code: 'ORDER_003',
        status: HttpStatus.BAD_REQUEST,
        message: '유효하지 않은 호가 단위입니다.',
    },
    INVALID_ORDER_NUMBER: {
        code: 'ORDER_004',
        status: HttpStatus.BAD_REQUEST,
        message: '유효하지 않은 주문 수량 입니다.',
    },
    NOT_ENOUGH_MONEY: {
        code: 'ORDER_005',
        status: HttpStatus.CONFLICT,
        message: '예수금이 충분하지 않습니다.',
    },
    NOT_ENOUGH_STOCK: {
        code: 'ORDER_006',
        status: HttpStatus.CONFLICT,
        message: '보유 주식 수가 충분하지 않습니다.',
    },
    ALREADY_PROCESSED_ORDER: {
        code: 'ORDER_007',
        status: HttpStatus.CONFLICT,
        message: '이미 처리된 주문입니다.',
    },
    ORDER_FORBIDDEN: {
        code: 'ORDER_008',
        status: HttpStatus.FORBIDDEN,
        message: '주문에 접근할 권한이 없습니다.',
    },
    PRICE_OUT_OF_LIMIT: {
        code: 'ORDER_009',
        status: HttpStatus.BAD_REQUEST,
        message: '주문 제한 가격을 넘은 주문입니다.',
    },
    ORDER_ENQUEUE_FAILED: {
        code: 'ORDER_010',
        status: HttpStatus.SERVICE_UNAVAILABLE,
        message: '주문 접수에 실패했습니다. 잠시 후 다시 시도해주세요.',
    },
} as const;

export type OrderErrorKey = keyof typeof OrderError;
