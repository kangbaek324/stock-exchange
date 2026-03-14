import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { ROLES_KEY } from 'src/common/decorators/roles.decorator';
import { AuthException } from '../error/auth.exception';

@Injectable()
export class AdminGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(
        context: ExecutionContext,
    ): boolean | Promise<boolean> | Observable<boolean> {
        const requiredRole = this.reflector.getAllAndOverride(ROLES_KEY, [
            context.getHandler(),
        ]);

        const { user } = context.switchToHttp().getRequest();

        if (!requiredRole.includes(user.role))
            throw new AuthException('PERMISSION_DENIED');

        return true;
    }
}
