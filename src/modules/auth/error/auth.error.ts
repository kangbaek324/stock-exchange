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
    REFRESH_TOKEN_EXPIRED: {
        code: 'AUTH_005',
        status: HttpStatus.UNAUTHORIZED,
        message: 'RefreshToken이 만료되었습니다.',
    },
    REFRESH_TOKEN_IS_NULL: {
        code: 'AUTH_006',
        status: HttpStatus.BAD_REQUEST,
        message: 'RefreshToken이 누락되었습니다.',
    },
    ACCESS_TOKEN_EXPIRED: {
        code: 'AUTH_007',
        status: HttpStatus.UNAUTHORIZED,
        message: 'AccessToken이 만료되었습니다.',
    },
    ACCESS_TOKEN_INVALID: {
        code: 'AUTH_008',
        status: HttpStatus.UNAUTHORIZED,
        message: 'AccessToken이 유효하지 않습니다.',
    },
    PERMISSION_DENIED: {
        code: 'AUTH_009',
        status: HttpStatus.UNAUTHORIZED,
        message: '권한이 부족합니다.',
    },
} as const;

export type AuthErrorKey = keyof typeof AuthError;
