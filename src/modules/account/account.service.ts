import { Inject, Injectable, Logger } from '@nestjs/common';
import { AccountStatus, Prisma, TransferStatus, User } from '@prisma/client';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom, retry, timer } from 'rxjs';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { AccountMessage } from './type/account-message.type';
import { TransferMessage } from './type/transfer-message.type';
import { DATA_SERVICE } from 'src/common/messaging/messaging.module';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { GetTransferDto, TransferDirection, TransferSort } from './dto/get-transfer.dto';
import { AccountException } from './error/account.exception';
import { RedisCacheService } from 'src/common/redis/redis-cache.service';
import { RedisKeys } from 'src/common/redis/redis-keys';

// account.created 발행에 필요한 필드
const ACCOUNT_MESSAGE_SELECT = {
    id: true,
    balance: true,
    availableBalance: true,
} satisfies Prisma.AccountSelect;

type PublishableAccount = Prisma.AccountGetPayload<{
    select: typeof ACCOUNT_MESSAGE_SELECT;
}>;

// transfer.created 발행에 필요한 필드
const TRANSFER_MESSAGE_SELECT = {
    id: true,
    senderAccountId: true,
    recipientAccountId: true,
    amount: true,
    senderAlias: true,
} satisfies Prisma.TransferSelect;

type PublishableTransfer = Prisma.TransferGetPayload<{
    select: typeof TRANSFER_MESSAGE_SELECT;
}>;

// 송금 내역 조회 응답에 필요한 필드
const TRANSFER_HISTORY_SELECT = {
    id: true,
    senderAccountId: true,
    senderAlias: true,
    amount: true,
    status: true,
    rejectReason: true,
    completedAt: true,
    createdAt: true,
    senderAccount: { select: { accountNumber: true } },
    recipientAccount: { select: { accountNumber: true } },
} satisfies Prisma.TransferSelect;

