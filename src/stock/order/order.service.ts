import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { GetOrderDto } from './dto/get-order.dto';
import { ClientProxy } from '@nestjs/microservices';
import { User } from '@prisma/client';
import { OrderValidationService } from './order-validation.service';
import { BuyOrder } from './type/buy.type';
import { SellOrder } from './type/sell.type';
import { CancelOrder } from './type/cancel.type';
import { EditOrder } from './type/edit.type';

@Injectable()
export class OrderService {
    constructor(
        @Inject('ORDER_SERVICE') private client: ClientProxy,
        private readonly prisma: PrismaService,
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

        this.client.emit('order.created', mqData);

        return {
            message: '주문이 접수되었습니다.',
        };
    }

    async getOrder(query: GetOrderDto, user: User) {
        await this.orderValidation.getOrderValidate(query, user);

        const account = await this.prisma.account.findUnique({
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

        return await this.prisma.order.findMany({
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
}
