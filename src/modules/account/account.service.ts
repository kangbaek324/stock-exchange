import { Inject, BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AccountStatus, Prisma, User, UserStock } from '@prisma/client';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom, retry, timer } from 'rxjs';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { AccountException } from './error/account.exception';
import { withDrawAccountBalanceDto } from './dto/withdraw-account-balance.dto';
import { TransferAccountBalanceDto } from './dto/transfer-account-balance.dto';
import { DepositAccountBalanceDto } from './dto/deposit-account-balance.dto copy';
import { WithdrawStockDto } from './dto/withdraw-stock.dto';
import { DepositStockDto } from './dto/deposit-stock.dto';
import { OrderException } from 'src/modules/order/error/order.exception';
import { StockException } from 'src/modules/stock/error/stock.exception';
import { AccountMessage } from './type/account-message.type';
import { DATA_SERVICE } from 'src/common/messaging/messaging.module';

// account.created 발행에 필요한 필드
const ACCOUNT_MESSAGE_SELECT = {
    id: true,
    balance: true,
    availableBalance: true,
} satisfies Prisma.AccountSelect;

type PublishableAccount = Prisma.AccountGetPayload<{
    select: typeof ACCOUNT_MESSAGE_SELECT;
}>;

const PUBLISH_RETRY = {
    count: 3,
    delay: (_err: unknown, n: number) => timer(100 * 2 ** n),
};

@Injectable()
export class AccountService {
    private readonly logger = new Logger(AccountService.name);

    constructor(
        @Inject(DATA_SERVICE) private client: ClientProxy,
        private readonly prismaService: PrismaService,
    ) {}

    async getMyAccountList(user: User) {
        const accounts = await this.prismaService.account.findMany({
            where: {
                userId: user.id,
            },
            select: { id: true, accountNumber: true, balance: true },
        });

        return accounts.map((account) => {
            return {
                ...account,
                balance: account.balance.toString(),
            };
        });
    }

