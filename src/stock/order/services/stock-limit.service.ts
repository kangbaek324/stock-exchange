import { Injectable } from '@nestjs/common';
import { STOCK_LIMIT } from 'src/common/consants/stock.constants';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { OrderException } from '../error/order.exception';
import { getKstDate } from 'src/common/helpers/get-kst-date';

@Injectable()
export class StockLimitService {
    constructor(private prismaService: PrismaService) {}

    private getTickSize(price: number) {
        if (price < 2000) return 1;
        if (price < 5000) return 5;
        if (price < 20000) return 10;
        if (price < 50000) return 50;
        if (price < 200000) return 100;
        if (price < 500000) return 500;
        return 1000;
    }

    tickSizeCheck(price) {
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

    async limitSizeCheck(stockId: number, price) {
        // @TODO Redis 적용필요
        const prevHistory = await this.prismaService.stockHistory.findUnique({
            where: {
                stockId_date: {
                    stockId: stockId,
                    date: getKstDate(-1),
                },
            },
            select: {
                close: true,
            },
        });

        // 상장 당일일 경우에 시가를 기준으로 상 하한가 측정
        const prevClose =
            prevHistory?.close ??
            (
                await this.prismaService.stockHistory.findUnique({
                    where: { stockId_date: { stockId, date: getKstDate(0) } },
                    select: { open: true },
                })
            )?.open;

        if (!prevClose) throw new OrderException('STOCK_HISTORIES_NOT_FOUND');

        const upperRaw = Math.floor(Number(prevClose) * (1 + STOCK_LIMIT.UPPER_RATE));
        const lowerRaw = Math.ceil(Number(prevClose) * (1 - STOCK_LIMIT.LOWER_RATE));

        const upperTick = this.getTickSize(upperRaw);
        const lowerTick = this.getTickSize(lowerRaw);

        const upperLimit = Math.floor(upperRaw / upperTick) * upperTick;
        const lowerLimit = Math.ceil(lowerRaw / lowerTick) * lowerTick;

        if (price > upperLimit || price < lowerLimit) {
            throw new OrderException('PRICE_OUT_OF_LIMIT');
        }
    }

    async getStockLimit(stockId: number) {
        // @TODO Redis 적용필요
        const prevHistory = await this.prismaService.stockHistory.findFirst({
            where: {
                stockId: stockId,
            },
            orderBy: {
                date: 'desc',
            },
            select: {
                close: true,
            },
        });

        const prevClose = 9500;
        const upperRaw = Math.floor(Number(prevClose) * (1 + STOCK_LIMIT.UPPER_RATE));
        const lowerRaw = Math.ceil(Number(prevClose) * (1 - STOCK_LIMIT.LOWER_RATE));

        const upperTick = this.getTickSize(upperRaw);
        const lowerTick = this.getTickSize(lowerRaw);

        const upperLimit = Math.floor(upperRaw / upperTick) * upperTick;
        const lowerLimit = Math.ceil(lowerRaw / lowerTick) * lowerTick;

        return {
            upperLimit,
            lowerLimit,
        };
    }
}
