import { IsInt, Max, Min } from 'class-validator';

export class TransferAccountBalanceDto {
    @IsInt()
    @Min(1)
    @Max(1000000000000)
    amount: number;

    @IsInt()
    @Min(1)
    @Max(99999)
    toAccountNumber: number;
}
