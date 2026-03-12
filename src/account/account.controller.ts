import {
    Body,
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Post,
    UseGuards,
} from '@nestjs/common';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { AccountService } from './account.service';
import { User } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { DepositAccountBalanceDto, withDrawAccountBalanceDto } from './dto/withdraw-account-balance.dto';

@Controller('accounts')
@UseGuards(JwtAuthGuard)
export class AccountController {
    constructor(private readonly accountService: AccountService) {}

    @Get('/')
    async getMyAccountList(@GetUser() user: User) {
        return await this.accountService.getMyAccountList(user);
    }

    @Post('/')
    async accountCreate(@GetUser() user: User): Promise<unknown> {
        return await this.accountService.createAccount(user);
    }

    @Post('/:accountNumber/transfer')
    async transferAccountBalance(
        @GetUser() user: User,
        @Param('accountNumber', ParseIntPipe) accountNumber: number,
        @Body() dto: TransferDto,
    ) {
        return await this.accountService.transferAccountBalance(user, dto, accountNumber);
    }

    // ADMIN
    @Post('/:accountNumber/deposit')
    async depositAccountBalance(
        @Param('accountNumber') accountNumber: number,
        @Body() dto: DepositAccountBalanceDto,
    ) {
        return await this.accountService.depositAccountBalance(dto, accountNumber);
    }

    //ADMIN
    @Post('/:accountNumber/withdraw')
    async withdrawAccountBalance(
        @Param('accountNumber') accountNumber: number,
        @Body() dto: withDrawAccountBalanceDto,
    ) {
        return await this.accountService.withdrawAccountBalance(dto, accountNumber);
    }

    @Post('/:accountNumber/stocks/:id/deposit')
    async depositStock(@Param('accountNumber') accountNumber: number, @Body dto:) {

    }
}
