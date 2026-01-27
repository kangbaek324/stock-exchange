import { Module } from '@nestjs/common';
import { OrdersModule } from './orders/orders.module';
import { InfoModule } from './info/info.module';

@Module({
    imports: [OrdersModule, InfoModule],
})

export class StockModule {}
