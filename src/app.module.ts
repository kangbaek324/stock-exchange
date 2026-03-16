import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { WebsocketModule } from './websocket/websocket.module';
import { StockModule } from './stock/stock.module';
import { ConfigModule } from '@nestjs/config';
import { LoggerMiddleware } from './middlewares/logger.middleware';
import { AccountModule } from './account/account.module';
import { AppController } from './app.controller';
import { ScheduleModule } from '@nestjs/schedule';
import { RedisModule } from '@nestjs-modules/ioredis';
import { ConfigService } from '@nestjs/config';

@Module({
    controllers: [AppController],
    imports: [
        RedisModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                type: 'single',
                options: {
                    host: config.get('REDIS_HOST'),
                    port: Number(config.get('REDIS_PORT')),
                    password: config.get('REDIS_PASSWORD'),
                },
            }),
        }),
        ConfigModule.forRoot({ isGlobal: true }),
        ScheduleModule.forRoot(),
        AuthModule,
        PrismaModule,
        StockModule,
        WebsocketModule,
        AccountModule,
    ],
})
export class AppModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(LoggerMiddleware).forRoutes('*');
    }
}
