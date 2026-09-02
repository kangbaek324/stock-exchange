import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { AccountAdminService } from './account-admin.service';

// 큐 적재에 실패해 RECEIVED로 남은 AdminRequest를 주기적으로 재발행하는 릴레이
@Injectable()
export class AdminRequestPublishRelay {
    private readonly logger = new Logger(AdminRequestPublishRelay.name);
    private running = false; // 중복 실행 방지

    constructor(private readonly accountAdminService: AccountAdminService) {}

    @Interval(3000)
    async relay() {
        if (this.running) return;
        this.running = true;
        try {
            await this.accountAdminService.republishPendingAdminRequests();
        } catch (err) {
            this.logger.error(
                'Failed to republish unpublished admin requests',
                err instanceof Error ? err.stack : err,
            );
        } finally {
            this.running = false;
        }
    }
}
