import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { EVENT_BATCH_PATTERN } from '../serializer/event-batch.deserializer';
import {
    AccountBalanceData,
    DomainEvent,
    EventBatch,
    HoldingUpdatedData,
    TradeExecutedData,
} from '../type/event.type';
import { StockWsService } from '../service/stock-ws.service';
import { AccountWsService } from '../service/account-ws.service';
import { OrderWsService } from '../service/order-ws.service';
import { ChartWsService } from '../service/chart-ws.service';

interface EffectPlan {
    stockInfo: Set<number>; // 주식 정보탭 - 현재가/당일 고저가 등 (stockId)
    stockPrice: string;
    orderBook: Set<number>; // 호가창탭 (stockId)
    matchedList: Set<number>; // 체결탭 - 종목 전체 체결 테이프 (stockId)
    trades: TradeExecutedData[]; // 차트탭 - 순서 보장을 위해 배열로 수집 (stockId)
    openOrders: Set<number>; // 미체결탭 (accountId)
    filledOrders: Set<number>; // 체결탭 - 계좌별 체결 내역 (accountId)
    accountBalance: Map<number, AccountBalanceData>; // 잔고탭 (accountId)
    holding: Map<string, HoldingUpdatedData>; // 보유 잔고탭 (accountId:stockId)
}

@Controller()
export class EventConsumer {
    private readonly logger = new Logger(EventConsumer.name);

    constructor(
        private readonly stockWsService: StockWsService,
        private readonly accountWsService: AccountWsService,
        private readonly orderWsService: OrderWsService,
        private readonly chartWsService: ChartWsService,
    ) {}

    @EventPattern(EVENT_BATCH_PATTERN)
    async handleEventBatch(@Payload() batch: EventBatch, @Ctx() context: RmqContext) {
        const channel = context.getChannelRef();
        const originalMsg = context.getMessage();

        try {
            // 한 Event 데이터에서 같은 창이 여러번 업데이트 되는것을 방지
            const plan: EffectPlan = {
                stockInfo: new Set(),
                stockPrice: null,
                orderBook: new Set(),
                matchedList: new Set(),
                trades: [],
                openOrders: new Set(),
                filledOrders: new Set(),
                accountBalance: new Map(),
                holding: new Map(),
            };

            // Plan 데이터 채우기
            for (const event of batch.events) {
                this.collect(plan, event);
            }

            // 창 업데이트
            await this.flush(plan);

            channel.ack(originalMsg);
        } catch (err) {
            this.logger.error(
                `이벤트 배치 처리 실패 (inputSeq=${batch?.inputSeq})`,
                err instanceof Error ? err.stack : err,
            );
            channel.nack(originalMsg, false, false);
        }
    }

    private collect(plan: EffectPlan, event: DomainEvent): void {
        switch (event.pattern) {
            case 'trade.executed': {
                const stockId = Number(event.data.stockId);

                plan.stockInfo.add(stockId);
                plan.orderBook.add(stockId);
                plan.matchedList.add(stockId);
                plan.trades.push(event.data);

                plan.stockPrice = event.data.price;

                // NOTE: 잔고 관련 부분은 아래 케이스에서 추가됨

                return;
            }

            case 'order.open':
                plan.orderBook.add(Number(event.data.stockId));
                plan.openOrders.add(Number(event.data.accountId));

                // 부분 체결시
                if (Number(event.data.filledQuantity) > 0) {
                    plan.filledOrders.add(Number(event.data.accountId));
                }

                return;

            case 'order.filled':
                plan.orderBook.add(Number(event.data.stockId));
                plan.openOrders.add(Number(event.data.accountId));
                plan.filledOrders.add(Number(event.data.accountId));

                return;

            case 'order.canceled':
                plan.orderBook.add(Number(event.data.stockId));
                plan.openOrders.add(Number(event.data.accountId));

                // 시장가 부분 체결시
                // NOTE: 부분 체결된 주문을 취소해도 조건문을 만족하여 업데이트 처리됨
                // 해당 케이스를 걸러내는 로직이 복잡하고 실익이 없다고 판단하여 생략함.
                if (Number(event.data.filledQuantity) > 0) {
                    plan.filledOrders.add(Number(event.data.accountId));
                }

                return;

            case 'order.rejected':
                return;

            case 'account.updated':
            case 'account.activated':
                plan.accountBalance.set(Number(event.data.id), event.data);

                return;

            case 'holding.updated':
                plan.holding.set(
                    `${event.data.accountId}:${event.data.stockId}`,
                    event.data,
                );

                return;

            default: {
                const _exhaustive: never = event;
                this.logger.warn(`알 수 없는 이벤트: ${JSON.stringify(_exhaustive)}`);
            }
        }
    }

    // 창 업데이트
    private async flush(plan: EffectPlan): Promise<void> {
        const tasks: Promise<void>[] = [];

        // 주식 정보 업데이트 (체결시에만 현재가/고저가 변경)
        for (const stockId of plan.stockInfo) {
            tasks.push(this.stockWsService.sendStockInfo(stockId));
            if (plan.stockPrice != null) {
                tasks.push(this.stockWsService.sendStockPrice(stockId, plan.stockPrice));
            }
        }

        // 호가창탭 업데이트
        for (const stockId of plan.orderBook) {
            tasks.push(this.stockWsService.sendOrderBook(stockId));
        }

        // 체결 목록 (호가창)
        for (const stockId of plan.matchedList) {
            tasks.push(this.stockWsService.sendMatchedList(stockId));
        }

        // 차트탭 업데이트
        for (const trade of plan.trades) {
            await this.chartWsService.onTradeExecuted(
                Number(trade.stockId),
                BigInt(trade.price),
                BigInt(trade.quantity),
                new Date(trade.executedAt),
            );
        }

        // 미체결탭 업데이트
        for (const accountId of plan.openOrders) {
            tasks.push(this.orderWsService.sendOpenOrders(accountId));
        }

        // 체결탭(계좌별) 업데이트
        for (const accountId of plan.filledOrders) {
            tasks.push(this.orderWsService.sendFilledOrders(accountId));
        }

        await this.flushWsTasks(tasks);

        // 잔고탭 업데이트
        for (const [accountId, data] of plan.accountBalance) {
            this.accountWsService.sendAccountBalance(accountId, data);
        }

        // 보유 잔고탭 업데이트
        for (const [, data] of plan.holding) {
            this.accountWsService.sendHolding(Number(data.accountId), data);
        }
    }

    private async flushWsTasks(tasks: Promise<void>[]) {
        const results = await Promise.allSettled(tasks);

        for (const result of results) {
            if (result.status === 'rejected') {
                this.logger.error(
                    '웹소켓 조회 업데이트 실패',
                    result.reason instanceof Error ? result.reason.stack : result.reason,
                );
            }
        }
    }
}
