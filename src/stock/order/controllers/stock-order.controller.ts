import { Controller, Post, UseGuards, Body, Param } from '@nestjs/common';
import { BuyDto } from '../dto/buy.dto';
import { SellDto } from '../dto/sell.dto';
import { BuyOrder } from '../type/buy.type';
import { SellOrder } from '../type/sell.type';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { User } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
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
        const data: BuyOrder = {
            ...dto,
            stockId: id,
            lockedBalance: 0,
        };
        await this.orderValidationService.tradeValidate(data, user);
        const accountId = await this.orderService.buy(dto, data, id);

        // MQ 전송
        try {
            return await this.orderService.sendMQ(data, user, 'buy');
        } catch (err) {
            // 매수 가능 예수금 잠금 해제
            await this.prismaService.$executeRaw`
            UPDATE accounts
            SET can_money = can_money + ${data.lockedBalance}
            WHERE id = ${accountId}
            `;

            console.error(err);
            throw err;
        }
    }

    @Post('/sell')
    async sell(
        @Body() dto: SellDto,
        @GetUser() user: User,
        @Param('id') id: number,
    ): Promise<unknown> {
        const data: SellOrder = {
            ...dto,
            stockId: id,
        };
        await this.orderValidationService.tradeValidate(data, user);
        const accountId = await this.orderService.sell(data);

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
