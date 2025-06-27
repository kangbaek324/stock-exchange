import { Controller, Get, Param } from '@nestjs/common';
import { InfoService } from './info.service';

@Controller()
export class InfoController {
    constructor(
        private readonly infoService: InfoService
    ) {}

    @Get("/") 
    getStockList() {
        return this.infoService.getStockList();
    }

    @Get("/:id")
    getStockInfo(@Param("id") stockId: number) {
        return this.infoService.getSstockInfo(stockId);
    }
}
