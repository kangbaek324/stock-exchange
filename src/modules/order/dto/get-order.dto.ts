import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class GetOrderDto {
    @ApiProperty({
        example: 1001,
        description: '계좌번호',
    })
    @IsNumber()
    @Type(() => Number)
    accountnumber: number;

    @ApiProperty({
        example: 'OPEN',
        description: '조회할 주문의 상태 (OPEN, FILLED, CANCELED, REPLACED, REJECTED)',
        enum: OrderStatus,
        required: false,
    })
    @IsEnum(OrderStatus)
    @IsOptional()
    status?: OrderStatus;
}
