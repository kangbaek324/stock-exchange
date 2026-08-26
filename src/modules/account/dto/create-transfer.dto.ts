import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateTransferDto {
    @IsInt()
    @Min(1)
    @Max(1000000000000)
    amount: number;

    @IsInt()
    @Min(1)
    recipientAccountNumber: number;

    @IsOptional()
    @IsString()
    @MaxLength(20)
    senderAlias?: string;
}
