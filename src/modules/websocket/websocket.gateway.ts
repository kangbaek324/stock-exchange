import 'dotenv/config';
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
import { AccountWsService } from './service/account-ws.service';
import { OrderWsService } from './service/order-ws.service';
import { ChartWsService } from './service/chart-ws.service';
import { ChartType } from 'src/modules/chart/type/chart-type';

@UseGuards(WsGuard)
@WebSocketGateway(parseInt(process.env.WEBSOCKET_PORT), {
    namespace: '/stock',
    cors: { origin: '*' },
})
export class WebsocketGateway
    implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
    constructor(
        private readonly stockWsService: StockWsService,
        private readonly accountWsService: AccountWsService,
        private readonly orderWsService: OrderWsService,
        private readonly chartWsService: ChartWsService,
    ) {}

    @WebSocketServer() server: Server;
    private logger: Logger = new Logger('websocketGateway');

    afterInit(server: Server) {
        this.stockWsService.setServer(server);
        this.accountWsService.setServer(server);
        this.orderWsService.setServer(server);
        this.chartWsService.setServer(server);
    }

    handleConnection(client: CustomSocket) {
        this.logger.log(`Client Connected : ${client.id}`);
    }

    handleDisconnect(client: CustomSocket) {
        this.logger.log(`client Disconnected : ${client.id}`);
    }

    @SubscribeMessage('joinStockRoom')
    async onJoinStockRoom(
        @MessageBody() stockId: number,
        @ConnectedSocket() client: CustomSocket,
    ) {
        await this.stockWsService.onJoinStockRoom(stockId, client);
    }

    @SubscribeMessage('joinStockPriceRoom')
    handleJoinStockPriceRoom(
        @MessageBody() stockId: number,
        @ConnectedSocket() client: CustomSocket,
    ) {
        this.stockWsService.onJoinStockPriceRoom(stockId, client);
    }

    @SubscribeMessage('leaveStockRoom')
    handleLeaveStockRoom(
        @MessageBody() stockId: number,
        @ConnectedSocket() client: CustomSocket,
    ) {
        this.stockWsService.onLeaveStockRoom(stockId, client);
    }

    @SubscribeMessage('leaveStockPriceRoom')
    handleLeaveStockPriceRoom(
        @MessageBody() stockId: number,
        @ConnectedSocket() client: CustomSocket,
    ) {
        this.stockWsService.onLeaveStockPriceRoom(stockId, client);
    }

    @SubscribeMessage('joinAccountRoom')
    async handleJoinAccountRoom(
        @ConnectedSocket() client: CustomSocket,
        @MessageBody() accountId?: number,
    ) {
        const resolvedAccountId = await this.accountWsService.onJoinAccountRoom(client, accountId);
        await this.orderWsService.sendOrderInit(resolvedAccountId);
    }

    @SubscribeMessage('leaveAccountRoom')
    handleLeaveAccountRoom(
        @ConnectedSocket() client: CustomSocket,
        @MessageBody() accountId: number,
    ) {
        this.accountWsService.onLeaveAccountRoom(client, accountId);
    }

    @SubscribeMessage('joinChartRoom')
    async handleJoinChartRoom(
        @ConnectedSocket() client: CustomSocket,
        @MessageBody('stockId') stockId: number,
        @MessageBody('type') type: ChartType,
        @MessageBody('from') from?: string,
    ) {
        const fromDate = from ? new Date(from) : undefined;
        await this.chartWsService.onJoinChartRoom(stockId, type, client, fromDate);
    }

    @SubscribeMessage('leaveChartRoom')
    handleLeaveChartRoom(
        @ConnectedSocket() client: CustomSocket,
        @MessageBody('stockId') stockId: number,
        @MessageBody('type') type: ChartType,
    ) {
        this.chartWsService.onLeaveChartRoom(stockId, type, client);
    }
}
