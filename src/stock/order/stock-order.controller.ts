import { Controller, Post, UseGuards, Body, Param } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BuyDto } from './dto/buy.dto';
import { SellDto } from './dto/sell.dto';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { PrismaClient, User, UserStock } from '@prisma/client';
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
        await this.orderValidationService.buySellValidate(data, user, 'sell');

        const account = await this.prismaService.account.findUnique({
            where: { accountNumber: data.accountNumber },
            select: {
                id: true,
            },
        });

        // 가능 수량 감소
        try {
            await this.prismaService.$transaction(async (prisma: PrismaClient) => {
                await prisma.$queryRaw`
                    SELECT can_number FROM user_stocks 
                    WHERE account_id = ${account.id} AND stock_id = ${data.stockId}
                    FOR UPDATE
                `;

                await prisma.userStock.update({
                    where: {
                        accountId_stockId: {
                            accountId: account.id,
                            stockId: data.stockId,
                        },
                    },
                    data: {
                        canNumber: { decrement: data.number },
                    },
                });
            });
        } catch (err) {
            console.error(err);
            throw err;
        }

        // MQ 전송
        try {
            return await this.orderService.sendMQ(data, user, 'sell');
        } catch (err) {
            await this.prismaService.$transaction(async (prisma: PrismaClient) => {
                await prisma.$queryRaw`
                    SELECT can_number FROM user_stocks 
                    WHERE account_id = ${account.id} AND stock_id = ${data.stockId}
                    FOR UPDATE
                `;

                await prisma.userStock.update({
                    where: {
                        accountId_stockId: {
                            accountId: account.id,
                            stockId: data.stockId,
                        },
                    },
                    data: {
                        canNumber: { increment: data.number },
                    },
                });
            });

            console.error(err);
            throw err;
        }
    }
}
