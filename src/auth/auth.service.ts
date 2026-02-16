import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { SigninDto } from './dto/signin.dto';
import { SignupDto } from './dto/signup.dto';
import { JwtService } from '@nestjs/jwt';
import { UserPayload } from './interface/user-payload.interface';
import { AuthException } from './error/auth.exception';

const SALT = 10;
const ACCESS_TOKEN_EXPIRED = '15m';
const REFRESH_TOKEN_EXPIRED = '7d';

@Injectable()
export class AuthService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly jwtService: JwtService,
    ) {}

    // 회원가입
    async signup(dto: SignupDto): Promise<void> {
        if (await this.checkUsernameDuplicate(dto.username)) {
            throw new AuthException('ALREADY_EXIST_NAME');
        }
        if (await this.checkEmailDuplicate(dto.email)) {
            throw new AuthException('ALREADY_EXIST_EMAIL');
        }

        const password = await bcrypt.hash(dto.password, SALT);
        await this.prismaService.user.create({
            data: {
                username: dto.username,
                password: password,
                email: dto.email,
            },
        });
    }

    // 로그인
    async signin(dto: SigninDto): Promise<unknown> {
        const user = await this.prismaService.user.findUnique({
            where: { username: dto.username },
        });

        if (user) {
            const match = await bcrypt.compare(dto.password, user.password);
            if (match) {
                const payload: UserPayload = {
                    userId: user.id,
                };

                const jwt = {
                    accessToken: this.jwtService.sign(payload, {
                        expiresIn: ACCESS_TOKEN_EXPIRED,
                    }),
                    refreshToken: this.jwtService.sign(payload, {
                        expiresIn: REFRESH_TOKEN_EXPIRED,
                    }),
                };

                await this.prismaService.refreshToken.create({
                    data: {
                        hashedToken: await bcrypt.hash(jwt.refreshToken, SALT),
                        userId: user.id,
                    },
                });

                return jwt;
            }
        }

        throw new AuthException('INCORRECT_ID_OR_PASSWORD');
    }

    // AccessToken 재발급
    async refreshAccessToken(refreshToken: string) {
        const { jwt, matchedToken } = await this.validateRefreshToken(refreshToken);

        if (jwt.exp < Math.floor(Date.now() / 1000)) {
            await this.prismaService.refreshToken.delete({
                where: { id: matchedToken.id },
            });

            throw new AuthException('REFRESH_TOKEN_EXPIRED');
        }

        const payload: UserPayload = { userId: jwt.userId };
        return this.jwtService.sign(payload, {
            expiresIn: ACCESS_TOKEN_EXPIRED,
        });
    }

    // 로그아웃
    async logout(refreshToken: string) {
        const { matchedToken } = await this.validateRefreshToken(refreshToken);

        await this.prismaService.refreshToken.delete({
            where: { id: matchedToken.id },
        });
    }

    // RefreshToken 검증
    private async validateRefreshToken(refreshToken: string) {
        const jwt = this.jwtService.verify(refreshToken, { ignoreExpiration: true });

        const refreshTokenDBList = await this.prismaService.refreshToken.findMany({
            where: { userId: jwt.userId },
        });

        let matchedToken = null;
        for (const refreshTokenDB of refreshTokenDBList) {
            if (await bcrypt.compare(refreshToken, refreshTokenDB.hashedToken)) {
                matchedToken = refreshTokenDB;
                break;
            }
        }

        if (!matchedToken) throw new AuthException('REFRESH_TOKEN_NOT_FOUND');

        return { jwt, matchedToken };
    }

    // 유저 이름 중복 체크
    private async checkUsernameDuplicate(username: string): Promise<Boolean> {
        const result = await this.prismaService.user.findUnique({
            where: { username: username },
        });

        return result ? true : false;
    }

    // 이메일 중복 체크
    private async checkEmailDuplicate(email: string): Promise<Boolean> {
        const result = await this.prismaService.user.findUnique({
            where: { email: email },
        });

        return result ? true : false;
    }
}
