import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';

@Injectable()
export class InfoService {
    constructor(
        private readonly PrismaService: PrismaService
    ) {}

    async getStockList() {
        return await this.PrismaService.stocks.findMany();
    }

    async getSstockInfo(stockId: number) {
        return await this.PrismaService.stocks.findUnique({
            where: {
                id: stockId
            }
        });
    }
}
