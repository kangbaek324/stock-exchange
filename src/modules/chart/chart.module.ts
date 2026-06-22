import { Module } from '@nestjs/common';
import { ChartController } from './chart.controller';
import { ChartService } from './chart.service';
import { ChartSchedulerService } from './chart-scheduler.service';

@Module({
    providers: [ChartService, ChartSchedulerService],
    controllers: [ChartController],
})
export class ChartModule {}
