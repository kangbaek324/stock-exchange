import { Module } from '@nestjs/common';
import { OrderController } from './controllers/order.controller';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { StockOrderController } from './controllers/stock-order.controller';
import { ConfigService } from '@nestjs/config';
import { OrderService } from './services/order.service';
import { OrderValidationService } from './services/order-validation.service';
import { StockLimitService } from './services/stock-limit.service';

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
    providers: [OrderService, OrderValidationService, StockLimitService],
})
export class OrderModule {}
