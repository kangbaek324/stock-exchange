import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export enum TransferSort {
    LATEST = 'LATEST',
    OLDEST = 'OLDEST',
}

export enum TransferDirection {
    SENT = 'SENT',
    RECEIVED = 'RECEIVED',
}

export class GetTransferDto {
    @IsOptional()
    @IsInt()
    @Min(1)
    @Type(() => Number)
    page: number = 1;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(100)
    @Type(() => Number)
    limit: number = 20;

    // 지정하지 않으면 보낸 내역 + 받은 내역 전체
    @IsOptional()
    @IsEnum(TransferDirection)
    direction?: TransferDirection;

    // 정렬 순서 (미지정시 최신순)
    @IsOptional()
    @IsEnum(TransferSort)
    sort: TransferSort = TransferSort.LATEST;
}
