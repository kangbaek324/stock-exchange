import { IsInt, Max, Min } from 'class-validator';
import { ACCOUNT_AMOUNT_LIMIT } from 'src/common/consants/account.constants';

export class DepositStockDto {
    @IsInt()
    @Min(1)
    @Max(ACCOUNT_AMOUNT_LIMIT.MAX_STOCK)
    amount: number;

    // 계좌에 해당 종목 보유가 없을 때 생성될 평균 단가
    @IsInt()
    @Min(0)
    @Max(ACCOUNT_AMOUNT_LIMIT.MAX_BALANCE)
    average: number;
}
