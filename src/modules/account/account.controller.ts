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
import { JwtAuthGuard } from 'src/modules/auth/guard/jwt-auth.guard';
import { withDrawAccountBalanceDto } from './dto/withdraw-account-balance.dto';
import { DepositStockDto } from './dto/deposit-stock.dto';
import { TransferAccountBalanceDto } from './dto/transfer-account-balance.dto';
import { DepositAccountBalanceDto } from './dto/deposit-account-balance.dto copy';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AdminGuard } from 'src/modules/auth/guard/admin.guard';

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
        @Body() dto: TransferAccountBalanceDto,
    ) {
        return await this.accountService.transferAccountBalance(user, dto, accountNumber);
    }

    // ADMIN //

    @UseGuards(AdminGuard)
    @Roles('ADMIN')
    @Post('/:accountNumber/deposit')
    async depositAccountBalance(
        @Param('accountNumber') accountNumber: number,
        @Body() dto: DepositAccountBalanceDto,
    ) {
        return await this.accountService.depositAccountBalance(dto, accountNumber);
    }

    @UseGuards(AdminGuard)
    @Roles('ADMIN')
    @Post('/:accountNumber/withdraw')
    async withdrawAccountBalance(
        @Param('accountNumber') accountNumber: number,
        @Body() dto: withDrawAccountBalanceDto,
    ) {
        return await this.accountService.withdrawAccountBalance(dto, accountNumber);
    }

    @UseGuards(AdminGuard)
    @Roles('ADMIN')
    @Post('/:accountNumber/stocks/:stockId/deposit')
    async depositStock(
        @Param('accountNumber') accountNumber: number,
        @Param('stockId') stockId: number,
        @Body() dto: DepositStockDto,
    ) {
        return await this.accountService.depositStock(dto, accountNumber, stockId);
    }

    @UseGuards(AdminGuard)
    @Roles('ADMIN')
    @Post('/:accountNumber/stocks/:stockId/withdraw')
    async withdrawStock(
        @Param('accountNumber') accountNumber: number,
        @Param('stockId') stockId: number,
        @Body() dto: DepositStockDto,
    ) {
        return await this.accountService.withdrawStock(dto, accountNumber, stockId);
    }
}
