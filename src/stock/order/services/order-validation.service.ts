import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { OrderStatus, OrderType, TradingType, User } from '@prisma/client';
import { AccountException } from 'src/account/error/account.exception';
import { OrderException } from '../error/order.exception';
import { CancelOrder } from '../type/cancel.type';
import { EditOrder } from '../type/edit.type';
import { StockException } from 'src/stock/error/stock.exception';
import { BuyOrder } from '../type/buy.type';
import { SellOrder } from '../type/sell.type';
import { GetOrderDto } from '../dto/get-order.dto';
import { StockLimitService } from './stock-limit.service';

@Injectable()
export class OrderValidationService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly stockLimitService: StockLimitService,
    ) {}

    async getAccount(accountNumber: number) {
        const account = await this.prisma.account.findUnique({
            where: { accountNumber: accountNumber },
            select: {
                userId: true,
                id: true,
                money: true,
            },
        });

        if (!account) throw new AccountException('ACCOUNT_NOT_FOUND');
        else return account;
    }

    async getOrderValidate(query: GetOrderDto, user: User) {
        const account = await this.getAccount(query.accountnumber);

        if (account.userId !== user.id) {
            throw new AccountException('ACCOUNT_FORBIDDEN');
        }
    }

    async tradeValidate(data: BuyOrder | SellOrder, user: User) {
        this.stockLimitService.tickSizeCheck(data.price);

        const account = await this.getAccount(data.accountNumber);
        if (account.userId !== user.id) {
            throw new AccountException('ACCOUNT_FORBIDDEN');
        }

        const stockIdCheck = await this.prisma.stock.findUnique({
            where: { id: data.stockId },
            select: { id: true },
        });

        if (!stockIdCheck) {
            throw new StockException('STOCK_NOT_FOUND');
        } else if (data.price <= 0 && data.orderType === OrderType.limit) {
            throw new OrderException('INVALID_ORDER_PRICE');
        } else if (data.number <= 0) {
            throw new OrderException('INVALID_ORDER_NUMBER');
        }

        if (data.orderType === OrderType.limit) {
            await this.stockLimitService.limitSizeCheck(data.stockId, data.price);
        }
    }

    async editValidate(data: EditOrder, user: User) {
        this.stockLimitService.tickSizeCheck(data.price);

        const account = await this.getAccount(data.accountNumber);
        if (account.userId !== user.id) {
            throw new AccountException('ACCOUNT_FORBIDDEN');
        }

        const order = await this.prisma.order.findUnique({
            where: {
                id: data.orderId,
            },
            select: {
                stockId: true,
                accountId: true,
                status: true,
            },
        });

        if (!order) {
            throw new OrderException('ORDER_NOT_FOUND');
        } else if (order.accountId !== account.id) {
            throw new OrderException('ORDER_FORBIDDEN');
        } else if (order.status === OrderStatus.y || order.status === OrderStatus.c) {
            throw new OrderException('ALREADY_PROCESSED_ORDER');
        } else if (data.price <= 0) {
            throw new OrderException('INVALID_ORDER_PRICE');
        }

        await this.stockLimitService.limitSizeCheck(order.stockId, data.price);
    }

    async cancelValidate(data: CancelOrder, user: User) {
        const account = await this.getAccount(data.accountNumber);
        if (account.userId !== user.id) {
            throw new AccountException('ACCOUNT_FORBIDDEN');
        }

        const order = await this.prisma.order.findUnique({
            where: {
                id: data.orderId,
            },
            select: {
                accountId: true,
                status: true,
            },
        });

        if (!order) {
            throw new OrderException('ORDER_NOT_FOUND');
        } else if (order.accountId !== account.id) {
            throw new OrderException('ORDER_FORBIDDEN');
        } else if (order.status === OrderStatus.y || order.status === OrderStatus.c) {
            throw new OrderException('ALREADY_PROCESSED_ORDER');
        }
    }
}
