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
import { TransferDto } from './dto/transfer.dto';

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
}
