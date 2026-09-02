import { Body, Controller, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { AccountAdminService } from './account-admin.service';
import { JwtAuthGuard } from 'src/modules/auth/guard/jwt-auth.guard';
import { AdminGuard } from 'src/modules/auth/guard/admin.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { DepositAccountBalanceDto } from './dto/deposit-account-balance.dto';
import { WithdrawAccountBalanceDto } from './dto/withdraw-account-balance.dto';
import { DepositStockDto } from './dto/deposit-stock.dto';
import { WithdrawStockDto } from './dto/withdraw-stock.dto';

@Controller('admin/accounts')
@UseGuards(JwtAuthGuard, AdminGuard)
@Roles('ADMIN')
export class AccountAdminController {
    constructor(private readonly accountAdminService: AccountAdminService) {}

    // 계좌 잔고 입금
    @Post('/:accountNumber/deposit')
    async depositAccountBalance(
        @GetUser() user: User,
        @Param('accountNumber', ParseIntPipe) accountNumber: number,
        @Body() dto: DepositAccountBalanceDto,
    ) {
        return await this.accountAdminService.depositAccountBalance(
            user,
            dto,
            accountNumber,
        );
    }

    // 계좌 잔고 출금
    @Post('/:accountNumber/withdraw')
    async withdrawAccountBalance(
        @GetUser() user: User,
        @Param('accountNumber', ParseIntPipe) accountNumber: number,
        @Body() dto: WithdrawAccountBalanceDto,
    ) {
        return await this.accountAdminService.withdrawAccountBalance(
            user,
            dto,
            accountNumber,
        );
    }

    // 보유 주식 입고
    @Post('/:accountNumber/stocks/:stockId/deposit')
    async depositStock(
        @Param('accountNumber', ParseIntPipe) accountNumber: number,
        @Param('stockId', ParseIntPipe) stockId: number,
        @Body() dto: DepositStockDto,
    ) {
        return await this.accountAdminService.depositStock(dto, accountNumber, stockId);
    }

    // 보유 주식 출고
    @Post('/:accountNumber/stocks/:stockId/withdraw')
    async withdrawStock(
        @Param('accountNumber', ParseIntPipe) accountNumber: number,
        @Param('stockId', ParseIntPipe) stockId: number,
        @Body() dto: WithdrawStockDto,
    ) {
        return await this.accountAdminService.withdrawStock(dto, accountNumber, stockId);
    }
}
