import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { WebsocketModule } from './websocket/websocket.module';
import { StockModule } from './stocks/stock.module';
import { ConfigModule } from '@nestjs/config';
import { LoggerMiddleware } from './middlewares/logger.middleware';
import { RouterModule } from '@nestjs/core';
import { InfoModule } from './stocks/info/info.module';
import { OrdersModule } from './stocks/orders/orders.module';
import { AccountModule } from './stocks/account/account.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule, PrismaModule, StockModule, WebsocketModule,
    RouterModule.register([
      {
        path: 'stocks',
        module: StockModule,
        children: [
          { path: 'info', module: InfoModule },
          { path: 'orders', module: OrdersModule },
          { path: 'account', module: AccountModule }
        ]
      }
    ]),
  ],
})

export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
