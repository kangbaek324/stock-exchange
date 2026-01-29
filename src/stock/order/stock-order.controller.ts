import { Controller, Post, UseGuards, Body, BadRequestException, Param } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BuyDto } from './dto/buy.dto';
import { SellDto } from './dto/sell.dto';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { User } from '@prisma/client';
import { OrderValidationService } from './order-validation.service';
import { OrderService } from './order.service';

@Controller('stocks/:id/orders')
@UseGuards(AuthGuard('jwt'))
export class StockOrderController {
    constructor(
        private readonly orderService: OrderService,
        private readonly orderValidationService: OrderValidationService,
    ) {}

    @Post('/buy')
    async buy(
        @Body() dto: BuyDto,
        @GetUser() user: User,
        @Param('id') id: number,
    ): Promise<unknown> {
        const data = {
            ...dto,
            stockId: id,
        };
        const resultMessage = await this.orderValidationService.buySellValidate(data, user, 'buy');

        if (resultMessage) {
            throw new BadRequestException(resultMessage);
        }

        return await this.orderService.sendMQ(data, user, 'buy');
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
        const resultMessage = await this.orderValidationService.buySellValidate(data, user, 'sell');

        if (resultMessage) {
            throw new BadRequestException(resultMessage);
        }

        return this.orderService.sendMQ(data, user, 'sell');
    }
}
