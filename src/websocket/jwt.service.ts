import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient();
    const token = client.handshake?.headers?.authorization?.split(' ')[1];
    if (!token) throw new WsException('Token not found');

    try {
      const payload = this.jwtService.verify(token);
      client.user = payload;
      return true;
    } catch (err) {
      throw new WsException('Invalid token');
    }
  }
}
