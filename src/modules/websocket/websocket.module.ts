import { Global, Module } from '@nestjs/common';
import { WebsocketGateway } from './websocket.gateway';
import { EventConsumer } from './consumer/event.consumer';
import { StockWsService } from './service/stock-ws.service';
import { AccountWsService } from './service/account-ws.service';
import { OrderWsService } from './service/order-ws.service';

@Global()
@Module({
    controllers: [EventConsumer],
    providers: [WebsocketGateway, StockWsService, AccountWsService, OrderWsService],
    exports: [WebsocketGateway],
})
export class WebsocketModule {}
