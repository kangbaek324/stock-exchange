import { Module } from '@nestjs/common';
import { OrdersModule } from './orders/orders.module';
import { AccountModule } from './account/account.module';
import { InfoModule } from './info/info.module';

@Module({
    imports: [OrdersModule, AccountModule, InfoModule],
})

export class StockModule {}
