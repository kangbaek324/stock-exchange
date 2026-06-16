import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { AccountPublishRelay } from './account-publish.relay';

@Module({
    controllers: [AccountController],
    providers: [AccountService, AccountPublishRelay],
})
export class AccountModule {}
