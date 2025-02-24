import { IsInt } from "class-validator";

export class EditDto {
    @IsInt()
    acountNumber: number;

    @IsInt()
    orderId: number;

    @IsInt()
    price: number;
}