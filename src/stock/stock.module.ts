import { Module } from '@nestjs/common';
import { InfoModule } from './info/info.module';
import { UserModule } from './user/user.module';

@Module({
    imports : [InfoModule, UserModule]
})

export class StockModule {}
