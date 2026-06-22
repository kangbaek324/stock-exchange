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

        const now = new Date();
        const currentCandleTime = this.getCandleTime(now, type);

        // 현재 진행 중인 봉은 스킵(차트 조회 등의 직접적인 조회시에 복구)
        // 미저장 완성봉으로 바로 DB에 저장
        const currentTimeKey = currentCandleTime.getTime();
        for (const [timeKey, candle] of candleMap) {
            if (timeKey !== currentTimeKey) {
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
            case '1d':
                d.setUTCHours(0, 0, 0, 0);
                break;
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

        // 현재 진행 중인 봉 추가 (메모리 없으면 trades로 복구)
        const current =
            this.currentCandles.get(this.key(stockId, type)) ??
            (await this.recoverCurrentCandle(stockId, type));
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

    private buildCandleFromTrades(
        candleTime: Date,
        trades: { price: bigint; quantity: bigint }[],
    ): InMemoryCandle | null {
        if (trades.length === 0) return null;
        let high = trades[0].price;
        let low = trades[0].price;
        let volume = 0n;
        for (const t of trades) {
            if (t.price > high) high = t.price;
            if (t.price < low) low = t.price;
            volume += t.quantity;
        }
        return {
            candleTime,
            open: trades[0].price,
            high,
            low,
            close: trades[trades.length - 1].price,
            volume,
        };
    }

    async recoverCurrentCandle(
        stockId: number,
        type: ChartType,
    ): Promise<InMemoryCandle | undefined> {
        const key = this.key(stockId, type);

        const inMemory = this.currentCandles.get(key);
        if (inMemory) return inMemory;

        const candleTime = this.getCandleTime(new Date(), type);
        const trades = await this.prismaService.trade.findMany({
            where: { stockId, matchedAt: { gte: candleTime } },
            orderBy: { matchedAt: 'asc' },
            select: { price: true, quantity: true },
        });

        // await 사이에 onTradeExecuted가 먼저 채웠을 수 있으므로 재확인
        const inMemoryAfter = this.currentCandles.get(key);
        if (inMemoryAfter) return inMemoryAfter;

        const candle = this.buildCandleFromTrades(candleTime, trades);
        if (candle) {
            this.currentCandles.set(key, candle);
        }
        return candle ?? undefined;
    }

    // 체결시 차트 업데이트
    async onTradeExecuted(
        stockId: number,
        price: bigint,
        quantity: bigint,
        matchedAt: Date,
    ) {
        for (const type of CHART_TYPES) {
            const key = this.key(stockId, type);
            const candleTime = this.getCandleTime(matchedAt, type);
            const existing = this.currentCandles.get(key);

            // 현재 캔들 업데이트
            if (!existing || existing.candleTime.getTime() !== candleTime.getTime()) {
                // 기존 봉 pending 이전
                if (existing) {
                    this.pendingCandles.push({ stockId, type, candle: existing });
                }

                // 해당 시간대 trades로 봉 복구 (재시작 등으로 메모리 유실된 경우)
                const prevTrades = await this.prismaService.trade.findMany({
                    where: { stockId, matchedAt: { gte: candleTime, lt: matchedAt } },
                    orderBy: { matchedAt: 'asc' },
                    select: { price: true, quantity: true },
                });

                const recovered = this.buildCandleFromTrades(candleTime, [
                    ...prevTrades,
                    { price, quantity },
                ])!;
                this.currentCandles.set(key, recovered);
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

    // 현재 캔들 직접 등록 (외부 복구용)
    setCurrentCandle(stockId: number, type: ChartType, candle: InMemoryCandle): void {
        this.currentCandles.set(this.key(stockId, type), candle);
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
