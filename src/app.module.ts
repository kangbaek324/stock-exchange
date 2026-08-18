import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { OrderModule } from './modules/order/order.module';
import { AccountModule } from './modules/account/account.module';
import { StockModule } from './modules/stock/stock.module';
import { ChartModule } from './modules/chart/chart.module';
import { RankingModule } from './modules/ranking/ranking.module';
import { MessagingModule } from './common/messaging/messaging.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerMiddleware } from './middlewares/logger.middleware';
import { AppController } from './app.controller';
import { ScheduleModule } from '@nestjs/schedule';
import { RedisModule } from '@nestjs-modules/ioredis';

@Module({
    controllers: [AppController],
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        RedisModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                type: 'single',
                url: config.getOrThrow<string>('REDIS_URL'),
            }),
        }),
        ScheduleModule.forRoot(),
        MessagingModule,
        AuthModule,
        PrismaModule,
        OrderModule,
        AccountModule,
        StockModule,
        ChartModule,
        RankingModule,
    ],
})
export class AppModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(LoggerMiddleware).forRoutes('*');
    }
}
