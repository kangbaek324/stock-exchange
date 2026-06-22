import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { CustomSocket } from '../interface/custom-socket.interface';
import { Server } from 'socket.io';
import { WebsocketException } from '../error/websocket.exception';
import { AccountBalanceData, HoldingUpdatedData } from '../type/event.type';

@Injectable()
export class AccountWsService {
    private server: Server;
    constructor(private readonly prismaService: PrismaService) {}

    setServer(server: Server) {
        this.server = server;
    }

    private accountRoom(accountId: number) {
        return `account_${accountId}`;
    }

    // join / leave
    async onJoinAccountRoom(client: CustomSocket, accountId?: number): Promise<number> {
        const userId = client.user.userId;
        let resolvedAccountId: number;

        if (accountId) {
            const account = await this.prismaService.account.findUnique({
                where: { id: accountId },
                select: { id: true, userId: true },
            });

            if (!account) throw new WebsocketException('ACCOUNT_NOT_FOUND');
            if (account.userId !== userId)
                throw new WebsocketException('ACCOUNT_FORBIDDEN');
            resolvedAccountId = account.id;
        } else {
            // accountId 없이 들어온다면 첫번째로 생성한 계좌로 구독
            const account = await this.prismaService.account.findFirst({
                where: { userId },
                orderBy: { createdAt: 'asc' },
                select: { id: true },
            });

            if (!account) throw new WebsocketException('ACCOUNT_NOT_FOUND');
            resolvedAccountId = account.id;
        }

        client.join(this.accountRoom(resolvedAccountId));
        await this.sendAccountInit(resolvedAccountId);
        return resolvedAccountId;
    }

    onLeaveAccountRoom(client: CustomSocket, accountId: number) {
        client.leave(this.accountRoom(accountId));
    }

    // 초기 데이터 전송 (join 시 전체 계좌 + 보유 종목)
    private async sendAccountInit(accountId: number) {
        const account = await this.prismaService.account.findUnique({
            where: { id: accountId },
            select: {
                id: true,
                accountNumber: true,
                balance: true,
                availableBalance: true,
            },
        });

        const holdings = await this.prismaService.userStock.findMany({
            where: { accountId },
            select: {
                stockId: true,
                quantity: true,
                availableQuantity: true,
                average: true,
                totalBuyAmount: true,
                stock: { select: { id: true, name: true, price: true } },
            },
        });

        const data = {
            account: {
                ...account,
                balance: account.balance.toString(),
                availableBalance: account.availableBalance.toString(),
            },
            holdings: holdings.map((h) => ({
                stockId: h.stockId,
                quantity: h.quantity.toString(),
                availableQuantity: h.availableQuantity.toString(),
                average: h.average.toString(),
                totalBuyAmount: h.totalBuyAmount.toString(),
                stock: { ...h.stock, price: h.stock.price.toString() },
            })),
        };

        this.server.to(this.accountRoom(accountId)).emit('accountInit', data);
    }

    // 잔고 업데이트 (account.updated / account.activated 이벤트)
    sendAccountBalance(accountId: number, data: AccountBalanceData) {
        this.server.to(this.accountRoom(accountId)).emit('accountBalanceUpdated', {
            id: data.id,
            balance: data.balance,
            availableBalance: data.availableBalance,
        });
    }

    // 보유 종목 업데이트 (holding.updated 이벤트)
    sendHolding(accountId: number, data: HoldingUpdatedData) {
        this.server.to(this.accountRoom(accountId)).emit('holdingUpdated', {
            stockId: data.stockId,
            quantity: data.quantity,
            availableQuantity: data.availableQuantity,
            average: data.average,
            totalBuyAmount: data.totalBuyAmount,
        });
    }
}
