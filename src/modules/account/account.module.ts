import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountAdminController } from './account-admin.controller';
import { AccountService } from './account.service';
import { AccountAdminService } from './account-admin.service';
import { AccountPublishRelay } from './account-publish.relay';
import { TransferPublishRelay } from './transfer-publish.relay';
import { AdminBalancePublishRelay } from './admin-balance-publish.relay';

@Module({
    controllers: [AccountController, AccountAdminController],
    providers: [
        AccountService,
        AccountAdminService,
        AccountPublishRelay,
        TransferPublishRelay,
        AdminBalancePublishRelay,
    ],
    exports: [AccountService],
})
export class AccountModule {}
