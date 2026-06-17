import { Global, Module } from '@nestjs/common';
import { WebsocketGateway } from './websocket.gateway';
import { EventConsumer } from './consumer/event.consumer';
import { StockWsService } from './service/stock-ws.service';
import { AccountWsService } from './service/account-ws.service';

@Global()
@Module({
    controllers: [EventConsumer],
    providers: [WebsocketGateway, StockWsService, AccountWsService],
    exports: [WebsocketGateway],
})
export class WebsocketModule {}
