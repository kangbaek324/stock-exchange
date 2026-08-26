import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { OrderStatus, OrderType, StockStatus, User } from '@prisma/client';
import { AccountException } from 'src/modules/account/error/account.exception';
import { OrderException } from '../error/order.exception';
import { StockException } from 'src/modules/stock/error/stock.exception';
import { GetOrderDto } from '../dto/get-order.dto';
import { OrderCommand } from '../type/order-command.type';
import { StockLimitService } from './stock-limit.service';
import { RedisKeys } from 'src/common/redis/redis-keys';
import { RedisCacheService } from 'src/common/redis/redis-cache.service';
import { AccountService } from 'src/modules/account/account.service';

export type TargetOrder = {
    id: bigint;
    accountId: number;
    stockId: number;
    price: bigint;
    status: OrderStatus;
    quantity: bigint;
    orderType: OrderType;
};

// 정정/취소가 가능한(아직 종료되지 않은) 상태
const MODIFIABLE_STATUSES: OrderStatus[] = [OrderStatus.RECEIVED, OrderStatus.OPEN];

@Injectable()
export class OrderValidationService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly stockLimitService: StockLimitService,
        private readonly redisCacheService: RedisCacheService,
        private readonly accountService: AccountService,
    ) {}

    async getOrderValidate(query: GetOrderDto, user: User) {
        const account = await this.accountService.getAccount(query.accountnumber);

        if (account.userId !== user.id) {
            throw new AccountException('ACCOUNT_FORBIDDEN');
        }
    }

    // 주문 유효성 검사 (매수, 매도, 정정, 취소)
    async validate(
        command: Exclude<OrderCommand, { type: 'system-cancel' }>,
        user: User,
    ): Promise<{ accountId: number; target: TargetOrder | null }> {
        // UTC 자정 롤오버 처리 중(00:00~00:05)에는 주문 불가
        const now = new Date();
        if (now.getUTCHours() === 0 && now.getUTCMinutes() < 5) {
            throw new OrderException('MARKET_NOT_OPEN');
        }

        // 계좌 존재 및 소유권 검증
        const account = await this.accountService.getAccount(command.dto.accountNumber);
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

    // 거래 가능한 종목인지 검사
    private async isStockTradable(stockId: number) {
        const cachedStatus = await this.redisCacheService.getField(
            RedisKeys.stock(stockId),
            'status',
        );

        if (cachedStatus != null) {
            if (cachedStatus !== StockStatus.LISTED) {
                throw new StockException('STOCK_NOT_TRADABLE');
            }
            return;
        } else {
            const stock = await this.prismaService.stock.findUnique({
                where: { id: stockId },
                select: { status: true },
            });

            if (!stock) throw new StockException('STOCK_NOT_FOUND');
            else if (stock.status !== StockStatus.LISTED)
                throw new StockException('STOCK_NOT_TRADABLE');
        }
    }

    // 계좌 주식 보유 잔고 검사
    private async validateBuyableBalance(
        availableBalance: bigint,
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

        if (availableBalance < requiredBalance) {
            throw new OrderException('NOT_ENOUGH_MONEY');
        }
    }

    // 계좌 보유 주식 검사
    private async validateSellableStock(
        accountId: number,
        stockId: number,
        quantity: number,
    ) {
        const cachedQuantity = await this.redisCacheService.getField(
            RedisKeys.holding(accountId, stockId),
            'availableQuantity',
        );

        if (cachedQuantity != null) {
            if (BigInt(cachedQuantity) < BigInt(quantity)) {
                throw new OrderException('NOT_ENOUGH_STOCK');
            }
            return;
        } else {
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
    }

    // 주문 정정 취소시 원주문 존재 + 소유권 + 수정 가능 상태 검증 후 원본 주문 데이터 반환
    private async getModifiableOrder(
        orderId: string,
        accountId: number,
    ): Promise<TargetOrder> {
        const order =
            (await this.getCachedOrder(orderId)) ?? (await this.getDbOrder(orderId));

        if (!order) {
            throw new OrderException('ORDER_NOT_FOUND');
        } else if (order.accountId !== accountId) {
            throw new OrderException('ORDER_FORBIDDEN');
        } else if (!MODIFIABLE_STATUSES.includes(order.status)) {
            throw new OrderException('ALREADY_PROCESSED_ORDER');
        }

        return order;
    }

    // 주문 정보 조회 (Redis)
    private async getCachedOrder(orderId: string): Promise<TargetOrder | null> {
        const raw = await this.redisCacheService.getAll(RedisKeys.order(orderId));
        if (raw == null) {
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

    // 주문 정보 조회 (DB)
    private async getDbOrder(orderId: string): Promise<TargetOrder | null> {
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
