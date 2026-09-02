import { Inject, Injectable, Logger } from '@nestjs/common';
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
import { AdminStockAdjustMessage } from './type/admin-stock-message.type';
import { AccountAdminException } from './error/account.exception';

// AdminRequest 발행에 필요한 필드
const ADMIN_REQUEST_SELECT = {
    id: true,
    type: true,
    payload: true,
} satisfies Prisma.AdminRequestSelect;

type PublishableAdminRequest = Prisma.AdminRequestGetPayload<{
    select: typeof ADMIN_REQUEST_SELECT;
}>;

type AccountBalancePayload = {
    accountId: number;
    amount: number;
};

type AccountStockPayload = {
    accountId: number;
    stockId: number;
    amount: number;
    average: number;
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

    // 계좌 잔고 입출금 / 보유 주식 입출고
    // 1. AdminRequest DB 생성 (status: RECEIVED)
    // 2. MQ 발행 시도
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

    // 보유 주식 입고
    async depositStock(
        user: User,
        dto: DepositStockDto,
        accountNumber: number,
        stockId: number,
    ) {
        await this.isStockExists(stockId);
        const account = await this.accountService.getAccount(accountNumber);

        return this.createStockAdjustRequest(
            user,
            { accountId: account.id, stockId, amount: dto.amount, average: dto.average },
            AdminRequestType.STOCK_DEPOSIT,
        );
    }

    // 보유 주식 출고
    async withdrawStock(
        user: User,
        dto: WithdrawStockDto,
        accountNumber: number,
        stockId: number,
    ) {
        await this.isStockExists(stockId);
        const account = await this.accountService.getAccountWithStockQuantity(
            accountNumber,
            stockId,
        );
        if (account.availableQuantity < dto.amount) {
            throw new AccountAdminException('INSUFFICIENT_STOCK');
        }

        return this.createStockAdjustRequest(
            user,
            { accountId: account.id, stockId, amount: dto.amount, average: 0 },
            AdminRequestType.STOCK_WITHDRAW,
        );
    }

    private async isStockExists(stockId: number) {
        const stock = await this.prismaService.stock.findUnique({
            where: { id: stockId },
            select: { id: true },
        });
        if (!stock) throw new AccountAdminException('STOCK_NOT_FOUND');
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

        return this.createAdminRequest(user, type, payload);
    }

    private async createStockAdjustRequest(
        user: User,
        payload: AccountStockPayload,
        type:
            | typeof AdminRequestType.STOCK_DEPOSIT
            | typeof AdminRequestType.STOCK_WITHDRAW,
    ) {
        return this.createAdminRequest(user, type, payload);
    }

    private async createAdminRequest(
        user: User,
        type: AdminRequestType,
        payload: AccountBalancePayload | AccountStockPayload,
    ) {
        const request = await this.prismaService.adminRequest.create({
            data: {
                type,
                payload,
                requestedBy: user.id,
            },
            select: ADMIN_REQUEST_SELECT,
        });

        await this.publishAdminRequestAndMark(request);

        return {
            id: request.id.toString(),
            status: AdminRequestStatus.RECEIVED,
        };
    }

    // MQ에 AdminRequest를 발행 후 성공시 마킹
    private async publishAdminRequestAndMark(request: PublishableAdminRequest) {
        const dispatch = this.toAdminRequestDispatch(request);
        if (!dispatch) {
            this.logger.warn(
                `No publish target for AdminRequest type=${request.type} (adminRequestId=${request.id})`,
            );
            return;
        }

        try {
            await lastValueFrom(
                this.client
                    .emit(dispatch.topic, dispatch.message)
                    .pipe(retry(PUBLISH_RETRY)),
            );
        } catch (err) {
            // 실패시 별도 릴레이가 처리
            this.logger.warn(
                `Failed to publish ${dispatch.topic} (adminRequestId=${request.id})`,
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

    // 릴레이용: 아직 큐 적재 안 된(RECEIVED·publishedAt=null) AdminRequest를 재발행
    // in-flight 요청과의 경합을 피하려 생성 후 일정 시간 지난 것만 대상으로 함
    async republishPendingAdminRequests() {
        const pending = await this.prismaService.adminRequest.findMany({
            where: {
                publishedAt: null,
                status: AdminRequestStatus.RECEIVED,
                createdAt: { lt: new Date(Date.now() - 2000) },
            },
            select: ADMIN_REQUEST_SELECT,
            take: 100,
            orderBy: { id: 'asc' },
        });

        for (const request of pending) {
            await this.publishAdminRequestAndMark(request);
        }
    }

    // AdminRequest.type 별 발행 토픽/메시지
    private toAdminRequestDispatch(request: PublishableAdminRequest) {
        switch (request.type) {
            case AdminRequestType.ACCOUNT_DEPOSIT:
            case AdminRequestType.ACCOUNT_WITHDRAW:
                return {
                    topic: 'admin.account.balance.adjust',
                    message: this.toAdminBalanceMessage(request),
                };
            case AdminRequestType.STOCK_DEPOSIT:
            case AdminRequestType.STOCK_WITHDRAW:
                return {
                    topic: 'admin.stock.balance.adjust',
                    message: this.toAdminStockMessage(request),
                };
            default:
                return null;
        }
    }

    private toAdminBalanceMessage(
        request: PublishableAdminRequest,
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

    private toAdminStockMessage(
        request: PublishableAdminRequest,
    ): AdminStockAdjustMessage {
        const { accountId, stockId, amount, average } =
            request.payload as AccountStockPayload;
        const delta = request.type === AdminRequestType.STOCK_WITHDRAW ? -amount : amount;

        return {
            id: request.id.toString(),
            accountId: accountId.toString(),
            stockId: stockId.toString(),
            delta: delta.toString(),
            average: average.toString(),
        };
    }
}
