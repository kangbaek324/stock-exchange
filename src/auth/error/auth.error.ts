import { HttpStatus } from "@nestjs/common";

export const AuthError = {
    ALREADY_EXIST_NAME: {
        code: "AUTH_001",
        status: HttpStatus.CONFLICT,
        message: "이미 사용중인 이름입니다."
    },
    ALREADY_EXIST_EMAIL: {
        code: "AUTH_002",
        status: HttpStatus.CONFLICT,
        message: "이미 사용중인 이메일입니다."
    }
} as const;

export type AuthErrorKey = keyof typeof AuthError;