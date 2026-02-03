import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { CustomSocket } from '../interface/custom-socket.interface';
import { Account } from '@prisma/client';
import { Server } from 'socket.io';

@Injectable()
export class AccountWsService {
    private server: Server;
    constructor(private readonly prismaService: PrismaService) {}

    setServer(server: Server) {
        this.server = server;
    }

    // @TODO 에러 CODE 정리 필요
    async onJoinAccountRoom(client: CustomSocket, accountNumber: number) {
        const error = {
            code: 'WEBSOCKET_000',
            message: '',
        };

        const userId = client.user.userId;
        let account: Account;

        if (accountNumber) {
            account = await this.prismaService.account.findUnique({
                where: { accountNumber: accountNumber },
            });
        } else {
            // AccountNumber 없이 들어온다면 첫번째로 생성한 계좌로 구독
            account = await this.prismaService.account.findFirst({
                where: { userId: userId },
                orderBy: { createdAt: 'asc' },
            });
        }

        if (!account) error.message = '존재하지 않는 계좌 입니다.';

        if (account.userId === userId) {
            client.join('accountId_' + account.id);
        } else {
            error.message = '접근 권한이 없습니다.';
        }

        if (error.message) {
            client.emit(error.code, { message: error.message });
            client.disconnect();
            return false;
        }
    }

    async updateAccountInit() {}

    async updateAccount() {}

    // 내 계좌 업데이트 내역 전송
    async accountUpdate(accountId: number) {
        const userStock = await this.prismaService.userStock.findMany({
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

        const account = await this.prismaService.account.findUnique({
            where: {
                id: accountId,
            },
        });

        let data;
        let dataArray = [];

        for (let i = 0; i < userStock.length; i++) {
            const price = await this.prismaService.stock.findUnique({
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
}
