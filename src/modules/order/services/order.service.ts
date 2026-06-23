import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { ClientProxy } from '@nestjs/microservices';
import { OrderStatus, OrderType, Prisma, TradingType, User } from '@prisma/client';
import { lastValueFrom, retry, timer } from 'rxjs';
import { OrderValidationService, TargetOrder } from './order-validation.service';
import { StockLimitService } from './stock-limit.service';
import { OrderCommand } from '../type/order-command.type';
import { OrderMessage } from '../type/order-message.type';
import { GetOrderDto } from '../dto/get-order.dto';
import { DATA_SERVICE } from 'src/common/messaging/messaging.module';

// 주문 생성 필드
const ORDER_MESSAGE_SELECT = {
    id: true,
    targetId: true,
    accountId: true,
    stockId: true,
    price: true,
    quantity: true,
    filledQuantity: true,
    orderType: true,
    tradingType: true,
} satisfies Prisma.OrderSelect;

type PersistedOrder = Prisma.OrderGetPayload<{ select: typeof ORDER_MESSAGE_SELECT }>;

const PUBLISH_RETRY = {
    count: 3,
    delay: (_err: unknown, n: number) => timer(100 * 2 ** n),
};

/**
 * Flow
 *
 * 1. DB 주문생성 (Status: RECEIVED)
 * 2. MQ 발행 시도
 *  2-1. 성공시 -> (Publish At 마킹)
 *  2-2. 실패시 -> (Status: RECEIVED) 유지 및 별도 릴레이가 발행시도
 */
@Injectable()
export class OrderService {
    private readonly logger = new Logger(OrderService.name);

    constructor(
        @Inject(DATA_SERVICE) private client: ClientProxy,
        private readonly prismaService: PrismaService,
        private readonly orderValidation: OrderValidationService,
        private readonly stockLimitService: StockLimitService,
    ) {}

    // 주문 생성
    async createOrder(user: User, command: OrderCommand) {
        const { accountId, target } = await this.orderValidation.validate(command, user);
        const order = await this.prismaService.retryWrite(() =>
            this.persistOrder(command, accountId, target),
        );
        await this.publishAndMark(order);

        return {
            message: '주문이 접수되었습니다.',
            orderId: order.id.toString(),
        };
    }

    // 주문 (DB) 생성
    // 정정, 취소 주문의 TargetId는 원주문을 가르킴
    private async persistOrder(
        command: OrderCommand,
        accountId: number,
        target: TargetOrder | null,
    ): Promise<PersistedOrder> {
        switch (command.type) {
            case 'buy':
            case 'sell': {
                let price: bigint;
                if (command.dto.orderType === OrderType.MARKET) {
                    price =
                        command.type === 'buy'
                            ? await this.stockLimitService.getUpperLimit(command.stockId)
                            : await this.stockLimitService.getLowerLimit(command.stockId);
                } else {
                    price = BigInt(command.dto.price);
                }

                return this.prismaService.order.create({
                    data: {
                        accountId,
                        stockId: command.stockId,
                        price,
                        quantity: BigInt(command.dto.quantity),
                        filledQuantity: BigInt(0),
                        orderType: command.dto.orderType,
                        tradingType:
                            command.type === 'buy' ? TradingType.BUY : TradingType.SELL,
                    },
                    select: ORDER_MESSAGE_SELECT,
                });
            }
            // 정정, 취소 주문은 매칭엔진에게 트리거만 하는 역할
            // 주문 대체 처리, 잔량 계산 후 새 주문 생성은 매칭엔진이 처리
            case 'edit':
                return this.prismaService.order.create({
                    data: {
                        targetId: target.id,
                        accountId,
                        stockId: target.stockId,
                        price: BigInt(command.dto.price), // 정정가
                        quantity: BigInt(0),
                        filledQuantity: BigInt(0),
                        orderType: target.orderType,
                        tradingType: TradingType.EDIT,
                    },
                    select: ORDER_MESSAGE_SELECT,
                });
            case 'cancel':
                return this.prismaService.order.create({
                    data: {
                        targetId: target.id,
                        accountId,
                        stockId: target.stockId,
                        price: target.price,
                        quantity: BigInt(0),
                        filledQuantity: BigInt(0),
                        orderType: target.orderType,
                        tradingType: TradingType.CANCEL,
                    },
                    select: ORDER_MESSAGE_SELECT,
                });
        }
    }

    // MQ에 주문 발행
    private async publishAndMark(order: PersistedOrder) {
        // MQ로 주문 발행 후 확인 까지 대기
        try {
            await lastValueFrom(
                this.client
                    .emit('order.created', this.toMessage(order))
                    .pipe(retry(PUBLISH_RETRY)),
            );
        } catch (err) {
            // 실패시 별도 릴레이가 처리
            this.logger.warn(
                `order.created 발행 실패 (orderId=${order.id})`,
                err instanceof Error ? err.stack : err,
            );
            return;
        }

        // 발행 성공 마킹 (status 변경은 엔진이 처리)
        await this.prismaService.retryWrite(() =>
            this.prismaService.order.update({
                where: { id: order.id },
                data: { publishedAt: new Date() },
            }),
        );
    }

    // 릴레이용: 아직 큐 적재 안 된(RECEIVED·publishedAt=null) 주문을 재발행
    // in-flight 요청과의 경합을 피하려 생성 후 일정 시간 지난 것만 대상으로 함
    async republishPending() {
        // 팬딩 주문 조회
        const pending = await this.prismaService.order.findMany({
            where: {
                publishedAt: null,
                status: OrderStatus.RECEIVED,
                createdAt: { lt: new Date(Date.now() - 2000) },
            },
            select: ORDER_MESSAGE_SELECT,
            take: 100,
            orderBy: { id: 'asc' },
        });

        // 주문 발행
        for (const order of pending) {
            await this.publishAndMark(order);
        }
    }

    // BigInt 필드를 string으로 변환해 JSON 직렬화 가능한 메시지로 변환
    private toMessage(order: PersistedOrder): OrderMessage {
        return {
            id: order.id.toString(),
            targetId: order.targetId?.toString() ?? null,
            accountId: order.accountId.toString(),
            stockId: order.stockId.toString(),
            price: order.price.toString(),
            quantity: order.quantity.toString(),
            filledQuantity: order.filledQuantity.toString(),
            orderType: order.orderType,
            tradingType: order.tradingType,
        };
    }

    async getOrder(query: GetOrderDto, user: User) {
        await this.orderValidation.getOrderValidate(query, user);

        const account = await this.prismaService.account.findUnique({
            where: {
                accountNumber: query.accountnumber,
            },
            select: {
                id: true,
            },
        });

        const findConditions: { accountId: number; status?: GetOrderDto['status'] } = {
            accountId: account.id,
        };

        if (query.status) {
            findConditions.status = query.status;
        }

        return await this.prismaService.order.findMany({
            where: findConditions,
            include: {
                stock: {
                    select: {
                        name: true,
                    },
                },
            },
        });
    }
}
