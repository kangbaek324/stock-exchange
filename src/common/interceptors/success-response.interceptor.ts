import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
} from '@nestjs/common';
import { map } from 'rxjs/operators';

@Injectable()
export class SuccessResponseInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler) {
        const req = context.switchToHttp().getRequest();

        return next.handle().pipe(
            map((data) => {
                const isArray = Array.isArray(data);
                const { message, ...rest } = isArray ? {} : (data ?? {});

                return {
                    success: true,
                    message: data?.message ?? '정상 처리되었습니다.',
                    data: isArray ? data : rest,
                    path: req.url,
                    timestamp: new Date().toISOString(),
                };
            }),
        );
    }
}
