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
import { PrismaService } from 'src/common/prisma/prisma.service';
import { WsGuard } from './guard/ws.guard';
import { CustomSocket } from './interfaces/custom-socket.interface';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

interface userInfo {
    userId: number;
    accountId: number;
}

const clientInfo = new Map<string, userInfo>(); // clientId : userInfo
const clientJoinStockRoom = new Map<string, number>(); // clientId : stockId

/**
 * 방 종류
 *
 * stockId_? // 특정 종목에 대한 정보를 보내주는 방
 * accountId_? // 특정 계좌에 대한 정보를 보내주는 방
 *
 */

@UseGuards(WsGuard)
@WebSocketGateway(3003, {
    namespace: '/stock',
    cors: { origin: '*' },
})
export class WebsocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    constructor(private readonly prisma: PrismaService) {}

    @WebSocketServer() server: Server;
    private logger: Logger = new Logger('websocketGateway');

    afterInit(server: Server) {
        this.logger.log('Websocket server reset');
    }

    handleConnection(client: CustomSocket) {
        this.logger.log(`Client Connected : ${client.id}`);
    }

    handleDisconnect(client: CustomSocket) {
        this.logger.log(`client Disconnected : ${client.id}`);
        if (clientInfo.get(client.id)) {
            clientInfo.delete(client.id);
        }

        if (clientJoinStockRoom.get(client.id)) {
            clientJoinStockRoom.delete(client.id);
        }
    }

    @SubscribeMessage('joinStockRoom')
    handleJoinStockRoom(@MessageBody() stockId: number, @ConnectedSocket() client: CustomSocket) {
        const stockIdToString = stockId.toString();

        if (clientJoinStockRoom.get(client.id)) {
            client.leave('stockId_' + clientJoinStockRoom.get(client.id));
            clientJoinStockRoom.delete(client.id);
        }
        client.join('stockId_' + stockIdToString);
        clientJoinStockRoom.set(client.id, stockId);
        this.stockUpdate(stockId);
    }

    @SubscribeMessage('joinAccountRoom')
    async handleJoinAccountRoom(
        @ConnectedSocket() client: CustomSocket,
        @MessageBody() accountNumber?: number,
    ) {
        const userId = client.user.userId;

        // 다른 계좌로 변경할때
        if (clientInfo.get(client.id)) {
            if (!accountNumber) {
                client.emit('errorCustom', { message: '인자 값이 누락되었습니다' });
                client.disconnect();
                return false;
            } else {
                const account = await this.prisma.account.findUnique({
                    where: { accountNumber: accountNumber },
                });

                if (!account) {
                    client.emit('errorCustom', { message: '존재하지 않는 계좌입니다' });
                    client.disconnect();
                    return false;
                }

                if (account.userId == userId) {
                    client.leave('accountId_' + clientInfo.get(client.id).accountId);
                    client.join('accountId_' + account.id);
                    clientInfo.set(client.id, { userId: userId, accountId: account.id });
                    this.accountUpdate(account.id);
                    this.orderStatus(account.id);
                } else {
                    client.emit('errorCustom', { message: '접근 권한이 없습니다' });
                    client.disconnect();
                    return false;
                }
            }
        } else {
            // 최초 연결시 가장 처음 생성한 계좌를 기본계좌로 세팅
            const basicAccount = await this.prisma.account.findFirst({
                where: { userId: userId },
                orderBy: { createdAt: 'asc' },
            });

            if (!basicAccount) {
                client.emit('errorCustom', { message: '계좌 개설후 이용해주세요' });
            } else {
                clientInfo.set(client.id, { userId: userId, accountId: basicAccount.id });
                client.join('accountId_' + basicAccount.id);
                this.accountUpdate(basicAccount.id);
                this.orderStatus(basicAccount.id);
            }
        }
    }

    // 주식 가격 업데이트 내역 전송
    // @TODO 호가창 전송하는 부분 Redis 적용하기
    public async stockUpdate(stockId: number) {
        const stockIdToString = stockId.toString();
        const today = dayjs().utc().format('YYYY-MM-DD');
        const yesterday = dayjs().utc().subtract(1, 'day').format('YYYY-MM-DD');
        let data = {};

        const stockInfoDB = await this.prisma.stock.findUnique({
            where: {
                id: stockId,
            },
            select: {
                name: true,
                price: true,
            },
        });

        const stockInfo = {
            name: stockInfoDB.name,
            price: stockInfoDB.price.toString(),
        };

        let previousClose;
        const previousCloseDB = await this.prisma.stockHistory.findUnique({
            where: {
                stockId_date: {
                    stockId: stockId,
                    date: new Date(yesterday),
                },
            },
            select: {
                close: true,
            },
        });
        if (previousCloseDB) previousClose = previousCloseDB.close.toString();
        else throw new Error('stock have not stockHistory');

        let stockHistoryDB = await this.prisma.stockHistory.findUnique({
            where: { stockId_date: { stockId, date: new Date(today) } },
        });

        if (!stockHistoryDB) {
            stockHistoryDB = await this.prisma.stockHistory.create({
                data: {
                    stockId: stockId,
                    date: new Date(today),
                    low: previousClose,
                    high: previousClose,
                    close: previousClose,
                    open: previousClose,
                },
            });
        }

        const stockHistory = {
            stockId: stockHistoryDB.stockId,
            data: new Date(today),
            low: stockHistoryDB.low.toString(),
            high: stockHistoryDB.high.toString(),
            close: stockHistoryDB.close.toString(),
            open: stockHistoryDB.open.toString(),
        };

        let buyOrderbookData: any[] = await this.prisma.$queryRaw`
      SELECT trading_type, price, SUM(number - match_number) AS number
      FROM \`order\` o
      WHERE stock_id = ${stockId} AND trading_type = "buy" AND status = "n" 
      GROUP BY trading_type, price
      ORDER BY price DESC
      LIMIT 10
    `;

        let sellOrderbookData: any[] = await this.prisma.$queryRaw`
      SELECT trading_type, price, SUM(number - match_number) AS number
      FROM \`order\` o
      WHERE stock_id = ${stockId} AND trading_type = "sell" AND status = "n" 
      GROUP BY trading_type, price
      ORDER BY price ASC
      LIMIT 10
    `;

        let matchData: any[] = await this.prisma.$queryRaw`
      select (select price from \`order\` o where o.id = om.initial_order_id) as price, number, (select trading_type from \`order\` o where o.id = om.order_id) as type
      from order_match om where stock_id = ${stockId}
      order by matched_at desc limit 20;
    `;

        for (let i = 0; i < buyOrderbookData.length; i++) {
            buyOrderbookData[i].price = buyOrderbookData[i].price.toString();
        }

        for (let i = 0; i < sellOrderbookData.length; i++) {
            sellOrderbookData[i].price = sellOrderbookData[i].price.toString();
        }

        for (let i = 0; i < matchData.length; i++) {
            matchData[i].price = matchData[i].price.toString();
            matchData[i].number = matchData[i].number.toString();
        }

        data = {
            stockInfo: stockInfo,
            stockHistory: stockHistory,
            previousClose: previousClose,
            buyOrderbookData: buyOrderbookData,
            sellOrderbookData: sellOrderbookData,
            match: matchData,
        };

        this.server.to('stockId_' + stockIdToString).emit('stockUpdated', data);
    }

    // 내 계좌 업데이트 내역 전송
    public async accountUpdate(accountId: number) {
        const userStock = await this.prisma.userStock.findMany({
            where: { accountId: accountId },
            select: {
                stockId: true,
                number: true,
                canNumber: true,
                average: true,
                totalBuyAmount: true,
                stocks: {
                    select: {
                        name: true,
                    },
                },
            },
        });

        const account = await this.prisma.account.findUnique({
            where: {
                id: accountId,
            },
        });

        let data;
        let dataArray = [];

        for (let i = 0; i < userStock.length; i++) {
            const price = await this.prisma.stock.findUnique({
                where: { id: userStock[i].stockId },
                select: { price: true },
            });
            data = {
                name: userStock[i].stocks.name,
                nowPrice: price.price.toString(),
                amount: userStock[i].number.toString(),
                canAmount: userStock[i].canNumber.toString(),
                average: userStock[i].average.toString(),
                totalBuyAmount: userStock[i].totalBuyAmount.toString(),
            };
            dataArray.push(data);
        }

        dataArray.push({ money: account.money.toString() });

        this.server.to('accountId_' + accountId).emit('accountUpdated', dataArray);
    }

    // 내 주문 업데이트 내역 전송
    public async orderStatus(accountId: number) {
        let returnData = {
            executionOrder: [],
            noExecutionOrder: [],
        };

        let executionOrder = await this.prisma.order.findMany({
            where: { accountId: accountId, status: 'y' },
            orderBy: { createdAt: 'desc' },
            include: {
                stocks: {
                    select: {
                        name: true,
                    },
                },
            },
            take: 10,
        });

        let noExecutionOrder = await this.prisma.order.findMany({
            where: { accountId: accountId, status: 'n' },
            orderBy: { createdAt: 'desc' },
            include: {
                stocks: {
                    select: {
                        name: true,
                    },
                },
            },
        });

        for (let i = 0; i < executionOrder.length; i++) {
            let data = {
                id: executionOrder[i].id,
                stockName: executionOrder[i].stocks.name,
                stockId: executionOrder[i].stockId,
                price: executionOrder[i].price.toString(),
                number: executionOrder[i].number.toString(),
                matchNumber: executionOrder[i].matchNumber.toString(),
                status: executionOrder[i].status,
                tradingType: executionOrder[i].tradingType,
            };

            returnData.executionOrder.push(data);
        }

        for (let i = 0; i < noExecutionOrder.length; i++) {
            let data = {
                id: noExecutionOrder[i].id,
                stockName: noExecutionOrder[i].stocks.name,
                stockId: noExecutionOrder[i].stockId,
                price: noExecutionOrder[i].price.toString(),
                number: noExecutionOrder[i].number.toString(),
                matchNumber: noExecutionOrder[i].matchNumber.toString(),
                status: noExecutionOrder[i].status,
                tradingType: noExecutionOrder[i].tradingType,
            };

            returnData.noExecutionOrder.push(data);
        }

        this.server.to('accountId_' + accountId).emit('myOrderUpdated', returnData);
    }
}
