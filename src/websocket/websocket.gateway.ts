import { Logger, UseGuards } from '@nestjs/common';
import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { WsGuard } from './guard/ws.guard';
import { CustomSocket } from './interface/custom-socket.interface';
import { StockWsService } from './service/stock-ws.service';
import { OrderWsService } from './service/order-ws.service';
import { AccountWsService } from './service/account-ws.service';
import { ChartWsService } from './service/chart-ws.service';

// @TODO 방 나가기 기능 추가 해야됨
@UseGuards(WsGuard)
@WebSocketGateway(parseInt(process.env.WS_PORT), {
    namespace: '/stock',
    cors: { origin: '*' },
})
export class WebsocketGateway
    implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
    constructor(
        private readonly stockWsService: StockWsService,
        private readonly orderWsService: OrderWsService,
        private readonly accountWsService: AccountWsService,
        private readonly chartWsService: ChartWsService,
    ) {}

    @WebSocketServer() server: Server;
    private logger: Logger = new Logger('websocketGateway');

    afterInit(server: Server) {
        this.stockWsService.setServer(server);
        this.orderWsService.setServer(server);
        this.accountWsService.setServer(server);
        this.chartWsService.setServer(server);

        this.logger.log('Websocket server reset');
    }

    handleConnection(client: CustomSocket) {
        this.logger.log(`Client Connected : ${client.id}`);
    }

    handleDisconnect(client: CustomSocket) {
        this.logger.log(`client Disconnected : ${client.id}`);
    }

    @SubscribeMessage('joinStockRoom')
    onJoinStockRoom(
        @MessageBody() stockId: number,
        @ConnectedSocket() client: CustomSocket,
    ) {
        this.stockWsService.onJoinStockRoom(stockId, client);
    }

    @SubscribeMessage('joinStockPriceRoom')
    handleJoinStockPriceRoom(
        @MessageBody() stockId: number,
        @ConnectedSocket() client: CustomSocket,
    ) {
        this.stockWsService.onJoinStockPriceRoom(stockId, client);
    }

    @SubscribeMessage('joinAccountRoom')
    handleJoinAccountRoom(
        @ConnectedSocket() client: CustomSocket,
        @MessageBody() accountId?: number,
    ) {
        this.accountWsService.onJoinAccountRoom(client, accountId);
    }

    @SubscribeMessage('joinChartRoom')
    handleJoinChartRoom(
        @ConnectedSocket() client: CustomSocket,
        @MessageBody('stockId') stockId: number,
        @MessageBody('type') type: ChartType,
    ) {
        this.chartWsService.onJoinChartWsRoom(stockId, type, client);
    }
}
