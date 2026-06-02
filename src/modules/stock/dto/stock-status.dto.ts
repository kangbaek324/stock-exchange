import { StockStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class StockStatusDto {
    @IsEnum(StockStatus)
    status: StockStatus;
}
