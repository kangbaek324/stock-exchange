import { Controller, Get, Query } from '@nestjs/common';
import { RankingService } from './ranking.service';
import { GetRankingDto } from './dto/get-ranking.dto';

@Controller('rankings')
export class RankingController {
    constructor(private readonly rankingService: RankingService) {}

    @Get('/assets')
    async getAssetRanking(@Query() query: GetRankingDto) {
        return await this.rankingService.getAssetRanking(query);
    }
}
