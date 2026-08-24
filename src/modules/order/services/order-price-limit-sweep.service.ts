import { Injectable, Logger } from '@nestjs/common';
import { OrderStatus, OrderType, StockStatus, TradingType } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { calcStockLimit } from 'src/common/helpers/stock-limit';
import { StockLimitService } from './stock-limit.service';
import { OrderService, PersistedOrder } from './order.service';
import { TargetOrder } from './order-validation.service';

const SWEEP_PAGE_SIZE = 100;
const TARGET_ORDER_SELECT = {
    id: true,
    accountId: true,
    stockId: true,
    price: true,
    quantity: true,
    orderType: true,
} as const;

@Injectable()
export class OrderPriceLimitSweepService {
    private readonly logger = new Logger(OrderPriceLimitSweepService.name);

    constructor(
        private readonly prismaService: PrismaService,
        private readonly stockLimitService: StockLimitService,
        private readonly orderService: OrderService,
    ) {}

    async sweep(): Promise<void> {
        const stocks = await this.prismaService.stock.findMany({
            where: { status: StockStatus.LISTED },
            select: { id: true },
        });

        const createdOrders: PersistedOrder[] = [];

        for (const { id: stockId } of stocks) {
            const refPrice =
                await this.stockLimitService.getRolloverReferencePrice(stockId);
            if (refPrice == null) continue;

            const { upperLimit, lowerLimit } = calcStockLimit(Number(refPrice));

            createdOrders.push(
                ...(await this.createCancelsForViolations(stockId, {
                    gt: BigInt(upperLimit),
                })),
            );
            createdOrders.push(
                ...(await this.createCancelsForViolations(stockId, {
                    lt: BigInt(lowerLimit),
                })),
            );
        }

        for (const order of createdOrders) {
            await this.orderService.publishAndMark(order);
        }

        this.logger.log(
            `Price-limit sweep completed (${createdOrders.length} orders canceled)`,
        );
    }

    // 상 하한 초과 주문들에 대해서 취소 주문 생성
    private async createCancelsForViolations(
        stockId: number,
        priceCondition: { gt: bigint } | { lt: bigint },
    ): Promise<PersistedOrder[]> {
        const created: PersistedOrder[] = [];
        let cursor = 0n;

        while (true) {
            const violations: TargetOrder[] = await this.prismaService.order.findMany({
                where: {
                    stockId,
                    status: OrderStatus.OPEN,
                    tradingType: { in: [TradingType.BUY, TradingType.SELL] },
                    orderType: OrderType.LIMIT,
                    price: priceCondition,
                    id: { gt: cursor },
                },
                orderBy: { id: 'asc' },
                take: SWEEP_PAGE_SIZE,
                select: TARGET_ORDER_SELECT,
            });

            if (violations.length === 0) break;

            for (const target of violations) {
                created.push(await this.orderService.createSystemCancelOrder(target));
            }

            cursor = violations[violations.length - 1].id;
            if (violations.length < SWEEP_PAGE_SIZE) break;
        }

        return created;
    }
}
