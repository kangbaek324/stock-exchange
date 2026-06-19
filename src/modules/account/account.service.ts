import { Inject, BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AccountStatus, Prisma, User, UserStock } from '@prisma/client';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom, retry, timer } from 'rxjs';
import { PrismaService } from 'src/common/prisma/prisma.service';
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
                status: 'ACTIVE',
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

            let amount = 1000000000000000n;
            const isExistUserAccount = await this.prismaService.account.findFirst({
                where: { userId: user.id },
                select: { id: true },
            });
            // if (isExistUserAccount) amount = 0n;

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
            id: account.id.toString(),
            balance: account.balance.toString(),
            availableBalance: account.availableBalance.toString(),
        };
    }

    // TODO: 송금 기능 구현
}
