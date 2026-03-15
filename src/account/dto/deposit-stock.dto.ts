import { IsInt, Max, Min } from 'class-validator';

export class DepositStockDto {
    @IsInt()
    @Min(1)
    @Max(10000000)
    amount: number;
}
