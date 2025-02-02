import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor (
        private readonly prismaService: PrismaService
    ) {
        super({
            secretOrKey: "orderbook",
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken()
        })
    }

    async validate(payload): Promise<unknown> {
        const { username } = payload;
        const result = await this.prismaService.users.findUnique({
            where : {
                username : username
            }
        })
        if (!result) {
            throw new UnauthorizedException();
        }

        return result;
    }
}