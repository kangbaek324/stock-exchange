import { Module } from '@nestjs/common';
import { OrdersModule } from './orders/orders.module';
import { AccountModule } from './account/account.module';

@Module({
    imports: [OrdersModule, AccountModule],
})

export class StockModule {}
