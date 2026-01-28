import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { SigninDto } from './dto/signin.dto';
import { SignupDto } from './dto/signup.dto';
import { JwtService } from '@nestjs/jwt';
import { UserPayload } from './interface/user-payload.interface';

const salt = 10;

@Injectable()
export class AuthService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly jwtService: JwtService
    ) {}

    async signup(dto: SignupDto): Promise<void> {
        // @TODO 커스텀 에러로 변경해야됨
        if (await this.checkUsernameDuplicate(dto.username)) {
            throw new ConflictException("이미 사용중인 이름입니다");
        }
        if (await this.checkEmailDuplicate(dto.email)) {
            throw new ConflictException("이미 사용중인 이메일입니다");
        }

        const password = await bcrypt.hash(dto.password, salt)
        await this.prismaService.user.create({ 
            data : {
                username : dto.username,
                password : password,
                email : dto.email
            }
        });
    }

    // @TODO RefreshToken 추가 해야됨
    async signin(dto: SigninDto): Promise<unknown> {
        let findUser = await this.prismaService.user.findUnique({
            where : { username : dto.username },
        })

        if (findUser) {
            // @TODO 비밀번호 검사 안하는 중 (테스트 용)
            // const match = await bcrypt.compare(signinData.password, findUser.password)
            const match = true;
            if (match) {
                const payload: UserPayload = { userId: findUser.id, username: dto.username };
                const jwt = { accessToken : this.jwtService.sign(payload) };

                return jwt;
            }
        }
        
        throw new UnauthorizedException("아이디 또는 비밀번호가 잘못되었습니다.");
    }

    // 유저 이름 중복 체크
    private async checkUsernameDuplicate(username: string): Promise<Boolean> {
        const result = await this.prismaService.user.findUnique({
            where : { username : username }
        });
        
        return result ? true : false;
    }

    // 이메일 중복 체크
    private async checkEmailDuplicate(email: string): Promise<Boolean> {
        const result = await this.prismaService.user.findUnique({
            where : { email : email }
        });

        return result ? true : false;
    }
}
