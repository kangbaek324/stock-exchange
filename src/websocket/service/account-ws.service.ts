import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { CustomSocket } from '../interface/custom-socket.interface';
import { Account } from '@prisma/client';
import { Server } from 'socket.io';
import { WebsocketException } from '../error/websocket.exception';
import { OrderWsService } from './order-ws.service';

@Injectable()
export class AccountWsService {
    private server: Server;
    constructor(
        private readonly prismaService: PrismaService,
        private readonly orderWsService: OrderWsService,
    ) {}

    setServer(server: Server) {
        this.server = server;
    }

    onLeaveAccountRoom(client: CustomSocket, accountId: number) {
        client.leave('accountId_' + accountId);
    }

    async onJoinAccountRoom(client: CustomSocket, accountId: number) {
        const userId = client.user.userId;
        let account: Account;

        if (accountId) {
            account = await this.prismaService.account.findUnique({
                where: { id: accountId },
            });
        } else {
            // AccountNumber 없이 들어온다면 첫번째로 생성한 계좌로 구독
            account = await this.prismaService.account.findFirst({
                where: { userId: userId },
                orderBy: { createdAt: 'asc' },
            });
        }

        if (!account) throw new WebsocketException('ACCOUNT_NOT_FOUND');
        if (account.userId != userId) throw new WebsocketException('ACCOUNT_FORBIDDEN');

        client.join('accountId_' + account.id);

        await this.updateAccount(account.id);
        await this.orderWsService.updateOrderInit(account.id);
    }

    // 내 계좌 업데이트 내역 전송
    async updateAccount(accountId: number) {
        const account = await this.prismaService.account.findUnique({
            where: {
                id: accountId,
            },
            select: {
                id: true,
                accountNumber: true,
                money: true,
                canMoney: true,
            },
        });

        const userStock = await this.prismaService.userStock.findMany({
            where: { accountId: accountId },
            select: {
                number: true,
                canNumber: true,
                average: true,
                totalBuyAmount: true,
                stocks: {
                    select: {
                        id: true,
                        name: true,
                        price: true,
                    },
                },
            },
        });

        const data = {
            account: {
                ...account,
                money: account.money.toString(),
                canMoney: account.canMoney.toString(),
            },
            userStock: userStock.map((stock) => ({
                ...stock,
                number: stock.number.toString(),
                canNumber: stock.canNumber.toString(),
                average: stock.average.toString(),
                totalBuyAmount: stock.totalBuyAmount.toString(),
                stocks: {
                    ...stock.stocks,
                    price: stock.stocks.price.toString(),
                },
            })),
        };

        this.server.to('accountId_' + accountId).emit('accountUpdated', data);
    }
}
