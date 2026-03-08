import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { StockService } from './stock.service';
import { StockDto } from './dto/stock.dto';

@Controller('stocks')
export class StockController {
    constructor(private readonly stockService: StockService) {}

    @Get('/')
    async getStockList() {
        return await this.stockService.getStockList();
    }

    @Post('/')
    async createStock(@Body() dto: StockDto) {
        return await this.stockService.createStock(dto);
    }

    @Get('/:id')
    async getStockInfo(@Param('id') stockId: number) {
        return await this.stockService.getStockInfo(stockId);
    }
}
