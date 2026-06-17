import { Injectable } from '@nestjs/common';
import { CustomSocket } from '../interface/custom-socket.interface';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { Server } from 'socket.io';
import { getKstDate } from 'src/common/helpers/get-kst-date';

@Injectable()
export class StockWsService {
    private server: Server;
    constructor(private readonly prismaService: PrismaService) {}

    async setServer(server: Server) {
        this.server = server;
    }

    // utill
    private stockRoom(stockId: number) {
        return `stock_${stockId}`;
    }

    private stockPriceRoom(stockId: number) {
        return `stock_price_${stockId}`;
    }

    // join / leave
    onJoinStockRoom(stockId: number, client: CustomSocket) {
        client.join(this.stockRoom(stockId));

        // 초기 데이터 전송
        this.sendStockInfo(stockId);
        this.sendOrderBook(stockId);
        this.sendMatchedList(stockId);
    }

    onJoinStockPriceRoom(stockId: number, client: CustomSocket) {
        client.join(this.stockPriceRoom(stockId));
    }

    onLeaveStockRoom(stockId: number, client: CustomSocket) {
        client.leave(this.stockRoom(stockId));
    }

    onLeaveStockPriceRoom(stockId: number, client: CustomSocket) {
        client.leave(this.stockPriceRoom(stockId));
    }

    // 주식 가격과 호가창에 대한 정보 전송
    async sendStockInfo(stockId: number) {
        const today = getKstDate();
        const yesterday = getKstDate(-1);

        // 주식 기본 정보 조회
        const rawStock = await this.prismaService.stock.findUnique({
            where: { id: stockId },
            select: { id: true, name: true, price: true },
        });

        let stock = {
            ...rawStock,
            price: rawStock.price.toString(),
        };

        // 오늘 주식 가격 정보 조회
        let rawStockHistory = await this.prismaService.stockHistory.findUnique({
            where: { stockId_date: { stockId: stockId, date: today } },
        });

        const stockHistory = {
            low: rawStockHistory?.low.toString() ?? stock.price,
            high: rawStockHistory?.high.toString() ?? stock.price,
            close: rawStockHistory?.close.toString() ?? stock.price,
            open: rawStockHistory?.open?.toString() ?? stock.price,
            upperLimit: rawStockHistory?.upperLimit.toString(),
            lowerLimit: rawStockHistory?.lowerLimit.toString(),
        };

        // 전일 종가 조회
        const rawPreviousClose = await this.prismaService.stockHistory.findUnique({
            where: {
                stockId_date: {
                    stockId: stockId,
                    date: yesterday,
                },
            },
            select: { close: true },
        });

        // 전일 종가 조회시 만약 존재하지 않는다면
        // 레코드가 한개 = 오늘 상장이기 때문에 당일 시가를 반환한다.
        let previousClose = rawPreviousClose?.close.toString() ?? stockHistory.open;

        let data = {
            ...stock,
            previousClose,
            ...stockHistory,
        };

        this.server.to(this.stockRoom(stockId)).emit('stockInfoUpdated', data);
    }

    // 호가창 데이터 전송
    async sendOrderBook(stockId: number) {
        // 매수호가 조회
        let buyOrderbook: any[] = await this.prismaService.$queryRaw`
            SELECT price, SUM(quantity - filled_quantity) AS quantity
            FROM orders o
            WHERE stock_id = ${stockId} AND trading_type = 'BUY' AND status = 'OPEN'
            GROUP BY trading_type, price
            ORDER BY price DESC
            `;

        buyOrderbook = buyOrderbook
            .map((row) => ({
                ...row,
                price: row.price.toString(),
                quantity: row.quantity.toString(),
            }))
            .slice(0, 10);

        // 매도 호가 조회
        let sellOrderbook: any[] = await this.prismaService.$queryRaw`
            SELECT price, SUM(quantity - filled_quantity) AS quantity
            FROM orders o
            WHERE stock_id = ${stockId} AND trading_type = 'SELL' AND status = 'OPEN'
            GROUP BY trading_type, price
            ORDER BY price ASC
            `;

        sellOrderbook = sellOrderbook
            .map((row) => ({
                ...row,
                price: row.price.toString(),
                quantity: row.quantity.toString(),
            }))
            .slice(0, 10);

        const data = {
            buyOrderbook,
            sellOrderbook,
        };

        this.server.to(this.stockRoom(stockId)).emit('orderBookUpdated', data);
    }

    // 체결 기록 전송
    async sendMatchedList(stockId: number) {
        let matchedList: any[] = await this.prismaService.$queryRaw`
              select price, quantity, (select trading_type from orders o where o.id = t.taker_order_id) as type
              from trades t where stock_id = ${stockId}
              order by matched_at desc limit 50;
            `;

        matchedList = matchedList.map((row) => ({
            ...row,
            price: row.price.toString(),
            quantity: row.quantity.toString(),
        }));

        this.server.to(this.stockRoom(stockId)).emit('matchedListUpdated', matchedList);
    }

    // 프론트에서 계좌 연산을 위한 주식 가격 전송
    async sendStockPrice(stockId: number, price: number) {
        this.server.to(this.stockPriceRoom(stockId)).emit('stockPriceUpdated', price);
    }
}
