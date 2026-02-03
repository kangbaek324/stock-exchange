import { Injectable } from '@nestjs/common';
import { CustomSocket } from '../interface/custom-socket.interface';
import { PrismaService } from 'src/common/prisma/prisma.service';
import dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import { Server } from 'socket.io';

dayjs.extend(utc);

@Injectable()
export class StockWsService {
    private server: Server;
    constructor(private readonly prismaService: PrismaService) {}

    setServer(server: Server) {
        this.server = server;
    }

    async onJoinStockRoom(stockId: number, client: CustomSocket) {
        const stockIdToString = stockId.toString();
        client.join('stockId_' + stockIdToString);

        // 초기 호가창 정보 전송
    }

    async updateStock(stockId: number) {
        const stockIdToString = stockId.toString();
        const today = dayjs().utc().format('YYYY-MM-DD');
        const yesterday = dayjs().utc().subtract(1, 'day').format('YYYY-MM-DD');
        let data = {};

        const stockInfoDB = await this.prismaService.stock.findUnique({
            where: {
                id: stockId,
            },
            select: {
                name: true,
                price: true,
            },
        });

        const stockInfo = {
            name: stockInfoDB.name,
            price: stockInfoDB.price.toString(),
        };

        let previousClose;
        const previousCloseDB = await this.prismaService.stockHistory.findUnique({
            where: {
                stockId_date: {
                    stockId: stockId,
                    date: new Date(yesterday),
                },
            },
            select: {
                close: true,
            },
        });
        if (previousCloseDB) previousClose = previousCloseDB.close.toString();
        else throw new Error('stock have not stockHistory');

        let stockHistoryDB = await this.prismaService.stockHistory.findUnique({
            where: { stockId_date: { stockId, date: new Date(today) } },
        });

        if (!stockHistoryDB) {
            stockHistoryDB = await this.prismaService.stockHistory.create({
                data: {
                    stockId: stockId,
                    date: new Date(today),
                    low: previousClose,
                    high: previousClose,
                    close: previousClose,
                    open: previousClose,
                },
            });
        }

        const stockHistory = {
            stockId: stockHistoryDB.stockId,
            data: new Date(today),
            low: stockHistoryDB.low.toString(),
            high: stockHistoryDB.high.toString(),
            close: stockHistoryDB.close.toString(),
            open: stockHistoryDB.open.toString(),
        };

        let buyOrderbookData: any[] = await this.prismaService.$queryRaw`
      SELECT trading_type, price, SUM(number - match_number) AS number
      FROM \`order\` o
      WHERE stock_id = ${stockId} AND trading_type = "buy" AND status = "n" 
      GROUP BY trading_type, price
      ORDER BY price DESC
      LIMIT 10
    `;

        let sellOrderbookData: any[] = await this.prismaService.$queryRaw`
      SELECT trading_type, price, SUM(number - match_number) AS number
      FROM \`order\` o
      WHERE stock_id = ${stockId} AND trading_type = "sell" AND status = "n" 
      GROUP BY trading_type, price
      ORDER BY price ASC
      LIMIT 10
    `;

        let matchData: any[] = await this.prismaService.$queryRaw`
      select (select price from \`order\` o where o.id = om.initial_order_id) as price, number, (select trading_type from \`order\` o where o.id = om.order_id) as type
      from order_match om where stock_id = ${stockId}
      order by matched_at desc limit 20;
    `;

        for (let i = 0; i < buyOrderbookData.length; i++) {
            buyOrderbookData[i].price = buyOrderbookData[i].price.toString();
        }

        for (let i = 0; i < sellOrderbookData.length; i++) {
            sellOrderbookData[i].price = sellOrderbookData[i].price.toString();
        }

        for (let i = 0; i < matchData.length; i++) {
            matchData[i].price = matchData[i].price.toString();
            matchData[i].number = matchData[i].number.toString();
        }

        data = {
            stockInfo: stockInfo,
            stockHistory: stockHistory,
            previousClose: previousClose,
            buyOrderbookData: buyOrderbookData,
            sellOrderbookData: sellOrderbookData,
            match: matchData,
        };

        this.server.to('stockId_' + stockIdToString).emit('stockUpdated', data);
    }
}
