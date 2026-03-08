import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { getKstDate } from 'src/common/helpers/get-kst-date';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { StockException } from 'src/stock/error/stock.exception';
import { StockLimitService } from 'src/stock/order/services/stock-limit.service';

@Injectable()
export class StockHistorySchedulerService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly stockLimitService: StockLimitService,
    ) {}

    // 일별 시세 세팅
    @Cron('0 0 0 * * *', {
        timeZone: 'Asia/Seoul',
    }) // 12시 자정
    async handleStockHistoryDay() {
        const today = getKstDate(0);

        const stocks = await this.prismaService.stock.findMany();

        for (const stock of stocks) {
            const prevStockHistory = await this.prismaService.stockHistory.findFirst({
                where: { stockId: stock.id },
                orderBy: { date: 'desc' },
                select: { close: true },
            });
            if (!prevStockHistory) throw new StockException('STOCK_HISTORIES_NOT_FOUND');

            const prevClose = Number(prevStockHistory.close);
            const limits = this.stockLimitService.getStockLimit(prevClose);

            await this.prismaService.stockHistory.upsert({
                where: {
                    stockId_date: { stockId: stock.id, date: today },
                },
                create: {
                    stockId: stock.id,
                    date: today,
                    open: prevClose,
                    close: prevClose,
                    high: prevClose,
                    low: prevClose,
                    upperLimit: limits.upperLimit,
                    lowerLimit: limits.lowerLimit,
                },
                update: {},
            });
        }
    }
}
