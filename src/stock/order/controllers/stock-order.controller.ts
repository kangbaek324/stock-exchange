import { Controller, Post, UseGuards, Body, Param } from '@nestjs/common';
import { BuyDto } from '../dto/buy.dto';
import { SellDto } from '../dto/sell.dto';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { OrderType, User } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { OrderException } from '../error/order.exception';
import { getKstDate } from 'src/common/helpers/get-kst-date';
import { OrderService } from '../services/order.service';
import { OrderValidationService } from '../services/order-validation.service';

@Controller('stocks/:id/orders')
@UseGuards(JwtAuthGuard)
export class StockOrderController {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly orderService: OrderService,
        private readonly orderValidationService: OrderValidationService,
    ) {}

    @Post('/buy')
    async buy(
        @Body() dto: BuyDto,
        @GetUser() user: User,
        @Param('id') id: number,
    ): Promise<unknown> {
        let data = {
            ...dto,
            stockId: id,
            lockedBalance: 0,
        };
        await this.orderValidationService.tradeValidate(data, user);

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
                        stockId: id,
                        date: getKstDate(0),
                    },
                },
                select: {
                    upperLimit: true,
                },
            });

            data.lockedBalance = data.number * Number(todayHistory.upperLimit);
        }

        // 매수 가능 예수금 잠금 로직
        const result = await this.prismaService.$executeRaw`
            UPDATE accounts
            SET can_money = can_money - ${data.lockedBalance}
            WHERE id = ${accountId}
            AND can_money >= ${data.lockedBalance}
        `;

        if (result === 0) {
            throw new OrderException('NOT_ENOUGH_MONEY');
        }

        // MQ 전송
        try {
            return await this.orderService.sendMQ(data, user, 'buy');
        } catch (err) {
            console.error(err);

            // 매수 가능 예수금 잠금 해제
            await this.prismaService.$executeRaw`
            UPDATE accounts
            SET can_money = can_money + ${data.lockedBalance}
            WHERE id = ${accountId}
            `;

            throw err;
        }
    }

    @Post('/sell')
    async sell(
        @Body() dto: SellDto,
        @GetUser() user: User,
        @Param('id') id: number,
    ): Promise<unknown> {
        const data = {
            ...dto,
            stockId: id,
        };
        await this.orderValidationService.tradeValidate(data, user);

        const accountId = (
            await this.prismaService.account.findUnique({
                where: { accountNumber: data.accountNumber },
                select: {
                    id: true,
                },
            })
        ).id;

        // 가능 수량 잠금 로직
        const result = await this.prismaService.$executeRaw`
            UPDATE user_stocks
            SET can_number = can_number - ${data.number}
            WHERE account_id = ${accountId}
            AND stock_id = ${data.stockId}
            AND can_number >= ${data.number}
        `;

        if (result === 0) {
            throw new OrderException('NOT_ENOUGH_STOCK');
        }

        // MQ 전송
        try {
            return await this.orderService.sendMQ(data, user, 'sell');
        } catch (err) {
            // 실패시 잠금 해지
            await this.prismaService.$executeRaw`
            UPDATE user_stocks
            SET can_number = can_number + ${data.number}
            WHERE id = ${accountId}
            AND stock_id = ${data.stockId}`;

            console.error(err);
            throw err;
        }
    }
}
