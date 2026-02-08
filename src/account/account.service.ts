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
        const before_account_number = await this.prismaService.account.findFirst({
            orderBy: { createdAt: 'desc' },
            select: { accountNumber: true },
        });

        const response = await this.prismaService.account.create({
            data: {
                userId: user.id,
                accountNumber: ++before_account_number.accountNumber,
                money: 100000000,
            },
        });

        return {
            accountNumber: response.accountNumber,
            money: response.money.toString(),
        };
    }
}
