import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { AccountPublishRelay } from './account-publish.relay';
import { TransferPublishRelay } from './transfer-publish.relay';

@Module({
    controllers: [AccountController],
    providers: [AccountService, AccountPublishRelay, TransferPublishRelay],
    exports: [AccountService],
})
export class AccountModule {}
