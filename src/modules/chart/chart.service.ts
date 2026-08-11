import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { ChartException } from './error/chart.exception';
import { StockException } from '../stock/error/stock.exception';
import { CANDLE_TYPE, CHART_TYPES } from './type/chart-type';
import { GetChartDto } from './dto/get-chart.dto';

@Injectable()
export class ChartService {
    constructor(private readonly prismaService: PrismaService) {}

    async getChart(stockId: number, { type, cursor, limit }: GetChartDto) {
        if (!(CHART_TYPES as string[]).includes(type)) {
            throw new ChartException('NOT_SUPPORT_TYPE');
        }

        await this.prismaService.stock
            .findUniqueOrThrow({ where: { id: stockId } })
            .catch(() => {
                throw new StockException('STOCK_NOT_FOUND');
            });

        const candleType = CANDLE_TYPE[type];

        const candles = await this.prismaService.candle.findMany({
            where: { stockId, type: candleType },
            orderBy: { candleTime: 'desc' },
            take: limit + 1,
            ...(cursor && {
                cursor: {
                    stockId_candleTime_type: {
                        stockId,
                        candleTime: new Date(cursor),
                        type: candleType,
                    },
                },
                skip: 1,
            }),
        });

        const hasMore = candles.length > limit;
        const page = candles.slice(0, limit).reverse();

        const result = page.map((c) => ({
            candleTime: c.candleTime.toISOString(),
            open: c.open.toString(),
            high: c.high.toString(),
            low: c.low.toString(),
            close: c.close.toString(),
            volume: c.volume.toString(),
        }));

        const lastCandleTime =
            result.length > 0 ? result[result.length - 1].candleTime : null;
        const nextCursor = hasMore ? result[0].candleTime : null;

        return { candles: result, lastCandleTime, nextCursor };
    }
}
