import { IsInt, Max, Min } from 'class-validator';

export class withDrawAccountBalanceDto {
    @IsInt()
    @Min(1)
    @Max(1000000000000)
    amount: number;
}
