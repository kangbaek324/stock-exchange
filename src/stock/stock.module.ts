import { Module } from '@nestjs/common';
import { OrderModule } from './order/order.module';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';

@Module({
    imports: [OrderModule],
    controllers: [StockController],
    providers: [StockService],
})
export class StockModule {}
