import { Controller, Post, UseGuards, Body, Param } from '@nestjs/common';
import { BuyDto } from '../dto/buy.dto';
import { SellDto } from '../dto/sell.dto';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { User } from '@prisma/client';
import { JwtAuthGuard } from 'src/modules/auth/guard/jwt-auth.guard';
import { OrderService } from '../services/order.service';

@Controller('stocks/:id/orders')
@UseGuards(JwtAuthGuard)
export class StockOrderController {
    constructor(private readonly orderService: OrderService) {}

    // 매수 주문
    @Post('/buy')
    async buy(
        @Body() dto: BuyDto,
        @GetUser() user: User,
        @Param('id') id: number,
    ): Promise<unknown> {
        return this.orderService.createOrder(user, { type: 'buy', stockId: id, dto });
    }

    // 매도 주문
    @Post('/sell')
    async sell(
        @Body() dto: SellDto,
        @GetUser() user: User,
        @Param('id') id: number,
    ): Promise<unknown> {
        return this.orderService.createOrder(user, { type: 'sell', stockId: id, dto });
    }
}
