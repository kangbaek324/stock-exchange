import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, PrismaClient, User, UserStock } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { AccountException } from './error/account.exception';
import { withDrawAccountBalanceDto } from './dto/withdraw-account-balance.dto';
import { TransferAccountBalanceDto } from './dto/transfer-account-balance.dto';
import { DepositAccountBalanceDto } from './dto/deposit-account-balance.dto copy';
import { WithdrawStockDto } from './dto/withdraw-stock.dto';
import { DepositStockDto } from './dto/deposit-stock.dto';
import { OrderException } from 'src/order/error/order.exception';
import { StockException } from 'src/stock/error/stock.exception';

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

        const account = await this.prismaService.account.findUnique({
            where: { accountNumber: accountNumber },
            select: { id: true },
        });
        if (!account) throw new AccountException('ACCOUNT_NOT_FOUND');

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

        const account = await this.prismaService.account.findUnique({
            where: { accountNumber: accountNumber },
            select: { id: true },
        });
        if (!account) throw new AccountException('ACCOUNT_NOT_FOUND');

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

    async withdrawStock(dto: WithdrawStockDto, accountNumber: number, stockId: number) {
        const amount = BigInt(dto.amount);

        await this.prismaService.$transaction(async (tx: PrismaClient) => {
            const account = await tx.account.findUnique({
                where: { accountNumber: accountNumber },
                select: { id: true },
            });
            if (!account) throw new AccountException('ACCOUNT_NOT_FOUND');

            const stock = await tx.stock.findUnique({
                where: { id: stockId },
                select: { id: true },
            });
            if (!stock) throw new StockException('STOCK_NOT_FOUND');

            const [rs] = await tx.$queryRaw<UserStock[]>`
                    SELECT account_id AS accountId, stock_id AS stockId,
                           number, can_number AS canNumber, average,
                           total_buy_amount AS totalBuyAmount
                    FROM user_stocks
                    WHERE account_id = ${account.id} AND stock_id = ${stockId}
                    FOR UPDATE
                `;

            if (!rs || rs.canNumber < amount) {
                throw new OrderException('NOT_ENOUGH_STOCK');
            }

            if (rs.canNumber === amount) {
                await tx.userStock.delete({
                    where: {
                        accountId_stockId: {
                            accountId: account.id,
                            stockId: stockId,
                        },
                    },
                });
            } else {
                await tx.userStock.update({
                    where: {
                        accountId_stockId: {
                            accountId: account.id,
                            stockId: stockId,
                        },
                    },
                    data: {
                        number: {
                            decrement: amount,
                        },
                        canNumber: {
                            decrement: amount,
                        },
                    },
                });
            }
        });
    }

    async depositStock(dto: DepositStockDto, accountNumber: number, stockId: number) {
        const amount = BigInt(dto.amount);
        const account = await this.prismaService.account.findUnique({
            where: { accountNumber: accountNumber },
            select: { id: true },
        });

        const stock = await this.prismaService.stock.findUnique({
            where: { id: stockId },
            select: { price: true },
        });
        if (!stock) throw new StockException('STOCK_NOT_FOUND');

        await this.prismaService.userStock.upsert({
            where: {
                accountId_stockId: {
                    accountId: account.id,
                    stockId: stockId,
                },
            },
            create: {
                accountId: account.id,
                stockId: stockId,
                number: amount,
                canNumber: amount,
                average: stock.price,
                totalBuyAmount: stock.price * amount,
            },
            update: {
                number: {
                    increment: amount,
                },
                canNumber: {
                    increment: amount,
                },
            },
        });
    }
}
