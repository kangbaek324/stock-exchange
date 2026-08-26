import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma, StockStatus } from '@prisma/client';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom, retry, timer } from 'rxjs';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { StockException } from './error/stock.exception';
import { StockDto } from './dto/stock.dto';
import { StockMessage } from './type/stock-message.type';
import { ADMIN_SERVICE } from 'src/common/messaging/messaging.module';
import { StockLimitService } from '../order/services/stock-limit.service';

// stock.list 발행에 필요한 필드
const STOCK_MESSAGE_SELECT = {
    id: true,
    price: true,
    status: true,
} satisfies Prisma.StockSelect;

type PublishableStock = Prisma.StockGetPayload<{
    select: typeof STOCK_MESSAGE_SELECT;
}>;

const PUBLISH_RETRY = {
    count: 3,
    delay: (_err: unknown, n: number) => timer(100 * 2 ** n),
};

@Injectable()
export class StockService {
    private readonly logger = new Logger(StockService.name);

    constructor(
        @Inject(ADMIN_SERVICE) private client: ClientProxy,
        private readonly prismaService: PrismaService,
        private readonly stockLimitService: StockLimitService,
    ) {}

    // 주식 상장
    // 1. DB 주식 생성 (status: PENDING)
    // 2. MQ 발행 시도
    //  2-1. 성공시 -> (publishedAt) 마킹
    //  2-2. 실패시 -> (status: PENDING) 유지 및 별도 릴레이가 발행시도
    async createStock(dto: StockDto) {
        const stock = await this.prismaService.$transaction(async (tx) => {
            const isExist = await tx.stock.findUnique({
                where: { name: dto.name },
                select: { id: true },
            });

            if (isExist) throw new StockException('STOCK_ALREADY_EXIST');

            const created = await tx.stock.create({
                data: {
                    name: dto.name,
                    price: dto.listingPrice,
                    listingPrice: dto.listingPrice,
                },
                select: STOCK_MESSAGE_SELECT,
            });

            return created;
        });

        await this.publishStockAndMark(stock);
    }

    // MQ에 stock.list 발행 후 성공시 마킹
    private async publishStockAndMark(stock: PublishableStock) {
        try {
            await lastValueFrom(
                this.client
                    .emit('stock.list', this.toStockMessage(stock))
                    .pipe(retry(PUBLISH_RETRY)),
            );
        } catch (err) {
            this.logger.warn(
                `Failed to publish stock.list (stockId=${stock.id})`,
                err instanceof Error ? err.stack : err,
            );
            return;
        }

        await this.prismaService.stock.update({
            where: { id: stock.id },
            data: { publishedAt: new Date() },
        });
    }

    // 릴레이용: 아직 큐 적재 안 된(PENDING·publishedAt=null) 주식을 재발행
    async republishPendingStocks() {
        const pending = await this.prismaService.stock.findMany({
            where: {
                publishedAt: null,
                status: StockStatus.PENDING,
                createdAt: { lt: new Date(Date.now() - 2000) },
            },
            select: STOCK_MESSAGE_SELECT,
            take: 100,
            orderBy: { id: 'asc' },
        });

        for (const stock of pending) {
            await this.publishStockAndMark(stock);
        }
    }

    private toStockMessage(stock: PublishableStock): StockMessage {
        return {
            id: stock.id.toString(),
            price: stock.price.toString(),
            status: stock.status,
        };
    }

    // 상장된 주식 목록 조회 (상장 전 PENDING 제외, 등락률 내림차순)
    async getStockList() {
        const stocks = await this.prismaService.stock.findMany({
            where: { status: { not: StockStatus.PENDING } },
            select: { id: true, name: true, price: true, status: true },
        });

        const withChangeRate = await Promise.all(
            stocks.map(async (stock) => {
                const prevClose = await this.stockLimitService.getPrevClose(stock.id);
                const rate =
                    prevClose && prevClose > 0n
                        ? (Number(stock.price - prevClose) / Number(prevClose)) * 100
                        : 0;

                return {
                    ...stock,
                    price: stock.price.toString(),
                    changeRate: Math.round(rate * 100) / 100,
                };
            }),
        );

        return withChangeRate.sort((a, b) => b.changeRate - a.changeRate);
    }

    // async getStockInfo(stockId: number) { ... }
    // async updateStockStatus(dto: StockStatusDto, stockId: number) { ... }
}
