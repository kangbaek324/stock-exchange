import { IsEnum, IsInt } from "class-validator";

enum OrderType { limit = "limit", market = "market" }

export class BuyDto {
    @IsInt()
    account_number: number;

    @IsInt()
    stock_id: number;

    @IsInt()
    price: number;
    
    @IsInt()
    number: number;

    @IsEnum(OrderType)
    order_type: OrderType;
}