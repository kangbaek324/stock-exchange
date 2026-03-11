import { IsInt, Min } from 'class-validator';

export class TransferDto {
    @IsInt()
    @Min(1)
    amount: number;

    @IsInt()
    @Min(1)
    toAccountNumber: number;
}
