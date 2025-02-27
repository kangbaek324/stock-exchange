import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { WebsocketModule } from './websocket/websocket.module';
import { StockModule } from './stock/stock.module';

@Module({
  imports: [AuthModule, PrismaModule, StockModule, WebsocketModule],
})
export class AppModule {}
