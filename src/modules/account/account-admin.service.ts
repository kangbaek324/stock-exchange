import { Inject, Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { AdminRequestStatus, AdminRequestType, Prisma, User } from '@prisma/client';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom, retry, timer } from 'rxjs';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { DATA_SERVICE } from 'src/common/messaging/messaging.module';
import { AccountService } from './account.service';
import { DepositAccountBalanceDto } from './dto/deposit-account-balance.dto';
import { WithdrawAccountBalanceDto } from './dto/withdraw-account-balance.dto';
import { DepositStockDto } from './dto/deposit-stock.dto';
import { WithdrawStockDto } from './dto/withdraw-stock.dto';
import { AdminBalanceAdjustMessage } from './type/admin-balance-message.type';
import { AccountAdminException } from './error/account.exception';

// admin.account.balance.adjust 발행에 필요한 필드
const ADMIN_BALANCE_REQUEST_SELECT = {
    id: true,
    type: true,
    payload: true,
} satisfies Prisma.AdminRequestSelect;

type PublishableAdminBalanceRequest = Prisma.AdminRequestGetPayload<{
    select: typeof ADMIN_BALANCE_REQUEST_SELECT;
}>;

// AdminRequest.payload 에 저장하는 계좌 잔고 증감 요청 형태
type AccountBalancePayload = {
    accountId: number;
    amount: number; // 항상 양수 원값. 방향은 AdminRequest.type 이 결정
};

const PUBLISH_RETRY = {
    count: 3,
    delay: (_err: unknown, n: number) => timer(100 * 2 ** n),
};

@Injectable()
export class AccountAdminService {
    private readonly logger = new Logger(AccountAdminService.name);

    constructor(
        @Inject(DATA_SERVICE) private client: ClientProxy,
        private readonly prismaService: PrismaService,
        private readonly accountService: AccountService,
    ) {}

    // 계좌 잔고 입금/출금
    // 1. AdminRequest DB 생성 (status: RECEIVED)
    // 2. MQ(admin.account.balance.adjust) 발행 시도
    //  2-1. 성공시 -> (publishedAt) 마킹
    //  2-2. 실패시 -> (publishedAt: null) 유지 및 별도 릴레이가 발행시도
    // 처리 결과(status/completedAt) 갱신은 엔진이 담당

    // 계좌 잔고 입금
    async depositAccountBalance(
        user: User,
        dto: DepositAccountBalanceDto,
        accountNumber: number,
    ) {
        const account = await this.accountService.getAccount(accountNumber);

        return this.createBalanceAdjustRequest(
            user,
            account.id,
            dto.amount,
            AdminRequestType.ACCOUNT_DEPOSIT,
        );
    }

    // 계좌 잔고 출금
    async withdrawAccountBalance(
        user: User,
        dto: WithdrawAccountBalanceDto,
        accountNumber: number,
    ) {
        const account = await this.accountService.getAccountWithBalance(accountNumber);
        if (account.availableBalance < dto.amount) {
            throw new AccountAdminException('INSUFFICIENT_BALANCE');
        }

        return this.createBalanceAdjustRequest(
            user,
            account.id,
            dto.amount,
            AdminRequestType.ACCOUNT_WITHDRAW,
        );
    }

    private async createBalanceAdjustRequest(
        user: User,
        accountId: number,
        amount: number,
        type:
            | typeof AdminRequestType.ACCOUNT_DEPOSIT
            | typeof AdminRequestType.ACCOUNT_WITHDRAW,
    ) {
        const payload: AccountBalancePayload = { accountId, amount };

        const request = await this.prismaService.adminRequest.create({
            data: {
                type,
                payload,
                requestedBy: user.id,
            },
            select: ADMIN_BALANCE_REQUEST_SELECT,
        });

        await this.publishAdminBalanceAndMark(request);

        return {
            id: request.id.toString(),
            status: AdminRequestStatus.RECEIVED,
        };
    }

    // MQ에 admin.account.balance.adjust 발행 후 성공시 마킹
    private async publishAdminBalanceAndMark(request: PublishableAdminBalanceRequest) {
        try {
            await lastValueFrom(
                this.client
                    .emit(
                        'admin.account.balance.adjust',
                        this.toAdminBalanceMessage(request),
                    )
                    .pipe(retry(PUBLISH_RETRY)),
            );
        } catch (err) {
            // 실패시 별도 릴레이가 처리
            this.logger.warn(
                `Failed to publish admin.account.balance.adjust (adminRequestId=${request.id})`,
                err instanceof Error ? err.stack : err,
            );
            return;
        }

        // 발행 성공 마킹
        await this.prismaService.adminRequest.update({
            where: { id: request.id },
            data: { publishedAt: new Date() },
        });
    }

    // 릴레이용: 아직 큐 적재 안 된(RECEIVED·publishedAt=null) 계좌 잔고 요청을 재발행
    // in-flight 요청과의 경합을 피하려 생성 후 일정 시간 지난 것만 대상으로 함
    async republishPendingAdminBalanceRequests() {
        const pending = await this.prismaService.adminRequest.findMany({
            where: {
                publishedAt: null,
                status: AdminRequestStatus.RECEIVED,
                type: {
                    in: [
                        AdminRequestType.ACCOUNT_DEPOSIT,
                        AdminRequestType.ACCOUNT_WITHDRAW,
                    ],
                },
                createdAt: { lt: new Date(Date.now() - 2000) },
            },
            select: ADMIN_BALANCE_REQUEST_SELECT,
            take: 100,
            orderBy: { id: 'asc' },
        });

        for (const request of pending) {
            await this.publishAdminBalanceAndMark(request);
        }
    }

    private toAdminBalanceMessage(
        request: PublishableAdminBalanceRequest,
    ): AdminBalanceAdjustMessage {
        const { accountId, amount } = request.payload as AccountBalancePayload;
        const delta =
            request.type === AdminRequestType.ACCOUNT_WITHDRAW ? -amount : amount;

        return {
            id: request.id.toString(),
            accountId: accountId.toString(),
            delta: delta.toString(),
        };
    }

    // 보유 주식 입고
    async depositStock(dto: DepositStockDto, accountNumber: number, stockId: number) {
        void dto;
        void accountNumber;
        void stockId;
        throw new NotImplementedException();
    }

    // 보유 주식 출고
    async withdrawStock(dto: WithdrawStockDto, accountNumber: number, stockId: number) {
        void dto;
        void accountNumber;
        void stockId;
        throw new NotImplementedException();
    }
}
