import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { BuyDto } from './dtos/buy.dto';
import { SellDto } from './dtos/sell.dto';
import { CancelDto } from './dtos/cancel.dto';
import { OrdersValidationService } from './orders-validation.service';
import { GetOrderDto } from './dtos/get-order.dto';
import { EditDto } from './dtos/edit.dto';
import { ClientProxy } from '@nestjs/microservices';
import { User } from '@prisma/client';

@Injectable()
export class OrdersService {
    constructor(
        @Inject('ORDER_SERVICE') private client: ClientProxy,
        private readonly prisma: PrismaService,
        private readonly ordersValidation: OrdersValidationService,
    ) {}

    async sendMQ(
        data: BuyDto | SellDto | CancelDto | EditDto,
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
        const resultMessage = await this.ordersValidation.getOrderValidate(query, user);
        if (resultMessage) {
            throw new BadRequestException(resultMessage);
        }

        const account = await this.prisma.account.findUnique({
            where: {
                accountNumber: query.accountnumber,
            },
            select: {
                id: true,
            },
        });

        const findConditions: any = {
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
