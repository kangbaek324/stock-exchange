import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersValidationService } from './orders-validation.service';
import { OrdersLogicService } from './orders-logic.service';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, OrdersValidationService, OrdersLogicService],
})

export class OrdersModule {}
