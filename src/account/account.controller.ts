import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { AccountService } from './account.service';

@Controller("account")
@UseGuards(AuthGuard("jwt"))
export class AccountController {
    constructor(
        private readonly accountService: AccountService
    ) {}

    @Get("/")
    async getMyAccountList(@GetUser() user) {
        console.log(user);
        return this.accountService.getMyAccountList(user);
    }

    @Post("/")
    async accountCreate(@GetUser() user): Promise<unknown> {
        return this.accountService.createAccount(user);
    }
}
