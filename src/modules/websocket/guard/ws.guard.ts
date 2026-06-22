import { CanActivate, Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import * as jwt from 'jsonwebtoken';
import { TokenExpiredError } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WsGuard implements CanActivate {
    constructor(private readonly config: ConfigService) {}

    canActivate(
        context: any,
    ): boolean | any | Promise<boolean | any> | Observable<boolean | any> {
        const client = context.switchToWs().getClient();
        const accessToken = client.handshake.auth.token;

        if (!accessToken) {
            client.emit('errorCustom', { message: 'AccessToken이 누락되었습니다.' });
            return false;
        }

        try {
            const decoded = jwt.verify(
                accessToken,
                this.config.get<string>('ACCESS_TOKEN_SECRET'),
            );
            client.user = decoded;
            return true;
        } catch (err) {
            if (err instanceof TokenExpiredError) {
                client.emit('errorCustom', { message: 'AccessToken이 만료되었습니다.' });
            } else {
                client.emit('errorCustom', {
                    message: 'AccessToken이 유효하지 않습니다.',
                });
            }
            return false;
        }
    }
}
