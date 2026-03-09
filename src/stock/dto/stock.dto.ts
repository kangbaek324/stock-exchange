import { IsNumber, IsString } from 'class-validator';

export class StockDto {
    @IsString()
    name: string;

    @IsNumber()
    listingPrice: number;
}
