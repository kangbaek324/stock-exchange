import { Injectable } from '@nestjs/common';
import { CandleType } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { OrderException } from '../error/order.exception';
import { getKstDate } from 'src/common/helpers/get-kst-date';
import { StockException } from 'src/modules/stock/error/stock.exception';
import { calcStockLimit, getTickSize } from 'src/common/helpers/stock-limit';
import { ChartWsService } from 'src/modules/websocket/service/chart-ws.service';

@Injectable()
export class StockLimitService {
    constructor(
        private prismaService: PrismaService,
        private chartWsService: ChartWsService,
    ) {}

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
        const todayCandle = this.chartWsService.getCurrentCandle(stockId, '1d');
        const prevDbCandle = await this.prismaService.candle.findFirst({
            where: {
                stockId,
                type: CandleType.ONE_DAY,
                candleTime: { lt: getKstDate(0) },
            },
            orderBy: { candleTime: 'desc' },
            select: { close: true },
        });

        if (prevDbCandle?.close != null) return prevDbCandle.close;
        if (todayCandle?.open != null) return todayCandle.open;

        // 오늘 봉이 메모리에 없을 경우 오늘 trades로 복구 후 메모리 등록 (상장 당일 재시작)
        const todayTrades = await this.prismaService.trade.findMany({
            where: { stockId, matchedAt: { gte: getKstDate(0) } },
            orderBy: { matchedAt: 'asc' },
            select: { price: true, quantity: true },
        });

        if (todayTrades.length > 0) {
            let high = todayTrades[0].price,
                low = todayTrades[0].price,
                volume = 0n;
            for (const t of todayTrades) {
                if (t.price > high) high = t.price;
                if (t.price < low) low = t.price;
                volume += t.quantity;
            }
            const candle = {
                candleTime: getKstDate(0),
                open: todayTrades[0].price,
                high,
                low,
                close: todayTrades[todayTrades.length - 1].price,
                volume,
            };
            this.chartWsService.setCurrentCandle(stockId, '1d', candle);
            return candle.open;
        }

        // 상장 당일이지만 거래 없음: stock.price 반환
        const stock = await this.prismaService.stock.findUnique({
            where: { id: stockId },
            select: { price: true },
        });
        return stock?.price ?? null;
    }
}
