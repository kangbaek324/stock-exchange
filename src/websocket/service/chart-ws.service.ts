import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { CustomSocket } from '../interface/custom-socket.interface';
import { ChartException } from 'src/stock/chart/error/chart.exception';
import { StockException } from 'src/stock/error/stock.exception';
import Redis from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';

/**
 *  @TODO
 *  Redis에 들어가는 숫자값이 모두 String으로 들어가고 있음
 *  JSON.parse를 하게되면 원래 숫자값을 알아서 복원해주기때문에 number로 변환해서 넣도록 하는게 좋을것 같음
 *  지금 코드에서 UpdfaetChart voulme부분만 숫자로 저장되고 있음
 */
@Injectable()
export class ChartWsService {
    constructor(
        private readonly prismaService: PrismaService,
        @InjectRedis() private readonly redis: Redis,
    ) {}
    private server: Server;

    setServer(server: Server) {
        this.server = server;
    }

    onJoinChartWsRoom(stockId: number, type: ChartType, client: CustomSocket) {
        const stockIdToString = stockId.toString();
        client.join(`chart_${stockIdToString}_${type}`);
    }

    onLeaveChartWsRoom(stockId: number, type: ChartType, client: CustomSocket) {
        client.leave(`chart_${stockId.toString()}_${type}`);
    }

    async getCurrentCandle(stockId: number, type: ChartType) {
        await this.prismaService.stock
            .findUniqueOrThrow({
                where: { id: stockId },
            })
            .catch(() => {
                throw new StockException('STOCK_NOT_FOUND');
            });

        // Redis 데이터 조회
        const redisData = await this.redis.lrange(`chart:${stockId}:${type}`, -1, -1);

        // Redis 데이터가 없는 경우에는 DB조회 후 반환
        if (redisData.length === 0) {
            let chartData;

            switch (type) {
                case '1m':
                case '5m':
                case '15m':
                case '30m':
                case '60m': {
                    const time = type.slice(0, -1);

                    const chartDataDB: any[] = await this.prismaService.$queryRaw`
                                SELECT 
                                    DATE_FORMAT(om.matched_at, CONCAT('%Y-%m-%dT%H:', LPAD(FLOOR(MINUTE(om.matched_at) / ${time}) * ${time}, 2, '0'), ':00.000Z')) as time,
                                    SUBSTRING_INDEX(GROUP_CONCAT(o.price ORDER BY om.matched_at ASC, om.id ASC), ',', 1) AS open,
                                    MAX(o.price) AS high,
                                    MIN(o.price) AS low,
                                    SUBSTRING_INDEX(GROUP_CONCAT(o.price ORDER BY om.matched_at DESC, om.id DESC), ',', 1) AS close,
                                    SUM(om.number) AS volume
                                FROM
                                    order_matches om
                                JOIN
                                    orders o 
                                ON
                                    o.id = om.initial_order_id
                                WHERE 
                                    om.stock_id = ${stockId}
                                GROUP BY time
                                ORDER BY time DESC
                                limit 1;
                            `;

                    chartData = chartDataDB.map((data) => ({
                        ...data,
                        high: data.high.toString(),
                        low: data.low.toString(),
                        close: data.close.toString(),
                        open: data.open.toString(),
                        volume: data.volume.toString(),
                    }));

                    break;
                }

                case '1d': {
                    const chartDataDB: any[] = await this.prismaService.$queryRaw`
                                SELECT 
                                    DATE_FORMAT(sh.date, '%Y-%m-%dT00:00:00.000Z') AS time,
                                    sh.high,
                                    sh.low,
                                    sh.close,
                                    sh.open,
                                    COALESCE(SUM(om.number), 0) AS volume
                                FROM stock_histories sh
                                LEFT JOIN order_matches om 
                                    ON om.stock_id = sh.stock_id 
                                    AND DATE(om.matched_at) = sh.date
                                WHERE sh.stock_id = ${stockId}
                                GROUP BY sh.date, sh.high, sh.low, sh.close, sh.open
                                ORDER BY sh.date
                                limit 1;
                                `;

                    chartData = chartDataDB.map((data) => ({
                        ...data,
                        high: data.high.toString(),
                        low: data.low.toString(),
                        close: data.close.toString(),
                        open: data.open.toString(),
                        volume: data.volume.toString(),
                    }));

                    break;
                }

                default:
                    throw new ChartException('NOT_SUPPORT_TYPE');
            }

            if (chartData.length > 0) {
                await this.redis.rpush(
                    `chart:${stockId}:${type}`,
                    ...chartData.map((d) => JSON.stringify(d)),
                );
            }
            return chartData;
        } else return redisData.map((d) => JSON.parse(d));
    }

    getCandleTime(matchedAt: Date, type: ChartType): string {
        const d = new Date(matchedAt);
        const minutes = d.getUTCMinutes();

        switch (type) {
            case '1m':
                d.setUTCMinutes(minutes, 0, 0);
                break;
            case '5m':
                d.setUTCMinutes(Math.floor(minutes / 5) * 5, 0, 0);
                break;
            case '15m':
                d.setUTCMinutes(Math.floor(minutes / 15) * 15, 0, 0);
                break;
            case '30m':
                d.setUTCMinutes(Math.floor(minutes / 30) * 30, 0, 0);
                break;
            case '60m':
                d.setUTCMinutes(0, 0, 0);
                break;
            case '1d':
                d.setUTCHours(0, 0, 0, 0);
                break;
        }

        return d.toISOString();
    }

    // 현재 봉 차트 전송
    async updateChart(
        stockId: number,
        nextPrice: number,
        volume: number,
        matchedAt: Date,
    ) {
        const chartmList: ChartType[] = ['1m', '5m', '15m', '30m', '60m', '1d'];

        // Redis 업데이트
        for (const type of chartmList) {
            const key = `chart:${stockId}:${type}`;
            const lastRaw = await this.redis.lindex(key, -1);
            const last = JSON.parse(lastRaw);

            const candleTime = this.getCandleTime(matchedAt, type); // 현재 봉 시작 시간
            if (last === null) continue;
            // 같은 봉 → 업데이트
            if (last.time === candleTime) {
                last.high = Math.max(last.high, nextPrice);
                last.low = Math.min(last.low, nextPrice);
                last.close = nextPrice;
                last.volume = Number(last.volume) + volume;
                await this.redis.lset(key, -1, JSON.stringify(last));
            } else {
                // 새 봉 → 추가
                const newCandle = {
                    time: candleTime,
                    open: nextPrice,
                    high: nextPrice,
                    low: nextPrice,
                    close: nextPrice,
                    volume,
                };
                await this.redis.rpush(key, JSON.stringify(newCandle));
                await this.redis.ltrim(key, -500, -1);
            }
        }

        await Promise.all(
            chartmList.map(async (m) => {
                this.server
                    .to(`chart_${stockId.toString()}_${m}`)
                    .emit(`chartUpdated_${m}`, await this.getCurrentCandle(stockId, m));
            }),
        );
    }
}
