import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { OrderService } from './order.service';

// 큐 적재에 실패해 RECEIVED로 남은 주문을 주기적으로 재발행하는 릴레이
@Injectable()
export class OrderPublishRelay {
    private readonly logger = new Logger(OrderPublishRelay.name);
    private running = false; // 중복 실행 방지

    constructor(private readonly orderService: OrderService) {}

    @Interval(3000)
    async relay() {
        if (this.running) return;
        this.running = true;
        try {
            await this.orderService.republishPending();
        } catch (err) {
            this.logger.error(
                '미발행 주문 재발행 실패',
                err instanceof Error ? err.stack : err,
            );
        } finally {
            this.running = false;
        }
    }
}
