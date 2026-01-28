import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';

@Injectable()
export class AccountService {
    constructor(
        private readonly prismaService: PrismaService,
    ) {}

    async getMyAccountList(user: User) {
        let data = [];
        const accounts = await this.prismaService.account.findMany({
            where: {
                userId: user.id
            }
        });

        for(let i = 0; i < accounts.length; i++) {
            data.push(accounts[i].accountNumber);
        }

        return data;
    }

    async createAccount(user: User): Promise<unknown> {
        const before_account_number = await this.prismaService.account.findFirst({
            orderBy : { createdAt: "desc" },
            select : { accountNumber: true }
        });
        
        const response = await this.prismaService.account.create({
            data : {
                userId : user.id,
                accountNumber : ++before_account_number.accountNumber,
                money : 100000000
            }
        });

        return {
            accountNumber : response.accountNumber,
            money : response.money.toString()
        }
    }
}
