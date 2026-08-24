import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { OrderStatus, OrderType, StockStatus, User } from '@prisma/client';
import { AccountException } from 'src/modules/account/error/account.exception';
import { OrderException } from '../error/order.exception';
import { StockException } from 'src/modules/stock/error/stock.exception';
import { GetOrderDto } from '../dto/get-order.dto';
import { OrderCommand } from '../type/order-command.type';
import { StockLimitService } from './stock-limit.service';
import { RedisKeys } from 'src/common/redis/redis-keys';

// 원주문 정보 (정정/취소)
export type TargetOrder = {
    id: bigint;
    accountId: number;
    stockId: number;
    price: bigint;
    quantity: bigint;
    orderType: OrderType;
};

// 검증 결과 - 이후 DB 주문 생성에 필요한 컨텍스트
export type ValidatedOrder = {
    accountId: number;
    target: TargetOrder | null; // 정정/취소일 때만 원주문
};

// 정정/취소가 가능한(아직 종료되지 않은) 상태
const MODIFIABLE_STATUSES: OrderStatus[] = [OrderStatus.RECEIVED, OrderStatus.OPEN];

// NOTE: 현재 일반 계좌 검증과 같은 조회는 Redis 미사용 중 (주식 상태 및 잔고와 같은 데이터만 Redis 조회 중)
@Injectable()
export class OrderValidationService {
    private readonly logger = new Logger(OrderValidationService.name);

    constructor(
        private readonly prismaService: PrismaService,
        private readonly stockLimitService: StockLimitService,
        @InjectRedis() private readonly redis: Redis,
    ) {}

    async getAccount(accountNumber: number) {
        const account = await this.prismaService.account.findUnique({
            where: { accountNumber: accountNumber },
            select: {
                userId: true,
                id: true,
                balance: true,
                availableBalance: true,
            },
        });

        if (!account) throw new AccountException('ACCOUNT_NOT_FOUND');
        else return account;
    }

    async getOrderValidate(query: GetOrderDto, user: User) {
        const account = await this.getAccount(query.accountnumber);

        if (account.userId !== user.id) {
            throw new AccountException('ACCOUNT_FORBIDDEN');
        }
    }

    // 주문 유효성 검사 (매수, 매도, 정정, 취소)
    async validate(
        command: Exclude<OrderCommand, { type: 'system-cancel' }>,
        user: User,
    ): Promise<ValidatedOrder> {
        // UTC 자정 롤오버 처리 중(00:00~00:05)에는 주문 불가
        const now = new Date();
        if (now.getUTCHours() === 0 && now.getUTCMinutes() < 5) {
            throw new OrderException('MARKET_NOT_OPEN');
        }

        // 계좌 존재 및 소유권 검증
        const account = await this.getAccount(command.dto.accountNumber);
        if (account.userId !== user.id) {
            throw new AccountException('ACCOUNT_FORBIDDEN');
        }

        switch (command.type) {
            case 'buy':
            case 'sell': {
                const { dto, stockId } = command;
                this.stockLimitService.tickSizeCheck(dto.price);
                await this.isStockTradable(stockId);

                if (dto.price <= 0 && dto.orderType === OrderType.LIMIT) {
                    throw new OrderException('INVALID_ORDER_PRICE');
                } else if (dto.quantity <= 0) {
                    throw new OrderException('INVALID_ORDER_NUMBER');
                }

                if (dto.orderType === OrderType.LIMIT) {
                    await this.stockLimitService.limitSizeCheck(stockId, dto.price);
                }

                if (command.type === 'buy') {
                    await this.validateBuyableBalance(
                        account.id,
                        account.availableBalance,
                        stockId,
                        dto.orderType,
                        dto.price,
                        dto.quantity,
                    );
                } else {
                    await this.validateSellableStock(account.id, stockId, dto.quantity);
                }

                return { accountId: account.id, target: null };
            }
            case 'edit': {
                const { dto, orderId } = command;
                this.stockLimitService.tickSizeCheck(dto.price);

                const target = await this.getModifiableOrder(orderId, account.id);

                if (dto.price <= 0) {
                    throw new OrderException('INVALID_ORDER_PRICE');
                }
                await this.stockLimitService.limitSizeCheck(target.stockId, dto.price);
                return { accountId: account.id, target };
            }
            case 'cancel': {
                const target = await this.getModifiableOrder(command.orderId, account.id);
                return { accountId: account.id, target };
            }
        }
    }

    // Redis에서 해시 필드 조회
    private async getCachedField(key: string, field: string): Promise<string | null> {
        try {
            return await this.redis.hget(key, field);
        } catch (error) {
            this.logger.warn(
                `Redis 조회 실패 (key=${key}, field=${field})`,
                error instanceof Error ? error.stack : error,
            );
            return null;
        }
    }

