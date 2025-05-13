import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersValidationService } from './orders-validation.service';
import { OrdersExecutionService } from './orders-execution.service';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, OrdersValidationService, OrdersExecutionService],
})

export class OrdersModule {}
