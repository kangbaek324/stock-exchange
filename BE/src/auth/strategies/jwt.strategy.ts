import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "src/common/prisma/prisma.service";
import { Request } from "express";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor (
        private readonly prismaService: PrismaService,
        private readonly configService: ConfigService
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromExtractors([
                (req: Request) => {
                    return req?.cookies?.accessToken || null;
                },
            ]),
            secretOrKey: configService.get<string>('JWT_SECRET'),
        });
    }

    async validate(payload): Promise<unknown> {
        const { userId } = payload;
        const result = await this.prismaService.users.findUnique({
            where : {
                id : userId
            },
            select : {
                id : true,
                username : true
            }
        })
        if (!result) {
            console.log(result)
            throw new UnauthorizedException();
        }
        return result
    }
}