import { Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Payload } from 'src/auth/interfaces/payload.interface';
import { GetUser } from 'src/common/decorator/get-user.decorator';
import { AccountService } from './account.service';

@Controller()
@UseGuards(AuthGuard("jwt"))
export class AccountController {
    constructor(
        private readonly accountService: AccountService
    ) {}

    @Post("/")
    async accountCreate(@GetUser() user: Payload): Promise<unknown> {
        return this.accountService.createAccount(user);
    }
}