type TransferHistory = Prisma.TransferGetPayload<{
    select: typeof TRANSFER_HISTORY_SELECT;
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
        private readonly redisCacheService: RedisCacheService,
    ) {}

    // Account

    // 내 계좌 리스트 조회
    async getMyAccountList(user: User) {
        const accounts = await this.prismaService.account.findMany({
            where: {
                userId: user.id,
                status: 'ACTIVE',
            },
            select: { id: true, accountNumber: true },
        });

        return accounts;
    }

    async getAccount(accountNumber: number) {
        const account = await this.prismaService.account.findUnique({
            where: { accountNumber },
            select: { id: true, userId: true },
        });
        if (!account) throw new AccountException('ACCOUNT_NOT_FOUND');

        return account;
    }

    async getAccountWithBalance(accountNumber: number) {
        const account = await this.prismaService.account.findUnique({
            where: { accountNumber },
            select: { id: true, userId: true, availableBalance: true },
        });
        if (!account) throw new AccountException('ACCOUNT_NOT_FOUND');

        const cachedBalance = await this.redisCacheService.getField(
            RedisKeys.account(account.id),
            'availableBalance',
        );

        let availableBalance = account.availableBalance;
        if (cachedBalance != null) {
            try {
                const parsed = BigInt(cachedBalance);
                if (parsed >= 0n) availableBalance = parsed;
                else
                    this.logger.warn(
                        `Negative cached availableBalance, falling back to DB (accountId=${account.id}, cached=${cachedBalance})`,
                    );
            } catch {
                this.logger.warn(
                    `Invalid cached availableBalance, falling back to DB (accountId=${account.id}, cached=${cachedBalance})`,
                );
            }
        }

        return {
            id: account.id,
            userId: account.userId,
            availableBalance,
        };
    }

    // 계좌 + 특정 종목 보유 수량 조회 (보유 없으면 0)
    async getAccountWithStockQuantity(accountNumber: number, stockId: number) {
        const account = await this.prismaService.account.findUnique({
            where: { accountNumber },
            select: { id: true, userId: true },
        });
        if (!account) throw new AccountException('ACCOUNT_NOT_FOUND');

        const cachedQuantity = await this.redisCacheService.getField(
            RedisKeys.holding(account.id, stockId),
            'availableQuantity',
        );

        if (cachedQuantity != null) {
            try {
                const parsed = BigInt(cachedQuantity);
                if (parsed >= 0n)
                    return {
                        id: account.id,
                        userId: account.userId,
                        availableQuantity: parsed,
                    };

                this.logger.warn(
                    `Negative cached availableQuantity, falling back to DB (accountId=${account.id}, stockId=${stockId}, cached=${cachedQuantity})`,
                );
            } catch {
                this.logger.warn(
                    `Invalid cached availableQuantity, falling back to DB (accountId=${account.id}, stockId=${stockId}, cached=${cachedQuantity})`,
                );
            }
        }

        const userStock = await this.prismaService.userStock.findUnique({
            where: { accountId_stockId: { accountId: account.id, stockId } },
            select: { availableQuantity: true },
        });

        return {
            id: account.id,
            userId: account.userId,
            availableQuantity: userStock?.availableQuantity ?? 0n,
        };
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

            let amount = 1_000_000n;
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

        await this.publishAccountAndMark(account);

        return {
            id: account.id,
            accountNumber: account.accountNumber,
            balance: account.balance.toString(),
        };
    }

    // MQ에 account.created 발행 후 성공시 마킹
    private async publishAccountAndMark(account: PublishableAccount) {
        try {
            await lastValueFrom(
                this.client
                    .emit('account.created', this.toAccountMessage(account))
                    .pipe(retry(PUBLISH_RETRY)),
            );
        } catch (err) {
            // 실패시 별도 릴레이가 처리
            this.logger.warn(
                `Failed to publish account.created (accountId=${account.id})`,
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
    async republishPendingAccounts() {
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
            await this.publishAccountAndMark(account);
        }
    }

    private toAccountMessage(account: PublishableAccount): AccountMessage {
        return {
            id: account.id.toString(),
            balance: account.balance.toString(),
            availableBalance: account.availableBalance.toString(),
        };
    }

    // Transfer

    // 계좌 간 송금
    // 1. 송금 조건 검사 (잔액 검사 등은 Redis 기반, 엔진에서 거부 될 수도 있음)
    // 2. 송금 내역 DB 생성 (status: RECEIVED) 및 MQ 발행
    //  2-1. 성공시 -> (Publish At) 마킹
    //  2-2. 실패시 -> (status: RECEIVED) 유지 및 별도 릴레이가 발행시도
    async createTransfer(
        user: User,
        dto: CreateTransferDto,
        senderAccountNumber: number,
    ): Promise<unknown> {
        // 발신자
        const sender = await this.getAccountWithBalance(senderAccountNumber);
        if (sender.userId !== user.id) throw new AccountException('ACCOUNT_FORBIDDEN');

        // 수신자
        const recipient = await this.getAccount(dto.recipientAccountNumber);

        // 자기 자신 송금 방지
        if (sender.id === recipient.id) {
            throw new AccountException('NOT_ALLOWED_TRANSFER_SELF');
        }

        // 잔액 검사
        const amount = BigInt(dto.amount);
        if (sender.availableBalance < amount) {
            throw new AccountException('NOT_ENOUGH_MONEY');
        }

        // 송금 내역 생성
        const transfer = await this.prismaService.transfer.create({
            data: {
                senderAccountId: sender.id,
                recipientAccountId: recipient.id,
                amount,
                senderAlias: dto.senderAlias,
            },
            select: TRANSFER_MESSAGE_SELECT,
        });

        await this.publishTransferAndMark(transfer);

        return {
            id: transfer.id.toString(),
            senderAccountId: transfer.senderAccountId,
            recipientAccountId: transfer.recipientAccountId,
            amount: transfer.amount.toString(),
        };
    }

    // 계좌 송금 내역 조회
    async getTransferList(user: User, dto: GetTransferDto, accountNumber: number) {
        const account = await this.getAccount(accountNumber);
        if (account.userId !== user.id) throw new AccountException('ACCOUNT_FORBIDDEN');

        const where: Prisma.TransferWhereInput = {
            ...this.buildDirectionFilter(account.id, dto.direction),
        };

        const sortOrder: Prisma.SortOrder =
            dto.sort === TransferSort.OLDEST ? 'asc' : 'desc';

        const [total, transfers] = await Promise.all([
            this.prismaService.transfer.count({ where }),
            this.prismaService.transfer.findMany({
                where,
                select: TRANSFER_HISTORY_SELECT,
                orderBy: [{ createdAt: sortOrder }, { id: sortOrder }],
                skip: (dto.page - 1) * dto.limit,
                take: dto.limit,
            }),
        ]);

        return {
            total,
            page: dto.page,
            limit: dto.limit,
            totalPages: Math.ceil(total / dto.limit),
            hasNext: dto.page * dto.limit < total,
            items: transfers.map((transfer) =>
                this.toTransferHistory(transfer, account.id),
            ),
        };
    }

    private buildDirectionFilter(
        accountId: number,
        direction?: TransferDirection,
    ): Prisma.TransferWhereInput {
        if (direction === TransferDirection.SENT) return { senderAccountId: accountId };
        if (direction === TransferDirection.RECEIVED) {
            return { recipientAccountId: accountId };
        }

        return {
            OR: [{ senderAccountId: accountId }, { recipientAccountId: accountId }],
        };
    }

    private toTransferHistory(transfer: TransferHistory, accountId: number) {
        const isSender = transfer.senderAccountId === accountId;

        return {
            id: transfer.id.toString(),
            direction: isSender ? TransferDirection.SENT : TransferDirection.RECEIVED,
            amount: transfer.amount.toString(),
            status: transfer.status,
            rejectReason: transfer.rejectReason,
            senderAccountNumber: transfer.senderAccount.accountNumber,
            recipientAccountNumber: transfer.recipientAccount.accountNumber,
            // 발신자가 지정한 커스텀 이름 (없으면 계좌번호로 표시)
            senderName:
                transfer.senderAlias ?? String(transfer.senderAccount.accountNumber),
            completedAt: transfer.completedAt,
            createdAt: transfer.createdAt,
        };
    }

    private async publishTransferAndMark(transfer: PublishableTransfer) {
        try {
            await lastValueFrom(
                this.client
                    .emit('transfer.created', this.toTransferMessage(transfer))
                    .pipe(retry(PUBLISH_RETRY)),
            );
        } catch (err) {
            // 실패시 별도 릴레이가 처리
            this.logger.warn(
                `Failed to publish transfer.created (transferId=${transfer.id})`,
                err instanceof Error ? err.stack : err,
            );
            return;
        }

        // 발행 성공 마킹
        await this.prismaService.transfer.update({
            where: { id: transfer.id },
            data: { publishedAt: new Date() },
        });
    }

    // 릴레이용: 아직 큐 적재 안 된(RECEIVED·publishedAt=null) 송금을 재발행
    // in-flight 요청과의 경합을 피하려 생성 후 일정 시간 지난 것만 대상으로 함
    async republishPendingTransfers() {
        const pending = await this.prismaService.transfer.findMany({
            where: {
                publishedAt: null,
                status: TransferStatus.RECEIVED,
                createdAt: { lt: new Date(Date.now() - 2000) },
            },
            select: TRANSFER_MESSAGE_SELECT,
            take: 100,
            orderBy: { id: 'asc' },
        });

        for (const transfer of pending) {
            await this.publishTransferAndMark(transfer);
        }
    }

    private toTransferMessage(transfer: PublishableTransfer): TransferMessage {
        return {
            id: transfer.id.toString(),
            senderAccountId: transfer.senderAccountId.toString(),
            recipientAccountId: transfer.recipientAccountId.toString(),
            amount: transfer.amount.toString(),
        };
    }
}