    // 거래 가능한 종목인지 검사
    private async isStockTradable(stockId: number) {
        const cachedStatus = await this.getCachedField(
            RedisKeys.stock(stockId),
            'status',
        );
        if (cachedStatus != null) {
            if (cachedStatus !== StockStatus.LISTED) {
                throw new StockException('STOCK_NOT_TRADABLE');
            }
            return;
        }

        const stock = await this.prismaService.stock.findUnique({
            where: { id: stockId },
            select: { status: true },
        });

        if (!stock) throw new StockException('STOCK_NOT_FOUND');
        else if (stock.status !== StockStatus.LISTED)
            throw new StockException('STOCK_NOT_TRADABLE');
    }

    private async validateBuyableBalance(
        accountId: number,
        dbAvailableBalance: bigint,
        stockId: number,
        orderType: OrderType,
        price: number,
        quantity: number,
    ) {
        const orderPrice =
            orderType === OrderType.MARKET
                ? await this.stockLimitService.getUpperLimit(stockId)
                : BigInt(price);
        const requiredBalance = orderPrice * BigInt(quantity);

        const cachedBalance = await this.getCachedField(
            RedisKeys.account(accountId),
            'availableBalance',
        );
        const availableBalance =
            cachedBalance != null ? BigInt(cachedBalance) : dbAvailableBalance;

        if (availableBalance < requiredBalance) {
            throw new OrderException('NOT_ENOUGH_MONEY');
        }
    }

    private async validateSellableStock(
        accountId: number,
        stockId: number,
        quantity: number,
    ) {
        const cachedQuantity = await this.getCachedField(
            RedisKeys.holding(accountId, stockId),
            'availableQuantity',
        );

        if (cachedQuantity != null) {
            if (BigInt(cachedQuantity) < BigInt(quantity)) {
                throw new OrderException('NOT_ENOUGH_STOCK');
            }
            return;
        }

        const userStock = await this.prismaService.userStock.findUnique({
            where: {
                accountId_stockId: {
                    accountId,
                    stockId,
                },
            },
            select: { availableQuantity: true },
        });

        if (!userStock || userStock.availableQuantity < BigInt(quantity)) {
            throw new OrderException('NOT_ENOUGH_STOCK');
        }
    }

    // 주문 정정 취소시 원주문 존재 + 소유권 + 수정 가능 상태 검증 후 주문 데이터 반환
    private async getModifiableOrder(
        orderId: string,
        accountId: number,
    ): Promise<TargetOrder> {
        const order =
            (await this.getCachedOrder(orderId)) ??
            (await this.fetchOrderFromDb(orderId));

        if (!order) {
            throw new OrderException('ORDER_NOT_FOUND');
        } else if (order.accountId !== accountId) {
            throw new OrderException('ORDER_FORBIDDEN');
        } else if (!MODIFIABLE_STATUSES.includes(order.status)) {
            throw new OrderException('ALREADY_PROCESSED_ORDER');
        }

        return order;
    }

    // rt:order 해시 조회. 정정/취소 검증에 필요한 필드가 모두 있어야 유효한 캐시로 인정
    private async getCachedOrder(
        orderId: string,
    ): Promise<(TargetOrder & { status: OrderStatus }) | null> {
        let raw: Record<string, string>;
        try {
            raw = await this.redis.hgetall(RedisKeys.order(orderId));
        } catch (error) {
            this.logger.warn(
                `Redis 조회 실패 (orderId=${orderId})`,
                error instanceof Error ? error.stack : error,
            );
            return null;
        }

        if (
            raw.id == null ||
            raw.accountId == null ||
            raw.stockId == null ||
            raw.price == null ||
            raw.quantity == null ||
            raw.orderType == null ||
            raw.status == null
        ) {
            return null;
        }

        return {
            id: BigInt(raw.id),
            accountId: Number(raw.accountId),
            stockId: Number(raw.stockId),
            price: BigInt(raw.price),
            quantity: BigInt(raw.quantity),
            orderType: raw.orderType as OrderType,
            status: raw.status as OrderStatus,
        };
    }

    private async fetchOrderFromDb(
        orderId: string,
    ): Promise<(TargetOrder & { status: OrderStatus }) | null> {
        return this.prismaService.order.findUnique({
            where: {
                id: BigInt(orderId),
            },
            select: {
                id: true,
                accountId: true,
                stockId: true,
                price: true,
                quantity: true,
                orderType: true,
                status: true,
            },
        });
    }
}
