import { Global, Module } from '@nestjs/common';
import { WebsocketGateway } from './websocket.gateway';
import { OrderEventConsumer } from './consumer/order-event.consumer';
import { AccountWsService } from './service/account-ws.service';
import { OrderWsService } from './service/order-ws.service';
import { StockWsService } from './service/stock-ws.service';
import { ChartWsService } from './service/chart-ws.service';

@Global()
@Module({
    controllers: [OrderEventConsumer],
    providers: [
        WebsocketGateway,
        AccountWsService,
        OrderWsService,
        StockWsService,
        ChartWsService,
    ],
    exports: [WebsocketGateway],
})
export class WebsocketModule {}
