import { Controller, Get, Param } from '@nestjs/common';
import { InfoService } from './info.service';

@Controller("stock/info")
export class InfoController {
    constructor(private readonly infoService : InfoService) {}

    @Get("/:stockId")
    async getStockInfo(@Param("stockId") stockId : number) {
        await this.infoService.getStockInfo(stockId);
    }
}
