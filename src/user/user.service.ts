import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

const salt = 10;

@Injectable()
export class UserService {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * @param SignupDto
     * @description "회원가입 함수"
     * @returns 성공여부에 따라 true 와 false 를 반환함
     */
    async signup(SignupData): Promise<boolean> {
        try {
            const password = await bcrypt.hash(SignupData.password, salt)
            const result = await this.prisma.users.create({ 
                data : {
                    username : SignupData.username,
                    password : password,
                    email : SignupData.email
                }
            });
            return result ? true : false;
        } catch (err) {
            return false;
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
                    where : {
                        username : username
                    }
                });
                return result ? true : false;
            } catch (err) {
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
                where : {
                    email : email
                }
            });
            return result ? true : false;
        } catch (err) {
            return false;
        }
    }

    /**
     * @param SigninDto
     * @returns "로그인 함수"
     */
    signin() {

    }

    /**
     * @param  jwttoken
     * @returns "계좌개설 함수"
     */
    createAccount() {
        
    }
}
