import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { ExceptionResponse } from 'src/common/error/exception-response.type';
import { CustomSocket } from 'src/modules/websocket/interface/custom-socket.interface';

@Catch(WsException)
export class WsExceptionFilter implements ExceptionFilter {
    catch(exception: WsException, host: ArgumentsHost) {
        const client = host.switchToWs().getClient<CustomSocket>();
        const error = exception.getError();

        let message = 'Internal server error';
        let errorCode = 'UNKNOWN';

        if (typeof error === 'object' && error !== null) {
            const r = error as Partial<ExceptionResponse>;

            message = r.message ?? message;
            errorCode = r.errorCode ?? errorCode;
        } else if (typeof error === 'string') {
            message = error;
        }

        client.emit('exception', {
            errorCode,
            message,
        });

        client.disconnect();
    }
}
