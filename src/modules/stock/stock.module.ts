import { Module } from '@nestjs/common';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { StockPublishRelay } from './stock-publish.relay';

@Module({
    controllers: [StockController],
    providers: [StockService, StockPublishRelay],
})
export class StockModule {}
