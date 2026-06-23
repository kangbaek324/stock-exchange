import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { ChartException } from './error/chart.exception';
import { StockException } from '../stock/error/stock.exception';
import { ChartType, CANDLE_TYPE, CHART_TYPES } from './type/chart-type';

@Injectable()
export class ChartService {
    constructor(private readonly prismaService: PrismaService) {}

    async getChart(stockId: number, type: ChartType) {
        if (!(CHART_TYPES as string[]).includes(type)) {
            throw new ChartException('NOT_SUPPORT_TYPE');
        }

        await this.prismaService.stock
            .findUniqueOrThrow({ where: { id: stockId } })
            .catch(() => {
                throw new StockException('STOCK_NOT_FOUND');
            });

        const candles = await this.prismaService.candle.findMany({
            where: { stockId, type: CANDLE_TYPE[type] },
            orderBy: { candleTime: 'asc' },
            take: 500,
        });

        const result = candles.map((c) => ({
            candleTime: c.candleTime.toISOString(),
            open: c.open.toString(),
            high: c.high.toString(),
            low: c.low.toString(),
            close: c.close.toString(),
            volume: c.volume.toString(),
        }));

        const lastCandleTime =
            result.length > 0 ? result[result.length - 1].candleTime : null;

        return { candles: result, lastCandleTime };
    }
}
