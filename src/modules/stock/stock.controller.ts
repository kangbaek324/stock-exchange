import { Controller, Get } from '@nestjs/common';
import { StockService } from './stock.service';

@Controller('stocks')
export class StockController {
    constructor(private readonly stockService: StockService) {}

    @Get('/')
    async getStockList() {
        return await this.stockService.getStockList();
    }

    // @Get('/:id')
    // async getStockInfo(@Param('id') stockId: number) {
    //     return await this.stockService.getStockInfo(stockId);
    // }
}
