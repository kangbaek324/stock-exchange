import { Module } from '@nestjs/common';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { ChartModule } from './chart/chart.module';
import { StockLimitService } from 'src/order/services/stock-limit.service';
import { StockHistorySchedulerService } from './scheduler/stock-history.scheduler.service';

@Module({
    imports: [ChartModule],
    controllers: [StockController],
    providers: [StockService, StockLimitService, StockHistorySchedulerService],
})
export class StockModule {}
