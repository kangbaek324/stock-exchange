import { Module } from '@nestjs/common';
import { OrderController } from './controllers/order.controller';
import { StockOrderController } from './controllers/stock-order.controller';
import { OrderService } from './services/order.service';
import { OrderValidationService } from './services/order-validation.service';
import { StockLimitService } from './services/stock-limit.service';
import { OrderPublishRelay } from './services/order-publish.relay';
import { OrderPriceLimitSweepService } from './services/order-price-limit-sweep.service';
import { OrderPriceLimitSweepRelay } from './services/order-price-limit-sweep.relay';

@Module({
    controllers: [OrderController, StockOrderController],
    providers: [
        OrderService,
        OrderValidationService,
        StockLimitService,
        OrderPublishRelay,
        OrderPriceLimitSweepService,
        OrderPriceLimitSweepRelay,
    ],
    exports: [StockLimitService],
})
export class OrderModule {}
