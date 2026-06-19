import { Injectable } from '@nestjs/common';
import { CandleType } from '@prisma/client';
import { CustomSocket } from '../interface/custom-socket.interface';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { Server } from 'socket.io';
import { getKstDate } from 'src/common/helpers/get-kst-date';
import { ChartWsService } from './chart-ws.service';
import { calcStockLimit } from 'src/common/helpers/stock-limit';

// TODO / CONSIDER: 체결 기록 및 호가창 전송시 매번 SQL 조회를 하는 중
// 캐싱 도입혹은 별도의 방법으로 DB 사용을 줄이면 좋을것 같음.
@Injectable()
export class StockWsService {
    private server: Server;
    constructor(
        private readonly prismaService: PrismaService,
        private readonly chartWsService: ChartWsService,
    ) {}

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

    onLeaveStockRoom(stockId: number, client: CustomSocket) {
        client.leave(this.stockRoom(stockId));
    }

    onJoinStockPriceRoom(stockId: number, client: CustomSocket) {
        client.join(this.stockPriceRoom(stockId));
    }

    onLeaveStockPriceRoom(stockId: number, client: CustomSocket) {
        client.leave(this.stockPriceRoom(stockId));
    }

    // 가격 및 호가창에 대한 정보 전송
    async sendStockInfo(stockId: number) {
        const yesterday = getKstDate(-1);

        const rawStock = await this.prismaService.stock.findUnique({
            where: { id: stockId },
            select: { id: true, name: true, price: true },
        });
        const stock = { ...rawStock, price: rawStock.price.toString() };

        const todayCandle = this.chartWsService.getCurrentCandle(stockId, '1d');
        const prevCandle = await this.prismaService.candle.findFirst({
            where: { stockId, type: CandleType.ONE_DAY, candleTime: yesterday },
            select: { close: true },
        });

        // NOTE: 오늘 거래가 없으면 currentCandles에 1d 봉이 없음
        // 이 경우 현재 주식 가격(기준가)을 시가로 사용
        const open = todayCandle?.open?.toString() ?? stock.price;

        // NOTE: 전날 캔들 정보가 없는 경우는 오늘 신규 상장인 케이스
        // 전날 캔들 정보가 없기 때문에 오늘 시가 반환
        const prevClose = prevCandle?.close?.toString() ?? open;

        // 상하한가 계산
        const limits = calcStockLimit(Number(prevClose));

        const data = {
            ...stock,
            prevClose,
            // NOTE: low, high, close가 없는 경우도 open과 동일한 케이스
            low: todayCandle?.low.toString() ?? stock.price,
            high: todayCandle?.high.toString() ?? stock.price,
            close: todayCandle?.close.toString() ?? stock.price,
            open,
            upperLimit: limits.upperLimit.toString(),
            lowerLimit: limits.lowerLimit.toString(),
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

        // 이벤트 전송
        this.server
            .to(this.stockRoom(stockId))
            .emit('orderBookUpdated', { buyOrderbook, sellOrderbook });
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
    async sendStockPrice(stockId: number, price: string) {
        this.server.to(this.stockPriceRoom(stockId)).emit('stockPriceUpdated', price);
    }
}
