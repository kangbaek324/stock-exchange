// import { Controller, Get, Param, Query } from '@nestjs/common';
// import { ChartService } from './chart.service';

// @Controller('/stocks')
// export class ChartController {
//     constructor(private readonly chartService: ChartService) {}

//     @Get(':id/chart')
//     async getChart(@Param('id') stockId: number, @Query('type') type: ChartType) {
//         return this.chartService.getChart(stockId, type);
//     }
// }
