import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { StockException } from './error/stock.exception';
import { getKstDate } from 'src/common/helpers/get-kst-date';
import { StockDto } from './dto/stock.dto';
import { PrismaClient } from '@prisma/client';
import { StockLimitService } from './order/services/stock-limit.service';
import { OrderException } from './order/error/order.exception';
import { StockStatusDto } from './dto/stock-status.dto';

@Injectable()
export class StockService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly stockLimitService: StockLimitService,
    ) {}

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

    async getStockInfo(stockId: number) {
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

    async createStock(dto: StockDto) {
        await this.prismaService.$transaction(async (tx: PrismaClient) => {
            const isExist = await tx.stock.findUnique({
                where: { name: dto.name },
                select: { id: true },
            });

            if (isExist) throw new StockException('STOCK_ALREADY_EXIST');

            const stock = await tx.stock.create({
                data: {
                    name: dto.name,
                    price: dto.listingPrice,
                },
            });

            const limits = this.stockLimitService.getStockLimit(dto.listingPrice);

            await tx.stockHistory.create({
                data: {
                    stockId: stock.id,
                    open: dto.listingPrice,
                    high: dto.listingPrice,
                    low: dto.listingPrice,
                    close: dto.listingPrice,
                    date: getKstDate(0),
                    lowerLimit: limits.lowerLimit,
                    upperLimit: limits.upperLimit,
                },
            });
        });
    }

    async updateStockStatus(dto: StockStatusDto, stockId: number) {
        const isExistStock = await this.prismaService.stock.findUnique({
            where: { id: stockId },
            select: { id: true },
        });
        if (!isExistStock) throw new StockException('STOCK_NOT_FOUND');

        const stock = await this.prismaService.stock.update({
            where: { id: stockId },
            data: {
                status: dto.status,
            },
        });

        return {
            ...stock,
            price: stock.price.toString(),
        };
    }
}
