import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';

@Injectable()
export class AccountService {
    constructor(private readonly prismaService: PrismaService) {}

    async getMyAccountList(user: User) {
        const accounts = await this.prismaService.account.findMany({
            where: {
                userId: user.id,
            },
            select: { id: true, accountNumber: true, money: true },
        });

        return accounts.map((account) => {
            return {
                ...account,
                money: account.money.toString(),
            };
        });
    }

    async createAccount(user: User): Promise<unknown> {
        const account = await this.prismaService.$transaction(async (prisma) => {
            const last = await prisma.account.findFirst({
                orderBy: { accountNumber: 'desc' },
                select: { accountNumber: true },
            });

            return prisma.account.create({
                data: {
                    userId: user.id,
                    accountNumber: (last?.accountNumber ?? 10000) + 1,
                    money: 50000000n,
                    canMoney: 50000000n,
                },
            });
        });

        return {
            id: account.id,
            accountNumber: account.accountNumber,
            money: account.money.toString(),
        };
    }
}
