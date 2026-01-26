import { HttpStatus } from "@nestjs/common";

export const AuthErrorCode = {
    AUTH: {
        status: HttpStatus.NOT_FOUND,
        message: ""
    }
} as const;

export type AuthErrorCodeKey = keyof typeof AuthErrorCode;