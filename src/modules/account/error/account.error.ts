import { HttpStatus } from '@nestjs/common';

export const AccountError = {
    ACCOUNT_NOT_FOUND: {
        code: 'ACCOUNT_001',
        status: HttpStatus.NOT_FOUND,
        message: '존재하지 않는 계좌입니다.',
    },
    ACCOUNT_FORBIDDEN: {
        code: 'ACCOUNT_002',
        status: HttpStatus.FORBIDDEN,
        message: '계좌에 접근 권한이 없습니다.',
    },
    NOT_ENOUGH_MONEY: {
        code: 'ACCOUNT_003',
        status: HttpStatus.CONFLICT,
        message: '계좌 잔액이 충분하지 않습니다.',
    },
    NOT_ALLOWED_TRANSFER_SELF: {
        code: 'ACCOUNT_004',
        status: HttpStatus.BAD_REQUEST,
        message: '같은 계좌로 송금할 수 없습니다.',
    },
} as const;

export type AccountErrorKey = keyof typeof AccountError;
