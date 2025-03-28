import { ApiProperty } from "@nestjs/swagger";
import { IsInt } from "class-validator";

export class EditDto {
    @ApiProperty({
        example: 1001,
        description: "계좌번호"
    })
    @IsInt()
    acountNumber: number;

    @ApiProperty({
        example: 1,
        description: "주문 번호"
    })
    @IsInt()
    orderId: number;

    @ApiProperty({
        example: 2300,
        description: "정정 가격"
    })
    @IsInt()
    price: number;
}