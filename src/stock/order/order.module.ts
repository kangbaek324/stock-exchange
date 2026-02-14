import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { OrderValidationService } from './order-validation.service';
import { StockOrderController } from './stock-order.controller';
import { ConfigService } from '@nestjs/config';

@Module({
    imports: [
        ClientsModule.registerAsync([
            {
                name: 'ORDER_SERVICE',
                inject: [ConfigService],
                useFactory: (configService: ConfigService) => ({
                    transport: Transport.RMQ,
                    options: {
                        urls: [configService.get<string>('RABBITMQ_URL')],
                        queue: 'order_queue',
                        queueOptions: {
                            durable: true,
                        },
                        persistent: true,
                    },
                }),
            },
        ]),
    ],
    controllers: [OrderController, StockOrderController],
    providers: [OrderService, OrderValidationService],
})
export class OrderModule {}
