import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class InfoService {
    constructor(private readonly prisma : PrismaService) {}
    async getStockInfo(stockId) {
        return await this.prisma.stocks.findUnique({
          where : { id : stockId },
          select : { price : true }
        });
      }
}
