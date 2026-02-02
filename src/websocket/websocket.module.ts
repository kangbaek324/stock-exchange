import { Global, Module } from '@nestjs/common';
import { WebsocketGateway } from './websocket.gateway';
import { WebsocketMqController } from './websoket.mq.controller';

@Global()
@Module({
    controllers: [WebsocketMqController],
    providers: [WebsocketGateway],
    exports: [WebsocketGateway],
})
export class WebsocketModule {}
