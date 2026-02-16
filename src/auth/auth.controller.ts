import { Body, Controller, Delete, Post, Req, UseInterceptors } from '@nestjs/common';
import { SignupDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';
import { AuthService } from './auth.service';
import { jwtInterceptor } from './interceptor/jwt.interceptor';
import { Request } from 'express';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('/signup')
    async signup(@Body() data: SignupDto): Promise<void> {
        return this.authService.signup(data);
    }

    @Post('/signin')
    @UseInterceptors(jwtInterceptor)
    async signin(@Body() data: SigninDto) {
        return this.authService.signin(data);
    }

    @Post('/access-token')
    async refreshAccessToken(@Req() req: Request) {
        const refreshToken = req.cookies['refreshToken'];
        return this.authService.refreshAccessToken(refreshToken);
    }

    @Post('/logout')
    async logout(@Req() req: Request) {
        const refreshToken = req.cookies['refreshToken'];
        return this.authService.logout(refreshToken);
    }
}
