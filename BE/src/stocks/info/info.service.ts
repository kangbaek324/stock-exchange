import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';

@Injectable()
export class InfoService {
    constructor(
        private readonly prismaService: PrismaService
    ) {}

    async getStockList() {
        const stocks = await this.prismaService.stocks.findMany();

        return stocks.map(stock => ({
            ...stock,
            price: stock.price.toString(),
        }));

    }

    async getSstockInfo(stockId: number) {
        let stock = await this.prismaService.stocks.findUnique({
            where: {
                id: stockId
            }
        });

        return { ...stock, price: stock.price.toString() }
    }
}
