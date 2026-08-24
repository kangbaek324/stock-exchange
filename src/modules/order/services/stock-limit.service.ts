import { Injectable } from '@nestjs/common';
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
    async getPrevClose(stockId: number): Promise<bigint | null> {
        // 전 거래일 마지막 거래 가격 조회
        const todayMidnight = getUtcMidnight(0);
        const lastTradeYesterday = await this.prismaService.trade.findFirst({
            where: { stockId, matchedAt: { lt: todayMidnight } },
            orderBy: { matchedAt: 'desc' },
            select: { price: true },
        });
        if (lastTradeYesterday?.price != null) return lastTradeYesterday.price;

        // 전 개래일 거래가 없을 경우 당일 시가 조회 (상장 당일)
        const todayFirstTrade = await this.prismaService.trade.findFirst({
            where: { stockId, matchedAt: { gte: todayMidnight } },
            orderBy: { matchedAt: 'asc' },
            select: { price: true },
        });
        if (todayFirstTrade?.price != null) return todayFirstTrade.price;

        // 거래가 아예 없을 경우 (상장 당일 + 거래 없음)
        const stock = await this.prismaService.stock.findUnique({
            where: { id: stockId },
            select: { listingPrice: true },
        });
        return stock?.listingPrice ?? null;
    }

    // 자정(UTC) 롤오버 스윕 전용 기준가
    async getRolloverReferencePrice(stockId: number): Promise<bigint | null> {
        const todayMidnight = getUtcMidnight(0);
        const lastTradeYesterday = await this.prismaService.trade.findFirst({
            where: { stockId, matchedAt: { lt: todayMidnight } },
            orderBy: { matchedAt: 'desc' },
            select: { price: true },
        });
        if (lastTradeYesterday?.price != null) return lastTradeYesterday.price;

        const stock = await this.prismaService.stock.findUnique({
            where: { id: stockId },
            select: { listingPrice: true },
        });
        return stock?.listingPrice ?? null;
    }
}
