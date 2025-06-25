import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';

@Injectable()
export class AccountService {
    constructor(
        private readonly prismaService: PrismaService,
    ) {}

    async createAccount(user): Promise<unknown> {
        try {
            const before_account_number = await this.prismaService.accounts.findFirst({
                orderBy : { created_at: "desc" },
                select : { account_number: true }
            });
            const response = await this.prismaService.accounts.create({
                data : {
                    user_id : user.id,
                    account_number : ++before_account_number.account_number,
                    money : 100000000
                }
            });
            return {
                account_number : response.account_number,
                money : response.money.toString()
            }
        } catch (err) {
            console.log(err)
            throw new InternalServerErrorException("서버에 오류가 발생했습니다")
        }
    }
}
