import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { ChartWsService, PendingCandle } from '../websocket/service/chart-ws.service';
import { CANDLE_TYPE } from './type/chart-type';

@Injectable()
export class ChartSchedulerService {
    private readonly logger = new Logger(ChartSchedulerService.name);

    constructor(
        private readonly prismaService: PrismaService,
        private readonly chartCandleService: ChartWsService,
    ) {}

    @Cron('0 0 0 * * *', { timeZone: 'UTC' }) // 매일 UTC 자정 (= KST 09:00)
    async onMidnight() {
        this.chartCandleService.flushDayCandles();
        await this.flushPendingCandles();
        this.logger.log('자정 일봉 저장 완료');
    }

    @Cron('0 * * * * *') // 매분 :00초
    async flushPendingCandles() {
        const pending = this.chartCandleService.drainPending();
        if (pending.length === 0) return;

        const failed: PendingCandle[] = [];

        for (const item of pending) {
            const { stockId, type, candle } = item;
            try {
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
            } catch (err) {
                this.logger.error(
                    `캔들 DB 저장 실패 (stockId=${stockId}, type=${type}, candleTime=${candle.candleTime.toISOString()})`,
                    err instanceof Error ? err.stack : err,
                );
                failed.push(item);
            }
        }

        if (failed.length > 0) {
            // 실패한 캔들은 큐 앞에 돌려넣어 다음 주기에 재시도
            this.chartCandleService.returnPending(failed);
            this.logger.warn(`${failed.length}개 캔들 저장 실패, 다음 주기에 재시도`);
        }

        const saved = pending.length - failed.length;
        if (saved > 0) this.logger.log(`${saved}개 캔들 DB 저장 완료`);
    }
}
