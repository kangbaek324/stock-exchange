import { Body, Controller, Post, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import { SignupDto } from './dtos/signup.dto';
import { SigninDto } from './dtos/signin.dto';
import { AuthService } from './auth.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { jwtInterceptor } from './interceptors/jwt.interceptor';

@ApiTags("auth")
@Controller("auth")
export class AuthController {
    constructor(
        private readonly authService: AuthService,
    ) {}

    @ApiOperation({ summary: "회원가입" })
    @ApiResponse({ status: "2XX", description: ""})
    @Post("/signup")
    async signup(@Body() data: SignupDto): Promise<void> {
        return this.authService.signup(data);
    }

    @ApiOperation({ summary: "로그인" })
    @ApiResponse({ status: "2XX", description: `
        {
            "accessToken": "jwt token.."
        }    
    `})
    @Post("/signin")
    @UseInterceptors(jwtInterceptor)
    async signin(@Body() data: SigninDto): Promise<unknown> {
        return this.authService.signin(data)
    }
}
