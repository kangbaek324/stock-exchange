import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { BuyOrder } from './type/buy.type';
import { SellOrder } from './type/sell.type';
import { OrderStatus, TradingType, User } from '@prisma/client';
import { GetOrderDto } from './dto/get-order.dto';
import { EditOrder } from './type/edit.type';
import { CancelOrder } from './type/cancel.type';
import { StockException } from '../error/stock.exception';
import { OrderException } from './error/order.exception';
import { AccountException } from 'src/account/error/account.exception';

@Injectable()
export class OrderValidationService {
    constructor(private readonly prisma: PrismaService) {}

    private tickSizeCheck(price) {
        let check = false;
        if (price >= 2000 && price < 5000) {
            if (price % 5 !== 0) check = true;
        } else if (price >= 5000 && price < 20000) {
            if (price % 10 !== 0) check = true;
        } else if (price >= 20000 && price < 500000) {
            if (price % 50 !== 0) check = true;
        } else if (price >= 50000 && price < 200000) {
            if (price % 100 !== 0) check = true;
        } else if (price >= 200000 && price < 500000) {
            if (price % 500 !== 0) check = true;
        } else if (price >= 500000) {
            if (price % 1000 !== 0) check = true;
        }

        if (check) throw new OrderException('INVALID_ORDER_TICK_SIZE');
    }

    private async getAccount(accountNumber: number) {
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

    async buySellValidate(data: BuyOrder | SellOrder, user: User, tradingType: TradingType) {
        this.tickSizeCheck(data.price);

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
        } else if (data.price <= 0) {
            throw new OrderException('INVALID_ORDER_PRICE');
        } else if (data.number <= 0) {
            throw new OrderException('INVALID_ORDER_NUMBER');
        }

        if (tradingType == 'buy') {
            if (account.money < BigInt(data.price * data.number)) {
                // @TODO 테스트를 위한 주석
                // throw new OrderException('NOT_ENOUGH_MONEY');
            }
        } else {
            const userStocks = await this.prisma.userStock.findFirst({
                where: { accountId: account.id, stockId: data.stockId },
            });

            if (!userStocks || userStocks.canNumber < data.number) {
                throw new OrderException('NOT_ENOUGH_STOCK');
            }
        }
    }

    async editValidate(data: EditOrder, user: User) {
        this.tickSizeCheck(data.price);

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
        } else if (data.price <= 0) {
            throw new OrderException('INVALID_ORDER_PRICE');
        }
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
