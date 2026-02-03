import { Global, Module } from '@nestjs/common';
import { WebsocketGateway } from './websocket.gateway';
import { OrderEventConsumer } from './consumer/order-event.consumer';

@Global()
@Module({
    controllers: [OrderEventConsumer],
    providers: [WebsocketGateway],
    exports: [WebsocketGateway],
})
export class WebsocketModule {}
