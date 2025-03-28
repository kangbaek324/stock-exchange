import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsInt } from "class-validator";

enum OrderType { limit = "limit", market = "market" }

export class SellDto {
    @ApiProperty({
        example: 1001,
        description: "계좌번호"
    })
    @IsInt()
    accountNumber: number;

    @ApiProperty({
        example: 1,
        description: "종목 번호"
    })
    @IsInt()
    stockId: number;

    @ApiProperty({
        example: 2500,
        description: "주문 가격"
    })
    @IsInt()
    price: number;
    
    @ApiProperty({
        example: 5,
        description: "주문 수량"
    })
    @IsInt()
    number: number;

    @ApiProperty({
        example: "limit",
        description: "주문 유헝"
    })
    @IsEnum(OrderType)
    orderType: OrderType;
}