import { WsException } from '@nestjs/websockets';
import { WebsocketError, WebsocketErrorKey } from './websocket.error';

export class WebsocketException extends WsException {
    constructor(errorKey: WebsocketErrorKey) {
        const error = WebsocketError[errorKey];

        super({
            message: error.message,
            errorCode: error.code,
        });
    }
}