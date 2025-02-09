import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt/jwt.strategy';

@Module({
  imports: [
    PassportModule.register({
      defaultStrategy: "jwt"
    }),
    JwtModule.register({
    secret: "orderbook",
    // signOptions: {
    //   expiresIn: undefined
    // },
  })],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [JwtStrategy, PassportModule]
})

export class AuthModule {}
