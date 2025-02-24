import { IsEnum, IsInt } from "class-validator";

enum OrderType { limit = "limit", market = "market" }

export class SellDto {
    @IsInt()
    accountNumber: number;

    @IsInt()
    stockId: number;

    @IsInt()
    price: number;
    
    @IsInt()
    number: number;

    @IsEnum(OrderType)
    orderType: OrderType;
}