import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { getKstDate } from 'src/common/helpers/get-kst-date';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { StockException } from 'src/stock/error/stock.exception';
import { StockLimitService } from 'src/stock/order/services/stock-limit.service';

@Injectable()
export class StockHistorySchedulerService implements OnApplicationBootstrap {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly stockLimitService: StockLimitService,
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

            if (stockHistory.date < today) {
                const prevClose = Number(stockHistory.close);
                const limits = this.stockLimitService.getStockLimit(prevClose);
                let standardDate = stockHistory.date;
                let fillData = [];

                while (standardDate < today) {
                    standardDate.setDate(standardDate.getDate() + 1);

                    fillData.push({
                        stockId: stock.id,
                        low: prevClose,
                        high: prevClose,
                        close: prevClose,
                        open: prevClose,
                        lowerLimit: limits.lowerLimit,
                        upperLimit: limits.upperLimit,
                        date: new Date(standardDate),
                    });
                }

                await this.prismaService.stockHistory.createMany({
                    data: fillData,
                });
            }
        });
    }

    // 일별 시세 세팅
    @Cron('0 0 0 * * *', {
        timeZone: 'Asia/Seoul',
    }) // 12시 자정
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

        const data = stocks.map((stock) => {
            if (!stock.stockHistory[0])
                throw new StockException('STOCK_HISTORIES_NOT_FOUND');

            const prevClose = Number(stock.stockHistory[0].close);
            const limits = this.stockLimitService.getStockLimit(prevClose);

            return {
                stockId: stock.id,
                date: today,
                open: null,
                close: prevClose,
                high: prevClose,
                low: prevClose,
                upperLimit: limits.upperLimit,
                lowerLimit: limits.lowerLimit,
            };
        });

        await this.prismaService.stockHistory.createMany({
            data,
            skipDuplicates: true,
        });
    }
}
