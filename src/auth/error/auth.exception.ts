import { HttpException } from '@nestjs/common';
import { AuthError, AuthErrorKey } from './auth.error';

export class AuthException extends HttpException {
  constructor(errorKey: AuthErrorKey) {
    const error = AuthError[errorKey];

    super(
      {
        message: error.message,
        errorCode: error.code,
      },
      error.status,
    );
  }
}
