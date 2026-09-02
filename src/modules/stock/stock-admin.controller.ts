import {
    Body,
    Controller,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    UseGuards,
} from '@nestjs/common';
import { StockService } from './stock.service';
import { StockDto } from './dto/stock.dto';
import { StockStatusDto } from './dto/stock-status.dto';
import { JwtAuthGuard } from 'src/modules/auth/guard/jwt-auth.guard';
import { AdminGuard } from 'src/modules/auth/guard/admin.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

// 관리자 전용 종목 관리 (상장/상태 변경)
@Controller('admin/stocks')
@UseGuards(JwtAuthGuard, AdminGuard)
@Roles('ADMIN')
export class StockAdminController {
    constructor(private readonly stockService: StockService) {}

    // 종목 상장
    @Post('/')
    async createStock(@Body() dto: StockDto) {
        return await this.stockService.createStock(dto);
    }

    // 종목 상태 변경 (거래정지/상장폐지 등)
    @Patch('/:id/status')
    async updateStockStatus(
        @Param('id', ParseIntPipe) stockId: number,
        @Body() dto: StockStatusDto,
    ) {
        return await this.stockService.updateStockStatus(dto, stockId);
    }
}
