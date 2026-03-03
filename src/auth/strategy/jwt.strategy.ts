import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { UserPayload } from '../interface/user-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly configService: ConfigService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: configService.get<string>('ACCESS_TOKEN_SECRET'),
        });
    }

    async validate(payload: UserPayload): Promise<unknown> {
        const { userId } = payload;

        const result = await this.prismaService.user.findUnique({
            where: {
                id: userId,
            },
        });

        if (!result) {
            throw new UnauthorizedException();
        }

        return result;
    }
}
