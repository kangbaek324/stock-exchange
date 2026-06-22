import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { StockService } from './stock.service';

// 큐 적재에 실패해 PENDING으로 남은 주식을 주기적으로 재발행하는 릴레이
@Injectable()
export class StockPublishRelay {
    private readonly logger = new Logger(StockPublishRelay.name);
    private running = false; // 중복 실행 방지

    constructor(private readonly stockService: StockService) {}

    @Interval(3000)
    async relay() {
        if (this.running) return;
        this.running = true;
        try {
            await this.stockService.republishPending();
        } catch (err) {
            this.logger.error(
                '미발행 주식 재발행 실패',
                err instanceof Error ? err.stack : err,
            );
        } finally {
            this.running = false;
        }
    }
}
