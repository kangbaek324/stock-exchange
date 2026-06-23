import { Injectable } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { Server } from 'socket.io';
import { getUtcMidnight } from 'src/common/helpers/get-utc-midnight';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { hasRoomMembers } from './socket-room.util';

@Injectable()
export class OrderWsService {
    private server: Server;

    constructor(private readonly prismaService: PrismaService) {}

    setServer(server: Server) {
        this.server = server;
    }

    private accountRoom(accountId: number) {
        return `account_${accountId}`;
    }

    // 초기 데이터 전송 (join 시 미체결 + 당일 체결)
    async sendOrderInit(accountId: number) {
        await Promise.all([
            this.sendOpenOrders(accountId),
            this.sendFilledOrders(accountId),
        ]);
    }

    // 미체결 주문 전송
    async sendOpenOrders(accountId: number) {
        if (!hasRoomMembers(this.server, this.accountRoom(accountId))) return;

        const orders = await this.prismaService.order.findMany({
            where: { accountId, status: OrderStatus.OPEN },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                stockId: true,
                price: true,
                quantity: true,
                filledQuantity: true,
                orderType: true,
                tradingType: true,
                status: true,
                createdAt: true,
                stock: { select: { name: true } },
            },
        });

        const data = orders.map((o) => ({
            id: o.id.toString(),
            stockId: o.stockId,
            stockName: o.stock.name,
            price: o.price.toString(),
            quantity: o.quantity.toString(),
            filledQuantity: o.filledQuantity.toString(),
            orderType: o.orderType,
            tradingType: o.tradingType,
            status: o.status,
            createdAt: o.createdAt,
        }));

        this.server.to(this.accountRoom(accountId)).emit('openOrdersUpdated', data);
    }

    // 당일 체결 내역 전송 (부분 체결 포함)
    async sendFilledOrders(accountId: number) {
        if (!hasRoomMembers(this.server, this.accountRoom(accountId))) return;

        const today = getUtcMidnight();

        const orders = await this.prismaService.order.findMany({
            where: {
                accountId,
                filledQuantity: { gt: 0 },
                createdAt: { gte: today },
            },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                stockId: true,
                price: true,
                quantity: true,
                filledQuantity: true,
                orderType: true,
                tradingType: true,
                status: true,
                createdAt: true,
                stock: { select: { name: true } },
            },
        });

        const data = orders.map((o) => ({
            id: o.id.toString(),
            stockId: o.stockId,
            stockName: o.stock.name,
            price: o.price.toString(),
            quantity: o.quantity.toString(),
            filledQuantity: o.filledQuantity.toString(),
            orderType: o.orderType,
            tradingType: o.tradingType,
            status: o.status,
            createdAt: o.createdAt,
        }));

        this.server.to(this.accountRoom(accountId)).emit('filledOrdersUpdated', data);
    }
}
