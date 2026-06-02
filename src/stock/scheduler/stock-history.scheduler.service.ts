import { InjectRedis } from '@nestjs-modules/ioredis';
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import Redis from 'ioredis';
import { getKstDate } from 'src/common/helpers/get-kst-date';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { StockException } from 'src/stock/error/stock.exception';
import { StockLimitService } from 'src/order/services/stock-limit.service';

// @TODO Redis 판영 필요
@Injectable()
export class StockHistorySchedulerService implements OnApplicationBootstrap {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly stockLimitService: StockLimitService,
        @InjectRedis() private readonly redis: Redis,
    ) {}

    async onApplicationBootstrap() {
        await this.fillMissingStockHistory();
    }

    private async fillMissingStockHistory() {
        const today = getKstDate(0);

        const stocks = await this.prismaService.stock.findMany({
            include: {
                stockHistory: {
                    orderBy: { date: 'desc' },
                    take: 1,
                    select: {
                        close: true,
                        date: true,
                    },
                },
            },
        });

        stocks.map(async (stock) => {
            const stockHistory = stock.stockHistory[0];

            if (stockHistory && stockHistory.date < today) {
                const prevClose = Number(stockHistory.close);
                const limits = this.stockLimitService.getStockLimit(prevClose);
                let standardDate = stockHistory.date;
                let dbData = [];
                let redisData = [];

                while (standardDate < today) {
                    standardDate.setDate(standardDate.getDate() + 1);

                    dbData.push({
                        stockId: stock.id,
                        low: prevClose,
                        high: prevClose,
                        close: prevClose,
                        open: prevClose,
                        lowerLimit: limits.lowerLimit,
                        upperLimit: limits.upperLimit,
                        date: new Date(standardDate),
                    });

                    redisData.push({
                        time: new Date(standardDate),
                        low: prevClose,
                        high: prevClose,
                        close: prevClose,
                        open: prevClose,
                        volume: '0', // chart-ws.service 주석 참고
                    });
                }

                await this.prismaService.stockHistory.createMany({
                    data: dbData,
                });

                const lastRaw = await this.redis.lindex(`chart:${stock.id}:1d`, -1);
                const lastTime = lastRaw ? JSON.parse(lastRaw).time : null;
                const newRedisData = lastTime
                    ? redisData.filter((d) => new Date(d.time).toISOString() > lastTime)
                    : redisData;
                if (newRedisData.length > 0) {
                    await this.redis.rpush(
                        `chart:${stock.id}:1d`,
                        ...newRedisData.map((d) => JSON.stringify(d)),
                    );
                }
            }
        });
    }

    // 일별 시세 세팅
    @Cron('0 0 0 * * *', {
        timeZone: 'Asia/Seoul',
    }) // 한국 기준 12시 자정
    async handleStockHistoryDay() {
        const today = getKstDate(0);

        const stocks = await this.prismaService.stock.findMany({
            include: {
                stockHistory: {
                    orderBy: { date: 'desc' },
                    take: 1,
                    select: { close: true },
                },
            },
        });

        const dbData = [];

        stocks.map(async (stock) => {
            if (!stock.stockHistory[0])
                throw new StockException('STOCK_HISTORIES_NOT_FOUND');

            const prevClose = Number(stock.stockHistory[0].close);
            const limits = this.stockLimitService.getStockLimit(prevClose);

            dbData.push({
                stockId: stock.id,
                date: today,
                open: null,
                close: prevClose,
                high: prevClose,
                low: prevClose,
                upperLimit: limits.upperLimit,
                lowerLimit: limits.lowerLimit,
            });

            const redisData = [
                {
                    time: new Date(today),
                    low: prevClose,
                    high: prevClose,
                    close: prevClose,
                    open: prevClose,
                    volume: '0', // chart-ws.service 주석 참고
                },
            ];

            const lastRaw = await this.redis.lindex(`chart:${stock.id}:1d`, -1);
            const last = lastRaw ? JSON.parse(lastRaw) : null;
            const todayStr = new Date(today).toISOString();
            if (!last || last.time !== todayStr) {
                await this.redis.rpush(
                    `chart:${stock.id}:1d`,
                    ...redisData.map((d) => JSON.stringify(d)),
                );
            }
        });

        await this.prismaService.stockHistory.createMany({
            data: dbData,
            skipDuplicates: true,
        });
    }
}
