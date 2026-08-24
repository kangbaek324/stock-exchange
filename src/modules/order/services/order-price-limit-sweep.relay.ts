import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OrderPriceLimitSweepService } from './order-price-limit-sweep.service';

// 자정(UTC) 롤오버 직후 상하한가 이탈 주문을 정리하는 크론
@Injectable()
export class OrderPriceLimitSweepRelay {
    private readonly logger = new Logger(OrderPriceLimitSweepRelay.name);
    private running = false;

    constructor(private readonly sweepService: OrderPriceLimitSweepService) {}

    @Cron('5 0 0 * * *', { timeZone: 'UTC' }) // 00:00:05 UTC
    async sweep() {
        if (this.running) return;
        this.running = true;
        try {
            await this.sweepService.sweep();
        } catch (err) {
            this.logger.error(
                'Failed to sweep price-limit-violating orders',
                err instanceof Error ? err.stack : err,
            );
        } finally {
            this.running = false;
        }
    }
}
