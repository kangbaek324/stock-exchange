import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { StockException } from './error/stock.exception';

@Injectable()
export class StockService {
    constructor(private readonly prismaService: PrismaService) {}

    async getStockList() {
        const stocks = await this.prismaService.stock.findMany();

        return stocks.map((stock) => ({
            ...stock,
            price: stock.price.toString(),
        }));
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
