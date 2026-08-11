import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsISO8601, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ChartType, CHART_TYPES } from '../type/chart-type';

export class GetChartDto {
    @ApiProperty({ example: '1m', enum: CHART_TYPES, description: '봉 타입' })
    @IsIn(CHART_TYPES)
    type: ChartType;

    @ApiProperty({
        required: false,
        description: '이 시각(candleTime)보다 과거 데이터를 조회. 이전 응답의 nextCursor 값',
    })
    @IsOptional()
    @IsISO8601()
    cursor?: string;

    @ApiProperty({ required: false, default: 250, description: '조회 개수 (최대 250)' })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(250)
    limit: number = 250;
}
