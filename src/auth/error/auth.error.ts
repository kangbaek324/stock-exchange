import { HttpStatus } from '@nestjs/common';

export const AuthError = {
    ALREADY_EXIST_NAME: {
        code: 'AUTH_001',
        status: HttpStatus.CONFLICT,
        message: '이미 사용중인 이름입니다.',
    },
    ALREADY_EXIST_EMAIL: {
        code: 'AUTH_002',
        status: HttpStatus.CONFLICT,
        message: '이미 사용중인 이메일입니다.',
    },
    INCORRECT_ID_OR_PASSWORD: {
        code: 'AUTH_003',
        status: HttpStatus.UNAUTHORIZED,
        message: '아이디 또는 비밀번호가 잘못되었습니다.',
    },
    REFRESH_TOKEN_NOT_FOUND: {
        code: 'AUTH_004',
        status: HttpStatus.UNAUTHORIZED,
        message: 'RefreshToken을 찾을 수 없습니다.',
    },
    REFRESH_TOKEN_EXPRIED: {
        code: 'AUTH_005',
        status: HttpStatus.UNAUTHORIZED,
        message: 'RefreshToken이 만료되었습니다.',
    },
} as const;

export type AuthErrorKey = keyof typeof AuthError;
