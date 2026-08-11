import { Module } from '@nestjs/common';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { StockPublishRelay } from './stock-publish.relay';
import { OrderModule } from '../order/order.module';

@Module({
    imports: [OrderModule],
    controllers: [StockController],
    providers: [StockService, StockPublishRelay],
})
export class StockModule {}
