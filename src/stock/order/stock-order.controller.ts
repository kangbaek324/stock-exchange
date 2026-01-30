import { Controller, Post, UseGuards, Body, Param } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BuyDto } from './dto/buy.dto';
import { SellDto } from './dto/sell.dto';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { PrismaClient, User } from '@prisma/client';
import { OrderValidationService } from './order-validation.service';
import { OrderService } from './order.service';
import { PrismaService } from 'src/common/prisma/prisma.service';

@Controller('stocks/:id/orders')
@UseGuards(AuthGuard('jwt'))
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
        const data = {
            ...dto,
            stockId: id,
        };
        await this.orderValidationService.buySellValidate(data, user, 'buy');

        return this.orderService.sendMQ(data, user, 'buy');
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
        await this.orderValidationService.buySellValidate(data, user, 'sell');

        // @TODO DB 성공 후 MQ 요청 실패시 오류가 발생함 가능 수량 오차 발생가능.
        // 가능 수량 차감
        try {
            await this.prismaService.$transaction(async (prisma: PrismaClient) => {
                const account = await prisma.account.findUnique({
                    where: { accountNumber: data.accountNumber },
                    select: {
                        id: true,
                    },
                });

                await prisma.userStock.update({
                    data: {
                        canNumber: {
                            decrement: data.number,
                        },
                    },
                    where: {
                        accountId_stockId: {
                            accountId: account.id,
                            stockId: data.stockId,
                        },
                    },
                });
            });

            return this.orderService.sendMQ(data, user, 'sell');
        } catch (err) {
            console.error(err);
            throw err;
        }
    }
}
