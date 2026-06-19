import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Server } from 'socket.io';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { ChartType, CHART_TYPES, CANDLE_TYPE } from 'src/modules/chart/type/chart-type';
import { CustomSocket } from '../interface/custom-socket.interface';

export interface InMemoryCandle {
    candleTime: Date;
    open: bigint;
    high: bigint;
    low: bigint;
    close: bigint;
    volume: bigint;
}

export interface PendingCandle {
    stockId: number;
    type: ChartType;
    candle: InMemoryCandle;
}

@Injectable()
export class ChartWsService implements OnModuleInit {
    private readonly logger = new Logger(ChartWsService.name);
    private server: Server;
    private currentCandles = new Map<string, InMemoryCandle>();
    private pendingCandles: PendingCandle[] = [];

    constructor(private readonly prismaService: PrismaService) {}

    async onModuleInit() {
        await this.initializeCandles();
    }

    private async initializeCandles() {
        const stocks = await this.prismaService.stock.findMany({ select: { id: true } });

        for (const stock of stocks) {
            for (const type of CHART_TYPES) {
                await this.initializeCandleForType(stock.id, type);
            }
        }

        this.logger.log(`캔들 초기화 완료: currentCandles=${this.currentCandles.size}`);
    }

    private async initializeCandleForType(stockId: number, type: ChartType) {
        const lastCandle = await this.prismaService.candle.findFirst({
            where: { stockId, type: CANDLE_TYPE[type] },
            orderBy: { candleTime: 'desc' },
        });

        const now = new Date();
        const currentCandleTime = this.getCandleTime(now, type);

        // 마지막 저장 봉이 있으면 그 봉 다음 시간부터, 없으면 전체 조회
        const fromTime = lastCandle
            ? new Date(lastCandle.candleTime.getTime() + this.getDurationMs(type))
            : new Date(0);

        const trades = await this.prismaService.trade.findMany({
            where: { stockId, matchedAt: { gte: fromTime } },
            orderBy: { matchedAt: 'asc' },
        });

        if (trades.length === 0) return;

        // trades를 캔들 시간대별로 그룹핑
        const candleMap = new Map<number, InMemoryCandle>();
        for (const trade of trades) {
            const ct = this.getCandleTime(trade.matchedAt, type);
            const timeKey = ct.getTime();
            const existing = candleMap.get(timeKey);

            if (!existing) {
                candleMap.set(timeKey, {
                    candleTime: ct,
                    open: trade.price,
                    high: trade.price,
                    low: trade.price,
                    close: trade.price,
                    volume: trade.quantity,
                });
            } else {
                if (trade.price > existing.high) existing.high = trade.price;
                if (trade.price < existing.low) existing.low = trade.price;
                existing.close = trade.price;
                existing.volume += trade.quantity;
            }
        }

        // 현재 진행 중인 봉은 currentCandles, 나머지는 미저장 완성봉으로 바로 DB에 저장
        const currentTimeKey = currentCandleTime.getTime();
        for (const [timeKey, candle] of candleMap) {
            if (timeKey === currentTimeKey) {
                this.currentCandles.set(this.key(stockId, type), candle);
            } else {
                await this.prismaService.candle.upsert({
                    where: {
                        stockId_candleTime_type: {
                            stockId,
                            candleTime: candle.candleTime,
                            type: CANDLE_TYPE[type],
                        },
                    },
                    create: {
                        stockId,
                        candleTime: candle.candleTime,
                        type: CANDLE_TYPE[type],
                        open: candle.open,
                        high: candle.high,
                        low: candle.low,
                        close: candle.close,
                        volume: candle.volume,
                    },
                    update: {
                        open: candle.open,
                        high: candle.high,
                        low: candle.low,
                        close: candle.close,
                        volume: candle.volume,
                    },
                });
            }
        }
    }

    private getDurationMs(type: ChartType): number {
        switch (type) {
            case '1m':
                return 60_000;
            case '5m':
                return 300_000;
            case '15m':
                return 900_000;
            case '30m':
                return 1_800_000;
            case '1h':
                return 3_600_000;
            case '1d':
                return 86_400_000;
        }
    }

    setServer(server: Server) {
        this.server = server;
    }

    // util
    private key(stockId: number, type: ChartType): string {
        return `${stockId}:${type}`;
    }

    private chartRoom(stockId: number, type: ChartType): string {
        return `chart_${stockId}_${type}`;
    }

    private serializeCandle(candle: InMemoryCandle) {
        return {
            candleTime: candle.candleTime.toISOString(),
            open: candle.open.toString(),
            high: candle.high.toString(),
            low: candle.low.toString(),
            close: candle.close.toString(),
            volume: candle.volume.toString(),
        };
    }

