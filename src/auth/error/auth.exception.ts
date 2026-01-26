import { HttpException } from '@nestjs/common';
import { AuthErrorCode, AuthErrorCodeKey } from './auth.error.code';

export class AuthException extends HttpException {
  constructor(
    readonly errorCodeKey: AuthErrorCodeKey,
  ) {
    const errorCode = AuthErrorCode[errorCodeKey];

    super(
      {
        message: errorCode.message,
        error: errorCodeKey,
        statusCode: errorCode.status
      },
      errorCode.status
    );
  }
}