import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { OrderValidationService } from './order-validation.service';
import { StockOrderController } from './stock-order.controller';

@Module({
    imports: [
        ClientsModule.register([
            {
                name: 'ORDER_SERVICE',
                transport: Transport.RMQ,
                options: {
                    urls: ['amqp://localhost:5672'],
                    queue: 'order_queue',
                    queueOptions: {
                        durable: true,
                    },
                    persistent: true,
                },
            },
        ]),
    ],
    controllers: [OrderController, StockOrderController],
    providers: [OrderService, OrderValidationService],
})
export class OrderModule {}
