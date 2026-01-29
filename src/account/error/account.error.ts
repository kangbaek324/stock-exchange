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
} as const;

export type AccountErrorKey = keyof typeof AccountError;
