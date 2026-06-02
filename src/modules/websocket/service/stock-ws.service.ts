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

        // 초기 데이터 전송
        this.sendStockInfo(stockId);
        this.sendOrderBook(stockId);
        this.sendMatchedList(stockId);
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
    // @TODO Redis
    async sendStockInfo(stockId: number) {
        const today = getKstDate();
        const yesterday = getKstDate(-1);

        // 주식 기본 정보 조회
        const stockDB = await this.prismaService.stock.findUnique({
            where: { id: stockId },
            select: { id: true, name: true, price: true },
        });

        let stock = {
            ...stockDB,
            price: stockDB.price.toString(),
        };

        // 오늘 주식 가격 정보 조회
        let stockHistoryDB = await this.prismaService.stockHistory.findUnique({
            where: { stockId_date: { stockId: stockId, date: today } },
        });

        const stockHistory = {
            low: stockHistoryDB?.low.toString() ?? stock.price,
            high: stockHistoryDB?.high.toString() ?? stock.price,
            close: stockHistoryDB?.close.toString() ?? stock.price,
            open: stockHistoryDB?.open?.toString() ?? stock.price,
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

        let data = {
            ...stock,
            previousClose,
            ...stockHistory,
        };

        this.server.to('stockId_' + stockId.toString()).emit('stockInfoUpdated', data);
    }

    // 호가창 데이터 전송
    async sendOrderBook(stockId: number) {
        // 매수호가 Redis 조회
        let buyOrderbook = [];
        const redisBuyOrderbook = await this.redis.zrevrange(
            `orderbook:${stockId}:buy`,
            0,
            9,
            'WITHSCORES',
        );

        // 만약에 없다면 DB 조회
        if (redisBuyOrderbook.length === 0) {
            buyOrderbook = await this.prismaService.$queryRaw`
            SELECT price, SUM(number - match_number) AS number
            FROM orders o
            WHERE stock_id = ${stockId} AND trading_type = "buy" AND status = "n"
            GROUP BY trading_type, price
            ORDER BY price DESC
            `;

            buyOrderbook = buyOrderbook.map((row) => ({
                ...row,
                price: row.price.toString(),
                number: row.number.toString(),
            }));

            // Redis 캐싱 (score=price, member=number)
            const pipeline = this.redis.pipeline();
            for (const row of buyOrderbook) {
                pipeline.zadd(`orderbook:${stockId}:buy`, row.price, row.number);
            }
            await pipeline.exec();

            buyOrderbook = buyOrderbook.slice(0, 10);
        } else {
            for (let i = 0; i < redisBuyOrderbook.length; i += 2) {
                buyOrderbook.push({
                    number: redisBuyOrderbook[i],
                    price: redisBuyOrderbook[i + 1],
                });
            }
        }

        // 매도 호가 Redis 조회
        let sellOrderbook = [];
        const redisSellOrderbook = await this.redis.zrange(
            `orderbook:${stockId}:sell`,
            0,
            9,
            'WITHSCORES',
        );

        // 만약에 없다면 DB 조회
        if (redisSellOrderbook.length === 0) {
            sellOrderbook = await this.prismaService.$queryRaw`
            SELECT price, SUM(number - match_number) AS number
            FROM orders o
            WHERE stock_id = ${stockId} AND trading_type = "sell" AND status = "n"
            GROUP BY trading_type, price
            ORDER BY price ASC
            `;

            sellOrderbook = sellOrderbook.map((row) => ({
                ...row,
                price: row.price.toString(),
                number: row.number.toString(),
            }));

            // Redis 캐싱 (score=price, member=number)
            const pipeline = this.redis.pipeline();
            for (const row of sellOrderbook) {
                pipeline.zadd(`orderbook:${stockId}:sell`, row.price, row.number);
            }
            await pipeline.exec();

            sellOrderbook = sellOrderbook.slice(0, 10);
        } else {
            for (let i = 0; i < redisSellOrderbook.length; i += 2) {
                sellOrderbook.push({
                    number: redisSellOrderbook[i],
                    price: redisSellOrderbook[i + 1],
                });
            }
        }

        const data = {
            buyOrderbook,
            sellOrderbook,
        };

        this.server.to('stockId_' + stockId.toString()).emit('orderBookUpdated', data);
    }

    // 체결 기록 전송
    async sendMatchedList(stockId: number) {
        const key = `matchedList:${stockId}`;
        const redisMatchedList = await this.redis.lrange(key, 0, -1);
        let matchedList = [];

        // Redis에 캐싱된 값이 없다면
        if (redisMatchedList.length === 0) {
            matchedList = await this.prismaService.$queryRaw`
              select (select price from orders o where o.id = om.initial_order_id) as price, number, (select trading_type from orders o where o.id = om.order_id) as type
              from order_matches om where stock_id = ${stockId}
              order by matched_at desc limit 50;
            `;

            matchedList = matchedList.map((row) => ({
                ...row,
                price: row.price.toString(),
                number: row.number.toString(),
            }));

            // Redis 캐싱
            if (matchedList.length > 0) {
                await this.redis.rpush(
                    key,
                    ...matchedList.map((item) => JSON.stringify(item)),
                );
            }
        } else matchedList = redisMatchedList.map((d) => JSON.parse(d));

        this.server
            .to('stockId_' + stockId.toString())
            .emit('sendMatchedListUpdated', matchedList);
    }

    async updateMatchedList(
        type: 'buy' | 'sell' | 'edit' | 'cancel',
        stockId: number,
        matchedList: { price: number; number: number }[],
    ) {
        if (matchedList.length === 0) return;
        await this.redis.lpush(
            `matchedList:${stockId}`,
            ...matchedList.map((item) => {
                return JSON.stringify({
                    price: item.price.toString(),
                    number: item.number.toString(),
                    type,
                });
            }),
        );
        await this.redis.ltrim(`matchedList:${stockId}`, 0, 49);
    }

    // 호가창을 업데이트 함수
    async updateOrderbook(
        type: 'buy' | 'sell' | 'edit' | 'cancel',
        stockId: number,
        orders: Order[],
        matchedList: { price: number; number: number }[],
        prevOrderPrice: number,
    ) {
        // score=price, member=number 구조에서 특정 price의 수량을 delta만큼 조정하는 스크립트
        // ARGV[1]=delta, ARGV[2]=price(score)
        const script = `
                local members = redis.call('zrangebyscore', KEYS[1], ARGV[2], ARGV[2])
                if #members > 0 then
                    local oldNumber = tonumber(members[1])
                    local newNumber = oldNumber + tonumber(ARGV[1])
                    redis.call('zrem', KEYS[1], members[1])
                    if newNumber > 0 then
                        redis.call('zadd', KEYS[1], ARGV[2], tostring(newNumber))
                    end
                    return newNumber
                else
                    if tonumber(ARGV[1]) > 0 then
                        redis.call('zadd', KEYS[1], ARGV[2], ARGV[1])
                    end
                    return ARGV[1]
                end
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
                await this.redis.eval(script, 1, key, amount, price);
            }
        } else {
            // 여러 호가 업데이트
            const key = `orderbook:${stockId}:${type === 'buy' ? 'sell' : 'buy'}`;

            // 같은 가격대 갯수 합산
            const merged = matchedList.reduce(
                (acc, { price, number }) => {
                    acc[price] = (acc[price] ?? 0) + number;
                    return acc;
                },
                {} as Record<number, number>,
            );

            // 객체를 [[key, value]]로 변환후 Redis 동시 반영
            await Promise.all(
                Object.entries(merged).map(([price, number]) =>
                    this.redis.eval(script, 1, key, -number, price),
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
