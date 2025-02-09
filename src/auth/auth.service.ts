import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { SigninDto } from './dto/signin.dto';
import { SignupDto } from './dto/signup.dto';
import { JwtService } from '@nestjs/jwt';
import { Payload } from './interface/payload.interface';
import { Jwt } from './interface/jwt.interface';

const salt = 10;

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService
    ) {}

    /**
     * @param SignupDto
     * @description "회원가입 함수"
     */
    async signup(signupData: SignupDto): Promise<void> {
        try {
            const password = await bcrypt.hash(signupData.password, salt)
            await this.prisma.users.create({ 
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

    /**
     * @param username 
     * @description "username 중복 체크 함수"
     * @returns "중복이 있을경우 true 없을경우 false를 반환함"
     */
    async checkUsernameDuplicate(username: string): Promise<Boolean> {
        try {
            const result = await this.prisma.users.findUnique({
                where : {  username : username }
            });
            return result ? true : false;
        } catch (err) {
            console.log(err)
            return false;
        }
    }

    /**
     * @param email 
     * @description "이메일 중복 체크 함수"
     * @returns "중복이 있을경우 true 없을경우 false를 반환함"
     */
    async checkEmailDuplicate(email: string): Promise<Boolean> {
        try {
            const result = await this.prisma.users.findUnique({
                where : { email : email }
            });
            return result ? true : false;
        } catch (err) {
            console.log(err)
            return false;
        }
    }

    /**
     * @param SigninDto
     * @returns "로그인 함수"
     */
    async signin(signinData: SigninDto): Promise<Jwt> {
        let findUser;
        try {
            findUser = await this.prisma.users.findUnique({
                where : { username : signinData.username },
            })
        } catch (err) {
            console.log(err)
            throw new InternalServerErrorException("서버에 오류가 발생했습니다")
        }

        if (findUser) {
            const match = await bcrypt.compare(signinData.password, findUser.password)
            if (match) {
                const payload: Payload = { user_id: findUser.id, username: signinData.username }
                const jwt: Jwt = { accessToken : this.jwtService.sign(payload) };
                return jwt
            } else {
                throw new BadRequestException("아이디 또는 비밀번호가 잘못되었습니다");
            }
        } else {
            throw new BadRequestException("아이디 또는 비밀번호가 잘못되었습니다,");
        }
    }

    /**
     * @param  user
     * @returns "계좌개설 함수"
     */
    //동시요청 예외 처리하기
    async createAccount(user) {
        try {
            const before_account_number = await this.prisma.accounts.findFirst({
                orderBy : { created_at: "desc" },
                select : { account_number: true }
            });
            await this.prisma.accounts.create({
                data : {
                    user_id : user.id,
                    account_number : ++before_account_number.account_number,
                    money : 100000000
                }
            });
            return await this.prisma.accounts.findFirst({
                where: { user_id: user.user_id },
                orderBy: { created_at: "desc" },
                select: { account_number: true }
            });
        } catch (err) {
            console.log(err)
            throw new InternalServerErrorException("서버에 오류가 발생했습니다")
        }
    }
}
