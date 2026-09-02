import {
    Body,
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { AccountService } from './account.service';
import { User } from '@prisma/client';
import { JwtAuthGuard } from 'src/modules/auth/guard/jwt-auth.guard';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { GetTransferDto } from './dto/get-transfer.dto';

@Controller('accounts')
@UseGuards(JwtAuthGuard)
export class AccountController {
    constructor(private readonly accountService: AccountService) {}

    @Get('/')
    async getMyAccountList(@GetUser() user: User) {
        return await this.accountService.getMyAccountList(user);
    }

    @Post('/')
    async createAccount(@GetUser() user: User): Promise<unknown> {
        return await this.accountService.createAccount(user);
    }

    @Post('/:senderAccountNumber/transfers')
    async createTransfer(
        @GetUser() user: User,
        @Param('senderAccountNumber', ParseIntPipe) senderAccountNumber: number,
        @Body() dto: CreateTransferDto,
    ) {
        return await this.accountService.createTransfer(user, dto, senderAccountNumber);
    }

    @Get('/:accountNumber/transfers')
    async getTransferList(
        @GetUser() user: User,
        @Param('accountNumber', ParseIntPipe) accountNumber: number,
        @Query() query: GetTransferDto,
    ) {
        return await this.accountService.getTransferList(user, query, accountNumber);
    }
}
