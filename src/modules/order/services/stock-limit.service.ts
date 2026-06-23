import { Injectable } from '@nestjs/common';
import { CandleType } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { OrderException } from '../error/order.exception';
import { getUtcMidnight } from 'src/common/helpers/get-utc-midnight';
import { StockException } from 'src/modules/stock/error/stock.exception';
import { calcStockLimit, getTickSize } from 'src/common/helpers/stock-limit';

@Injectable()
export class StockLimitService {
    constructor(private prismaService: PrismaService) {}

    tickSizeCheck(price: number) {
        const tick = getTickSize(price);
        if (tick > 1 && price % tick !== 0) {
            throw new OrderException('INVALID_ORDER_TICK_SIZE');
        }
    }

    // CONSIDER: 매번 사용할때 마다 상하한가를 계산하고 있기에, 이를 저장하는 로직이 필요함
    async limitSizeCheck(stockId: number, price: number) {
        const prevClose = await this.getPrevClose(stockId);
        if (!prevClose) throw new StockException('STOCK_HISTORIES_NOT_FOUND');

        const limits = calcStockLimit(Number(prevClose));
        if (price > limits.upperLimit || price < limits.lowerLimit) {
            throw new OrderException('PRICE_OUT_OF_LIMIT');
        }
    }

    // NOTE: 래퍼 함수
    async getUpperLimit(stockId: number): Promise<bigint> {
        const prevClose = await this.getPrevClose(stockId);
        if (!prevClose) throw new StockException('STOCK_HISTORIES_NOT_FOUND');
        return BigInt(calcStockLimit(Number(prevClose)).upperLimit);
    }

    async getLowerLimit(stockId: number): Promise<bigint> {
        const prevClose = await this.getPrevClose(stockId);
        if (!prevClose) throw new StockException('STOCK_HISTORIES_NOT_FOUND');
        return BigInt(calcStockLimit(Number(prevClose)).lowerLimit);
    }

    // 전일 종가 반환
    // NOTE: 상장 당일일 경우 당일 시가를 반환
    // NOTE: 캔들이 전혀 없으면 stock.price 반환
    async getPrevClose(stockId: number): Promise<bigint | null> {
        const prevDbCandle = await this.prismaService.candle.findFirst({
            where: {
                stockId,
                type: CandleType.ONE_DAY,
                candleTime: { lt: getUtcMidnight(0) },
            },
            orderBy: { candleTime: 'desc' },
            select: { close: true },
        });

        if (prevDbCandle?.close != null) return prevDbCandle.close;

        const todayFirstTrade = await this.prismaService.trade.findFirst({
            where: { stockId, matchedAt: { gte: getUtcMidnight(0) } },
            orderBy: { matchedAt: 'asc' },
            select: { price: true },
        });

        if (todayFirstTrade?.price != null) return todayFirstTrade.price;

        // 상장 당일이 거래 없음: listingPrice 반환
        const stock = await this.prismaService.stock.findUnique({
            where: { id: stockId },
            select: { listingPrice: true },
        });
        return stock?.listingPrice ?? null;
    }
}
