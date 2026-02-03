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

@UseGuards(WsGuard)
@WebSocketGateway(3003, {
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
    ) {}

    @WebSocketServer() server: Server;
    private logger: Logger = new Logger('websocketGateway');

    afterInit(server: Server) {
        this.stockWsService.setServer(server);
        this.orderWsService.setServer(server);
        this.accountWsService.setServer(server);

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

    @SubscribeMessage('joinAccountRoom')
    async handleJoinAccountRoom(
        @ConnectedSocket() client: CustomSocket,
        @MessageBody() accountNumber?: number,
    ) {
        this.accountWsService.onJoinAccountRoom(client, accountNumber);
    }
}
