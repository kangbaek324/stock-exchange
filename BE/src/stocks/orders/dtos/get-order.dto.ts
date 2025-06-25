import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsNumber, IsOptional } from "class-validator";

enum status {
    matched = "matched",
    notMatched = "not_matched"
}


export class GetOrderDto {
    @ApiProperty({
        example: 1001,
        description: "계좌번호"
    })
    @IsNumber()
    @Type(() => Number)
    accountnumber: number

    @ApiProperty({
        example: "matched",
        description: "조회할 주문의 상태 (matched, not_matched)"
    })
    @IsEnum(status)
    @Type(() => String)
    @IsOptional()
    status: status
}