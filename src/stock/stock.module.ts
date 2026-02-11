import { Module } from '@nestjs/common';
import { OrderModule } from './order/order.module';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { ChartModule } from './chart/chart.module';

@Module({
    imports: [OrderModule, ChartModule],
    controllers: [StockController],
    providers: [StockService],
})
export class StockModule {}
