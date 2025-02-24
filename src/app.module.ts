import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { WebsocketModule } from './websocket/websocket.module';

@Module({
  imports: [AuthModule, PrismaModule, UserModule, WebsocketModule],
})
export class AppModule {}
