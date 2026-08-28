import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountAdminController } from './account-admin.controller';
import { AccountService } from './account.service';
import { AccountPublishRelay } from './account-publish.relay';
import { TransferPublishRelay } from './transfer-publish.relay';

@Module({
    controllers: [AccountController, AccountAdminController],
    providers: [AccountService, AccountPublishRelay, TransferPublishRelay],
    exports: [AccountService],
})
export class AccountModule {}
