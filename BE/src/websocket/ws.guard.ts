import { CanActivate, Injectable } from "@nestjs/common";
import { AsyncSubject, Observable } from "rxjs";
import * as jwt from 'jsonwebtoken';
import { ConfigService } from "@nestjs/config";

@Injectable()
export class WsGuard implements CanActivate {
    constructor(
        private readonly config: ConfigService
    ) {}

    canActivate(
        context: any,
    ): boolean | any | Promise<boolean | any> | Observable<boolean | any> {
        const client = context.switchToWs().getClient();
        const accessToken = client.handshake?.headers?.cookie;
        if (!accessToken) {
            client.emit('errorCustom', { message: '인증 토큰이 없습니다.' });
            return false;
        }
        try {
            const decoded = jwt.verify(accessToken.substr(12), this.config.get<string>("JWT_SECRET"));
            client.user = decoded;
            return true;
        } catch(err) {
            client.emit('errorCustom', { message: '유효하지 않은 토큰 입니다.' });
            return false;
        }
    }
}