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

    onJoinStockRoom(stockId: number, client: CustomSocket) {
        const stockIdToString = stockId.toString();
        client.join('stockId_' + stockIdToString);

        // 초기 호가창 정보 전송
        this.updateStock(stockId);
    }

    onJoinStockPriceRoom(stockId: number, client: CustomSocket) {
        const stockIdToString = stockId.toString();
        client.join('stockId_price_' + stockIdToString);
    }

    // 주식 가격과 호가창에 대한 정보 전송
    // @TODO 현재는 전체 데이터 전송 최적화시 세부적으로 전송되도록 변경해야됨
    async updateStock(stockId: number) {
        const today = getKstDate();
        const yesterday = getKstDate(-1);

        // 주식 기본 정보 조회
        const stockInfoDB = await this.prismaService.stock.findUnique({
            where: { id: stockId },
            select: { id: true, name: true, price: true },
        });

        let stockInfo = {
            ...stockInfoDB,
            price: stockInfoDB.price.toString(),
        };

        // 가격 정보 조회
        let stockHistoryDB = await this.prismaService.stockHistory.findUnique({
            where: { stockId_date: { stockId: stockId, date: today } },
        });

        const stockHistory = {
            low: stockHistoryDB?.low.toString() ?? stockInfo.price,
            high: stockHistoryDB?.high.toString() ?? stockInfo.price,
            close: stockHistoryDB?.close.toString() ?? stockInfo.price,
            open: stockHistoryDB?.open.toString() ?? stockInfo.price,
        };

        // 전일 종가 조회
        const previousCloseDB = await this.prismaService.stockHistory.findUnique({
            where: {
                stockId_date: {
                    stockId: stockId,
                    date: yesterday,
                },
            },
            select: { close: true },
        });
        let previousClose = previousCloseDB?.close.toString() ?? stockInfo.price;

        // 호가창 조회
        let buyOrderbook: any[] = await this.prismaService.$queryRaw`
          SELECT price, SUM(number - match_number) AS number
          FROM orders o
          WHERE stock_id = ${stockId} AND trading_type = "buy" AND status = "n"
          GROUP BY trading_type, price
          ORDER BY price DESC
          LIMIT 10
        `;

        let sellOrderbook: any[] = await this.prismaService.$queryRaw`
          SELECT price, SUM(number - match_number) AS number
          FROM orders o
          WHERE stock_id = ${stockId} AND trading_type = "sell" AND status = "n"
          GROUP BY trading_type, price
          ORDER BY price ASC
          LIMIT 10
        `;

        let matchData: any[] = await this.prismaService.$queryRaw`
          select (select price from orders o where o.id = om.initial_order_id) as price, number, (select trading_type from orders o where o.id = om.order_id) as type
          from order_matches om where stock_id = ${stockId}
          order by matched_at desc limit 20;
        `;

        buyOrderbook = buyOrderbook.map((row) => ({
            ...row,
            price: row.price.toString(),
            number: row.number.toString(),
        }));

        sellOrderbook = sellOrderbook.map((row) => ({
            ...row,
            price: row.price.toString(),
            number: row.number.toString(),
        }));

        matchData = matchData.map((row) => ({
            ...row,
            price: row.price.toString(),
            number: row.number.toString(),
        }));

        let data = {
            stockInfo: {
                ...stockInfo,
                previousClose,
                ...stockHistory,
            },
            buyOrderbookData: buyOrderbook,
            sellOrderbookData: sellOrderbook,
            match: matchData,
        };

        // console.log(data);
        this.server.to('stockId_' + stockInfo.id.toString()).emit('stockUpdated', data);
    }

    // 프론트에서 계좌 연산을 위한 주식 가격 전송
    async updateStockPrice(stockId: number) {
        const stock = await this.prismaService.stock.findUnique({
            where: { id: stockId },
            select: { price: true },
        });

        const stockPrice = stock.price.toString();

        this.server
            .to('stockId_price_' + stockId.toString())
            .emit('stockPriceUpdated', stockPrice);
    }
}
