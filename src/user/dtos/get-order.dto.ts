import { Type } from "class-transformer";
import { IsEnum, IsNumber, IsOptional } from "class-validator";

enum status {
    matched = "matched",
    notMatched = "not_matched"
}


export class GetOrderDto {
    @IsNumber()
    @Type(() => Number)
    accountnumber: number

    @IsEnum(status)
    @Type(() => String)
    @IsOptional()
    status: status
}