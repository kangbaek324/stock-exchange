import { Injectable } from '@nestjs/common';
import { Order, OrderStatus } from '@prisma/client';
import { Server } from 'socket.io';
import { getKstDate } from 'src/common/helpers/get-kst-date';
import { PrismaService } from 'src/common/prisma/prisma.service';

@Injectable()
export class OrderWsService {
    private server: Server;
    constructor(private readonly prismaService: PrismaService) {}

    setServer(server: Server) {
        this.server = server;
    }

    // 내 주문 업데이트 내역 전송
    async updateOrderInit(accountId: number) {
        let returnData = {
            executionOrder: [],
            noExecutionOrder: [],
        };

        const todayKST = getKstDate();

        let executionOrder = await this.prismaService.order.findMany({
            where: {
                accountId: accountId,
                status: OrderStatus.y,
                createdAt: { gte: todayKST },
            },
            orderBy: { createdAt: 'desc' },
            include: {
                stocks: {
                    select: {
                        name: true,
                    },
                },
            },
        });

        let noExecutionOrder = await this.prismaService.order.findMany({
            where: { accountId: accountId, status: OrderStatus.n },
            orderBy: { createdAt: 'desc' },
            include: {
                stocks: {
                    select: {
                        name: true,
                    },
                },
            },
        });

        const toOrderData = (order: (typeof executionOrder)[number]) => ({
            id: order.id,
            stockName: order.stocks.name,
            stockId: order.stockId,
            price: order.price.toString(),
            number: order.number.toString(),
            matchNumber: order.matchNumber.toString(),
            status: order.status,
            tradingType: order.tradingType,
            createAt: order.createdAt,
        });

        returnData.executionOrder = executionOrder.map(toOrderData);
        returnData.noExecutionOrder = noExecutionOrder.map(toOrderData);

        this.server.to('accountId_' + accountId).emit('orderInit', returnData);
    }

    // 특정 주문 업데이트
    async updateOrder(accountId: number, order: Order) {
        this.server.to('accountId_' + accountId).emit('orderUpdated', order);
    }
}
