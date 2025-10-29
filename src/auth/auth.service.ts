import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { SigninDto } from './dtos/signin.dto';
import { SignupDto } from './dtos/signup.dto';
import { JwtService } from '@nestjs/jwt';
import { Payload } from './interfaces/payload.interface';

const salt = 10;

@Injectable()
export class AuthService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly jwtService: JwtService
    ) {}

    async signup(signupData: SignupDto): Promise<void> {
        if (await this.checkUsernameDuplicate(signupData.username)) {
            throw new BadRequestException("이미 사용중인 이름입니다");
        }
        if (await this.checkEmailDuplicate(signupData.email)) {
            throw new BadRequestException("이미 사용중인 이메일입니다");
        }
        try {
            const password = await bcrypt.hash(signupData.password, salt)
            await this.prismaService.users.create({ 
                data : {
                    username : signupData.username,
                    password : password,
                    email : signupData.email
                }
            });
        } catch (err) {
            console.log(err)
            throw new InternalServerErrorException();
        }
    }

    async checkUsernameDuplicate(username: string): Promise<Boolean> {
        try {
            const result = await this.prismaService.users.findUnique({
                where : {  username : username }
            });
            return result ? true : false;
        } catch (err) {
            console.log(err)
            return false;
        }
    }

    async checkEmailDuplicate(email: string): Promise<Boolean> {
        try {
            const result = await this.prismaService.users.findUnique({
                where : { email : email }
            });
            return result ? true : false;
        } catch (err) {
            console.log(err)
            return false;
        }
    }

    async signin(signinData: SigninDto): Promise<unknown> {
        let findUser;
        try {
            findUser = await this.prismaService.users.findUnique({
                where : { username : signinData.username },
            })
        } catch (err) {
            console.log(err)
            throw new InternalServerErrorException("서버에 오류가 발생했습니다")
        }

        if (findUser) {
            // const match = await bcrypt.compare(signinData.password, findUser.password)
            const match = true;
            if (match) {
                const payload: Payload = { userId: findUser.id, username: signinData.username }
                const jwt = { accessToken : this.jwtService.sign(payload) };
                return jwt
            } else {
                throw new BadRequestException("아이디 또는 비밀번호가 잘못되었습니다");
            }
        } else {
            throw new BadRequestException("아이디 또는 비밀번호가 잘못되었습니다,");
        }
    }
}
