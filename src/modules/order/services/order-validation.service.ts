import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { OrderStatus, OrderType, StockStatus, User } from '@prisma/client';
import { AccountException } from 'src/modules/account/error/account.exception';
import { OrderException } from '../error/order.exception';
import { StockException } from 'src/modules/stock/error/stock.exception';
import { GetOrderDto } from '../dto/get-order.dto';
import { OrderCommand } from '../type/order-command.type';
import { StockLimitService } from './stock-limit.service';

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

@Injectable()
export class OrderValidationService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly stockLimitService: StockLimitService,
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
    async validate(command: OrderCommand, user: User): Promise<ValidatedOrder> {
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
        const stock = await this.prismaService.stock.findUnique({
            where: { id: stockId },
            select: { status: true },
        });

        if (!stock) throw new StockException('STOCK_NOT_FOUND');
        else if (stock.status !== StockStatus.LISTED)
            throw new StockException('STOCK_NOT_TRADABLE');
    }

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

    private async validateSellableStock(accountId: number, stockId: number, quantity: number) {
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
        const order = await this.prismaService.order.findUnique({
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

        if (!order) {
            throw new OrderException('ORDER_NOT_FOUND');
        } else if (order.accountId !== accountId) {
            throw new OrderException('ORDER_FORBIDDEN');
        } else if (!MODIFIABLE_STATUSES.includes(order.status)) {
            throw new OrderException('ALREADY_PROCESSED_ORDER');
        }

        return order;
    }
}
