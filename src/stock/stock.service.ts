import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { StockException } from './error/stock.exception';
import { getKstDate } from 'src/common/helpers/get-kst-date';

@Injectable()
export class StockService {
    constructor(private readonly prismaService: PrismaService) {}

    // @TODO 현재 높은 동락률 순으로 제공 옵션 추가 필요
    async getStockList() {
        const stocks = await this.prismaService.stock.findMany({
            include: {
                stockHistory: { where: { date: getKstDate(-1) } },
            },
        });

        const result = await Promise.all(
            stocks.map(async (stock) => {
                let beforeClose = Number(stock.stockHistory[0]?.close);
                if (!beforeClose) {
                    const stockHistoryToday =
                        await this.prismaService.stockHistory.findUnique({
                            where: {
                                stockId_date: {
                                    date: getKstDate(0),
                                    stockId: stock.id,
                                },
                            },
                        });

                    beforeClose = Number(stockHistoryToday.open);
                }

                return {
                    id: stock.id,
                    name: stock.name,
                    price: stock.price.toString(),
                    per: (
                        ((Number(stock.price) - beforeClose) / beforeClose) *
                        100
                    ).toFixed(2),
                };
            }),
        );

        return result.sort((a, b) => Number(b.per) - Number(a.per));
    }

    async getSstockInfo(stockId: number) {
        let stock = await this.prismaService.stock.findUnique({
            where: {
                id: stockId,
            },
        });

        if (!stock) {
            throw new StockException('STOCK_NOT_FOUND');
        }

        return { ...stock, price: stock.price.toString() };
    }
}
