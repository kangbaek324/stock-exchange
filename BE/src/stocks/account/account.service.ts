import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';

@Injectable()
export class AccountService {
    constructor(
        private readonly prismaService: PrismaService,
    ) {}

    async getMyAccountList(user) {
        let data = [];
        const accounts = await this.prismaService.accounts.findMany({
            where: {
                userId: user.id
            }
        });

        for(let i = 0; i < accounts.length; i++) {
            data.push(accounts[i].accountNumber);
        }

        return data;
    }

    async createAccount(user): Promise<unknown> {
        try {
            const before_account_number = await this.prismaService.accounts.findFirst({
                orderBy : { createdAt: "desc" },
                select : { accountNumber: true }
            });
            const response = await this.prismaService.accounts.create({
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
        } catch (err) {
            console.log(err)
            throw new InternalServerErrorException("서버에 오류가 발생했습니다")
        }
    }
}
