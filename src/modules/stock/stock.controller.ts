import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { StockService } from './stock.service';
import { StockDto } from './dto/stock.dto';
import { AdminGuard } from 'src/modules/auth/guard/admin.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/modules/auth/guard/jwt-auth.guard';

@Controller('stocks')
export class StockController {
    constructor(private readonly stockService: StockService) {}

    // @Get('/')
    // async getStockList() {
    //     return await this.stockService.getStockList();
    // }

    // @Get('/:id')
    // async getStockInfo(@Param('id') stockId: number) {
    //     return await this.stockService.getStockInfo(stockId);
    // }

    // ADMIN //

    // @UseGuards(JwtAuthGuard, AdminGuard)
    // @Roles('ADMIN')
    // @Patch('/:id/status')
    // async updateStockStatus(@Param('id') stockId: number, @Body() dto: StockStatusDto) {
    //     return await this.stockService.updateStockStatus(dto, stockId);
    // }

    @UseGuards(JwtAuthGuard, AdminGuard)
    @Roles('ADMIN')
    @Post('/')
    async createStock(@Body() dto: StockDto) {
        return await this.stockService.createStock(dto);
    }
}
