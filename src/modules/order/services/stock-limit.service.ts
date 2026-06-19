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

        // 상장 당일이라 이전 캔들이 없으면 오늘 시가(상장가) 기준
        return prevDbCandle?.close ?? todayCandle?.open ?? null;
    }
}
