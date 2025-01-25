import { Body, Controller, HttpException, HttpStatus, Post } from '@nestjs/common';
import { SignupDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Post("/sign-up")
    signup(@Body() SignupDto: SignupDto): string {
        if (this.userService.signup()) {
            return "success";
        }
        else {
            throw new HttpException("internet server error", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Post("/sign-in")
    signin(@Body() signinDto: SigninDto ): string {
        return "success";
    }

    @Post("/account/create")
    accountCreate(): string {
        return "success";
    }
}
