import { IsInt, Max, Min } from 'class-validator';
import { ACCOUNT_AMOUNT_LIMIT } from 'src/common/consants/account.constants';

export class WithdrawStockDto {
    @IsInt()
    @Min(1)
    @Max(ACCOUNT_AMOUNT_LIMIT.MAX_STOCK)
    amount: number;
}
