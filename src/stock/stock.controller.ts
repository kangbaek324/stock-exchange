import { Controller, Get, Param } from '@nestjs/common';
import { StockService } from './stock.service';

@Controller('stocks')
export class StockController {
    constructor(private readonly stockService: StockService) {}

    @Get('/')
    getStockList() {
        return this.stockService.getStockList();
    }

    @Get('/:id')
    getStockInfo(@Param('id') stockId: number) {
        return this.stockService.getStockInfo(stockId);
    }
}
