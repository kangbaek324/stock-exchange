import { Body, Controller, Post, BadRequestException, Res, UseGuards } from '@nestjs/common';
import { SignupDto } from './dtos/signup.dto';
import { SigninDto } from './dtos/signin.dto';
import { AuthService } from './auth.service';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from '../common/decorator/get-user.decorator';
import { Payload } from './interfaces/payload.interface';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post("/sign-up")
    async signup(@Body() signupData: SignupDto): Promise<void> {
        if (await this.authService.checkUsernameDuplicate(signupData.username))
            throw new BadRequestException("이미 사용중인 이름입니다");
        if (await this.authService.checkEmailDuplicate(signupData.email))
            throw new BadRequestException("이미 사용중인 이메일입니다");
        return await this.authService.signup(signupData);
    }

    @Post("/sign-in")
    async signin(@Body() signinData: SigninDto, @Res() res: Response): Promise<void> {
        const jwt = await this.authService.signin(signinData)
        //여기 수정필요함 인터셉터로 옮기기
        res.setHeader('Authorization', jwt.accessToken);
        res.json(jwt)
    }

    @Post("/account/create")
    @UseGuards(AuthGuard("jwt"))
    async accountCreate(@GetUser() user: Payload): Promise<void> {
        await this.authService.createAccount(user);
    }
}
