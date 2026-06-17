import { Global, Module } from '@nestjs/common';
import { WebsocketGateway } from './websocket.gateway';
import { EventConsumer } from './consumer/event.consumer';

@Global()
@Module({
    controllers: [EventConsumer],
    providers: [WebsocketGateway],
    exports: [WebsocketGateway],
})
export class WebsocketModule {}
