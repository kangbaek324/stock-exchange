import { ApiProperty } from "@nestjs/swagger";
import { IsInt } from "class-validator";

export class CancelDto {
    @ApiProperty({
        example: 1001,
        description: "계좌번호"
    })
    @IsInt()
    accountNumber: number;

    @ApiProperty({
        example: 1,
        description: "주문 번호"
    })
    @IsInt()
    orderId: number;
}