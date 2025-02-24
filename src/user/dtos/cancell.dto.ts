import { IsInt } from "class-validator";

export class CancellDto {
    @IsInt()
    accountNumber: number;

    @IsInt()
    orderId: number;
}