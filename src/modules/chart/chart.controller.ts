import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ChartService } from './chart.service';
import { GetChartDto } from './dto/get-chart.dto';

@Controller('/stocks')
export class ChartController {
    constructor(private readonly chartService: ChartService) {}

    @Get(':id/chart')
    getChart(
        @Param('id', ParseIntPipe) stockId: number,
        @Query() query: GetChartDto,
    ) {
        return this.chartService.getChart(stockId, query);
    }
}
