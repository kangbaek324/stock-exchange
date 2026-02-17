import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Request, Response } from 'express';
import { ExceptionResponse } from '../error/exception-response.type';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        let status = 500;
        let message = 'Internal server error';
        let errorCode = 'UNKNOWN';

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const res = exception.getResponse();

            // Res을 String으로 반환할 수도 있기 때문에 타입 분기
            if (typeof res === 'object' && res !== null) {
                const r = res as Partial<ExceptionResponse>;

                message = r.message ?? message;
                errorCode = r.errorCode ?? errorCode;
            } else if (typeof res === 'string') {
                message = res;
            }
        } else {
            // 500
            console.error(exception);
        }

        response.status(status).json({
            success: false,
            error: {
                errorCode,
                message,
            },
            path: request.url,
            timestamp: new Date().toISOString(),
        });
    }
}
