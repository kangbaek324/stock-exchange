import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { AccountService } from './account.service';

// 큐 적재에 실패해 PENDING으로 남은 계좌를 주기적으로 재발행하는 릴레이
@Injectable()
export class AccountPublishRelay {
    private readonly logger = new Logger(AccountPublishRelay.name);
    private running = false; // 중복 실행 방지

    constructor(private readonly accountService: AccountService) {}

    @Interval(3000)
    async relay() {
        if (this.running) return;
        this.running = true;
        try {
            await this.accountService.republishPendingAccounts();
        } catch (err) {
            this.logger.error(
                'Failed to republish unpublished accounts',
                err instanceof Error ? err.stack : err,
            );
        } finally {
            this.running = false;
        }
    }
}
