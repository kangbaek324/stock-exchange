import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { ClientProxy } from '@nestjs/microservices';
import { OrderType, PrismaClient, User } from '@prisma/client';
import { OrderValidationService } from './order-validation.service';
import { BuyOrder } from '../type/buy.type';
import { SellOrder } from '../type/sell.type';
import { CancelOrder } from '../type/cancel.type';
import { EditOrder } from '../type/edit.type';
import { GetOrderDto } from '../dto/get-order.dto';
import { getKstDate } from 'src/common/helpers/get-kst-date';
import { OrderException } from '../error/order.exception';
import { BuyDto } from '../dto/buy.dto';
import { EditDto } from '../dto/edit.dto';

@Injectable()
export class OrderService {
    constructor(
        @Inject('ORDER_SERVICE') private client: ClientProxy,
        private readonly prismaService: PrismaService,
        private readonly orderValidation: OrderValidationService,
    ) {}

    async sendMQ(
        data: BuyOrder | SellOrder | CancelOrder | EditOrder,
        user: User,
        type: 'buy' | 'sell' | 'cancel' | 'edit',
    ) {
        const mqData = {
            data,
            type: type,
            user,
            timestamp: Number(process.hrtime.bigint()),
        };
        await this.client.connect();

        this.client.emit('order.created', mqData);

        return {
            message: '주문이 접수되었습니다.',
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

        let findConditions: any = {
            accountId: account.id,
        };

        if (query.status) {
            findConditions.status = query.status;
        }

        return await this.prismaService.order.findMany({
            where: findConditions,
            include: {
                stocks: {
                    select: {
                        name: true,
                    },
                },
            },
        });
    }

    async edit(dto: EditOrder) {
        await this.prismaService.$transaction(async (tx: PrismaClient) => {
            const [order] = await tx.$queryRaw<{ price: bigint; number: bigint }[]>`
                SELECT price, number FROM orders WHERE id = ${dto.orderId} FOR UPDATE
            `;

            const increment = (order.price - BigInt(dto.price)) * order.number;

            const rs = await tx.$executeRaw`
                UPDATE accounts
                SET can_money = can_money + ${increment}
                WHERE account_number = ${dto.accountNumber}
                AND can_money + ${increment} >= 0
            `;

            if (rs === 0) {
                throw new OrderException('NOT_ENOUGH_MONEY');
            }
        });
    }

    async buy(dto: BuyDto, data: BuyOrder, stockId: number) {
        const accountId = (
            await this.prismaService.account.findUnique({
                where: { accountNumber: data.accountNumber },
                select: { id: true },
            })
        ).id;

        // 잠글 금액 계산
        // 시장가를 경우는 당일 상한가를 기준으로 계산
        if (dto.orderType === OrderType.limit) {
            data.lockedBalance = data.number * data.price;
        } else {
            // 상한가 조회
            const todayHistory = await this.prismaService.stockHistory.findUnique({
                where: {
                    stockId_date: {
                        stockId: stockId,
                        date: getKstDate(0),
                    },
                },
                select: {
                    upperLimit: true,
                },
            });

            data.lockedBalance = data.number * Number(todayHistory.upperLimit);
        }

        // 매수 가능 예수금 잠금
        const rs = await this.prismaService.$executeRaw`
            UPDATE accounts
            SET can_money = can_money - ${data.lockedBalance}
            WHERE id = ${accountId}
            AND can_money >= ${data.lockedBalance}
        `;

        if (rs === 0) {
            throw new OrderException('NOT_ENOUGH_MONEY');
        }

        return accountId;
    }

    async sell(data: SellOrder) {
        const accountId = (
            await this.prismaService.account.findUnique({
                where: { accountNumber: data.accountNumber },
                select: {
                    id: true,
                },
            })
        ).id;

        // 가능 수량 잠금 로직
        const rs = await this.prismaService.$executeRaw`
            UPDATE user_stocks
            SET can_number = can_number - ${data.number}
            WHERE account_id = ${accountId}
            AND stock_id = ${data.stockId}
            AND can_number >= ${data.number}
        `;

        if (rs === 0) {
            throw new OrderException('NOT_ENOUGH_STOCK');
        }

        return accountId;
    }
}
