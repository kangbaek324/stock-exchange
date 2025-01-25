import { Body, Controller, Post, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { SignupDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Post("/sign-up")
    async signup(@Body() SignupData: SignupDto) {
        if (await this.userService.checkUsernameDuplicate(SignupData.username)) {
            throw new BadRequestException("이미 사용중인 이름입니다");
        }
        if (await this.userService.checkEmailDuplicate(SignupData.email)) {
            throw new BadRequestException("이미 사용중인 이메일입니다");
        }
        if (await !this.userService.signup(SignupData)) {
            throw new InternalServerErrorException("회원가입에 실패했습니다");
        }
    }

    @Post("/sign-in")
    signin(@Body() signinData: SigninDto ) {
        return "success";
    }

    @Post("/account/create")
    accountCreate(): string {
        return "success";
    }
}
