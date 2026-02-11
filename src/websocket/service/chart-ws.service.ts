import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { CustomSocket } from '../interface/custom-socket.interface';

@Injectable()
export class ChartWsService {
    constructor(private readonly prismaService: PrismaService) {}
    private server: Server;

    setServer(server: Server) {
        this.server = server;
    }

    onJoinChartWsRoom(stockId: number, type: ChartType, client: CustomSocket) {
        const stockIdToString = stockId.toString();
        client.join(`chart_${stockIdToString}_${type}`);
    }

    async getChartM(stockId: number, type: ChartType) {
        const time = type.slice(0, -1);

        const chartData: any[] = await this.prismaService.$queryRaw`
            SELECT 
                DATE_FORMAT(om.matched_at, CONCAT('%Y-%m-%d %H:', LPAD(FLOOR(MINUTE(om.matched_at) / ${time}) * ${time}, 2, '0'), ':00')) as time,
                SUBSTRING_INDEX(GROUP_CONCAT(o.price ORDER BY om.matched_at ASC, om.id ASC), ',', 1) AS open,
                MAX(o.price) AS high,
                MIN(o.price) AS low,
                SUBSTRING_INDEX(GROUP_CONCAT(o.price ORDER BY om.matched_at DESC, om.id DESC), ',', 1) AS close,
                SUM(om.number) AS volume
            FROM
                order_matches om
            JOIN
                orders o 
            ON
                o.id = om.initial_order_id
            WHERE 
                om.stock_id = ${stockId}
            GROUP BY time
            ORDER BY time DESC
            limit 1;
        `;

        return chartData.map((data) => ({
            ...data,
            high: data.high.toString(),
            low: data.low.toString(),
            volume: data.volume.toString(),
        }));
    }

    async getChartD(stockId: number) {
        const chartData: any[] = await this.prismaService.$queryRaw`
            SELECT 
                sh.date AS time,
                sh.high,
                sh.low,
                sh.close,
                sh.open,
                COALESCE(SUM(om.number), 0) AS volume
            FROM stock_histories sh
            LEFT JOIN order_matches om 
                ON om.stock_id = sh.stock_id 
                AND DATE(om.matched_at) = sh.date
            WHERE sh.stock_id = ${stockId}
            GROUP BY sh.date, sh.high, sh.low, sh.close, sh.open
            ORDER BY sh.date DESC
            limit 1;
            `;

        return chartData.map((data) => ({
            ...data,
            high: data.high.toString(),
            low: data.low.toString(),
            close: data.close.toString(),
            open: data.open.toString(),
            volume: data.volume.toString(),
        }));
    }

    async updateChart(stockId: number) {
        const chartmList: ChartType[] = ['1m', '5m', '15m', '30m', '60m'];

        chartmList.forEach(async (m) => {
            this.server
                .to(`chart_${stockId.toString()}_${m}`)
                .emit(`chartUpdated_${m}`, await this.getChartM(stockId, m));
        });

        this.server
            .to(`chart_${stockId.toString()}_1d`)
            .emit('chartUpdated_1d', await this.getChartD(stockId));
    }
}
