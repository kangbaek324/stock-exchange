import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { AccountService } from './account.service';

// 큐 적재에 실패해 RECEIVED로 남은 송금을 주기적으로 재발행하는 릴레이
@Injectable()
export class TransferPublishRelay {
    private readonly logger = new Logger(TransferPublishRelay.name);
    private running = false; // 중복 실행 방지

    constructor(private readonly accountService: AccountService) {}

    @Interval(3000)
    async relay() {
        if (this.running) return;
        this.running = true;
        try {
            await this.accountService.republishPendingTransfers();
        } catch (err) {
            this.logger.error(
                'Failed to republish unpublished transfers',
                err instanceof Error ? err.stack : err,
            );
        } finally {
            this.running = false;
        }
    }
}
