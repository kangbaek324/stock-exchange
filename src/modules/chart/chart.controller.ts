import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ChartService } from './chart.service';
import { ChartType } from './type/chart-type';

@Controller('/stocks')
export class ChartController {
    constructor(private readonly chartService: ChartService) {}

    @Get(':id/chart')
    getChart(
        @Param('id', ParseIntPipe) stockId: number,
        @Query('type') type: ChartType,
    ) {
        return this.chartService.getChart(stockId, type);
    }
}
