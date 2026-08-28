import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ACCOUNT_AMOUNT_LIMIT } from 'src/common/consants/account.constants';

export class CreateTransferDto {
    @IsInt()
    @Min(1)
    @Max(ACCOUNT_AMOUNT_LIMIT.MAX_BALANCE)
    amount: number;

    @IsInt()
    @Min(1)
    recipientAccountNumber: number;

    @IsOptional()
    @IsString()
    @MaxLength(20)
    senderAlias?: string;
}
