import { HttpStatus } from "@nestjs/common";

export const AuthError = {
    AUTH: {
        code: "AUTH_001",
        status: HttpStatus.NOT_FOUND,
        message: "테스트 입니다."
    }
} as const;

export type AuthErrorKey = keyof typeof AuthError;