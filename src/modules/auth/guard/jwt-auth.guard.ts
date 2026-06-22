import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TokenExpiredError } from '@nestjs/jwt';
import { AuthException } from '../error/auth.exception';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
        if (info instanceof TokenExpiredError) {
            throw new AuthException('ACCESS_TOKEN_EXPIRED');
        }

        if (err || !user) {
            throw new AuthException('ACCESS_TOKEN_INVALID');
        }

        return user;
    }
}
