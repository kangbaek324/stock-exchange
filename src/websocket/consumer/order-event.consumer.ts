import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { OrderEventedData } from '../type/order-evented-data.type';
import { OrderWsService } from '../service/order-ws.service';
import { StockWsService } from '../service/stock-ws.service';
import { AccountWsService } from '../service/account-ws.service';
import { ChartWsService } from '../service/chart-ws.service';

@Controller()
export class OrderEventConsumer {
    constructor(
        private readonly orderWsService: OrderWsService,
        private readonly accountWsService: AccountWsService,
        private readonly stockWsService: StockWsService,
        private readonly chartWsService: ChartWsService,
    ) {}

    @EventPattern('order.evented')
    async orderEvented(@Payload() mqData: OrderEventedData, @Ctx() context: RmqContext) {
        const channel = context.getChannelRef();
        const originalMsg = context.getMessage();

        const stockId = mqData.stock.id;
        const stockPirce = mqData.stock.nextPrice;
        const matchedAt = mqData.matchedAt;
        const volume = mqData.volume;

        try {
            await Promise.all([
                mqData.updatedOrders.length >= 2
                    ? (this.chartWsService.updateChart(
                          stockId,
                          stockPirce,
                          volume,
                          matchedAt,
                      ),
                      this.stockWsService.updateStock(stockId),
                      this.stockWsService.updateStockPrice(stockId, stockPirce))
                    : Promise.resolve(),
                ...mqData.updatedOrders.map((order) =>
                    Promise.all([
                        this.orderWsService.updateOrder(order.accountId, order),
                        this.accountWsService.updateAccount(order.accountId),
                    ]),
                ),
            ]);

            channel.ack(originalMsg);
        } catch (err) {
            console.error(err);
            channel.nack(originalMsg);
        }
    }
}
