import { IsInt, Max, Min } from 'class-validator';

export class DepositDto {
    @IsInt()
    @Min(1)
    @Max(1000000000000)
    amount: number;
}
