import { BuyDto } from '../dto/buy.dto';
import { SellDto } from '../dto/sell.dto';
import { EditDto } from '../dto/edit.dto';
import { CancelDto } from '../dto/cancel.dto';

export type OrderCommand =
    | { type: 'buy'; stockId: number; dto: BuyDto }
    | { type: 'sell'; stockId: number; dto: SellDto }
    | { type: 'edit'; orderId: string; dto: EditDto }
    | { type: 'cancel'; orderId: string; dto: CancelDto };