    // 계좌 개설
    // 1. DB 계좌 생성 (status: PENDING)
    // 2. MQ 발행 시도
    //  2-1. 성공시 -> (Publish At) 마킹
    //  2-2. 실패시 -> (status: PENDING) 유지 및 별도 릴레이가 발행시도
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
                    balance: amount,
                    availableBalance: amount,
                },
            });
        });

        await this.publishAndMark(account);

        return {
            id: account.id,
            accountNumber: account.accountNumber,
            balance: account.balance.toString(),
        };
    }

    // MQ에 account.created 발행 후 성공시 마킹
    private async publishAndMark(account: PublishableAccount) {
        try {
            await lastValueFrom(
                this.client
                    .emit('account.created', this.toMessage(account))
                    .pipe(retry(PUBLISH_RETRY)),
            );
        } catch (err) {
            // 실패시 별도 릴레이가 처리
            this.logger.warn(
                `account.created 발행 실패 (accountId=${account.id})`,
                err instanceof Error ? err.stack : err,
            );
            return;
        }

        // 발행 성공 마킹
        await this.prismaService.account.update({
            where: { id: account.id },
            data: { publishedAt: new Date() },
        });
    }

    // 릴레이용: 아직 큐 적재 안 된(PENDING·publishedAt=null) 계좌를 재발행
    // in-flight 요청과의 경합을 피하려 생성 후 일정 시간 지난 것만 대상으로 함
    async republishPending() {
        const pending = await this.prismaService.account.findMany({
            where: {
                publishedAt: null,
                status: AccountStatus.PENDING,
                createdAt: { lt: new Date(Date.now() - 2000) },
            },
            select: ACCOUNT_MESSAGE_SELECT,
            take: 100,
            orderBy: { id: 'asc' },
        });

        for (const account of pending) {
            await this.publishAndMark(account);
        }
    }

    // BigInt 필드를 string으로 변환해 JSON 직렬화 가능한 메시지로 변환
    private toMessage(account: PublishableAccount): AccountMessage {
        return {
            id: account.id,
            balance: account.balance.toString(),
            availableBalance: account.availableBalance.toString(),
        };
    }

    // async transferAccountBalance(
    //     user: User,
    //     dto: TransferAccountBalanceDto,
    //     accountNumber: number,
    // ) {
    //     const amount = BigInt(dto.amount);
    //     const senderAccountNumber = accountNumber;
    //     const receiverAccountNumber = dto.toAccountNumber;

    //     if (senderAccountNumber > 99999) throw new BadRequestException();

    //     if (senderAccountNumber === receiverAccountNumber)
    //         throw new AccountException('NOT_ALLOWED_TRANSFER_SELF');

    //     // 출입금 계좌 검증
    //     const senderAccount = await this.prismaService.account.findUnique({
    //         where: {
    //             accountNumber: senderAccountNumber,
    //         },
    //     });

    //     if (!senderAccount) throw new AccountException('ACCOUNT_NOT_FOUND');
    //     else if (senderAccount.userId !== user.id)
    //         throw new AccountException('ACCOUNT_FORBIDDEN');

    //     const receiverAccount = await this.prismaService.account.findUnique({
    //         where: {
    //             accountNumber: receiverAccountNumber,
    //         },
    //         select: {
    //             id: true,
    //         },
    //     });

    //     if (!receiverAccount) throw new AccountException('ACCOUNT_NOT_FOUND');

    //     // 송금 실행
    //     await this.prismaService.$transaction(async (tx: Prisma.TransactionClient) => {
    //         const senderAccountUpdated = await tx.account.updateMany({
    //             where: {
    //                 accountNumber: senderAccountNumber,
    //                 balance: { gte: amount },
    //                 availableBalance: { gte: amount },
    //             },
    //             data: {
    //                 balance: { decrement: amount },
    //                 availableBalance: { decrement: amount },
    //             },
    //         });

    //         if (senderAccountUpdated.count === 0) {
    //             throw new AccountException('NOT_ENOUGH_MONEY');
    //         }

    //         await tx.account.update({
    //             where: { accountNumber: receiverAccountNumber },
    //             data: {
    //                 balance: { increment: amount },
    //                 availableBalance: { increment: amount },
    //             },
    //         });
    //     });

    //     return {
    //         message: '정상 처리되었습니다.',
    //     };
    // }

    // async depositAccountBalance(dto: DepositAccountBalanceDto, accountNumber: number) {
    //     const amount = dto.amount;

    //     const account = await this.prismaService.account.findUnique({
    //         where: { accountNumber: accountNumber },
    //         select: { id: true },
    //     });
    //     if (!account) throw new AccountException('ACCOUNT_NOT_FOUND');

    //     await this.prismaService.account.update({
    //         where: { accountNumber: accountNumber },
    //         data: {
    //             balance: {
    //                 increment: amount,
    //             },
    //             availableBalance: {
    //                 increment: amount,
    //             },
    //         },
    //     });
    // }

    // async withdrawAccountBalance(dto: withDrawAccountBalanceDto, accountNumber: number) {
    //     const amount = dto.amount;

    //     const account = await this.prismaService.account.findUnique({
    //         where: { accountNumber: accountNumber },
    //         select: { id: true },
    //     });
    //     if (!account) throw new AccountException('ACCOUNT_NOT_FOUND');

    //     await this.prismaService.account.update({
    //         where: { accountNumber: accountNumber },
    //         data: {
    //             balance: {
    //                 decrement: amount,
    //             },
    //             availableBalance: {
    //                 decrement: amount,
    //             },
    //         },
    //     });
    // }

    // async withdrawStock(dto: WithdrawStockDto, accountNumber: number, stockId: number) {
    //     const amount = BigInt(dto.amount);

    //     await this.prismaService.$transaction(async (tx: Prisma.TransactionClient) => {
    //         const account = await tx.account.findUnique({
    //             where: { accountNumber: accountNumber },
    //             select: { id: true },
    //         });
    //         if (!account) throw new AccountException('ACCOUNT_NOT_FOUND');

    //         const stock = await tx.stock.findUnique({
    //             where: { id: stockId },
    //             select: { id: true },
    //         });
    //         if (!stock) throw new StockException('STOCK_NOT_FOUND');

    //         const [rs] = await tx.$queryRaw<UserStock[]>`
    //                 SELECT account_id AS accountId, stock_id AS stockId,
    //                        quantity, available_quantity AS availableQuantity, average,
    //                        total_buy_amount AS totalBuyAmount
    //                 FROM user_stocks
    //                 WHERE account_id = ${account.id} AND stock_id = ${stockId}
    //                 FOR UPDATE
    //             `;

    //         if (!rs || rs.availableQuantity < amount) {
    //             throw new OrderException('NOT_ENOUGH_STOCK');
    //         }

    //         if (rs.availableQuantity === amount) {
    //             await tx.userStock.delete({
    //                 where: {
    //                     accountId_stockId: {
    //                         accountId: account.id,
    //                         stockId: stockId,
    //                     },
    //                 },
    //             });
    //         } else {
    //             await tx.userStock.update({
    //                 where: {
    //                     accountId_stockId: {
    //                         accountId: account.id,
    //                         stockId: stockId,
    //                     },
    //                 },
    //                 data: {
    //                     quantity: {
    //                         decrement: amount,
    //                     },
    //                     availableQuantity: {
    //                         decrement: amount,
    //                     },
    //                 },
    //             });
    //         }
    //     });
    // }

    // async depositStock(dto: DepositStockDto, accountNumber: number, stockId: number) {
    //     const amount = BigInt(dto.amount);
    //     const account = await this.prismaService.account.findUnique({
    //         where: { accountNumber: accountNumber },
    //         select: { id: true },
    //     });

    //     const stock = await this.prismaService.stock.findUnique({
    //         where: { id: stockId },
    //         select: { price: true },
    //     });
    //     if (!stock) throw new StockException('STOCK_NOT_FOUND');

    //     await this.prismaService.userStock.upsert({
    //         where: {
    //             accountId_stockId: {
    //                 accountId: account.id,
    //                 stockId: stockId,
    //             },
    //         },
    //         create: {
    //             accountId: account.id,
    //             stockId: stockId,
    //             quantity: amount,
    //             availableQuantity: amount,
    //             average: stock.price,
    //             totalBuyAmount: stock.price * amount,
    //         },
    //         update: {
    //             quantity: {
    //                 increment: amount,
    //             },
    //             availableQuantity: {
    //                 increment: amount,
    //             },
    //         },
    //     });
    // }
}
