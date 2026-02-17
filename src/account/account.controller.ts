import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { AccountService } from './account.service';
import { User } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';

@Controller('accounts')
@UseGuards(JwtAuthGuard)
export class AccountController {
    constructor(private readonly accountService: AccountService) {}

    @Get('/')
    async getMyAccountList(@GetUser() user: User) {
        return this.accountService.getMyAccountList(user);
    }

    @Post('/')
    async accountCreate(@GetUser() user: User): Promise<unknown> {
        return this.accountService.createAccount(user);
    }
}