    // 체결 시각을 해당 봉의 시작 시각으로 내림
    // 예: 14:53:27 체결, 1분봉이면 14:53:00, 5m봉이면 14:50:00 반환
    private getCandleTime(matchedAt: Date, type: ChartType): Date {
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
            case '1h':
                d.setUTCMinutes(0, 0, 0);
                break;
            case '1d': {
                const kstStr = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
                return new Date(kstStr + 'T00:00:00.000+09:00');
            }
        }

        return d;
    }

    async onJoinChartRoom(
        stockId: number,
        type: ChartType,
        client: CustomSocket,
        from?: Date,
    ) {
        client.join(this.chartRoom(stockId, type));

        // DB에서 from 이후 완성봉 조회
        const dbCandles = from
            ? await this.prismaService.candle.findMany({
                  where: {
                      stockId,
                      type: CANDLE_TYPE[type],
                      candleTime: { gte: from },
                  },
                  orderBy: { candleTime: 'asc' },
              })
            : [];

        const result = dbCandles.map((c) => ({
            candleTime: c.candleTime.toISOString(),
            open: c.open.toString(),
            high: c.high.toString(),
            low: c.low.toString(),
            close: c.close.toString(),
            volume: c.volume.toString(),
        }));

        // pendingCandles에서 from 이후 봉 추가
        for (const { stockId: pStockId, type: pType, candle } of this.pendingCandles) {
            if (pStockId !== stockId || pType !== type) continue;
            if (from && candle.candleTime < from) continue;

            result.push(this.serializeCandle(candle));
        }

        // 현재 진행 중인 봉 추가
        const current = this.currentCandles.get(this.key(stockId, type));
        if (current) {
            result.push(this.serializeCandle(current));
        }

        // NOTE: pendingCandles 배열의 순서가 어긋난 경우 방지
        result.sort((a, b) => a.candleTime.localeCompare(b.candleTime));

        client.emit('chartInit', result);
    }

    onLeaveChartRoom(stockId: number, type: ChartType, client: CustomSocket) {
        client.leave(this.chartRoom(stockId, type));
    }

    // 체결시 차트 업데이트
    onTradeExecuted(stockId: number, price: bigint, quantity: bigint, matchedAt: Date) {
        for (const type of CHART_TYPES) {
            const key = this.key(stockId, type);
            const candleTime = this.getCandleTime(matchedAt, type);
            const existing = this.currentCandles.get(key);

            // 현재 캔들 업데이트
            if (!existing) {
                // 새 봉 생성
                this.currentCandles.set(key, {
                    candleTime,
                    open: price,
                    high: price,
                    low: price,
                    close: price,
                    volume: quantity,
                });
            } else if (existing.candleTime.getTime() !== candleTime.getTime()) {
                // 새 봉 생성 (기존 봉 Pending 이전 후 생성)
                this.pendingCandles.push({ stockId, type, candle: existing });
                this.currentCandles.set(key, {
                    candleTime,
                    open: price,
                    high: price,
                    low: price,
                    close: price,
                    volume: quantity,
                });
            } else {
                // 기존 봉 업데이트
                if (price > existing.high) existing.high = price;
                if (price < existing.low) existing.low = price;
                existing.close = price;
                existing.volume += quantity;
            }

            // 이벤트 전송
            const candle = this.currentCandles.get(key);
            this.server
                ?.to(this.chartRoom(stockId, type))
                .emit('chartUpdated', this.serializeCandle(candle));
        }
    }

    // 현재 캔들 조회
    getCurrentCandle(stockId: number, type: ChartType): InMemoryCandle | undefined {
        return this.currentCandles.get(this.key(stockId, type));
    }

    // 상장 시 오늘 1d 봉 초기화 (상하한가 기준가 확보용)
    initListingCandle(stockId: number, listingPrice: bigint) {
        const key = this.key(stockId, '1d');
        if (this.currentCandles.has(key)) return;

        const kstStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
        const candleTime = new Date(kstStr + 'T00:00:00.000+09:00');

        this.currentCandles.set(key, {
            candleTime,
            open: listingPrice,
            high: listingPrice,
            low: listingPrice,
            close: listingPrice,
            volume: 0n,
        });
    }

    // Pending 캔들 꺼내기
    drainPending(): PendingCandle[] {
        const pending = this.pendingCandles;
        this.pendingCandles = [];
        return pending;
    }

    // Pending 캔들 복원
    // NOTE: drain 후 DB 저장 실패시 복원용
    returnPending(candles: PendingCandle[]) {
        this.pendingCandles = [...candles, ...this.pendingCandles];
    }

    // 자정에 진행 중인 1d 봉을 pending으로 이동
    flushDayCandles() {
        for (const [key, candle] of this.currentCandles.entries()) {
            if (key.endsWith(':1d')) {
                const stockId = parseInt(key.split(':')[0]);
                this.pendingCandles.push({ stockId, type: '1d', candle });
                this.currentCandles.delete(key);
            }
        }
    }
}
