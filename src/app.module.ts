import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { OrderModule } from './modules/order/order.module';
import { AccountModule } from './modules/account/account.module';
import { StockModule } from './modules/stock/stock.module';
import { ChartModule } from './modules/chart/chart.module';
import { MessagingModule } from './common/messaging/messaging.module';
import { WebsocketModule } from './modules/websocket/websocket.module';
import { ConfigModule } from '@nestjs/config';
import { LoggerMiddleware } from './middlewares/logger.middleware';
import { AppController } from './app.controller';
import { ScheduleModule } from '@nestjs/schedule';
// import { RedisModule } from '@nestjs-modules/ioredis';
// import { ConfigService } from '@nestjs/config';

@Module({
    controllers: [AppController],
    imports: [
        // RedisModule.forRootAsync({
        //     inject: [ConfigService],
        //     useFactory: (config: ConfigService) => ({
        //         type: 'single',
        //         options: {
        //             host: config.get('REDIS_HOST'),
        //             port: Number(config.get('REDIS_PORT')),
        //             password: config.get('REDIS_PASSWORD'),
        //         },
        //     }),
        // }),
        ConfigModule.forRoot({ isGlobal: true }),
        ScheduleModule.forRoot(),
        MessagingModule,
        AuthModule,
        PrismaModule,
        OrderModule,
        AccountModule,
        StockModule,
        ChartModule,
        WebsocketModule,
    ],
})
export class AppModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(LoggerMiddleware).forRoutes('*');
    }
}
