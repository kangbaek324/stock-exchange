import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaClient, User } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { AccountException } from './error/account.exception';
import { withDrawAccountBalanceDto } from './dto/withdraw-account-balance.dto';
import { TransferAccountBalanceDto } from './dto/transfer-account-balance.dto';
import { DepositAccountBalanceDto } from './dto/deposit-account-balance.dto copy';

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

            let amount = 5000000n;
            const isExistUserAccount = await this.prismaService.account.findFirst({
                where: { userId: user.id },
                select: { id: true },
            });
            if (isExistUserAccount) amount = 0n;

            return prisma.account.create({
                data: {
                    userId: user.id,
                    accountNumber: (last?.accountNumber ?? 10000) + 1,
                    money: amount,
                    canMoney: amount,
                },
            });
        });

        return {
            id: account.id,
            accountNumber: account.accountNumber,
            money: account.money.toString(),
        };
    }

    async transferAccountBalance(
        user: User,
        dto: TransferAccountBalanceDto,
        accountNumber: number,
    ) {
        const amount = BigInt(dto.amount);
        const senderAccountNumber = accountNumber;
        const receiverAccountNumber = dto.toAccountNumber;

        if (senderAccountNumber > 99999) throw new BadRequestException();

        if (senderAccountNumber === receiverAccountNumber)
            throw new AccountException('NOT_ALLOWED_TRANSFER_SELF');

        // 출입금 계좌 검증
        const senderAccount = await this.prismaService.account.findUnique({
            where: {
                accountNumber: senderAccountNumber,
            },
        });

        if (!senderAccount) throw new AccountException('ACCOUNT_NOT_FOUND');
        else if (senderAccount.userId !== user.id)
            throw new AccountException('ACCOUNT_FORBIDDEN');

        const receiverAccount = await this.prismaService.account.findUnique({
            where: {
                accountNumber: receiverAccountNumber,
            },
            select: {
                id: true,
            },
        });

        if (!receiverAccount) throw new AccountException('ACCOUNT_NOT_FOUND');

        // 송금 실행
        await this.prismaService.$transaction(async (tx: PrismaClient) => {
            const senderAccountUpdated = await tx.account.updateMany({
                where: {
                    accountNumber: senderAccountNumber,
                    money: { gte: amount },
                    canMoney: { gte: amount },
                },
                data: {
                    money: { decrement: amount },
                    canMoney: { decrement: amount },
                },
            });

            if (senderAccountUpdated.count === 0) {
                throw new AccountException('NOT_ENOUGH_MONEY');
            }

            await tx.account.update({
                where: { accountNumber: receiverAccountNumber },
                data: {
                    money: { increment: amount },
                    canMoney: { increment: amount },
                },
            });
        });

        return {
            message: '정상 처리되었습니다.',
        };
    }

    async depositAccountBalance(dto: DepositAccountBalanceDto, accountNumber: number) {
        const amount = dto.amount;

        await this.prismaService.account.update({
            where: { accountNumber: accountNumber },
            data: {
                money: {
                    increment: amount,
                },
                canMoney: {
                    increment: amount,
                },
            },
        });
    }

    async withdrawAccountBalance(dto: withDrawAccountBalanceDto, accountNumber: number) {
        const amount = dto.amount;

        await this.prismaService.account.update({
            where: { accountNumber: accountNumber },
            data: {
                money: {
                    decrement: amount,
                },
                canMoney: {
                    decrement: amount,
                },
            },
        });
    }
}
