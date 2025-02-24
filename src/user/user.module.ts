import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { OrderValidationService } from './order-validation.service';
import { OrderService } from './order.service';

@Module({
  controllers: [UserController],
  providers: [UserService, OrderValidationService, OrderService],
})
export class UserModule {}
