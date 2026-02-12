import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { getKstDate } from 'src/common/helpers/get-kst-date';
import { PrismaService } from 'src/common/prisma/prisma.service';

@Injectable()
export class StockHistorySchedulerService {
    constructor(private readonly prismaService: PrismaService) {}

    // 일별 시세 세팅
    @Cron('0 0 15 * * *') // 12시 자정
    async handleStockHistoryDay() {
        const today = getKstDate(0);

        const stocks = await this.prismaService.stock.findMany();

        for (const stock of stocks) {
            const todayHistory = await this.prismaService.stockHistory.findUnique({
                where: {
                    stockId_date: {
                        stockId: stock.id,
                        date: today,
                    },
                },
            });

            if (!todayHistory) {
                const recentStockHistory =
                    await this.prismaService.stockHistory.findFirst({
                        where: { stockId: stock.id },
                        orderBy: { date: 'desc' },
                    });

                const beforeClose = recentStockHistory?.close ?? stock.price;

                await this.prismaService.stockHistory.upsert({
                    where: {
                        stockId_date: { stockId: stock.id, date: today },
                    },
                    create: {
                        stockId: stock.id,
                        date: today,
                        open: beforeClose,
                        close: beforeClose,
                        high: beforeClose,
                        low: beforeClose,
                    },
                    update: {},
                });
            }
        }
    }
}
