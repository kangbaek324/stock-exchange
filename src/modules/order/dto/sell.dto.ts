import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt } from 'class-validator';
import { OrderType } from '@prisma/client';

export class SellDto {
    @ApiProperty({
        example: 1001,
        description: '계좌번호',
    })
    @IsInt()
    accountNumber: number;

    @ApiProperty({
        example: 2500,
        description: '주문 가격',
    })
    @IsInt()
    price: number;

    @ApiProperty({
        example: 5,
        description: '주문 수량',
    })
    @IsInt()
    quantity: number;

    @ApiProperty({
        example: 'LIMIT',
        description: '주문 유형',
        enum: OrderType,
    })
    @IsEnum(OrderType)
    orderType: OrderType;
}
