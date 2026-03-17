import { Injectable } from '@nestjs/common';
import { CustomSocket } from '../interface/custom-socket.interface';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { Server } from 'socket.io';
import { getKstDate } from 'src/common/helpers/get-kst-date';
import Redis from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Order, Prisma, TradingType } from '@prisma/client';

@Injectable()
export class StockWsService {
    private server: Server;
    constructor(
        private readonly prismaService: PrismaService,
        @InjectRedis() private readonly redis: Redis,
    ) {}

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

    onLeaveStockRoom(stockId: number, client: CustomSocket) {
        client.leave('stockId_' + stockId.toString());
    }

    onLeaveStockPriceRoom(stockId: number, client: CustomSocket) {
        client.leave('stockId_price_' + stockId.toString());
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

        // 오늘 주식 가격 정보 조회
        let stockHistoryDB = await this.prismaService.stockHistory.findUnique({
            where: { stockId_date: { stockId: stockId, date: today } },
        });

        const stockHistory = {
            low: stockHistoryDB?.low.toString() ?? stockInfo.price,
            high: stockHistoryDB?.high.toString() ?? stockInfo.price,
            close: stockHistoryDB?.close.toString() ?? stockInfo.price,
            open: stockHistoryDB?.open?.toString() ?? stockInfo.price,
            upperLimit: stockHistoryDB?.upperLimit.toString(),
            lowerLimit: stockHistoryDB?.lowerLimit.toString(),
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

        // 전일 종가 조회시 만약 존재하지 않는다면
        // 레코드가 한개 = 오늘 상장이기 때문에 당일 시가를 반환한다.
        let previousClose = previousCloseDB?.close.toString() ?? stockHistory.open;

        // 매수호가 Redis 조회
        let buyOrderbook = [];
        let redisBuyOrderbook = await this.redis.zrevrange(
            `orderbook:${stockId}:buy`,
            0,
            9,
            'WITHSCORES',
        );
        if (redisBuyOrderbook.length === 0) {
            buyOrderbook = await this.prismaService.$queryRaw`
            SELECT price, SUM(number - match_number) AS number
            FROM orders o
            WHERE stock_id = ${stockId} AND trading_type = "buy" AND status = "n"
            GROUP BY trading_type, price
            ORDER BY price DESC
            LIMIT 10
            `;

            buyOrderbook = buyOrderbook.map((row) => ({
                ...row,
                price: row.price.toString(),
                number: row.number.toString(),
            }));

            // Redis 캐싱
            const pipeline = this.redis.pipeline();
            for (const row of buyOrderbook) {
                pipeline.zadd(`orderbook:${stockId}:buy`, Number(row.number), row.price);
            }
            await pipeline.exec();
        } else {
            for (let i = 0; i < redisBuyOrderbook.length; i += 2) {
                buyOrderbook.push({
                    price: redisBuyOrderbook[i],
                    number: redisBuyOrderbook[i + 1],
                });
            }
        }

        // 매도 호가 Redis 조회
        let sellOrderbook = [];
        let redisSellOrderbook = await this.redis.zrange(
            `orderbook:${stockId}:sell`,
            0,
            9,
            'WITHSCORES',
        );
        if (redisSellOrderbook.length === 0) {
            sellOrderbook = await this.prismaService.$queryRaw`
            SELECT price, SUM(number - match_number) AS number
            FROM orders o
            WHERE stock_id = ${stockId} AND trading_type = "sell" AND status = "n"
            GROUP BY trading_type, price
            ORDER BY price ASC
            LIMIT 10
            `;

            sellOrderbook = sellOrderbook.map((row) => ({
                ...row,
                price: row.price.toString(),
                number: row.number.toString(),
            }));

            // Redis 캐싱
            const pipeline = this.redis.pipeline();
            for (const row of sellOrderbook) {
                pipeline.zadd(`orderbook:${stockId}:sell`, Number(row.number), row.price);
            }
            await pipeline.exec();
        } else {
            for (let i = 0; i < redisSellOrderbook.length; i += 2) {
                sellOrderbook.push({
                    price: redisSellOrderbook[i],
                    number: redisSellOrderbook[i + 1],
                });
            }
        }

        // 체결 주문 조회 (최대 50개)
        let matchData: any[] = await this.prismaService.$queryRaw`
          select (select price from orders o where o.id = om.initial_order_id) as price, number, (select trading_type from orders o where o.id = om.order_id) as type
          from order_matches om where stock_id = ${stockId}
          order by matched_at desc limit 50;
        `;

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

        this.server.to('stockId_' + stockInfo.id.toString()).emit('stockUpdated', data);
    }

    // 매칭 서버의 결과를 토대로 호가창을 업데이트 하는 함수
    async updateOrderbook(
        type: 'buy' | 'sell' | 'edit' | 'cancel',
        stockId: number,
        orders: Order[],
        matchedList: { price: number; amount: number }[],
        prevOrderPrice: number,
    ) {
        // 0이 되면 삭제하는 스크립트 (Redis 동시성)
        const script = `
                local val = redis.call('zincrby', KEYS[1], ARGV[1], ARGV[2])
                if tonumber(val) <= 0 then
                    redis.call('zrem', KEYS[1], ARGV[2])
                end
                return val
            `;

        // 단일 호가 업데이트
        if (matchedList.length === 0) {
            const order = orders[0];
            const key = `orderbook:${stockId}:${order.tradingType}`;
            const price = Number(order.price);
            let amount = Number(order.number - order.matchNumber);

            // 취소 주문이면 호가에서 차감
            if (type === 'cancel') {
                await this.redis.eval(script, 1, key, -amount, price);
            } else if (type === 'edit') {
                await this.redis.eval(script, 1, key, amount, price);
                await this.redis.eval(script, 1, key, -amount, prevOrderPrice);
            } else {
                await this.redis.zincrby(key, amount, price);
            }
        } else {
            // 여러 호가 업데이트
            const key = `orderbook:${stockId}:${type === 'buy' ? 'sell' : 'buy'}`;

            // 같은 가격대 갯수 합산
            const merged = matchedList.reduce(
                (acc, { price, amount }) => {
                    acc[price] = (acc[price] ?? 0) + amount;
                    return acc;
                },
                {} as Record<number, number>,
            );

            console.log(merged);

            // 객체를 [[key, value]]로 변환후 Redis 동시 반영
            await Promise.all(
                Object.entries(merged).map(([price, amount]) =>
                    this.redis.eval(script, 1, key, -amount, price),
                ),
            );
        }
    }

    // 프론트에서 계좌 연산을 위한 주식 가격 전송
    async updateStockPrice(stockId: number, price: number) {
        this.server
            .to('stockId_price_' + stockId.toString())
            .emit('stockPriceUpdated_' + stockId, price);
    }
}
