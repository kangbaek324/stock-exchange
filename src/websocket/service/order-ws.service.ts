import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { PrismaService } from 'src/common/prisma/prisma.service';

@Injectable()
export class OrderWsService {
    private server: Server;
    constructor(private readonly prismaService: PrismaService) {}

    setServer(server: Server) {
        this.server = server;
    }

    // 내 주문 업데이트 내역 전송
    public async orderStatus(accountId: number) {
        let returnData = {
            executionOrder: [],
            noExecutionOrder: [],
        };

        let executionOrder = await this.prismaService.order.findMany({
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

        let noExecutionOrder = await this.prismaService.order.findMany({
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
